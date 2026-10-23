import logging
import time

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("nexus.firewall")


class BackendFirewallMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        internal_secret: str = "",
        max_payload_bytes: int = 25 * 1024 * 1024,  # 25MB payload limit
        rate_limit_per_minute: int = 60,
    ):
        super().__init__(app)
        self.internal_secret = internal_secret.strip() if internal_secret else ""
        self.max_payload_bytes = max_payload_bytes
        self.rate_limit_per_minute = rate_limit_per_minute
        self._ip_history = {}

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Allow CORS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        # 2. Allow open health checks, documentation, browser defaults, and
        # public Auth routes. Authentication endpoints (/api/v1/auth/*)
        # must be reachable by users logging in or registering.
        open_endpoints = [
            "/",
            "/health",
            "/healthz",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/favicon.ico",
        ]
        is_open_path = (
            request.url.path in open_endpoints
            or request.url.path.startswith("/api/v1/auth")
        )
        if is_open_path:
            return await call_next(request)

        # 3. Rate limiting enforcement per IP (sliding 60s window)
        client_host = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "")
        )
        is_localhost = client_host in ("127.0.0.1", "localhost", "::1", "testclient")
        if not is_localhost and client_host:
            now = time.time()
            history = [t for t in self._ip_history.get(client_host, []) if now - t < 60]
            if len(history) >= self.rate_limit_per_minute:
                logger.warning("[Firewall] Rate limit exceeded for IP %s", client_host)
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "Too Many Requests",
                        "detail": f"Rate limit of {self.rate_limit_per_minute} requests/minute exceeded. Please retry shortly.",
                    },
                    headers={"Retry-After": "60"},
                )
            history.append(now)
            self._ip_history[client_host] = history

        # 4. Validate Internal Secret header on protected routes
        # (Chat, Upload, Scrape, Admin)
        if self.internal_secret and not is_localhost:
            client_secret = request.headers.get("X-Internal-Secret")
            if not client_secret or client_secret != self.internal_secret:
                logger.warning(
                    "[Firewall] Blocked direct public invocation on %s from %s",
                    request.url.path,
                    client_host or "unknown",
                )
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": "Access Denied",
                        "detail": (
                            "Direct backend invocation forbidden. Missing or invalid "
                            "internal security header."
                        ),
                    },
                )

        # 5. Restrict oversized payloads (DoS protection)
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_payload_bytes:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={
                    "error": "Payload Too Large",
                    "detail": (
                        "Request payload exceeds max allowed limit of "
                        f"{self.max_payload_bytes // (1024 * 1024)}MB."
                    ),
                },
            )

        # 6. Process Request and inject OWASP security response headers
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

        return response

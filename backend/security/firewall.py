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
    ):
        super().__init__(app)
        self.internal_secret = internal_secret.strip() if internal_secret else ""
        self.max_payload_bytes = max_payload_bytes

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Allow CORS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        # 2. Allow open health checks, documentation, browser defaults, and public Auth routes
        # Authentication endpoints (/api/v1/auth/*) must be reachable by users logging in or registering.
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

        # 3. In local development (localhost / 127.0.0.1 / testsuite), allow requests
        # so local development isn't blocked when developing or testing endpoints directly.
        client_host = request.client.host if request.client else ""
        is_localhost = client_host in ("127.0.0.1", "localhost", "::1", "testclient")

        # 4. Validate Internal Secret header on protected routes (Chat, Upload, Scrape, Admin)
        if self.internal_secret and not is_localhost:
            client_secret = request.headers.get("X-Internal-Secret")
            if not client_secret or client_secret != self.internal_secret:
                logger.warning(
                    f"[Firewall] Blocked direct public invocation on {request.url.path} from {client_host or 'unknown'}"
                )
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": "Access Denied",
                        "detail": "Direct backend invocation forbidden. Missing or invalid internal security header.",
                    },
                )

        # 5. Restrict oversized payloads (DoS protection)
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_payload_bytes:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={
                    "error": "Payload Too Large",
                    "detail": f"Request payload exceeds max allowed limit of {self.max_payload_bytes // (1024 * 1024)}MB.",
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

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Lazy-initialize Upstash Redis to prevent edge runtime crashes if env vars are missing
let ratelimit: Ratelimit | null = null;

function getRateLimiter(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Only initialize if valid, non-placeholder credentials are provided
  if (url && token && !url.includes("<your-") && !token.includes("<your-")) {
    try {
      const redis = new Redis({ url, token });
      ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 requests per minute per IP
        analytics: true,
      });
    } catch (err) {
      console.warn("[Middleware] Upstash Redis initialization error:", err);
      ratelimit = null;
    }
  }
  return ratelimit;
}

export async function middleware(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";
  const path = request.nextUrl.pathname;
  const userAgent = request.headers.get("user-agent") || "";

  // 1. Block Automated Malicious Scanners on API routes
  if (path.startsWith("/api/")) {
    const maliciousScanners = [
      "sqlmap",
      "nikto",
      "masscan",
      "acunetix",
      "havij",
    ];
    if (
      maliciousScanners.some((bot) => userAgent.toLowerCase().includes(bot))
    ) {
      return new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message: "Automated scan signature detected.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // 2. Apply Rate Limiting (Protected API routes and dynamic paths)
  const limiter = getRateLimiter();
  if (limiter && path.startsWith("/api/")) {
    try {
      const { success, limit, remaining, reset } = await limiter.limit(
        `rate_${ip}`,
      );
      if (!success) {
        return new NextResponse(
          JSON.stringify({
            error: "Too Many Requests",
            message:
              "Rate limit exceeded. Please wait a minute before retrying.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          },
        );
      }
    } catch (rateLimitErr) {
      // Gracefully fail-open if Redis encounters connection timeout so app remains usable
      console.warn("[Middleware] Rate limiting check failed:", rateLimitErr);
    }
  }

  // 3. Inject Strict OWASP Security Headers
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  return response;
}

export const config = {
  // Exclude static assets, Next.js internal chunks, icons, and image extensions
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};

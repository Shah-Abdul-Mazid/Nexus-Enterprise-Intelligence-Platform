# Project Security Checklist — Nexus Enterprise Intelligence Platform

## Audit Categories

### 1. Authentication & Session Security
- [x] Passwords hashed using robust bcrypt hashing algorithm (`passlib.context.CryptContext(schemes=["bcrypt"])`).
- [x] JWT tokens have explicit expiration (`exp`) and strong signature verification.
- [x] Configurable `JWT_SECRET_KEY` loaded from environment variables rather than hardcoded.
- [x] Direct user endpoint `GET /api/v1/auth/users/me` requires Bearer token.

### 2. Authorization & RBAC
- [x] Server-side access controls validated on every API request.
- [x] Resource access verifies ownership (`chat.py` validates `user_id == current_user.id`).
- [x] Administrative ingestion endpoint (`/api/v1/ingest-local`) requires `role == "admin"`.

### 3. Input Validation & Injection Prevention
- [x] File upload endpoint enforces `os.path.basename` to prevent path traversal (`../`).
- [x] File upload restricts extensions to approved whitelist (`.pdf`, `.docx`, `.doc`, `.txt`, `.csv`, `.xlsx`, `.xls`).
- [x] Scrape endpoints enforce SSRF prevention, blocking localhost, loopback, private IPs, and cloud metadata (`169.254.169.254`).
- [x] MongoDB database connections employ RFC 3986 URL encoding (`urllib.parse.quote_plus`) to prevent URI injection / parser crashes.

### 4. API Security & Infrastructure
- [x] Application Firewall Middleware (`BackendFirewallMiddleware`) enforces `X-Internal-Secret` matching `RENDER_INTERNAL_SECRET`.
- [x] CORS configured with explicit allowed origins (`FRONTEND_URL`, `http://localhost:3000`) rather than wildcard `*` with credentials.
- [x] CORS preflight (`OPTIONS`) requests cleanly passed through without blocking.
- [x] Vercel Edge middleware applies Upstash Redis rate-limiting (30 req/min per IP) on API paths.
- [x] Frontend middleware excludes static assets, chunks, and images from rate limits to prevent site breakage.
- [x] Automated scanner user-agents (`sqlmap`, `nikto`, `masscan`) blocked at Edge layer.
- [x] Hardened multi-stage Dockerfile running as non-root `appuser` without build compiler tools in production runtime.
- [x] Safe health checks (`/` and `/health`) allow cloud provider monitoring and probes.

### 5. Deployment & Secrets Hygiene
- [x] `.env` files explicitly excluded from Git version control via `.gitignore`.
- [x] Frontend and backend `.env.example` templates created without real secrets.
- [x] Backend database startup ping wrapped in graceful error handling to prevent Render deploy exit status 3.
- [x] Frontend API client dynamically sources backend base URL from `NEXT_PUBLIC_API_URL` and attaches `X-Internal-Secret`.

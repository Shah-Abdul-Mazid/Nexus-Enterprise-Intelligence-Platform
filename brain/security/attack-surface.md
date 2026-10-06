# Attack Surface Map — Nexus Enterprise Intelligence Platform

## 1. Network & Endpoint Surfaces
- **Public Frontend (Vercel):**
  - Next.js UI pages (`/`, `/dashboard`, `/auth/*`). Protected by Edge middleware with security headers and asset exclusion rules.
- **Backend Application (Render):**
  - Exposed publicly at `https://nexus-enterprise-intelligence-platform.onrender.com`.
  - Public health checks: `GET /`, `GET /health` (bypassed from firewall for uptime monitoring).
  - Documentation: `/docs`, `/openapi.json`, `/redoc` (open or restricted via environment).
  - Protected API routes: All `/api/v1/*` routes require matching `X-Internal-Secret` header when `RENDER_INTERNAL_SECRET` is configured.

## 2. Ingestion & User Input Surfaces
- **Chat Query Endpoint (`POST /api/v1/chat`):**
  - Ingests user prompt strings. Handled via LangChain / LLM pipeline. Session access guarded by user identity verification (`user_id == current_user.id`).
- **File Upload Endpoint (`POST /api/v1/upload`):**
  - Ingests multipart files. Filenames are stripped of directory paths (`os.path.basename`) and checked against an extension whitelist (`.pdf`, `.docx`, `.doc`, `.txt`, `.csv`, `.xlsx`, `.xls`). Max payload bounded to 25MB.
- **Web Scraping Endpoints (`POST /api/v1/scrape`, `/bulk-scrape`):**
  - Ingests URLs for remote content scraping. Guarded by SSRF checks blocking local/loopback and cloud metadata (`169.254.169.254`).
- **Admin Ingestion Endpoint (`POST /api/v1/ingest-local`):**
  - Guarded by role verification requiring `role == "admin"`.

## 3. Storage & Database Access
- **MongoDB Atlas (`cluster0.2nsvkzq.mongodb.net`):**
  - Transport encrypted via TLS (`certifi.where()`).
  - Auth validated against Atlas users.
  - Startup protected against connection failure crashes via 5s timeout and resilient exception handling.
- **Pinecone Vector Database:**
  - Encrypted REST requests using `PINECONE_API_KEY`.

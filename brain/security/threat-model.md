# Project Threat Model — Nexus Enterprise Intelligence Platform

## 1. System Assets
- **User Data & Credentials:** User emails, bcrypt password hashes, JWT access tokens.
- **Enterprise Documents & Knowledge Base:** Corporate files (PDF, XLSX, CSV, DOCX) uploaded for RAG processing, Pinecone vector embeddings.
- **Third-Party API Credentials:** OpenAI, Grok, Google Gemini, Pinecone, Tavily, Upstash Redis keys.
- **Database & Storage:** MongoDB Atlas application collections (`users`, `chats`, `messages`), ephemeral file storage.
- **Compute & Cloud Workloads:** Render Python/FastAPI web service, Vercel Next.js edge deployment.

## 2. Trust Boundaries
- **TB-1: Client Browser <---> Vercel Edge Server**
  - *Boundary:* Untrusted internet to edge application layer.
  - *Risk:* Automated bot probing, credential stuffing, DDoS, and excessive API usage.
- **TB-2: Vercel Edge / Frontend <---> Render Backend Service**
  - *Boundary:* Cross-cloud service integration.
  - *Risk:* Direct backend invocation bypassing rate limiting, unauthorized direct API calls.
- **TB-3: Render Backend <---> Third-Party Services (MongoDB, Pinecone, LLM Providers)**
  - *Boundary:* Trusted backend to external vendor APIs over TLS.
  - *Risk:* Egress credential leakage, API credit exhaustion, indirect prompt injection.

## 3. Threat Actors
- **External Unauthenticated Attacker:** Attempts automated scanning, DDoS, direct backend invocation, MongoDB injection, SSRF.
- **Authenticated Malicious User:** Attempts privilege escalation, IDOR / BOLA on chat histories, arbitrary file uploads.
- **Compromised Dependency / Supply Chain Threat:** Malicious third-party npm or pip dependencies.

## 4. Entry Points
- **Frontend Routes:** Next.js UI (`/`, `/dashboard`, `/auth/login`, `/auth/register`).
- **Backend Auth Endpoints:** `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `GET /api/v1/auth/users/me`.
- **Backend Protected APIs:** `POST /api/v1/chat`, `POST /api/v1/feedback`, `POST /api/v1/upload`, `POST /api/v1/scrape`, `POST /api/v1/bulk-scrape`.
- **Administrative Endpoints:** `POST /api/v1/ingest-local` (restricted to admin role).
- **Public Health Endpoints:** `GET /`, `GET /health`.

## 5. Threat Matrix & Mitigations

| Threat ID | Description | Impact | Likelihood | Risk Severity | Mitigations Implemented |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TM-01** | Direct Backend Bypass | High | High | **CRITICAL** | `BackendFirewallMiddleware` validates `X-Internal-Secret` matching `RENDER_INTERNAL_SECRET`. Direct requests lacking token receive 403 Forbidden. |
| **TM-02** | DDoS & AI API Credit Drain | High | Medium | **HIGH** | `frontend/src/middleware.ts` applies Upstash Redis sliding window rate-limiting on API paths (30 req/min per IP). |
| **TM-03** | Path Traversal via File Upload | High | Medium | **HIGH** | `upload.py` enforces `os.path.basename` and white-lists allowed file extensions (`.pdf`, `.docx`, `.csv`, `.xlsx`). |
| **TM-04** | Server-Side Request Forgery (SSRF) | High | Medium | **HIGH** | `scrape.py` validates URLs, requiring HTTP/HTTPS and blocking loopback, private RFC1918 IPs, and cloud metadata (`169.254.169.254`). |
| **TM-05** | Broken Object Level Auth (IDOR) | High | Medium | **HIGH** | `chat.py` verifies chat session ownership against `current_user.id`. |
| **TM-06** | Special Characters in DB Password Crash | High | High | **HIGH** | `database.py` applies RFC 3986 URL sanitization (`urllib.parse.quote_plus`) and catches startup ping failures gracefully to prevent exit status 3. |
| **TM-07** | Automated Scanner Fingerprinting | Medium | High | **MEDIUM** | Frontend middleware intercepts known vulnerability scanners (`sqlmap`, `nikto`, `masscan`) and blocks with 403. |
| **TM-08** | Insecure Wildcard CORS with Credentials | Medium | High | **MEDIUM** | `main.py` restricts `CORSMiddleware` to defined origins (`FRONTEND_URL`, localhost) and removes illegal `["*"]` with `allow_credentials=True`. |

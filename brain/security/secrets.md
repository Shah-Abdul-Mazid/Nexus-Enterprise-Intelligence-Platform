# Secrets Management & Audit — Nexus Enterprise Intelligence Platform

## 1. Expected Secrets Inventory
- **Database Connection:** `DATABASE_URL` / `MONGODB_URL` (MongoDB Atlas SRV connection string with RFC 3986 escaped password).
- **Service-to-Service Firewall Key:** `RENDER_INTERNAL_SECRET` (Backend) / `NEXT_PUBLIC_RENDER_INTERNAL_SECRET` (Frontend API client).
- **JWT Signing Key:** `JWT_SECRET_KEY` / `SECRET_KEY` (Used for HS256 authentication token signing).
- **Edge Rate Limiting:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (Vercel Edge middleware).
- **AI & Vector Service Keys:** `OPENAI_API_KEY`, `PINECONE_API_KEY`, `GOOGLE_API_KEY`, `GROK_API_KEY`, `TAVILY_API_KEY`.

## 2. Environment & Configuration Hygiene
- **Frontend Isolation:** Backend secrets (`OPENAI_API_KEY`, `DATABASE_URL`, `PINECONE_API_KEY`) must NEVER be prefixed with `NEXT_PUBLIC_` or imported in frontend components.
- **Git Hygiene:** Root `.gitignore` explicitly excludes `.env`, `.env.*` (while keeping `.env.example`).
- **Template Provisioning:** Clean `.env.example` templates exist in both `/frontend` and `/backend` without sensitive credentials.
- **RFC 3986 URL Encoding:** Complex database passwords containing `@`, `#`, `$`, `%` must be percent-encoded in MongoDB URIs (`@` -> `%40`, `#` -> `%23`). `database.py` automatically enforces this encoding at runtime.

## 3. Secret Rotation & Lifecycle Requirements
- **JWT Secret Key:** Rotate every 90 days. Changing `JWT_SECRET_KEY` automatically invalidates previous user tokens.
- **Internal Firewall Secret:** Rotate periodically using high-entropy 32-byte hex tokens (`openssl rand -hex 32`). Synchronize between Vercel environment variables and Render environment variables.
- **MongoDB Atlas Database Users:** Use dedicated database users (`ezanshah58_db_user`) with scoped read/write permissions on `nexus_db`. Ensure Atlas Network Access allows Render dynamic outbound IP access (`0.0.0.0/0`).

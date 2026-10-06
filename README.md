# 🚀 Nexus Intelligence: Enterprise Multi-Agent AI Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-000000.svg?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248.svg?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Pinecone](https://img.shields.io/badge/VectorDB-Pinecone-262626.svg?style=flat&logo=pinecone&logoColor=white)](https://www.pinecone.io/)
[![Upstash Redis](https://img.shields.io/badge/Edge%20Rate%20Limit-Upstash%20Redis-00E599.svg?style=flat&logo=redis&logoColor=white)](https://upstash.com/)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7.svg?style=flat&logo=render&logoColor=white)](https://render.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000.svg?style=flat&logo=vercel&logoColor=white)](https://vercel.com/)

> **Nexus Intelligence** is a production-grade enterprise cognitive platform designed to turn unstructured corporate data into grounded, secure, and actionable intelligence. Built with an autonomous multi-agent architecture, strict perimeter security, and dual-layer application firewalls across **Vercel** and **Render**.

---

## 👔 Executive Summary

In enterprise environments, critical knowledge is siloed across PDFs, Excel spreadsheets, internal web portals, and relational datastores. **Nexus Intelligence** serves as a secure, private **Cognitive Layer** for the organization:
- **Zero Hallucination Tolerance:** Responses are 100% grounded in verified internal documents and vectorized data.
- **Strict Perimeter Isolation:** Backend services on Render are shielded behind an internal cryptographic firewall token (`X-Internal-Secret`), preventing direct internet abuse.
- **Enterprise Compliance:** PII scanning, prompt inspection, and server-side role-based access control (RBAC).

---

## 🏗️ Architecture & Security Topology

```text
[ Client Browser / Authenticated User ]
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Vercel Edge Layer (Next.js 16)                          │
│  • Edge Middleware Rate Limiting (Upstash Redis 30 req/min) │
│  • Automated Bot & Malicious Scanner Blocker                │
│  • OWASP Security Headers (FrameGuard, nosniff, HSTS)       │
│  • Dynamic API Client injecting X-Internal-Secret & JWT     │
└──────────────────────────┬──────────────────────────────────┘
                           │ Authenticated & Shielded HTTPS Request
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Render Application Gateway (FastAPI Backend)             │
│  • BackendFirewallMiddleware (Enforces X-Internal-Secret)   │
│  • Strict CORS Whitelist (Vercel Production & Localhost)    │
│  • Preflight OPTIONS Bypass & DoS Payload Capping (25MB)    │
│  • Non-blocking MongoDB Atlas Resilient Connection Engine   │
└──────────────────────────┬──────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ MongoDB      │    │ Pinecone     │    │ Multi-Agent  │
│ Atlas Cloud  │    │ Vector DB    │    │ LLM Engine   │
│ (Users/Chat) │    │ (Semantic)   │    │ (GPT-4/Grok) │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 🛠️ Key Architectural Components

### 1. Autonomous Multi-Agent Core (`backend/app/agents/`)
- **👑 Supervisor Agent (`supervisor.py`):** Central orchestrator that classifies user intent, delegates tasks to specialist workers, and enforces traceability.
- **🔍 Retriever Agent (`retriever.py`):** Executes two-phase semantic retrieval using Pinecone namespaces (`feedback_memory` for user-verified answers and `main` for corporate docs).
- **🌐 Live Data Agent (`live_data.py`):** Integrates live real-time APIs (e.g., WeatherAPI) when real-time answers are demanded.
- **🛡️ Compliance Agent (`compliance.py`):** Post-generation privacy layer that redacts PII (emails, phone numbers) before emitting final responses.
- **🤖 Generator Agent (`generator.py`):** Dynamic multi-provider synthesis supporting OpenAI GPT-4o, Google Gemini, and Grok.

### 2. Dual-Layer Application Firewall
- **Edge Layer (`frontend/src/middleware.ts`):**
  - Upstash Redis sliding window limiter prevents financial exhaustion from LLM prompt flooding.
  - Intercepts malicious scanner user-agents (`sqlmap`, `nikto`, `masscan`, `acunetix`).
  - Whitelists static assets (`/_next/static`, images, fonts) to prevent false-positive throttling.
- **Core Layer (`backend/security/firewall.py`):**
  - Validates `X-Internal-Secret` matching `RENDER_INTERNAL_SECRET` on all incoming public requests.
  - Whitelists localhost loopbacks for smooth development workflows.
  - Enforces payload bounds (25MB limit) to block DoS memory attacks.

### 3. Hardened Ingestion Engine (`backend/app/api/v1/endpoints/`)
- **File Upload Guard (`upload.py`):** Strips path traversal sequences with `os.path.basename` and restricts files to whitelisted formats (`.pdf`, `.docx`, `.xlsx`, `.csv`).
- **SSRF-Protected Scraper (`scrape.py`):** Validates web targets, blocking loopbacks, RFC1918 private subnets, and cloud instance metadata (`169.254.169.254`).
- **Role-Gated Ingestion (`admin.py`):** Requires administrative Bearer authorization (`role == "admin"`) to trigger directory indexing.

---

## 📂 Project Directory Structure

```text
Nexus-Enterprise-Intelligence-Platform/
├── .gitignore                      # Comprehensive Git exclusion rules
├── README.md                       # Complete platform documentation
├── run.ps1                         # Local startup script
│
├── brain/
│   └── security/                   # Central Security Governance Hub
│       ├── threat-model.md         # Assets, trust boundaries & mitigations
│       ├── secrets.md              # Secret inventory & rotation schedules
│       ├── attack-surface.md       # Surface mapping & endpoint controls
│       └── security-checklist.md   # Deployment verification checklist
│
├── frontend/                       # Next.js 16 Web Application (Vercel)
│   ├── .env                        # Local environment variables
│   ├── .env.example                # Safe environment template
│   ├── package.json
│   ├── src/
│   │   ├── middleware.ts           # Edge rate limiting & bot blocking
│   │   ├── lib/
│   │   │   └── api.ts              # Axios client with internal secret & JWT
│   │   ├── app/                    # Next.js App Router (Dashboard & Auth)
│   │   └── context/                # AuthContext (State & Token storage)
│   └── public/
│
└── backend/                        # FastAPI REST API (Render / Docker)
    ├── .env                        # Local backend environment
    ├── .env.example                # Safe backend environment template
    ├── Dockerfile                  # Hardened multi-stage non-root container
    ├── requirements.txt            # Python dependencies
    ├── main.py                     # Entry point, CORS & middleware mounting
    ├── security/
    │   └── firewall.py             # Custom service-isolation firewall
    ├── app/
    │   ├── agents/                 # Multi-agent orchestrators
    │   ├── api/v1/endpoints/       # Auth, Chat, Upload, Scrape, Admin
    │   ├── core/                   # Security, JWT & Pydantic settings
    │   ├── db/                     # Resilient MongoDB & Pinecone connectors
    │   └── services/               # RAG business logic & feedback service
    └── uploads/                    # Temporary staging for uploads
```

---

## ⚙️ Environment Variables Reference

### Frontend Configuration (`frontend/.env`)
```env
# Render Backend Service URL
NEXT_PUBLIC_API_URL=https://nexus-enterprise-intelligence-platform.onrender.com
NEXT_PUBLIC_BACKEND_URL=https://nexus-enterprise-intelligence-platform.onrender.com

# Shared Application Firewall Token (Matches RENDER_INTERNAL_SECRET on backend)
NEXT_PUBLIC_RENDER_INTERNAL_SECRET=your_32_byte_internal_secret_here

# Upstash Redis Edge Rate Limiting
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token_here
```

### Backend Configuration (`backend/.env`)
```env
# LLM Providers & Vector DB
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
GROK_API_KEY=your_grok_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=enterprise-rag
TAVILY_API_KEY=your_tavily_api_key_here
WEATHER_API_KEY=your_weather_api_key_here

# MongoDB Atlas Connection
DATABASE_URL=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/nexus_db?retryWrites=true&w=majority
DEMO_MODE=false

# Security & Perimeter Controls
RENDER_INTERNAL_SECRET=your_32_byte_internal_secret_here
JWT_SECRET_KEY=your_jwt_signing_key_here
FRONTEND_URL=https://nexus-enterprise-intelligence-platform.vercel.app
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://nexus-enterprise-intelligence-platform.vercel.app
```

---

## 🚀 Quickstart: Local Development

### 1. Prerequisites
- **Python 3.11+** installed
- **Node.js 18+** & npm installed
- Active **MongoDB Atlas** cluster & **Pinecone** index

### 2. Run Backend
```powershell
# Navigate to backend directory
cd backend

# Create & activate virtual environment (optional)
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server
uvicorn main:app --reload --port 8000
```
*API will be available at:* `http://localhost:8000` (Docs: `http://localhost:8000/docs`)

### 3. Run Frontend
```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
*Web Application will be available at:* `http://localhost:3000`

---

## 🐳 Production Deployment

### 1. Backend Containerization (Render)
The repository includes an optimized, non-root multi-stage Dockerfile (`backend/Dockerfile`):
- **Stage 1 (Builder):** Installs compilation toolchains (`gcc`), compiles dependencies into `/install`, and cleans up.
- **Stage 2 (Runner):** Uses lean `python:3.11-slim`, copies pre-built wheels, creates unprivileged user `appuser`, and runs Uvicorn with `--proxy-headers` for Render's reverse proxy.

### 2. Frontend Deployment (Vercel)
- Connect repository to Vercel and point root directory to `frontend`.
- Configure the environment variables from `frontend/.env.example`.
- Next.js Edge Middleware will automatically enforce Upstash rate limiting and bot filtering.

---

## 🛡️ Security & Threat Governance
Complete security models and checklists are maintained in the repository:
- 📖 [Threat Model](brain/security/threat-model.md) — System assets, trust boundaries, and threat matrix.
- 📖 [Secrets Management & Audit](brain/security/secrets.md) — Secret inventory and lifecycle management.
- 📖 [Attack Surface Map](brain/security/attack-surface.md) — Ingestion and endpoint surface review.
- 📖 [Security Checklist](brain/security/security-checklist.md) — Production readiness verification.

---

## 📄 License
This project is licensed under the MIT License — see the LICENSE file for details.

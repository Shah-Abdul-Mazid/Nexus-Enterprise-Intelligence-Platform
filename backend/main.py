import os

import uvicorn
from app.api.v1.endpoints import admin, auth, chat, scrape, upload
from app.core.config import settings
from app.db.database import init_db
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from security.firewall import BackendFirewallMiddleware

# ─── Application ──────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise Multi-Agent RAG Platform",
    version="1.0.0",
)


# Ensure MongoDB indexes on startup safely
@app.on_event("startup")
async def startup_event():
    init_db()


# ─── CORS Configuration ───────────────────────────────────────────────────────
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
if frontend_url:
    # Ensure scheme is present
    if not frontend_url.startswith("http://") and not frontend_url.startswith(
        "https://"
    ):
        frontend_url = f"https://{frontend_url}"
    if frontend_url not in cors_origins:
        cors_origins.append(frontend_url)

raw_allowed = os.getenv("ALLOWED_ORIGINS", "")
if raw_allowed:
    for origin in raw_allowed.split(","):
        cleaned = origin.strip().rstrip("/")
        if cleaned:
            if not cleaned.startswith("http://") and not cleaned.startswith("https://"):
                cleaned = f"https://{cleaned}"
            if cleaned not in cors_origins:
                cors_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Internal-Secret",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
    expose_headers=["X-Process-Time", "Content-Length"],
)

# ─── Mount Application Firewall Middleware ─────────────────────────────────────
INTERNAL_SECRET = os.getenv("RENDER_INTERNAL_SECRET", "")
app.add_middleware(
    BackendFirewallMiddleware,
    internal_secret=INTERNAL_SECRET,
    max_payload_bytes=25 * 1024 * 1024,
)

# ─── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])
app.include_router(upload.router, prefix="/api/v1", tags=["Upload"])
app.include_router(scrape.router, prefix="/api/v1", tags=["Scrape"])
app.include_router(admin.router, prefix="/api/v1", tags=["Admin"])


# ─── Health Checks ──────────────────────────────────────────────────────────────
@app.get("/")
@app.get("/health")
async def root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "firewall_active": bool(INTERNAL_SECRET),
    }


# ─── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"Starting {settings.PROJECT_NAME}...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

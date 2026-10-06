import logging
import os
import re
import urllib.parse

import certifi

try:
    from dotenv import load_dotenv  # type: ignore[import-not-found]
except ImportError:

    def load_dotenv(*args, **kwargs):
        return False


from fastapi import HTTPException
from pymongo import MongoClient
from pymongo.database import Database

load_dotenv()

logger = logging.getLogger("nexus.database")


def sanitize_mongodb_uri(uri: str) -> str:
    """
    Sanitizes MongoDB URI by RFC 3986 encoding special characters in username
    and password. Prevents pymongo InvalidURI crash when passwords contain
    unescaped '@', '#', etc.
    """
    if not uri:
        return ""
    cleaned = uri.strip().strip("'\"")
    match = re.match(r"^(mongodb(?:\+srv)?://)(.*)@([^/@]+.*)$", cleaned)
    if match:
        prefix, userinfo, host_and_rest = match.groups()
        if ":" in userinfo:
            user, pwd = userinfo.split(":", 1)
            # Unquote first to avoid double-encoding if already quoted
            user_safe = urllib.parse.quote_plus(urllib.parse.unquote(user))
            pwd_safe = urllib.parse.quote_plus(urllib.parse.unquote(pwd))
            return f"{prefix}{user_safe}:{pwd_safe}@{host_and_rest}"
    return cleaned


_raw_url = os.getenv("DATABASE_URL") or os.getenv("MONGODB_URL") or ""
MONGODB_URL = sanitize_mongodb_uri(_raw_url)


def _get_db_name(url: str) -> str:
    if not url:
        return "nexus_db"
    try:
        path = url.split("?")[0]
        parts = path.split("/")
        if len(parts) > 3 and parts[-1].strip():
            return parts[-1].strip()
    except Exception:
        pass
    return "nexus_db"


_client: MongoClient | None = None


def get_client() -> MongoClient | None:
    global _client
    if _client is None:
        if not MONGODB_URL:
            logger.warning("[DB] DATABASE_URL / MONGODB_URL not configured.")
            return None
        try:
            _client = MongoClient(
                MONGODB_URL,
                tlsCAFile=certifi.where(),
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
            )
        except Exception as e:
            logger.error(f"[DB] Failed to create MongoClient: {e}")
            return None
    return _client


def get_database() -> Database | None:
    client = get_client()
    if client is None:
        return None
    db_name = _get_db_name(MONGODB_URL)
    return client[db_name]


# FastAPI dependency — yields a MongoDB Database instance
def get_db():
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Database service is unavailable or misconfigured. "
                "Please check MongoDB connection."
            ),
        )
    try:
        yield db
    finally:
        pass


# Create indexes on startup (called safely from main.py)
def init_db():
    try:
        if not MONGODB_URL:
            logger.warning(
                "[DB] No MongoDB URI provided. Skipping database initialization."
            )
            return

        client = get_client()
        if not client:
            logger.warning("[DB] MongoClient unavailable during startup.")
            return

        # Ping database with short timeout to verify connection
        client.admin.command("ping")
        logger.info("[DB] Successfully connected to MongoDB Atlas.")

        db = get_database()
        if db is not None:
            db["users"].create_index("email", unique=True)
            db["chats"].create_index("user_id")
            db["messages"].create_index("chat_id")
            logger.info("[DB] MongoDB indexes ensured.")
    except Exception as e:
        # Log warning but DO NOT crash the FastAPI server process
        logger.warning(
            f"[DB] MongoDB startup check failed: {e}. "
            "Server will continue running so healthchecks pass. "
            "Please check credentials and MongoDB Atlas Network Access."
        )

"""
MongoDB Document Models
=======================
Lightweight Python wrappers that turn MongoDB raw dict documents into
attribute-accessible objects so that the existing API endpoint code
(current_user.id, current_user.role, chat.id, etc.) works unchanged.
"""
from bson import ObjectId
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def resolve_target_tz(tz_name: str = None) -> ZoneInfo:
    if tz_name and tz_name != "auto":
        try:
            return ZoneInfo(tz_name)
        except Exception:
            pass
    return ZoneInfo("Asia/Dhaka")


def get_localized_now(tz_name: str = "Asia/Dhaka"):
    """
    Returns (now_local, now_aware) where now_local is naive datetime in the target timezone
    so MongoDB stores ISODate representing the user's local clock time (e.g. 03:21 AM BD time),
    and now_aware contains full timezone offset metadata.
    """
    tz = resolve_target_tz(tz_name)
    now_aware = datetime.now(tz)
    now_local = now_aware.replace(tzinfo=None)
    return now_local, now_aware


class User:
    """Maps a MongoDB users-collection document to a Python object."""

    def __init__(self, doc: dict):
        self._doc = doc
        self.id: str = str(doc["_id"])          # str(ObjectId)
        self.email: str = doc.get("email", "")
        self.hashed_password: str = doc.get("hashed_password", "")
        self.full_name: str = doc.get("full_name", "")
        self.role: str = doc.get("role", "user")
        self.created_at: datetime = doc.get("created_at", datetime.now(timezone.utc))

    @staticmethod
    def new_doc(email: str, hashed_password: str, full_name: str, role: str = "user", tz_name: str = "Asia/Dhaka") -> dict:
        now_local, now_aware = get_localized_now(tz_name)
        return {
            "email": email,
            "hashed_password": hashed_password,
            "full_name": full_name,
            "role": role,
            "created_at": now_local,
            "created_at_local": now_aware.strftime("%Y-%m-%d %I:%M:%S %p %Z"),
            "timezone": tz_name or "Asia/Dhaka",
        }


class Chat:
    """Maps a MongoDB chats-collection document to a Python object."""

    def __init__(self, doc: dict):
        self._doc = doc
        self.id: str = str(doc["_id"])
        self.user_id: str = str(doc.get("user_id", ""))
        self.title: str = doc.get("title", "New Chat")
        self.created_at: datetime = doc.get("created_at", datetime.now(timezone.utc))

    @staticmethod
    def new_doc(user_id: str, title: str = "New Chat", tz_name: str = "Asia/Dhaka") -> dict:
        now_local, now_aware = get_localized_now(tz_name)
        return {
            "user_id": user_id,
            "title": title,
            "created_at": now_local,
            "updated_at": now_local,
            "created_at_local": now_aware.strftime("%Y-%m-%d %I:%M:%S %p %Z"),
            "timezone": tz_name or "Asia/Dhaka",
        }


class Message:
    """Maps a MongoDB messages-collection document to a Python object."""

    def __init__(self, doc: dict):
        self._doc = doc
        self.id: str = str(doc["_id"])
        self.chat_id: str = str(doc.get("chat_id", ""))
        self.role: str = doc.get("role", "user")
        self.content: str = doc.get("content", "")
        self.sources: str = doc.get("sources", None)
        self.agent_logs: str = doc.get("agent_logs", None)
        self.created_at: datetime = doc.get("created_at", datetime.now(timezone.utc))

    @staticmethod
    def new_doc(chat_id: str, role: str, content: str,
                sources: str = None, agent_logs: str = None, tz_name: str = "Asia/Dhaka") -> dict:
        now_local, now_aware = get_localized_now(tz_name)
        return {
            "chat_id": chat_id,
            "role": role,
            "content": content,
            "sources": sources,
            "agent_logs": agent_logs,
            "created_at": now_local,
            "created_at_local": now_aware.strftime("%Y-%m-%d %I:%M:%S %p %Z"),
            "timezone": tz_name or "Asia/Dhaka",
        }

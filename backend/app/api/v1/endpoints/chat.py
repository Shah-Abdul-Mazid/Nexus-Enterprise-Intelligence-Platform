from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from pymongo.database import Database
from bson import ObjectId
import json

from app.services.rag_service import rag_service
from app.api.v1.endpoints.auth import get_current_user
from app.db.database import get_db
from app.db.models import User, Chat, Message
from app.services.feedback_service import feedback_service

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    chat_id: str = None
    provider: str = None
    timezone: str = None


class FeedbackRequest(BaseModel):
    query: str
    answer: str
    is_positive: bool


@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    db: Database = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        from datetime import datetime, timezone as dt_timezone

        user_now_utc = datetime.now(dt_timezone.utc)

        # 1. Get or Create Chat Session
        if request.chat_id:
            raw_chat = db["chats"].find_one({
                "_id": ObjectId(request.chat_id),
                "user_id": current_user.id,
            })
            if not raw_chat:
                raise HTTPException(status_code=404, detail="Chat session not found")
            chat = Chat(raw_chat)
            db["chats"].update_one(
                {"_id": ObjectId(request.chat_id)},
                {"$set": {"updated_at": user_now_utc}}
            )
        else:
            doc = Chat.new_doc(user_id=current_user.id, title=request.message[:50])
            result = db["chats"].insert_one(doc)
            doc["_id"] = result.inserted_id
            chat = Chat(doc)

        # 2. Save User Message
        user_msg_doc = Message.new_doc(chat_id=chat.id, role="user", content=request.message)
        db["messages"].insert_one(user_msg_doc)

        # 3. Get AI Response
        response = await rag_service.answer_query(request.message, provider=request.provider)

        # 4. Save Assistant Message
        assistant_now_utc = datetime.now(dt_timezone.utc)
        assistant_msg_doc = Message.new_doc(
            chat_id=chat.id,
            role="assistant",
            content=response["answer"],
            sources=json.dumps(response.get("sources", [])),
            agent_logs=json.dumps(response.get("agent_logs", [])),
        )
        db["messages"].insert_one(assistant_msg_doc)

        # Return response with chat_id and timestamps for localized UI rendering
        response["chat_id"] = chat.id
        response["created_at"] = assistant_now_utc.isoformat()
        response["user_created_at"] = user_now_utc.isoformat()
        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feedback")
async def feedback_endpoint(request: FeedbackRequest):
    try:
        if request.is_positive:
            feedback_service.save_positive_feedback(request.query, request.answer)
        return {"status": "success", "message": "Feedback recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter

from pydantic import BaseModel

from app.services.message_service import (
    MessageService,
)

router = APIRouter(
    prefix="/messages",
    tags=["Messages"],
)

# ==========================================
# Initialize Database
# ==========================================

MessageService.initialize_database()

# ==========================================
# Request Model
# ==========================================

class SaveMessageRequest(
    BaseModel
):

    session_id: str

    role: str

    content: str

# ==========================================
# Save Message
# ==========================================

@router.post("/")
async def save_message(
    request: SaveMessageRequest
):

    MessageService.save_message(
        request.session_id,
        request.role,
        request.content,
    )

    return {
        "status": "success",
    }

# ==========================================
# Get Messages
# ==========================================

@router.get("/{session_id}")
async def get_messages(
    session_id: str
):

    messages = (
        MessageService.get_messages(
            session_id
        )
    )

    return {
        "status": "success",
        "messages": messages,
    }


# ==========================================
# Clear Messages
# ==========================================

@router.delete("/{session_id}")
async def clear_messages(
    session_id: str
):

    from app.services.database import get_connection

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM messages WHERE session_id = ?",
        (session_id,),
    )
    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "deleted": deleted,
    }

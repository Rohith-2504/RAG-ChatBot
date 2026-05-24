from fastapi import APIRouter, Query

from pydantic import BaseModel

from app.services.session_service import (
    SessionService,
)

router = APIRouter(
    prefix="/sessions",
    tags=["Sessions"],
)

# ==========================================
# Initialize Database
# ==========================================

SessionService.initialize_database()

# ==========================================
# Request Models
# ==========================================

class UpdateTitleRequest(
    BaseModel
):
    title: str


class CreateSessionRequest(
    BaseModel
):
    user_id: str | None = None

# ==========================================
# Create New Session
# ==========================================

@router.post("/")
async def create_session(
    request: CreateSessionRequest | None = None
):

    session = (
        SessionService.create_session()
        if request is None
        else SessionService.create_session(
            request.user_id
        )
    )

    return {
        "status": "success",
        "session": session,
    }

# ==========================================
# Get All Sessions
# ==========================================

@router.get("/")
async def get_sessions(
    user_id: str | None = Query(default=None)
):

    sessions = (
        SessionService.get_sessions()
        if not user_id
        else SessionService.get_sessions(
            user_id
        )
    )

    return {
        "status": "success",
        "sessions": sessions,
    }

# ==========================================
# Update Session Title
# ==========================================

@router.put("/{session_id}")
async def update_session_title(
    session_id: str,
    request: UpdateTitleRequest,
):

    result = (
        SessionService.update_session_title(
            session_id,
            request.title,
        )
    )

    return result


# ==========================================
# Delete Session
# ==========================================

@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    user_id: str | None = Query(default=None),
):

    return SessionService.delete_session(
        session_id,
        user_id,
    )

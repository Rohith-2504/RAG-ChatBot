from fastapi import FastAPI
from fastapi.middleware.cors import (
    CORSMiddleware,
)

from app.api.chat import (
    router as chat_router,
)

from app.api.messages import (
    router as messages_router,
)

from app.api.sessions import (
    router as sessions_router,
)

from app.api.auth import (
    router as auth_router,
)

# ==========================================
# FastAPI App
# ==========================================

app = FastAPI(
    title="RAG ChatBot API"
)

# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)

# ==========================================
# REGISTER ROUTERS
# ==========================================

app.include_router(
    chat_router,
    prefix="/api",
    tags=["Chat"],
)

app.include_router(
    messages_router,
    prefix="/api",
    tags=["Messages"],
)

app.include_router(
    sessions_router,
    prefix="/api",
    tags=["Sessions"],
)

app.include_router(
    auth_router,
    prefix="/api",
    tags=["Auth"],
)

# ==========================================
# ROOT
# ==========================================

@app.get("/")
async def home():

    return {
        "status": "success",

        "message":
            "RAG Chatbot Backend Running",
    }

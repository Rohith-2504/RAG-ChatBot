import os
import uuid

from fastapi import (
    FastAPI,
    APIRouter,
    UploadFile,
    File,
    HTTPException,
)

from fastapi.middleware.cors import (
    CORSMiddleware,
)

from pydantic import BaseModel

from app.services.router_service import (
    RouterService,
)

from app.services.rag_service import (
    RAGService,
)

from app.core.config import settings

from app.services.message_service import (
    MessageService,
)

from app.services.session_service import (
    SessionService,
)

from app.api.sessions import (
    router as sessions_router
)

from app.api.messages import (
    router as messages_router
)

# ==========================================
# FASTAPI APP
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
# INITIALIZE DATABASES
# ==========================================

MessageService.initialize_database()

SessionService.initialize_database()

# ==========================================
# Router
# ==========================================

router = APIRouter(
    prefix="/api"
)

# ==========================================
# Upload Directory
# ==========================================

UPLOAD_DIR = settings.UPLOAD_DIR

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True,
)

# ==========================================
# Allowed File Types
# ==========================================

ALLOWED_EXTENSIONS = [

    ".pdf",
    ".docx",
    ".txt",
    ".md",

    ".png",
    ".jpg",
    ".jpeg",

    ".mp3",
    ".wav",
    ".m4a",

    ".mp4",
    ".mov",
    ".avi",
]

MAX_UPLOAD_BYTES = (
    25 * 1024 * 1024
)

# ==========================================
# REQUEST MODELS
# ==========================================

class Attachment(
    BaseModel
):

    filename: str

    file_type: str

    content: str


class ChatRequest(
    BaseModel
):

    message: str

    session_id: str | None = None

    user_id: str | None = None

    attachments: list[
        Attachment
    ] | None = None

# ==========================================
# ROOT ENDPOINT
# ==========================================

@app.get("/")
async def root():

    return {
        "status": "success",
        "message":
            "RAG ChatBot backend is running"
    }

# ==========================================
# CHAT ENDPOINT
# ==========================================

@router.post("/chat")
async def chat(
    request: ChatRequest
):

    try:

        # ==========================================
        # CREATE SESSION IF NEEDED
        # ==========================================

        session_id = (
            request.session_id
        )

        if not session_id:

            session = (
                SessionService.create_session(
                    request.user_id
                )
            )

            session_id = session["id"]

        # ==========================================
        # SAVE USER MESSAGE
        # ==========================================

        MessageService.save_message(
            session_id,
            "user",
            request.message,
        )

        # ==========================================
        # GENERATE AI RESPONSE
        # ==========================================

        response = (
            RouterService.generate_answer(
                request.message,
                session_id,
                request.attachments,
            )
        )

        # ==========================================
        # SAVE ASSISTANT MESSAGE
        # ==========================================

        MessageService.save_message(
            session_id,
            "assistant",
            response,
        )

        # ==========================================
        # RETURN RESPONSE
        # ==========================================

        return {

            "status": "success",

            "answer": response,

            "session_id": session_id,
        }

    except Exception as e:

        print(
            "CHAT ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

# ==========================================
# FILE UPLOAD ENDPOINT
# ==========================================

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...)
):

    try:

        # ==========================================
        # VALIDATE FILE
        # ==========================================

        if not file.filename:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Uploaded file must "
                    "have a filename."
                ),
            )

        extension = os.path.splitext(
            file.filename
        )[1].lower()

        if extension not in ALLOWED_EXTENSIONS:

            raise HTTPException(
                status_code=400,

                detail=(
                    f"Unsupported file type: "
                    f"{extension}"
                ),
            )

        # ==========================================
        # UNIQUE FILE NAME
        # ==========================================

        file_id = str(
            uuid.uuid4()
        )

        safe_original_name = (
            os.path.basename(
                file.filename
            )
        )

        file_path = os.path.join(
            UPLOAD_DIR,
            f"{file_id}{extension}"
        )

        # ==========================================
        # SAVE FILE
        # ==========================================

        total_bytes = 0

        with open(
            file_path,
            "wb"
        ) as buffer:

            while True:

                chunk = await file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                total_bytes += len(chunk)

                if total_bytes > MAX_UPLOAD_BYTES:

                    buffer.close()

                    if os.path.exists(
                        file_path
                    ):
                        os.remove(
                            file_path
                        )

                    raise HTTPException(
                        status_code=413,

                        detail=(
                            "File is too large. "
                            "Maximum allowed "
                            "size is 25 MB."
                        ),
                    )

                buffer.write(chunk)

        # ==========================================
        # RAG INGESTION
        # ==========================================

        result = (
            RAGService.ingest_document(
                file_path
            )
        )

        # ==========================================
        # RESPONSE
        # ==========================================

        return {

            "status": "success",

            "filename":
                safe_original_name,

            "saved_as":
                f"{file_id}{extension}",

            "file_type":
                extension,

            "size_bytes":
                total_bytes,

            "content":
                result.get(
                    "content",
                    ""
                ),

            "data":
                result,
        }

    except HTTPException:

        raise

    except Exception as e:

        print(
            "UPLOAD ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

# ==========================================
# REGISTER ROUTERS
# ==========================================

app.include_router(
    router
)

app.include_router(
    sessions_router
)

app.include_router(
    messages_router
)
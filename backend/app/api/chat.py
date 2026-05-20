from fastapi import (
    FastAPI,
    APIRouter,
    UploadFile,
    File,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil
import uuid
import os

from app.services.router_service import RouterService
from app.services.rag_service import RAGService

# Create FastAPI application
app = FastAPI(title="RAG ChatBot API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing router
router = APIRouter(prefix="/api")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ChatRequest(BaseModel):
    message: str


# Optional health check
@app.get("/")
async def root():
    return {
        "status": "success",
        "message": "Backend is running"
    }


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    file_path = f"{UPLOAD_DIR}/{file_id}.pdf"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = RAGService.ingest_document(file_path)

    return {
        "status": "success",
        "data": result,
    }


@router.post("/chat")
async def chat(request: ChatRequest):
    response = RouterService.generate_answer(request.message)

    return {
        "status": "success",
        "answer": response,
    }


# Automatically register all router endpoints
app.include_router(router)
import os
from fastapi import APIRouter, UploadFile, File
from app.core.config import settings
from app.services.document_loader import extract_text, chunk_text
from app.services.vector_store import add_documents

router = APIRouter()

@router.post("/")
async def upload_document(file: UploadFile = File(...)):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    path = os.path.join(settings.UPLOAD_DIR, file.filename)

    with open(path, "wb") as f:
        f.write(await file.read())

    text = extract_text(path)
    chunks = chunk_text(text)
    metadatas = [{"source": file.filename} for _ in chunks]
    add_documents(chunks, metadatas)

    return {"message": "Uploaded successfully", "chunks": len(chunks)}

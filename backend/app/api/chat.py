from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Conversation
from app.services.memory import save_message, get_history
from app.services.openai_service import generate_response
from app.services.vector_store import search_documents

router = APIRouter()

@router.post("/conversation")
def create_conversation(db: Session = Depends(get_db)):
    convo = Conversation()
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return {"conversation_id": convo.id}

@router.post("/")
def chat(payload: dict, db: Session = Depends(get_db)):
    conversation_id = payload["conversation_id"]
    user_message = payload["message"]

    save_message(db, conversation_id, "user", user_message)

    docs = search_documents(user_message)
    context = "\n\n".join([d["content"] for d in docs])

    messages = [
        {
            "role": "system",
            "content": "You are a helpful RAG chatbot. Use document context when relevant."
        }
    ]
    messages.extend(get_history(db, conversation_id)[:-1])

    if context:
        messages.append({
            "role": "system",
            "content": f"Document Context:\n{context}"
        })

    messages.append({"role": "user", "content": user_message})

    answer = generate_response(messages)
    save_message(db, conversation_id, "assistant", answer)

    return {"answer": answer, "sources": docs}

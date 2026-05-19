from app.db.models import Message

def save_message(db, conversation_id, role, content):
    msg = Message(conversation_id=conversation_id, role=role, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def get_history(db, conversation_id):
    rows = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [{"role": r.role, "content": r.content} for r in rows]

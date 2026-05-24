import uuid
from datetime import datetime

from app.services.database import get_connection


class MessageService:

    # ==========================================
    # Initialize Database
    # ==========================================

    @staticmethod
    def initialize_database():

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (

            id TEXT PRIMARY KEY,

            session_id TEXT,

            role TEXT,

            content TEXT,

            created_at TEXT
        )
        """)

        conn.commit()

        conn.close()

    # ==========================================
    # Save Message
    # ==========================================

    @staticmethod
    def save_message(
        session_id: str,
        role: str,
        content: str,
    ):

        conn = get_connection()
        cursor = conn.cursor()

        message_id = str(
            uuid.uuid4()
        )

        created_at = str(
            datetime.utcnow()
        )

        cursor.execute("""
        INSERT INTO messages (

            id,
            session_id,
            role,
            content,
            created_at

        )
        VALUES (?, ?, ?, ?, ?)
        """, (
            message_id,
            session_id,
            role,
            content,
            created_at,
        ))

        conn.commit()

        conn.close()

    # ==========================================
    # Get Messages
    # ==========================================

    @staticmethod
    def get_messages(
        session_id: str
    ):

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
        SELECT id, role, content, created_at
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at ASC
        """, (
            session_id,
        ))

        rows = cursor.fetchall()

        conn.close()

        messages = []

        for row in rows:

            messages.append({
                "id": row["id"],
                "role": row["role"],
                "content": row["content"],
                "created_at": row["created_at"],
            })

        return messages

    # ==========================================
    # Get Recent Memory
    # ==========================================

    @staticmethod
    def get_recent_messages(
        session_id: str,
        limit: int = 10
    ):

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
        SELECT role, content
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """, (
            session_id,
            limit,
        ))

        rows = cursor.fetchall()

        conn.close()

        rows.reverse()

        memory = ""

        for row in rows:

            role = row[0]
            content = row[1]

            memory += (
                f"{role}: {content}\n"
            )

        return memory

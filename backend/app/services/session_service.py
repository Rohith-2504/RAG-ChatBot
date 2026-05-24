import uuid
from datetime import datetime

from app.services.database import (
    column_exists,
    get_connection,
)


class SessionService:

    # ==========================================
    # Initialize Database
    # ==========================================

    @staticmethod
    def initialize_database():

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT,
            created_at TEXT
        )
        """)

        if not column_exists(
            cursor,
            "sessions",
            "user_id",
        ):
            cursor.execute(
                "ALTER TABLE sessions ADD COLUMN user_id TEXT"
            )

        conn.commit()

        conn.close()

    # ==========================================
    # Create Session
    # ==========================================

    @staticmethod
    def create_session(
        user_id: str = None
    ):

        session_id = str(
            uuid.uuid4()
        )

        title = "New Chat"

        created_at = str(
            datetime.utcnow()
        )

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
        INSERT INTO sessions (
            id,
            user_id,
            title,
            created_at
        )
        VALUES (?, ?, ?, ?)
        """, (
            session_id,
            user_id,
            title,
            created_at,
        ))

        conn.commit()

        conn.close()

        return {
            "id": session_id,
            "user_id": user_id,
            "title": title,
            "created_at": created_at,
        }

    # ==========================================
    # Get Sessions
    # ==========================================

    @staticmethod
    def get_sessions(
        user_id: str = None
    ):

        conn = get_connection()
        cursor = conn.cursor()

        if user_id:
            cursor.execute("""
            SELECT *
            FROM sessions
            WHERE user_id = ?
            ORDER BY created_at DESC
            """, (
                user_id,
            ))

        else:
            cursor.execute("""
            SELECT *
            FROM sessions
            ORDER BY created_at DESC
            """)

        rows = cursor.fetchall()

        conn.close()

        sessions = []

        for row in rows:

            sessions.append({
                "id": row[0],
                "user_id": (
                    row["user_id"]
                    if "user_id" in row.keys()
                    else None
                ),
                "title": row["title"],
                "created_at": row["created_at"],
            })

        return sessions

    # ==========================================
    # Update Session Title
    # ==========================================

    @staticmethod
    def update_session_title(
        session_id: str,
        title: str,
    ):

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
        UPDATE sessions
        SET title = ?
        WHERE id = ?
        """, (
            title,
            session_id,
        ))

        conn.commit()

        conn.close()

        return {
            "status": "success",
        }

    # ==========================================
    # Delete Session
    # ==========================================

    @staticmethod
    def delete_session(
        session_id: str,
        user_id: str = None,
    ):

        conn = get_connection()

        cursor = conn.cursor()

        if user_id:
            cursor.execute("""
            DELETE FROM messages
            WHERE session_id = ?
            """, (
                session_id,
            ))

            cursor.execute("""
            DELETE FROM sessions
            WHERE id = ?
            AND user_id = ?
            """, (
                session_id,
                user_id,
            ))

        else:
            cursor.execute("""
            DELETE FROM messages
            WHERE session_id = ?
            """, (
                session_id,
            ))

            cursor.execute("""
            DELETE FROM sessions
            WHERE id = ?
            """, (
                session_id,
            ))

        deleted = cursor.rowcount

        conn.commit()

        conn.close()

        return {
            "status": "success",
            "deleted": deleted,
        }

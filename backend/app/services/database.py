import os
import sqlite3
from pathlib import Path

from app.core.config import settings


def _sqlite_path_from_url(database_url: str) -> str:
    prefix = "sqlite:///"

    if database_url.startswith(prefix):
        return database_url[len(prefix):]

    return database_url or "rag_chatbot.db"


DATABASE_PATH = _sqlite_path_from_url(
    settings.DATABASE_URL
)


def get_connection():
    db_path = Path(DATABASE_PATH)

    if db_path.parent != Path("."):
        os.makedirs(
            db_path.parent,
            exist_ok=True,
        )

    conn = sqlite3.connect(
        str(db_path)
    )

    conn.row_factory = sqlite3.Row

    return conn


def column_exists(
    cursor,
    table_name: str,
    column_name: str,
) -> bool:
    cursor.execute(
        f"PRAGMA table_info({table_name})"
    )

    return any(
        row["name"] == column_name
        for row in cursor.fetchall()
    )

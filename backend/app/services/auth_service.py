import hashlib
import hmac
import os
import uuid
from datetime import datetime

from app.services.database import get_connection


class AuthService:
    @staticmethod
    def initialize_database():
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """)

        conn.commit()
        conn.close()

    @staticmethod
    def _hash_password(
        password: str,
        salt: str,
    ) -> str:
        return hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            120000,
        ).hex()

    @staticmethod
    def _public_user(row):
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "created_at": row["created_at"],
        }

    @staticmethod
    def signup(
        name: str,
        email: str,
        password: str,
    ):
        clean_name = name.strip()
        clean_email = email.strip().lower()

        if not clean_name:
            raise ValueError("Name is required.")

        if "@" not in clean_email:
            raise ValueError("A valid email is required.")

        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters.")

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM users WHERE email = ?",
            (clean_email,),
        )

        if cursor.fetchone():
            conn.close()
            raise ValueError("An account with this email already exists.")

        user_id = str(uuid.uuid4())
        salt = os.urandom(16).hex()
        created_at = str(datetime.utcnow())

        cursor.execute("""
        INSERT INTO users (
            id,
            name,
            email,
            password_hash,
            salt,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            clean_name,
            clean_email,
            AuthService._hash_password(password, salt),
            salt,
            created_at,
        ))

        conn.commit()

        cursor.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,),
        )

        user = AuthService._public_user(
            cursor.fetchone()
        )

        conn.close()

        return user

    @staticmethod
    def login(
        email: str,
        password: str,
    ):
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.strip().lower(),),
        )

        user = cursor.fetchone()

        if not user:
            conn.close()
            raise ValueError("Invalid email or password.")

        attempted_hash = AuthService._hash_password(
            password,
            user["salt"],
        )

        if not hmac.compare_digest(
            attempted_hash,
            user["password_hash"],
        ):
            conn.close()
            raise ValueError("Invalid email or password.")

        public_user = AuthService._public_user(user)

        conn.close()

        return public_user

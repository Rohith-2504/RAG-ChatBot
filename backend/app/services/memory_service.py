# backend/app/services/memory_service.py

from typing import List, Dict


class MemoryService:
    """
    Simple in-memory conversation history manager.

    Stores the most recent messages and returns a formatted history
    that can be added to prompts for conversational memory.
    """

    # Maximum number of messages to keep
    MAX_MESSAGES = 10

    # Internal storage
    _messages: List[Dict[str, str]] = []

    @classmethod
    def add_user_message(cls, message: str) -> None:
        """
        Add a user message to memory.
        """
        if message and message.strip():
            cls._messages.append({
                "role": "user",
                "content": message.strip(),
            })
            cls._trim_memory()

    @classmethod
    def add_assistant_message(cls, message: str) -> None:
        """
        Add an assistant message to memory.
        """
        if message and message.strip():
            cls._messages.append({
                "role": "assistant",
                "content": message.strip(),
            })
            cls._trim_memory()

    @classmethod
    def get_messages(cls) -> List[Dict[str, str]]:
        """
        Return raw conversation messages.
        """
        return cls._messages.copy()

    @classmethod
    def get_formatted_history(cls) -> str:
        """
        Return conversation history as formatted text.
        """
        if not cls._messages:
            return "No previous conversation."

        history_lines = []

        for msg in cls._messages:
            role = msg["role"].capitalize()
            content = msg["content"]
            history_lines.append(f"{role}: {content}")

        return "\n".join(history_lines)

    @classmethod
    def clear_memory(cls) -> None:
        """
        Clear all stored conversation history.
        """
        cls._messages = []

    @classmethod
    def _trim_memory(cls) -> None:
        """
        Keep only the most recent MAX_MESSAGES messages.
        """
        if len(cls._messages) > cls.MAX_MESSAGES:
            cls._messages = cls._messages[-cls.MAX_MESSAGES:]
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""
    MODEL_NAME: str = "llama-3.1-8b-instant"
    DATABASE_URL: str = "sqlite:///./rag_chatbot.db"
    CHROMA_PATH: str = "../chroma_db"
    UPLOAD_DIR: str = "../uploads"

    class Config:
        env_file = ".env"


settings = Settings()
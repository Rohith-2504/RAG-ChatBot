from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""
    MODEL_NAME: str = "gpt-4.1-mini"
    DATABASE_URL: str = "sqlite:///./rag_chatbot.db"
    CHROMA_PATH: str = "../chroma_db"
    UPLOAD_DIR: str = "../uploads"

    class Config:
        env_file = ".env"

settings = Settings()

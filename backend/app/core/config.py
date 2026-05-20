from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # =========================
    # API Keys
    # =========================
    # Use your Groq API key here (gsk_...)
    OPENAI_API_KEY: str = ""
    TAVILY_API_KEY: str = ""

    # =========================
    # Model Configuration
    # =========================
    # Default Groq model
    MODEL_NAME: str = "llama-3.3-70b-versatile"

    # Groq OpenAI-compatible endpoint
    OPENAI_BASE_URL: str = "https://api.groq.com/openai/v1"

    # =========================
    # Database and Storage
    # =========================
    DATABASE_URL: str = "sqlite:///./rag_chatbot.db"
    CHROMA_PATH: str = "./chroma_db"
    UPLOAD_DIR: str = "./uploads"

    # =========================
    # Search Configuration
    # =========================
    SEARCH_PROVIDER: str = "tavily"

    # =========================
    # Compatibility Alias
    # =========================
    # Older code may reference CHROMA_DB_PATH
    @property
    def CHROMA_DB_PATH(self) -> str:
        return self.CHROMA_PATH

    # =========================
    # Pydantic Settings Config
    # =========================
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )


# Global settings instance
settings = Settings()
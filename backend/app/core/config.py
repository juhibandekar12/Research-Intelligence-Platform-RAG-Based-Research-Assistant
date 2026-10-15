from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    # LLM / AI
    gemini_api_key: str = ""

    # Auth
     secret_key: str = ""
    access_token_expire_minutes: int = 10080  # 7 days

    # Database
    database_url: str = "sqlite+aiosqlite:///./research_platform.db"

    # Storage
    upload_dir: str = "./uploads"
    chroma_dir: str = "./chroma_db"
    reports_dir: str = "./reports"

    # App
    app_name: str = "Research Intelligence Platform"
    app_version: str = "1.0.0"
    debug: bool = False
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # RAG
    chunk_size: int = 1000
    chunk_overlap: int = 200
    max_retrieval_docs: int = 8
    embedding_model: str = "models/text-embedding-004"
    llm_model: str = "gemini-1.5-flash"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    def ensure_dirs(self):
        for d in [self.upload_dir, self.chroma_dir, self.reports_dir]:
            Path(d).mkdir(parents=True, exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    return Settings()

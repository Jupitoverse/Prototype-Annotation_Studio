from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    database_url: str = "sqlite:///./annotation_studio.db"
    jwt_secret: str = "annotation-studio-v1-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    upload_dir: Path = Path(__file__).resolve().parent.parent / "uploads"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)

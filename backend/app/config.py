import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # JWT & Security settings
    SECRET_KEY: str = "supersecretkeychangeinproduction"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week expiration

    # Database settings. Defaults to local SQLite
    DATABASE_URL: str = "sqlite:///./fam_tree.db"

    # Google OAuth settings
    GOOGLE_CLIENT_ID: str = ""

    # Cloudinary Cloud URL (e.g. cloudinary://key:secret@cloud_name)
    CLOUDINARY_URL: Optional[str] = None
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

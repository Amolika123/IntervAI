import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine base paths
# This file is located at <PROJECT_ROOT>/backend/app/config/settings.py
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BACKEND_DIR.parent if (BACKEND_DIR / "app").exists() else BACKEND_DIR

# Also check for env files in root
root_env_local = PROJECT_ROOT / ".env.local"
root_env = PROJECT_ROOT / ".env"
backend_env = BACKEND_DIR / ".env"

env_files = []
if root_env_local.exists():
    env_files.append(str(root_env_local))
if root_env.exists():
    env_files.append(str(root_env))
if backend_env.exists():
    env_files.append(str(backend_env))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=env_files or None,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    DATABASE_URL: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GITHUB_TOKEN: Optional[str] = None
    PORT: int = 8000
    HOST: str = "127.0.0.1"

    @property
    def sqlalchemy_database_url(self) -> str:
        """
        Resolves Prisma-style database URLs (e.g. 'file:./dev.db') or standard SQLite URLs
        into a valid SQLAlchemy SQLite connection string with absolute path.
        """
        raw_url = self.DATABASE_URL or os.environ.get("DATABASE_URL")
        
        default_db_path = PROJECT_ROOT / "prisma" / "dev.db"

        if not raw_url:
            db_path_str = default_db_path.as_posix()
            return f"sqlite:///{db_path_str}"

        # If it's a Prisma file URL: e.g. "file:./dev.db" or "file:../prisma/dev.db"
        if raw_url.startswith("file:"):
            rel_path = raw_url.replace("file:", "").strip()
            # If path was ./dev.db relative to prisma folder
            candidate_1 = PROJECT_ROOT / "prisma" / rel_path.lstrip("./")
            candidate_2 = PROJECT_ROOT / rel_path.lstrip("./")
            
            if candidate_1.exists():
                resolved = candidate_1.resolve()
            elif candidate_2.exists():
                resolved = candidate_2.resolve()
            else:
                resolved = default_db_path.resolve()

            db_path_str = resolved.as_posix()
            return f"sqlite:///{db_path_str}"

        # If it's already an sqlite URL: e.g. "sqlite:///path/to/dev.db"
        if raw_url.startswith("sqlite:"):
            return raw_url

        # Otherwise assume it's a direct path or valid connection string
        return raw_url


settings = Settings()

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TradingMaster API"
    environment: str = "development"

    database_url: str = "postgresql+asyncpg://trading:trading@localhost:5432/trading_master"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me-in-.env-never-commit-a-real-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    cors_origins: list[str] = ["http://localhost:5173"]

    rate_limit_per_minute: int = 120


@lru_cache
def get_settings() -> Settings:
    return Settings()

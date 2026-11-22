"""Application settings. Every secret comes from environment variables (SPEC 3.1.6)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    # Database: the API connects with a login role that may SET ROLE authenticated,
    # so Row-Level Security applies to every user request.
    database_url: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres"

    # Supabase Auth (local). Tokens are verified with the JWKS public keys.
    supabase_url: str = "http://127.0.0.1:54321"
    jwt_audience: str = "authenticated"
    jwt_issuer: str | None = None  # defaults to {supabase_url}/auth/v1
    # Optional legacy HS256 secret. Leave empty to accept only asymmetric (JWKS) tokens.
    jwt_secret: str | None = None
    jwks_cache_seconds: int = 600

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"])

    # Simple per-client rate limiting.
    rate_limit_per_minute: int = 120

    # GraphQL protection.
    graphql_max_depth: int = 8
    graphql_max_tokens: int = 2000
    graphql_max_aliases: int = 15

    # AI providers (SPEC 6.1): local or mock.
    stt_provider: Literal["local", "mock"] = "mock"
    pronunciation_provider: Literal["local", "mock"] = "mock"
    fluency_provider: Literal["local", "mock"] = "mock"
    tts_provider: Literal["local", "mock"] = "mock"
    grammar_provider: Literal["local", "mock"] = "mock"
    embedder_provider: Literal["local", "mock"] = "mock"
    llm_provider: Literal["local", "mock"] = "mock"
    llm_model: str = "qwen3:4b"

    @property
    def is_dev(self) -> bool:
        return self.environment == "development"

    @property
    def issuer(self) -> str:
        return self.jwt_issuer or f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()

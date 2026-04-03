from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ClinIQ API"
    secret_key: str = "change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8
    database_url: str = "sqlite:///./cliniq.db"
    database_fallback_enabled: bool = True
    database_fallback_url: str = "sqlite:///./cliniq.db"
    ai_model_path: str = "../ai-model/src/model.joblib"
    allowed_origins: str = "http://localhost:3000"
    advisor_provider: str = "rule_based"  # rule_based | ollama | huggingface
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    hf_model_id: str = "google/medgemma-1.5-4b-it"
    hf_api_url: str = ""
    hf_api_token: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()

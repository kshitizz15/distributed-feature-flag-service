from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_region: str = "region-a"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5433/feature_flags"
    database_echo: bool = False
    redis_url: str = "redis://localhost:6379/0"
    redis_pubsub_channel: str = "feature-flags"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()

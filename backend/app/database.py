import os
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


def build_database_url() -> str:
    return os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL_OVERRIDE") or "postgresql+psycopg://postgres:postgres@localhost:5433/feature_flags"


def create_database_engine():
    database_url = build_database_url()
    engine_kwargs: dict[str, object] = {"future": True}

    if database_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
        if database_url.endswith(":memory:"):
            engine_kwargs["poolclass"] = StaticPool

    return create_engine(database_url, **engine_kwargs)


engine = create_database_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models import Environment, FeatureFlag, TargetingRule, ConfigurationVersion  # noqa: F401

    Base.metadata.create_all(bind=engine)


def database_healthcheck() -> bool:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return True

import logging
import os

from fastapi import FastAPI, HTTPException

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

from app.api.v1 import router as api_v1_router
from app.cache import cache_service
from app.database import database_healthcheck, init_db

app = FastAPI(title="Distributed Feature Flag Service")
app.include_router(api_v1_router, prefix="/api/v1")


@app.on_event("startup")
def startup() -> None:
    init_db()
    cache_service.start_listener()


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "feature-flag-service", "status": "ok"}


@app.get("/health")
def health() -> dict[str, object]:
    try:
        database_ok = database_healthcheck()
    except Exception as exc:  # pragma: no cover - defensive runtime protection
        raise HTTPException(status_code=503, detail=f"Database health check failed: {exc}") from exc

    return {
        "status": "ok" if database_ok else "degraded",
        "region": os.getenv("APP_REGION", "unknown"),
        "database": "connected" if database_ok else "disconnected",
    }

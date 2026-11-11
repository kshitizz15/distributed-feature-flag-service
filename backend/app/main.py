
import logging
import os
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)

from app.api.v1 import router as api_v1_router
from app.cache import cache_service
from app.database import database_healthcheck, init_db
from app.metrics import metrics_payload, record_http_request

app = FastAPI(title="Distributed Feature Flag Service")

# Allow requests from the local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start_time
    record_http_request(request.method, request.url.path, response.status_code, duration)
    return response


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
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database health check failed: {exc}"
        ) from exc

    return {
        "status": "ok" if database_ok else "degraded",
        "region": os.getenv("APP_REGION", "unknown"),
        "database": "connected" if database_ok else "disconnected",
    }


@app.get("/metrics")
def metrics() -> Response:
    payload, content_type = metrics_payload()
    return Response(content=payload, media_type=content_type)

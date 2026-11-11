from __future__ import annotations

from typing import Any

from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

HTTP_REQUESTS = Counter(
    "feature_flag_http_requests_total",
    "Total number of HTTP requests handled by the FastAPI backend",
    labelnames=("method", "path", "status_code"),
)

HTTP_LATENCY = Histogram(
    "feature_flag_request_latency_seconds",
    "HTTP request latency in seconds",
    labelnames=("method", "path", "status_code"),
)

HTTP_ERRORS = Counter(
    "feature_flag_http_errors_total",
    "Total number of HTTP errors returned by the backend",
    labelnames=("method", "path", "status_code"),
)

EVALUATION_REQUESTS = Counter(
    "feature_flag_evaluations_total",
    "Total number of feature flag evaluations requested",
    labelnames=("flag_key", "environment"),
)

REDIS_CACHE_HITS = Counter(
    "feature_flag_redis_cache_hits_total",
    "Number of Redis cache hits for flag config reads",
    labelnames=("cache_type",),
)

REDIS_CACHE_MISSES = Counter(
    "feature_flag_redis_cache_misses_total",
    "Number of Redis cache misses for flag config reads",
    labelnames=("cache_type",),
)


def record_http_request(method: str, path: str, status_code: int, latency_seconds: float) -> None:
    labels = (method, path, str(status_code))
    HTTP_REQUESTS.labels(*labels).inc()
    HTTP_LATENCY.labels(*labels).observe(latency_seconds)
    if status_code >= 400:
        HTTP_ERRORS.labels(*labels).inc()


def record_evaluation(flag_key: str, environment: str) -> None:
    EVALUATION_REQUESTS.labels(flag_key, environment).inc()


def record_redis_cache_hit(cache_type: str) -> None:
    REDIS_CACHE_HITS.labels(cache_type).inc()


def record_redis_cache_miss(cache_type: str) -> None:
    REDIS_CACHE_MISSES.labels(cache_type).inc()


def metrics_payload() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST

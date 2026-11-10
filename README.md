# Low-Latency Distributed Feature Flag Service

This repository sets up the initial foundation for a distributed feature flag platform with:

- React + TypeScript frontend
- FastAPI backend
- PostgreSQL primary database
- Redis caching and Pub/Sub
- Region A and Region B backend instances
- Nginx load balancing
- Prometheus and Grafana monitoring
- Python SDK for local evaluation
- Docker Compose for local development

## Project structure

- `backend/` — FastAPI service
- `frontend/` — React UI
- `sdk/` — local Python SDK
- `infra/` — NGINX, Prometheus, Grafana config
- `docs/` — project docs
- `load-tests/` — future load-testing artifacts

## Local quick start

1. Copy `.env.example` to `.env`
2. Start Docker services:
   `docker compose up --build -d`
3. Check:
   - Frontend: http://localhost:3000
   - Nginx: http://localhost:8080
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001

## Notes

This is the initial infrastructure and project skeleton only. Application logic and feature-flag behavior will be implemented in subsequent steps.

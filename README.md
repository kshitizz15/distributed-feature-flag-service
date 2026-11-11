# Low-Latency Distributed Feature Flag Service

A distributed feature flag management platform designed to provide fast, reliable, and consistent feature evaluation across multiple backend regions.

The platform allows developers to create, manage, configure, and evaluate feature flags through a web-based dashboard while maintaining low-latency access using Redis caching and regional backend instances.

## Features

- **Feature Flag Management:** Create, update, enable, disable, and manage feature flags.
- **Multiple Environments:** Support for Development, Staging, and Production.
- **Percentage Rollouts:** Gradually release features to a percentage of users.
- **Targeting Rules:** Configure rules using equals, contains, and starts_with conditions.
- **Stable Deterministic Bucketing:** Ensure consistent feature evaluation for the same user.
- **Distributed Architecture:** Run multiple backend instances across Region A and Region B.
- **Redis Caching:** Reduce database access and improve evaluation performance.
- **Database Persistence:** Store feature flag configurations in PostgreSQL.
- **Evaluation Playground:** Test feature flags for different users and environments.
- **Monitoring:** Prometheus metrics and Grafana dashboards.
- **Load Balancing:** Nginx routes incoming API requests to backend instances.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, TanStack Start, Tailwind CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| Caching | Redis |
| Load Balancing | Nginx |
| Monitoring | Prometheus, Grafana |
| Infrastructure | Docker, Docker Compose |
| SDK | Python SDK |

## System Architecture

```text
              USER
                |
                v
       React + TypeScript UI
                |
                v
          NGINX Gateway
                |
          Load Balancing
           /         \
          v           v
     Region A       Region B
     FastAPI        FastAPI
        |              |
      Redis          Redis
        \              /
         \            /
          PostgreSQL
                |
          Prometheus
                |
             Grafana
```

## Project Structure

```text
distributed-feature-flag-service/
│
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── cache
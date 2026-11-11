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
│   │   ├── cache/        # Redis caching
│   │   ├── services/     # Feature evaluation logic
│   │   └── metrics.py    # Prometheus metrics
│   └── tests/            # Backend tests
│
├── frontend/             # React + TypeScript dashboard
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── routes/       # Application routes
│   │   └── lib/          # API integration and utilities
│   └── package.json
│
├── sdk/                  # Python SDK
├── infra/                # Nginx and monitoring configs
├── docs/                 # Project documentation
├── load-tests/           # Load testing artifacts
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js and npm
- Docker Desktop
- Git

### 1. Clone the repository

```bash
git clone https://github.com/kshitizz15/distributed-feature-flag-service.git
cd distributed-feature-flag-service
```

### 2. Configure environment variables

Create your local environment file using the example:

```bash
copy .env.example .env
```

Configure the required database, Redis, and service settings in `.env`.

### 3. Start using Docker Compose

```bash
docker compose up --build -d
```

### 4. Access the services

| Service | URL |
|---|---|
| Frontend Dashboard | http://localhost:3000 |
| Nginx API Gateway | http://localhost:8080 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

### 5. Run the frontend separately

```bash
cd frontend
npm install
npm run dev
```

Frontend development server:

`http://localhost:5173`

### 6. Run the backend separately

Activate your Python virtual environment, install backend dependencies, and start the backend using the project's configuration.

Example for Region A:

```bash
cd backend
uvicorn app.main:app --reload --port 8001
```

Example for Region B:

```bash
uvicorn app.main:app --reload --port 8002
```

## Core Concept: Stable Deterministic Bucketing

The service uses consistent user-based bucketing to determine whether a feature should be enabled for a particular user.

For example, with a 20% rollout:

- Users are assigned stable buckets from 0 to 99.
- Users in buckets 0–19 receive the feature.
- Users in buckets 20–99 do not receive the feature.

The same user receives the same bucket for the same feature flag, ensuring consistent evaluation across requests and regions.

## Monitoring and Reliability

- Prometheus collects application metrics.
- Grafana provides monitoring dashboards.
- Redis caching improves feature evaluation speed.
- Multiple backend instances support distributed request handling.
- Nginx provides a single API entry point and load balancing.

## Future Enhancements

- Advanced targeting and segmentation.
- Automated performance and load testing.
- Improved fault tolerance and regional failover.
- Expanded SDK support.
- Advanced analytics and rollout insights.

## Author

**Project:** Low-Latency Distributed Feature Flag Service

**Repository:** [distributed-feature-flag-service](https://github.com/kshitizz15/distributed-feature-flag-service)
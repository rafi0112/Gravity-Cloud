# GravityCloud

Distributed AI infrastructure for the existing GravityCloud app.

## Current Layout

- `frontend/` - React + Vite UI
- `services/gateway-service/` - FastAPI gateway/orchestrator
- `services/gateway-lb/` - host-facing reverse proxy that keeps `localhost:8000` stable while gateway replicas scale
- `services/ollama-service/` - Ollama model introspection and chat boundary
- `services/vector-service/` - ChromaDB/vector storage boundary
- `services/embedding-service/` - embeddings boundary
- `services/scheduler-service/` - lightweight autoscaler for gateway replicas
- `services/queue-service/` - SQLite-backed queue depth/status boundary
- `services/` - service code and contracts
- `infrastructure/` - nginx, monitoring, and scripts

## Container Roles

| Container             | Port       | Purpose                                                                                                                                 |
| --------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **ollama**            | 11434      | Base LLM runtime; runs language models locally (Ollama engine)                                                                          |
| **ollama-service**    | 8001       | Wrapper around Ollama; provides deterministic model selection and inference tracking with Prometheus metrics                            |
| **gateway-service**   | (internal) | Central FastAPI orchestrator; proxies requests to other services; aggregates status/metrics; auto-scales 1-3 replicas based on load     |
| **gateway-lb**        | 8000       | Nginx reverse proxy; load balances traffic across gateway-service replicas; single stable entry point for frontend and external clients |
| **queue-service**     | 8005       | SQLite-backed job queue; tracks pending/completed/failed jobs; counts connected clients; single-writer (does not scale)                 |
| **embedding-service** | 8003       | Generates vector embeddings from text for RAG/semantic search operations                                                                |
| **vector-service**    | 8002       | Manages vector storage and retrieval; integration boundary with ChromaDB                                                                |
| **scheduler-service** | 8004       | Lightweight autoscaler daemon; monitors queue depth every 5s; spins up/destroys gateway-service replicas based on thresholds            |
| **frontend**          | 3000       | React + Vite UI served by Nginx; displays dashboard, chat interface, monitoring links (Grafana/Prometheus)                              |
| **prometheus**        | 9090       | Metrics collection; scrapes `/metrics` endpoints from gateway, queue, scheduler, ollama services every 5 seconds                        |
| **grafana**           | 3001       | Observability dashboards; visualizes queue depth, active requests, connected devices, gateway replicas over time                        |

### Data Flow

```
User Browser (localhost:3000)
    ↓
gateway-lb (Nginx reverse proxy, :8000)
    ↓
gateway-service (1-3 replicas, auto-scaled by scheduler-service)
    ↓
[ollama-service, queue-service, embedding-service, vector-service]
    ↓
ollama (LLM runtime), ChromaDB (vector store)
```

### Monitoring Flow

```
Prometheus (:9090) scrapes /metrics → gateway, queue, scheduler, ollama
    ↓
Grafana (:3001) queries Prometheus datasource
    ↓
Frontend dashboard displays links to Grafana & Prometheus
    ↓
Pre-provisioned dashboards show metrics over time
```

### Autoscaling Logic

- **scheduler-service** polls queue-service every 5 seconds
- **queue_pending ≥ 5** → scale gateway-service to 3 replicas
- **queue_pending ≥ 2** → scale gateway-service to 2 replicas
- **queue_pending < 2** → scale gateway-service to 1 replica (minimum, always running)
- Extra containers auto-destroyed when load drops

## Compatibility

The existing app still runs on the same public ports:

- Gateway API: `http://localhost:8000`
- Frontend: `http://localhost:3000`

Compose now builds the gateway behind `services/gateway-lb`, so the host-facing API stays on `http://localhost:8000` even when `gateway-service` is scaled to multiple replicas.

The dashboard now shows live queue depth, active requests, connected devices, and autoscaling status from `scheduler-service`.

The gateway's `queue_pending` value means jobs that are currently queued or processing, not the total number of connected devices. Very fast chat jobs can still complete between polls, which is why the dashboard may show `0` even during short bursts.

The scheduler is intentionally lightweight and only scales `gateway-service`. `queue-service` remains a single SQLite-backed writer.

## Run

```bash
docker compose up --build
```

## Migration Map

- `backend/main.py` -> `services/gateway-service/main.py`
- `backend/` -> `services/`
- `ollama.chat()` -> `services/ollama-service/`
- ChromaDB -> `services/vector-service/`
- `OllamaEmbeddings` -> `services/embedding-service/`
- scheduled tasks -> `services/scheduler-service/`

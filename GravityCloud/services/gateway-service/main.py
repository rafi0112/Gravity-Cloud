import os
from pathlib import Path

import httpx
import psutil
from fastapi import Body, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from prometheus_client import Gauge, Counter, generate_latest, CONTENT_TYPE_LATEST
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent

OLLAMA_SERVICE_URL = os.getenv("OLLAMA_SERVICE_URL", "http://ollama-service:8001")
VECTOR_SERVICE_URL = os.getenv("VECTOR_SERVICE_URL", "http://vector-service:8002")
EMBEDDING_SERVICE_URL = os.getenv("EMBEDDING_SERVICE_URL", "http://embedding-service:8003")
QUEUE_SERVICE_URL = os.getenv("QUEUE_SERVICE_URL", "http://queue-service:8005")
SCHEDULER_SERVICE_URL = os.getenv("SCHEDULER_SERVICE_URL", "http://scheduler-service:8004")

DEFAULT_MODEL_NAME = os.getenv("DEFAULT_MODEL_NAME", "gemma2:2b")
DEFAULT_CHAT_MODEL_NAME = os.getenv("DEFAULT_CHAT_MODEL_NAME", DEFAULT_MODEL_NAME)
DEFAULT_EMBEDDING_MODEL_NAME = os.getenv("DEFAULT_EMBEDDING_MODEL_NAME", "nomic-embed-text")
PUBLIC_SERVICE_HOST = os.getenv("PUBLIC_SERVICE_HOST", "localhost")

REQUEST_COUNTER = 0
HTTP_TIMEOUT = httpx.Timeout(120.0, connect=10.0)

app = FastAPI(
    title="Cloud Engine AI Gateway",
    description="Cloud Computing Lab Project\n\n B200305032 - Khandekar Rafiul Islam\n\nB200305049 - Md. Bayazid Sarkar Bijoy",
    version="4.0.0",
)

# Prometheus metrics
GATEWAY_REQUESTS_COUNTER = Counter("gravity_gateway_requests_total", "Total incoming gateway requests")
GATEWAY_QUEUE_PENDING_GAUGE = Gauge("gravity_gateway_queue_pending", "Queue pending observed by gateway")
GATEWAY_ACTIVE_REQUESTS_GAUGE = Gauge("gravity_gateway_active_requests", "Active requests observed by gateway")
GATEWAY_CONNECTED_DEVICES_GAUGE = Gauge("gravity_gateway_connected_devices", "Connected devices observed by gateway")

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


def _normalize_service_url(value: str) -> str:
    if not value.startswith("http://") and not value.startswith("https://"):
        return f"http://{value}"
    return value


def _service_url(env_value: str, default_url: str) -> str:
    return _normalize_service_url(os.getenv(env_value, default_url))


def _public_service_url(name: str) -> str:
    public_urls = {
        "ollama-service": f"http://{PUBLIC_SERVICE_HOST}:8001",
        "vector-service": f"http://{PUBLIC_SERVICE_HOST}:8002",
        "embedding-service": f"http://{PUBLIC_SERVICE_HOST}:8003",
        "scheduler-service": f"http://{PUBLIC_SERVICE_HOST}:8004",
        "queue-service": f"http://{PUBLIC_SERVICE_HOST}:8005",
    }
    return public_urls.get(name, _service_urls().get(name, ""))


async def _request_json(method: str, url: str, **kwargs):
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        response = await client.request(method, url, **kwargs)
        response.raise_for_status()
        if response.content:
            return response.json()
        return {}


def _register_request() -> None:
    global REQUEST_COUNTER
    REQUEST_COUNTER += 1
    try:
        GATEWAY_REQUESTS_COUNTER.inc()
    except Exception:
        pass


def _node_metrics() -> dict:
    memory = psutil.virtual_memory()
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.0),
        "memory_total_mb": round(memory.total / (1024 * 1024), 2),
        "memory_used_mb": round(memory.used / (1024 * 1024), 2),
        "memory_percent": memory.percent,
        "requests_served": REQUEST_COUNTER,
        "gpu": "unavailable",
    }


async def _service_health(name: str, url: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json() if response.content else {}
        return {
            "name": name,
            "status": "online",
            "url": url,
            "public_url": _public_service_url(name),
            "detail": payload,
        }
    except Exception as exc:
        return {
            "name": name,
            "status": "offline",
            "url": url,
            "public_url": _public_service_url(name),
            "detail": str(exc),
        }


def _service_urls() -> dict:
    return {
        "ollama-service": _service_url("OLLAMA_SERVICE_URL", OLLAMA_SERVICE_URL),
        "vector-service": _service_url("VECTOR_SERVICE_URL", VECTOR_SERVICE_URL),
        "embedding-service": _service_url("EMBEDDING_SERVICE_URL", EMBEDDING_SERVICE_URL),
        "queue-service": _service_url("QUEUE_SERVICE_URL", QUEUE_SERVICE_URL),
        "scheduler-service": _service_url("SCHEDULER_SERVICE_URL", SCHEDULER_SERVICE_URL),
    }


def _first_named_item(items) -> str | None:
    for item in items or []:
        if isinstance(item, dict):
            name = item.get("name") or item.get("model")
            if name:
                return name
    return None


def _is_embedding_model(model_name: str) -> bool:
    normalized = model_name.lower()
    embedding_prefix = DEFAULT_EMBEDDING_MODEL_NAME.lower()
    return normalized == embedding_prefix or normalized.startswith(f"{embedding_prefix}:")


def _first_chat_model(items) -> str | None:
    for item in items or []:
        if isinstance(item, dict):
            name = item.get("name") or item.get("model")
            if name and not _is_embedding_model(name):
                return name
    return None


def _resolve_active_model(payload: dict) -> str:
    chat_model = payload.get("chat_model")
    if chat_model and chat_model != "unknown":
        return chat_model

    active_model = payload.get("active_model")
    if active_model and active_model != "unknown" and not _is_embedding_model(active_model):
        return active_model

    for key in ("models", "running_models", "available_models"):
        name = _first_chat_model(payload.get(key))
        if name:
            return name

    return payload.get("default_model") or DEFAULT_CHAT_MODEL_NAME


async def _ollama_model_status() -> dict:
    try:
        payload = await _request_json("GET", f"{OLLAMA_SERVICE_URL}/models")
    except Exception as exc:
        return {
            "active_model": DEFAULT_MODEL_NAME,
            "chat_model": DEFAULT_CHAT_MODEL_NAME,
            "embedding_model": DEFAULT_EMBEDDING_MODEL_NAME,
            "running_models": [],
            "available_models": [],
            "status": "offline",
            "error": str(exc),
        }

    active_model = _resolve_active_model(payload)
    payload["active_model"] = active_model
    payload["chat_model"] = active_model
    payload.setdefault("embedding_model", DEFAULT_EMBEDDING_MODEL_NAME)
    payload["status"] = payload.get("status", "online")
    return payload


async def _queue_status() -> dict:
    try:
        payload = await _request_json("GET", f"{QUEUE_SERVICE_URL}/status")
        payload.setdefault("queue_pending", 0)
        try:
            GATEWAY_QUEUE_PENDING_GAUGE.set(int(payload.get("queue_pending", 0)))
            GATEWAY_ACTIVE_REQUESTS_GAUGE.set(int(payload.get("active_requests", 0)))
            GATEWAY_CONNECTED_DEVICES_GAUGE.set(int(payload.get("connected_devices", 0)))
        except Exception:
            pass
        return payload
    except Exception as exc:
        return {
            "status": "offline",
            "queue_pending": 0,
            "active_requests": 0,
            "connected_devices": 0,
            "pending_jobs": [],
            "error": str(exc),
        }


@app.get("/metrics")
async def metrics():
    # update node-level metrics before returning
    try:
        metrics = _node_metrics()
        # requests_served is stored in REQUEST_COUNTER and also available in metrics
        # set as a gauge for scraping
        try:
            # use a gauge to expose current requests_served
            Gauge("gravity_gateway_requests_served", "Requests served since start").set(metrics.get("requests_served", 0))
        except Exception:
            pass
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except Exception:
        return Response("", media_type="text/plain")


async def _autoscaling_status() -> dict:
    try:
        return await _request_json("GET", f"{SCHEDULER_SERVICE_URL}/status")
    except Exception as exc:
        return {
            "status": "offline",
            "current_replicas": 0,
            "desired_replicas": 0,
            "events": [],
            "error": str(exc),
        }


async def _queue_enqueue(job_type: str, payload: dict, client_id: str | None = None) -> str | None:
    try:
        headers = {}
        if client_id:
            headers["X-GravityCloud-Client-Id"] = client_id
        response = await _request_json(
            "POST",
            f"{QUEUE_SERVICE_URL}/enqueue",
            headers=headers,
            json={"job_type": job_type, "payload": payload},
        )
        return response.get("job_id")
    except Exception:
        return None


async def _queue_start(job_id: str | None) -> None:
    if not job_id:
        return

    try:
        await _request_json("POST", f"{QUEUE_SERVICE_URL}/start/{job_id}")
    except Exception:
        return


async def _queue_complete(job_id: str | None, status: str, result: dict | None = None, error: str | None = None) -> None:
    if not job_id:
        return

    try:
        if status == "failed":
            await _request_json(
                "POST",
                f"{QUEUE_SERVICE_URL}/fail/{job_id}",
                json={"error": error or "Unknown error"},
            )
        else:
            await _request_json(
                "POST",
                f"{QUEUE_SERVICE_URL}/complete/{job_id}",
                json={"result": result or {}},
            )
    except Exception:
        return

@app.get("/", tags=["Status"])
async def root():
    _register_request()
    ollama_status = await _ollama_model_status()
    queue_status = await _queue_status()
    autoscaling_status = await _autoscaling_status()
    return {
        "project": "Cloud Engine AI Gateway",
        "status": "ok",
        "display_status": "Online",
        "architecture": "microservices",
        "active_model": ollama_status.get("active_model", DEFAULT_MODEL_NAME),
        "chat_model": ollama_status.get("chat_model", DEFAULT_CHAT_MODEL_NAME),
        "embedding_model": ollama_status.get("embedding_model", DEFAULT_EMBEDDING_MODEL_NAME),
        "queue_pending": queue_status.get("queue_pending", 0),
        "active_requests": queue_status.get("active_requests", 0),
        "connected_devices": queue_status.get("connected_devices", 0),
        "autoscaling": {
            "status": autoscaling_status.get("status", "offline"),
            "current_replicas": autoscaling_status.get("current_replicas", 0),
            "desired_replicas": autoscaling_status.get("desired_replicas", 0),
            "last_scale_at": autoscaling_status.get("last_scale_at"),
            "last_scale_action": autoscaling_status.get("last_scale_action"),
            "last_reason": autoscaling_status.get("last_reason"),
            "events": autoscaling_status.get("events", []),
        },
        "provenance": {
            "status": "live gateway health",
            "active_model": "live Ollama chat model selection via ollama-service",
            "embedding_model": "live Ollama embedding model selection via ollama-service",
            "queue_pending": "live queue-service depth",
            "autoscaling": "live scheduler-service monitoring and compose scaling",
            "services": "live HTTP health checks",
        },
        "services": _service_urls(),
        "public_services": {
            name: _public_service_url(name) for name in _service_urls().keys()
        },
    }

@app.get("/db-status", tags=["Status"])
async def get_db_status():
    try:
        _register_request()
        payload = await _request_json("GET", f"{VECTOR_SERVICE_URL}/db-status")
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-file", tags=["Data Ingestion"])
async def upload_file(file: UploadFile = File(...)):
    try:
        _register_request()
        file_bytes = await file.read()
        files = {"file": (file.filename, file_bytes, file.content_type or "application/pdf")}
        extracted = await _request_json("POST", f"{EMBEDDING_SERVICE_URL}/extract", files=files)
        indexed = await _request_json(
            "POST",
            f"{VECTOR_SERVICE_URL}/index",
            json={"filename": file.filename, "documents": extracted.get("documents", [])},
        )
        return {
            "status": "Success",
            "filename": file.filename,
            "chunks_added": indexed.get("chunks_added", 0),
            "current_db_size": indexed.get("current_db_size", 0),
        }
    except httpx.HTTPStatusError as exc:
        response = exc.response
        detail = response.text.strip()
        try:
            payload = response.json()
            if isinstance(payload, dict):
                detail = str(payload.get("detail") or payload.get("message") or payload.get("error") or detail)
        except Exception:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail or response.reason_phrase)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/ask", tags=["Chat Engine"])
async def ask_post(request: Request, prompt: str = Body(..., media_type="text/plain")):
    queue_job_id = None
    try:
        _register_request()
        client_id = request.headers.get("X-GravityCloud-Client-Id") or request.headers.get("x-gravitycloud-client-id")
        queue_job_id = await _queue_enqueue("ask", {"prompt": prompt}, client_id=client_id)
        await _queue_start(queue_job_id)
        ollama_status = await _ollama_model_status()
        model_name = ollama_status.get("chat_model") or _resolve_active_model(ollama_status)
        db_status = await _request_json("GET", f"{VECTOR_SERVICE_URL}/db-status")
        db_count = db_status.get("total_chunks", 0)

        file_keywords = [
            "uploaded", "file", "document", "pdf", "context", "shared", "info",
            "data", "text", "paper", "report", "doc", "files", "documents",
            "reference", "manual", "content", "source", "page", "paragraph", "attachment", "docs",
            "mentioned", "provided", "included", "attached", "given",
        ]

        prompt_lower = prompt.lower()
        is_short_prompt = len(prompt.split()) <= 2
        wants_file = any(word in prompt_lower for word in file_keywords)

        context = ""
        search_performed = False

        if db_count > 0 and (wants_file or not is_short_prompt):
            search_result = await _request_json("POST", f"{VECTOR_SERVICE_URL}/search", json={"query": prompt, "k": 3})
            docs = search_result.get("documents", [])
            search_performed = bool(docs)
            context = "\n\n".join([doc.get("page_content", "") for doc in docs if doc.get("page_content")])

        if context:
            system_instruction = (
                "You are Cloud Engine AI. "
                "Combine information from the provided context and your internal knowledge. "
                f"Context: {context}"
            )
            mode = "Mixed Mode"
        else:
            system_instruction = "You are Cloud Engine AI. Answer based on your general knowledge."
            mode = "General Knowledge"

        response = await _request_json(
            "POST",
            f"{OLLAMA_SERVICE_URL}/chat",
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
            },
        )

        await _queue_complete(
            queue_job_id,
            "completed",
            {
                "model": model_name,
                "mode": mode,
                "search_performed": search_performed,
            },
        )

        return {
            "response": response.get("message", {}).get("content", ""),
            "mode": mode,
            "search_performed": search_performed,
            "model": model_name,
        }
    except Exception as e:
        await _queue_complete(queue_job_id, "failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
@app.delete("/clear-db", tags=["Maintenance"])
async def clear_database():
    try:
        _register_request()
        payload = await _request_json("DELETE", f"{VECTOR_SERVICE_URL}/clear-db")
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing DB: {str(e)}")


@app.get("/services-status", tags=["Status"])
async def services_status():
    _register_request()
    urls = _service_urls()
    return {
        name: await _service_health(name, url)
        for name, url in urls.items()
    }


@app.get("/autoscaling-status", tags=["Status"])
async def autoscaling_status():
    _register_request()
    return await _autoscaling_status()


@app.get("/nodes", tags=["Infrastructure"])
async def nodes_status():
    _register_request()
    services = await services_status()
    metrics = _node_metrics()
    return {
        "node_name": os.getenv("NODE_NAME", "gravitycloud-local-node"),
        "provenance": {
            "metrics": "live host metrics from psutil on the gateway container host",
            "requests_served": "in-process counter since gateway container start",
            "services": "live HTTP reachability checks",
        },
        "metrics": metrics,
        "services": list(services.values()),
    }
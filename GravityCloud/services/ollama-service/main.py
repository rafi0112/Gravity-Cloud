import os
import threading
import time

import ollama
from fastapi import FastAPI, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from fastapi.responses import Response
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
if not OLLAMA_HOST.startswith("http://") and not OLLAMA_HOST.startswith("https://"):
    OLLAMA_HOST = f"http://{OLLAMA_HOST}"

os.environ["OLLAMA_HOST"] = OLLAMA_HOST
DEFAULT_MODEL_NAME = os.getenv("DEFAULT_MODEL_NAME", "gemma2:2b")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "nomic-embed-text")
MODEL_CACHE_TTL_SECONDS = int(os.getenv("MODEL_CACHE_TTL_SECONDS", "20"))

MODEL_CACHE_LOCK = threading.Lock()
MODEL_CACHE: dict = {
    "value": None,
    "fetched_at": 0.0,
    "expires_at": 0.0,
}

app = FastAPI(title="Ollama Service", version="1.0.0")

# Prometheus metrics
OLLAMA_INFERENCES_COUNTER = Counter("gravity_ollama_inference_requests_total", "Total Ollama inference/chat requests")


class ChatRequest(BaseModel):
    model: str = "gemma2:2b"
    messages: list[dict]


def _model_name(item) -> str | None:
    if isinstance(item, dict):
        return item.get("name") or item.get("model")

    if hasattr(item, "model_dump"):
        dumped = item.model_dump()
        if isinstance(dumped, dict):
            return dumped.get("name") or dumped.get("model")

    return getattr(item, "name", None) or getattr(item, "model", None)


def _model_names(models_payload) -> list[str]:
    names = []
    for item in models_payload or []:
        name = _model_name(item)
        if name:
            names.append(name)
    return names


def _is_embedding_model(model_name: str) -> bool:
    normalized = model_name.lower()
    embedding_prefix = EMBEDDING_MODEL_NAME.lower()
    return normalized == embedding_prefix or normalized.startswith(f"{embedding_prefix}:")


def _preferred_chat_model(available: list, running: list) -> str:
    running_names = [name for name in _model_names(running) if not _is_embedding_model(name)]
    if running_names:
        return running_names[0]

    available_names = [name for name in _model_names(available) if not _is_embedding_model(name)]
    if DEFAULT_MODEL_NAME in available_names:
        return DEFAULT_MODEL_NAME

    if available:
        newest = sorted(
            [item for item in available if isinstance(item, dict)],
            key=lambda item: item.get("modified_at", ""),
            reverse=True,
        )
        newest_name = _model_name(newest[0]) if newest else None
        if newest_name:
            return newest_name

    if available_names:
        return available_names[0]

    return DEFAULT_MODEL_NAME


def _preferred_embedding_model(available: list, running: list) -> str:
    running_names = [name for name in _model_names(running) if _is_embedding_model(name)]
    if running_names:
        return running_names[0]

    available_names = [name for name in _model_names(available) if _is_embedding_model(name)]
    if available_names:
        return available_names[0]

    return EMBEDDING_MODEL_NAME


def _collect_model_status() -> dict:
    available = ollama.list().get("models", [])
    running = ollama.ps().get("models", [])
    available_names = _model_names(available)
    running_names = _model_names(running)
    chat_model = _preferred_chat_model(available, running)
    embedding_model = _preferred_embedding_model(available, running)

    return {
        "service": "ollama-service",
        "status": "online",
        "target_ollama_host": OLLAMA_HOST,
        "active_model": chat_model,
        "chat_model": chat_model,
        "embedding_model": embedding_model,
        "default_model": DEFAULT_MODEL_NAME,
        "default_embedding_model": EMBEDDING_MODEL_NAME,
        "selected_from": "running_models" if running_names else ("installed_models" if available_names else "default_model"),
        "running_models": running_names,
        "available_models": available_names,
        "running_model_count": len(running_names),
        "available_model_count": len(available_names),
        "models": available,
    }


async def _get_model_status(force_refresh: bool = False) -> dict:
    now = time.monotonic()

    with MODEL_CACHE_LOCK:
        cached_value = MODEL_CACHE["value"]
        cache_valid = cached_value is not None and now < MODEL_CACHE["expires_at"]
        if cache_valid and not force_refresh:
            return cached_value

    try:
        fresh_value = await run_in_threadpool(_collect_model_status)
    except Exception as exc:
        if cached_value is not None:
            stale_value = dict(cached_value)
            stale_value["status"] = "degraded"
            stale_value["error"] = str(exc)
            return stale_value

        return {
            "service": "ollama-service",
            "status": "offline",
            "target_ollama_host": OLLAMA_HOST,
            "default_model": DEFAULT_MODEL_NAME,
            "default_embedding_model": EMBEDDING_MODEL_NAME,
            "selected_from": "default_model",
            "active_model": DEFAULT_MODEL_NAME,
            "chat_model": DEFAULT_MODEL_NAME,
            "embedding_model": EMBEDDING_MODEL_NAME,
            "running_models": [],
            "available_models": [],
            "running_model_count": 0,
            "available_model_count": 0,
            "models": [],
            "error": str(exc),
        }

    with MODEL_CACHE_LOCK:
        MODEL_CACHE["value"] = fresh_value
        MODEL_CACHE["fetched_at"] = now
        MODEL_CACHE["expires_at"] = now + MODEL_CACHE_TTL_SECONDS

    return fresh_value


@app.get("/")
async def root():
    return await _get_model_status()


@app.get("/health")
async def health():
    return await root()


@app.get("/models")
async def models(refresh: bool = Query(default=False)):
    return await _get_model_status(force_refresh=refresh)


@app.on_event("startup")
async def warm_cache():
    await _get_model_status(force_refresh=True)


@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        OLLAMA_INFERENCES_COUNTER.inc()
        response = ollama.chat(model=request.model, messages=request.messages)
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/metrics")
async def metrics():
    try:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except Exception:
        return Response("", media_type="text/plain")
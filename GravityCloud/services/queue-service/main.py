import json
import os
import threading
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import redis
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from prometheus_client import Gauge, Counter, generate_latest, CONTENT_TYPE_LATEST
from pydantic import BaseModel, Field

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
CONNECTED_DEVICE_WINDOW_SECONDS = int(os.getenv("CONNECTED_DEVICE_WINDOW_SECONDS", "60"))

app = FastAPI(title="Queue Service (Redis)", version="2.0.0")

# Redis client
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# Prometheus metrics
QUEUE_PENDING_GAUGE = Gauge("gravity_queue_pending", "Current queue size")
ACTIVE_REQUESTS_GAUGE = Gauge("gravity_active_requests", "Active requests")
CONNECTED_DEVICES_GAUGE = Gauge("gravity_connected_devices", "Connected devices")
QUEUE_ENQUEUED_COUNTER = Counter("gravity_queue_enqueued_total", "Total enqueued jobs")
QUEUE_COMPLETED_COUNTER = Counter("gravity_queue_completed_total", "Total completed jobs")
QUEUE_FAILED_COUNTER = Counter("gravity_queue_failed_total", "Total failed jobs")

class QueueJobCreate(BaseModel):
    job_type: str = Field(default="ask", min_length=1)
    payload: dict = Field(default_factory=dict)

class QueueJobResult(BaseModel):
    result: dict = Field(default_factory=dict)

class QueueJobFailure(BaseModel):
    error: str = Field(default="Unknown error")

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _job_key(job_id: str) -> str:
    return f"job:{job_id}"

def _job_to_dict(job_data: dict) -> dict:
    return {
        "job_id": job_data.get("id"),
        "job_type": job_data.get("job_type"),
        "payload": json.loads(job_data.get("payload", "{}")),
        "status": job_data.get("status"),
        "result": json.loads(job_data.get("result", "{}")),
        "error": job_data.get("error"),
        "created_at": job_data.get("created_at"),
        "updated_at": job_data.get("updated_at"),
        "client_id": job_data.get("client_id"),
        "last_seen_at": job_data.get("last_seen_at"),
    }

def _stats() -> dict:
    now = datetime.now(timezone.utc)
    
    # Get job counts by status
    queued_count = redis_client.scard("jobs:queued")
    processing_count = redis_client.scard("jobs:processing")
    completed_count = redis_client.scard("jobs:completed")
    failed_count = redis_client.scard("jobs:failed")
    
    queue_pending = queued_count + processing_count
    
    # Get pending jobs
    pending_job_ids = list(redis_client.smembers("jobs:queued")) + list(redis_client.smembers("jobs:processing"))
    pending_jobs = []
    
    connected_clients: set[str] = set()
    
    for job_id in pending_job_ids:
        job_data = redis_client.hgetall(_job_key(job_id))
        if not job_data:
            continue
        
        pending_jobs.append(_job_to_dict(job_data))
        
        client_id = job_data.get("client_id")
        last_seen_at = job_data.get("last_seen_at") or job_data.get("updated_at") or job_data.get("created_at")
        
        if client_id and last_seen_at:
            try:
                last_seen = datetime.fromisoformat(last_seen_at)
                if (now - last_seen).total_seconds() <= CONNECTED_DEVICE_WINDOW_SECONDS:
                    connected_clients.add(client_id)
            except ValueError:
                pass
    
    active_requests = processing_count
    connected_devices = len(connected_clients)
    
    # Update Prometheus gauges
    try:
        QUEUE_PENDING_GAUGE.set(queue_pending)
        ACTIVE_REQUESTS_GAUGE.set(active_requests)
        CONNECTED_DEVICES_GAUGE.set(connected_devices)
    except Exception:
        pass
    
    return {
        "service": "queue-service",
        "status": "ok",
        "queue_pending": queue_pending,
        "active_requests": active_requests,
        "connected_devices": connected_devices,
        "connected_clients": sorted(connected_clients),
        "queued": queued_count,
        "processing": processing_count,
        "completed": completed_count,
        "failed": failed_count,
        "total_jobs": queued_count + processing_count + completed_count + failed_count,
        "pending_jobs": pending_jobs,
    }

@app.on_event("startup")
async def startup_event() -> None:
    try:
        redis_client.ping()
    except Exception as e:
        raise RuntimeError(f"Cannot connect to Redis: {e}")

@app.get("/")
async def root():
    return _stats()

@app.get("/health")
async def health():
    return _stats()

@app.get("/status")
async def status():
    return _stats()

@app.post("/enqueue")
async def enqueue(job: QueueJobCreate, request: Request):
    job_id = str(uuid.uuid4())
    created_at = _now()
    payload_text = json.dumps(job.payload)
    client_id = request.headers.get("X-GravityCloud-Client-Id") or request.headers.get("x-gravitycloud-client-id")
    
    job_data = {
        "id": job_id,
        "job_type": job.job_type,
        "payload": payload_text,
        "status": "queued",
        "result": json.dumps({}),
        "error": "",
        "created_at": created_at,
        "updated_at": created_at,
        "client_id": client_id or "",
        "last_seen_at": created_at,
    }
    
    # Store job and add to queued set
    redis_client.hset(_job_key(job_id), mapping=job_data)
    redis_client.sadd("jobs:queued", job_id)
    redis_client.expire(_job_key(job_id), 86400)  # 24 hour TTL
    
    QUEUE_ENQUEUED_COUNTER.inc()
    
    stats = _stats()
    return {
        "job_id": job_id,
        "status": "queued",
        "queue_pending": stats["queue_pending"],
        "position": stats["queue_pending"],
        "created_at": created_at,
    }

@app.post("/start/{job_id}")
async def start(job_id: str):
    updated_at = _now()
    
    # Move from queued to processing
    redis_client.srem("jobs:queued", job_id)
    redis_client.sadd("jobs:processing", job_id)
    redis_client.hset(_job_key(job_id), mapping={
        "status": "processing",
        "updated_at": updated_at,
        "last_seen_at": updated_at,
    })
    
    if not redis_client.exists(_job_key(job_id)):
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "job_id": job_id,
        "status": "processing",
        "queue_pending": _stats()["queue_pending"],
        "updated_at": updated_at,
    }

@app.post("/complete/{job_id}")
async def complete(job_id: str, payload: QueueJobResult):
    updated_at = _now()
    result_text = json.dumps(payload.result)
    
    # Move from processing to completed
    redis_client.srem("jobs:processing", job_id)
    redis_client.sadd("jobs:completed", job_id)
    redis_client.hset(_job_key(job_id), mapping={
        "status": "completed",
        "result": result_text,
        "error": "",
        "updated_at": updated_at,
        "last_seen_at": updated_at,
    })
    
    if not redis_client.exists(_job_key(job_id)):
        raise HTTPException(status_code=404, detail="Job not found")
    
    QUEUE_COMPLETED_COUNTER.inc()
    
    return {
        "job_id": job_id,
        "status": "completed",
        "queue_pending": _stats()["queue_pending"],
        "updated_at": updated_at,
    }

@app.post("/fail/{job_id}")
async def fail(job_id: str, payload: QueueJobFailure):
    updated_at = _now()
    
    # Move from processing to failed
    redis_client.srem("jobs:processing", job_id)
    redis_client.sadd("jobs:failed", job_id)
    redis_client.hset(_job_key(job_id), mapping={
        "status": "failed",
        "error": payload.error,
        "updated_at": updated_at,
        "last_seen_at": updated_at,
    })
    
    if not redis_client.exists(_job_key(job_id)):
        raise HTTPException(status_code=404, detail="Job not found")
    
    QUEUE_FAILED_COUNTER.inc()
    
    return {
        "job_id": job_id,
        "status": "failed",
        "queue_pending": _stats()["queue_pending"],
        "updated_at": updated_at,
    }

@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job_data = redis_client.hgetall(_job_key(job_id))
    
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return _job_to_dict(job_data)

@app.get("/metrics")
async def metrics():
    try:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except Exception:
        return Response("", media_type="text/plain")

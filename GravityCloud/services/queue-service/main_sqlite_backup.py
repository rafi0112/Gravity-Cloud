import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from prometheus_client import Gauge, Counter, generate_latest, CONTENT_TYPE_LATEST
from pydantic import BaseModel, Field

QUEUE_DB_PATH = Path(os.getenv("QUEUE_DB_PATH", "/app/data/queue.sqlite3"))
CONNECTED_DEVICE_WINDOW_SECONDS = int(os.getenv("CONNECTED_DEVICE_WINDOW_SECONDS", "60"))
DB_LOCK = threading.Lock()

app = FastAPI(title="Queue Service", version="1.0.0")

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

def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(QUEUE_DB_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection

def _init_db() -> None:
    QUEUE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DB_LOCK:
        with _connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    job_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    client_id TEXT,
                    last_seen_at TEXT
                )
                """
            )

            current_columns = {row[1] for row in connection.execute("PRAGMA table_info(jobs)").fetchall()}
            if "client_id" not in current_columns:
                connection.execute("ALTER TABLE jobs ADD COLUMN client_id TEXT")
            if "last_seen_at" not in current_columns:
                connection.execute("ALTER TABLE jobs ADD COLUMN last_seen_at TEXT")

            connection.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at)")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id)")
            connection.commit()

def _row_to_job(row: sqlite3.Row) -> dict:
    return {
        "job_id": row["id"],
        "job_type": row["job_type"],
        "payload": json.loads(row["payload"] or "{}"),
        "status": row["status"],
        "result": json.loads(row["result"] or "{}"),
        "error": row["error"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "client_id": row["client_id"],
        "last_seen_at": row["last_seen_at"],
    }

def _stats() -> dict:
    now = datetime.now(timezone.utc)
    with DB_LOCK:
        with _connect() as connection:
            counts = {
                row["status"]: row["count"]
                for row in connection.execute(
                    "SELECT status, COUNT(*) AS count FROM jobs GROUP BY status"
                ).fetchall()
            }
            pending_jobs = connection.execute(
                """
                SELECT id, job_type, payload, status, result, error, created_at, updated_at, client_id, last_seen_at
                FROM jobs
                WHERE status IN ('queued', 'processing')
                ORDER BY created_at ASC
                """
            ).fetchall()

    queued = int(counts.get("queued", 0))
    processing = int(counts.get("processing", 0))
    completed = int(counts.get("completed", 0))
    failed = int(counts.get("failed", 0))
    queue_pending = queued + processing

    connected_clients: set[str] = set()
    for row in pending_jobs:
        client_id = row["client_id"]
        last_seen_at = row["last_seen_at"] or row["updated_at"] or row["created_at"]
        if not client_id or not last_seen_at:
            continue
        try:
            last_seen = datetime.fromisoformat(last_seen_at)
        except ValueError:
            continue
        if (now - last_seen).total_seconds() <= CONNECTED_DEVICE_WINDOW_SECONDS:
            connected_clients.add(client_id)

    active_requests = processing
    connected_devices = len(connected_clients)

    # update Prometheus gauges
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
        "queued": queued,
        "processing": processing,
        "completed": completed,
        "failed": failed,
        "total_jobs": queued + processing + completed + failed,
        "pending_jobs": [_row_to_job(row) for row in pending_jobs],
    }

@app.on_event("startup")
async def startup_event() -> None:
    _init_db()

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

    with DB_LOCK:
        with _connect() as connection:
            connection.execute(
                """
                INSERT INTO jobs (id, job_type, payload, status, result, error, created_at, updated_at, client_id, last_seen_at)
                VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)
                """,
                (job_id, job.job_type, payload_text, json.dumps({}), None, created_at, created_at, client_id, created_at),
            )
            connection.commit()
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
    with DB_LOCK:
        with _connect() as connection:
            cursor = connection.execute(
                "UPDATE jobs SET status = 'processing', updated_at = ?, last_seen_at = COALESCE(last_seen_at, ?) WHERE id = ?",
                (updated_at, updated_at, job_id),
            )
            connection.commit()
            if cursor.rowcount == 0:
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

    with DB_LOCK:
        with _connect() as connection:
            cursor = connection.execute(
                "UPDATE jobs SET status = 'completed', result = ?, error = NULL, updated_at = ?, last_seen_at = ? WHERE id = ?",
                (result_text, updated_at, updated_at, job_id),
            )
            connection.commit()
            if cursor.rowcount == 0:
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

    with DB_LOCK:
        with _connect() as connection:
            cursor = connection.execute(
                "UPDATE jobs SET status = 'failed', error = ?, updated_at = ?, last_seen_at = ? WHERE id = ?",
                (payload.error, updated_at, updated_at, job_id),
            )
            connection.commit()
            if cursor.rowcount == 0:
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
    with DB_LOCK:
        with _connect() as connection:
            row = connection.execute(
                "SELECT * FROM jobs WHERE id = ?",
                (job_id,),
            ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return _row_to_job(row)


@app.get("/metrics")
async def metrics():
    try:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except Exception:
        return Response("", media_type="text/plain")

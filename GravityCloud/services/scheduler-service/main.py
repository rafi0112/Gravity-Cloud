import asyncio
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import Gauge, Counter, generate_latest, CONTENT_TYPE_LATEST

QUEUE_SERVICE_URL = os.getenv("QUEUE_SERVICE_URL", "http://queue-service:8005")
COMPOSE_WORKDIR = Path(os.getenv("COMPOSE_WORKDIR", "/workspace"))
TARGET_SERVICE_NAME = os.getenv("TARGET_SERVICE_NAME", "gateway-service")
MIN_REPLICAS = int(os.getenv("MIN_REPLICAS", "1"))
MID_REPLICAS = int(os.getenv("MID_REPLICAS", "2"))
MAX_REPLICAS = int(os.getenv("MAX_REPLICAS", "3"))
COOLDOWN_SECONDS = int(os.getenv("COOLDOWN_SECONDS", "30"))
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "5"))

HTTP_TIMEOUT = httpx.Timeout(10.0, connect=3.0)

app = FastAPI(title="Scheduler Service", version="1.0.0")

# Prometheus metrics
SCHEDULER_DESIRED_GAUGE = Gauge("gravity_scheduler_desired_replicas", "Desired replicas for target service")
SCHEDULER_CURRENT_GAUGE = Gauge("gravity_scheduler_current_replicas", "Current replicas for target service")
SCHEDULER_QUEUE_PENDING_GAUGE = Gauge("gravity_scheduler_queue_pending", "Observed queue pending")
SCHEDULER_CONNECTED_DEVICES_GAUGE = Gauge("gravity_scheduler_connected_devices", "Observed connected devices")
SCHEDULER_ACTIVE_REQUESTS_GAUGE = Gauge("gravity_scheduler_active_requests", "Observed active requests")
SCHEDULER_SCALE_COUNTER = Counter("gravity_scheduler_scale_actions_total", "Total scale actions")

STATE = {
    "status": "starting",
    "current_replicas": 0,
    "desired_replicas": MIN_REPLICAS,
    "last_scale_at": None,
    "last_scale_action": None,
    "last_reason": None,
    "last_error": None,
    "cooldown_seconds": COOLDOWN_SECONDS,
    "events": [],
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _request_json(method: str, url: str, **kwargs):
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        response = await client.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json() if response.content else {}


def _compose_command(args: list[str]) -> list[str]:
    return ["docker-compose", *args]


def _record_event(action: str, message: str, details: dict | None = None) -> None:
    event = {
        "timestamp": _now(),
        "action": action,
        "message": message,
        "details": details or {},
    }
    STATE["events"] = [event, *STATE["events"][:9]]
    STATE["last_scale_action"] = action
    STATE["last_reason"] = message


def _running_replica_count() -> int:
    try:
        result = subprocess.run(
            _compose_command(["ps", "-q", TARGET_SERVICE_NAME]),
            cwd=COMPOSE_WORKDIR,
            capture_output=True,
            text=True,
            check=True,
        )
        running = len([line for line in result.stdout.splitlines() if line.strip()])
        return running or MIN_REPLICAS
    except Exception as exc:
        STATE["last_error"] = str(exc)
        return MIN_REPLICAS


def _scale(target_replicas: int, reason: str) -> None:
    target_replicas = max(MIN_REPLICAS, min(MAX_REPLICAS, target_replicas))
    if target_replicas == STATE["current_replicas"]:
        return

    current = STATE["current_replicas"]
    
    # Scale UP: create new replicas
    if target_replicas > current:
        result = subprocess.run(
            _compose_command(["up", "-d", "--no-deps", "--scale", f"{TARGET_SERVICE_NAME}={target_replicas}", TARGET_SERVICE_NAME]),
            cwd=COMPOSE_WORKDIR,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            STATE["status"] = "error"
            STATE["last_error"] = result.stderr.strip() or result.stdout.strip() or "Unknown docker-compose error"
            _record_event("scale_failed", reason, {"target_replicas": target_replicas, "error": STATE["last_error"]})
            return
    
    # Scale DOWN: stop and remove extra containers
    elif target_replicas < current:
        # Get all running containers for this service
        try:
            result = subprocess.run(
                _compose_command(["ps", "-q", TARGET_SERVICE_NAME]),
                cwd=COMPOSE_WORKDIR,
                capture_output=True,
                text=True,
                check=True,
            )
            running_containers = [cid for cid in result.stdout.splitlines() if cid.strip()]
            containers_to_remove = running_containers[target_replicas:]  # Remove extras
            
            if containers_to_remove:
                # Stop and remove extra containers
                for container_id in containers_to_remove:
                    subprocess.run(
                        ["docker", "stop", container_id],
                        capture_output=True,
                        timeout=10,
                    )
                    subprocess.run(
                        ["docker", "rm", container_id],
                        capture_output=True,
                        timeout=10,
                    )
        except Exception as e:
            STATE["last_error"] = f"Container cleanup error: {str(e)}"

    STATE["current_replicas"] = target_replicas
    STATE["desired_replicas"] = target_replicas
    STATE["last_scale_at"] = _now()
    STATE["status"] = "scaled"
    STATE["last_error"] = None
    _record_event("scale", reason, {"target_replicas": target_replicas, "action": "scale_up" if target_replicas > current else "scale_down"})
    try:
        SCHEDULER_SCALE_COUNTER.inc()
    except Exception:
        pass


def _desired_replicas(queue_pending: int, connected_devices: int, active_requests: int) -> tuple[int, str]:
    if queue_pending >= 5:
        return MAX_REPLICAS, f"queue_pending={queue_pending} reached high-load threshold"
    if queue_pending >= 2 or connected_devices >= 2 or active_requests >= 2:
        return MID_REPLICAS, f"load detected queue_pending={queue_pending} connected_devices={connected_devices} active_requests={active_requests}"
    return MIN_REPLICAS, f"load normalized queue_pending={queue_pending} connected_devices={connected_devices} active_requests={active_requests}"


async def _poll_queue_service() -> dict:
    try:
        return await _request_json("GET", f"{QUEUE_SERVICE_URL}/status")
    except Exception as exc:
        return {"status": "offline", "error": str(exc), "queue_pending": 0, "connected_devices": 0, "active_requests": 0}


async def _monitor_loop() -> None:
    while True:
        queue_status = await _poll_queue_service()
        queue_pending = int(queue_status.get("queue_pending", 0))
        connected_devices = int(queue_status.get("connected_devices", 0))
        active_requests = int(queue_status.get("active_requests", 0))
        desired, reason = _desired_replicas(queue_pending, connected_devices, active_requests)
        STATE["desired_replicas"] = desired
        STATE["current_replicas"] = max(MIN_REPLICAS, _running_replica_count())

        # update Prometheus metrics
        try:
            SCHEDULER_DESIRED_GAUGE.set(desired)
            SCHEDULER_CURRENT_GAUGE.set(STATE.get("current_replicas", MIN_REPLICAS))
            SCHEDULER_QUEUE_PENDING_GAUGE.set(queue_pending)
            SCHEDULER_CONNECTED_DEVICES_GAUGE.set(connected_devices)
            SCHEDULER_ACTIVE_REQUESTS_GAUGE.set(active_requests)
        except Exception:
            pass

        last_scale_at = STATE["last_scale_at"]
        cooldown_ready = True
        if last_scale_at:
            try:
                last_scale_dt = datetime.fromisoformat(last_scale_at)
                cooldown_ready = (datetime.now(timezone.utc) - last_scale_dt).total_seconds() >= COOLDOWN_SECONDS
            except ValueError:
                cooldown_ready = True

        if cooldown_ready and desired != STATE["current_replicas"]:
            _scale(desired, reason)
        else:
            STATE["status"] = "watching"
            STATE["last_reason"] = reason

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


@app.get("/metrics")
async def metrics():
    try:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except Exception:
        return Response("", media_type="text/plain")

@app.on_event("startup")
async def startup_event() -> None:
    COMPOSE_WORKDIR.mkdir(parents=True, exist_ok=True)
    STATE["current_replicas"] = max(MIN_REPLICAS, _running_replica_count())
    STATE["desired_replicas"] = STATE["current_replicas"] or MIN_REPLICAS
    STATE["status"] = "watching"
    asyncio.create_task(_monitor_loop())


@app.get("/")
async def root():
    return await status()


@app.get("/health")
async def health():
    return await root()


@app.get("/status")
async def status():
    queue_status = await _poll_queue_service()
    STATE["current_replicas"] = max(MIN_REPLICAS, _running_replica_count()) or STATE["current_replicas"]
    return {
        "service": "scheduler-service",
        "status": STATE["status"],
        "target_service": TARGET_SERVICE_NAME,
        "current_replicas": STATE["current_replicas"],
        "desired_replicas": STATE["desired_replicas"],
        "queue_pending": int(queue_status.get("queue_pending", 0)),
        "active_requests": int(queue_status.get("active_requests", 0)),
        "connected_devices": int(queue_status.get("connected_devices", 0)),
        "cooldown_seconds": COOLDOWN_SECONDS,
        "last_scale_at": STATE["last_scale_at"],
        "last_scale_action": STATE["last_scale_action"],
        "last_reason": STATE["last_reason"],
        "last_error": STATE["last_error"],
        "events": STATE["events"],
        "queue_status": queue_status,
    }


@app.post("/trigger")
async def trigger():
    return await status()
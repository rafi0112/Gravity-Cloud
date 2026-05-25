import json
import math
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
STORE_PATH = BASE_DIR / "chroma_db" / "store.json"
EMBEDDING_SERVICE_URL = "http://embedding-service:8003"

app = FastAPI(title="Vector Service", version="1.0.0")


class IndexRequest(BaseModel):
    filename: str | None = None
    documents: list[dict]


class SearchRequest(BaseModel):
    query: str
    k: int = 3


def _ensure_store() -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not STORE_PATH.exists():
        STORE_PATH.write_text("[]", encoding="utf-8")


def _load_store() -> list[dict]:
    _ensure_store()
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def _save_store(documents: list[dict]) -> None:
    _ensure_store()
    STORE_PATH.write_text(json.dumps(documents, ensure_ascii=False, indent=2), encoding="utf-8")


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)


def _embed_texts(texts: list[str]) -> list[list[float]]:
    response = httpx.post(
        f"{EMBEDDING_SERVICE_URL}/embed",
        json={"texts": texts},
        timeout=120.0,
    )
    response.raise_for_status()
    return response.json()["vectors"]


@app.get("/")
async def root():
    return {"service": "vector-service", "status": "online", "store_path": str(STORE_PATH)}


@app.get("/health")
async def health():
    return await root()


@app.get("/db-status")
async def db_status():
    store = _load_store()
    return {"total_chunks": len(store), "is_empty": len(store) == 0}


@app.post("/index")
async def index_documents(request: IndexRequest):
    try:
        incoming_documents = [
            doc for doc in request.documents
            if doc.get("content")
        ]
        if not incoming_documents:
            store = _load_store()
            return {
                "status": "Success",
                "filename": request.filename,
                "chunks_added": 0,
                "current_db_size": len(store),
            }

        vectors = _embed_texts([doc["content"] for doc in incoming_documents])
        store = _load_store()
        for doc, vector in zip(incoming_documents, vectors):
            store.append({
                "content": doc["content"],
                "metadata": doc.get("metadata", {}),
                "vector": vector,
            })
        _save_store(store)
        return {
            "status": "Success",
            "filename": request.filename,
            "chunks_added": len(incoming_documents),
            "current_db_size": len(store),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/search")
async def search_documents(request: SearchRequest):
    try:
        store = _load_store()
        if not store:
            return {"documents": [], "count": 0}

        query_vector = _embed_texts([request.query])[0]
        ranked_documents = sorted(
            store,
            key=lambda doc: _cosine_similarity(query_vector, doc.get("vector", [])),
            reverse=True,
        )[: request.k]
        return {
            "documents": [
                {"page_content": doc["content"], "metadata": doc.get("metadata", {})}
                for doc in ranked_documents
            ],
            "count": len(ranked_documents),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete("/clear-db")
async def clear_db():
    try:
        _save_store([])
        return {"message": "Knowledge base cleared successfully."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")
if not OLLAMA_HOST.startswith("http://") and not OLLAMA_HOST.startswith("https://"):
    OLLAMA_HOST = f"http://{OLLAMA_HOST}"

app = FastAPI(title="Embedding Service", version="1.0.0")
embeddings = OllamaEmbeddings(model=os.getenv("EMBEDDING_MODEL", "nomic-embed-text"), base_url=OLLAMA_HOST)


class EmbedRequest(BaseModel):
    texts: list[str]


@app.get("/")
async def root():
    return {"service": "embedding-service", "status": "online", "target_ollama_host": OLLAMA_HOST}


@app.get("/health")
async def health():
    return await root()


@app.post("/embed")
async def embed(request: EmbedRequest):
    try:
        vectors = embeddings.embed_documents(request.texts)
        return {"vectors": vectors, "count": len(vectors)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if file.content_type not in {None, "application/pdf"} and not str(file.filename).lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    temp_file = tempfile.NamedTemporaryFile(prefix="gravitycloud_", suffix=".pdf", delete=False)
    temp_path = Path(temp_file.name)
    try:
        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        with temp_file:
            temp_file.write(pdf_bytes)
            temp_file.flush()

        loader = PyMuPDFLoader(str(temp_path))
        documents = loader.load()
        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
        chunks = splitter.split_documents(documents)

        payload = []
        for chunk in chunks:
            payload.append({
                "content": chunk.page_content,
                "metadata": chunk.metadata,
            })

        return {"documents": payload, "chunks": len(payload)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if temp_path.exists():
            temp_path.unlink()
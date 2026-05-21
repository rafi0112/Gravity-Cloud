from fastapi import FastAPI, Body, UploadFile, File, HTTPException
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyMuPDFLoader
import ollama
import os
import shutil

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")
if not OLLAMA_HOST.startswith("http://") and not OLLAMA_HOST.startswith("https://"):
    OLLAMA_HOST = f"http://{OLLAMA_HOST}"

os.environ["OLLAMA_HOST"] = OLLAMA_HOST

app = FastAPI(
    title="Cloud Engine AI",
    description="Cloud Computing Lab Project\n\n B200305032 - Khandekar Rafiul Islam\n\nB200305049 - Md. Bayazid Sarkar Bijoy",
    version="3.0.0"
)

persist_directory = "./chroma_db"
embeddings = OllamaEmbeddings(model="gemma2:2b", base_url=OLLAMA_HOST)

_vector_db = None

def get_db():
    global _vector_db
    if _vector_db is None:
        try:
            _vector_db = Chroma(persist_directory=persist_directory, embedding_function=embeddings)
        except Exception as e:
            raise HTTPException(
                status_code=500, 
                detail=f"Database Lock or Ollama Connection Failed. Solution: Delete './chroma_db' folder and restart. Error: {str(e)}"
            )
    return _vector_db

@app.get("/", tags=["Status"])
async def root():
    return {
        "project": "Cloud Engine AI",
        "status": "Online",
        "database": "ChromaDB Ready",
        "engine": "Gemma 2:2B",
        "target_ollama_host": OLLAMA_HOST
    }

@app.get("/db-status", tags=["Status"])
async def get_db_status():
    try:
        db = get_db()
        count = db._collection.count()
        return {"total_chunks": count, "is_empty": count == 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-file", tags=["Data Ingestion"])
async def upload_file(file: UploadFile = File(...)):
    try:
        db = get_db()
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        loader = PyMuPDFLoader(temp_path)
        data = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
        chunks = text_splitter.split_documents(data)
        
        db.add_documents(chunks)
        os.remove(temp_path)
        
        return {
            "status": "Success",
            "filename": file.filename,
            "chunks_added": len(chunks),
            "current_db_size": db._collection.count()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/ask", tags=["Chat Engine"])
async def ask_post(prompt: str = Body(..., media_type="text/plain")):
    try:
        db = get_db()
        db_count = db._collection.count()
        
        file_keywords = [
            "uploaded", "file", "document", "pdf", "context", "shared", "info", 
            "data", "text", "paper", "report", "doc", "files", "documents", 
            "reference", "manual", "content", "source", "page", "paragraph" , "attachment" , "file" , "docs",
            "mentioned", "provided", "included", "attached", "shared" , "given"
        ]
        
        prompt_lower = prompt.lower()
        is_short_prompt = len(prompt.split()) <= 2
        wants_file = any(word in prompt_lower for word in file_keywords)
        
        context = ""
        docs = []

        if db_count > 0 and (wants_file or not is_short_prompt):
            docs = db.similarity_search(prompt, k=3)
            context = "\n\n".join([doc.page_content for doc in docs])
        
        if context:
            system_instruction = f"""You are Cloud Engine AI. 
            Combine information from the provided context and your internal knowledge, not large text answer is expected.
            Context: {context}"""
            mode = "Mixed Mode"
        else:
            system_instruction = "You are Cloud Engine AI. Answer based on your general knowledge. Not large text answer is expected."
            mode = "General Knowledge"

        response = ollama.chat(model='gemma2:2b', messages=[
            {'role': 'system', 'content': system_instruction},
            {'role': 'user', 'content': prompt},
        ])
        
        return {
            "response": response['message']['content'],
            "mode": mode,
            "search_performed": len(docs) > 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.delete("/clear-db", tags=["Maintenance"])
async def clear_database():
    try:
        db = get_db()
        ids = db._collection.get()['ids']
        if ids:
            db._collection.delete(ids=ids)
            return {"message": "Knowledge base cleared successfully."}
        return {"message": "Database is already empty."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing DB: {str(e)}")
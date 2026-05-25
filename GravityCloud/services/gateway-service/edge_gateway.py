import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()

NODES = [
    "http://127.0.0.1:11434",
    "http://100.86.201.32:11434"
]
_node_index = 0

limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
client = httpx.AsyncClient(timeout=None, limits=limits)

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def route_request(path: str, request: Request):
    global _node_index
    selected_node = NODES[_node_index]
    _node_index = (_node_index + 1) % len(NODES)
    
    url = f"{selected_node}/{path}"
    print(f"[Device-Using] -> {url}")
    
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    
    # ব্যাকএন্ড রিকোয়েস্ট পাঠানো
    req = client.build_request(
        method=request.method,
        url=url,
        headers=headers,
        content=body,
        params=request.query_params
    )
    r = await client.send(req, stream=True)
    
    return StreamingResponse(
        r.aiter_raw(),
        status_code=r.status_code,
        headers=dict(r.headers)
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=4000, loop="asyncio")
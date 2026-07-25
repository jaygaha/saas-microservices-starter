# task-service — owns the "work" domain (boards, tasks).
# Step 1 is intentionally tiny: a health check + a root echo, so we can verify
# Traefik routes to a SECOND, non-Go service. Domain logic comes in later steps.
import os
from datetime import datetime, timezone
  
from fastapi import FastAPI, Request

SERVICE_NAME = os.getenv("SERVICE_NAME", "task-service")
  
app = FastAPI(title=SERVICE_NAME)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "time": datetime.now(timezone.utc).isoformat(),
    }
      

# Catch-all echo, declared AFTER /health so /health wins. Lets you SEE prefix
# stripping: GET /api/tasks/anything at the gateway arrives here as /anything.
@app.get("/{full_path:path}")
def root(request: Request, full_path: str):
    return {
        "service": SERVICE_NAME,
        "message": "this request reached the service through Traefik",
        "path": request.url.path,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="[IP_ADDRESS]", port=8000)

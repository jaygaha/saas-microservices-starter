from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI
from fastapi.responses import JSONResponse

import boards
import tasks
from config import config as cfg

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.config = cfg
    app.state.pool = await asyncpg.create_pool(dsn=cfg.database_url, min_size=1, max_size=10)
    try: 
        yield
    finally:
        await app.state.pool.close()


app = FastAPI(lifespan=lifespan, title=cfg.service_name)

app.include_router(boards.router)
app.include_router(tasks.router)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": cfg.service_name,
    }

@app.get("/health/ready")
async def ready():
    try:
        async with app.state.pool.acquire() as conn:
            await conn.execute("SELECT 1")
        return {"status": "ready", "service": cfg.service_name}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(status_code=503, content={"status": "unavailable", "error": str(exc)})
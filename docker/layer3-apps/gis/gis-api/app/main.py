from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import async_session
from app.routers import auth, data_sources, facilities, imports, layers, regions, search, users
from app.services.cache import close_redis, get_redis
from app.services.kafka import close_producer
from app.services.search import close_es, get_es


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_producer()
    await close_redis()
    await close_es()


app = FastAPI(
    title="GIS Utility Map API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(regions.router, prefix="/api/v1")
app.include_router(layers.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(facilities.router, prefix="/api/v1")
app.include_router(imports.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(data_sources.router, prefix="/api/v1")


@app.get("/api/health")
async def health(detail: bool = False):
    if not detail:
        return {"status": "ok"}

    checks: dict = {}

    # DB check
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Redis check
    try:
        r = await get_redis()
        await r.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "unavailable"

    # Elasticsearch check
    try:
        es = await get_es()
        info = await es.info()
        checks["elasticsearch"] = f"ok (v{info['version']['number']})"
    except Exception:
        checks["elasticsearch"] = "unavailable"

    overall = "ok" if all(v == "ok" or v.startswith("ok") for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}

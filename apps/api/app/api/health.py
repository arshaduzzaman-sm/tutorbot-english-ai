from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.ai.registry import provider_summary
from app.db.session import get_engine

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, object]:
    return {"status": "ok", "ai_providers": provider_summary()}


@router.get("/health/ready", response_model=None)
async def ready() -> dict[str, str] | JSONResponse:
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("select 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "down"})
    return {"status": "ok", "database": "up"}

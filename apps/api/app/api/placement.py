"""REST actions for the placement (diagnostic) test. The test itself is read through GraphQL."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db
from app.api.practice import SpeechOut
from app.core.security import AuthUser, get_current_user
from app.services import placement as svc

router = APIRouter(prefix="/api/v1/placement", tags=["placement"])


class PlacementIn(BaseModel):
    answers: dict[str, str] = Field(max_length=100)
    duration_seconds: int | None = Field(default=None, ge=0, le=3 * 3600)


class PlacementOut(BaseModel):
    recommended_level: int
    level_scores: dict[str, float]
    skill_scores: dict[str, float | None]
    correct: int
    total: int
    plan: dict[str, Any]
    note: str


@router.post("/submit", response_model=PlacementOut)
async def submit(
    body: PlacementIn, user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
) -> PlacementOut:
    return PlacementOut(**await svc.submit(session, user.id, body.answers, datetime.now(UTC).date()))


@router.get("/items/{item_id}/speech", response_model=SpeechOut)
async def speech(item_id: str, session: AsyncSession = Depends(get_user_db)) -> SpeechOut:
    return SpeechOut(**await svc.speech(session, item_id))

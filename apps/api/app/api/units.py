"""REST actions for units: the end-of-unit test. Units themselves are read through GraphQL."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db
from app.api.lessons import ExerciseResultOut
from app.core.security import AuthUser, get_current_user
from app.services import units as svc

router = APIRouter(prefix="/api/v1/units", tags=["units"])


class UnitTestIn(BaseModel):
    answers: dict[str, str] = Field(max_length=50)


class UnitTestOut(BaseModel):
    score_ratio: float
    passed: bool
    pass_ratio: float
    unlocked: str | None = Field(description="Slug of the next unit when this test was passed")
    results: list[ExerciseResultOut]


@router.post("/{slug}/test", response_model=UnitTestOut)
async def submit_test(
    slug: str,
    body: UnitTestIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> UnitTestOut:
    return UnitTestOut(**await svc.submit_test(session, user.id, slug, body.answers))

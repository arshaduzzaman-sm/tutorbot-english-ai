"""REST actions for lessons. Lesson content itself is read through GraphQL."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db
from app.core.security import AuthUser, get_current_user
from app.services import lessons as svc

router = APIRouter(prefix="/api/v1/lessons", tags=["lessons"])


class ExerciseCheckIn(BaseModel):
    answer: str = Field(max_length=500)


class ExerciseResultOut(BaseModel):
    id: str
    correct: bool
    correct_answer: str
    explanation: str


class LessonCheckIn(BaseModel):
    answers: dict[str, str] = Field(max_length=50)
    duration_seconds: int | None = Field(default=None, ge=0, le=6 * 3600)


class LessonCheckOut(BaseModel):
    score_ratio: float
    passed: bool
    pass_ratio: float
    status: str
    results: list[ExerciseResultOut]


class LessonStartOut(BaseModel):
    status: str


@router.post("/{slug}/start", response_model=LessonStartOut)
async def start(
    slug: str, user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
) -> LessonStartOut:
    return LessonStartOut(status=await svc.start_lesson(session, user.id, slug))


@router.post("/{slug}/exercises/{exercise_id}/check", response_model=ExerciseResultOut)
async def check_exercise(
    slug: str, exercise_id: str, body: ExerciseCheckIn, session: AsyncSession = Depends(get_user_db)
) -> ExerciseResultOut:
    return ExerciseResultOut(**(await svc.check_one(session, slug, exercise_id, body.answer)).__dict__)


@router.post("/{slug}/check", response_model=LessonCheckOut)
async def submit_check(
    slug: str,
    body: LessonCheckIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> LessonCheckOut:
    return LessonCheckOut(**await svc.submit_check(session, user.id, slug, body.answers, body.duration_seconds))

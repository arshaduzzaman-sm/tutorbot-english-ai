"""REST actions for question practice. Questions themselves are read through GraphQL."""

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db
from app.core.security import AuthUser, get_current_user
from app.services import practice as svc

router = APIRouter(prefix="/api/v1/practice", tags=["practice"])


class AnswerResponse(BaseModel):
    """Exactly one of these is used, depending on the task type."""

    blanks: dict[str, str] | None = Field(default=None, max_length=20)
    selected: list[str] | None = Field(default=None, max_length=10)
    order: list[str] | None = Field(default=None, max_length=10)


class AnswerIn(BaseModel):
    response: AnswerResponse
    mode: Literal["learn", "practice"] = "practice"
    duration_seconds: int | None = Field(default=None, ge=0, le=3 * 3600)


class AnswerOut(BaseModel):
    score_ratio: float
    is_correct: bool
    correct_answer: dict[str, Any]
    parts: list[dict[str, Any]]
    explanation: str
    note: str


@router.post("/questions/{question_id}/answer", response_model=AnswerOut)
async def answer(
    question_id: uuid.UUID,
    body: AnswerIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> AnswerOut:
    result = await svc.answer_question(
        session, user.id, question_id, body.response.model_dump(exclude_none=True), body.mode, body.duration_seconds
    )
    return AnswerOut(**result)

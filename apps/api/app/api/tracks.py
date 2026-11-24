"""REST actions for the vocabulary and pronunciation tracks. Sets and topics are read through GraphQL."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db
from app.api.practice import SpeechOut
from app.core.security import AuthUser, get_current_user
from app.services import tracks as svc

router = APIRouter(prefix="/api/v1", tags=["tracks"])


class WordReviewIn(BaseModel):
    known: bool = Field(description="True when the learner knew the word")


class WordReviewOut(BaseModel):
    box: int
    due_at: datetime
    mastered: bool


@router.post("/vocabulary/{word_id}/review", response_model=WordReviewOut)
async def review_word(
    word_id: uuid.UUID,
    body: WordReviewIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> WordReviewOut:
    return WordReviewOut(**await svc.review_word(session, user.id, word_id, body.known, datetime.now(UTC)))


class DrillIn(BaseModel):
    answers: dict[str, str] = Field(max_length=30)


class DrillResultOut(BaseModel):
    id: str
    correct: bool
    correct_answer: str
    explanation: str


class DrillOut(BaseModel):
    score_ratio: float
    results: list[DrillResultOut]


@router.post("/pronunciation/{slug}/drill", response_model=DrillOut)
async def submit_drill(
    slug: str,
    body: DrillIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> DrillOut:
    return DrillOut(**await svc.submit_drill(session, user.id, slug, body.answers))


@router.get("/pronunciation/{slug}/items/{item_id}/speech", response_model=SpeechOut)
async def drill_speech(slug: str, item_id: str, session: AsyncSession = Depends(get_user_db)) -> SpeechOut:
    """The word a listen-and-choose item says. Fetched only when the learner presses Play."""
    return SpeechOut(**await svc.drill_speech(session, slug, item_id))

"""REST actions for the AI tutor chat."""

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db
from app.core.security import AuthUser, get_current_user
from app.services import tutor as svc

router = APIRouter(prefix="/api/v1/tutor", tags=["tutor"])


class TutorIn(BaseModel):
    message: str = Field(min_length=1, max_length=svc.MAX_CHARS)


class TutorOut(BaseModel):
    reply: str
    on_topic: bool
    provider: Literal["local", "mock"] | None
    level: int
    remaining_today: int


class ClearedOut(BaseModel):
    deleted: int


@router.post("/messages", response_model=TutorOut)
async def post_message(
    body: TutorIn, user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
) -> TutorOut:
    """Ask the tutor a question about English or PTE practice. Off-topic questions get a short fixed reply."""
    return TutorOut(**await svc.ask(session, user.id, body.message))


@router.delete("/messages", response_model=ClearedOut)
async def clear_messages(
    user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
) -> ClearedOut:
    """Delete the viewer's tutor chat history."""
    return ClearedOut(deleted=await svc.clear(session, user.id))

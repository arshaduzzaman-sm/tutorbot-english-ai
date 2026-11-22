"""REST actions on the current user's account (reads go through GraphQL)."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db, require_role
from app.core.errors import AppError
from app.core.security import AuthUser, get_current_user
from app.db.session import service_session
from app.services import profile as profile_service

router = APIRouter(prefix="/api/v1/me", tags=["me"])


class OnboardingIn(BaseModel):
    level_code: int = Field(ge=1, le=6, description="Learning level 1-6")
    target_score: int = Field(ge=10, le=90, description="Target PTE score the learner is aiming for")
    exam_date: date | None = None
    daily_goal_minutes: Literal[15, 30, 60, 120] = 30


class OnboardingOut(BaseModel):
    level_code: int
    target_score: int
    exam_date: date | None
    daily_goal_minutes: int
    onboarding_completed: bool


class DeleteAccountIn(BaseModel):
    confirm: Literal["DELETE"]


@router.put("/onboarding", response_model=OnboardingOut)
async def put_onboarding(
    body: OnboardingIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> OnboardingOut:
    if body.exam_date and body.exam_date < date.today():
        raise AppError(422, "exam_date_in_past", "The exam date cannot be in the past.")
    row = await profile_service.save_onboarding(
        session, user.id, body.level_code, body.target_score, body.exam_date, body.daily_goal_minutes
    )
    return OnboardingOut(
        level_code=row["level_code"],
        target_score=row["target_score"],
        exam_date=row["exam_date"],
        daily_goal_minutes=row["daily_goal_minutes"],
        onboarding_completed=row["onboarding_completed_at"] is not None,
    )


@router.get("/export")
async def export_data(
    user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
) -> dict[str, object]:
    return await profile_service.export_user_data(session, user.id)


@router.delete("", status_code=204)
async def delete_me(body: DeleteAccountIn, user: AuthUser = Depends(get_current_user)) -> Response:
    async with service_session() as service:
        await profile_service.delete_account(service, user.id)
    return Response(status_code=204)


@router.get("/admin-check", include_in_schema=False)
async def admin_check(user: AuthUser = Depends(require_role("admin"))) -> dict[str, str]:
    """Tiny protected endpoint used by role tests until the admin area exists (M7)."""
    return {"status": "ok"}

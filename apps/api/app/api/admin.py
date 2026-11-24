"""Administration REST API (M7). Every route checks the caller's role first (`require_role`)."""

import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db, require_role, user_roles
from app.core.security import AuthUser, get_current_user
from app.services import admin as svc

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
staff = require_role("admin", "content_editor")
admin_only = require_role("admin")

Status = Literal["draft", "ai_generated", "reviewed", "published"]


@router.get("/overview")
async def overview(user: AuthUser = Depends(staff), session: AsyncSession = Depends(get_user_db)) -> dict[str, Any]:
    """Content counts, open reports and (for admins) usage monitoring."""
    return await svc.overview(session, "admin" in await user_roles(session, user.id))


@router.get("/questions")
async def list_questions(
    status: Status | None = None,
    category: str | None = None,
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: AuthUser = Depends(staff),
    session: AsyncSession = Depends(get_user_db),
) -> list[dict[str, Any]]:
    return await svc.list_questions(session, status, category, search, limit, offset)


@router.get("/questions/export")
async def export_questions(
    status: Status = "published", _: AuthUser = Depends(staff), session: AsyncSession = Depends(get_user_db)
) -> dict[str, Any]:
    """Questions in the content-file format, ready to commit to content/questions/."""
    return await svc.export_questions(session, status)


@router.get("/questions/{question_id}")
async def get_question(
    question_id: uuid.UUID, _: AuthUser = Depends(staff), session: AsyncSession = Depends(get_user_db)
) -> dict[str, Any]:
    return await svc.get_question(session, question_id)


class QuestionPatch(BaseModel):
    instructions: str | None = Field(default=None, min_length=1, max_length=2000)
    explanation: str | None = Field(default=None, min_length=1, max_length=4000)
    difficulty: Literal["beginner", "intermediate", "advanced"] | None = None
    content: dict[str, Any] | None = None
    answer: dict[str, Any] | None = None


@router.patch("/questions/{question_id}")
async def update_question(
    question_id: uuid.UUID,
    body: QuestionPatch,
    user: AuthUser = Depends(staff),
    session: AsyncSession = Depends(get_user_db),
) -> dict[str, Any]:
    """Edit a question. It goes back to draft and needs a new approval before it is published again."""
    return await svc.update_question(session, user.id, question_id, body.model_dump(exclude_none=True))


class ReviewIn(BaseModel):
    decision: Literal["approve", "request_changes"]
    note: str = Field(default="", max_length=2000)


@router.post("/questions/{question_id}/review")
async def review_question(
    question_id: uuid.UUID,
    body: ReviewIn,
    user: AuthUser = Depends(staff),
    session: AsyncSession = Depends(get_user_db),
) -> dict[str, Any]:
    return await svc.review_question(session, user.id, question_id, body.decision, body.note)


class StatusIn(BaseModel):
    status: Literal["draft", "published"]


@router.post("/questions/{question_id}/status")
async def set_status(
    question_id: uuid.UUID,
    body: StatusIn,
    user: AuthUser = Depends(staff),
    session: AsyncSession = Depends(get_user_db),
) -> dict[str, Any]:
    """Publish (only after an approval of the current version) or take a question back to draft."""
    return await svc.set_status(session, user.id, question_id, body.status)


class UploadIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    origin: Literal["human", "ai"]
    questions: list[dict[str, Any]] = Field(min_length=1, max_length=500)


@router.post("/uploads")
async def upload(
    body: UploadIn, user: AuthUser = Depends(staff), session: AsyncSession = Depends(get_user_db)
) -> dict[str, Any]:
    """Add questions from a content file (JSON). New questions are never published straight away."""
    return await svc.upload(session, user.id, body.filename, body.origin, body.questions)


@router.get("/reports")
async def list_reports(
    status: Literal["open", "resolved", "dismissed"] = "open",
    _: AuthUser = Depends(staff),
    session: AsyncSession = Depends(get_user_db),
) -> list[dict[str, Any]]:
    return await svc.list_reports(session, status)


class ResolveIn(BaseModel):
    status: Literal["resolved", "dismissed"]


@router.post("/reports/{report_id}", status_code=204)
async def resolve_report(
    report_id: uuid.UUID, body: ResolveIn, user: AuthUser = Depends(staff), session: AsyncSession = Depends(get_user_db)
) -> None:
    await svc.resolve_report(session, user.id, report_id, body.status)


@router.get("/users")
async def list_users(
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    _: AuthUser = Depends(admin_only),
) -> list[dict[str, Any]]:
    return await svc.list_users(search, limit)


class RolesIn(BaseModel):
    roles: list[Literal["content_editor", "admin"]] = Field(max_length=2)


@router.put("/users/{user_id}/roles")
async def set_roles(user_id: uuid.UUID, body: RolesIn, user: AuthUser = Depends(admin_only)) -> dict[str, list[str]]:
    """Set a user's staff roles. Everyone keeps the student role. You cannot remove your own admin role."""
    return {"roles": await svc.set_roles(user.id, user_id, list(body.roles))}


@router.get("/blueprints")
async def list_blueprints(
    _: AuthUser = Depends(admin_only), session: AsyncSession = Depends(get_user_db)
) -> list[dict[str, Any]]:
    return await svc.list_blueprints(session)


class BlueprintPatch(BaseModel):
    status: Literal["draft", "published"] | None = None
    name: str | None = Field(default=None, min_length=3, max_length=120)


@router.patch("/blueprints/{code}", status_code=204)
async def update_blueprint(
    code: str, body: BlueprintPatch, user: AuthUser = Depends(admin_only), session: AsyncSession = Depends(get_user_db)
) -> None:
    await svc.update_blueprint(session, user.id, code, body.status, body.name)


@router.get("/calibration")
async def calibration(
    user: AuthUser = Depends(admin_only), session: AsyncSession = Depends(get_user_db)
) -> dict[str, Any]:
    """Your own sample evaluations with AI bands, your ratings, and AI-human agreement per task type."""
    return await svc.calibration(session, user.id)


class RatingIn(BaseModel):
    bands: dict[str, Literal["needs_work", "developing", "good", "strong"]] = Field(min_length=1, max_length=12)


@router.put("/calibration/{evaluation_id}", status_code=204)
async def rate(
    evaluation_id: uuid.UUID,
    body: RatingIn,
    user: AuthUser = Depends(admin_only),
    session: AsyncSession = Depends(get_user_db),
) -> None:
    await svc.rate(session, user.id, evaluation_id, dict(body.bands))


# Learners report a problem with a question
reports_router = APIRouter(prefix="/api/v1", tags=["reports"])


class ReportIn(BaseModel):
    reason: Literal["wrong_answer", "unclear", "typo", "audio", "offensive", "other"]
    message: str = Field(default="", max_length=1000)


class ReportOut(BaseModel):
    id: uuid.UUID
    created_at: datetime | None = None


@reports_router.post("/questions/{question_id}/reports", response_model=ReportOut, status_code=201)
async def report_question(
    question_id: uuid.UUID,
    body: ReportIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> ReportOut:
    """Tell the content team about a problem with a question (wrong answer, typo, unclear, ...)."""
    return ReportOut(id=await svc.create_report(session, user.id, question_id, body.reason, body.message))

"""REST actions for mock exams: start (or resume), current item, answer, abandon, report."""

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db
from app.api.practice import AnswerResponse
from app.core.security import AuthUser, get_current_user
from app.services import exams as svc

router = APIRouter(prefix="/api/v1/exams", tags=["exams"])


class StartIn(BaseModel):
    blueprint_code: str = Field(pattern=r"^[a-z0-9_]+$", max_length=60)


class StartOut(BaseModel):
    id: uuid.UUID


@router.post("", response_model=StartOut, status_code=201)
async def start(
    body: StartIn, user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
) -> StartOut:
    """Starts a test from a blueprint, or returns the one already in progress (resume after a refresh)."""
    return StartOut(id=await svc.start(session, user.id, body.blueprint_code))


class ExamOption(BaseModel):
    label: str
    body: str


class ExamItem(BaseModel):
    id: uuid.UUID
    external_id: str
    category_code: str
    instructions: str
    content: dict[str, Any]
    options: list[ExamOption]


class SectionInfo(BaseModel):
    index: int
    code: str
    title: str
    position: int
    count: int


class SectionSummary(BaseModel):
    code: str
    title: str
    count: int


class ExamState(BaseModel):
    id: uuid.UUID
    status: Literal["in_progress", "completed", "abandoned"]
    kind: str
    blueprint_code: str | None
    index: int
    total: int
    pre_test: list[str]
    sections: list[SectionSummary]
    section: SectionInfo | None
    section_seconds_left: int | None = Field(description="Time left on the section clock; null when items are timed")
    item: ExamItem | None


@router.get("/{test_id}", response_model=ExamState)
async def get_state(test_id: uuid.UUID, session: AsyncSession = Depends(get_user_db)) -> ExamState:
    return ExamState(**await svc.current(session, test_id))


class ExamAnswerIn(BaseModel):
    index: int = Field(ge=0, description="Must be the current item; going back is not allowed")
    response: AnswerResponse | None = None
    evaluation_id: uuid.UUID | None = Field(default=None, description="For speaking and writing items")


class ExamAnswerOut(BaseModel):
    index: int
    finished: bool


@router.post("/{test_id}/answer", response_model=ExamAnswerOut)
async def answer(
    test_id: uuid.UUID,
    body: ExamAnswerIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> ExamAnswerOut:
    out = await svc.answer(
        session,
        user.id,
        test_id,
        body.index,
        body.response.model_dump(exclude_none=True) if body.response else None,
        body.evaluation_id,
    )
    return ExamAnswerOut(**out)


@router.post("/{test_id}/abandon", status_code=204)
async def abandon(test_id: uuid.UUID, session: AsyncSession = Depends(get_user_db)) -> Response:
    await svc.abandon(session, test_id)
    return Response(status_code=204)


class ReportRow(BaseModel):
    code: str
    name: str
    ratio: float | None
    band: str | None
    items: int


class PreviousTest(BaseModel):
    id: str
    completed_at: str | None
    overall_ratio: float | None


class ExamReport(BaseModel):
    ready: bool = Field(description="False while speaking/writing answers are still being evaluated")
    pending_evaluations: int
    overall_ratio: float | None
    overall_band: str | None
    by_section: list[ReportRow]
    by_skill: list[ReportRow]
    by_type: list[ReportRow]
    by_criterion: list[ReportRow]
    most_lost: list[ReportRow]
    previous: list[PreviousTest]
    answered: int
    skipped: int
    total: int
    disclaimer: str


@router.get("/{test_id}/report", response_model=ExamReport)
async def get_report(test_id: uuid.UUID, session: AsyncSession = Depends(get_user_db)) -> ExamReport:
    return ExamReport(**await svc.report(session, test_id))

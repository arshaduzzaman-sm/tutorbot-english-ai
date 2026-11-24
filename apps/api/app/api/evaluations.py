"""REST actions for speaking and writing: consent, upload a recording, submit writing, poll an evaluation."""

import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_db
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import AuthUser, get_current_user
from app.services import evaluate as svc

router = APIRouter(prefix="/api/v1", tags=["evaluations"])
Mode = Literal["learn", "practice", "timed_drill", "exam"]


class ConsentIn(BaseModel):
    granted: bool


class ConsentOut(BaseModel):
    granted: bool


@router.put("/me/consents/recording", response_model=ConsentOut)
async def put_recording_consent(
    body: ConsentIn, user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
) -> ConsentOut:
    """Agree (or stop agreeing) to voice recordings being stored on this computer for feedback."""
    await svc.set_recording_consent(session, user.id, body.granted)
    return ConsentOut(granted=body.granted)


class QueuedOut(BaseModel):
    id: uuid.UUID
    status: Literal["queued", "running", "done", "failed"]
    task_type: str


class WritingIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    mode: Mode = "practice"
    duration_seconds: int | None = Field(default=None, ge=0, le=3 * 3600)
    test_session_id: uuid.UUID | None = None


@router.post("/writing/questions/{question_id}/submit", response_model=QueuedOut, status_code=202)
async def submit_writing(
    question_id: uuid.UUID,
    body: WritingIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> QueuedOut:
    out = await svc.submit_writing(
        session, user.id, question_id, body.text, body.mode, body.duration_seconds, body.test_session_id
    )
    return QueuedOut(**out)


@router.post(
    "/speaking/questions/{question_id}/recording",
    response_model=QueuedOut,
    status_code=202,
    openapi_extra={
        "requestBody": {"required": True, "content": {"audio/webm": {"schema": {"type": "string", "format": "binary"}}}}
    },
)
async def upload_recording(
    question_id: uuid.UUID,
    request: Request,
    duration_seconds: float | None = Query(default=None, ge=0, le=600),
    mode: Mode = "practice",
    test_session_id: uuid.UUID | None = None,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_user_db),
) -> QueuedOut:
    """Send the recording as the raw request body (Content-Type audio/webm, audio/ogg, audio/wav ...)."""
    limit = get_settings().max_recording_bytes
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise AppError(413, "audio_too_large", "The recording is too large.")
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise AppError(413, "audio_too_large", "The recording is too large.")
        chunks.append(chunk)
    out = await svc.submit_recording(
        session,
        user.id,
        question_id,
        b"".join(chunks),
        request.headers.get("content-type", ""),
        duration_seconds,
        mode,
        test_session_id,
    )
    return QueuedOut(**out)


class EvaluationOut(BaseModel):
    id: uuid.UUID
    status: Literal["queued", "running", "done", "failed"]
    task_type: str
    question_id: uuid.UUID | None
    recording_id: uuid.UUID | None
    test_session_id: uuid.UUID | None
    mode: str
    response_text: str | None = Field(description="Typed answer, or the transcript of a recording once evaluated")
    result: dict[str, Any] | None = Field(description="EvaluationResult (SPEC 7.2) once done; bands only, no scores")
    error: str | None
    provider: Literal["local", "mock"] | None
    created_at: datetime
    finished_at: datetime | None


@router.get("/evaluations/{evaluation_id}", response_model=EvaluationOut)
async def get_evaluation(evaluation_id: uuid.UUID, session: AsyncSession = Depends(get_user_db)) -> EvaluationOut:
    row = await svc.get_evaluation(session, evaluation_id)
    if row["status"] == "failed":
        row["error"] = "We could not evaluate this answer. Please try again."
    return EvaluationOut(**row)


@router.get("/recordings/{recording_id}", response_class=Response)
async def get_recording(
    recording_id: uuid.UUID, user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
) -> Response:
    """Play back your own recording."""
    data, mime = await svc.recording_bytes(session, user.id, recording_id)
    return Response(content=data, media_type=mime, headers={"Cache-Control": "private, no-store"})

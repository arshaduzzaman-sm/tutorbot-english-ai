"""Speaking and writing attempts: recordings, the evaluation job queue and the worker (SPEC 6.1.6, 6.5, 7.1).

A learner's answer becomes a 'queued' row in public.evaluations (inserted under RLS). The worker takes jobs with
`for update skip locked`, runs the pipeline with the configured providers and writes the result with the service
role. The UI polls GET /api/v1/evaluations/{id} and shows "Evaluating..." until the job is done.
"""

import asyncio
import json
import logging
import shutil
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.evaluation import pipeline, speaking, writing
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import service_session
from app.services import review

logger = logging.getLogger("tutorbot.evaluate")
MODES = {"learn", "practice", "timed_drill", "exam"}
AUDIO_TYPES = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
}
EVALUATED = speaking.SPEAKING_TYPES | writing.WRITING_TYPES


async def _question(session: AsyncSession, question_id: uuid.UUID) -> dict[str, Any]:
    row = (
        (
            await session.execute(
                text(
                    "select q.id, q.category_id, c.code, q.content, q.answer, q.key_points from public.questions q "
                    "join public.question_categories c on c.id = q.category_id "
                    "where q.id = :id and q.status = 'published' and q.deleted_at is null"
                ),
                {"id": question_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "question_not_found", "Question not found.")
    return dict(row)


async def _check_limit(session: AsyncSession, user_id: str) -> None:
    used = (
        await session.execute(
            text(
                "select count(*) from public.evaluations where user_id = :u and created_at > now() - interval '1 day'"
            ),
            {"u": user_id},
        )
    ).scalar_one()
    if int(used) >= get_settings().evaluations_per_day:
        raise AppError(429, "daily_limit", "You have reached today's limit for AI feedback. Please try again tomorrow.")


async def _queue(
    session: AsyncSession,
    user_id: str,
    q: dict[str, Any],
    mode: str,
    duration: int | None,
    response_text: str | None,
    recording_id: uuid.UUID | None,
    test_session_id: uuid.UUID | None,
) -> dict[str, Any]:
    if mode not in MODES:
        raise AppError(422, "bad_mode", "Mode must be learn, practice, timed_drill or exam.")
    row = (
        (
            await session.execute(
                text(
                    "insert into public.evaluations (user_id, question_id, category_id, recording_id, test_session_id, "
                    "mode, response_text, duration_seconds) values (:u, :q, :c, :r, :t, "
                    "cast(:m as public.practice_mode), :txt, :d) returning id, status, created_at"
                ),
                {
                    "u": user_id,
                    "q": q["id"],
                    "c": q["category_id"],
                    "r": recording_id,
                    "t": test_session_id,
                    "m": mode,
                    "txt": response_text,
                    "d": duration,
                },
            )
        )
        .mappings()
        .one()
    )
    return {"id": row["id"], "status": row["status"], "task_type": q["code"]}


async def submit_writing(
    session: AsyncSession,
    user_id: str,
    question_id: uuid.UUID,
    response_text: str,
    mode: str = "practice",
    duration: int | None = None,
    test_session_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    q = await _question(session, question_id)
    if q["code"] not in writing.WRITING_TYPES:
        raise AppError(422, "not_writing", "This question is not a writing task.")
    body = response_text.strip()
    if not body:
        raise AppError(422, "empty_answer", "Please write your answer first.")
    if len(body) > writing.MAX_CHARS:
        raise AppError(422, "too_long", "Your answer is too long.")
    await _check_limit(session, user_id)
    return await _queue(session, user_id, q, mode, duration, body, None, test_session_id)


async def has_recording_consent(session: AsyncSession, user_id: str) -> bool:
    granted = (
        await session.execute(
            text(
                "select granted from public.consents where user_id = :u and kind = 'recording' "
                "order by created_at desc limit 1"
            ),
            {"u": user_id},
        )
    ).scalar_one_or_none()
    return bool(granted)


async def set_recording_consent(session: AsyncSession, user_id: str, granted: bool) -> None:
    await session.execute(
        text("insert into public.consents (user_id, kind, granted) values (:u, 'recording', :g)"),
        {"u": user_id, "g": granted},
    )


def _user_dir(user_id: str) -> Path:
    return get_settings().recordings_path / str(uuid.UUID(user_id))


async def submit_recording(
    session: AsyncSession,
    user_id: str,
    question_id: uuid.UUID,
    audio: bytes,
    mime_type: str,
    duration_seconds: float | None,
    mode: str = "practice",
    test_session_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    q = await _question(session, question_id)
    if q["code"] not in speaking.SPEAKING_TYPES:
        raise AppError(422, "not_speaking", "This question is not a speaking task.")
    if not await has_recording_consent(session, user_id):
        raise AppError(403, "consent_required", "Please agree to recording before you record your voice.")
    base = mime_type.split(";")[0].strip().lower()
    if base not in AUDIO_TYPES:
        raise AppError(415, "bad_audio_type", "Please record in WebM, Ogg, WAV, MP4 or MP3 format.")
    if not audio:
        raise AppError(422, "empty_audio", "The recording is empty.")
    if len(audio) > get_settings().max_recording_bytes:
        raise AppError(413, "audio_too_large", "The recording is too large.")
    limit = speaking.MAX_SECONDS[q["code"]]
    if duration_seconds is not None and duration_seconds > limit:
        raise AppError(422, "audio_too_long", f"The recording is longer than {limit} seconds.")
    await _check_limit(session, user_id)
    rec_id = uuid.uuid4()
    file_name = f"{rec_id}.{AUDIO_TYPES[base]}"
    await session.execute(
        text(
            "insert into public.recordings (id, user_id, question_id, file_name, mime_type, size_bytes, "
            "duration_seconds) values (:id, :u, :q, :f, :m, :s, :d)"
        ),
        {"id": rec_id, "u": user_id, "q": q["id"], "f": file_name, "m": base, "s": len(audio), "d": duration_seconds},
    )
    folder = _user_dir(user_id)
    await asyncio.to_thread(folder.mkdir, parents=True, exist_ok=True)
    await asyncio.to_thread((folder / file_name).write_bytes, audio)
    dur = round(duration_seconds) if duration_seconds is not None else None
    return await _queue(session, user_id, q, mode, dur, None, rec_id, test_session_id)


def delete_user_recordings(user_id: str) -> None:
    shutil.rmtree(_user_dir(user_id), ignore_errors=True)


async def recording_bytes(session: AsyncSession, user_id: str, recording_id: uuid.UUID) -> tuple[bytes, str]:
    """The learner's own recording (RLS + the per-user folder), for playback."""
    row = (
        (
            await session.execute(
                text("select file_name, mime_type from public.recordings where id = :id and user_id = :u"),
                {"id": recording_id, "u": user_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "recording_not_found", "Recording not found.")
    path = _user_dir(user_id) / Path(str(row["file_name"])).name
    if not path.exists():
        raise AppError(404, "recording_not_found", "Recording not found.")
    return await asyncio.to_thread(path.read_bytes), str(row["mime_type"])


EVAL_COLUMNS = (
    "e.id, e.status, c.code as task_type, e.question_id, e.recording_id, e.test_session_id, e.mode::text as mode, "
    "e.response_text, e.result, e.error, e.provider, e.created_at, e.finished_at"
)


async def get_evaluation(session: AsyncSession, evaluation_id: uuid.UUID) -> dict[str, Any]:
    row = (
        (
            await session.execute(
                text(
                    f"select {EVAL_COLUMNS} from public.evaluations e "  # noqa: S608 (constant column list)
                    "join public.question_categories c on c.id = e.category_id where e.id = :id"
                ),
                {"id": evaluation_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "evaluation_not_found", "Evaluation not found.")
    return dict(row)


# ---------- worker ----------


async def _claim() -> dict[str, Any] | None:
    async with service_session() as s:
        row = (
            (
                await s.execute(
                    text(
                        "update public.evaluations set status = 'running', started_at = now() where id = ("
                        "select id from public.evaluations where status = 'queued' order by created_at "
                        "for update skip locked limit 1) "
                        "returning id, user_id, question_id, recording_id, mode::text as mode, response_text, "
                        "duration_seconds, category_id"
                    )
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return None
        job = dict(row)
        q = await _question(s, job["question_id"])
        job["question"] = q
        if job["recording_id"] is not None:
            rec = (
                await s.execute(
                    text("select file_name from public.recordings where id = :id"), {"id": job["recording_id"]}
                )
            ).scalar_one_or_none()
            job["file_name"] = rec
        return job


async def _run(job: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    q = job["question"]
    task = q["code"]
    if task in writing.WRITING_TYPES:
        result = await pipeline.evaluate_writing(task, q, str(job["response_text"] or ""))
        return result.model_dump(), None
    path = _user_dir(str(job["user_id"])) / Path(str(job.get("file_name") or "missing")).name
    audio = await asyncio.to_thread(path.read_bytes)
    result, transcript = await pipeline.evaluate_speaking(task, q, audio)
    return result.model_dump(), transcript


def overall_ratio(result: dict[str, Any]) -> float:
    """Mean of the criterion ratios: stored for progress charts only; learners see bands, never this number."""
    ratios = [float(c["signals"].get("ratio", 0)) for c in result["criteria"]]
    return round(sum(ratios) / len(ratios), 4) if ratios else 0.0


async def process_next() -> uuid.UUID | None:
    """Evaluate one queued job. Returns its id, or None when the queue is empty."""
    job = await _claim()
    if job is None:
        return None
    try:
        result, transcript = await _run(job)
    except Exception as exc:  # the job fails visibly; the learner can try again
        logger.exception("evaluation %s failed", job["id"])
        async with service_session() as s:
            await s.execute(
                text("update public.evaluations set status = 'failed', error = :e, finished_at = now() where id = :id"),
                {"e": str(exc)[:500], "id": job["id"]},
            )
        return uuid.UUID(str(job["id"]))
    ratio = overall_ratio(result)
    good = all(c["band"] in ("good", "strong") for c in result["criteria"])
    async with service_session() as s:
        await s.execute(
            text(
                "update public.evaluations set status = 'done', result = cast(:r as jsonb), score_ratio = :s, "
                "provider = :p, response_text = coalesce(response_text, :t), finished_at = now() where id = :id"
            ),
            {"r": json.dumps(result), "s": ratio, "p": result["provider"], "t": transcript, "id": job["id"]},
        )
        await s.execute(
            text(
                "insert into public.attempts (user_id, question_id, category_id, mode, is_correct, score_ratio, "
                "duration_seconds) values (:u, :q, :c, cast(:m as public.practice_mode), :ok, :s, :d)"
            ),
            {
                "u": job["user_id"],
                "q": job["question_id"],
                "c": job["category_id"],
                "m": job["mode"],
                "ok": good,
                "s": ratio,
                "d": job["duration_seconds"],
            },
        )
        await s.execute(
            text("insert into public.ai_usage (user_id, feature, provider) values (:u, 'evaluation', :p)"),
            {"u": job["user_id"], "p": result["provider"]},
        )
        if job["mode"] != "exam":
            await review.record(s, str(job["user_id"]), job["question_id"], ratio, good, datetime.now(UTC))
    return uuid.UUID(str(job["id"]))


async def requeue_stale(minutes: int = 10) -> None:
    """Jobs left 'running' by a crash go back to the queue."""
    async with service_session() as s:
        await s.execute(
            text(
                "update public.evaluations set status = 'queued', started_at = null where status = 'running' "
                "and started_at < now() - make_interval(mins => :m)"
            ),
            {"m": minutes},
        )


async def worker_loop(stop: asyncio.Event, idle_seconds: float = 1.0) -> None:
    await requeue_stale()
    while not stop.is_set():
        try:
            done = await process_next()
        except Exception:
            logger.exception("evaluation worker error")
            done = None
        if done is None:
            try:
                await asyncio.wait_for(stop.wait(), timeout=idle_seconds)
            except TimeoutError:
                pass

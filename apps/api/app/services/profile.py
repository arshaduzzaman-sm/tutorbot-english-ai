"""Profile actions: onboarding, data export and account deletion."""

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.services.evaluate import delete_user_recordings

EXPORT_TABLES = (
    "profiles",
    "user_roles",
    "attempts",
    "learning_progress",
    "review_items",
    "study_plans",
    "unit_progress",
    "test_sessions",
    "vocabulary_reviews",
    "pronunciation_progress",
    "consents",
    "recordings",
    "evaluations",
    "ai_usage",
)


async def save_onboarding(
    session: AsyncSession,
    user_id: str,
    level_code: int,
    target_score: int,
    exam_date: date | None,
    daily_goal_minutes: int,
) -> dict[str, Any]:
    level = (
        await session.execute(text("select id from public.learning_levels where code = :c"), {"c": level_code})
    ).scalar_one_or_none()
    if level is None:
        raise AppError(422, "unknown_level", "Unknown learning level.")
    row = (
        (
            await session.execute(
                text(
                    """update public.profiles
                   set learning_level_id = :level, target_score = :target, exam_date = :exam,
                       daily_goal_minutes = :goal,
                       onboarding_completed_at = coalesce(onboarding_completed_at, now())
                   where id = :uid
                   returning id, target_score, exam_date, daily_goal_minutes, onboarding_completed_at"""
                ),
                {"level": level, "target": target_score, "exam": exam_date, "goal": daily_goal_minutes, "uid": user_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "profile_not_found", "Profile not found.")
    return {**row, "level_code": level_code}


def _jsonable(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if hasattr(value, "__float__") and not isinstance(value, (int, float, bool)):
        return float(value)
    return value


async def export_user_data(session: AsyncSession, user_id: str) -> dict[str, Any]:
    """Everything stored about the user. Runs under RLS, so only own rows are visible."""
    data: dict[str, Any] = {"exported_at": datetime.now(UTC).isoformat(), "user_id": user_id}
    for table in EXPORT_TABLES:
        key = "id" if table == "profiles" else "user_id"
        rows = (
            (
                await session.execute(text(f"select * from public.{table} where {key} = :uid"), {"uid": user_id})  # noqa: S608
            )
            .mappings()
            .all()
        )
        data[table] = [{k: _jsonable(v) for k, v in r.items()} for r in rows]
    return data


async def delete_account(service: AsyncSession, user_id: str) -> None:
    """Deletes the auth user (profile, attempts, recordings rows etc. cascade) and the recording files."""
    await service.execute(
        text(
            "insert into public.audit_log (actor_id, action, target_table, target_id) "
            "values (:uid, 'account_deleted', 'auth.users', :uid)"
        ),
        {"uid": user_id},
    )
    result = await service.execute(text("delete from auth.users where id = :uid"), {"uid": user_id})
    if result.rowcount == 0:  # type: ignore[attr-defined]
        raise AppError(404, "user_not_found", "Account not found.")
    delete_user_recordings(user_id)  # the audio files on disk; their rows went with the cascade

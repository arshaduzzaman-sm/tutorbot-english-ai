"""Lesson flow (Learn -> See -> Try -> Check): marking and progress (SPEC 5A.1)."""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError

PASS_RATIO = 0.8  # Same threshold the spec uses to unlock the next unit.


@dataclass(frozen=True)
class ExerciseResult:
    id: str
    correct: bool
    correct_answer: str
    explanation: str


def normalize(value: str) -> str:
    """Ignore extra spaces only. Case matters: some exercises test capital letters."""
    return " ".join(value.strip().split())


def mark_exercise(exercise: dict[str, Any], given: str | None) -> ExerciseResult:
    """Deterministic marking. Supported types: single_choice (more types arrive with new content)."""
    kind = exercise.get("type")
    if kind != "single_choice":
        raise AppError(422, "unsupported_exercise", f"Exercise type {kind!r} cannot be marked yet.")
    answer = str(exercise["answer"])
    correct = given is not None and normalize(given) == normalize(answer)
    return ExerciseResult(
        id=str(exercise["id"]), correct=correct, correct_answer=answer, explanation=str(exercise.get("explanation", ""))
    )


def public_exercise(exercise: dict[str, Any]) -> dict[str, Any]:
    """What learners may see before answering: never the answer or explanation."""
    return {k: exercise[k] for k in ("id", "type", "prompt", "options", "hint") if k in exercise}


async def load_lesson(session: AsyncSession, slug: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    lesson = (
        (
            await session.execute(
                text("select id, slug, title from public.lessons where slug = :s and deleted_at is null"), {"s": slug}
            )
        )
        .mappings()
        .one_or_none()
    )
    if lesson is None:  # RLS also hides unpublished lessons from students
        raise AppError(404, "lesson_not_found", "Lesson not found.")
    sections = (
        (
            await session.execute(
                text("select kind, exercises from public.lesson_sections where lesson_id = :id order by sort_order"),
                {"id": lesson["id"]},
            )
        )
        .mappings()
        .all()
    )
    return dict(lesson), [dict(s) for s in sections]


def find_exercises(sections: list[dict[str, Any]], kind: str) -> list[dict[str, Any]]:
    return [ex for s in sections if s["kind"] == kind for ex in (s["exercises"] or [])]


async def check_one(session: AsyncSession, slug: str, exercise_id: str, given: str) -> ExerciseResult:
    """Instant feedback for a Try exercise. Does not change progress."""
    _, sections = await load_lesson(session, slug)
    for ex in find_exercises(sections, "try") + find_exercises(sections, "check"):
        if ex.get("id") == exercise_id:
            return mark_exercise(ex, given)
    raise AppError(404, "exercise_not_found", "Exercise not found.")


async def start_lesson(session: AsyncSession, user_id: str, slug: str) -> str:
    lesson, _ = await load_lesson(session, slug)
    row = await session.execute(
        text(
            """insert into public.learning_progress (user_id, lesson_id, status)
               values (:u, :l, 'in_progress')
               on conflict (user_id, lesson_id) do update set updated_at = now()
               returning status"""
        ),
        {"u": user_id, "l": lesson["id"]},
    )
    return str(row.scalar_one())


async def submit_check(
    session: AsyncSession, user_id: str, slug: str, answers: dict[str, str], duration_seconds: int | None
) -> dict[str, Any]:
    """Marks the Check section, records an attempt and saves progress.

    A lesson is completed when the learner scores at least 80%. A later lower score never
    removes a completion, and the best score is kept.
    """
    lesson, sections = await load_lesson(session, slug)
    exercises = find_exercises(sections, "check")
    if not exercises:
        raise AppError(422, "no_check", "This lesson has no Check exercises.")
    results = [mark_exercise(ex, answers.get(str(ex["id"]))) for ex in exercises]
    ratio = round(sum(r.correct for r in results) / len(results), 4)
    passed = ratio >= PASS_RATIO
    await session.execute(
        text(
            """insert into public.attempts (user_id, lesson_id, mode, is_correct, score_ratio, duration_seconds)
               values (:u, :l, 'learn', :ok, :r, :d)"""
        ),
        {"u": user_id, "l": lesson["id"], "ok": passed, "r": ratio, "d": duration_seconds},
    )
    status = (
        await session.execute(
            text(
                """insert into public.learning_progress (user_id, lesson_id, status, score_ratio, completed_at)
                   values (:u, :l, case when :passed then 'completed' else 'in_progress' end, :r,
                           case when :passed then now() end)
                   on conflict (user_id, lesson_id) do update set
                     status = case when learning_progress.status = 'completed' or :passed
                                   then 'completed' else 'in_progress' end,
                     score_ratio = greatest(coalesce(learning_progress.score_ratio, 0), excluded.score_ratio),
                     completed_at = coalesce(learning_progress.completed_at, excluded.completed_at),
                     updated_at = now()
                   returning status"""
            ),
            {"u": user_id, "l": lesson["id"], "r": ratio, "passed": passed},
        )
    ).scalar_one()
    return {
        "score_ratio": ratio,
        "passed": passed,
        "pass_ratio": PASS_RATIO,
        "status": status,
        "results": [r.__dict__ for r in results],
    }

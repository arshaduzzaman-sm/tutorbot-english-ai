"""Mistake notebook + spaced review (SPEC 5A.5). Schedule: see migration 20261122000003_review_items.sql."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Wait after a correct review, by the box the item moves into.
INTERVAL_DAYS = {1: 1, 2: 3, 3: 7, 4: 14}
MASTERED_BOX = 5
RETRY_AFTER_WRONG = timedelta(days=1)


@dataclass(frozen=True)
class Step:
    box: int
    due_at: datetime
    mastered: bool


def next_step(box: int, correct: bool, now: datetime) -> Step:
    """Pure Leitner-style step: up one box when correct, back to box 0 (due tomorrow) when wrong."""
    if not correct:
        return Step(0, now + RETRY_AFTER_WRONG, False)
    new_box = min(box + 1, MASTERED_BOX)
    if new_box >= MASTERED_BOX:
        return Step(MASTERED_BOX, now, True)
    return Step(new_box, now + timedelta(days=INTERVAL_DAYS[new_box]), False)


async def record(
    session: AsyncSession, user_id: str, question_id: uuid.UUID, score: float, correct: bool, now: datetime
) -> str | None:
    """Update the notebook after any answer. Returns the item's state: 'added', 'moved', 'mastered' or None."""
    row = (
        (
            await session.execute(
                text("select box, mastered_at from public.review_items where user_id = :u and question_id = :q"),
                {"u": user_id, "q": question_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        if correct:
            return None
        await session.execute(
            text(
                "insert into public.review_items (user_id, question_id, box, due_at, wrong_count, last_score) "
                "values (:u, :q, 0, :now, 1, :s)"
            ),
            {"u": user_id, "q": question_id, "now": now, "s": round(score, 4)},
        )
        return "added"
    if row["mastered_at"] is not None and correct:
        return None
    step = next_step(0 if row["mastered_at"] is not None else int(row["box"]), correct, now)
    await session.execute(
        text(
            "update public.review_items set box = :b, due_at = :d, last_score = :s, "
            "wrong_count = wrong_count + :w, mastered_at = :m where user_id = :u and question_id = :q"
        ),
        {
            "b": step.box,
            "d": step.due_at,
            "s": round(score, 4),
            "w": 0 if correct else 1,
            "m": now if step.mastered else None,
            "u": user_id,
            "q": question_id,
        },
    )
    return "mastered" if step.mastered else "moved"

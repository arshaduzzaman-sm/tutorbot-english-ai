"""Units and end-of-unit tests (SPEC 5A.1).

Unlock rule: the first unit of the course, every unit below the learner's level (they placed higher), and the first
unit at the learner's level are open. Any other unit opens when the unit before it (in course order) is passed.
"""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.services.lessons import PASS_RATIO, mark_exercise


@dataclass(frozen=True)
class UnitState:
    id: Any
    slug: str
    level_code: int
    passed: bool
    best_score: float | None
    attempts: int
    locked: bool


def lock_states(units: list[dict[str, Any]], profile_level: int | None) -> list[bool]:
    """Pure unlock rule. `units` are in course order with keys level_code and passed."""
    locked: list[bool] = []
    first_at_level: set[int] = set()
    for i, u in enumerate(units):
        lv = int(u["level_code"])
        is_first_at_level = lv not in first_at_level
        first_at_level.add(lv)
        open_ = (
            i == 0
            or (profile_level is not None and lv < profile_level)
            or (profile_level is not None and lv == profile_level and is_first_at_level)
            or bool(units[i - 1]["passed"])
        )
        locked.append(not open_)
    return locked


async def unit_states(session: AsyncSession, user_id: str) -> list[UnitState]:
    rows = (
        (
            await session.execute(
                text(
                    "select u.id, u.slug, lv.code as level_code, p.best_score, coalesce(p.attempts, 0) as attempts, "
                    "p.passed_at is not null as passed from public.units u "
                    "join public.learning_levels lv on lv.id = u.learning_level_id "
                    "left join public.unit_progress p on p.unit_id = u.id and p.user_id = :u "
                    "where u.status = 'published' and u.deleted_at is null order by lv.code, u.sort_order"
                ),
                {"u": user_id},
            )
        )
        .mappings()
        .all()
    )
    level = (
        await session.execute(
            text(
                "select lv.code from public.profiles p join public.learning_levels lv on lv.id = p.learning_level_id "
                "where p.id = :u"
            ),
            {"u": user_id},
        )
    ).scalar_one_or_none()
    units = [dict(r) for r in rows]
    locks = lock_states(units, int(level) if level is not None else None)
    return [
        UnitState(
            id=u["id"],
            slug=u["slug"],
            level_code=int(u["level_code"]),
            passed=bool(u["passed"]),
            best_score=float(u["best_score"]) if u["best_score"] is not None else None,
            attempts=int(u["attempts"]),
            locked=locked,
        )
        for u, locked in zip(units, locks, strict=True)
    ]


async def submit_test(session: AsyncSession, user_id: str, slug: str, answers: dict[str, str]) -> dict[str, Any]:
    states = await unit_states(session, user_id)
    idx = next((i for i, s in enumerate(states) if s.slug == slug), None)
    if idx is None:
        raise AppError(404, "unit_not_found", "Unit not found.")
    state = states[idx]
    if state.locked:
        raise AppError(403, "unit_locked", "Pass the unit before this one first.")
    items = (
        await session.execute(text("select test_items from public.units where id = :id"), {"id": state.id})
    ).scalar_one()
    if not items:
        raise AppError(422, "no_test", "This unit has no test yet.")
    results = [mark_exercise(ex, answers.get(str(ex["id"]))) for ex in items]
    ratio = round(sum(r.correct for r in results) / len(results), 4)
    passed = ratio >= PASS_RATIO
    await session.execute(
        text(
            """insert into public.unit_progress (user_id, unit_id, best_score, attempts, passed_at)
               values (:u, :unit, :r, 1, case when :passed then now() end)
               on conflict (user_id, unit_id) do update set
                 best_score = greatest(unit_progress.best_score, excluded.best_score),
                 attempts = unit_progress.attempts + 1,
                 passed_at = coalesce(unit_progress.passed_at, excluded.passed_at)"""
        ),
        {"u": user_id, "unit": state.id, "r": ratio, "passed": passed},
    )
    next_slug = states[idx + 1].slug if passed and idx + 1 < len(states) else None
    return {
        "score_ratio": ratio,
        "passed": passed,
        "pass_ratio": PASS_RATIO,
        "unlocked": next_slug,
        "results": [r.__dict__ for r in results],
    }

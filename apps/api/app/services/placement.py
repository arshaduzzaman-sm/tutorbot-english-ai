"""Placement (diagnostic) test and study plan (SPEC 8).

The result is a practice estimate of where to start, not an official level or score.
"""

import json
import uuid
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.services.practice import AUTO_MARKED

PASS_RATIO = 0.6  # a level counts as "comfortable" at 60% or more of its items
TESTED_SKILLS = ("reading", "writing", "listening")  # speaking needs the local AI tools (M3)
SKILL_PRACTICE = {
    "reading": [
        "reading_mc_single",
        "reading_fill_blanks",
        "rw_fill_blanks",
        "reading_mc_multiple",
        "reorder_paragraphs",
    ],
    "listening": [
        "listening_mc_single",
        "select_missing_word",
        "write_from_dictation",
        "highlight_incorrect_words",
        "listening_fill_blanks",
        "highlight_correct_summary",
        "listening_mc_multiple",
    ],
    "writing": ["rw_fill_blanks", "write_from_dictation", "listening_fill_blanks"],
}
assert all(c in AUTO_MARKED for codes in SKILL_PRACTICE.values() for c in codes)


def public_item(item: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {
        k: item[k] for k in ("id", "level", "skill", "type", "prompt", "passage", "options") if k in item
    }
    out["has_audio"] = bool(item.get("audio_script"))
    return out


def _ratio(right: int, total: int) -> float | None:
    return right / total if total else None


def score(items: list[dict[str, Any]], answers: dict[str, str]) -> dict[str, Any]:
    by_level: dict[int, list[bool]] = {}
    by_skill: dict[str, list[bool]] = {}
    for it in items:
        ok = answers.get(it["id"]) == it["answer"]
        by_level.setdefault(int(it["level"]), []).append(ok)
        by_skill.setdefault(str(it["skill"]), []).append(ok)
    level_ratio = {lv: sum(v) / len(v) for lv, v in sorted(by_level.items())}
    recommended = max(level_ratio) if level_ratio else 1
    for lv, ratio in level_ratio.items():
        if ratio < PASS_RATIO:  # start where it gets hard
            recommended = lv
            break
    return {
        "recommended_level": recommended,
        "level_scores": {str(k): v for k, v in level_ratio.items()},
        "skill_scores": {k: _ratio(sum(v), len(v)) for k, v in by_skill.items()},
        "correct": sum(answers.get(it["id"]) == it["answer"] for it in items),
        "total": len(items),
    }


def build_plan(
    level: int, skill_scores: dict[str, float | None], daily_minutes: int, exam_date: date | None, today: date
) -> dict[str, Any]:
    """A simple daily plan: lessons at the start level, practice for the weakest skill, then mistake review."""
    tested = {s: r for s, r in skill_scores.items() if s in TESTED_SKILLS and r is not None}
    weakest = sorted(tested, key=lambda s: (tested[s], TESTED_SKILLS.index(s)))
    focus = weakest[0] if weakest else "reading"
    review = max(5, round(daily_minutes * 0.2))
    practice = max(5, round(daily_minutes * 0.4))
    lessons = max(5, daily_minutes - review - practice)
    days_left = (exam_date - today).days if exam_date and exam_date >= today else None
    return {
        "daily_minutes": lessons + practice + review,
        "focus_skills": weakest[:2],
        "days_to_exam": days_left,
        "blocks": [
            {"kind": "lessons", "minutes": lessons, "level": level},
            {"kind": "practice", "minutes": practice, "skill": focus, "categories": SKILL_PRACTICE[focus][:3]},
            {"kind": "review", "minutes": review},
        ],
    }


async def load_test(session: AsyncSession) -> dict[str, Any]:
    row = (
        (
            await session.execute(
                text(
                    "select id, slug, title, estimated_minutes, items from public.placement_tests "
                    "where status = 'published' order by version desc limit 1"
                )
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "placement_not_found", "No placement test is available.")
    return dict(row)


async def speech(session: AsyncSession, item_id: str) -> dict[str, Any]:
    test = await load_test(session)
    item = next((i for i in test["items"] if i["id"] == item_id and i.get("audio_script")), None)
    if item is None:
        raise AppError(404, "audio_not_found", "This item has no audio.")
    return {"external_id": f"placement-{item_id}", "parts": [item["audio_script"]], "transcript": item["audio_script"]}


async def submit(session: AsyncSession, user_id: str, answers: dict[str, str], today: date) -> dict[str, Any]:
    test = await load_test(session)
    items = list(test["items"])
    if not set(answers) <= {i["id"] for i in items}:
        raise AppError(422, "unknown_item", "Some answers are for questions that are not in this test.")
    result = score(items, answers)
    prof = (
        (
            await session.execute(
                text("select daily_goal_minutes, exam_date from public.profiles where id = :u"), {"u": user_id}
            )
        )
        .mappings()
        .one()
    )
    plan = build_plan(
        result["recommended_level"], result["skill_scores"], int(prof["daily_goal_minutes"]), prof["exam_date"], today
    )
    await session.execute(
        text(
            "update public.profiles set learning_level_id = "
            "(select id from public.learning_levels where code = :code) where id = :u"
        ),
        {"code": result["recommended_level"], "u": user_id},
    )
    plan_id = uuid.uuid4()
    await session.execute(
        text(
            "insert into public.study_plans "
            "(id, user_id, placement_test_id, recommended_level_code, skill_scores, plan) "
            "values (:id, :u, :t, :lv, cast(:skills as jsonb), cast(:plan as jsonb))"
        ),
        {
            "id": plan_id,
            "u": user_id,
            "t": test["id"],
            "lv": result["recommended_level"],
            "skills": json.dumps(result["skill_scores"]),
            "plan": json.dumps(plan),
        },
    )
    return {**result, "plan": plan, "note": "Practice estimate of where to start. Not an official PTE score or level."}

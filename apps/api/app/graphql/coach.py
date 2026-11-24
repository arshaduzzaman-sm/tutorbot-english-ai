"""GraphQL read side for personal coaching: recommendations, readiness, weekly check-in, today's plan (M5)."""

from datetime import UTC, datetime
from typing import Any

import strawberry
from sqlalchemy import text
from strawberry.scalars import JSON
from strawberry.types import Info

from app.graphql.context import Context
from app.services import analytics as an
from app.services import coach as c

CtxInfo = Info[Context, None]


@strawberry.type(description="Practice guidance from your own answers. Not an official PTE score.")
class Coach:
    recommendations: JSON = strawberry.field(description="Ranked next steps: kind, reason, categoryCode, difficulty")
    readiness: JSON = strawberry.field(description="Bands per skill and an overall label (never a 10-90 score)")
    weekly: JSON = strawberry.field(description="This week against last week")
    today_plan: JSON = strawberry.field(description="Today's blocks: lessons, practice, review")
    level: int


async def practice_categories(info: CtxInfo) -> dict[str, tuple[str, ...]]:
    rows = await info.context.execute(
        text(
            "select c.code, coalesce(c.skills::text[], '{}') from public.question_categories c "
            "where exists (select 1 from public.questions q where q.category_id = c.id and q.status = 'published' "
            "and q.deleted_at is null) order by c.sort_order, c.code"
        )
    )
    raw: list[Any] = list(rows.all())
    return {r[0]: tuple(r[1]) for r in raw}


async def attempt_rows(info: CtxInfo, user_id: str) -> list[c.AttemptRow]:
    rows = await info.context.execute(
        text(
            """select qc.code, a.score_ratio, a.is_correct, (a.created_at at time zone 'utc')::date
               from public.attempts a join public.question_categories qc on qc.id = a.category_id
               where a.user_id = :uid and a.mode <> 'exam' order by a.created_at desc limit 2000"""
        ),
        {"uid": user_id},
    )
    out = []
    raw: list[Any] = list(rows.all())
    for code, ratio, correct, day in raw:
        r = float(ratio) if ratio is not None else (1.0 if correct else 0.0) if correct is not None else None
        out.append(c.AttemptRow(category_code=code, ratio=r, day=day))
    return out


async def learner_level(info: CtxInfo, user_id: str) -> tuple[int, int]:
    row = (
        await info.context.execute(
            text(
                "select coalesce(l.code, 1), p.daily_goal_minutes from public.profiles p "
                "left join public.learning_levels l on l.id = p.learning_level_id where p.id = :uid"
            ),
            {"uid": user_id},
        )
    ).first()
    if row is None:
        return 1, 30
    vals = list(row)
    return int(vals[0]), int(vals[1])


async def coach(info: CtxInfo, user_id: str) -> Coach:
    today = datetime.now(UTC).date()
    categories = await practice_categories(info)
    rows = await attempt_rows(info, user_id)
    level, minutes = await learner_level(info, user_id)
    due = (
        await info.context.execute(
            text(
                "select count(*) from public.review_items "
                "where user_id = :u and mastered_at is null and due_at <= now()"
            ),
            {"u": user_id},
        )
    ).scalar_one()
    stats = c.category_stats(rows)
    recs = c.recommendations(stats, categories, level, int(due), today)
    return Coach(
        recommendations=_camel(recs),
        readiness=_camel(c.readiness(stats, categories)),
        weekly=_camel(c.weekly_checkin(rows, today)),
        today_plan=_camel(c.today_plan(recs, level, minutes)),
        level=level,
    )


def _camel(value: Any) -> Any:
    if isinstance(value, dict):
        return {_key(k): _camel(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_camel(v) for v in value]
    return value


def _key(k: str) -> str:
    head, *rest = k.split("_")
    return head + "".join(p.title() for p in rest)


@strawberry.type
class TutorMessage:
    id: strawberry.ID
    role: str = strawberry.field(description="user or assistant")
    content: str
    provider: str | None
    created_at: datetime


async def tutor_messages(info: CtxInfo, user_id: str, limit: int) -> list[TutorMessage]:
    rows = await info.context.execute(
        text(
            "select id, role, content, provider, created_at from public.tutor_messages "
            "where user_id = :u order by created_at desc, role asc limit :n"
        ),
        {"u": user_id, "n": max(1, min(limit, 100))},
    )
    raw: list[Any] = list(rows.all())
    return [
        TutorMessage(id=strawberry.ID(str(r[0])), role=r[1], content=r[2], provider=r[3], created_at=r[4])
        for r in reversed(raw)
    ]


async def analytics(info: CtxInfo, user_id: str, days: int) -> Any:
    today = datetime.now(UTC).date()
    days = an.clamp_days(days)
    res = await info.context.execute(an.ROWS_SQL, {"u": user_id, "since": an.since_for(today, days)})
    return _camel(an.build(an.rows_from(res.all()), today, days))

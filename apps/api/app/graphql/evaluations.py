"""GraphQL read side for speaking and writing evaluations (history per task type)."""

from datetime import datetime
from typing import Any

import strawberry
from sqlalchemy import text
from strawberry.scalars import JSON
from strawberry.types import Info

from app.graphql.context import Context

CtxInfo = Info[Context, None]


@strawberry.type
class Evaluation:
    id: strawberry.ID
    status: str = strawberry.field(description="queued, running, done or failed")
    task_type: str
    question_id: strawberry.ID | None
    recording_id: strawberry.ID | None
    mode: str
    response_text: str | None
    result: JSON | None = strawberry.field(description="EvaluationResult (bands only, no scores) once done")
    provider: str | None
    created_at: datetime
    finished_at: datetime | None


def _evaluation(r: Any) -> Evaluation:
    return Evaluation(
        id=strawberry.ID(str(r.id)),
        status=r.status,
        task_type=r.code,
        question_id=strawberry.ID(str(r.question_id)) if r.question_id else None,
        recording_id=strawberry.ID(str(r.recording_id)) if r.recording_id else None,
        mode=r.mode,
        response_text=r.response_text,
        result=r.result,
        provider=r.provider,
        created_at=r.created_at,
        finished_at=r.finished_at,
    )


async def evaluations(info: CtxInfo, category_code: str | None, limit: int) -> list[Evaluation]:
    rows = await info.context.execute(
        text(
            "select e.id, e.status, c.code, e.question_id, e.recording_id, e.mode::text as mode, e.response_text, "
            "e.result, e.provider, e.created_at, e.finished_at from public.evaluations e "
            "join public.question_categories c on c.id = e.category_id "
            "where e.user_id = :u and (cast(:code as text) is null or c.code = :code) "
            "order by e.created_at desc limit :lim"
        ),
        {"u": info.context.user.id, "code": category_code, "lim": max(1, min(limit, 50))},
    )
    return [_evaluation(r) for r in rows.all()]


async def recording_consent(info: CtxInfo) -> bool:
    rows = await info.context.execute(
        text(
            "select granted from public.consents where user_id = :u and kind = 'recording' "
            "order by created_at desc limit 1"
        ),
        {"u": info.context.user.id},
    )
    r = rows.first()
    return bool(r and r[0])

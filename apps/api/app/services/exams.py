"""Blueprint-driven exam engine: full mocks, section tests and mini mocks (SPEC 5A.4, M4).

The engine is server-side, so a refresh resumes where the learner was, and the rules hold:
- answers are accepted only for the current item (no going back);
- a section clock, when the blueprint has one, ends the section by itself (remaining items are skipped);
- per-item timers (speaking and writing, from Pearson's published timings) run in the browser, which auto-submits.
State lives on public.test_sessions and only the service role writes it (see migration 20261122000008).
"""

import json
import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.evaluation.bands import ratio_to_band
from app.core.errors import AppError
from app.db.session import service_session
from app.services import practice, review
from app.services.evaluate import EVALUATED


async def blueprints(session: AsyncSession) -> list[dict[str, Any]]:
    rows = (
        (
            await session.execute(
                text(
                    "select code, name, kind, spec, verified from public.blueprints where status = 'published' "
                    "order by sort_order, code"
                )
            )
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]


async def _blueprint(session: AsyncSession, code: str) -> dict[str, Any]:
    row = (
        (
            await session.execute(
                text(
                    "select code, version, name, kind, spec from public.blueprints "
                    "where code = :c and status = 'published'"
                ),
                {"c": code},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "blueprint_not_found", "This test was not found.")
    return dict(row)


async def _pick(session: AsyncSession, task_type: str, count: int, rnd: random.Random) -> list[str]:
    ids = [
        str(r[0])
        for r in (
            await session.execute(
                text(
                    "select q.id from public.questions q join public.question_categories c on c.id = q.category_id "
                    "where c.code = :t and q.status = 'published' and q.deleted_at is null order by q.external_id"
                ),
                {"t": task_type},
            )
        ).all()
    ]
    if len(ids) < count:
        raise AppError(409, "not_enough_questions", f"Not enough {task_type} questions for this test.")
    rnd.shuffle(ids)
    return ids[:count]


def _deadline(section: dict[str, Any], now: datetime) -> datetime | None:
    minutes = section.get("clock_minutes")
    return now + timedelta(minutes=float(minutes)) if minutes else None


async def start(session: AsyncSession, user_id: str, code: str, seed: int | None = None) -> uuid.UUID:
    """Start a test, or return the one already in progress for the same blueprint (resume)."""
    existing = (
        await session.execute(
            text(
                "select id from public.test_sessions where user_id = :u and blueprint_code = :c "
                "and status = 'in_progress' order by started_at desc limit 1"
            ),
            {"u": user_id, "c": code},
        )
    ).scalar_one_or_none()
    if existing is not None:
        return uuid.UUID(str(existing))
    bp = await _blueprint(session, code)
    rnd = random.Random(seed)  # noqa: S311 (question order, not security)
    sections: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    for s_index, sec in enumerate(bp["spec"]["sections"]):
        begin = len(items)
        for spec_item in sec["items"]:
            for qid in await _pick(session, spec_item["type"], int(spec_item["count"]), rnd):
                items.append({"qid": qid, "type": spec_item["type"], "section": s_index})
        sections.append(
            {
                "code": sec["code"],
                "title": sec["title"],
                "clock_minutes": sec.get("clock_minutes"),
                "start": begin,
                "end": len(items),
            }
        )
    now = datetime.now(UTC)
    state = {"sections": sections, "items": items, "answers": {}, "pre_test": bp["spec"].get("pre_test", [])}
    test_id = uuid.uuid4()
    async with service_session() as s:
        await s.execute(
            text(
                "insert into public.test_sessions (id, user_id, kind, status, blueprint_version, blueprint_code, "
                "state, current_index, section_deadline) "
                "values (:id, :u, :k, 'in_progress', :v, :c, cast(:st as jsonb), 0, :d)"
            ),
            {
                "id": test_id,
                "u": user_id,
                "k": bp["kind"],
                "v": bp["version"],
                "c": code,
                "st": json.dumps(state),
                "d": _deadline(sections[0], now) if sections else None,
            },
        )
    return test_id


async def _load(session: AsyncSession, test_id: uuid.UUID) -> dict[str, Any]:
    row = (
        (
            await session.execute(
                text(
                    "select id, user_id, kind, status, blueprint_code, state, current_index, section_deadline, "
                    "result_summary, started_at, completed_at from public.test_sessions where id = :id"
                ),
                {"id": test_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:  # RLS hides other learners' tests
        raise AppError(404, "test_not_found", "Test not found.")
    return dict(row)


def _section_of(state: dict[str, Any], index: int) -> int:
    for i, s in enumerate(state["sections"]):
        if s["start"] <= index < s["end"]:
            return i
    return len(state["sections"])


def _advance(state: dict[str, Any], index: int, now: datetime) -> tuple[int, datetime | None, bool]:
    """Move past `index`. Returns the new index, the new section deadline and whether the test is finished."""
    nxt = index + 1
    if nxt >= len(state["items"]):
        return nxt, None, True
    cur, new = _section_of(state, index), _section_of(state, nxt)
    if new != cur:
        return nxt, _deadline(state["sections"][new], now), False
    return nxt, None, False


async def _save(
    test_id: uuid.UUID,
    state: dict[str, Any],
    index: int,
    deadline: datetime | None,
    keep_deadline: bool,
    finished: bool,
) -> None:
    async with service_session() as s:
        await s.execute(
            text(
                "update public.test_sessions set state = cast(:st as jsonb), current_index = :i, "
                "section_deadline = case when :keep then section_deadline else :d end, "
                "status = case when :fin then 'completed' else status end, "
                "completed_at = case when :fin then now() else completed_at end, updated_at = now() where id = :id"
            ),
            {"st": json.dumps(state), "i": index, "d": deadline, "keep": keep_deadline, "fin": finished, "id": test_id},
        )


async def _expire(t: dict[str, Any], now: datetime) -> dict[str, Any]:
    """If the section clock has run out, skip the rest of the section (auto-submit)."""
    if t["status"] != "in_progress" or t["section_deadline"] is None or now < t["section_deadline"]:
        return t
    state = t["state"]
    sec = state["sections"][_section_of(state, t["current_index"])]
    for i in range(t["current_index"], sec["end"]):
        state["answers"].setdefault(str(i), {"kind": "skipped", "reason": "time"})
    index, deadline, finished = _advance(state, sec["end"] - 1, now)
    await _save(t["id"], state, index, deadline, False, finished)
    t.update(
        state=state, current_index=index, section_deadline=deadline, status="completed" if finished else t["status"]
    )
    return t


async def _public_item(session: AsyncSession, qid: str) -> dict[str, Any]:
    row = (
        (
            await session.execute(
                text(
                    "select q.id, q.external_id, c.code, q.instructions, q.content from public.questions q "
                    "join public.question_categories c on c.id = q.category_id where q.id = :id"
                ),
                {"id": uuid.UUID(qid)},
            )
        )
        .mappings()
        .one()
    )
    options = (
        await session.execute(
            text("select label, body from public.question_options where question_id = :id order by sort_order, label"),
            {"id": row["id"]},
        )
    ).all()
    return {
        "id": str(row["id"]),
        "external_id": row["external_id"],
        "category_code": row["code"],
        "instructions": row["instructions"],
        "content": practice.public_content(row["code"], dict(row["content"])),
        "options": [{"label": o[0], "body": o[1]} for o in options],
    }


async def current(session: AsyncSession, test_id: uuid.UUID) -> dict[str, Any]:
    now = datetime.now(UTC)
    t = await _expire(await _load(session, test_id), now)
    state = t["state"]
    total = len(state["items"])
    out: dict[str, Any] = {
        "id": t["id"],
        "status": t["status"],
        "kind": t["kind"],
        "blueprint_code": t["blueprint_code"],
        "index": t["current_index"],
        "total": total,
        "pre_test": state.get("pre_test", []),
        "sections": [
            {"code": s["code"], "title": s["title"], "count": s["end"] - s["start"]} for s in state["sections"]
        ],
        "section": None,
        "item": None,
        "section_seconds_left": None,
    }
    if t["status"] == "in_progress" and t["current_index"] < total:
        s_i = _section_of(state, t["current_index"])
        sec = state["sections"][s_i]
        out["section"] = {
            "index": s_i,
            "code": sec["code"],
            "title": sec["title"],
            "position": t["current_index"] - sec["start"] + 1,
            "count": sec["end"] - sec["start"],
        }
        if t["section_deadline"] is not None:
            out["section_seconds_left"] = max(0, int((t["section_deadline"] - now).total_seconds()))
        out["item"] = await _public_item(session, state["items"][t["current_index"]]["qid"])
    return out


async def answer(
    session: AsyncSession,
    user_id: str,
    test_id: uuid.UUID,
    index: int,
    response: dict[str, Any] | None,
    evaluation_id: uuid.UUID | None,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    t = await _expire(await _load(session, test_id), now)
    if t["status"] != "in_progress":
        raise AppError(409, "test_finished", "This test has finished.")
    if index != t["current_index"]:
        raise AppError(409, "not_current", "You can only answer the current question. Going back is not allowed.")
    state = t["state"]
    item = state["items"][index]
    record: dict[str, Any] = {"kind": "skipped"}
    if evaluation_id is not None:
        if item["type"] not in EVALUATED:
            raise AppError(422, "bad_answer", "This question is marked automatically.")
        ok = (
            await session.execute(
                text(
                    "select 1 from public.evaluations where id = :e and user_id = :u and question_id = :q "
                    "and test_session_id = :t"
                ),
                {"e": evaluation_id, "u": user_id, "q": uuid.UUID(item["qid"]), "t": test_id},
            )
        ).scalar_one_or_none()
        if ok is None:
            raise AppError(422, "bad_evaluation", "This answer does not belong to this question.")
        record = {"kind": "evaluation", "evaluation_id": str(evaluation_id)}
    elif response is not None and item["type"] not in EVALUATED:
        q = (
            (
                await session.execute(
                    text("select category_id, answer from public.questions where id = :id"),
                    {"id": uuid.UUID(item["qid"])},
                )
            )
            .mappings()
            .one()
        )
        m = practice.mark(item["type"], dict(q["answer"]), response)
        await session.execute(
            text(
                "insert into public.attempts (user_id, question_id, category_id, mode, is_correct, score_ratio) "
                "values (:u, :q, :c, 'exam', :ok, :s)"
            ),
            {
                "u": user_id,
                "q": uuid.UUID(item["qid"]),
                "c": q["category_id"],
                "ok": m.is_correct,
                "s": round(m.score_ratio, 4),
            },
        )
        await review.record(session, user_id, uuid.UUID(item["qid"]), m.score_ratio, m.is_correct, now)
        record = {"kind": "objective", "score_ratio": round(m.score_ratio, 4), "is_correct": m.is_correct}
    state["answers"][str(index)] = record
    new_index, deadline, finished = _advance(state, index, now)
    await _save(
        test_id,
        state,
        new_index,
        deadline,
        deadline is None and not finished and _section_of(state, new_index) == _section_of(state, index),
        finished,
    )
    return {"index": new_index, "finished": finished}


async def abandon(session: AsyncSession, test_id: uuid.UUID) -> None:
    t = await _load(session, test_id)
    if t["status"] == "in_progress":
        async with service_session() as s:
            await s.execute(
                text("update public.test_sessions set status = 'abandoned', updated_at = now() where id = :id"),
                {"id": test_id},
            )


# ---------- report ----------


def _band(ratio: float | None) -> str | None:
    return ratio_to_band(ratio) if ratio is not None else None


def _mean(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 4) if values else None


async def report(session: AsyncSession, test_id: uuid.UUID) -> dict[str, Any]:
    t = await _load(session, test_id)
    if t["status"] != "completed":
        raise AppError(409, "not_finished", "Finish the test to see the report.")
    if t["result_summary"].get("ready"):
        return dict(t["result_summary"])
    state = t["state"]
    eval_ids = [a["evaluation_id"] for a in state["answers"].values() if a.get("kind") == "evaluation"]
    evals: dict[str, Any] = {}
    if eval_ids:
        for r in (
            await session.execute(
                text("select id::text, status, score_ratio, result from public.evaluations where id = any(:ids)"),
                {"ids": [uuid.UUID(e) for e in eval_ids]},
            )
        ).mappings():
            evals[r["id"]] = r
    cats = {
        r[0]: (r[1], list(r[2]))
        for r in (
            await session.execute(text("select code, name, skills::text[] from public.question_categories"))
        ).all()
    }
    pending = 0
    by_type: dict[str, list[float]] = {}
    by_skill: dict[str, list[float]] = {}
    by_section: dict[str, list[float]] = {}
    by_criterion: dict[str, list[float]] = {}
    for i, item in enumerate(state["items"]):
        a = state["answers"].get(str(i), {"kind": "skipped"})
        ratio: float | None = 0.0
        if a["kind"] == "objective":
            ratio = float(a["score_ratio"])
        elif a["kind"] == "evaluation":
            e = evals.get(a["evaluation_id"])
            if e is None or e["status"] in ("queued", "running"):
                pending += 1
                ratio = None
            elif e["status"] == "done":
                ratio = float(e["score_ratio"] or 0)
                for c in (e["result"] or {}).get("criteria", []):
                    by_criterion.setdefault(c["name"], []).append(float(c.get("signals", {}).get("ratio", 0)))
        if ratio is None:
            continue
        by_type.setdefault(item["type"], []).append(ratio)
        by_section.setdefault(state["sections"][item["section"]]["code"], []).append(ratio)
        for skill in cats.get(item["type"], ("", []))[1]:
            by_skill.setdefault(skill, []).append(ratio)

    def rows(d: dict[str, list[float]], names: dict[str, str] | None = None) -> list[dict[str, Any]]:
        out = []
        for k, v in d.items():
            m = _mean(v)
            out.append({"code": k, "name": (names or {}).get(k, k), "ratio": m, "band": _band(m), "items": len(v)})
        return out

    type_rows = rows(by_type, {k: v[0] for k, v in cats.items()})
    lost = sorted(type_rows, key=lambda r: (1 - (r["ratio"] or 0)) * r["items"], reverse=True)[:5]
    overall = _mean([x for v in by_type.values() for x in v])
    previous = [
        {"id": str(r[0]), "completed_at": r[1].isoformat() if r[1] else None, "overall_ratio": r[2]}
        for r in (
            await session.execute(
                text(
                    "select id, completed_at, (result_summary->>'overall_ratio')::float from public.test_sessions "
                    "where user_id = :u and blueprint_code = :c and status = 'completed' and id <> :id "
                    "and result_summary ? 'overall_ratio' order by completed_at desc limit 5"
                ),
                {"u": t["user_id"], "c": t["blueprint_code"], "id": test_id},
            )
        ).all()
    ]
    summary = {
        "ready": pending == 0,
        "pending_evaluations": pending,
        "overall_ratio": overall,
        "overall_band": _band(overall),
        "by_section": rows(by_section, {s["code"]: s["title"] for s in state["sections"]}),
        "by_skill": rows(by_skill),
        "by_type": type_rows,
        "by_criterion": rows(by_criterion),
        "most_lost": lost,
        "previous": previous,
        "answered": sum(1 for a in state["answers"].values() if a.get("kind") != "skipped"),
        "skipped": sum(1 for a in state["answers"].values() if a.get("kind") == "skipped"),
        "total": len(state["items"]),
        "disclaimer": "Practice estimate. Not an official PTE score.",
    }
    if summary["ready"]:
        async with service_session() as s:
            await s.execute(
                text("update public.test_sessions set result_summary = cast(:r as jsonb) where id = :id"),
                {"r": json.dumps(summary), "id": test_id},
            )
    return summary

"""Administration (M7): content review workflow, reports, uploads, users, blueprints, usage, calibration.

Content work runs as the signed-in staff member (`user_session`, RLS applies). Things RLS cannot do on purpose
(changing roles, writing the audit log, counting usage across all users) use `service_session`, always after
`require_role` has checked the caller.
"""

import json
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.interfaces.types import Band
from app.core.errors import AppError
from app.db.session import service_session
from app.services.content_rules import check_question

ROLES = ("content_editor", "admin")
BANDS: tuple[Band, ...] = ("needs_work", "developing", "good", "strong")
# Numeric 10-90 estimates stay off (SPEC 7.3). These are the minimums before anyone may even consider them.
CALIBRATION_MIN_RATINGS = 30
CALIBRATION_MIN_EXACT = 0.6
CALIBRATION_MIN_ADJACENT = 0.8


async def audit(
    actor: str, action: str, table: str | None, target: uuid.UUID | str | None, details: dict[str, Any]
) -> None:
    async with service_session() as s:
        await s.execute(
            text(
                "insert into public.audit_log (actor_id, action, target_table, target_id, details) "
                "values (:a, :act, :t, :id, cast(:d as jsonb))"
            ),
            {"a": actor, "act": action, "t": table, "id": str(target) if target else None, "d": json.dumps(details)},
        )


# ---------- Overview and usage ----------


async def overview(session: AsyncSession, is_admin: bool) -> dict[str, Any]:
    by_status = await session.execute(
        text("select status::text, origin, count(*) from public.questions where deleted_at is null group by 1, 2")
    )
    content: dict[str, int] = {}
    ai_waiting = 0
    for status, origin, n in by_status.all():
        content[status] = content.get(status, 0) + int(n)
        if origin == "ai" and status != "published":
            ai_waiting += int(n)
    reports = (
        await session.execute(text("select count(*) from public.content_reports where status = 'open'"))
    ).scalar_one()
    out: dict[str, Any] = {"content": content, "ai_waiting_review": ai_waiting, "open_reports": int(reports)}
    if is_admin:
        out["usage"] = await usage()
    return out


async def usage() -> dict[str, Any]:
    async with service_session() as s:
        users = (await s.execute(text("select count(*) from auth.users"))).scalar_one()
        active = (
            await s.execute(
                text(
                    "select count(distinct user_id) from public.attempts where created_at >= now() - interval '7 days'"
                )
            )
        ).scalar_one()
        ai = await s.execute(
            text(
                "select feature, provider, count(*) from public.ai_usage "
                "where created_at >= now() - interval '7 days' group by 1, 2 order by 1, 2"
            )
        )
        queue = await s.execute(text("select status, count(*) from public.evaluations group by 1"))
        failed = await s.execute(
            text(
                "select count(*) from public.evaluations where status = 'failed' "
                "and created_at >= now() - interval '7 days'"
            )
        )
        return {
            "users": int(users),
            "active_7d": int(active),
            "ai_7d": [{"feature": f, "provider": p, "count": int(n)} for f, p, n in ai.all()],
            "evaluation_queue": {st: int(n) for st, n in queue.all()},
            "failed_7d": int(failed.scalar_one()),
        }


# ---------- Content ----------

QUESTION_LIST = """
select q.id, q.external_id, c.code, q.difficulty::text, q.status::text, q.origin, q.version, q.updated_at,
       left(q.instructions, 120),
       (select count(*) from public.content_reports r where r.question_id = q.id and r.status = 'open')
from public.questions q join public.question_categories c on c.id = q.category_id
where q.deleted_at is null
  and (cast(:status as text) is null or q.status::text = :status)
  and (cast(:category as text) is null or c.code = :category)
  and (cast(:search as text) is null or q.external_id ilike :like or q.instructions ilike :like)
order by q.updated_at desc, q.external_id limit :limit offset :offset
"""


async def list_questions(
    session: AsyncSession, status: str | None, category: str | None, search: str | None, limit: int, offset: int
) -> list[dict[str, Any]]:
    rows = await session.execute(
        text(QUESTION_LIST),
        {
            "status": status,
            "category": category,
            "search": search or None,
            "like": f"%{search}%" if search else None,
            "limit": max(1, min(limit, 200)),
            "offset": max(0, offset),
        },
    )
    keys = (
        "id",
        "external_id",
        "category",
        "difficulty",
        "status",
        "origin",
        "version",
        "updated_at",
        "instructions",
        "open_reports",
    )
    return [dict(zip(keys, r, strict=True)) for r in rows.all()]


async def _question(session: AsyncSession, qid: uuid.UUID) -> dict[str, Any]:
    row = (
        await session.execute(
            text(
                "select q.id, q.external_id, c.code, q.difficulty::text, q.status::text, q.origin, q.version, "
                "q.instructions, q.content, q.answer, q.explanation, q.learning_objective, q.scoring_criteria, "
                "q.key_points, q.created_by "
                "from public.questions q join public.question_categories c on c.id = q.category_id "
                "where q.id = :id and q.deleted_at is null"
            ),
            {"id": qid},
        )
    ).first()
    if row is None:
        raise AppError(404, "not_found", "Question not found.")
    keys = (
        "id",
        "external_id",
        "category",
        "difficulty",
        "status",
        "origin",
        "version",
        "instructions",
        "content",
        "answer",
        "explanation",
        "learning_objective",
        "scoring_criteria",
        "key_points",
        "created_by",
    )
    q = dict(zip(keys, row, strict=True))
    opts = await session.execute(
        text("select label, body, is_correct from public.question_options where question_id = :id order by sort_order"),
        {"id": qid},
    )
    q["options"] = [{"label": a, "body": b, "is_correct": c} for a, b, c in opts.all()]
    return q


async def get_question(session: AsyncSession, qid: uuid.UUID) -> dict[str, Any]:
    q = await _question(session, qid)
    reviews = await session.execute(
        text(
            "select r.version, r.decision, r.note, r.created_at, r.reviewer_id = q.created_by "
            "from public.content_reviews r join public.questions q on q.id = r.question_id "
            "where r.question_id = :id order by r.created_at desc"
        ),
        {"id": qid},
    )
    q["reviews"] = [
        {"version": v, "decision": d, "note": n, "created_at": at, "by_author": bool(own)}
        for v, d, n, at, own in reviews.all()
    ]
    reports = await session.execute(
        text(
            "select id, reason, message, status, created_at from public.content_reports "
            "where question_id = :id order by created_at desc limit 50"
        ),
        {"id": qid},
    )
    q["reports"] = [
        {"id": i, "reason": r, "message": m, "status": s, "created_at": at} for i, r, m, s, at in reports.all()
    ]
    return q


def _as_item(q: dict[str, Any]) -> dict[str, Any]:
    return {
        "external_id": q["external_id"],
        "category": q["category"],
        "difficulty": q["difficulty"],
        "instructions": q["instructions"],
        "content": q["content"],
        "answer": q["answer"],
        "options": q["options"],
        "explanation": q["explanation"],
        "learning_objective": q["learning_objective"],
        "scoring_criteria": list(q["scoring_criteria"] or []),
        "key_points": list(q["key_points"] or []),
    }


async def _categories(session: AsyncSession) -> set[str]:
    return {r[0] for r in (await session.execute(text("select code from public.question_categories"))).all()}


async def update_question(session: AsyncSession, actor: str, qid: uuid.UUID, changes: dict[str, Any]) -> dict[str, Any]:
    q = await _question(session, qid)
    item = {**_as_item(q), **changes}
    problems = check_question(item, await _categories(session))
    if problems:
        raise AppError(422, "invalid_question", "; ".join(problems))
    # Any edit sends the question back for review; the database bumps the version.
    status = "ai_generated" if q["origin"] == "ai" else "draft"
    await session.execute(
        text(
            "update public.questions set instructions = :i, content = cast(:c as jsonb), answer = cast(:a as jsonb), "
            "explanation = :e, difficulty = cast(:d as public.difficulty), status = cast(:s as public.content_status) "
            "where id = :id"
        ),
        {
            "i": item["instructions"],
            "c": json.dumps(item["content"]),
            "a": json.dumps(item["answer"]),
            "e": item["explanation"],
            "d": item["difficulty"],
            "s": status,
            "id": qid,
        },
    )
    await audit(actor, "question.edit", "questions", qid, {"fields": sorted(changes)})
    return await get_question(session, qid)


async def review_question(
    session: AsyncSession, actor: str, qid: uuid.UUID, decision: str, note: str
) -> dict[str, Any]:
    q = await _question(session, qid)
    if q["origin"] == "ai" and decision == "approve" and q["created_by"] and str(q["created_by"]) == actor:
        raise AppError(409, "own_ai_content", "AI-drafted content must be approved by a different staff member.")
    await session.execute(
        text(
            "insert into public.content_reviews (question_id, version, reviewer_id, decision, note) "
            "values (:q, :v, :r, :d, :n)"
        ),
        {"q": qid, "v": q["version"], "r": actor, "d": decision, "n": note},
    )
    if q["status"] != "published":
        new = "reviewed" if decision == "approve" else ("ai_generated" if q["origin"] == "ai" else "draft")
        await session.execute(
            text("update public.questions set status = cast(:s as public.content_status) where id = :id"),
            {"s": new, "id": qid},
        )
    await audit(actor, f"question.review.{decision}", "questions", qid, {"version": q["version"]})
    return await get_question(session, qid)


async def set_status(session: AsyncSession, actor: str, qid: uuid.UUID, status: str) -> dict[str, Any]:
    await _question(session, qid)
    try:
        async with session.begin_nested():
            await session.execute(
                text("update public.questions set status = cast(:s as public.content_status) where id = :id"),
                {"s": status, "id": qid},
            )
    except DBAPIError as exc:
        if "publish_needs_approval" in str(exc):
            raise AppError(
                409, "publish_needs_approval", "A staff member must approve this version before it is published."
            ) from exc
        raise
    await audit(actor, f"question.status.{status}", "questions", qid, {})
    return await get_question(session, qid)


async def upload(
    session: AsyncSession, actor: str, filename: str, origin: str, items: list[dict[str, Any]]
) -> dict[str, Any]:
    """Create new questions from an uploaded content file. They start as draft (or ai_generated): never published."""
    cats = await _categories(session)
    existing = {r[0] for r in (await session.execute(text("select external_id from public.questions"))).all()}
    errors: list[dict[str, Any]] = []
    created = 0
    status = "ai_generated" if origin == "ai" else "draft"
    for n, item in enumerate(items, start=1):
        ext = str(item.get("external_id", ""))
        problems = check_question(item, cats) if isinstance(item, dict) else ["not an object"]
        if ext in existing:
            problems.append(f"external_id {ext} already exists")
        if problems:
            errors.append({"row": n, "external_id": ext, "problems": problems})
            continue
        qid = uuid.uuid4()
        await session.execute(
            text(
                "insert into public.questions (id, external_id, category_id, difficulty, instructions, content, "
                "answer, explanation, learning_objective, scoring_criteria, key_points, status, origin, created_by, "
                "source) select :id, :ext, c.id, cast(:d as public.difficulty), :i, cast(:c as jsonb), "
                "cast(:a as jsonb), :e, :lo, :sc, :kp, cast(:s as public.content_status), :o, :by, :src "
                "from public.question_categories c where c.code = :cat"
            ),
            {
                "id": qid,
                "ext": ext,
                "d": item["difficulty"],
                "i": item["instructions"],
                "c": json.dumps(item.get("content", {})),
                "a": json.dumps(item.get("answer", {})),
                "e": item["explanation"],
                "lo": item["learning_objective"],
                "sc": list(item.get("scoring_criteria", [])),
                "kp": list(item.get("key_points", [])),
                "s": status,
                "o": origin,
                "by": actor,
                "src": "ai-draft" if origin == "ai" else "original",
                "cat": item["category"],
            },
        )
        for order, opt in enumerate(item.get("options", []), start=1):
            await session.execute(
                text(
                    "insert into public.question_options (question_id, label, body, is_correct, sort_order) "
                    "values (:q, :l, :b, :c, :o)"
                ),
                {"q": qid, "l": opt["label"], "b": opt["body"], "c": bool(opt.get("is_correct")), "o": order},
            )
        existing.add(ext)
        created += 1
    await session.execute(
        text(
            "insert into public.content_uploads (uploaded_by, filename, origin, created_count, errors) "
            "values (:u, :f, :o, :n, cast(:e as jsonb))"
        ),
        {"u": actor, "f": filename[:200], "o": origin, "n": created, "e": json.dumps(errors)},
    )
    await audit(actor, "content.upload", "content_uploads", None, {"created": created, "errors": len(errors)})
    return {"created": created, "status": status, "errors": errors}


async def export_questions(session: AsyncSession, status: str) -> dict[str, Any]:
    """Questions in the content-file shape, so reviewed work can be committed to content/questions/."""
    ids = await session.execute(
        text("select id from public.questions where status::text = :s and deleted_at is null order by external_id"),
        {"s": status},
    )
    out = []
    for (qid,) in ids.all():
        q = await _question(session, qid)
        out.append({**_as_item(q), "status": q["status"]})
    return {"_licence": "CC-BY-SA-4.0", "questions": out}


# ---------- Reports ----------


async def create_report(session: AsyncSession, user_id: str, qid: uuid.UUID, reason: str, message: str) -> uuid.UUID:
    ok = (
        await session.execute(
            text("select 1 from public.questions where id = :id and status = 'published'"), {"id": qid}
        )
    ).first()
    if ok is None:
        raise AppError(404, "not_found", "Question not found.")
    rid = (
        await session.execute(
            text(
                "insert into public.content_reports (user_id, question_id, reason, message) "
                "values (:u, :q, :r, :m) returning id"
            ),
            {"u": user_id, "q": qid, "r": reason, "m": message},
        )
    ).scalar_one()
    return uuid.UUID(str(rid))


async def list_reports(session: AsyncSession, status: str) -> list[dict[str, Any]]:
    rows = await session.execute(
        text(
            "select r.id, r.question_id, q.external_id, c.code, r.reason, r.message, r.status, r.created_at "
            "from public.content_reports r join public.questions q on q.id = r.question_id "
            "join public.question_categories c on c.id = q.category_id "
            "where r.status = :s order by r.created_at desc limit 200"
        ),
        {"s": status},
    )
    keys = ("id", "question_id", "external_id", "category", "reason", "message", "status", "created_at")
    return [dict(zip(keys, r, strict=True)) for r in rows.all()]


async def resolve_report(session: AsyncSession, actor: str, rid: uuid.UUID, status: str) -> None:
    res = await session.execute(
        text(
            "update public.content_reports set status = :s, resolved_by = :a, resolved_at = now() "
            "where id = :id returning id"
        ),
        {"s": status, "a": actor, "id": rid},
    )
    if res.first() is None:
        raise AppError(404, "not_found", "Report not found.")
    await audit(actor, f"report.{status}", "content_reports", rid, {})


# ---------- Users (admin only) ----------


async def list_users(search: str | None, limit: int) -> list[dict[str, Any]]:
    async with service_session() as s:
        rows = await s.execute(
            text(
                "select u.id, u.email, u.created_at, u.last_sign_in_at, p.display_name, "
                "array(select r.role::text from public.user_roles r where r.user_id = u.id order by 1), "
                "(select count(*) from public.attempts a where a.user_id = u.id) "
                "from auth.users u left join public.profiles p on p.id = u.id "
                "where cast(:q as text) is null or u.email ilike :like or p.display_name ilike :like "
                "order by u.created_at desc limit :n"
            ),
            {"q": search or None, "like": f"%{search}%" if search else None, "n": max(1, min(limit, 200))},
        )
        keys = ("id", "email", "created_at", "last_sign_in_at", "display_name", "roles", "attempts")
        return [dict(zip(keys, r, strict=True)) for r in rows.all()]


async def set_roles(actor: str, user_id: uuid.UUID, roles: list[str]) -> list[str]:
    wanted = sorted(set(roles))
    if any(r not in ROLES for r in wanted):
        raise AppError(422, "invalid_role", "Roles must be content_editor or admin.")
    if str(user_id) == actor and "admin" not in wanted:
        raise AppError(409, "own_admin_role", "You cannot remove your own admin role.")
    async with service_session() as s:
        exists = (await s.execute(text("select 1 from auth.users where id = :id"), {"id": user_id})).first()
        if exists is None:
            raise AppError(404, "not_found", "User not found.")
        await s.execute(
            text("delete from public.user_roles where user_id = :id and role <> 'student'"), {"id": user_id}
        )
        for r in wanted:
            await s.execute(
                text("insert into public.user_roles (user_id, role) values (:id, cast(:r as public.app_role))"),
                {"id": user_id, "r": r},
            )
    await audit(actor, "user.roles", "user_roles", user_id, {"roles": wanted})
    return ["student", *wanted]


# ---------- Blueprints (admin only) ----------


async def list_blueprints(session: AsyncSession) -> list[dict[str, Any]]:
    rows = await session.execute(
        text(
            "select code, version, name, kind, status::text, verified, spec, sort_order from public.blueprints "
            "order by sort_order, code"
        )
    )
    published = {
        code: int(n)
        for code, n in (
            await session.execute(
                text(
                    "select c.code, count(*) from public.questions q join public.question_categories c "
                    "on c.id = q.category_id where q.status = 'published' and q.deleted_at is null group by 1"
                )
            )
        ).all()
    }
    out = []
    for code, version, name, kind, status, verified, spec, order in rows.all():
        shortages = blueprint_shortages(spec, published)
        out.append(
            {
                "code": code,
                "version": version,
                "name": name,
                "kind": kind,
                "status": status,
                "verified": verified,
                "sort_order": order,
                "items": sum(n for _, n in _counts(spec)),
                "shortages": shortages,
            }
        )
    return out


def _counts(spec: dict[str, Any]) -> list[tuple[str, int]]:
    out: list[tuple[str, int]] = []
    for section in spec.get("sections", []):
        for part in section.get("items", []):
            out.append((str(part.get("type")), int(part.get("count", 0))))
    return out


def blueprint_shortages(spec: dict[str, Any], published: dict[str, int]) -> list[dict[str, Any]]:
    need: dict[str, int] = {}
    for t, n in _counts(spec):
        need[t] = need.get(t, 0) + n
    return [
        {"type": t, "needed": n, "published": published.get(t, 0)} for t, n in need.items() if published.get(t, 0) < n
    ]


async def update_blueprint(session: AsyncSession, actor: str, code: str, status: str | None, name: str | None) -> None:
    rows = await list_blueprints(session)
    bp = next((b for b in rows if b["code"] == code), None)
    if bp is None:
        raise AppError(404, "not_found", "Blueprint not found.")
    if status == "published" and bp["shortages"]:
        raise AppError(409, "not_enough_questions", "Publish more questions before publishing this mock exam.")
    await session.execute(
        text(
            "update public.blueprints set status = coalesce(cast(:s as public.content_status), status), "
            "name = coalesce(:n, name) where code = :c"
        ),
        {"s": status, "n": name, "c": code},
    )
    await audit(actor, "blueprint.update", "blueprints", None, {"code": code, "status": status, "name": name})


# ---------- Calibration (admin only) ----------


async def calibration(session: AsyncSession, actor: str) -> dict[str, Any]:
    """The admin's own finished sample evaluations, their ratings and the agreement report (RLS: own rows only)."""
    rows = await session.execute(
        text(
            "select e.id, c.code, e.response_text, e.result, e.created_at, cr.bands "
            "from public.evaluations e join public.question_categories c on c.id = e.category_id "
            "left join public.calibration_ratings cr on cr.evaluation_id = e.id and cr.rater_id = :a "
            "where e.user_id = :a and e.status = 'done' order by e.created_at desc limit 200"
        ),
        {"a": actor},
    )
    samples = []
    pairs: dict[str, list[tuple[str, str]]] = {}
    for eid, code, response, result, at, bands in rows.all():
        ai = {c["name"]: c["band"] for c in (result or {}).get("criteria", [])}
        samples.append(
            {
                "evaluation_id": eid,
                "task_type": code,
                "response": response or "",
                "ai_bands": ai,
                "human_bands": bands,
                "created_at": at,
            }
        )
        for crit, human in (bands or {}).items():
            if crit in ai:
                pairs.setdefault(code, []).append((ai[crit], human))
    return {"samples": samples, "report": agreement(pairs)}


def agreement(pairs: dict[str, list[tuple[str, str]]]) -> list[dict[str, Any]]:
    """Exact and adjacent (within one band) agreement between AI and human bands, per task type."""
    out = []
    for task, ps in sorted(pairs.items()):
        n = len(ps)
        exact = sum(1 for a, h in ps if a == h) / n
        adjacent = sum(1 for a, h in ps if abs(BANDS.index(a) - BANDS.index(h)) <= 1) / n
        meets = n >= CALIBRATION_MIN_RATINGS and exact >= CALIBRATION_MIN_EXACT and adjacent >= CALIBRATION_MIN_ADJACENT
        out.append(
            {
                "task_type": task,
                "ratings": n,
                "exact": round(exact, 4),
                "adjacent": round(adjacent, 4),
                "meets_minimum": meets,
                "numeric_estimates_enabled": False,
            }
        )
    return out


async def rate(session: AsyncSession, actor: str, evaluation_id: uuid.UUID, bands: dict[str, str]) -> None:
    if not bands or any(b not in BANDS for b in bands.values()):
        raise AppError(422, "invalid_bands", "Each rating must be one of: " + ", ".join(BANDS))
    row = (
        await session.execute(
            text(
                "select c.code from public.evaluations e join public.question_categories c on c.id = e.category_id "
                "where e.id = :id and e.user_id = :a and e.status = 'done'"
            ),
            {"id": evaluation_id, "a": actor},
        )
    ).first()
    if row is None:
        raise AppError(404, "not_found", "Sample not found. Calibration uses your own finished evaluations.")
    await session.execute(
        text(
            "insert into public.calibration_ratings (evaluation_id, rater_id, task_type, bands) "
            "values (:e, :a, :t, cast(:b as jsonb)) "
            "on conflict (evaluation_id, rater_id) do update set bands = excluded.bands, created_at = now()"
        ),
        {"e": evaluation_id, "a": actor, "t": row[0], "b": json.dumps(bands)},
    )

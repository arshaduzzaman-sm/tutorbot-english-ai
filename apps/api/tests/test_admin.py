"""M7 administration: only staff reach admin routes, AI content cannot be published without a human approval."""

import json
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.security import AuthUser
from app.db.session import service_session, user_session
from app.services import admin as svc
from tests.helpers import auth

STAFF_ROUTES = [
    ("GET", "/api/v1/admin/overview"),
    ("GET", "/api/v1/admin/questions"),
    ("GET", "/api/v1/admin/questions/export"),
    ("GET", "/api/v1/admin/reports"),
    ("POST", "/api/v1/admin/uploads"),
]
ADMIN_ROUTES = [
    ("GET", "/api/v1/admin/users"),
    ("GET", "/api/v1/admin/blueprints"),
    ("GET", "/api/v1/admin/calibration"),
    ("PUT", f"/api/v1/admin/users/{uuid.uuid4()}/roles"),
    ("PATCH", "/api/v1/admin/blueprints/mini_mock"),
]


def mcs(ext: str) -> dict:  # type: ignore[type-arg]
    return {
        "external_id": ext,
        "category": "reading_mc_single",
        "difficulty": "beginner",
        "instructions": "Read the text and choose the best answer.",
        "content": {
            "text": "Tom walks to school every day because the bus is often late.",
            "question": "Why does Tom walk?",
        },
        "options": [
            {"label": "A", "body": "The bus is often late.", "is_correct": True},
            {"label": "B", "body": "He likes the rain.", "is_correct": False},
            {"label": "C", "body": "His school is closed.", "is_correct": False},
        ],
        "answer": {"correct": ["A"]},
        "explanation": "The text says the bus is often late.",
        "learning_objective": "Find a reason stated in a short text.",
    }


async def _cleanup(prefix: str) -> None:
    async with service_session() as s:
        await s.execute(text("delete from public.questions where external_id like :p"), {"p": f"{prefix}%"})


async def test_only_staff_reach_admin_routes(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    student, editor, admin = await make_user(), await make_user(("content_editor",)), await make_user(("admin",))
    for method, path in STAFF_ROUTES + ADMIN_ROUTES:
        assert (await client.request(method, path, json={})).status_code == 401, path
        assert (await client.request(method, path, json={}, headers=auth(student.token))).status_code == 403, path
    for method, path in ADMIN_ROUTES:
        assert (await client.request(method, path, json={}, headers=auth(editor.token))).status_code == 403, path
    ov = await client.get("/api/v1/admin/overview", headers=auth(editor.token))
    assert ov.status_code == 200 and "usage" not in ov.json()
    ov = (await client.get("/api/v1/admin/overview", headers=auth(admin.token))).json()
    assert ov["content"]["published"] > 400 and ov["usage"]["users"] >= 3


async def test_ai_content_needs_a_different_reviewer_before_publishing(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    prefix = f"t-{uuid.uuid4().hex[:6]}-"
    author, reviewer = await make_user(("content_editor",)), await make_user(("content_editor",))
    try:
        bad = {**mcs(prefix + "bad"), "answer": {"correct": ["Z"]}}
        up = await client.post(
            "/api/v1/admin/uploads",
            json={"filename": "ai.json", "origin": "ai", "questions": [mcs(prefix + "1"), bad]},
            headers=auth(author.token),
        )
        assert up.status_code == 200, up.text
        body = up.json()
        assert body["created"] == 1 and body["status"] == "ai_generated" and body["errors"][0]["row"] == 2
        listed = (
            await client.get(f"/api/v1/admin/questions?status=ai_generated&search={prefix}", headers=auth(author.token))
        ).json()
        qid = listed[0]["id"]
        assert listed[0]["origin"] == "ai"

        # Students never see it; publishing without approval fails
        student = await make_user()
        q = '{ practiceQuestion(id: "%s") { id } }' % qid
        assert (await client.post("/graphql", json={"query": q}, headers=auth(student.token))).json()["data"][
            "practiceQuestion"
        ] is None
        pub = await client.post(
            f"/api/v1/admin/questions/{qid}/status", json={"status": "published"}, headers=auth(reviewer.token)
        )
        assert pub.status_code == 409 and pub.json()["error"]["code"] == "publish_needs_approval"

        # The author cannot approve their own AI draft
        own = await client.post(
            f"/api/v1/admin/questions/{qid}/review", json={"decision": "approve"}, headers=auth(author.token)
        )
        assert own.status_code == 409 and own.json()["error"]["code"] == "own_ai_content"

        ok = await client.post(
            f"/api/v1/admin/questions/{qid}/review",
            json={"decision": "approve", "note": "Checked."},
            headers=auth(reviewer.token),
        )
        assert ok.json()["status"] == "reviewed"
        pub = await client.post(
            f"/api/v1/admin/questions/{qid}/status", json={"status": "published"}, headers=auth(reviewer.token)
        )
        assert pub.status_code == 200 and pub.json()["status"] == "published"

        # Editing sends it back to review: new version, old approval no longer counts
        edit = await client.patch(
            f"/api/v1/admin/questions/{qid}",
            json={"explanation": "Line 1 gives the reason."},
            headers=auth(reviewer.token),
        )
        assert edit.status_code == 200 and edit.json()["status"] == "ai_generated" and edit.json()["version"] == 2
        pub = await client.post(
            f"/api/v1/admin/questions/{qid}/status", json={"status": "published"}, headers=auth(reviewer.token)
        )
        assert pub.status_code == 409
        invalid = await client.patch(
            f"/api/v1/admin/questions/{qid}", json={"answer": {"correct": ["Q"]}}, headers=auth(reviewer.token)
        )
        assert invalid.status_code == 422
    finally:
        await _cleanup(prefix)


async def test_database_blocks_publishing_without_approval_even_outside_the_api(make_user) -> None:  # type: ignore[no-untyped-def]
    """The rule is a database trigger, so it also holds for direct database access with a staff login."""
    prefix = f"t-{uuid.uuid4().hex[:6]}-"
    editor = await make_user(("content_editor",))
    user = AuthUser(
        id=editor.id, email=editor.email, role="authenticated", claims={"sub": editor.id, "role": "authenticated"}
    )
    try:
        async with user_session(user) as s:
            out = await svc.upload(s, editor.id, "x.json", "ai", [mcs(prefix + "1")])
            assert out["created"] == 1
        with pytest.raises(Exception, match="publish_needs_approval"):
            async with user_session(user) as s:
                await s.execute(
                    text("update public.questions set status = 'published' where external_id = :e"), {"e": prefix + "1"}
                )
        with pytest.raises(Exception, match="publish_needs_approval"):
            async with user_session(user) as s:
                await s.execute(
                    text(
                        "insert into public.questions (external_id, category_id, difficulty, instructions, status, origin) "
                        "select :e, id, 'beginner', 'x', 'published', 'ai' from public.question_categories limit 1"
                    ),
                    {"e": prefix + "2"},
                )
    finally:
        await _cleanup(prefix)


async def test_reports_flow(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    student, editor = await make_user(), await make_user(("content_editor",))
    async with service_session() as s:
        qid = (await s.execute(text("select id from public.questions where status = 'published' limit 1"))).scalar_one()
    r = await client.post(
        f"/api/v1/questions/{qid}/reports",
        json={"reason": "typo", "message": "Second line: 'teh'."},
        headers=auth(student.token),
    )
    assert r.status_code == 201
    rid = r.json()["id"]
    try:
        reports = (await client.get("/api/v1/admin/reports", headers=auth(editor.token))).json()
        assert any(x["id"] == rid and x["reason"] == "typo" for x in reports)
        done = await client.post(
            f"/api/v1/admin/reports/{rid}", json={"status": "resolved"}, headers=auth(editor.token)
        )
        assert done.status_code == 204
        missing = await client.post(
            f"/api/v1/questions/{uuid.uuid4()}/reports", json={"reason": "typo"}, headers=auth(student.token)
        )
        assert missing.status_code == 404
    finally:
        async with service_session() as s:
            await s.execute(text("delete from public.content_reports where id = :id"), {"id": rid})


async def test_admin_manages_roles_and_audit_log(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    admin, learner = await make_user(("admin",)), await make_user()
    h = auth(admin.token)
    users = (await client.get(f"/api/v1/admin/users?search={learner.email}", headers=h)).json()
    assert [u["id"] for u in users] == [learner.id] and users[0]["roles"] == ["student"]
    r = await client.put(f"/api/v1/admin/users/{learner.id}/roles", json={"roles": ["content_editor"]}, headers=h)
    assert r.json() == {"roles": ["student", "content_editor"]}
    assert (await client.get("/api/v1/admin/overview", headers=auth(learner.token))).status_code == 200
    self_demote = await client.put(f"/api/v1/admin/users/{admin.id}/roles", json={"roles": []}, headers=h)
    assert self_demote.status_code == 409
    async with service_session() as s:
        logged = (
            await s.execute(
                text("select count(*) from public.audit_log where actor_id = :a and action = 'user.roles'"),
                {"a": admin.id},
            )
        ).scalar_one()
    assert logged == 1


async def test_blueprint_management(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    admin = await make_user(("admin",))
    h = auth(admin.token)
    bps = {b["code"]: b for b in (await client.get("/api/v1/admin/blueprints", headers=h)).json()}
    assert bps["full_mock"]["items"] == 72 and bps["full_mock"]["shortages"] == []
    assert svc.blueprint_shortages(
        {"sections": [{"items": [{"type": "read_aloud", "count": 9}]}]}, {"read_aloud": 3}
    ) == [{"type": "read_aloud", "needed": 9, "published": 3}]
    try:
        assert (
            await client.patch("/api/v1/admin/blueprints/mini_mock", json={"status": "draft"}, headers=h)
        ).status_code == 204
        learner = await make_user()
        listed = (
            await client.post("/graphql", json={"query": "{ blueprints { code } }"}, headers=auth(learner.token))
        ).json()
        assert "mini_mock" not in [b["code"] for b in listed["data"]["blueprints"]]
    finally:
        await client.patch("/api/v1/admin/blueprints/mini_mock", json={"status": "published"}, headers=h)


def test_calibration_agreement() -> None:
    pairs = {"write_essay": [("good", "good"), ("good", "strong"), ("needs_work", "strong")]}
    rep = svc.agreement(pairs)[0]
    assert rep["ratings"] == 3 and rep["exact"] == 0.3333 and rep["adjacent"] == 0.6667
    assert rep["meets_minimum"] is False and rep["numeric_estimates_enabled"] is False
    many = svc.agreement({"write_essay": [("good", "good")] * 30})[0]
    assert many["meets_minimum"] is True and many["numeric_estimates_enabled"] is False  # still a manual decision


async def test_calibration_uses_only_own_samples(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    admin, learner = await make_user(("admin",)), await make_user()
    result = {"criteria": [{"name": "content", "band": "good"}, {"name": "form", "band": "strong"}]}
    async with service_session() as s:
        ids = []
        for uid in (admin.id, learner.id):
            ids.append(
                (
                    await s.execute(
                        text(
                            "insert into public.evaluations (user_id, category_id, response_text, status, result) "
                            "select :u, id, 'Sample essay.', 'done', cast(:r as jsonb) from public.question_categories "
                            "where code = 'write_essay' returning id"
                        ),
                        {"u": uid, "r": json.dumps(result)},
                    )
                ).scalar_one()
            )
    h = auth(admin.token)
    data = (await client.get("/api/v1/admin/calibration", headers=h)).json()
    assert [s["evaluation_id"] for s in data["samples"]] == [str(ids[0])]
    r = await client.put(
        f"/api/v1/admin/calibration/{ids[0]}", json={"bands": {"content": "good", "form": "good"}}, headers=h
    )
    assert r.status_code == 204
    other = await client.put(f"/api/v1/admin/calibration/{ids[1]}", json={"bands": {"content": "good"}}, headers=h)
    assert other.status_code == 404  # a learner's answer is never used
    rep = (await client.get("/api/v1/admin/calibration", headers=h)).json()["report"][0]
    assert rep == {
        "task_type": "write_essay",
        "ratings": 2,
        "exact": 0.5,
        "adjacent": 1.0,
        "meets_minimum": False,
        "numeric_estimates_enabled": False,
    }

"""Integration tests against the local Supabase database (RLS, GraphQL permissions, onboarding, account)."""

import json
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.db.session import service_session
from tests.helpers import auth

pytestmark = pytest.mark.integration

DASHBOARD = """
query Dashboard {
  viewer {
    id email roles demoMode
    profile { displayName targetScore dailyGoalMinutes onboardingCompleted level { code name cefr } }
    progress { lessonsCompleted lessonsTotal overallRatio skills { skill attempts accuracy } }
    streakDays todayMinutes
    recentAttempts(limit: 5) { id isCorrect scoreRatio category { code name } }
    recommendedLessons(limit: 3) { slug title level { code } }
    weakAreas { accuracy attempts category { code } }
    mockExams { id kind status }
  }
}"""


async def _rls_query(user_id: str | None, sql: str, params: dict | None = None) -> list:
    """Run SQL as `authenticated` (or `anon` when user_id is None), exactly like the API does."""
    async with service_session() as s:
        if user_id:
            await s.execute(text("set local role authenticated"))
            claims = json.dumps({"sub": user_id, "role": "authenticated"})
            await s.execute(text("select set_config('request.jwt.claims', :c, true)"), {"c": claims})
        else:
            await s.execute(text("set local role anon"))
        return list((await s.execute(text(sql), params or {})).all())


async def _category_id(code: str) -> str:
    async with service_session() as s:
        return str((await s.execute(text("select id from question_categories where code=:c"), {"c": code})).scalar())


async def _add_attempts(user_id: str, items: list[tuple[str, bool]]) -> None:
    async with service_session() as s:
        for code, correct in items:
            await s.execute(
                text(
                    "insert into attempts (user_id, question_id, category_id, is_correct, duration_seconds) "
                    "select :u, q.id, q.category_id, :ok, 60 from questions q join question_categories c "
                    "on c.id=q.category_id where c.code=:code limit 1"
                ),
                {"u": user_id, "code": code, "ok": correct},
            )


# ---------------- RLS ----------------


async def test_signup_trigger_creates_profile_and_student_role(make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    rows = await _rls_query(
        u.id,
        "select p.display_name, p.age_confirmed_at is not null, r.role::text "
        "from profiles p join user_roles r on r.user_id = p.id",
    )
    assert rows == [("Test Learner", True, "student")]


async def test_rls_user_cannot_read_or_change_another_users_data(make_user) -> None:  # type: ignore[no-untyped-def]
    a, b = await make_user(), await make_user()
    await _add_attempts(b.id, [("read_aloud", True)])
    # A sees only their own profile and none of B's rows.
    assert [str(r[0]) for r in await _rls_query(a.id, "select id from profiles")] == [a.id]
    for table in ("attempts", "learning_progress", "consents", "test_sessions", "ai_usage", "user_roles"):
        rows = await _rls_query(a.id, f"select count(*) from {table} where user_id = :b", {"b": b.id})  # noqa: S608
        assert rows[0][0] == 0, table
    # B can see their own attempt (proves the row exists).
    assert (await _rls_query(b.id, "select count(*) from attempts"))[0][0] == 1
    # A cannot update B's profile (0 rows affected) ...
    await _rls_query(a.id, "update profiles set target_score = 10 where id = :b returning id", {"b": b.id})
    assert (await _rls_query(b.id, "select target_score from profiles"))[0][0] is None
    # ... and cannot insert data on B's behalf.
    with pytest.raises(Exception, match="row-level security"):
        await _rls_query(
            a.id, "insert into attempts (user_id, lesson_id) select :b, id from lessons limit 1", {"b": b.id}
        )


async def test_rls_blocks_role_escalation_and_anon(make_user) -> None:  # type: ignore[no-untyped-def]
    a = await make_user()
    with pytest.raises(Exception, match="permission denied"):
        await _rls_query(a.id, "insert into user_roles (user_id, role) values (:a, 'admin')", {"a": a.id})
    with pytest.raises(Exception, match="permission denied"):
        await _rls_query(None, "select * from profiles")
    assert (await _rls_query(a.id, "select count(*) from audit_log"))[0][0] == 0
    assert (await _rls_query(None, "select count(*) from learning_levels"))[0][0] == 6


async def test_rls_hides_unpublished_content_from_students(make_user) -> None:  # type: ignore[no-untyped-def]
    a, editor = await make_user(), await make_user(roles=("content_editor",))
    slug = f"draft-{uuid.uuid4().hex[:8]}"
    async with service_session() as s:
        await s.execute(
            text(
                "insert into lessons (slug, learning_level_id, title, status) "
                "select :s, id, 'Draft', 'draft' from learning_levels where code = 1"
            ),
            {"s": slug},
        )
    try:
        assert (await _rls_query(a.id, "select count(*) from lessons where slug=:s", {"s": slug}))[0][0] == 0
        assert (await _rls_query(editor.id, "select count(*) from lessons where slug=:s", {"s": slug}))[0][0] == 1
    finally:
        async with service_session() as s:
            await s.execute(text("delete from lessons where slug=:s"), {"s": slug})


# ---------------- GraphQL ----------------


async def test_dashboard_single_query_for_new_user_has_empty_states(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    r = await client.post("/graphql", json={"query": DASHBOARD}, headers=auth(u.token))
    assert r.status_code == 200
    body = r.json()
    assert "errors" not in body, body
    v = body["data"]["viewer"]
    assert v["id"] == u.id and v["roles"] == ["student"] and v["demoMode"] is True
    assert v["profile"]["onboardingCompleted"] is False and v["profile"]["level"] is None
    assert v["progress"]["lessonsCompleted"] == 0 and v["progress"]["lessonsTotal"] >= 5
    assert all(s["attempts"] == 0 and s["accuracy"] is None for s in v["progress"]["skills"])
    assert v["streakDays"] == 0 and v["todayMinutes"] == 0
    assert v["recentAttempts"] == [] and v["weakAreas"] == [] and v["mockExams"] == []
    assert len(v["recommendedLessons"]) == 3


async def test_dashboard_shows_only_own_real_data(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    a, b = await make_user(), await make_user()
    await _add_attempts(a.id, [("reading_mc_single", False)] * 3 + [("write_from_dictation", True)])
    await _add_attempts(b.id, [("read_aloud", True)] * 7)
    v = (await client.post("/graphql", json={"query": DASHBOARD}, headers=auth(a.token))).json()["data"]["viewer"]
    assert len(v["recentAttempts"]) == 4
    assert {x["category"]["code"] for x in v["recentAttempts"]} == {"reading_mc_single", "write_from_dictation"}
    skills = {s["skill"]: s for s in v["progress"]["skills"]}
    assert skills["READING"]["attempts"] == 3 and skills["READING"]["accuracy"] == 0.0
    assert skills["LISTENING"]["accuracy"] == 1.0 and skills["SPEAKING"]["attempts"] == 0
    assert [w["category"]["code"] for w in v["weakAreas"]] == ["reading_mc_single"]
    assert v["streakDays"] == 1 and v["todayMinutes"] == 4


async def test_graphql_cannot_select_other_users_by_id(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    a = await make_user()
    r = await client.post("/graphql", json={"query": '{ viewer(id: "x") { id } }'}, headers=auth(a.token))
    assert r.json()["errors"]  # there is no way to ask for another user's viewer


async def test_dataloader_batches_category_lookups(app, make_user) -> None:  # type: ignore[no-untyped-def]
    from app.core.security import AuthUser
    from app.db.session import user_session
    from app.graphql.context import Context
    from app.graphql.schema import build_schema

    u = await make_user()
    await _add_attempts(
        u.id,
        [
            (c, True)
            for c in ("read_aloud", "write_essay", "reorder_paragraphs", "select_missing_word", "describe_image")
        ],
    )
    user = AuthUser(id=u.id, email=u.email, role="authenticated", claims={"sub": u.id, "role": "authenticated"})
    async with user_session(user) as session:
        ctx = Context(user, session)
        res = await build_schema().execute("{ viewer { recentAttempts { category { code } } } }", context_value=ctx)
    assert not res.errors
    assert len(res.data["viewer"]["recentAttempts"]) == 5
    assert ctx.query_count == 2  # 1 for attempts + 1 batched for all 5 categories (no N+1)


# ---------------- REST: onboarding, roles, export, delete ----------------


async def test_onboarding_saves_level_and_target_to_profiles(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    r = await client.put(
        "/api/v1/me/onboarding",
        headers=auth(u.token),
        json={"level_code": 4, "target_score": 79, "daily_goal_minutes": 60},
    )
    assert r.status_code == 200, r.text
    assert r.json()["onboarding_completed"] is True
    async with service_session() as s:
        row = (
            await s.execute(
                text(
                    "select l.code, p.target_score, p.daily_goal_minutes, p.onboarding_completed_at "
                    "from profiles p join learning_levels l on l.id = p.learning_level_id "
                    "where p.id = :id"
                ),
                {"id": u.id},
            )
        ).one()
    assert row[0] == 4 and row[1] == 79 and row[2] == 60 and row[3] is not None


@pytest.mark.parametrize(
    "body",
    [
        {"level_code": 7, "target_score": 50},
        {"level_code": 1, "target_score": 95},
        {"level_code": 1, "target_score": 50, "daily_goal_minutes": 45},
        {"level_code": 1, "target_score": 50, "exam_date": "2000-01-01"},
    ],
)
async def test_onboarding_validation(client: AsyncClient, make_user, body: dict) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    r = await client.put("/api/v1/me/onboarding", headers=auth(u.token), json=body)
    assert r.status_code == 422


async def test_role_check(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    student, admin = await make_user(), await make_user(roles=("admin",))
    assert (await client.get("/api/v1/me/admin-check", headers=auth(student.token))).status_code == 403
    assert (await client.get("/api/v1/me/admin-check", headers=auth(admin.token))).status_code == 200


async def test_export_contains_only_own_data(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    a, b = await make_user(), await make_user()
    await _add_attempts(a.id, [("read_aloud", True)])
    await _add_attempts(b.id, [("read_aloud", True)] * 2)
    data = (await client.get("/api/v1/me/export", headers=auth(a.token))).json()
    assert data["user_id"] == a.id and len(data["profiles"]) == 1 and len(data["attempts"]) == 1
    assert all(row["user_id"] == a.id for row in data["attempts"])


async def test_account_deletion_removes_everything(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    await _add_attempts(u.id, [("read_aloud", True)])
    assert (await client.request("DELETE", "/api/v1/me", headers=auth(u.token), json={})).status_code == 422
    r = await client.request("DELETE", "/api/v1/me", headers=auth(u.token), json={"confirm": "DELETE"})
    assert r.status_code == 204
    async with service_session() as s:
        for table, col in (
            ("auth.users", "id"),
            ("profiles", "id"),
            ("attempts", "user_id"),
            ("user_roles", "user_id"),
        ):
            n = (await s.execute(text(f"select count(*) from {table} where {col} = :id"), {"id": u.id})).scalar()  # noqa: S608
            assert n == 0, table
        logged = (
            await s.execute(
                text("select count(*) from audit_log where target_id = :id and action = 'account_deleted'"),
                {"id": u.id},
            )
        ).scalar()
    assert logged == 1


async def test_ready_endpoint(client: AsyncClient, db) -> None:  # type: ignore[no-untyped-def]
    r = await client.get("/health/ready")
    assert r.status_code == 200 and r.json()["database"] == "up"


async def test_every_level_has_published_lessons_and_units(make_user) -> None:  # type: ignore[no-untyped-def]
    a = await make_user()
    rows = await _rls_query(
        a.id,
        "select l.code, (select count(*) from lessons s where s.learning_level_id = l.id), "
        "(select count(*) from units u where u.learning_level_id = l.id) from learning_levels l order by l.code",
    )
    assert [r[0] for r in rows] == [1, 2, 3, 4, 5, 6]
    for _code, lessons, units in rows:
        assert lessons >= 12 and units >= 3

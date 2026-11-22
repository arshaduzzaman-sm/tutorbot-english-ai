"""M5 coaching: recommendations, adaptive difficulty, readiness and weekly check-in follow real attempt history."""

from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy import text

from app.db.session import service_session
from app.services import coach as c
from tests.helpers import auth

TODAY = date(2026, 11, 22)
CATS = {
    "reading_fill_in_blanks": ("reading", "writing"),
    "reorder_paragraphs": ("reading",),
    "write_from_dictation": ("listening", "writing"),
    "read_aloud": ("speaking", "reading"),
}


def rows(code: str, ratios: list[float | None], days_ago: int = 0) -> list[c.AttemptRow]:
    return [c.AttemptRow(code, r, TODAY - timedelta(days=days_ago)) for r in ratios]


def test_new_learner_gets_untried_types_and_level_difficulty() -> None:
    recs = c.recommendations({}, CATS, level=3, review_due=0, today=TODAY)
    assert [r["reason"] for r in recs] == ["not_tried", "not_tried"]
    assert all(r["difficulty"] == "intermediate" for r in recs)
    assert c.readiness({}, CATS)["overall"] == "not_enough_data"


def test_weak_type_comes_first_and_difficulty_steps_down() -> None:
    stats = c.category_stats(rows("reorder_paragraphs", [0.2, 0.3, 0.1, 0.4]) + rows("read_aloud", [0.9] * 4))
    recs = c.recommendations(stats, CATS, level=3, review_due=2, today=TODAY)
    assert recs[0] == {"kind": "review", "reason": "review_due", "category_code": None, "count": 2}
    assert recs[1]["category_code"] == "reorder_paragraphs" and recs[1]["reason"] == "weak"
    assert recs[1]["difficulty"] == "beginner"  # weak run: one step easier than the level's default
    assert "read_aloud" not in [r["category_code"] for r in recs if r["reason"] == "weak"]


def test_strong_run_steps_difficulty_up_and_decline_is_flagged() -> None:
    strong = c.category_stats(rows("read_aloud", [0.95] * 5))
    assert c.target_difficulty(3, strong["read_aloud"]) == "advanced"
    assert c.target_difficulty(6, strong["read_aloud"]) == "advanced"  # never above the top
    falling = c.category_stats(rows("read_aloud", [0.5] * 5 + [0.95] * 5))
    reasons = {r["reason"] for r in c.recommendations(falling, CATS, 3, 0, TODAY)}
    assert "declining" in reasons


def test_stale_types_and_mock_suggestion() -> None:
    hist = rows("reading_fill_in_blanks", [0.8] * 3, days_ago=10)
    for code in ("reorder_paragraphs", "write_from_dictation", "read_aloud"):
        hist += rows(code, [0.8] * 3, days_ago=1)
    recs = c.recommendations(c.category_stats(hist), CATS, 3, 0, TODAY)
    assert {"kind": "practice", "reason": "stale"}.items() <= recs[0].items()
    assert recs[-1]["kind"] == "mock"


def test_readiness_bands_never_scores() -> None:
    cats = {f"t{i}": ("reading",) for i in range(6)}
    hist: list[c.AttemptRow] = []
    for code in cats:
        hist += rows(code, [0.7] * 4)
    r = c.readiness(c.category_stats(hist), cats)
    assert r["overall"] == "getting_close" and r["skills"][0]["band"] == "good"
    assert r["types_tried"] == 6 and r["attempts"] == 24
    weak = c.readiness(c.category_stats([*hist, *rows("t0", [0.0] * 30)]), cats)
    assert weak["overall"] == "building"


def test_weekly_checkin_compares_weeks() -> None:
    hist = rows("read_aloud", [0.9, 0.8], 1) + rows("read_aloud", [0.5, 0.6], 8)
    w = c.weekly_checkin(hist, TODAY)
    assert w["this_week"]["attempts"] == 2 and w["last_week"]["attempts"] == 2
    assert w["accuracy_change"] == 0.3 and w["message"] == "improving"
    assert c.weekly_checkin([], TODAY)["message"] == "start"


def test_today_plan_uses_recommendations() -> None:
    recs = c.recommendations(c.category_stats(rows("reorder_paragraphs", [0.1] * 3)), CATS, 2, 1, TODAY)
    plan = c.today_plan(recs, level=2, daily_minutes=30)
    assert [b["kind"] for b in plan] == ["lessons", "practice", "practice", "review"]
    assert sum(b["minutes"] for b in plan) == 30
    assert plan[1]["category_code"] == "reorder_paragraphs"


COACH_Q = "{ viewer { coach { level recommendations readiness weekly todayPlan } } }"


async def _seed_attempts(user_id: str, code: str, ratios: list[float], older_by: int = 0) -> None:
    async with service_session() as s:
        for i, r in enumerate(ratios):
            await s.execute(
                text(
                    "insert into public.attempts (user_id, question_id, category_id, mode, score_ratio, is_correct, "
                    "created_at) select :u, q.id, q.category_id, 'practice', cast(:r as numeric), "
                    "cast(:r as numeric) >= 1, now() - make_interval(mins => :i) "
                    "from public.questions q join public.question_categories c on c.id = q.category_id "
                    "where c.code = :code and q.status = 'published' order by q.external_id limit 1"
                ),
                {"u": user_id, "r": r, "code": code, "i": i + older_by},
            )


async def _coach(client: AsyncClient, token: str) -> dict:  # type: ignore[type-arg]
    r = await client.post("/graphql", json={"query": COACH_Q}, headers=auth(token))
    assert r.status_code == 200 and "errors" not in r.json(), r.text
    return r.json()["data"]["viewer"]["coach"]  # type: ignore[no-any-return]


async def test_recommendations_change_with_seeded_history(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    new, struggling = await make_user(), await make_user()
    fresh = await _coach(client, new.token)
    assert {r["reason"] for r in fresh["recommendations"]} == {"not_tried"}
    assert fresh["readiness"]["overall"] == "not_enough_data"

    await _seed_attempts(struggling.id, "reorder_paragraphs", [0.0, 0.25, 0.0, 0.2])
    after = await _coach(client, struggling.token)
    first = after["recommendations"][0]
    assert first["categoryCode"] == "reorder_paragraphs" and first["reason"] == "weak"
    assert first["difficulty"] == "beginner"
    assert after["weekly"]["thisWeek"]["attempts"] == 4
    assert any(b.get("categoryCode") == "reorder_paragraphs" for b in after["todayPlan"])
    # The other learner's history is untouched (RLS)
    assert (await _coach(client, new.token))["weekly"]["thisWeek"]["attempts"] == 0


async def test_adaptive_practice_puts_target_difficulty_first(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    q = '{ practiceQuestions(categoryCode: "reorder_paragraphs", adaptive: true, limit: 3) { difficulty } }'
    await _seed_attempts(u.id, "reorder_paragraphs", [0.0] * 4, older_by=60)
    r = await client.post("/graphql", json={"query": q}, headers=auth(u.token))
    assert r.json()["data"]["practiceQuestions"][0]["difficulty"] == "beginner"
    await _seed_attempts(u.id, "reorder_paragraphs", [1.0] * 6)  # newer and strong: step up from level 1
    r = await client.post("/graphql", json={"query": q}, headers=auth(u.token))
    assert r.json()["data"]["practiceQuestions"][0]["difficulty"] == "intermediate"

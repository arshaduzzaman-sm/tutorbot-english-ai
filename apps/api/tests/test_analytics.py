"""M6 analytics: numbers match seeded attempts exactly; CSV export; another learner sees nothing."""

from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy import text

from app.db.session import service_session
from app.services import analytics as an
from tests.helpers import auth

TODAY = date(2026, 11, 22)


def row(
    code: str, ratio: float | None, days_ago: int, secs: int = 60, skills: tuple[str, ...] = ("reading",)
) -> an.Row:
    return an.Row(code, code.title(), "reading", skills, ratio, secs, TODAY - timedelta(days=days_ago))


def test_daily_series_has_every_day_and_correct_values() -> None:
    rows = [row("a", 1.0, 0), row("a", 0.5, 0), row("b", None, 2, secs=120)]
    d = an.daily(rows, TODAY, 7)
    assert len(d) == 7 and d[0]["day"] == "2026-11-16" and d[-1]["day"] == "2026-11-22"
    assert d[-1] == {"day": "2026-11-22", "attempts": 2, "accuracy": 0.75, "minutes": 2}
    assert d[-3] == {"day": "2026-11-20", "attempts": 1, "accuracy": None, "minutes": 2}
    assert d[0]["attempts"] == 0


def test_by_type_compares_last_14_days_with_the_14_before() -> None:
    rows = [row("a", 0.9, 1), row("a", 0.7, 3), row("a", 0.4, 20), row("b", 0.2, 1)]
    t = {x["code"]: x for x in an.by_type(rows, TODAY)}
    assert t["a"]["attempts"] == 3 and t["a"]["accuracy"] == round((0.9 + 0.7 + 0.4) / 3, 4)
    assert t["a"]["recent_accuracy"] == 0.8 and t["a"]["previous_accuracy"] == 0.4 and t["a"]["change"] == 0.4
    assert t["b"]["band"] == "needs_work" and t["b"]["change"] is None
    assert [x["code"] for x in an.by_type(rows, TODAY)] == ["b", "a"]  # weakest first


def test_skill_trend_by_week() -> None:
    rows = [row("a", 1.0, 0, skills=("reading", "writing")), row("a", 0.0, 8)]
    trend = an.skill_trend(rows, TODAY, weeks=2)
    assert trend == [
        {"week_start": "2026-11-09", "speaking": None, "writing": None, "reading": 0.0, "listening": None},
        {"week_start": "2026-11-16", "speaking": None, "writing": 1.0, "reading": 1.0, "listening": None},
    ]


async def test_analytics_api_matches_seeded_attempts(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u, other = await make_user(), await make_user()
    async with service_session() as s:
        for ratio, secs in ((1.0, 30), (0.5, 90), (0.0, 60)):
            await s.execute(
                text(
                    "insert into public.attempts (user_id, question_id, category_id, score_ratio, duration_seconds) "
                    "select :u, q.id, q.category_id, cast(:r as numeric), :s from public.questions q "
                    "join public.question_categories c on c.id = q.category_id "
                    "where c.code = 'reorder_paragraphs' and q.status = 'published' limit 1"
                ),
                {"u": u.id, "r": ratio, "s": secs},
            )
    q = "{ viewer { analytics(days: 7) } }"
    data = (await client.post("/graphql", json={"query": q}, headers=auth(u.token))).json()["data"]["viewer"][
        "analytics"
    ]
    assert data["summary"] == {"attempts": 3, "accuracy": 0.5, "minutes": 3, "activeDays": 1, "types": 1}
    assert len(data["daily"]) == 7 and data["daily"][-1]["attempts"] == 3
    rp = data["byType"][0]
    assert rp["code"] == "reorder_paragraphs" and rp["accuracy"] == 0.5 and rp["band"] == "developing"
    empty = (await client.post("/graphql", json={"query": q}, headers=auth(other.token))).json()
    assert empty["data"]["viewer"]["analytics"]["summary"]["attempts"] == 0

    csv = await client.get("/api/v1/me/progress-report.csv?days=7", headers=auth(u.token))
    assert csv.status_code == 200 and csv.headers["content-type"].startswith("text/csv")
    body = csv.text
    assert "Practice estimate, not an official PTE score." in body
    assert "Reorder Paragraphs,reading,3,50,developing" in body
    assert (await client.get("/api/v1/me/progress-report.csv")).status_code == 401

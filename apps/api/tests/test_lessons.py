"""Lesson flow: content read via GraphQL (no answers leaked), Try/Check marking, progress."""

import pytest
from httpx import AsyncClient

from app.core.errors import AppError
from app.services.lessons import mark_exercise, normalize, public_exercise
from tests.helpers import auth

EX = {
    "id": "x1",
    "type": "single_choice",
    "prompt": "Pick",
    "options": ["A b", "c"],
    "answer": "A b",
    "hint": "h",
    "explanation": "because",
}


def test_marking_ignores_spaces_but_not_case() -> None:
    assert normalize("  A   b ") == "A b"
    assert mark_exercise(EX, " A  b").correct is True
    assert mark_exercise(EX, "a b").correct is False
    assert mark_exercise(EX, "c").correct is False
    assert mark_exercise(EX, None).correct is False
    with pytest.raises(AppError):
        mark_exercise({**EX, "type": "essay"}, "x")


def test_public_exercise_hides_answer() -> None:
    assert public_exercise(EX) == {
        "id": "x1",
        "type": "single_choice",
        "prompt": "Pick",
        "options": ["A b", "c"],
        "hint": "h",
    }


LESSON_Q = """query($slug: String!) { lesson(slug: $slug) { title progress { status bestScore }
  sections { kind title bodyMd exercises { id type prompt options hint } } } }"""


@pytest.mark.integration
async def test_lesson_graphql_has_sections_and_no_answers(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    r = await client.post(
        "/graphql", json={"query": LESSON_Q, "variables": {"slug": "the-alphabet"}}, headers=auth(u.token)
    )
    lesson = r.json()["data"]["lesson"]
    assert lesson["title"] == "The English alphabet" and lesson["progress"] is None
    assert [s["kind"] for s in lesson["sections"]] == ["learn", "see", "try", "check"]
    assert "answer" not in r.text and "explanation" not in r.text
    bad = await client.post(
        "/graphql", json={"query": '{ lesson(slug: "x") { sections { exercises { answer } } } }'}, headers=auth(u.token)
    )
    assert bad.json()["errors"]
    lst = await client.post("/graphql", json={"query": "{ lessons(levelCode: 1) { slug } }"}, headers=auth(u.token))
    assert len(lst.json()["data"]["lessons"]) == 19


@pytest.mark.integration
async def test_try_check_and_progress_flow(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    assert (await client.post("/api/v1/lessons/the-alphabet/start", headers=h)).json() == {"status": "in_progress"}
    r = await client.post("/api/v1/lessons/the-alphabet/exercises/alpha-try-1/check", json={"answer": "b"}, headers=h)
    assert r.json()["correct"] is False and r.json()["correct_answer"] == "e"

    # 1 of 2 correct = 50%: not passed
    r = await client.post(
        "/api/v1/lessons/the-alphabet/check",
        headers=h,
        json={"answers": {"alpha-check-1": "26", "alpha-check-2": "my name is ali."}},
    )
    body = r.json()
    assert body["score_ratio"] == 0.5 and body["passed"] is False and body["status"] == "in_progress"
    assert body["results"][1]["explanation"]

    # 2 of 2 = pass -> completed
    r = await client.post(
        "/api/v1/lessons/the-alphabet/check",
        headers=h,
        json={"answers": {"alpha-check-1": "26", "alpha-check-2": "My name is Ali."}, "duration_seconds": 120},
    )
    assert r.json()["passed"] is True and r.json()["status"] == "completed"

    # A later fail keeps completion and best score
    r = await client.post("/api/v1/lessons/the-alphabet/check", headers=h, json={"answers": {}})
    assert r.json()["status"] == "completed"

    q = await client.post(
        "/graphql",
        headers=h,
        json={
            "query": '{ lesson(slug: "the-alphabet") { progress { status bestScore } } '
            "viewer { progress { lessonsCompleted } streakDays todayMinutes } }"
        },
    )
    d = q.json()["data"]
    assert d["lesson"]["progress"] == {"status": "completed", "bestScore": 1.0}
    assert d["viewer"]["progress"]["lessonsCompleted"] == 1 and d["viewer"]["streakDays"] == 1
    assert d["viewer"]["todayMinutes"] == 2


@pytest.mark.integration
async def test_lesson_errors(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    assert (await client.post("/api/v1/lessons/nope/start", headers=h)).status_code == 404
    assert (
        await client.post("/api/v1/lessons/the-alphabet/exercises/nope/check", json={"answer": "a"}, headers=h)
    ).status_code == 404
    assert (await client.post("/api/v1/lessons/the-alphabet/check", json={"answers": {}})).status_code == 401

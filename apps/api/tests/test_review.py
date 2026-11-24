"""Mistake notebook + spaced review: schedule rules, RLS, and the answer -> notebook -> review loop."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.services.review import next_step
from tests.helpers import auth

NOW = datetime(2026, 1, 1, tzinfo=UTC)


def test_schedule_moves_up_on_correct_and_resets_on_wrong() -> None:
    assert next_step(0, True, NOW).box == 1 and next_step(0, True, NOW).due_at == NOW + timedelta(days=1)
    assert next_step(1, True, NOW).due_at == NOW + timedelta(days=3)
    assert next_step(3, True, NOW).due_at == NOW + timedelta(days=14)
    assert next_step(4, True, NOW).mastered is True
    wrong = next_step(3, False, NOW)
    assert (wrong.box, wrong.due_at, wrong.mastered) == (0, NOW + timedelta(days=1), False)


REVIEW_Q = """{ viewer { reviewDueCount reviewItems { box wrongCount mastered lastScore
  question { externalId categoryCode } } due: reviewItems(dueOnly: true) { question { id } } } }"""


async def _qid(client: AsyncClient, token: str, code: str, ext: str) -> str:
    r = await client.post(
        "/graphql",
        json={
            "query": "query($c: String!) { practiceQuestions(categoryCode: $c) { id externalId } }",
            "variables": {"c": code},
        },
        headers=auth(token),
    )
    return next(q["id"] for q in r.json()["data"]["practiceQuestions"] if q["externalId"] == ext)


@pytest.mark.integration
async def test_wrong_answer_goes_to_notebook_and_comes_back_for_review(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u, other = await make_user(), await make_user()
    h = auth(u.token)
    qid = await _qid(client, u.token, "reading_mc_single", "rmcs-0001")
    url = f"/api/v1/practice/questions/{qid}/answer"

    ok = await client.post(url, json={"response": {"selected": ["B"]}}, headers=h)
    assert ok.json()["notebook"] is None  # right first time: nothing to review
    wrong = await client.post(url, json={"response": {"selected": ["A"]}}, headers=h)
    assert wrong.json()["notebook"] == "added"

    d = (await client.post("/graphql", json={"query": REVIEW_Q}, headers=h)).json()["data"]["viewer"]
    assert d["reviewDueCount"] == 1 and len(d["due"]) == 1
    assert d["reviewItems"][0] == {
        "box": 0,
        "wrongCount": 1,
        "mastered": False,
        "lastScore": 0.0,
        "question": {"externalId": "rmcs-0001", "categoryCode": "reading_mc_single"},
    }

    # Another learner cannot see it (RLS)
    o = (await client.post("/graphql", json={"query": REVIEW_Q}, headers=auth(other.token))).json()
    assert o["data"]["viewer"]["reviewItems"] == []

    # Correct in review: moves to box 1, no longer due today, still in the notebook
    r = await client.post(url, json={"response": {"selected": ["B"]}, "mode": "review"}, headers=h)
    assert r.json()["notebook"] == "moved"
    d = (await client.post("/graphql", json={"query": REVIEW_Q}, headers=h)).json()["data"]["viewer"]
    assert d["reviewDueCount"] == 0 and d["reviewItems"][0]["box"] == 1

    # Wrong again: back to box 0, wrong count goes up
    await client.post(url, json={"response": {"selected": ["C"]}, "mode": "review"}, headers=h)
    d = (await client.post("/graphql", json={"query": REVIEW_Q}, headers=h)).json()["data"]["viewer"]
    assert d["reviewItems"][0]["box"] == 0 and d["reviewItems"][0]["wrongCount"] == 2

    export = (await client.get("/api/v1/me/export", headers=h)).json()
    assert len(export["review_items"]) == 1

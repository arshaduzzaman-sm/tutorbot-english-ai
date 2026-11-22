"""Vocabulary flashcards and pronunciation drills: marking, spaced review, no answers in GraphQL."""

import pytest
from httpx import AsyncClient

from app.services.tracks import mark_drill, public_drill_item
from tests.helpers import auth


def test_drill_marking_and_public_item() -> None:
    items = [
        {"id": "a-1", "type": "listen_choose", "options": ["ship", "sheep"], "say": "ship", "answer": "ship"},
        {"id": "a-2", "type": "choose", "prompt": "?", "options": ["x", "y"], "answer": "y", "explanation": "e"},
    ]
    ratio, results = mark_drill(items, {"a-1": "ship", "a-2": "x"})
    assert ratio == 0.5 and [r["correct"] for r in results] == [True, False]
    assert results[1]["explanation"] == "e"
    assert public_drill_item(items[0]) == {"id": "a-1", "type": "listen_choose", "options": ["ship", "sheep"]}


SETS_Q = "{ vocabularySets(levelCode: 1) { slug title wordCount seenCount masteredCount } }"
SET_Q = """query($s: String!) { vocabularySet(slug: $s) { slug wordCount seenCount
  words { id externalId word meaning example box mastered } } }"""
DUE_Q = "{ viewer { vocabularyDueCount vocabularyDue { word box } } }"


@pytest.mark.integration
async def test_vocabulary_flashcards(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    sets = (await client.post("/graphql", json={"query": SETS_Q}, headers=h)).json()["data"]["vocabularySets"]
    assert len(sets) == 20 and sets[0]["slug"] == "l1-words-01" and sets[0]["seenCount"] == 0
    total = 0
    for code in (1, 2, 3):
        q = SETS_Q.replace("levelCode: 1", f"levelCode: {code}")
        total += sum(
            s["wordCount"]
            for s in (await client.post("/graphql", json={"query": q}, headers=h)).json()["data"]["vocabularySets"]
        )
    assert total >= 1500

    data = (await client.post("/graphql", json={"query": SET_Q, "variables": {"s": "l1-words-01"}}, headers=h)).json()
    words = data["data"]["vocabularySet"]["words"]
    first, second = words[0], words[1]
    assert first["word"] == "apple" and first["box"] is None

    r = await client.post(f"/api/v1/vocabulary/{first['id']}/review", json={"known": False}, headers=h)
    assert r.status_code == 200 and r.json()["box"] == 0 and r.json()["mastered"] is False
    r = await client.post(f"/api/v1/vocabulary/{second['id']}/review", json={"known": True}, headers=h)
    assert r.json()["box"] == 1

    # A missed word is due tomorrow, not now; nothing is due yet
    due = (await client.post("/graphql", json={"query": DUE_Q}, headers=h)).json()["data"]["viewer"]
    assert due["vocabularyDueCount"] == 0
    after = (await client.post("/graphql", json={"query": SET_Q, "variables": {"s": "l1-words-01"}}, headers=h)).json()
    assert after["data"]["vocabularySet"]["seenCount"] == 2
    assert [w["box"] for w in after["data"]["vocabularySet"]["words"][:2]] == [0, 1]

    bad = await client.post(
        "/api/v1/vocabulary/00000000-0000-0000-0000-000000000000/review", json={"known": True}, headers=h
    )
    assert bad.status_code == 404


TOPICS_Q = "{ pronunciationTopics { slug kind title symbols drill { id type prompt options } bestScore attempts } }"


@pytest.mark.integration
async def test_pronunciation_drill(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    r = await client.post("/graphql", json={"query": TOPICS_Q}, headers=h)
    assert '"answer"' not in r.text and '"say"' not in r.text
    topics = r.json()["data"]["pronunciationTopics"]
    assert len(topics) >= 24 and topics[0]["slug"] == "ship-sheep"
    assert {t["kind"] for t in topics} >= {"vowel", "diphthong", "consonant", "stress", "linking", "intonation"}

    item = topics[0]["drill"][0]
    speech = await client.get(f"/api/v1/pronunciation/ship-sheep/items/{item['id']}/speech", headers=h)
    said = speech.json()["parts"][0]
    assert said in item["options"]

    answers = {d["id"]: d["options"][0] for d in topics[0]["drill"]}
    answers[item["id"]] = said
    res = await client.post("/api/v1/pronunciation/ship-sheep/drill", json={"answers": answers}, headers=h)
    assert res.status_code == 200 and 0 < res.json()["score_ratio"] <= 1
    assert res.json()["results"][0]["correct"] is True

    again = (await client.post("/graphql", json={"query": TOPICS_Q}, headers=h)).json()["data"]["pronunciationTopics"][
        0
    ]
    assert again["attempts"] == 1 and again["bestScore"] == res.json()["score_ratio"]
    assert (
        await client.post("/api/v1/pronunciation/ship-sheep/drill", json={"answers": {"zz": "a"}}, headers=h)
    ).status_code == 422
    assert (await client.post("/api/v1/pronunciation/nope/drill", json={"answers": {}}, headers=h)).status_code == 404

"""Reading practice: marking rules, answers hidden in GraphQL, attempts recorded and counted."""

import pytest
from httpx import AsyncClient

from app.core.errors import AppError
from app.services.practice import AUTO_MARKED, mark, mark_blanks, mark_choices, mark_order
from tests.helpers import auth


def test_blanks_partial_credit_ignores_case_and_spaces() -> None:
    m = mark_blanks({"1": "mind", "2": "sleep"}, {"1": " Mind ", "2": "slept"})
    assert m.score_ratio == 0.5 and m.is_correct is False
    assert [p["correct"] for p in m.parts] == [True, False]
    assert mark_blanks({"1": "a"}, {}).score_ratio == 0


def test_choices_single_and_multiple() -> None:
    assert mark_choices(["B"], ["B"], single=True).is_correct is True
    assert mark_choices(["B"], ["A", "B"], single=True).score_ratio == 0
    m = mark_choices(["A", "C"], ["A", "D"], single=False)
    assert m.score_ratio == 0 and m.is_correct is False  # +1 -1, never below 0
    assert mark_choices(["A", "C"], ["A"], single=False).score_ratio == 0.5
    assert mark_choices(["A", "C"], ["C", "A"], single=False).is_correct is True


def test_order_scores_neighbouring_pairs() -> None:
    want = ["p1", "p3", "p4", "p2"]
    assert mark_order(want, want).score_ratio == 1
    m = mark_order(want, ["p1", "p3", "p2", "p4"])
    assert round(m.score_ratio, 3) == round(1 / 3, 3) and m.is_correct is False
    assert mark_order(want, []).score_ratio == 0


def test_unsupported_and_bad_shapes() -> None:
    with pytest.raises(AppError):
        mark("write_essay", {}, {})
    with pytest.raises(AppError):
        mark("reading_mc_single", {"correct": ["A"]}, {"selected": 5})


QUESTIONS_Q = """query($c: String!) { practiceQuestions(categoryCode: $c) {
  id externalId categoryCode instructions learningObjective content options { label body } } }"""


async def _questions(client: AsyncClient, token: str, code: str) -> list[dict]:  # type: ignore[type-arg]
    r = await client.post("/graphql", json={"query": QUESTIONS_Q, "variables": {"c": code}}, headers=auth(token))
    assert "is_correct" not in r.text and "isCorrect" not in r.text and '"answer"' not in r.text
    return r.json()["data"]["practiceQuestions"]  # type: ignore[no-any-return]


@pytest.mark.integration
async def test_every_reading_type_has_questions_without_answers(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    r = await client.post(
        "/graphql",
        json={"query": '{ practiceTypes(section: "reading") { category { code } questionCount autoMarked attempts } }'},
        headers=auth(u.token),
    )
    types = r.json()["data"]["practiceTypes"]
    assert len(types) == 5 and all(t["questionCount"] >= 2 and t["autoMarked"] and t["attempts"] == 0 for t in types)
    for t in types:
        qs = await _questions(client, u.token, t["category"]["code"])
        assert len(qs) >= 2
    bad = await client.post(
        "/graphql", json={"query": '{ practiceTypes(section: "x") { questionCount } }'}, headers=auth(u.token)
    )
    assert bad.json()["data"]["practiceTypes"] == []


@pytest.mark.integration
async def test_answer_each_reading_type_and_stats_update(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    by_ext = {}
    for code in sorted(AUTO_MARKED):
        for q in await _questions(client, u.token, code):
            by_ext[q["externalId"]] = q["id"]

    cases = [
        ("rwfib-0001", {"blanks": {"1": "mind", "2": "slept"}}, 0.5),
        ("rfib-0001", {"blanks": {"1": "boils", "2": "turns"}}, 1.0),
        ("rmcm-0001", {"selected": ["A", "C"]}, 1.0),
        ("rmcs-0001", {"selected": ["A"]}, 0.0),
        ("rop-0001", {"order": ["p1", "p3", "p4", "p2"]}, 1.0),
    ]
    for ext, response, expected in cases:
        r = await client.post(
            f"/api/v1/practice/questions/{by_ext[ext]}/answer",
            json={"response": response, "mode": "learn", "duration_seconds": 30},
            headers=h,
        )
        body = r.json()
        assert r.status_code == 200, body
        assert body["score_ratio"] == expected and body["explanation"] and body["correct_answer"]
        assert "not an official PTE score" in body["note"]

    r = await client.post(
        "/graphql",
        json={
            "query": '{ practiceTypes(section: "reading") { category { code } attempts averageScore } '
            "viewer { recentAttempts(limit: 10) { scoreRatio } } }"
        },
        headers=h,
    )
    d = r.json()["data"]
    stats = {t["category"]["code"]: t for t in d["practiceTypes"]}
    assert stats["rw_fill_blanks"] == {"category": {"code": "rw_fill_blanks"}, "attempts": 1, "averageScore": 0.5}
    assert len(d["viewer"]["recentAttempts"]) == 5


@pytest.mark.integration
async def test_practice_errors(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    url = "/api/v1/practice/questions/00000000-0000-0000-0000-000000000000/answer"
    assert (await client.post(url, json={"response": {}}, headers=h)).status_code == 404
    assert (await client.post(url, json={"response": {}})).status_code == 401
    assert (await client.post(url, json={"response": {}, "mode": "exam"}, headers=h)).status_code == 422
    q = await client.post("/graphql", json={"query": '{ practiceQuestion(id: "nope") { id } }'}, headers=h)
    assert q.json()["data"]["practiceQuestion"] is None


def test_highlight_and_dictation_marking() -> None:
    from app.services.practice import mark_dictation, mark_highlights

    wrong = [{"index": 4, "word": "history", "spoken": "science"}, {"index": 10, "word": "small", "spoken": "large"}]
    assert mark_highlights(wrong, [4, 10]).is_correct is True
    assert mark_highlights(wrong, [4, 3]).score_ratio == 0  # +1 -1
    assert mark_highlights(wrong, [10]).score_ratio == 0.5
    m = mark_dictation("The lecture will start in the main hall.", "the lecture start in the mian hall")
    assert m.score_ratio == 6 / 8 and m.is_correct is False  # "will" missing, "main" misspelt
    assert mark_dictation("A cat.", "a CAT").is_correct is True


@pytest.mark.integration
async def test_listening_types_marking_and_speech(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    r = await client.post(
        "/graphql",
        json={"query": '{ practiceTypes(section: "listening") { category { code } questionCount autoMarked } }'},
        headers=h,
    )
    types = {t["category"]["code"]: t for t in r.json()["data"]["practiceTypes"]}
    assert len(types) == 8 and types["summarize_spoken_text"]["autoMarked"] is False
    assert sum(t["autoMarked"] for t in types.values()) == 7

    ids = {}
    for code in ("write_from_dictation", "highlight_incorrect_words", "select_missing_word", "listening_fill_blanks"):
        rr = await client.post("/graphql", json={"query": QUESTIONS_Q, "variables": {"c": code}}, headers=h)
        assert "audio_script" not in rr.text and "lecture will start" not in rr.text
        for q in rr.json()["data"]["practiceQuestions"]:
            ids[q["externalId"]] = q["id"]

    sp = (await client.get(f"/api/v1/practice/questions/{ids['smw-0001']}/speech", headers=h)).json()
    assert len(sp["parts"]) == 2 and sp["transcript"].endswith("stay ….")
    reading_id = (await _questions(client, u.token, "reading_mc_single"))[0]["id"]
    assert (await client.get(f"/api/v1/practice/questions/{reading_id}/speech", headers=h)).status_code == 404

    cases = [
        ("wfd-0001", {"text": "The lecture will start in the main hall"}, 1.0),
        ("hiw-0001", {"indices": [4]}, 0.5),
        ("smw-0001", {"selected": ["A"]}, 1.0),
        ("lfib-0001", {"blanks": {"1": "Card", "2": "pensil"}}, 0.5),
    ]
    for ext, response, expected in cases:
        res = await client.post(f"/api/v1/practice/questions/{ids[ext]}/answer", json={"response": response}, headers=h)
        assert res.status_code == 200 and res.json()["score_ratio"] == expected, (ext, res.json())

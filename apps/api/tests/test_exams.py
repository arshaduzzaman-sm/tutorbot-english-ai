"""Exam engine: blueprint, no going back, section clock auto-submit, resume, report (SPEC 5A.4, M4)."""

import json
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.db.session import service_session
from app.services.evaluate import process_next
from app.services.exams import _advance, _section_of
from tests.helpers import auth

BP_Q = "{ blueprints { code name kind verified itemCount sections } }"
GUIDE_Q = """query($c: String!) { questionType(code: $c) { questionCount category { name } guide } }"""
MOCKS_Q = "{ viewer { mockExams { id status blueprintCode overallBand } } }"


def test_section_boundaries_are_pure() -> None:
    state = {
        "sections": [{"start": 0, "end": 2, "clock_minutes": None}, {"start": 2, "end": 3, "clock_minutes": 5}],
        "items": [{}, {}, {}],
    }
    assert _section_of(state, 1) == 0 and _section_of(state, 2) == 1
    now = datetime.now(UTC)
    assert _advance(state, 0, now) == (1, None, False)
    idx, deadline, done = _advance(state, 1, now)
    assert idx == 2 and deadline is not None and round((deadline - now).total_seconds()) == 300 and not done
    assert _advance(state, 2, now)[2] is True


@pytest.mark.integration
async def test_blueprints_and_academy_guides(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    h = auth((await make_user()).token)
    bps = (await client.post("/graphql", json={"query": BP_Q}, headers=h)).json()["data"]["blueprints"]
    codes = [b["code"] for b in bps]
    assert codes[:5] == ["full_mock", "section_speaking_writing", "section_reading", "section_listening", "mini_mock"]
    assert "e2e_short" not in codes and all(b["verified"] is False for b in bps)
    assert bps[0]["sections"] == ["Speaking and Writing", "Reading", "Listening"]
    for code in ("read_aloud", "write_essay", "reorder_paragraphs", "write_from_dictation"):
        g = (await client.post("/graphql", json={"query": GUIDE_Q, "variables": {"c": code}}, headers=h)).json()
        guide = g["data"]["questionType"]["guide"]
        assert set(guide["examples"]) == {"strong", "medium", "weak"} and guide["strategy"]
        assert guide["scoring"]["source"].startswith("https://www.pearsonpte.com/") and guide["rules"]["verified"]
    ra = (await client.post("/graphql", json={"query": GUIDE_Q, "variables": {"c": "read_aloud"}}, headers=h)).json()
    assert ra["data"]["questionType"]["guide"]["rules"]["prompt"] == "Text up to 60 words"


async def _state(client: AsyncClient, h: dict[str, str], tid: str) -> dict:  # type: ignore[type-arg]
    r = await client.get(f"/api/v1/exams/{tid}", headers=h)
    assert r.status_code == 200, r.text
    return r.json()  # type: ignore[no-any-return]


@pytest.mark.integration
async def test_short_exam_end_to_end(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u, other = await make_user(), await make_user()
    h = auth(u.token)
    tid = (await client.post("/api/v1/exams", json={"blueprint_code": "e2e_short"}, headers=h)).json()["id"]
    # Resume: starting again returns the same test
    assert (await client.post("/api/v1/exams", json={"blueprint_code": "e2e_short"}, headers=h)).json()["id"] == tid
    s = await _state(client, h, tid)
    assert s["total"] == 5 and s["index"] == 0 and [x["count"] for x in s["sections"]] == [2, 2, 1]
    assert s["item"]["category_code"] == "read_aloud" and s["section_seconds_left"] is None
    assert "answer" not in json.dumps(s["item"])
    assert (await client.get(f"/api/v1/exams/{tid}", headers=auth(other.token))).status_code == 404

    # Item 0: Read Aloud skipped (no recording); item 1: writing evaluated in exam mode
    assert (await client.post(f"/api/v1/exams/{tid}/answer", json={"index": 0}, headers=h)).json()["index"] == 1
    s = await _state(client, h, tid)
    wq = s["item"]["id"]
    ev = await client.post(
        f"/api/v1/writing/questions/{wq}/submit",
        headers=h,
        json={"text": "Gardens help people but need volunteers to survive.", "mode": "exam", "test_session_id": tid},
    )
    eid = ev.json()["id"]
    r = await client.post(f"/api/v1/exams/{tid}/answer", json={"index": 1, "evaluation_id": eid}, headers=h)
    assert r.json() == {"index": 2, "finished": False}
    # No going back
    back = await client.post(f"/api/v1/exams/{tid}/answer", json={"index": 1}, headers=h)
    assert back.status_code == 409 and back.json()["error"]["code"] == "not_current"

    # Reading section has a clock
    s = await _state(client, h, tid)
    assert s["section"]["code"] == "reading" and 0 < s["section_seconds_left"] <= 180
    item = s["item"]
    resp = (
        {"selected": [item["options"][0]["label"]]}
        if item["category_code"] == "reading_mc_single"
        else {"order": [p["id"] for p in item["content"]["paragraphs"]]}
    )
    await client.post(f"/api/v1/exams/{tid}/answer", json={"index": 2, "response": resp}, headers=h)

    # Time runs out on the reading section: the rest is skipped and listening starts
    async with service_session() as db:
        await db.execute(
            text("update public.test_sessions set section_deadline = now() - interval '1 second' where id = :id"),
            {"id": tid},
        )
    s = await _state(client, h, tid)
    assert (
        s["index"] == 4 and s["section"]["code"] == "listening" and s["item"]["category_code"] == "write_from_dictation"
    )
    done = await client.post(
        f"/api/v1/exams/{tid}/answer", json={"index": 4, "response": {"text": "a sentence"}}, headers=h
    )
    assert done.json()["finished"] is True
    assert (await _state(client, h, tid))["status"] == "completed"

    # Report waits for the writing evaluation, then is complete
    rep = (await client.get(f"/api/v1/exams/{tid}/report", headers=h)).json()
    assert rep["ready"] is False and rep["pending_evaluations"] == 1
    for _ in range(50):
        if str(await process_next()) == eid:
            break
    rep = (await client.get(f"/api/v1/exams/{tid}/report", headers=h)).json()
    assert rep["ready"] is True and rep["total"] == 5 and rep["skipped"] == 2 and rep["answered"] == 3
    assert {r["code"] for r in rep["by_section"]} == {"speaking_writing", "reading", "listening"}
    assert {"reading", "writing", "listening"} <= {r["code"] for r in rep["by_skill"]}
    assert "content" in {r["code"] for r in rep["by_criterion"]} and rep["most_lost"]
    assert rep["disclaimer"] == "Practice estimate. Not an official PTE score."
    mocks = (await client.post("/graphql", json={"query": MOCKS_Q}, headers=h)).json()["data"]["viewer"]["mockExams"]
    assert mocks[0]["blueprintCode"] == "e2e_short" and mocks[0]["overallBand"] == rep["overall_band"]

    # A second attempt is compared with the first
    t2 = (await client.post("/api/v1/exams", json={"blueprint_code": "e2e_short"}, headers=h)).json()["id"]
    assert t2 != tid
    for i in range(5):
        await client.post(f"/api/v1/exams/{t2}/answer", json={"index": i}, headers=h)
    rep2 = (await client.get(f"/api/v1/exams/{t2}/report", headers=h)).json()
    assert rep2["previous"][0]["id"] == tid


@pytest.mark.integration
async def test_learners_cannot_edit_exam_state_directly(make_user) -> None:  # type: ignore[no-untyped-def]
    from tests.test_integration import _rls_query

    u = await make_user()
    with pytest.raises(Exception, match="permission denied"):
        await _rls_query(u.id, "insert into test_sessions (user_id, kind) values (:u, 'mini_mock')", {"u": u.id})
    with pytest.raises(Exception, match="permission denied"):
        await _rls_query(u.id, "update test_sessions set current_index = 0 where user_id = :u", {"u": u.id})
    assert (await _rls_query(u.id, "select count(*) from blueprints"))[0][0] >= 6

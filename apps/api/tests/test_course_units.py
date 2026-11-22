"""Course units: unlock rule, end-of-unit test marking, progress and GraphQL (no answers)."""

import pytest
from httpx import AsyncClient

from app.services.units import lock_states
from tests.helpers import auth


def _u(level: int, passed: bool = False) -> dict[str, object]:
    return {"level_code": level, "passed": passed}


def test_lock_rule() -> None:
    course = [_u(1), _u(1), _u(2), _u(2)]
    assert lock_states(course, None) == [False, True, True, True]
    assert lock_states([_u(1, True), _u(1), _u(2), _u(2)], 1) == [False, False, True, True]
    # Placed at level 2: level 1 is open, and so is the first unit of level 2
    assert lock_states(course, 2) == [False, False, False, True]


UNITS_Q = """{ units(levelCode: 1) { slug locked progress { bestScore attempts passed }
  lessons { slug unitSlug locked } testItems { id prompt options } } }"""

RIGHT_U1 = {"u11-t1": "o", "u11-t2": "h", "u11-t3": "I live in London.", "u11-t4": "Good night", "u11-t5": "name"}


@pytest.mark.integration
async def test_unit_test_unlocks_the_next_unit(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    r = await client.post("/graphql", json={"query": UNITS_Q}, headers=h)
    assert '"answer"' not in r.text and "explanation" not in r.text
    units = r.json()["data"]["units"]
    assert [x["slug"] for x in units][:2] == ["l1-u1-first-steps", "l1-u2-words-and-sentences"]
    assert [x["locked"] for x in units] == [False, True, True, True]
    assert units[1]["lessons"][0]["locked"] is True and units[0]["lessons"][0]["unitSlug"] == "l1-u1-first-steps"
    assert len(units[0]["testItems"]) == 5

    locked = await client.post("/api/v1/units/l1-u2-words-and-sentences/test", json={"answers": {}}, headers=h)
    assert locked.status_code == 403

    fail = await client.post(
        "/api/v1/units/l1-u1-first-steps/test", json={"answers": {**RIGHT_U1, "u11-t1": "k", "u11-t2": "f"}}, headers=h
    )
    assert fail.json()["score_ratio"] == 0.6 and fail.json()["passed"] is False and fail.json()["unlocked"] is None
    ok = await client.post("/api/v1/units/l1-u1-first-steps/test", json={"answers": RIGHT_U1}, headers=h)
    assert ok.json()["passed"] is True and ok.json()["unlocked"] == "l1-u2-words-and-sentences"

    units = (await client.post("/graphql", json={"query": UNITS_Q}, headers=h)).json()["data"]["units"]
    assert units[0]["progress"] == {"bestScore": 1.0, "attempts": 2, "passed": True}
    assert units[1]["locked"] is False
    assert (await client.post("/api/v1/units/nope/test", json={"answers": {}}, headers=h)).status_code == 404


@pytest.mark.integration
async def test_lessons_in_a_locked_unit_cannot_be_started(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    units = (await client.post("/graphql", json={"query": UNITS_Q}, headers=h)).json()["data"]["units"]
    open_lesson, locked_lesson = units[0]["lessons"][0]["slug"], units[1]["lessons"][0]["slug"]
    assert (await client.post(f"/api/v1/lessons/{open_lesson}/start", headers=h)).status_code == 200
    r = await client.post(f"/api/v1/lessons/{locked_lesson}/start", headers=h)
    assert r.status_code == 403
    r = await client.post(f"/api/v1/lessons/{locked_lesson}/check", json={"answers": {}}, headers=h)
    assert r.status_code == 403

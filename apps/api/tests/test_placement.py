"""Placement test: level recommendation, study plan, answers hidden, profile level updated."""

from datetime import date

import pytest
from httpx import AsyncClient

from app.services.placement import build_plan, public_item, score
from tests.helpers import auth

ITEMS = [
    {
        "id": f"i{lv}{n}",
        "level": lv,
        "skill": skill,
        "type": "single_choice",
        "prompt": "p",
        "options": ["a", "b"],
        "answer": "a",
    }
    for lv in (1, 2, 3)
    for n, skill in enumerate(("reading", "listening"))
]


def test_recommends_the_first_level_that_gets_hard() -> None:
    all_right = {i["id"]: "a" for i in ITEMS}
    assert score(ITEMS, all_right)["recommended_level"] == 3  # top of this test
    level2_wrong = {**all_right, "i20": "b", "i21": "b"}
    r = score(ITEMS, level2_wrong)
    assert r["recommended_level"] == 2 and r["correct"] == 4 and r["total"] == 6
    assert score(ITEMS, {})["recommended_level"] == 1
    assert r["skill_scores"] == {"reading": 2 / 3, "listening": 2 / 3}


def test_plan_focuses_on_the_weakest_skill_and_fits_daily_minutes() -> None:
    plan = build_plan(2, {"reading": 0.9, "listening": 0.3, "writing": 0.6}, 30, date(2027, 1, 10), date(2027, 1, 1))
    assert plan["focus_skills"] == ["listening", "writing"] and plan["days_to_exam"] == 9
    assert plan["daily_minutes"] == 30 and [b["kind"] for b in plan["blocks"]] == ["lessons", "practice", "review"]
    assert plan["blocks"][1]["skill"] == "listening"
    assert build_plan(1, {}, 15, None, date(2027, 1, 1))["days_to_exam"] is None


def test_public_item_hides_answer_and_audio_text() -> None:
    item = {**ITEMS[0], "audio_script": "secret"}
    out = public_item(item)
    assert "answer" not in out and "audio_script" not in out and out["has_audio"] is True


PLACEMENT_Q = "{ placementTest { slug estimatedMinutes items { id level skill prompt options hasAudio } } }"


@pytest.mark.integration
async def test_placement_flow_sets_level_and_plan(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    r = await client.post("/graphql", json={"query": PLACEMENT_Q}, headers=h)
    test = r.json()["data"]["placementTest"]
    assert test["slug"] == "placement-v1" and len(test["items"]) == 18
    assert '"answer"' not in r.text and "audio_script" not in r.text
    listening = next(i for i in test["items"] if i["hasAudio"])
    sp = await client.get(f"/api/v1/placement/items/{listening['id']}/speech", headers=h)
    assert sp.status_code == 200 and sp.json()["transcript"]

    # Answer levels 1-2 correctly (from the content file), then nothing: start at level 3
    import json
    from pathlib import Path

    content = json.loads((Path(__file__).parents[3] / "content" / "diagnostic.json").read_text())
    answers = {i["id"]: i["answer"] for i in content["items"] if i["level"] <= 2}
    res = await client.post("/api/v1/placement/submit", json={"answers": answers}, headers=h)
    body = res.json()
    assert res.status_code == 200, body
    assert body["recommended_level"] == 3 and body["correct"] == 6 and body["total"] == 18
    assert "Not an official PTE score" in body["note"]

    q = await client.post(
        "/graphql",
        json={"query": "{ viewer { profile { level { code } } studyPlan { recommendedLevelCode plan } } }"},
        headers=h,
    )
    v = q.json()["data"]["viewer"]
    assert v["profile"]["level"]["code"] == 3 and v["studyPlan"]["recommendedLevelCode"] == 3
    assert v["studyPlan"]["plan"]["blocks"][0] == {
        "kind": "lessons",
        "minutes": v["studyPlan"]["plan"]["blocks"][0]["minutes"],
        "level": 3,
    }

    bad = await client.post("/api/v1/placement/submit", json={"answers": {"nope": "x"}}, headers=h)
    assert bad.status_code == 422
    assert (await client.post("/api/v1/placement/submit", json={"answers": {}})).status_code == 401

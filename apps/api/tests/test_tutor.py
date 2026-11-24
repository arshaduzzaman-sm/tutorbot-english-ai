"""M5 tutor: adapts to level, stays on topic, never promises scores, respects the daily limit."""

from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import service_session
from app.services import tutor
from tests.helpers import auth


def test_topic_filter() -> None:
    assert tutor.on_topic("What does 'ubiquitous' mean?")
    assert tutor.on_topic("How do I improve my Read Aloud fluency?")
    assert tutor.on_topic("hello")
    assert not tutor.on_topic("Who won the football match last night?")
    assert not tutor.on_topic("Write me a python script to hack wifi")


def test_system_prompt_adapts_to_level_and_forbids_scores() -> None:
    low, high = tutor.system_prompt(1, []), tutor.system_prompt(6, ["Reorder Paragraphs"])
    assert "very short sentences" in low and "A1" in low
    assert "C1+" in high and "Reorder Paragraphs" in high
    for p in (low, high):
        assert "Never promise or predict a score" in p and "10-90" in p
    prompt = tutor.build_prompt([("user", "hi"), ("assistant", "Hello!")], "What is a noun?")
    assert prompt.endswith("Learner: What is a noun?\nTutor:")


async def test_tutor_chat_flow(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u, other = await make_user(), await make_user()
    h = auth(u.token)
    r = await client.post("/api/v1/tutor/messages", json={"message": "What does 'concise' mean?"}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["on_topic"] is True and body["provider"] == "mock" and body["level"] == 1
    assert body["remaining_today"] == get_settings().tutor_messages_per_day - 1

    off = (
        await client.post("/api/v1/tutor/messages", json={"message": "Tell me the football results"}, headers=h)
    ).json()
    assert off["on_topic"] is False and off["provider"] is None and off["reply"] == tutor.OFF_TOPIC_REPLY
    assert off["remaining_today"] == body["remaining_today"]  # off-topic does not use the AI or the limit

    promise = await client.post(
        "/api/v1/tutor/messages", json={"message": "Can you guarantee I get 79 in the PTE exam?"}, headers=h
    )
    assert promise.json()["reply"] == tutor.GUARANTEE_REPLY

    q = "{ viewer { tutorMessages { role content provider } } }"
    msgs = (await client.post("/graphql", json={"query": q}, headers=h)).json()["data"]["viewer"]["tutorMessages"]
    assert [m["role"] for m in msgs] == ["user", "assistant"] * 3
    assert msgs[0]["content"] == "What does 'concise' mean?"
    theirs = (await client.post("/graphql", json={"query": q}, headers=auth(other.token))).json()
    assert theirs["data"]["viewer"]["tutorMessages"] == []

    export = (await client.get("/api/v1/me/export", headers=h)).json()
    assert len(export["tutor_messages"]) == 6
    cleared = await client.delete("/api/v1/tutor/messages", headers=h)
    assert cleared.json() == {"deleted": 6}


async def test_tutor_limits(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    long = await client.post("/api/v1/tutor/messages", json={"message": "word " * 300}, headers=h)
    assert long.status_code == 422
    async with service_session() as s:
        await s.execute(
            text(
                "insert into public.ai_usage (user_id, feature, provider) select :u, 'tutor', 'mock' "
                "from generate_series(1, :n)"
            ),
            {"u": u.id, "n": get_settings().tutor_messages_per_day},
        )
    r = await client.post("/api/v1/tutor/messages", json={"message": "What is a verb?"}, headers=h)
    assert r.status_code == 429 and r.json()["error"]["code"] == "tutor_limit"

"""Speaking and writing end to end: consent, upload, queue, worker, result, playback, privacy (SPEC M3)."""

import uuid
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.services.evaluate import process_next
from tests.helpers import auth
from tests.test_evaluators import ESSAY_OK, sample_wav

Q = "query($c: String!) { practiceQuestions(categoryCode: $c) { id content } }"
HISTORY = """query($c: String!) { viewer { recordingConsent evaluations(categoryCode: $c) { id status taskType result }
  typeHistory(categoryCode: $c) { mode scoreRatio } } }"""


async def _first(client: AsyncClient, h: dict[str, str], code: str) -> str:
    r = await client.post("/graphql", json={"query": Q, "variables": {"c": code}}, headers=h)
    return str(r.json()["data"]["practiceQuestions"][0]["id"])


async def _drain(job_id: str) -> None:
    for _ in range(50):
        done = await process_next()
        if done is None or str(done) == job_id:
            return


@pytest.fixture
def recordings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(get_settings(), "recordings_dir", str(tmp_path))
    return tmp_path


@pytest.mark.integration
async def test_writing_evaluation_flow(client: AsyncClient, make_user, recordings: Path) -> None:  # type: ignore[no-untyped-def]
    u, other = await make_user(), await make_user()
    h = auth(u.token)
    qid = await _first(client, h, "write_essay")
    r = await client.post(
        f"/api/v1/writing/questions/{qid}/submit", json={"text": ESSAY_OK, "mode": "practice"}, headers=h
    )
    assert r.status_code == 202 and r.json()["status"] == "queued" and r.json()["task_type"] == "write_essay"
    job = r.json()["id"]
    pending = await client.get(f"/api/v1/evaluations/{job}", headers=h)
    assert pending.json()["status"] == "queued" and pending.json()["result"] is None

    await _drain(job)
    done = (await client.get(f"/api/v1/evaluations/{job}", headers=h)).json()
    assert done["status"] == "done" and done["provider"] == "mock"
    res = done["result"]
    assert res["estimated_score"] is None and res["disclaimer"] == "Practice estimate. Not an official PTE score."
    assert {c["band"] for c in res["criteria"]} <= {"needs_work", "developing", "good", "strong"}
    assert '"score"' not in str(res).replace("estimated_score", "")

    hist = (await client.post("/graphql", json={"query": HISTORY, "variables": {"c": "write_essay"}}, headers=h)).json()
    v = hist["data"]["viewer"]
    assert [e["status"] for e in v["evaluations"]] == ["done"] and v["typeHistory"][0]["mode"] == "practice"

    # Another learner cannot read it
    assert (await client.get(f"/api/v1/evaluations/{job}", headers=auth(other.token))).status_code == 404
    # Wrong task type and empty answers are refused
    ra = await _first(client, h, "read_aloud")
    assert (
        await client.post(f"/api/v1/writing/questions/{ra}/submit", json={"text": "hi"}, headers=h)
    ).status_code == 422
    blank = await client.post(f"/api/v1/writing/questions/{qid}/submit", json={"text": "   "}, headers=h)
    assert blank.status_code == 422


@pytest.mark.integration
async def test_speaking_needs_consent_then_uploads_and_plays_back(
    client: AsyncClient,
    make_user,
    recordings: Path,  # type: ignore[no-untyped-def]
) -> None:
    u, other = await make_user(), await make_user()
    h = auth(u.token)
    qid = await _first(client, h, "read_aloud")
    url = f"/api/v1/speaking/questions/{qid}/recording?duration_seconds=4.5"
    wav = sample_wav()
    no = await client.post(url, content=wav, headers={**h, "content-type": "audio/wav"})
    assert no.status_code == 403 and no.json()["error"]["code"] == "consent_required"

    assert (await client.put("/api/v1/me/consents/recording", json={"granted": True}, headers=h)).json()["granted"]
    bad_type = await client.post(url, content=b"x", headers={**h, "content-type": "text/plain"})
    assert bad_type.status_code == 415
    too_long = await client.post(url.replace("4.5", "500"), content=wav, headers={**h, "content-type": "audio/wav"})
    assert too_long.status_code == 422

    ok = await client.post(url, content=wav, headers={**h, "content-type": "audio/wav"})
    assert ok.status_code == 202, ok.text
    job = ok.json()["id"]
    files = list((recordings / u.id).iterdir())
    assert len(files) == 1 and files[0].read_bytes() == wav

    await _drain(job)
    done = (await client.get(f"/api/v1/evaluations/{job}", headers=h)).json()
    assert done["status"] == "done" and done["response_text"] == "this is a mock transcript"
    assert [c["name"] for c in done["result"]["criteria"]] == ["content", "oral_fluency", "pronunciation"]

    rec = done["recording_id"]
    play = await client.get(f"/api/v1/recordings/{rec}", headers=h)
    assert play.status_code == 200 and play.content == wav and play.headers["content-type"] == "audio/wav"
    assert (await client.get(f"/api/v1/recordings/{rec}", headers=auth(other.token))).status_code == 404

    # Exported data includes the recording metadata; deleting the account deletes the audio files
    export = (await client.get("/api/v1/me/export", headers=h)).json()
    assert len(export["recordings"]) == 1 and len(export["evaluations"]) == 1
    gone = await client.request("DELETE", "/api/v1/me", json={"confirm": "DELETE"}, headers=h)
    assert gone.status_code == 204 and not (recordings / u.id).exists()


@pytest.mark.integration
async def test_withdrawn_consent_and_daily_limit(
    client: AsyncClient,
    make_user,
    recordings: Path,
    monkeypatch: pytest.MonkeyPatch,  # type: ignore[no-untyped-def]
) -> None:
    u = await make_user()
    h = auth(u.token)
    await client.put("/api/v1/me/consents/recording", json={"granted": True}, headers=h)
    await client.put("/api/v1/me/consents/recording", json={"granted": False}, headers=h)
    qid = await _first(client, h, "repeat_sentence")
    r = await client.post(
        f"/api/v1/speaking/questions/{qid}/recording",
        content=sample_wav(),
        headers={**h, "content-type": "audio/webm;codecs=opus"},
    )
    assert r.status_code == 403

    monkeypatch.setattr(get_settings(), "evaluations_per_day", 1)
    swt = await _first(client, h, "summarize_written_text")
    first = await client.post(
        f"/api/v1/writing/questions/{swt}/submit", json={"text": "One short sentence."}, headers=h
    )
    second = await client.post(f"/api/v1/writing/questions/{swt}/submit", json={"text": "Another."}, headers=h)
    assert first.status_code == 202 and second.status_code == 429
    await _drain(first.json()["id"])
    unknown = await client.get(f"/api/v1/evaluations/{uuid.uuid4()}", headers=h)
    assert unknown.status_code == 404


@pytest.mark.integration
async def test_spoken_prompts_have_speech_text(client: AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    u = await make_user()
    h = auth(u.token)
    rs = await _first(client, h, "repeat_sentence")
    sp = (await client.get(f"/api/v1/practice/questions/{rs}/speech", headers=h)).json()
    assert sp["parts"] and sp["parts"][0].endswith(".")
    sgd = await _first(client, h, "summarize_group_discussion")
    talk = (await client.get(f"/api/v1/practice/questions/{sgd}/speech", headers=h)).json()
    assert len(talk["parts"]) == 3 and talk["transcript"].count(":") >= 3
    r = await client.post("/graphql", json={"query": Q, "variables": {"c": "repeat_sentence"}}, headers=h)
    assert "audio_script" not in r.text  # the sentence to repeat is never in the page
    ra = await _first(client, h, "read_aloud")
    assert (await client.get(f"/api/v1/practice/questions/{ra}/speech", headers=h)).status_code == 404

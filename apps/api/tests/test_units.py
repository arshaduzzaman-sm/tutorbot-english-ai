"""Unit tests that need no database."""

import subprocess
import sys
from datetime import date
from pathlib import Path

import pytest

from app.ai import registry
from app.ai.evaluation.bands import ratio_to_band, word_accuracy
from app.ai.interfaces import LLM, Embedder, FluencyAnalyzer, GrammarChecker, PronunciationAnalyzer, SpeechToText
from app.ai.interfaces.types import EvaluationResult, Transcript, WordTiming
from app.ai.providers.local import LocalProviderNotInstalled
from app.core.ratelimit import RateLimiter
from app.graphql.schema import build_schema
from app.services.progress import AttemptSignal, skill_stats, study_streak, weak_categories

ROOT = Path(__file__).resolve().parents[3]


def test_study_streak() -> None:
    today = date(2026, 11, 22)
    assert study_streak([], today) == 0
    assert study_streak([date(2026, 11, 22), date(2026, 11, 21), date(2026, 11, 20)], today) == 3
    assert study_streak([date(2026, 11, 21), date(2026, 11, 20)], today) == 2  # not broken before today's study
    assert study_streak([date(2026, 11, 22), date(2026, 11, 20)], today) == 1
    assert study_streak([date(2026, 11, 19)], today) == 0


def test_skill_stats_and_empty_state() -> None:
    assert all(s.attempts == 0 and s.accuracy is None for s in skill_stats([]))
    sigs = [
        AttemptSignal("c1", ("reading",), 1.0),
        AttemptSignal("c1", ("reading", "writing"), 0.0),
        AttemptSignal("c2", ("speaking",), None),
    ]
    stats = {s.skill: s for s in skill_stats(sigs)}
    assert stats["reading"].attempts == 2 and stats["reading"].accuracy == 0.5
    assert stats["writing"].accuracy == 0.0
    assert stats["speaking"].attempts == 1 and stats["speaking"].accuracy is None
    assert stats["listening"].attempts == 0


def test_weak_categories_need_three_attempts() -> None:
    sigs = [AttemptSignal("a", ("reading",), 0.2)] * 3 + [AttemptSignal("b", ("reading",), 0.1)] * 2
    sigs += [AttemptSignal("c", ("reading",), 0.9)] * 4
    assert weak_categories(sigs) == [("a", 0.2, 3)]


def test_rate_limiter_window() -> None:
    rl = RateLimiter(limit=2, window_seconds=60)
    assert rl.allow("ip", now=0)[0] and rl.allow("ip", now=1)[0]
    allowed, retry = rl.allow("ip", now=2)
    assert not allowed and retry > 0
    assert rl.allow("other", now=2)[0]
    assert rl.allow("ip", now=61)[0]


def test_word_accuracy_alignment() -> None:
    r = word_accuracy("The cat sat on the mat.", "the cat sat on mat")
    assert r == {"accuracy": 0.8333, "omissions": 1, "insertions": 0, "substitutions": 0, "reference_words": 6}
    r = word_accuracy("one two three", "one too three four")
    assert r["substitutions"] == 1 and r["insertions"] == 1
    assert ratio_to_band(0.9) == "strong" and ratio_to_band(0.1) == "needs_work"


async def test_mock_providers_are_deterministic_and_labelled() -> None:
    stt, pron, flu, gram, emb, llm = (
        registry.speech_to_text(),
        registry.pronunciation(),
        registry.fluency(),
        registry.grammar(),
        registry.embedder(),
        registry.llm(),
    )
    for p, proto in [
        (stt, SpeechToText),
        (pron, PronunciationAnalyzer),
        (flu, FluencyAnalyzer),
        (gram, GrammarChecker),
        (emb, Embedder),
        (llm, LLM),
    ]:
        assert isinstance(p, proto)
    t1, t2 = await stt.transcribe(b"abc"), await stt.transcribe(b"abc")
    assert t1 == t2 and t1.provider == "mock"
    assert (await pron.analyze(b"", "hello world")) == (await pron.analyze(b"", "hello world"))
    g = await gram.check("i have a apple apple")
    assert {i.rule_id for i in g.issues} == {"CAPITAL_I", "A_AN", "REPEATED_WORD"}
    v1, v2, v3 = await emb.embed(["bees pollinate crops", "bees pollinate crops", "stock market news"])
    assert v1 == v2 and sum(a * b for a, b in zip(v1, v3, strict=True)) < 0.99
    assert (await llm.complete("hi")).provider == "mock"
    assert registry.demo_mode() is True


async def test_mock_fluency_from_timestamps() -> None:
    words = [WordTiming(word=w, start=s, end=s + 0.3) for w, s in [("um", 0), ("the", 0.4), ("the", 0.8), ("cat", 2.5)]]
    r = await registry.fluency().analyze(Transcript(text="", words=words, provider="mock"))
    assert (r.filler_count, r.repetition_count, r.long_pause_count) == (1, 1, 1)


def test_evaluation_result_shape_has_no_score_by_default() -> None:
    r = EvaluationResult(
        task_type="read_aloud", criteria=[{"name": "content", "band": "developing"}], confidence=0.5, provider="mock"
    )
    assert r.estimated_score is None
    assert r.disclaimer == "Practice estimate. Not an official PTE score."
    with pytest.raises(ValueError):
        EvaluationResult(task_type="x", criteria=[{"name": "c", "band": "85"}], confidence=0.5, provider="mock")


async def test_local_provider_fails_loudly(monkeypatch: pytest.MonkeyPatch) -> None:
    """Local providers that are not running or installed raise a clear error; they never fake a result."""
    from app.core.config import get_settings

    monkeypatch.setattr(registry, "_choice", lambda cap: "local")
    monkeypatch.setattr(get_settings(), "ollama_url", "http://127.0.0.1:9")
    monkeypatch.setattr(get_settings(), "languagetool_url", "http://127.0.0.1:9")
    assert registry.llm().name == "local"
    with pytest.raises(LocalProviderNotInstalled):
        await registry.llm().complete("hi")
    with pytest.raises(LocalProviderNotInstalled):
        await registry.grammar().check("hi")
    with pytest.raises(LocalProviderNotInstalled):
        await registry.text_to_speech().synthesize("hi")


async def test_graphql_depth_alias_and_introspection_limits() -> None:
    schema = build_schema()  # ENVIRONMENT=test, so introspection is disabled
    too_deep = "query { viewer { recentAttempts { category { skills } } } }"
    from app.core.config import get_settings

    s = get_settings()
    old = s.graphql_max_depth
    s.graphql_max_depth = 2
    try:
        res = await build_schema().execute(too_deep)
        assert res.errors and "exceeds maximum operation depth" in res.errors[0].message
    finally:
        s.graphql_max_depth = old
    aliases = "{ " + " ".join(f"a{i}: learningLevels {{ code }}" for i in range(20)) + " }"
    res = await schema.execute(aliases)
    assert res.errors and "aliases" in res.errors[0].message.lower()
    res = await schema.execute("{ __schema { types { name } } }")
    assert res.errors and "introspection" in res.errors[0].message.lower()


def test_content_is_valid_and_seed_up_to_date() -> None:
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build_seed.py"), "--check"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert r.returncode == 0, r.stderr

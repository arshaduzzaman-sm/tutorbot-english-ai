"""Evaluator unit tests with fixed sample text, transcripts and audio, and their expected outputs (SPEC 14, M3)."""

import io
import math
import struct
import wave

import pytest

from app.ai.evaluation import pipeline, speaking, writing
from app.ai.interfaces.types import FluencyResult, GrammarIssue, PronunciationResult, Transcript, WordTiming
from app.ai.providers.mock import MockFluencyAnalyzer

READ_ALOUD = {"reference_text": "Many cities now plant trees along busy roads."}


def sample_wav(seconds: float = 1.0) -> bytes:
    """Fixed sample audio: a 440 Hz tone, 16 kHz mono, 16-bit. Same bytes every run."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        frames = b"".join(
            struct.pack("<h", int(8000 * math.sin(2 * math.pi * 440 * i / 16000))) for i in range(int(16000 * seconds))
        )
        w.writeframes(frames)
    return buf.getvalue()


def timed(text: str, gap: float = 0.1, word_len: float = 0.3) -> Transcript:
    out, t = [], 0.0
    for w in text.split():
        out.append(WordTiming(word=w, start=t, end=t + word_len))
        t += word_len + gap
    return Transcript(text=text, words=out, provider="mock")


def pron(words: list[str], score: float = 0.9) -> PronunciationResult:
    return PronunciationResult(word_scores={w: score for w in words}, likely_mispronounced=[], provider="mock")


def bands(result) -> dict[str, str]:  # type: ignore[no-untyped-def]
    return {c.name: c.band for c in result.criteria}


async def _fluency(t: Transcript) -> FluencyResult:
    return await MockFluencyAnalyzer().analyze(t)


async def test_read_aloud_perfect_reading_is_strong() -> None:
    t = timed("Many cities now plant trees along busy roads.")
    r = speaking.evaluate("read_aloud", READ_ALOUD, t, await _fluency(t), pron(["many"]), [], "mock")
    assert bands(r) == {"content": "strong", "oral_fluency": "strong", "pronunciation": "strong"}
    assert r.errors == [] and r.estimated_score is None
    assert r.disclaimer == "Practice estimate. Not an official PTE score."


async def test_read_aloud_missed_words_and_hesitation() -> None:
    t = Transcript(
        text="many cities um um plant trees",
        words=[
            WordTiming(word="many", start=0, end=0.3),
            WordTiming(word="cities", start=0.4, end=0.8),
            WordTiming(word="um", start=2.0, end=2.2),
            WordTiming(word="um", start=2.3, end=2.5),
            WordTiming(word="plant", start=4.0, end=4.3),
            WordTiming(word="trees", start=4.4, end=4.7),
        ],
        provider="mock",
    )
    f = await _fluency(t)
    assert (f.long_pause_count, f.filler_count, f.repetition_count) == (2, 2, 1)
    r = speaking.evaluate("read_aloud", READ_ALOUD, t, f, pron(["many"], 0.5), [], "mock")
    content = r.criteria[0]
    assert content.signals["omissions"] == 4 and content.band == "developing"  # 4 of 8 words heard
    assert bands(r)["oral_fluency"] == "needs_work" and bands(r)["pronunciation"] == "developing"
    assert [e.text for e in r.errors if e.type == "omission"] == ["now", "along", "busy", "roads"]
    assert any("phrases" in tip for tip in r.recommendations)


async def test_answer_short_question_is_right_or_wrong() -> None:
    ok = speaking.evaluate(
        "answer_short_question",
        {"accepted": ["three", "3"]},
        timed("Three."),
        await _fluency(timed("Three.")),
        pron([]),
        [],
        "mock",
    )
    no = speaking.evaluate(
        "answer_short_question",
        {"accepted": ["three", "3"]},
        timed("four"),
        await _fluency(timed("four")),
        pron([]),
        [],
        "mock",
    )
    assert bands(ok) == {"content": "strong"} and bands(no) == {"content": "needs_work"}


async def test_silence_gives_no_speech_flag() -> None:
    t = Transcript(text="", provider="mock")
    r = speaking.evaluate("describe_image", {}, t, await _fluency(t), pron([]), [0.9], "mock")
    assert r.flags == ["no_speech"] and all(c.band == "needs_work" for c in r.criteria)


def test_rate_and_coverage_rules() -> None:
    assert speaking.rate_score(130) == 1.0 and speaking.rate_score(40) == 0.0 and 0 < speaking.rate_score(80) < 1
    assert speaking.coverage([0.9, 0.2, 0.6, 0.1]) == 0.5


ESSAY_OK = (
    "Working from home has become common, and many people now ask whether its advantages outweigh its "
    "disadvantages. In my opinion, the benefits are greater, although some problems need careful attention.\n\n"
    "Firstly, remote work saves time. Employees no longer spend hours travelling, so they can use this time for "
    "family, exercise or further study. Moreover, flexible hours allow parents to organise childcare more easily, "
    "which reduces stress. For example, a designer can start early, collect her children from school and finish "
    "her tasks in the evening.\n\n"
    "However, working from home also has disadvantages. Some workers feel isolated because they rarely meet "
    "colleagues, and communication can become slower when every question needs a message. Therefore, companies "
    "should arrange regular meetings and clear online tools so that teams stay connected and projects continue "
    "smoothly. Managers also need to trust their staff and judge results rather than hours.\n\n"
    "In conclusion, while isolation and communication problems are real, they can be reduced with good planning. "
    "Since remote work gives people more time and flexibility, I believe its advantages clearly outweigh its "
    "disadvantages for most office jobs today, especially when employers and employees work together to make "
    "the arrangement fair, productive and healthy for everyone involved in the business."
)


def test_essay_form_and_coherence() -> None:
    n = len(ESSAY_OK.split())
    assert 200 <= n <= 300, n
    r = writing.evaluate("write_essay", ESSAY_OK, [], [0.8, 0.7, 0.6], 0.6, "mock")
    b = bands(r)
    assert b["form"] == "strong" and b["development_structure_coherence"] == "strong"
    assert b["content"] == "strong" and b["spelling"] == "strong" and b["grammar_usage_mechanics"] == "strong"
    assert [c.name for c in r.criteria] == [
        "content",
        "form",
        "development_structure_coherence",
        "grammar_usage_mechanics",
        "general_linguistic_range",
        "vocabulary_range",
        "spelling",
    ]


def test_essay_too_short_off_topic_and_templated() -> None:
    text = (
        "In this day and age, it is a debatable topic. All in all, in a nutshell, "
        "last but not least, the given topic has its own advantages and disadvantages."
    )
    r = writing.evaluate("write_essay", text, [], [0.1, 0.1], 0.05, "mock")
    assert set(r.flags) == {"off_topic", "template_like"}
    assert bands(r)["content"] == "needs_work" and bands(r)["form"] == "needs_work"
    assert "memorised" in r.recommendations[0]


def test_summarize_written_text_one_sentence_rule() -> None:
    good = (
        "Community gardens improve access to fresh food and bring neighbours together, but their reliance on "
        "volunteers and temporary land agreements often makes them hard to sustain."
    )
    two = "Gardens give fresh food. They need volunteers."
    assert writing.form_ratio("summarize_written_text", good)[0] == 1.0
    ratio, sig = writing.form_ratio("summarize_written_text", two)
    assert ratio == 0.0 and sig["one_sentence"] == 0
    r = writing.evaluate("summarize_written_text", good, [], [0.7, 0.6, 0.8], 0.6, "mock")
    assert "spelling" not in bands(r)  # Pearson lists no Spelling trait for this task


def test_grammar_and_spelling_issues_become_errors() -> None:
    text = "The speaker said that i think recieve food waste is a big problem for many homes today in cities. " * 4
    issues = [
        GrammarIssue(offset=22, length=1, message="Use a capital I.", replacements=["I"], rule_id="CAPITAL_I"),
        GrammarIssue(
            offset=30,
            length=7,
            message="Possible spelling mistake.",
            replacements=["receive"],
            rule_id="MORFOLOGIK_RULE_EN_US",
            category="TYPOS",
        ),
    ]
    r = writing.evaluate("summarize_spoken_text", text, issues, [0.6], 0.5, "mock")
    assert [(e.type, e.text, e.correction) for e in r.errors] == [
        ("grammar", "i", "I"),
        ("spelling", "recieve", "receive"),
    ]
    assert next(c for c in r.criteria if c.name == "spelling").signals["errors"] == 1


async def test_pipeline_with_mock_providers_and_fixed_audio() -> None:
    audio = sample_wav()
    assert len(audio) == 32044  # the fixed sample really is fixed
    q = {"content": {}, "answer": READ_ALOUD, "key_points": []}
    result, transcript = await pipeline.evaluate_speaking("read_aloud", q, audio)
    assert transcript == "this is a mock transcript" and result.provider == "mock"
    assert bands(result)["content"] == "needs_work"  # the mock transcript shares no words with the text
    assert result.feedback.startswith("Demo mode")
    q2 = {
        "content": {"prompt": "Working from home: advantages and disadvantages"},
        "answer": {},
        "key_points": ["advantages of remote work", "disadvantages of remote work"],
    }
    essay = await pipeline.evaluate_writing("write_essay", q2, ESSAY_OK)
    assert essay.provider == "mock" and "off_topic" not in essay.flags
    assert {c.name for c in essay.criteria} >= {"content", "form", "spelling"}


async def test_pipeline_rejects_wrong_task() -> None:
    with pytest.raises(ValueError):
        await pipeline.evaluate_writing("read_aloud", {}, "x")

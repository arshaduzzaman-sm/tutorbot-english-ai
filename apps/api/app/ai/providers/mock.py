"""Deterministic mock providers (SPEC 6.1.3).

Same input -> same output, labelled provider="mock". Used by tests, CI and
`make mock`, so the app runs end to end with no models and no API keys.
"""

import hashlib
import math
import re

from app.ai.interfaces.types import (
    FluencyResult,
    GrammarIssue,
    GrammarResult,
    LLMResponse,
    PronunciationResult,
    SpeechAudio,
    Transcript,
    WordTiming,
)

FILLERS = {"um", "uh", "er", "erm", "ah"}
MOCK_TRANSCRIPT = "this is a mock transcript"


def _seed(data: bytes | str) -> int:
    raw = data.encode() if isinstance(data, str) else data
    return int.from_bytes(hashlib.sha256(raw).digest()[:4], "big")


def _words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z']+", text.lower())


class MockSpeechToText:
    name = "mock"

    async def transcribe(self, audio: bytes, *, language: str = "en") -> Transcript:
        words = MOCK_TRANSCRIPT.split()
        timings = [WordTiming(word=w, start=i * 0.4, end=i * 0.4 + 0.3) for i, w in enumerate(words)]
        return Transcript(text=MOCK_TRANSCRIPT, words=timings, language=language, provider="mock")


class MockPronunciationAnalyzer:
    name = "mock"

    async def analyze(self, audio: bytes, reference_text: str) -> PronunciationResult:
        scores = {}
        for w in _words(reference_text):
            scores[w] = round(0.6 + (_seed(w) % 40) / 100, 2)  # 0.60..0.99, stable per word
        weak = sorted(w for w, s in scores.items() if s < 0.7)
        return PronunciationResult(word_scores=scores, likely_mispronounced=weak, provider="mock")


class MockFluencyAnalyzer:
    """Deterministic, timestamp-based calculation; the 'local' version will share this logic."""

    name = "mock"

    async def analyze(self, transcript: Transcript) -> FluencyResult:
        words = transcript.words
        if not words:
            return FluencyResult(
                words_per_minute=0,
                pause_count=0,
                long_pause_count=0,
                filler_count=0,
                repetition_count=0,
                provider="mock",
            )
        duration = max(words[-1].end - words[0].start, 0.001)
        gaps = [b.start - a.end for a, b in zip(words, words[1:], strict=False)]
        tokens = [w.word.lower() for w in words]
        return FluencyResult(
            words_per_minute=round(len(words) / duration * 60, 1),
            pause_count=sum(1 for g in gaps if g >= 0.3),
            long_pause_count=sum(1 for g in gaps if g >= 1.0),
            filler_count=sum(1 for t in tokens if t in FILLERS),
            repetition_count=sum(1 for a, b in zip(tokens, tokens[1:], strict=False) if a == b),
            provider="mock",
        )


class MockTextToSpeech:
    name = "mock"

    async def synthesize(self, text: str, *, voice: str = "default") -> SpeechAudio:
        # 0.1 s of silence per character, 16-bit mono PCM, deterministic.
        samples = 1600 * max(1, len(text))
        return SpeechAudio(audio_bytes=b"\x00\x00" * samples, sample_rate=16000, voice=voice, provider="mock")


class MockGrammarChecker:
    """Flags a few very common beginner errors so the UI has something real to show."""

    name = "mock"
    RULES = [
        (r"\bi\b", "Use a capital letter for the pronoun 'I'.", "I", "CAPITAL_I"),
        (r"\b(\w+) \1\b", "This word is repeated.", "", "REPEATED_WORD"),
        (r"\ba ([aeiou]\w*)", "Use 'an' before a vowel sound.", "an", "A_AN"),
    ]

    async def check(self, text: str, *, language: str = "en-US") -> GrammarResult:
        issues = []
        for pattern, message, repl, rule in self.RULES:
            for m in re.finditer(pattern, text):
                replacement = (
                    f"an {m.group(1)}" if rule == "A_AN" else (m.group(1) if rule == "REPEATED_WORD" else repl)
                )
                issues.append(
                    GrammarIssue(
                        offset=m.start(),
                        length=m.end() - m.start(),
                        message=message,
                        replacements=[replacement],
                        rule_id=rule,
                        category="mock",
                    )
                )
        issues.sort(key=lambda i: i.offset)
        return GrammarResult(issues=issues, provider="mock")


class MockEmbedder:
    """Hashing bag-of-words embedding: similar texts get similar vectors."""

    name = "mock"
    DIM = 64

    async def embed(self, texts: list[str]) -> list[list[float]]:
        out = []
        for t in texts:
            vec = [0.0] * self.DIM
            for w in _words(t):
                vec[_seed(w) % self.DIM] += 1.0
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            out.append([v / norm for v in vec])
        return out


class MockLLM:
    name = "mock"
    model = "mock-llm"

    async def complete(self, prompt: str, *, system: str = "", max_tokens: int = 400) -> LLMResponse:
        text = "Demo mode: AI not connected. This is a sample explanation so you can see where feedback appears."
        return LLMResponse(text=text[: max_tokens * 4], provider="mock", model=self.model)

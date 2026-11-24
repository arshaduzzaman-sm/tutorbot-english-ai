"""Deterministic signal calculations shared by the mock and local providers and the evaluators (SPEC 6.1.4)."""

import math
import re

from app.ai.interfaces.types import FluencyResult, ProviderName, WordTiming

FILLERS = {"um", "uh", "er", "erm", "ah", "hmm"}
WORD = re.compile(r"[A-Za-z']+")


def words(text: str) -> list[str]:
    return [w.strip("'") for w in WORD.findall(text.lower()) if w.strip("'")]


def fluency_from_timings(timings: list[WordTiming], provider: ProviderName) -> FluencyResult:
    """Speech rate, pauses, fillers and repetitions from word timestamps."""
    if not timings:
        return FluencyResult(
            words_per_minute=0, pause_count=0, long_pause_count=0, filler_count=0, repetition_count=0, provider=provider
        )
    duration = max(timings[-1].end - timings[0].start, 0.001)
    gaps = [b.start - a.end for a, b in zip(timings, timings[1:], strict=False)]
    tokens = [w.word.lower().strip(".,!?;:\"'") for w in timings]
    return FluencyResult(
        words_per_minute=round(len(timings) / duration * 60, 1),
        pause_count=sum(1 for g in gaps if g >= 0.3),
        long_pause_count=sum(1 for g in gaps if g >= 1.0),
        filler_count=sum(1 for t in tokens if t in FILLERS),
        repetition_count=sum(1 for a, b in zip(tokens, tokens[1:], strict=False) if a == b),
        provider=provider,
    )


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


def sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    return [p.strip() for p in parts if len(p.strip()) > 2]


def clamp(x: float) -> float:
    return round(max(0.0, min(1.0, x)), 4)

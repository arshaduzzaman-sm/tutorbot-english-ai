"""AI capability interfaces. Each has a local (default) and a mock implementation."""

from typing import Protocol, runtime_checkable

from app.ai.interfaces.types import (
    FluencyResult,
    GrammarResult,
    LLMResponse,
    PronunciationResult,
    SpeechAudio,
    Transcript,
)


@runtime_checkable
class SpeechToText(Protocol):
    name: str

    async def transcribe(self, audio: bytes, *, language: str = "en") -> Transcript: ...


@runtime_checkable
class PronunciationAnalyzer(Protocol):
    name: str

    async def analyze(self, audio: bytes, reference_text: str) -> PronunciationResult: ...


@runtime_checkable
class FluencyAnalyzer(Protocol):
    name: str

    async def analyze(self, transcript: Transcript) -> FluencyResult: ...


@runtime_checkable
class TextToSpeech(Protocol):
    name: str

    async def synthesize(self, text: str, *, voice: str = "default") -> SpeechAudio: ...


@runtime_checkable
class GrammarChecker(Protocol):
    name: str

    async def check(self, text: str, *, language: str = "en-US") -> GrammarResult: ...


@runtime_checkable
class Embedder(Protocol):
    name: str

    async def embed(self, texts: list[str]) -> list[list[float]]: ...


@runtime_checkable
class LLM(Protocol):
    name: str

    async def complete(self, prompt: str, *, system: str = "", max_tokens: int = 400) -> LLMResponse: ...


__all__ = [
    "LLM",
    "Embedder",
    "FluencyAnalyzer",
    "GrammarChecker",
    "PronunciationAnalyzer",
    "SpeechToText",
    "TextToSpeech",
]

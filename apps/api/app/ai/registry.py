"""Chooses AI providers from environment variables (SPEC 6.1.5)."""

from typing import Any

from app.ai.interfaces import (
    LLM,
    Embedder,
    FluencyAnalyzer,
    GrammarChecker,
    PronunciationAnalyzer,
    SpeechToText,
    TextToSpeech,
)
from app.ai.providers import local, mock
from app.core.config import get_settings

_MOCKS: dict[str, Any] = {
    "stt": mock.MockSpeechToText,
    "pronunciation": mock.MockPronunciationAnalyzer,
    "fluency": mock.MockFluencyAnalyzer,
    "tts": mock.MockTextToSpeech,
    "grammar": mock.MockGrammarChecker,
    "embedder": mock.MockEmbedder,
    "llm": mock.MockLLM,
}


_LOCALS: dict[str, Any] = {
    "stt": local.LocalSpeechToText,
    "pronunciation": local.LocalPronunciationAnalyzer,
    "fluency": local.LocalFluencyAnalyzer,
    "tts": local.LocalTextToSpeech,
    "grammar": local.LanguageToolChecker,
    "embedder": local.LocalEmbedder,
    "llm": local.OllamaLLM,
}


def _choice(capability: str) -> str:
    return str(getattr(get_settings(), f"{capability}_provider"))


def _build(capability: str) -> Any:
    if _choice(capability) == "mock":
        return _MOCKS[capability]()
    return _LOCALS[capability]()


def speech_to_text() -> SpeechToText:
    return _build("stt")  # type: ignore[no-any-return]


def pronunciation() -> PronunciationAnalyzer:
    return _build("pronunciation")  # type: ignore[no-any-return]


def fluency() -> FluencyAnalyzer:
    return _build("fluency")  # type: ignore[no-any-return]


def text_to_speech() -> TextToSpeech:
    return _build("tts")  # type: ignore[no-any-return]


def grammar() -> GrammarChecker:
    return _build("grammar")  # type: ignore[no-any-return]


def embedder() -> Embedder:
    return _build("embedder")  # type: ignore[no-any-return]


def llm() -> LLM:
    return _build("llm")  # type: ignore[no-any-return]


def provider_summary() -> dict[str, str]:
    return {cap: _choice(cap) for cap in _MOCKS}


def demo_mode() -> bool:
    """True when any provider is mocked: the UI shows the 'Demo mode' banner."""
    return any(v == "mock" for v in provider_summary().values())

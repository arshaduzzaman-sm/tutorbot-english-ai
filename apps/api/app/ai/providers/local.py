"""Local providers (SPEC 6.2). Heavy libraries are imported lazily, only when a provider is first used.

- Speech-to-text: faster-whisper with word timestamps; its `vad_filter` runs Silero VAD to skip silence.
- Pronunciation: a proxy from Whisper's per-word confidence aligned to the reference text (see docs/DECISIONS.md;
  a wav2vec2 phoneme model is a later upgrade).
- Fluency: the same timestamp calculation as the mock (deterministic).
- Grammar: LanguageTool server over HTTP (docker compose --profile ai).
- Embeddings: sentence-transformers.
- LLM: Ollama over HTTP.
- TTS: Kokoro runs offline in scripts/generate_audio.py only; learners never trigger TTS live.
If something is missing, a clear LocalProviderNotInstalled error says how to install it or to use the mock.
"""

import asyncio
import io
from functools import lru_cache
from typing import Any

import httpx

from app.ai.evaluation.bands import word_accuracy
from app.ai.evaluation.signals import fluency_from_timings, words
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
from app.core.config import get_settings


class LocalProviderNotInstalled(RuntimeError):
    def __init__(self, capability: str, hint: str = "") -> None:
        super().__init__(
            f"The local '{capability}' provider is not available. {hint or 'Install it with `make models`.'} "
            f"Or set {capability.upper()}_PROVIDER=mock."
        )


@lru_cache
def _whisper() -> Any:
    try:
        from faster_whisper import WhisperModel  # type: ignore[import-not-found]
    except ImportError as exc:
        raise LocalProviderNotInstalled("stt", "Run `uv sync --group ai` to install faster-whisper.") from exc
    s = get_settings()
    return WhisperModel(s.whisper_model, device=s.whisper_device, compute_type=s.whisper_compute_type)


def _transcribe_sync(audio: bytes, language: str) -> Transcript:
    segments, _info = _whisper().transcribe(
        io.BytesIO(audio), language=language, word_timestamps=True, vad_filter=True, beam_size=5
    )
    timings: list[WordTiming] = []
    for seg in segments:
        for w in seg.words or []:
            timings.append(
                WordTiming(word=w.word.strip(), start=max(w.start, 0), end=max(w.end, 0), probability=w.probability)
            )
    text = " ".join(t.word for t in timings)
    return Transcript(text=text, words=timings, language=language, provider="local")


class LocalSpeechToText:
    name = "local"

    async def transcribe(self, audio: bytes, *, language: str = "en") -> Transcript:
        return await asyncio.to_thread(_transcribe_sync, audio, language)


class LocalPronunciationAnalyzer:
    """Per-word clarity from Whisper's word probabilities, aligned to the words that should have been said."""

    name = "local"

    async def analyze(self, audio: bytes, reference_text: str) -> PronunciationResult:
        transcript = await LocalSpeechToText().transcribe(audio)
        heard: dict[str, list[float]] = {}
        for t in transcript.words:
            for w in words(t.word):
                heard.setdefault(w, []).append(t.probability if t.probability is not None else 0.5)
        scores: dict[str, float] = {}
        for w in words(reference_text):
            probs = heard.get(w)
            scores[w] = round(probs.pop(0), 3) if probs else 0.3
        if not reference_text.strip() or word_accuracy(reference_text, transcript.text)["reference_words"] == 0:
            scores = {w: round(p[0], 3) for w, p in heard.items() if p}
        weak = sorted(w for w, s in scores.items() if s < 0.6)
        return PronunciationResult(word_scores=scores, likely_mispronounced=weak, provider="local")


class LocalFluencyAnalyzer:
    name = "local"

    async def analyze(self, transcript: Transcript) -> FluencyResult:
        return fluency_from_timings(transcript.words, "local")


class LocalTextToSpeech:
    name = "local"

    async def synthesize(self, text: str, *, voice: str = "default") -> SpeechAudio:
        raise LocalProviderNotInstalled(
            "tts", "Text-to-speech runs offline in scripts/generate_audio.py; the app never calls it live."
        )


class LanguageToolChecker:
    name = "local"

    async def check(self, text: str, *, language: str = "en-US") -> GrammarResult:
        s = get_settings()
        try:
            async with httpx.AsyncClient(timeout=s.ai_timeout_seconds) as client:
                r = await client.post(f"{s.languagetool_url}/v2/check", data={"text": text, "language": language})
                r.raise_for_status()
        except httpx.HTTPError as exc:
            raise LocalProviderNotInstalled(
                "grammar", "Start LanguageTool with `docker compose --profile ai up -d languagetool`."
            ) from exc
        issues = [
            GrammarIssue(
                offset=int(m["offset"]),
                length=int(m["length"]),
                message=str(m.get("message", "")),
                replacements=[str(x["value"]) for x in m.get("replacements", [])[:3]],
                rule_id=str(m.get("rule", {}).get("id", "")),
                category=str(m.get("rule", {}).get("category", {}).get("id", "")),
            )
            for m in r.json().get("matches", [])
        ]
        return GrammarResult(issues=issues, provider="local")


@lru_cache
def _sentence_model() -> Any:
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore[import-not-found]
    except ImportError as exc:
        raise LocalProviderNotInstalled(
            "embedder", "Run `uv sync --group ai` to install sentence-transformers."
        ) from exc
    return SentenceTransformer(get_settings().embedding_model)


class LocalEmbedder:
    name = "local"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        def run() -> list[list[float]]:
            vectors = _sentence_model().encode(texts, normalize_embeddings=True)
            return [[float(x) for x in v] for v in vectors]

        return await asyncio.to_thread(run)


class OllamaLLM:
    name = "local"

    @property
    def model(self) -> str:
        return get_settings().llm_model

    async def complete(self, prompt: str, *, system: str = "", max_tokens: int = 400) -> LLMResponse:
        s = get_settings()
        body = {
            "model": s.llm_model,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "think": False,
            "options": {"num_predict": max_tokens, "temperature": 0.3},
        }
        try:
            async with httpx.AsyncClient(timeout=s.ai_timeout_seconds) as client:
                r = await client.post(f"{s.ollama_url}/api/generate", json=body)
                r.raise_for_status()
        except httpx.HTTPError as exc:
            raise LocalProviderNotInstalled(
                "llm", f"Start Ollama (`docker compose --profile ai up -d ollama`) and pull {s.llm_model}."
            ) from exc
        return LLMResponse(text=str(r.json().get("response", "")).strip(), provider="local", model=s.llm_model)

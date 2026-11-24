"""Shared result types for AI providers and evaluations (SPEC 6.1, 7.2)."""

from typing import Literal

from pydantic import BaseModel, Field

ProviderName = Literal["local", "mock"]
Band = Literal["needs_work", "developing", "good", "strong"]
DISCLAIMER = "Practice estimate. Not an official PTE score."
EVALUATION_MODEL_VERSION = "eval-2026.1"


class WordTiming(BaseModel):
    word: str
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    probability: float | None = None


class Transcript(BaseModel):
    text: str
    words: list[WordTiming] = []
    language: str = "en"
    provider: ProviderName


class PronunciationResult(BaseModel):
    word_scores: dict[str, float]  # word -> 0..1 goodness of pronunciation
    likely_mispronounced: list[str]
    provider: ProviderName


class FluencyResult(BaseModel):
    words_per_minute: float
    pause_count: int
    long_pause_count: int
    filler_count: int
    repetition_count: int
    provider: ProviderName


class GrammarIssue(BaseModel):
    offset: int
    length: int
    message: str
    replacements: list[str] = []
    rule_id: str = ""
    category: str = ""


class GrammarResult(BaseModel):
    issues: list[GrammarIssue]
    provider: ProviderName


class SpeechAudio(BaseModel):
    audio_bytes: bytes
    sample_rate: int
    voice: str
    provider: ProviderName


class LLMResponse(BaseModel):
    text: str
    provider: ProviderName
    model: str


class Criterion(BaseModel):
    name: str
    band: Band
    signals: dict[str, float | int | str | None] = {}
    explanation: str = ""


class EvaluationError(BaseModel):
    type: str
    position: int | None = None
    text: str = ""
    correction: str = ""
    explanation: str = ""


class EvaluationResult(BaseModel):
    """Every evaluation returns this shape (SPEC 7.2). No 10-90 scores until calibrated (SPEC 7.3)."""

    task_type: str
    criteria: list[Criterion]
    errors: list[EvaluationError] = []
    strengths: list[str] = []
    weaknesses: list[str] = []
    recommendations: list[str] = []
    flags: list[str] = []  # e.g. "off_topic", "template_like", "no_speech"
    feedback: str = ""  # friendly text written by the LLM from the signals; it never sets the bands
    confidence: float = Field(ge=0, le=1)
    provider: ProviderName
    evaluation_model_version: str = EVALUATION_MODEL_VERSION
    estimated_score: int | None = None
    disclaimer: str = DISCLAIMER

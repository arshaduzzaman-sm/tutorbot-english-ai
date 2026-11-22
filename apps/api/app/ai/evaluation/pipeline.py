"""Runs one evaluation end to end with the configured providers (SPEC 7.1).

1 audio check -> 2 transcription -> 3-5 text, pronunciation and fluency signals -> 6 task evaluator
-> 7 LLM feedback text (explains the bands, never sets them). Step 8 (storage) is in services/evaluate.py.
"""

import json
from typing import Any

from app.ai import registry
from app.ai.evaluation import speaking, writing
from app.ai.evaluation.signals import cosine, sentences
from app.ai.interfaces.types import EvaluationResult, ProviderName

FEEDBACK_SYSTEM = (
    "You are a kind English teacher. Explain practice results to a learner in simple English, in 3 to 5 short "
    "sentences. Use only the facts given. Do not give any number score, do not promise exam results, and do not "
    "mention PTE scores."
)


async def _similarities(points: list[str], response: str) -> tuple[list[float], float, str]:
    """Best match of each key point against the response's sentences, and the whole-response similarity."""
    emb = registry.embedder()
    parts = sentences(response) or [response]
    vectors = await emb.embed([*points, *parts, response])
    kp, rs, whole = vectors[: len(points)], vectors[len(points) : -1], vectors[-1]
    sims = [round(max(cosine(k, r) for r in rs), 4) for k in kp] if rs else [0.0 for _ in kp]
    topic = round(max((cosine(k, whole) for k in kp), default=0.0), 4)
    return sims, topic, getattr(emb, "name", "mock")


def _provider(*names: str) -> ProviderName:
    return "mock" if any(n == "mock" for n in names) else "local"


async def add_feedback(result: EvaluationResult) -> EvaluationResult:
    facts = {
        "task": result.task_type,
        "criteria": [{"name": c.name, "band": c.band, "explanation": c.explanation} for c in result.criteria],
        "flags": result.flags,
    }
    llm = registry.llm()
    out = await llm.complete("Practice results:\n" + json.dumps(facts), system=FEEDBACK_SYSTEM, max_tokens=250)
    result.feedback = out.text.strip()
    if out.provider == "mock":
        result.provider = "mock"
    return result


async def evaluate_writing(task: str, question: dict[str, Any], text: str) -> EvaluationResult:
    if task not in writing.WRITING_TYPES:
        raise ValueError(f"{task} is not a writing task")
    content = dict(question.get("content") or {})
    points = writing.key_point_texts(dict(question.get("answer") or {}), list(question.get("key_points") or []))
    topic_text = str(content.get("prompt") or content.get("passage") or content.get("audio_script") or "")
    if not points:
        points = sentences(topic_text) or [topic_text]
    sims, topic, emb_name = await _similarities(points, text)
    if task == "write_essay":
        # Essays: on topic means close to the prompt, not to a model answer.
        _, topic, _ = await _similarities([topic_text], text)
    checker = registry.grammar()
    issues = (await checker.check(text)).issues
    result = writing.evaluate(task, text, issues, sims, topic, _provider(emb_name, checker.name))
    return await add_feedback(result)


async def evaluate_speaking(task: str, question: dict[str, Any], audio: bytes) -> tuple[EvaluationResult, str]:
    if task not in speaking.SPEAKING_TYPES:
        raise ValueError(f"{task} is not a speaking task")
    answer = dict(question.get("answer") or {})
    stt, flu, pron = registry.speech_to_text(), registry.fluency(), registry.pronunciation()
    transcript = await stt.transcribe(audio)
    fluency = await flu.analyze(transcript)
    reference = str(answer.get("reference_text") or transcript.text)
    pronunciation = await pron.analyze(audio, reference)
    sims: list[float] = []
    emb_name = "local"
    if task not in speaking.REFERENCE_TYPES and task != "answer_short_question":
        points = writing.key_point_texts(answer, list(question.get("key_points") or []))
        sims, _, emb_name = await _similarities(points, transcript.text)
    provider = _provider(stt.name, flu.name, pron.name, emb_name)
    result = speaking.evaluate(task, answer, transcript, fluency, pronunciation, sims, provider)
    return await add_feedback(result), transcript.text

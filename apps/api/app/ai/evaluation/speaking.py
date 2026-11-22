"""Speaking evaluators (SPEC 7.1 steps 3-6). Pure functions: signals in, bands out. Unit-tested.

Criterion names follow the trait names on Pearson's test-format page (Content, Oral fluency, Pronunciation; checked
2026-11-22). Answer Short Question is "scored as either correct or incorrect", so it has one Content criterion. How we
turn signals into bands is our own practice method, NOT Pearson's scoring: results are labelled a practice estimate.
"""

from typing import Any

from app.ai.evaluation.bands import ratio_to_band, word_accuracy
from app.ai.evaluation.signals import FILLERS, clamp, words
from app.ai.interfaces.types import (
    Criterion,
    EvaluationError,
    EvaluationResult,
    FluencyResult,
    PronunciationResult,
    ProviderName,
    Transcript,
)

SPEAKING_TYPES = {
    "read_aloud",
    "repeat_sentence",
    "describe_image",
    "retell_lecture",
    "answer_short_question",
    "summarize_group_discussion",
    "respond_to_situation",
}
REFERENCE_TYPES = {"read_aloud", "repeat_sentence"}
# Longest recording we accept per task, in seconds. Speaking times come from Pearson's test-format page
# (checked 2026-11-22); Read Aloud "varies by item", so we allow 60 s. A small margin covers start/stop delay.
MAX_SECONDS = {
    "read_aloud": 60,
    "repeat_sentence": 20,
    "describe_image": 45,
    "retell_lecture": 45,
    "answer_short_question": 15,
    "summarize_group_discussion": 125,
    "respond_to_situation": 45,
}
# Comfortable speaking rate band in words per minute. Our own practice heuristic, not a Pearson rule.
WPM_LOW, WPM_HIGH = 100.0, 170.0


def rate_score(wpm: float) -> float:
    if WPM_LOW <= wpm <= WPM_HIGH:
        return 1.0
    if wpm < WPM_LOW:
        return clamp((wpm - 40) / (WPM_LOW - 40))
    return clamp(1 - (wpm - WPM_HIGH) / 90)


def fluency_ratio(f: FluencyResult) -> float:
    penalty = min(0.6, 0.12 * f.long_pause_count + 0.06 * f.filler_count + 0.06 * f.repetition_count)
    return clamp(rate_score(f.words_per_minute) * (1 - penalty))


def coverage(similarities: list[float], threshold: float = 0.5) -> float:
    """Share of key points that the response covers (best sentence similarity >= threshold)."""
    if not similarities:
        return 0.0
    return clamp(sum(1 for s in similarities if s >= threshold) / len(similarities))


def _content(
    task: str, answer: dict[str, Any], spoken: str, key_point_sims: list[float]
) -> tuple[float, dict[str, Any]]:
    if task in REFERENCE_TYPES:
        clean = " ".join(w for w in words(spoken) if w not in FILLERS)  # fillers count in fluency, not content
        acc = word_accuracy(str(answer.get("reference_text", "")), clean)
        return float(acc["accuracy"]), dict(acc)
    if task == "answer_short_question":
        said = set(words(spoken))
        ok = any(set(words(str(a))) <= said and words(str(a)) for a in answer.get("accepted", []))
        return (1.0 if ok else 0.0), {"accepted_answer_heard": int(ok)}
    cov = coverage(key_point_sims)
    return cov, {"key_points": len(key_point_sims), "key_points_covered": round(cov * len(key_point_sims))}


def evaluate(
    task: str,
    answer: dict[str, Any],
    transcript: Transcript,
    fluency: FluencyResult,
    pronunciation: PronunciationResult,
    key_point_sims: list[float],
    provider: ProviderName,
) -> EvaluationResult:
    spoken = transcript.text.strip()
    if not words(spoken):
        crit0 = [Criterion(name=n, band="needs_work", signals={"ratio": 0.0}) for n in ("content", "oral_fluency")]
        return EvaluationResult(
            task_type=task,
            criteria=crit0,
            weaknesses=["We could not hear any words in the recording."],
            recommendations=["Check your microphone, speak a little louder and start speaking after the tone."],
            flags=["no_speech"],
            confidence=0.2,
            provider=provider,
        )

    content_ratio, content_signals = _content(task, answer, spoken, key_point_sims)
    crit: list[Criterion] = []
    crit.append(
        Criterion(
            name="content",
            band=ratio_to_band(content_ratio),
            signals={"ratio": content_ratio, **content_signals},
            explanation=_content_text(task, content_ratio),
        )
    )
    errors: list[EvaluationError] = []
    if task != "answer_short_question":
        fr = fluency_ratio(fluency)
        crit.append(
            Criterion(
                name="oral_fluency",
                band=ratio_to_band(fr),
                signals={
                    "ratio": fr,
                    "words_per_minute": fluency.words_per_minute,
                    "long_pauses": fluency.long_pause_count,
                    "fillers": fluency.filler_count,
                    "repetitions": fluency.repetition_count,
                },
                explanation=(
                    f"You spoke at about {round(fluency.words_per_minute)} words per minute with "
                    f"{fluency.long_pause_count} long pause(s) and {fluency.filler_count} filler word(s)."
                ),
            )
        )
        scores = list(pronunciation.word_scores.values())
        pr = clamp(sum(scores) / len(scores)) if scores else 0.0
        crit.append(
            Criterion(
                name="pronunciation",
                band=ratio_to_band(pr),
                signals={"ratio": pr, "likely_mispronounced": len(pronunciation.likely_mispronounced)},
                explanation=(
                    "Words that may not have been clear: " + ", ".join(pronunciation.likely_mispronounced[:8])
                    if pronunciation.likely_mispronounced
                    else "Most words sounded clear."
                ),
            )
        )
        errors += [
            EvaluationError(type="pronunciation", text=w, explanation="This word may not have been clear.")
            for w in pronunciation.likely_mispronounced[:10]
        ]
    if task in REFERENCE_TYPES:
        errors += _missed_words(str(answer.get("reference_text", "")), spoken)

    strengths = [_label(c.name) for c in crit if c.band in ("good", "strong")]
    weaknesses = [_label(c.name) for c in crit if c.band in ("needs_work", "developing")]
    return EvaluationResult(
        task_type=task,
        criteria=crit,
        errors=errors[:20],
        strengths=[f"{s}: well done." for s in strengths],
        weaknesses=[f"{w}: needs more practice." for w in weaknesses],
        recommendations=_tips(task, crit),
        confidence=0.4 if provider == "mock" else 0.7,
        provider=provider,
    )


def _missed_words(reference: str, spoken: str) -> list[EvaluationError]:
    said = words(spoken)
    out = []
    for i, w in enumerate(words(reference)):
        if w in said:
            said.remove(w)
        else:
            out.append(EvaluationError(type="omission", position=i, text=w, explanation="This word was not heard."))
    return out


LABELS = {
    "content": "Content",
    "oral_fluency": "Oral fluency",
    "pronunciation": "Pronunciation",
}


def _label(name: str) -> str:
    return LABELS.get(name, name.replace("_", " ").capitalize())


def _content_text(task: str, ratio: float) -> str:
    pct = round(ratio * 100)
    if task in REFERENCE_TYPES:
        return f"About {pct}% of the words in the text were heard in your recording."
    if task == "answer_short_question":
        return "Your answer matched an expected answer." if ratio else "Your answer did not match an expected answer."
    return f"Your answer covered about {pct}% of the main points."


def _tips(task: str, crit: list[Criterion]) -> list[str]:
    weak = {c.name for c in crit if c.band in ("needs_work", "developing")}
    tips = []
    if "content" in weak and task in REFERENCE_TYPES:
        tips.append("Say every word. If you make a mistake, keep going: do not go back.")
    elif "content" in weak and task != "answer_short_question":
        tips.append("Plan two or three main points while you prepare, then say each one in a short sentence.")
    if "oral_fluency" in weak:
        tips.append("Speak in phrases at a steady speed. Avoid long pauses and words like 'um'.")
    if "pronunciation" in weak:
        tips.append("Practise the highlighted words slowly, then at normal speed.")
    if "content" in weak and task == "answer_short_question":
        tips = ["Answer with the one or few words that name the thing. Keep it short."]
    return tips or ["Good work. Try a harder question next."]

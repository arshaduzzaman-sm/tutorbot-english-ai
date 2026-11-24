"""Writing evaluators: Summarize Written Text, Write Essay, Summarize Spoken Text (SPEC 5 Module 6, 7.1).

Pure functions: text + grammar issues + similarities in, bands out. Criterion names follow the trait names on
Pearson's test-format pages (checked 2026-11-22). Word limits are the published ones:
  Summarize Written Text: one sentence, 5-75 words.  Write Essay: 200-300 words.  Summarize Spoken Text: 50-70 words.
How we turn the signals into bands is our own practice method, NOT Pearson's scoring.
"""

import re
from typing import Any

from app.ai.evaluation.bands import ratio_to_band
from app.ai.evaluation.signals import clamp, sentences, words
from app.ai.interfaces.types import Criterion, EvaluationError, EvaluationResult, GrammarIssue, ProviderName

WRITING_TYPES = {"summarize_written_text", "write_essay", "summarize_spoken_text"}
WORD_LIMITS = {"summarize_written_text": (5, 75), "write_essay": (200, 300), "summarize_spoken_text": (50, 70)}
MAX_CHARS = 4000
LINKERS = {
    "however",
    "therefore",
    "moreover",
    "furthermore",
    "although",
    "because",
    "while",
    "whereas",
    "firstly",
    "secondly",
    "finally",
    "consequently",
    "instead",
    "overall",
    "conclusion",
    "example",
    "addition",
    "similarly",
    "nevertheless",
    "despite",
    "since",
    "thus",
    "but",
    "also",
}
# Phrases that appear in memorised "template" answers shared online. Using a few is fine; many is a warning sign.
TEMPLATE_PHRASES = (
    "in this day and age",
    "it is a debatable topic",
    "has its own advantages and disadvantages",
    "in a nutshell",
    "this essay will discuss",
    "the given topic",
    "there are many reasons for this",
    "it is a matter of debate",
    "all in all",
    "last but not least",
)
OFF_TOPIC_BELOW = 0.15


def is_spelling(issue: GrammarIssue) -> bool:
    return issue.category.upper() in {"TYPOS", "SPELLING"} or issue.rule_id.upper().startswith(
        ("MORFOLOGIK", "HUNSPELL", "SPELL")
    )


def form_ratio(task: str, text: str) -> tuple[float, dict[str, Any]]:
    n = len(words(text))
    low, high = WORD_LIMITS[task]
    signals: dict[str, Any] = {"word_count": n, "min_words": low, "max_words": high}
    if task == "summarize_written_text":
        ends = len(re.findall(r"[.!?](\s|$)", text.strip()))
        one_sentence = ends <= 1 and text.strip()[-1:] in ".!?"
        signals["one_sentence"] = int(one_sentence)
        return (1.0 if low <= n <= high and one_sentence else 0.0), signals
    if low <= n <= high:
        return 1.0, signals
    if task == "write_essay" and (120 <= n < low or high < n <= 380):
        return 0.5, signals
    if task == "summarize_spoken_text" and (40 <= n < low or high < n <= 100):
        return 0.5, signals
    return 0.0, signals


def vocabulary_ratio(text: str) -> tuple[float, dict[str, Any]]:
    ws = words(text)
    if not ws:
        return 0.0, {"unique_ratio": 0, "long_word_share": 0}
    unique = len(set(ws)) / len(ws)
    long_share = sum(1 for w in ws if len(w) >= 7) / len(ws)
    ratio = clamp(min(1, unique / 0.6) * 0.6 + min(1, long_share / 0.2) * 0.4)
    return ratio, {"unique_ratio": round(unique, 3), "long_word_share": round(long_share, 3)}


def coherence_ratio(text: str) -> tuple[float, dict[str, Any]]:
    paragraphs = [p for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    linkers = sum(1 for w in words(text) if w in LINKERS)
    ratio = clamp(min(1, len(paragraphs) / 4) * 0.5 + min(1, linkers / 6) * 0.5)
    return ratio, {"paragraphs": len(paragraphs), "linking_words": linkers}


def template_hits(text: str) -> int:
    low = text.lower()
    return sum(1 for p in TEMPLATE_PHRASES if p in low)


def evaluate(
    task: str,
    text: str,
    issues: list[GrammarIssue],
    key_point_sims: list[float],
    topic_similarity: float,
    provider: ProviderName,
) -> EvaluationResult:
    n = max(len(words(text)), 1)
    flags: list[str] = []
    if topic_similarity < OFF_TOPIC_BELOW:
        flags.append("off_topic")
    templ = template_hits(text)
    if templ >= 3:
        flags.append("template_like")

    covered = sum(1 for s in key_point_sims if s >= 0.5)
    content = clamp(covered / len(key_point_sims)) if key_point_sims else clamp(topic_similarity * 2)
    if "off_topic" in flags:
        content = 0.0
    fr, form_signals = form_ratio(task, text)
    spelling = [i for i in issues if is_spelling(i)]
    grammar = [i for i in issues if not is_spelling(i)]
    gr = clamp(1 - (len(grammar) / n * 100) / 10)
    vr, vocab_signals = vocabulary_ratio(text)

    crit = [
        Criterion(
            name="content",
            band=ratio_to_band(content),
            signals={
                "ratio": content,
                "key_points": len(key_point_sims),
                "key_points_covered": covered,
                "topic_similarity": round(topic_similarity, 3),
            },
            explanation=(
                "Your answer does not seem to be about the topic."
                if "off_topic" in flags
                else f"You covered {covered} of {len(key_point_sims)} main points."
                if key_point_sims
                else "How closely your answer stays on the topic."
            ),
        ),
        Criterion(
            name="form",
            band=ratio_to_band(fr),
            signals={"ratio": fr, **form_signals},
            explanation=_form_text(task, form_signals),
        ),
        Criterion(
            name="grammar",
            band=ratio_to_band(gr),
            signals={"ratio": gr, "issues": len(grammar)},
            explanation=f"{len(grammar)} grammar issue(s) found." if grammar else "No grammar issues were found.",
        ),
    ]
    if task == "write_essay":
        crit[2].name = "grammar_usage_mechanics"
        cr, coh = coherence_ratio(text)
        crit.insert(
            2,
            Criterion(
                name="development_structure_coherence",
                band=ratio_to_band(cr),
                signals={"ratio": cr, **coh},
                explanation=f"{coh['paragraphs']} paragraph(s) and {coh['linking_words']} linking "
                "word(s). Aim for an introduction, two or three body paragraphs and a conclusion.",
            ),
        )
        crit.append(
            Criterion(
                name="general_linguistic_range",
                band=ratio_to_band(min(vr, gr)),
                signals={"ratio": min(vr, gr)},
                explanation="How varied and accurate your sentences and words are.",
            )
        )
        crit.append(
            Criterion(
                name="vocabulary_range",
                band=ratio_to_band(vr),
                signals={"ratio": vr, **vocab_signals},
                explanation=_vocab_text(vocab_signals),
            )
        )
    else:
        crit.append(
            Criterion(
                name="vocabulary",
                band=ratio_to_band(vr),
                signals={"ratio": vr, **vocab_signals},
                explanation=_vocab_text(vocab_signals),
            )
        )
    if task in ("write_essay", "summarize_spoken_text"):
        sr = clamp(1 - len(spelling) * (0.1 if task == "write_essay" else 0.25))
        crit.append(
            Criterion(
                name="spelling",
                band=ratio_to_band(sr),
                signals={"ratio": sr, "errors": len(spelling)},
                explanation=f"{len(spelling)} spelling mistake(s)." if spelling else "No spelling mistakes were found.",
            )
        )

    errors = [
        EvaluationError(
            type="spelling" if is_spelling(i) else "grammar",
            position=i.offset,
            text=text[i.offset : i.offset + i.length],
            correction=i.replacements[0] if i.replacements else "",
            explanation=i.message,
        )
        for i in issues[:30]
    ]
    weak = [c for c in crit if c.band in ("needs_work", "developing")]
    recommendations = [_TIPS[c.name] for c in weak if c.name in _TIPS]
    if "template_like" in flags:
        recommendations.insert(0, "Your answer uses many memorised phrases. Write your own sentences about this topic.")
    return EvaluationResult(
        task_type=task,
        criteria=crit,
        errors=errors,
        strengths=[f"{_label(c.name)}: well done." for c in crit if c.band in ("good", "strong")],
        weaknesses=[f"{_label(c.name)}: needs more practice." for c in weak],
        recommendations=recommendations or ["Good work. Try a harder question next."],
        flags=flags,
        confidence=0.4 if provider == "mock" else 0.7,
        provider=provider,
    )


def _form_text(task: str, s: dict[str, Any]) -> str:
    base = f"{s['word_count']} words (the task asks for {s['min_words']} to {s['max_words']})."
    if task == "summarize_written_text":
        return base + (" One sentence: yes." if s.get("one_sentence") else " Write exactly one sentence.")
    return base


def _vocab_text(s: dict[str, Any]) -> str:
    return (
        f"{round(s['unique_ratio'] * 100)}% of your words are different words; "
        f"{round(s['long_word_share'] * 100)}% are longer words."
    )


_TIPS = {
    "content": "List the main points first, then make sure each one is in your answer.",
    "form": "Check the word count and, for Summarize Written Text, write one sentence only.",
    "grammar": "Read your answer again slowly and fix each highlighted grammar issue.",
    "spelling": "Check the spelling of every word, especially the highlighted ones.",
    "vocabulary": "Use exact words from the topic, and avoid repeating the same word many times.",
    "vocabulary_range": "Use a wider range of words. Replace repeated words with synonyms.",
    "development_structure_coherence": "Use paragraphs and linking words (however, therefore, for example).",
    "grammar_usage_mechanics": "Read your essay again slowly and fix each highlighted grammar issue.",
    "general_linguistic_range": "Mix short and longer sentences, and use a few different structures.",
}
LABELS = {
    "development_structure_coherence": "Development, structure and coherence",
    "general_linguistic_range": "General linguistic range",
    "vocabulary_range": "Vocabulary range",
    "grammar_usage_mechanics": "Grammar usage and mechanics",
}


def _label(name: str) -> str:
    return LABELS.get(name, name.replace("_", " ").capitalize())


def key_point_texts(answer: dict[str, Any], key_points: list[str]) -> list[str]:
    """What the content check compares against: the question's key points, else model answer sentences."""
    if key_points:
        return key_points
    return sentences(str(answer.get("model_answer", "")))

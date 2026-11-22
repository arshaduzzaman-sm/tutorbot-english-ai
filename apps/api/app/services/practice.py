"""Question practice: auto-marking for objective tasks and attempt recording (SPEC 5A.3, Modules 7-8).

Marking here is our own simple practice method (share of correct parts). It is NOT official PTE scoring.
"""

import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError

BLANKS = {"rw_fill_blanks", "reading_fill_blanks", "listening_fill_blanks"}
SINGLE = {"reading_mc_single", "listening_mc_single", "highlight_correct_summary", "select_missing_word"}
MULTIPLE = {"reading_mc_multiple", "listening_mc_multiple"}
# Task types this module can mark. Summaries, speaking and writing need the AI evaluators (M3).
AUTO_MARKED = BLANKS | SINGLE | MULTIPLE | {"reorder_paragraphs", "highlight_incorrect_words", "write_from_dictation"}
LISTENING = {
    "listening_fill_blanks",
    "listening_mc_single",
    "listening_mc_multiple",
    "highlight_correct_summary",
    "select_missing_word",
    "highlight_incorrect_words",
    "write_from_dictation",
    "summarize_spoken_text",
}
MODES = {"learn", "practice"}


@dataclass(frozen=True)
class Marking:
    score_ratio: float
    is_correct: bool
    correct_answer: dict[str, Any]
    parts: list[dict[str, Any]] = field(default_factory=list)


def _norm(v: Any) -> str:
    return " ".join(str(v).strip().split()).lower()


def mark_blanks(expected: dict[str, str], given: dict[str, str]) -> Marking:
    parts = [
        {"key": k, "correct": _norm(given.get(k, "")) == _norm(v), "expected": v, "given": given.get(k)}
        for k, v in sorted(expected.items(), key=lambda kv: int(kv[0]) if kv[0].isdigit() else kv[0])
    ]
    right = sum(1 for p in parts if p["correct"])
    total = max(len(parts), 1)
    return Marking(right / total, right == len(parts), {"blanks": expected}, parts)


def mark_choices(correct: list[str], chosen: list[str], *, single: bool) -> Marking:
    """Single: right or wrong. Multiple: +1 per right choice, -1 per wrong choice, never below 0."""
    want, got = set(correct), set(chosen)
    if single:
        ok = len(got) == 1 and got == want
        return Marking(1.0 if ok else 0.0, ok, {"correct": sorted(want)})
    points = max(len(got & want) - len(got - want), 0)
    parts = [{"key": c, "correct": c in want, "selected": c in got} for c in sorted(want | got)]
    return Marking(points / max(len(want), 1), got == want, {"correct": sorted(want)}, parts)


def mark_order(expected: list[str], given: list[str]) -> Marking:
    """Share of neighbouring pairs in the right order (so one misplaced box does not lose everything)."""
    want = {(a, b) for a, b in zip(expected, expected[1:], strict=False)}
    pairs = list(zip(given, given[1:], strict=False))
    parts = [{"key": f"{a}>{b}", "correct": (a, b) in want} for a, b in pairs]
    right = sum(1 for p in parts if p["correct"])
    ok = list(given) == list(expected)
    return Marking(right / max(len(want), 1), ok, {"order": expected}, parts)


def mark_highlights(wrong_words: list[dict[str, Any]], chosen: list[int]) -> Marking:
    """+1 for each wrongly transcribed word found, -1 for each correct word clicked, never below 0."""
    want = {int(w["index"]) for w in wrong_words}
    got = set(chosen)
    points = max(len(got & want) - len(got - want), 0)
    parts = [{"key": i, "correct": i in want, "selected": i in got} for i in sorted(want | got)]
    return Marking(points / max(len(want), 1), got == want, {"incorrect_words": wrong_words}, parts)


def _words(value: str) -> list[str]:
    return [w for w in (c.strip(".,!?;:\"'()").lower() for c in value.split()) if w]


def mark_dictation(reference: str, typed: str) -> Marking:
    """Share of the sentence's words that the learner wrote (spelling counts; order and punctuation do not)."""
    pool = _words(typed)
    parts = []
    for w in _words(reference):
        found = w in pool
        if found:
            pool.remove(w)
        parts.append({"key": w, "correct": found})
    right = sum(1 for p in parts if p["correct"])
    return Marking(right / max(len(parts), 1), right == len(parts), {"reference_text": reference}, parts)


def mark(category: str, answer: dict[str, Any], response: dict[str, Any]) -> Marking:
    if category not in AUTO_MARKED:
        raise AppError(422, "not_auto_marked", "This task type cannot be marked automatically yet.")
    try:
        if category in BLANKS:
            return mark_blanks(answer["blanks"], {str(k): str(v) for k, v in dict(response.get("blanks", {})).items()})
        if category in SINGLE | MULTIPLE:
            chosen = [str(c) for c in list(response.get("selected", []))]
            return mark_choices(answer["correct"], chosen, single=category in SINGLE)
        if category == "highlight_incorrect_words":
            return mark_highlights(answer["incorrect_words"], [int(i) for i in list(response.get("indices", []))])
        if category == "write_from_dictation":
            typed = response.get("text", "")
            if not isinstance(typed, str):
                raise TypeError("text must be a string")
            return mark_dictation(str(answer["reference_text"]), typed)
        return mark_order(answer["order"], [str(p) for p in list(response.get("order", []))])
    except (TypeError, ValueError, AttributeError) as exc:
        raise AppError(422, "bad_response", "The answer is not in the expected shape.") from exc


def public_content(category: str, content: dict[str, Any]) -> dict[str, Any]:
    """Content learners may see before answering. The audio script never goes in the page (it can hold the answer)."""
    allowed = {"text", "blanks", "word_bank", "passage", "question", "paragraphs", "transcript"}
    return {k: v for k, v in content.items() if k in allowed}


async def answer_question(
    session: AsyncSession,
    user_id: str,
    question_id: uuid.UUID,
    response: dict[str, Any],
    mode: str,
    duration_seconds: int | None,
) -> dict[str, Any]:
    if mode not in MODES:
        raise AppError(422, "bad_mode", "Mode must be learn or practice.")
    row = (
        (
            await session.execute(
                text(
                    "select q.id, q.category_id, c.code, q.answer, q.explanation from public.questions q "
                    "join public.question_categories c on c.id = q.category_id "
                    "where q.id = :id and q.status = 'published' and q.deleted_at is null"
                ),
                {"id": question_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "question_not_found", "Question not found.")
    m = mark(row["code"], dict(row["answer"]), response)
    await session.execute(
        text(
            "insert into public.attempts "
            "(user_id, question_id, category_id, mode, is_correct, score_ratio, duration_seconds) "
            "values (:u, :q, :c, cast(:m as public.practice_mode), :ok, :s, :d)"
        ),
        {
            "u": user_id,
            "q": row["id"],
            "c": row["category_id"],
            "m": mode,
            "ok": m.is_correct,
            "s": round(m.score_ratio, 4),
            "d": duration_seconds,
        },
    )
    return {
        "score_ratio": m.score_ratio,
        "is_correct": m.is_correct,
        "correct_answer": m.correct_answer,
        "parts": m.parts,
        "explanation": row["explanation"],
        "note": "Practice marking: our own simple method, not an official PTE score.",
    }


async def speech(session: AsyncSession, question_id: uuid.UUID) -> dict[str, Any]:
    """What the audio says, for the browser's speech voice and the Learn-mode transcript.

    Split at [BEEP] so the player can sound a tone where a word is missing (Select Missing Word).
    """
    row = (
        (
            await session.execute(
                text(
                    "select q.external_id, c.code, q.content->>'audio_script' as script from public.questions q "
                    "join public.question_categories c on c.id = q.category_id "
                    "where q.id = :id and q.status = 'published' and q.deleted_at is null"
                ),
                {"id": question_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None or row["code"] not in LISTENING or not row["script"]:
        raise AppError(404, "audio_not_found", "This question has no audio.")
    script = str(row["script"])
    return {
        "external_id": row["external_id"],
        "parts": [p.strip() for p in script.split("[BEEP]")],
        "transcript": script.replace("[BEEP]", "…"),
    }

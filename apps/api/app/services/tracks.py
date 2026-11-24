"""Vocabulary flashcards and pronunciation drills (SPEC 5A.1).

Vocabulary uses the same spaced-review steps as the mistake notebook (review.next_step).
Pronunciation drills are auto-marked listen-and-choose or choose items; speaking checks arrive in M3.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.services.lessons import normalize
from app.services.review import next_step


async def review_word(
    session: AsyncSession, user_id: str, word_id: uuid.UUID, known: bool, now: datetime
) -> dict[str, Any]:
    """Record one flashcard answer. A new card starts in box 0; 'known' moves it up, 'not yet' sends it back."""
    exists = (
        await session.execute(text("select 1 from public.vocabulary where id = :id"), {"id": word_id})
    ).scalar_one_or_none()
    if exists is None:  # RLS hides unpublished words
        raise AppError(404, "word_not_found", "Word not found.")
    row = (
        (
            await session.execute(
                text(
                    "select box, mastered_at from public.vocabulary_reviews where user_id = :u and vocabulary_id = :w"
                ),
                {"u": user_id, "w": word_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    box = 0 if row is None or row["mastered_at"] is not None else int(row["box"])
    step = next_step(box, known, now)
    await session.execute(
        text(
            """insert into public.vocabulary_reviews
                 (user_id, vocabulary_id, box, due_at, times_seen, times_known, mastered_at)
               values (:u, :w, :b, :d, 1, :k, :m)
               on conflict (user_id, vocabulary_id) do update set
                 box = excluded.box, due_at = excluded.due_at, mastered_at = excluded.mastered_at,
                 times_seen = vocabulary_reviews.times_seen + 1,
                 times_known = vocabulary_reviews.times_known + excluded.times_known"""
        ),
        {
            "u": user_id,
            "w": word_id,
            "b": step.box,
            "d": step.due_at,
            "k": 1 if known else 0,
            "m": now if step.mastered else None,
        },
    )
    return {"box": step.box, "due_at": step.due_at, "mastered": step.mastered}


def public_drill_item(item: dict[str, Any]) -> dict[str, Any]:
    """What the page may show: never the answer, the explanation or the word that will be spoken."""
    return {k: item[k] for k in ("id", "type", "prompt", "options") if k in item}


def mark_drill(items: list[dict[str, Any]], answers: dict[str, str]) -> tuple[float, list[dict[str, Any]]]:
    results = []
    for it in items:
        given = answers.get(str(it["id"]))
        ok = given is not None and normalize(given) == normalize(str(it["answer"]))
        results.append(
            {"id": it["id"], "correct": ok, "correct_answer": it["answer"], "explanation": it.get("explanation", "")}
        )
    ratio = round(sum(r["correct"] for r in results) / len(results), 4) if results else 0.0
    return ratio, results


async def _topic(session: AsyncSession, slug: str) -> dict[str, Any]:
    row = (
        (
            await session.execute(
                text("select id, slug, drill from public.pronunciation_topics where slug = :s"), {"s": slug}
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "topic_not_found", "Pronunciation topic not found.")
    return dict(row)


async def submit_drill(session: AsyncSession, user_id: str, slug: str, answers: dict[str, str]) -> dict[str, Any]:
    topic = await _topic(session, slug)
    items = list(topic["drill"])
    if not set(answers) <= {str(i["id"]) for i in items}:
        raise AppError(422, "unknown_item", "Some answers are for items that are not in this drill.")
    ratio, results = mark_drill(items, answers)
    await session.execute(
        text(
            """insert into public.pronunciation_progress (user_id, topic_id, best_score, attempts)
               values (:u, :t, :r, 1)
               on conflict (user_id, topic_id) do update set
                 best_score = greatest(pronunciation_progress.best_score, excluded.best_score),
                 attempts = pronunciation_progress.attempts + 1"""
        ),
        {"u": user_id, "t": topic["id"], "r": ratio},
    )
    return {"score_ratio": ratio, "results": results}


async def drill_speech(session: AsyncSession, slug: str, item_id: str) -> dict[str, Any]:
    topic = await _topic(session, slug)
    item = next((i for i in topic["drill"] if str(i["id"]) == item_id and i.get("say")), None)
    if item is None:
        raise AppError(404, "audio_not_found", "This item has no audio.")
    return {"external_id": f"pron-{item_id}", "parts": [item["say"]], "transcript": item["say"]}

"""GraphQL types for the vocabulary and pronunciation tracks (read side)."""

from datetime import datetime
from typing import Any

import strawberry
from sqlalchemy import text
from strawberry.types import Info

from app.graphql.context import Context
from app.services.tracks import public_drill_item

CtxInfo = Info[Context, None]


@strawberry.type
class VocabularyWord:
    id: strawberry.ID
    word: str
    part_of_speech: str
    meaning: str
    example: str
    external_id: str = strawberry.field(description="Stable id; audio file name is vocab-<externalId>.wav")
    box: int | None = strawberry.field(description="Flashcard box 0-5 for the viewer; null if never practised")
    due_at: datetime | None
    mastered: bool


@strawberry.type
class VocabularySet:
    slug: str
    title: str
    level_code: int
    word_count: int
    seen_count: int = strawberry.field(description="Words the viewer has practised at least once")
    mastered_count: int

    @strawberry.field(description="Words in order with the viewer's flashcard state")
    async def words(self, info: CtxInfo) -> list[VocabularyWord]:
        rows = await info.context.execute(
            text(WORD_SQL + "where v.set_slug = :s order by v.sort_order"), {"s": self.slug, "u": info.context.user.id}
        )
        return [word(r) for r in rows.mappings().all()]


WORD_SQL = (
    "select v.id, v.external_id, v.word, v.part_of_speech, v.meaning, v.example, r.box, r.due_at, r.mastered_at "
    "from public.vocabulary v left join public.vocabulary_reviews r on r.vocabulary_id = v.id and r.user_id = :u "
)

SET_SQL = (
    "select v.set_slug, min(v.set_title) as title, min(lv.code) as level_code, count(*) as word_count, "
    "count(r.id) as seen_count, count(r.mastered_at) as mastered_count "
    "from public.vocabulary v join public.learning_levels lv on lv.id = v.learning_level_id "
    "left join public.vocabulary_reviews r on r.vocabulary_id = v.id and r.user_id = :u "
)


def word(r: Any) -> VocabularyWord:
    return VocabularyWord(
        id=strawberry.ID(str(r["id"])),
        external_id=r["external_id"],
        word=r["word"],
        part_of_speech=r["part_of_speech"],
        meaning=r["meaning"],
        example=r["example"],
        box=None if r["box"] is None else int(r["box"]),
        due_at=r["due_at"],
        mastered=r["mastered_at"] is not None,
    )


def vocab_set(r: Any) -> VocabularySet:
    return VocabularySet(
        slug=r["set_slug"],
        title=r["title"],
        level_code=int(r["level_code"]),
        word_count=int(r["word_count"]),
        seen_count=int(r["seen_count"]),
        mastered_count=int(r["mastered_count"]),
    )


async def vocabulary_sets(info: CtxInfo, level_code: int | None, slug: str | None = None) -> list[VocabularySet]:
    rows = await info.context.execute(
        text(
            SET_SQL + "where (cast(:code as int) is null or lv.code = :code) "
            "and (cast(:slug as text) is null or v.set_slug = :slug) "
            "group by v.set_slug order by min(lv.code), min(v.set_order)"
        ),
        {"u": info.context.user.id, "code": level_code, "slug": slug},
    )
    return [vocab_set(r) for r in rows.mappings().all()]


async def due_words(info: CtxInfo, limit: int) -> list[VocabularyWord]:
    rows = await info.context.execute(
        text(WORD_SQL + "where r.mastered_at is null and r.due_at <= now() order by r.due_at limit :lim"),
        {"u": info.context.user.id, "lim": max(1, min(limit, 100))},
    )
    return [word(r) for r in rows.mappings().all()]


async def due_word_count(info: CtxInfo) -> int:
    rows = await info.context.execute(
        text(
            "select count(*) from public.vocabulary_reviews "
            "where user_id = :u and mastered_at is null and due_at <= now()"
        ),
        {"u": info.context.user.id},
    )
    return int(rows.scalar_one())


@strawberry.type
class DrillItem:
    id: str
    type: str = strawberry.field(description="listen_choose (play audio, pick the word) or choose")
    prompt: str | None
    options: list[str]


@strawberry.type
class PronunciationTopic:
    slug: str
    kind: str
    title: str
    symbols: list[str]
    tip: str
    examples: list[str]
    drill: list[DrillItem] = strawberry.field(description="Drill items without answers")
    best_score: float | None = strawberry.field(description="The viewer's best drill score 0-1; null if not tried")
    attempts: int


TOPIC_SQL = (
    "select t.slug, t.kind, t.title, t.symbols, t.tip, t.examples, t.drill, p.best_score, "
    "coalesce(p.attempts, 0) as attempts "
    "from public.pronunciation_topics t "
    "left join public.pronunciation_progress p on p.topic_id = t.id and p.user_id = :u "
)


def topic(r: Any) -> PronunciationTopic:
    return PronunciationTopic(
        slug=r["slug"],
        kind=r["kind"],
        title=r["title"],
        symbols=list(r["symbols"]),
        tip=r["tip"],
        examples=list(r["examples"]),
        drill=[
            DrillItem(id=d["id"], type=d["type"], prompt=d.get("prompt"), options=list(d["options"]))
            for d in map(public_drill_item, r["drill"])
        ],
        best_score=None if r["best_score"] is None else float(r["best_score"]),
        attempts=int(r["attempts"]),
    )


async def pronunciation_topics(info: CtxInfo, slug: str | None = None) -> list[PronunciationTopic]:
    rows = await info.context.execute(
        text(TOPIC_SQL + "where (cast(:slug as text) is null or t.slug = :slug) order by t.sort_order"),
        {"u": info.context.user.id, "slug": slug},
    )
    return [topic(r) for r in rows.mappings().all()]

"""AI tutor chat (M5). The tutor explains English and PTE practice at the learner's level.

Rules: stays on English learning and PTE practice, never guarantees a score, never gives a 10-90 score,
limited per day. Off-topic messages get a fixed reply without calling the LLM.
"""

import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import registry
from app.core.config import get_settings
from app.core.errors import AppError

MAX_CHARS = 1000
HISTORY_TURNS = 6

LEVEL_STYLE = {
    1: "CEFR pre-A1/A1. Use very short sentences and the most common words. One idea per sentence. Give one example.",
    2: "CEFR A2. Use short sentences and common words. Explain any new word. Give one or two examples.",
    3: "CEFR B1. Use clear everyday language. Explain grammar terms simply. Give two examples.",
    4: "CEFR B2. Use clear language with some academic words, explained once. Give examples and a tip.",
    5: "CEFR C1. You may use academic language. Be precise and concise. Point out nuance.",
    6: "CEFR C1+. Be precise and concise, like a demanding teacher. Focus on accuracy, range and exam strategy.",
}

TOPIC_WORDS = {
    "english",
    "grammar",
    "word",
    "words",
    "vocabulary",
    "meaning",
    "mean",
    "means",
    "spell",
    "spelling",
    "pronounce",
    "pronunciation",
    "sentence",
    "sentences",
    "tense",
    "verb",
    "verbs",
    "noun",
    "adjective",
    "adverb",
    "preposition",
    "article",
    "plural",
    "phrase",
    "idiom",
    "synonym",
    "opposite",
    "translate",
    "pte",
    "exam",
    "test",
    "essay",
    "summary",
    "summarize",
    "summarise",
    "paragraph",
    "reading",
    "listening",
    "speaking",
    "writing",
    "fluency",
    "practice",
    "practise",
    "lesson",
    "level",
    "score",
    "band",
    "answer",
    "question",
    "task",
    "strategy",
    "tip",
    "tips",
    "mistake",
    "mistakes",
    "correct",
    "wrong",
    "improve",
    "study",
    "learn",
    "learning",
    "read",
    "aloud",
    "dictation",
    "blanks",
    "describe",
    "image",
    "retell",
    "lecture",
    "accent",
    "comma",
    "punctuation",
    "letter",
    "email",
    "conversation",
    "say",
    "write",
    "difference",
    "between",
    "use",
    "example",
    "examples",
    "explain",
    "plan",
    "timing",
    "time",
    "template",
}
# Clearly not about learning English: these win over general words such as "write" or "time".
OFF_TOPIC_WORDS = {
    "code",
    "coding",
    "script",
    "python",
    "javascript",
    "program",
    "hack",
    "hacking",
    "password",
    "wifi",
    "bitcoin",
    "crypto",
    "stock",
    "stocks",
    "bet",
    "betting",
    "football",
    "cricket",
    "election",
    "politics",
    "weather",
    "recipe",
    "movie",
    "medical",
    "medicine",
    "diagnose",
    "lawyer",
    "weapon",
}
CORE_WORDS = {
    "english",
    "grammar",
    "vocabulary",
    "meaning",
    "spelling",
    "pronounce",
    "pronunciation",
    "tense",
    "pte",
    "essay",
    "idiom",
    "synonym",
    "preposition",
    "punctuation",
    "fluency",
    "dictation",
}
GREETINGS = {"hi", "hello", "hey", "thanks", "thank", "bye", "help"}
QUOTED = re.compile(r"[\"'“‘][^\"'”’]{2,}[\"'”’]")

OFF_TOPIC_REPLY = (
    "I can help with English and PTE practice only. Try asking about a word, a grammar point, "
    "pronunciation or a question type."
)
GUARANTEE = re.compile(r"\b(guarantee|promise|predict|what (score|band) will i (get|have))\b", re.I)
GUARANTEE_REPLY = (
    "I can't promise or predict an exam score. Your practice results here are estimates, not official PTE "
    "scores. I can show you what to practise next to improve."
)


def on_topic(message: str) -> bool:
    tokens = set(re.findall(r"[a-z]+", message.lower()))
    if tokens & OFF_TOPIC_WORDS and not tokens & CORE_WORDS:
        return False
    return bool(tokens & TOPIC_WORDS) or bool(QUOTED.search(message)) or (bool(tokens) and tokens <= GREETINGS)


def system_prompt(level: int, weak_types: list[str]) -> str:
    style = LEVEL_STYLE.get(level, LEVEL_STYLE[3])
    weak = ", ".join(weak_types) if weak_types else "none recorded yet"
    return (
        "You are TutorBot, a friendly English teacher in a free practice app for English and PTE Academic.\n"
        f"Learner level: {style}\n"
        f"Question types this learner finds hard: {weak}.\n"
        "Rules: Only talk about learning English and PTE practice. Never promise or predict a score. "
        "Never give a number score such as 10-90. Do not quote or copy real exam questions. "
        "Keep answers under 150 words. End with one short practice suggestion."
    )


def build_prompt(history: list[tuple[str, str]], message: str) -> str:
    lines = [f"{'Learner' if role == 'user' else 'Tutor'}: {content}" for role, content in history]
    lines.append(f"Learner: {message}")
    lines.append("Tutor:")
    return "\n".join(lines)


async def _used_today(session: AsyncSession, user_id: str) -> int:
    used = (
        await session.execute(
            text(
                "select count(*) from public.ai_usage where user_id = :u and feature = 'tutor' "
                "and created_at >= date_trunc('day', now())"
            ),
            {"u": user_id},
        )
    ).scalar_one()
    return int(used)


async def _context(session: AsyncSession, user_id: str) -> tuple[int, list[str]]:
    row = (
        await session.execute(
            text(
                "select coalesce(l.code, 1) from public.profiles p "
                "left join public.learning_levels l on l.id = p.learning_level_id where p.id = :u"
            ),
            {"u": user_id},
        )
    ).scalar_one_or_none()
    weak = await session.execute(
        text(
            "select c.name from public.attempts a join public.question_categories c on c.id = a.category_id "
            "where a.user_id = :u and a.score_ratio is not null group by c.name "
            "having count(*) >= 3 and avg(a.score_ratio) < 0.6 order by avg(a.score_ratio) limit 3"
        ),
        {"u": user_id},
    )
    return int(row or 1), [r[0] for r in weak.all()]


async def _save(
    session: AsyncSession, user_id: str, role: str, content: str, topic: bool, provider: str | None
) -> None:
    await session.execute(
        text(
            "insert into public.tutor_messages (user_id, role, content, on_topic, provider) values (:u, :r, :c, :t, :p)"
        ),
        {"u": user_id, "r": role, "c": content[:4000], "t": topic, "p": provider},
    )


async def ask(session: AsyncSession, user_id: str, message: str) -> dict[str, Any]:
    message = message.strip()
    if not message:
        raise AppError(422, "empty_message", "Please type a question.")
    if len(message) > MAX_CHARS:
        raise AppError(422, "message_too_long", f"Please keep your question under {MAX_CHARS} characters.")
    limit = get_settings().tutor_messages_per_day
    used = await _used_today(session, user_id)
    if used >= limit:
        raise AppError(429, "tutor_limit", "You have reached today's limit for tutor messages. Try again tomorrow.")
    level, weak = await _context(session, user_id)
    topic = on_topic(message)
    provider: str | None = None
    if GUARANTEE.search(message):
        reply = GUARANTEE_REPLY
    elif not topic:
        reply = OFF_TOPIC_REPLY
    else:
        hist = await session.execute(
            text(
                "select role, content from public.tutor_messages where user_id = :u and on_topic "
                "order by created_at desc limit :n"
            ),
            {"u": user_id, "n": HISTORY_TURNS},
        )
        history = [(r[0], r[1]) for r in reversed(hist.all())]
        llm = registry.llm()
        res = await llm.complete(build_prompt(history, message), system=system_prompt(level, weak), max_tokens=300)
        reply, provider = res.text.strip() or OFF_TOPIC_REPLY, res.provider
        await session.execute(
            text("insert into public.ai_usage (user_id, feature, provider) values (:u, 'tutor', :p)"),
            {"u": user_id, "p": provider},
        )
        used += 1
    await _save(session, user_id, "user", message, topic, None)
    await _save(session, user_id, "assistant", reply, topic, provider)
    return {
        "reply": reply,
        "on_topic": topic,
        "provider": provider,
        "level": level,
        "remaining_today": max(0, limit - used),
    }


async def clear(session: AsyncSession, user_id: str) -> int:
    res = await session.execute(text("delete from public.tutor_messages where user_id = :u"), {"u": user_id})
    return int(getattr(res, "rowcount", 0) or 0)

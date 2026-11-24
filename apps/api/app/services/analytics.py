"""Progress analytics from the learner's own attempts (M6). Pure aggregation plus one loader and a CSV export.

Accuracy here is the share of marks earned in practice, not an official PTE score.
"""

import csv
import io
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.evaluation.bands import ratio_to_band

MAX_DAYS = 180
WEEKS = 8


@dataclass(frozen=True)
class Row:
    code: str
    name: str
    section: str
    skills: tuple[str, ...]
    ratio: float | None
    seconds: int
    day: date


def _avg(vals: list[float]) -> float | None:
    return round(sum(vals) / len(vals), 4) if vals else None


def daily(rows: Iterable[Row], today: date, days: int) -> list[dict[str, Any]]:
    """One entry per day (oldest first), including days with no practice, so charts have a true time axis."""
    start = today - timedelta(days=days - 1)
    buckets: dict[date, list[Row]] = {start + timedelta(days=i): [] for i in range(days)}
    for r in rows:
        if r.day in buckets:
            buckets[r.day].append(r)
    return [
        {
            "day": d.isoformat(),
            "attempts": len(rs),
            "accuracy": _avg([r.ratio for r in rs if r.ratio is not None]),
            "minutes": round(sum(r.seconds for r in rs) / 60),
        }
        for d, rs in buckets.items()
    ]


def by_type(rows: Iterable[Row], today: date) -> list[dict[str, Any]]:
    """Per question type: all-time accuracy, last 14 days against the 14 days before (historical comparison)."""
    agg: dict[str, dict[str, Any]] = {}
    for r in rows:
        a = agg.setdefault(
            r.code,
            {
                "code": r.code,
                "name": r.name,
                "section": r.section,
                "all": [],
                "recent": [],
                "previous": [],
                "attempts": 0,
            },
        )
        a["attempts"] += 1
        if r.ratio is None:
            continue
        a["all"].append(r.ratio)
        age = (today - r.day).days
        if age < 14:
            a["recent"].append(r.ratio)
        elif age < 28:
            a["previous"].append(r.ratio)
    out = []
    for a in agg.values():
        acc = _avg(a["all"])
        recent, previous = _avg(a["recent"]), _avg(a["previous"])
        out.append(
            {
                "code": a["code"],
                "name": a["name"],
                "section": a["section"],
                "attempts": a["attempts"],
                "accuracy": acc,
                "band": ratio_to_band(acc) if acc is not None else None,
                "recent_accuracy": recent,
                "previous_accuracy": previous,
                "change": round(recent - previous, 4) if recent is not None and previous is not None else None,
            }
        )
    out.sort(key=lambda x: (x["accuracy"] is None, x["accuracy"] if x["accuracy"] is not None else 0, x["code"]))
    return out


def skill_trend(rows: Iterable[Row], today: date, weeks: int = WEEKS) -> list[dict[str, Any]]:
    """Weekly accuracy per skill, oldest week first. Week 0 ends today."""
    out: dict[tuple[int, str], list[float]] = {}
    for r in rows:
        w = (today - r.day).days // 7
        if 0 <= w < weeks and r.ratio is not None:
            for s in r.skills:
                out.setdefault((w, s), []).append(r.ratio)
    result = []
    for w in range(weeks - 1, -1, -1):
        week_start = today - timedelta(days=w * 7 + 6)
        entry: dict[str, Any] = {"week_start": week_start.isoformat()}
        for s in ("speaking", "writing", "reading", "listening"):
            entry[s] = _avg(out.get((w, s), []))
        result.append(entry)
    return result


def summary(rows: list[Row]) -> dict[str, Any]:
    marked = [r.ratio for r in rows if r.ratio is not None]
    return {
        "attempts": len(rows),
        "accuracy": _avg(marked),
        "minutes": round(sum(r.seconds for r in rows) / 60),
        "active_days": len({r.day for r in rows}),
        "types": len({r.code for r in rows}),
    }


ROWS_SQL = text(
    """select c.code, c.name, c.section::text, coalesce(c.skills::text[], '{}'), a.score_ratio, a.is_correct,
              coalesce(a.duration_seconds, 0), (a.created_at at time zone 'utc')::date
       from public.attempts a join public.question_categories c on c.id = a.category_id
       where a.user_id = :u and a.created_at >= :since order by a.created_at desc limit 20000"""
)


def clamp_days(days: int) -> int:
    return max(7, min(days, MAX_DAYS))


def since_for(today: date, days: int) -> date:
    return today - timedelta(days=max(days, WEEKS * 7, 28) - 1)


def rows_from(raw: Iterable[Any]) -> list[Row]:
    out = []
    for code, name, section, skills, ratio, correct, secs, day in raw:
        r = float(ratio) if ratio is not None else (1.0 if correct else 0.0) if correct is not None else None
        out.append(Row(code, name, section, tuple(skills), r, int(secs), day))
    return out


def build(rows: list[Row], today: date, days: int) -> dict[str, Any]:
    window = [r for r in rows if (today - r.day).days < days]
    return {
        "days": days,
        "summary": summary(window),
        "daily": daily(rows, today, days),
        "by_type": by_type(rows, today),
        "skill_trend": skill_trend(rows, today),
    }


async def analytics(session: AsyncSession, user_id: str, today: date, days: int) -> dict[str, Any]:
    days = clamp_days(days)
    res = await session.execute(ROWS_SQL, {"u": user_id, "since": since_for(today, days)})
    return build(rows_from(res.all()), today, days)


def _pct(v: float | None) -> str:
    return "" if v is None else str(round(v * 100))


def to_csv(data: dict[str, Any]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["TutorBot English AI progress report. Practice estimate, not an official PTE score."])
    w.writerow([])
    w.writerow(["Question type", "Section", "Attempts", "Accuracy %", "Band", "Last 14 days %", "14 days before %"])
    for t in data["by_type"]:
        w.writerow(
            [
                t["name"],
                t["section"],
                t["attempts"],
                _pct(t["accuracy"]),
                t["band"] or "",
                _pct(t["recent_accuracy"]),
                _pct(t["previous_accuracy"]),
            ]
        )
    w.writerow([])
    w.writerow(["Day", "Attempts", "Accuracy %", "Minutes"])
    for d in data["daily"]:
        w.writerow([d["day"], d["attempts"], _pct(d["accuracy"]), d["minutes"]])
    return buf.getvalue()

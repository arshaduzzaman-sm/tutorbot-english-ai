"""Pure progress calculations (unit-tested without a database)."""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

SKILLS = ("speaking", "writing", "reading", "listening")
WEAK_MIN_ATTEMPTS = 3
WEAK_THRESHOLD = 0.6


def study_streak(active_days: Iterable[date], today: date) -> int:
    """Consecutive days with activity ending today (or yesterday, so the streak
    is not lost before the learner studies today)."""
    days = set(active_days)
    cursor = today if today in days else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@dataclass(frozen=True)
class AttemptSignal:
    category_id: str | None
    skills: tuple[str, ...]
    ratio: float | None  # 0..1, None when not auto-marked


@dataclass(frozen=True)
class SkillStat:
    skill: str
    attempts: int
    accuracy: float | None


def skill_stats(signals: Iterable[AttemptSignal]) -> list[SkillStat]:
    totals = {s: [0, 0.0, 0] for s in SKILLS}  # attempts, ratio sum, marked count
    for sig in signals:
        for skill in sig.skills:
            if skill not in totals:
                continue
            totals[skill][0] += 1
            if sig.ratio is not None:
                totals[skill][1] += sig.ratio
                totals[skill][2] += 1
    return [
        SkillStat(skill=s, attempts=int(t[0]), accuracy=(round(t[1] / t[2], 4) if t[2] else None))
        for s, t in totals.items()
    ]


def weak_categories(signals: Iterable[AttemptSignal], limit: int = 3) -> list[tuple[str, float, int]]:
    """Categories with enough marked attempts and low accuracy, weakest first."""
    agg: dict[str, list[float]] = {}
    for sig in signals:
        if sig.category_id and sig.ratio is not None:
            agg.setdefault(sig.category_id, []).append(sig.ratio)
    weak = [
        (cid, round(sum(v) / len(v), 4), len(v))
        for cid, v in agg.items()
        if len(v) >= WEAK_MIN_ATTEMPTS and sum(v) / len(v) < WEAK_THRESHOLD
    ]
    weak.sort(key=lambda x: (x[1], -x[2]))
    return weak[:limit]

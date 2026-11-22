"""Personal coaching from real attempt history (SPEC 5, M5). Pure functions, unit-tested without a database.

Everything here is a practice guide built from the learner's own answers. Nothing is an official PTE score:
readiness is a band label, never a 10-90 number (SPEC 7.3).
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Literal

from app.ai.evaluation.bands import ratio_to_band

Difficulty = Literal["beginner", "intermediate", "advanced"]
DIFFICULTIES: tuple[Difficulty, ...] = ("beginner", "intermediate", "advanced")

WEAK_MIN_ATTEMPTS = 3
WEAK_RATIO = 0.6
RECENT_WINDOW = 5  # last N marked attempts decide adaptive difficulty and trends
EASIER_BELOW = 0.5
HARDER_ABOVE = 0.85
DECLINE_DROP = 0.15
STALE_DAYS = 7
READINESS_MIN_TYPES = 6
READINESS_MIN_ATTEMPTS = 20
MOCK_COVERAGE = 0.8


@dataclass(frozen=True)
class AttemptRow:
    category_code: str
    ratio: float | None  # 0..1; None when not marked
    day: date


@dataclass
class CategoryStat:
    code: str
    attempts: int = 0
    marked: list[float] = field(default_factory=list)  # newest first
    last_day: date | None = None

    @property
    def accuracy(self) -> float | None:
        return round(sum(self.marked) / len(self.marked), 4) if self.marked else None

    @property
    def recent(self) -> float | None:
        r = self.marked[:RECENT_WINDOW]
        return sum(r) / len(r) if r else None

    @property
    def previous(self) -> float | None:
        p = self.marked[RECENT_WINDOW : RECENT_WINDOW * 2]
        return sum(p) / len(p) if p else None


def category_stats(rows: Iterable[AttemptRow]) -> dict[str, CategoryStat]:
    """Rows must be newest first."""
    out: dict[str, CategoryStat] = {}
    for r in rows:
        st = out.setdefault(r.category_code, CategoryStat(code=r.category_code))
        st.attempts += 1
        if r.ratio is not None:
            st.marked.append(r.ratio)
        if st.last_day is None or r.day > st.last_day:
            st.last_day = r.day
    return out


def base_difficulty(level: int) -> Difficulty:
    return "beginner" if level <= 2 else "intermediate" if level <= 4 else "advanced"


def target_difficulty(level: int, stat: CategoryStat | None) -> Difficulty:
    """Start from the learner's level, then step down after a weak run or up after a strong one."""
    idx = DIFFICULTIES.index(base_difficulty(level))
    recent = stat.recent if stat else None
    if recent is not None and stat is not None:
        n = min(len(stat.marked), RECENT_WINDOW)
        if recent < EASIER_BELOW and n >= WEAK_MIN_ATTEMPTS:
            idx -= 1
        elif recent >= HARDER_ABOVE and n >= RECENT_WINDOW:
            idx += 1
    return DIFFICULTIES[max(0, min(idx, len(DIFFICULTIES) - 1))]


def _skill_attempts(stats: Mapping[str, CategoryStat], categories: Mapping[str, tuple[str, ...]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for code, skills in categories.items():
        for s in skills:
            out[s] = out.get(s, 0) + (stats[code].attempts if code in stats else 0)
    return out


def recommendations(
    stats: Mapping[str, CategoryStat],
    categories: Mapping[str, tuple[str, ...]],
    level: int,
    review_due: int,
    today: date,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Ranked next steps. `categories` maps every practice type code to its skills, in display order."""
    recs: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(kind: str, reason: str, code: str | None = None, **extra: Any) -> None:
        if code is not None:
            if code in seen:
                return
            seen.add(code)
        item: dict[str, Any] = {"kind": kind, "reason": reason, "category_code": code, **extra}
        if code is not None:
            st = stats.get(code)
            item["accuracy"] = st.accuracy if st else None
            item["difficulty"] = target_difficulty(level, st)
        recs.append(item)

    if review_due > 0:
        add("review", "review_due", count=review_due)

    weak = [
        st
        for st in stats.values()
        if st.code in categories and len(st.marked) >= WEAK_MIN_ATTEMPTS and (st.accuracy or 0) < WEAK_RATIO
    ]
    for st in sorted(weak, key=lambda s: (s.accuracy or 0, -s.attempts)):
        add("practice", "weak", st.code)

    for st in stats.values():
        if st.code in categories and st.recent is not None and st.previous is not None:
            if st.recent < st.previous - DECLINE_DROP:
                add("practice", "declining", st.code)

    skill_load = _skill_attempts(stats, categories)
    untried = [c for c in categories if c not in stats]
    untried.sort(key=lambda c: min(skill_load.get(s, 0) for s in categories[c]) if categories[c] else 0)
    for code in untried[:2]:
        add("practice", "not_tried", code)

    for st in sorted(stats.values(), key=lambda s: s.last_day or today):
        if st.code in categories and st.last_day and (today - st.last_day).days >= STALE_DAYS:
            add("practice", "stale", st.code)

    tried = sum(1 for c in categories if c in stats)
    accs = [a for a in (st.accuracy for st in stats.values()) if a is not None]
    if categories and tried / len(categories) >= MOCK_COVERAGE and accs and sum(accs) / len(accs) >= 0.65:
        add("mock", "ready_for_mock")

    if not recs:
        add("lesson", "keep_going")
    return recs[:limit]


def readiness(stats: Mapping[str, CategoryStat], categories: Mapping[str, tuple[str, ...]]) -> dict[str, Any]:
    """Readiness as bands per skill and one overall label. Not a score and not a prediction of a result."""
    skills: dict[str, list[float]] = {}
    covered: dict[str, set[str]] = {}
    totals: dict[str, int] = {}
    for code, sk in categories.items():
        for s in sk:
            totals[s] = totals.get(s, 0) + 1
            st = stats.get(code)
            if st and st.accuracy is not None:
                skills.setdefault(s, []).append(st.accuracy)
                covered.setdefault(s, set()).add(code)
    per_skill = []
    for s in sorted(totals):
        vals = skills.get(s, [])
        ratio = sum(vals) / len(vals) if vals else None
        per_skill.append(
            {
                "skill": s,
                "band": ratio_to_band(ratio) if ratio is not None else None,
                "types_tried": len(covered.get(s, set())),
                "types_total": totals[s],
            }
        )
    tried = sum(1 for c in categories if c in stats)
    attempts = sum(st.attempts for c, st in stats.items() if c in categories)
    if tried < READINESS_MIN_TYPES or attempts < READINESS_MIN_ATTEMPTS:
        overall = "not_enough_data"
    else:
        bands = [p["band"] for p in per_skill]
        if any(b is None or b in ("needs_work", "developing") for b in bands):
            overall = "building"
        elif all(b == "strong" for b in bands) and tried == len(categories):
            overall = "ready"
        else:
            overall = "getting_close"
    return {
        "overall": overall,
        "skills": per_skill,
        "types_tried": tried,
        "types_total": len(categories),
        "attempts": attempts,
    }


def _week(rows: list[AttemptRow], start: date, end: date) -> dict[str, Any]:
    sel = [r for r in rows if start <= r.day <= end]
    marked = [r.ratio for r in sel if r.ratio is not None]
    return {
        "attempts": len(sel),
        "active_days": len({r.day for r in sel}),
        "accuracy": round(sum(marked) / len(marked), 4) if marked else None,
        "types": len({r.category_code for r in sel}),
    }


def weekly_checkin(rows: Iterable[AttemptRow], today: date) -> dict[str, Any]:
    """This week (last 7 days, including today) against the 7 days before."""
    all_rows = list(rows)
    this = _week(all_rows, today - timedelta(days=6), today)
    last = _week(all_rows, today - timedelta(days=13), today - timedelta(days=7))
    change = None
    if this["accuracy"] is not None and last["accuracy"] is not None:
        change = round(this["accuracy"] - last["accuracy"], 4)
    if this["attempts"] == 0:
        message = "start"
    elif last["attempts"] == 0:
        message = "first_week"
    elif change is not None and change >= 0.05:
        message = "improving"
    elif change is not None and change <= -0.05:
        message = "slipping"
    else:
        message = "steady"
    return {"this_week": this, "last_week": last, "accuracy_change": change, "message": message}


def today_plan(recs: list[dict[str, Any]], level: int, daily_minutes: int) -> list[dict[str, Any]]:
    """Split today's minutes over a lesson, the top practice recommendations and review."""
    minutes = max(10, daily_minutes)
    practice = [r for r in recs if r["kind"] == "practice"][:2]
    has_review = any(r["kind"] == "review" for r in recs)
    review = max(5, round(minutes * 0.2)) if has_review else 0
    practice_total = max(5, round(minutes * 0.45)) if practice else 0
    lesson = max(5, minutes - review - practice_total)
    blocks: list[dict[str, Any]] = [{"kind": "lessons", "minutes": lesson, "level": level}]
    for i, r in enumerate(practice):
        share = practice_total // len(practice) + (practice_total % len(practice) if i == 0 else 0)
        blocks.append(
            {"kind": "practice", "minutes": share, "category_code": r["category_code"], "difficulty": r["difficulty"]}
        )
    if review:
        blocks.append({"kind": "review", "minutes": review})
    return blocks

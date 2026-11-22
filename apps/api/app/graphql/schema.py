"""GraphQL schema for reads (SPEC 3.1.4). Every request is authenticated."""

import uuid
from datetime import UTC, date, datetime
from enum import Enum
from typing import Any

import strawberry
from graphql.validation import NoSchemaIntrospectionCustomRule
from sqlalchemy import func, select, text
from strawberry.extensions import AddValidationRules, MaxAliasesLimiter, MaxTokensLimiter, QueryDepthLimiter
from strawberry.types import Info

from app.ai.registry import demo_mode
from app.core.config import get_settings
from app.db import models
from app.graphql.context import Context
from app.services.progress import AttemptSignal, skill_stats, study_streak, weak_categories

CtxInfo = Info[Context, None]


@strawberry.enum
class Skill(Enum):
    SPEAKING = "speaking"
    WRITING = "writing"
    READING = "reading"
    LISTENING = "listening"


@strawberry.type
class LearningLevel:
    id: strawberry.ID
    code: int
    slug: str
    name: str
    cefr: str
    description: str

    @staticmethod
    def of(m: models.LearningLevel) -> "LearningLevel":
        return LearningLevel(
            id=strawberry.ID(str(m.id)), code=m.code, slug=m.slug, name=m.name, cefr=m.cefr, description=m.description
        )


@strawberry.type
class QuestionCategory:
    id: strawberry.ID
    code: str
    name: str
    section: str
    skills: list[Skill]

    @staticmethod
    def of(m: models.QuestionCategory) -> "QuestionCategory":
        return QuestionCategory(
            id=strawberry.ID(str(m.id)),
            code=m.code,
            name=m.name,
            section=m.section,
            skills=[Skill(s) for s in m.skills],
        )


async def _level(info: CtxInfo, level_id: uuid.UUID | None) -> LearningLevel | None:
    if level_id is None:
        return None
    m = await info.context.level_loader.load(level_id)
    return LearningLevel.of(m) if m else None


@strawberry.type
class Profile:
    display_name: str | None
    target_score: int | None
    exam_date: date | None
    daily_goal_minutes: int
    onboarding_completed: bool
    level_id: strawberry.Private[uuid.UUID | None]

    @strawberry.field
    async def level(self, info: CtxInfo) -> LearningLevel | None:
        return await _level(info, self.level_id)


@strawberry.type
class Lesson:
    id: strawberry.ID
    slug: str
    title: str
    summary: str
    estimated_minutes: int
    level_id: strawberry.Private[uuid.UUID]

    @strawberry.field
    async def level(self, info: CtxInfo) -> LearningLevel | None:
        return await _level(info, self.level_id)


@strawberry.type
class Attempt:
    id: strawberry.ID
    created_at: datetime
    mode: str
    is_correct: bool | None
    score_ratio: float | None
    category_id: strawberry.Private[uuid.UUID | None]

    @strawberry.field
    async def category(self, info: CtxInfo) -> QuestionCategory | None:
        if self.category_id is None:
            return None
        m = await info.context.category_loader.load(self.category_id)
        return QuestionCategory.of(m) if m else None


@strawberry.type
class SkillProgress:
    skill: Skill
    attempts: int
    accuracy: float | None = strawberry.field(description="0..1 share of marks gained; null if no marked attempts")


@strawberry.type
class Progress:
    lessons_completed: int
    lessons_total: int
    skills: list[SkillProgress]

    @strawberry.field
    def overall_ratio(self) -> float:
        return round(self.lessons_completed / self.lessons_total, 4) if self.lessons_total else 0.0


@strawberry.type
class WeakArea:
    accuracy: float
    attempts: int
    category_id: strawberry.Private[uuid.UUID]

    @strawberry.field
    async def category(self, info: CtxInfo) -> QuestionCategory | None:
        m = await info.context.category_loader.load(self.category_id)
        return QuestionCategory.of(m) if m else None


@strawberry.type
class MockExam:
    id: strawberry.ID
    kind: str
    status: str
    started_at: datetime
    completed_at: datetime | None


async def _signals(info: CtxInfo) -> list[tuple[AttemptSignal, date]]:
    rows = await info.context.execute(
        text(
            """select a.category_id::text, coalesce(c.skills::text[], '{}'), a.score_ratio, a.is_correct,
                      (a.created_at at time zone 'utc')::date
               from public.attempts a left join public.question_categories c on c.id = a.category_id
               where a.user_id = :uid order by a.created_at desc limit 1000"""
        ),
        {"uid": info.context.user.id},
    )
    out = []
    raw: list[Any] = list(rows.all())
    for cid, skills, ratio, correct, day in raw:
        r = float(ratio) if ratio is not None else (1.0 if correct else 0.0) if correct is not None else None
        out.append((AttemptSignal(category_id=cid, skills=tuple(skills), ratio=r), day))
    return out


@strawberry.type
class Viewer:
    id: strawberry.ID
    email: str | None

    @strawberry.field
    def demo_mode(self) -> bool:
        return demo_mode()

    @strawberry.field
    async def roles(self, info: CtxInfo) -> list[str]:
        rows = await info.context.execute(
            text("select role::text from public.user_roles where user_id = :uid order by 1"),
            {"uid": info.context.user.id},
        )
        return [r[0] for r in rows]

    @strawberry.field
    async def profile(self, info: CtxInfo) -> Profile | None:
        p = (
            await info.context.execute(select(models.Profile).where(models.Profile.id == uuid.UUID(self.id)))
        ).scalar_one_or_none()
        if p is None:
            return None
        return Profile(
            display_name=p.display_name,
            target_score=p.target_score,
            exam_date=p.exam_date,
            daily_goal_minutes=p.daily_goal_minutes,
            onboarding_completed=p.onboarding_completed_at is not None,
            level_id=p.learning_level_id,
        )

    @strawberry.field
    async def progress(self, info: CtxInfo) -> Progress:
        total = (await info.context.execute(select(func.count()).select_from(models.Lesson))).scalar_one()
        done = (
            await info.context.execute(
                select(func.count())
                .select_from(models.LearningProgress)
                .where(
                    models.LearningProgress.user_id == uuid.UUID(self.id),
                    models.LearningProgress.status == "completed",
                )
            )
        ).scalar_one()
        stats = skill_stats(s for s, _ in await _signals(info))
        return Progress(
            lessons_completed=done,
            lessons_total=total,
            skills=[SkillProgress(skill=Skill(s.skill), attempts=s.attempts, accuracy=s.accuracy) for s in stats],
        )

    @strawberry.field(description="Consecutive study days (UTC) ending today or yesterday")
    async def streak_days(self, info: CtxInfo) -> int:
        days = {d for _, d in await _signals(info)}
        rows = await info.context.execute(
            text(
                "select distinct (updated_at at time zone 'utc')::date from public.learning_progress "
                "where user_id = :uid"
            ),
            {"uid": info.context.user.id},
        )
        days |= {r[0] for r in rows}
        return study_streak(days, datetime.now(UTC).date())

    @strawberry.field(description="Minutes practised today (UTC), from recorded attempt durations")
    async def today_minutes(self, info: CtxInfo) -> int:
        seconds = (
            await info.context.execute(
                text(
                    "select coalesce(sum(duration_seconds), 0) from public.attempts where user_id = :uid "
                    "and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'"
                ),
                {"uid": info.context.user.id},
            )
        ).scalar_one()
        return int(seconds) // 60

    @strawberry.field
    async def recent_attempts(self, info: CtxInfo, limit: int = 5) -> list[Attempt]:
        limit = max(1, min(limit, 20))
        rows = (
            (
                await info.context.execute(
                    select(models.Attempt)
                    .where(models.Attempt.user_id == uuid.UUID(self.id))
                    .order_by(models.Attempt.created_at.desc())
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return [
            Attempt(
                id=strawberry.ID(str(a.id)),
                created_at=a.created_at,
                mode=a.mode,
                is_correct=a.is_correct,
                score_ratio=float(a.score_ratio) if a.score_ratio is not None else None,
                category_id=a.category_id,
            )
            for a in rows
        ]

    @strawberry.field(description="Next published lessons at the learner's level that are not completed")
    async def recommended_lessons(self, info: CtxInfo, limit: int = 3) -> list[Lesson]:
        limit = max(1, min(limit, 10))
        rows = await info.context.execute(
            text(
                """select l.id, l.slug, l.title, l.summary, l.estimated_minutes, l.learning_level_id
                   from public.lessons l
                   join public.learning_levels lv on lv.id = l.learning_level_id
                   left join public.profiles p on p.id = :uid
                   left join public.learning_levels pl on pl.id = p.learning_level_id
                   where l.status = 'published' and l.deleted_at is null
                     and not exists (select 1 from public.learning_progress lp where lp.lesson_id = l.id
                                     and lp.user_id = :uid and lp.status = 'completed')
                   order by abs(lv.code - coalesce(pl.code, 1)), lv.code, l.sort_order
                   limit :limit"""
            ),
            {"uid": info.context.user.id, "limit": limit},
        )
        lesson_rows: list[Any] = list(rows.all())
        return [
            Lesson(
                id=strawberry.ID(str(r[0])), slug=r[1], title=r[2], summary=r[3], estimated_minutes=r[4], level_id=r[5]
            )
            for r in lesson_rows
        ]

    @strawberry.field
    async def weak_areas(self, info: CtxInfo) -> list[WeakArea]:
        weak = weak_categories(s for s, _ in await _signals(info))
        return [WeakArea(category_id=uuid.UUID(cid), accuracy=acc, attempts=n) for cid, acc, n in weak]

    @strawberry.field
    async def mock_exams(self, info: CtxInfo, limit: int = 5) -> list[MockExam]:
        limit = max(1, min(limit, 20))
        rows = (
            (
                await info.context.execute(
                    select(models.TestSession)
                    .where(models.TestSession.user_id == uuid.UUID(self.id))
                    .order_by(models.TestSession.started_at.desc())
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return [
            MockExam(
                id=strawberry.ID(str(t.id)),
                kind=t.kind,
                status=t.status,
                started_at=t.started_at,
                completed_at=t.completed_at,
            )
            for t in rows
        ]


@strawberry.type
class Query:
    @strawberry.field
    def viewer(self, info: CtxInfo) -> Viewer:
        u = info.context.user
        return Viewer(id=strawberry.ID(u.id), email=u.email)

    @strawberry.field
    async def learning_levels(self, info: CtxInfo) -> list[LearningLevel]:
        rows = (
            (await info.context.execute(select(models.LearningLevel).order_by(models.LearningLevel.code)))
            .scalars()
            .all()
        )
        return [LearningLevel.of(r) for r in rows]

    @strawberry.field
    async def question_categories(self, info: CtxInfo) -> list[QuestionCategory]:
        rows = (
            (await info.context.execute(select(models.QuestionCategory).order_by(models.QuestionCategory.sort_order)))
            .scalars()
            .all()
        )
        return [QuestionCategory.of(r) for r in rows]


def build_schema() -> strawberry.Schema:
    s = get_settings()
    depth, tokens, aliases = s.graphql_max_depth, s.graphql_max_tokens, s.graphql_max_aliases
    extensions: list[object] = [
        lambda: QueryDepthLimiter(max_depth=depth),
        lambda: MaxTokensLimiter(max_token_count=tokens),
        lambda: MaxAliasesLimiter(max_alias_count=aliases),
    ]
    if not s.is_dev:
        extensions.append(lambda: AddValidationRules([NoSchemaIntrospectionCustomRule]))
    return strawberry.Schema(query=Query, extensions=extensions)  # type: ignore[arg-type]


schema = build_schema()

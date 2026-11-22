"""GraphQL schema for reads (SPEC 3.1.4). Every request is authenticated."""

import uuid
from datetime import UTC, date, datetime
from enum import Enum
from typing import Any

import strawberry
from graphql.validation import NoSchemaIntrospectionCustomRule
from sqlalchemy import func, select, text
from strawberry.extensions import AddValidationRules, MaxAliasesLimiter, MaxTokensLimiter, QueryDepthLimiter
from strawberry.scalars import JSON
from strawberry.types import Info

from app.ai.registry import demo_mode
from app.core.config import get_settings
from app.db import models
from app.graphql.context import Context
from app.services.lessons import public_exercise
from app.services.practice import AUTO_MARKED, public_content
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


@strawberry.type
class QuestionOption:
    label: str
    body: str


@strawberry.type
class PracticeQuestion:
    id: strawberry.ID
    external_id: str
    category_code: str
    difficulty: str
    instructions: str
    learning_objective: str
    content: JSON = strawberry.field(description="Task content without answers (text, blanks, passage, ...)")
    category_id: strawberry.Private[uuid.UUID]

    @strawberry.field
    async def category(self, info: CtxInfo) -> QuestionCategory | None:
        m = await info.context.category_loader.load(self.category_id)
        return QuestionCategory.of(m) if m else None

    @strawberry.field(description="Answer options in order, without which ones are correct")
    async def options(self, info: CtxInfo) -> list[QuestionOption]:
        rows = await info.context.execute(
            text("select label, body from public.question_options where question_id = :id order by sort_order, label"),
            {"id": uuid.UUID(str(self.id))},
        )
        return [QuestionOption(label=str(r.label), body=str(r.body)) for r in rows.all()]


@strawberry.type
class PracticeTypeStats:
    category: QuestionCategory
    question_count: int
    auto_marked: bool
    attempts: int = strawberry.field(description="The viewer's attempts at this task type")
    average_score: float | None = strawberry.field(description="Mean practice score ratio 0-1; null if no attempts")


QUESTION_COLUMNS = (
    "q.id, q.external_id, c.code, q.difficulty::text, q.instructions, q.learning_objective, q.content, q.category_id"
)


def _question(row: Any) -> PracticeQuestion:
    r: list[Any] = list(row)
    return PracticeQuestion(
        id=strawberry.ID(str(r[0])),
        external_id=r[1],
        category_code=r[2],
        difficulty=r[3],
        instructions=r[4],
        learning_objective=r[5],
        content=public_content(r[2], dict(r[6])),  # type: ignore[arg-type]
        category_id=r[7],
    )


@strawberry.type
class ReviewItem:
    id: strawberry.ID
    box: int = strawberry.field(description="0 = just missed; 5 = mastered")
    due_at: datetime
    wrong_count: int
    last_score: float | None
    mastered: bool
    question: PracticeQuestion

    @strawberry.field(description="True when the item is waiting for review now")
    def is_due(self) -> bool:
        return not self.mastered and self.due_at <= datetime.now(UTC)


REVIEW_SQL = (
    f"select {QUESTION_COLUMNS}, r.id, r.box, r.due_at, r.wrong_count, r.last_score, r.mastered_at "  # noqa: S608
    "from public.review_items r join public.questions q on q.id = r.question_id "
    "join public.question_categories c on c.id = q.category_id "
    "where r.user_id = :u and q.status = 'published' and q.deleted_at is null "
)


def _review_item(row: Any) -> ReviewItem:
    r: list[Any] = list(row)
    return ReviewItem(
        id=strawberry.ID(str(r[8])),
        box=int(r[9]),
        due_at=r[10],
        wrong_count=int(r[11]),
        last_score=float(r[12]) if r[12] is not None else None,
        mastered=r[13] is not None,
        question=_question(r[:8]),
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
class Exercise:
    """A practice item as learners see it: never includes the answer or explanation."""

    id: str
    type: str
    prompt: str
    options: list[str]
    hint: str | None


@strawberry.type
class LessonSection:
    kind: str
    title: str
    body_md: str
    exercises: list[Exercise]


@strawberry.type
class LessonProgress:
    status: str
    best_score: float | None
    completed_at: datetime | None


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

    @strawberry.field(description="The viewer's progress on this lesson; null if not started")
    async def progress(self, info: CtxInfo) -> LessonProgress | None:
        row = await info.context.progress_loader.load(uuid.UUID(str(self.id)))
        if row is None:
            return None
        return LessonProgress(
            status=row["status"],
            best_score=float(row["score_ratio"]) if row["score_ratio"] is not None else None,
            completed_at=row["completed_at"],
        )

    @strawberry.field
    async def sections(self, info: CtxInfo) -> list[LessonSection]:
        rows = await info.context.execute(
            text(
                "select kind, title, body_md, exercises from public.lesson_sections "
                "where lesson_id = :id order by sort_order"
            ),
            {"id": str(self.id)},
        )
        out = []
        section_rows: list[Any] = list(rows.all())
        for kind, title, body, exercises in section_rows:
            items = [public_exercise(e) for e in (exercises or [])]
            out.append(
                LessonSection(
                    kind=kind,
                    title=title,
                    body_md=body,
                    exercises=[
                        Exercise(
                            id=e["id"],
                            type=e["type"],
                            prompt=e["prompt"],
                            options=e.get("options", []),
                            hint=e.get("hint"),
                        )
                        for e in items
                    ],
                )
            )
        return out


LESSON_COLUMNS = "l.id, l.slug, l.title, l.summary, l.estimated_minutes, l.learning_level_id"


def _lesson(r: Any) -> Lesson:
    return Lesson(
        id=strawberry.ID(str(r[0])), slug=r[1], title=r[2], summary=r[3], estimated_minutes=r[4], level_id=r[5]
    )


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

    @strawberry.field(description="Mistake notebook. dueOnly: only items due for spaced review now")
    async def review_items(self, info: CtxInfo, due_only: bool = False, limit: int = 50) -> list[ReviewItem]:
        where = "and r.mastered_at is null and r.due_at <= now() " if due_only else ""
        rows = await info.context.execute(
            text(REVIEW_SQL + where + "order by r.mastered_at nulls first, r.due_at limit :lim"),
            {"u": self.id, "lim": max(1, min(limit, 100))},
        )
        return [_review_item(r) for r in rows.all()]

    @strawberry.field(description="Mistakes due for spaced review now")
    async def review_due_count(self, info: CtxInfo) -> int:
        rows = await info.context.execute(
            text(
                "select count(*) from public.review_items "
                "where user_id = :u and mastered_at is null and due_at <= now()"
            ),
            {"u": self.id},
        )
        return int(rows.scalar_one())

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

    @strawberry.field(description="Published lessons, optionally for one level, in course order")
    async def lessons(self, info: CtxInfo, level_code: int | None = None) -> list[Lesson]:
        rows = await info.context.execute(
            text(
                f"select {LESSON_COLUMNS} from public.lessons l "  # noqa: S608 (constant column list)
                "join public.learning_levels lv on lv.id = l.learning_level_id "
                "where l.status = 'published' and l.deleted_at is null "
                "and (cast(:code as int) is null or lv.code = :code) order by lv.code, l.sort_order"
            ),
            {"code": level_code},
        )
        return [_lesson(r) for r in rows.all()]

    @strawberry.field
    async def lesson(self, info: CtxInfo, slug: str) -> Lesson | None:
        rows = await info.context.execute(
            text(
                f"select {LESSON_COLUMNS} from public.lessons l "  # noqa: S608
                "where l.slug = :slug and l.status = 'published' and l.deleted_at is null"
            ),
            {"slug": slug},
        )
        r = rows.first()
        return _lesson(r) if r else None

    @strawberry.field(description="Task types of one section with question counts and the viewer's results")
    async def practice_types(self, info: CtxInfo, section: str) -> list[PracticeTypeStats]:
        if section not in ("speaking_writing", "reading", "listening"):
            return []
        cats = (
            (
                await info.context.execute(
                    select(models.QuestionCategory)
                    .where(models.QuestionCategory.section == section)
                    .order_by(models.QuestionCategory.sort_order)
                )
            )
            .scalars()
            .all()
        )
        rows = await info.context.execute(
            text(
                "select c.id, (select count(*) from public.questions q where q.category_id = c.id "
                "and q.status = 'published' and q.deleted_at is null), "
                "count(a.id), avg(a.score_ratio) from public.question_categories c "
                "left join public.attempts a on a.category_id = c.id and a.user_id = :u and a.question_id is not null "
                "where c.section = cast(:s as public.pte_section) group by c.id"
            ),
            {"u": info.context.user.id, "s": section},
        )
        stats: dict[Any, list[Any]] = {r[0]: list(r) for r in rows.all()}
        out = []
        for c in cats:
            r = stats.get(c.id)
            out.append(
                PracticeTypeStats(
                    category=QuestionCategory.of(c),
                    question_count=int(r[1]) if r else 0,
                    auto_marked=c.code in AUTO_MARKED,
                    attempts=int(r[2]) if r else 0,
                    average_score=float(r[3]) if r and r[3] is not None else None,
                )
            )
        return out

    @strawberry.field(description="Published questions of one task type, easiest first")
    async def practice_questions(self, info: CtxInfo, category_code: str, limit: int = 50) -> list[PracticeQuestion]:
        rows = await info.context.execute(
            text(
                f"select {QUESTION_COLUMNS} from public.questions q "  # noqa: S608 (constant column list)
                "join public.question_categories c on c.id = q.category_id "
                "where c.code = :code and q.status = 'published' and q.deleted_at is null "
                "order by q.difficulty, q.external_id limit :lim"
            ),
            {"code": category_code, "lim": max(1, min(limit, 100))},
        )
        return [_question(r) for r in rows.all()]

    @strawberry.field
    async def practice_question(self, info: CtxInfo, id: strawberry.ID) -> PracticeQuestion | None:
        try:
            qid = uuid.UUID(str(id))
        except ValueError:
            return None
        rows = await info.context.execute(
            text(
                f"select {QUESTION_COLUMNS} from public.questions q "  # noqa: S608
                "join public.question_categories c on c.id = q.category_id "
                "where q.id = :id and q.status = 'published' and q.deleted_at is null"
            ),
            {"id": qid},
        )
        r = rows.first()
        return _question(r) if r else None

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

"""SQLAlchemy models mapped to tables created by supabase/migrations (no Alembic)."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import ARRAY, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, SmallInteger, Text
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

skill_enum = ENUM("speaking", "writing", "reading", "listening", name="skill", create_type=False)
section_enum = ENUM("speaking_writing", "reading", "listening", name="pte_section", create_type=False)
status_enum = ENUM("draft", "ai_generated", "reviewed", "published", name="content_status", create_type=False)
difficulty_enum = ENUM("beginner", "intermediate", "advanced", name="difficulty", create_type=False)
mode_enum = ENUM("learn", "practice", "timed_drill", "exam", "review", name="practice_mode", create_type=False)
role_enum = ENUM("student", "content_editor", "admin", name="app_role", create_type=False)


class Base(DeclarativeBase):
    pass


class LearningLevel(Base):
    __tablename__ = "learning_levels"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    code: Mapped[int] = mapped_column(SmallInteger)
    slug: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    cefr: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)


class QuestionCategory(Base):
    __tablename__ = "question_categories"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    section: Mapped[str] = mapped_column(section_enum)
    skills: Mapped[list[str]] = mapped_column(ARRAY(skill_enum))
    sort_order: Mapped[int] = mapped_column(SmallInteger)
    verified: Mapped[bool] = mapped_column(Boolean)


class Profile(Base):
    __tablename__ = "profiles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    display_name: Mapped[str | None] = mapped_column(Text)
    learning_level_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("learning_levels.id"))
    target_score: Mapped[int | None] = mapped_column(SmallInteger)
    exam_date: Mapped[date | None] = mapped_column(Date)
    daily_goal_minutes: Mapped[int] = mapped_column(SmallInteger)
    locale: Mapped[str] = mapped_column(Text)
    age_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class UserRole(Base):
    __tablename__ = "user_roles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    role: Mapped[str] = mapped_column(role_enum)


class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    slug: Mapped[str] = mapped_column(Text)
    learning_level_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("learning_levels.id"))
    title: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(SmallInteger)
    estimated_minutes: Mapped[int] = mapped_column(SmallInteger)
    status: Mapped[str] = mapped_column(status_enum)


class Attempt(Base):
    __tablename__ = "attempts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    question_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    mode: Mapped[str] = mapped_column(mode_enum)
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    score_ratio: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LearningProgress(Base):
    __tablename__ = "learning_progress"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(Text)
    score_ratio: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TestSession(Base):
    __tablename__ = "test_sessions"
    __test__ = False  # not a pytest class
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    kind: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text)
    result_summary: Mapped[dict[str, Any]] = mapped_column(JSONB)
    blueprint_code: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

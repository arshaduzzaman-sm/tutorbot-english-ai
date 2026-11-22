"""GraphQL request context: verified user, RLS-scoped session and DataLoaders."""

import asyncio
import uuid
from collections.abc import Sequence
from typing import Any

from fastapi import Depends
from sqlalchemy import Executable, select, text
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from strawberry.fastapi import BaseContext

from app.api.deps import get_user_db
from app.core.security import AuthUser, get_current_user
from app.db.models import LearningLevel, QuestionCategory


class Context(BaseContext):
    def __init__(self, user: AuthUser, session: AsyncSession) -> None:
        super().__init__()
        self.user = user
        self.session = session
        # One AsyncSession cannot run queries concurrently; resolvers run in parallel.
        self._lock = asyncio.Lock()
        self.level_loader: DataLoader[uuid.UUID, LearningLevel | None] = DataLoader(self._load_levels)
        self.category_loader: DataLoader[uuid.UUID, QuestionCategory | None] = DataLoader(self._load_categories)
        self.progress_loader: DataLoader[uuid.UUID, dict[str, Any] | None] = DataLoader(self._load_progress)
        self.query_count = 0

    async def execute(self, stmt: Executable, params: dict[str, Any] | None = None) -> Result[Any]:
        async with self._lock:
            self.query_count += 1
            return await self.session.execute(stmt, params or {})

    async def _load_levels(self, ids: Sequence[uuid.UUID]) -> list[LearningLevel | None]:
        rows = (await self.execute(select(LearningLevel).where(LearningLevel.id.in_(ids)))).scalars().all()
        by_id = {r.id: r for r in rows}
        return [by_id.get(i) for i in ids]

    async def _load_progress(self, lesson_ids: Sequence[uuid.UUID]) -> list[dict[str, Any] | None]:
        rows = (
            (
                await self.execute(
                    text(
                        "select lesson_id, status, score_ratio, completed_at from public.learning_progress "
                        "where user_id = :uid and lesson_id = any(:ids)"
                    ),
                    {"uid": self.user.id, "ids": list(lesson_ids)},
                )
            )
            .mappings()
            .all()
        )
        by_id = {r["lesson_id"]: dict(r) for r in rows}
        return [by_id.get(i) for i in lesson_ids]

    async def _load_categories(self, ids: Sequence[uuid.UUID]) -> list[QuestionCategory | None]:
        rows = (await self.execute(select(QuestionCategory).where(QuestionCategory.id.in_(ids)))).scalars().all()
        by_id = {r.id: r for r in rows}
        return [by_id.get(i) for i in ids]


async def get_context(
    user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
) -> Context:
    return Context(user, session)

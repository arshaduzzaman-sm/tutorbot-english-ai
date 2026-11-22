"""Shared FastAPI dependencies: authenticated DB session and role checks."""

from collections.abc import AsyncIterator, Callable, Coroutine
from typing import Any

from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.db.session import user_session


async def get_user_db(user: AuthUser = Depends(get_current_user)) -> AsyncIterator[AsyncSession]:
    async with user_session(user) as session:
        yield session


async def user_roles(session: AsyncSession, user_id: str) -> list[str]:
    rows = await session.execute(
        text("select role::text from public.user_roles where user_id = :uid order by role"), {"uid": user_id}
    )
    return [r[0] for r in rows]


def require_role(*allowed: str) -> Callable[..., Coroutine[Any, Any, AuthUser]]:
    async def checker(
        user: AuthUser = Depends(get_current_user), session: AsyncSession = Depends(get_user_db)
    ) -> AuthUser:
        if not set(allowed) & set(await user_roles(session, user.id)):
            raise HTTPException(status_code=403, detail="You do not have permission to do this.")
        return user

    return checker

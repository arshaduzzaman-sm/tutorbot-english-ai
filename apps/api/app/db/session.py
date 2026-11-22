"""Database sessions.

`user_session` runs a transaction as the Postgres `authenticated` role with the
caller's JWT claims, so Row-Level Security protects every user query (SPEC 3.1.4).
`service_session` is privileged and only used for actions RLS cannot express
(for example deleting the caller's own auth user), after the JWT is verified.
"""

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import AuthUser

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine, _sessionmaker
    if _engine is None:
        _engine = create_async_engine(get_settings().database_url, pool_size=5, max_overflow=5, pool_pre_ping=True)
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def _maker() -> async_sessionmaker[AsyncSession]:
    get_engine()
    assert _sessionmaker is not None
    return _sessionmaker


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None


@asynccontextmanager
async def user_session(user: AuthUser) -> AsyncIterator[AsyncSession]:
    async with _maker()() as session, session.begin():
        await session.execute(text("set local role authenticated"))
        await session.execute(
            text("select set_config('request.jwt.claims', :claims, true)"),
            {"claims": json.dumps(user.claims)},
        )
        yield session


@asynccontextmanager
async def service_session() -> AsyncIterator[AsyncSession]:
    async with _maker()() as session, session.begin():
        yield session

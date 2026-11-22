import os
import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "100000")

from app.core.config import get_settings  # noqa: E402
from app.core.security import get_jwks  # noqa: E402
from app.db.session import dispose_engine, get_engine, service_session  # noqa: E402
from app.main import create_app  # noqa: E402
from tests.helpers import make_token, test_jwks  # noqa: E402

get_jwks(get_settings()).pin(test_jwks())


@pytest.fixture(scope="session")
def app():  # type: ignore[no-untyped-def]
    return create_app()


@pytest.fixture
async def client(app) -> AsyncIterator[AsyncClient]:  # type: ignore[no-untyped-def]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _db_available() -> bool:
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("select 1"))
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
async def db() -> AsyncIterator[None]:
    if not await _db_available():
        if os.environ.get("REQUIRE_DB") == "1":
            pytest.fail("Database not reachable but REQUIRE_DB=1")
        pytest.skip("Local Supabase database is not running (run `make start`)")
    yield
    await dispose_engine()


class TestUser:
    __test__ = False

    def __init__(self, user_id: str, email: str) -> None:
        self.id = user_id
        self.email = email
        self.token = make_token(user_id, email=email)


@pytest.fixture
async def make_user(db) -> AsyncIterator:  # type: ignore[no-untyped-def]
    """Creates auth users directly in the DB (the signup trigger builds profile + role)."""
    created: list[str] = []

    async def _make(roles: tuple[str, ...] = ()) -> TestUser:
        uid = str(uuid.uuid4())
        email = f"pytest-{uid[:8]}@example.test"
        async with service_session() as s:
            await s.execute(
                text(
                    "insert into auth.users (instance_id, id, aud, role, email, encrypted_password, "
                    "email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) "
                    "values ('00000000-0000-0000-0000-000000000000', :id, 'authenticated', 'authenticated', "
                    ":email, '', now(), '{}'::jsonb, "
                    '\'{"display_name": "Test Learner", "age_confirmed": "true"}\'::jsonb, now(), now())'
                ),
                {"id": uid, "email": email},
            )
            for role in roles:
                await s.execute(
                    text("insert into public.user_roles (user_id, role) values (:id, cast(:r as public.app_role))"),
                    {"id": uid, "r": role},
                )
        created.append(uid)
        return TestUser(uid, email)

    yield _make
    async with service_session() as s:
        for uid in created:
            await s.execute(text("delete from auth.users where id = :id"), {"id": uid})

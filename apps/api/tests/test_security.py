"""FastAPI rejects requests without a valid JWT (M1 acceptance)."""

import time

import jwt
import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.security import AuthUser, get_current_user
from tests.helpers import TEST_KID, auth, make_token


@pytest.fixture
async def protected() -> AsyncClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/protected")
    async def route(user: AuthUser = Depends(get_current_user)) -> dict[str, str]:
        return {"id": user.id}

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_valid_token_is_accepted(protected: AsyncClient) -> None:
    token = make_token("11111111-1111-1111-1111-111111111111")
    r = await protected.get("/protected", headers=auth(token))
    assert r.status_code == 200
    assert r.json() == {"id": "11111111-1111-1111-1111-111111111111"}


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer"}, {"Authorization": "Basic abc"}, {"Authorization": "Bearer not-a-jwt"}],
)
async def test_missing_or_malformed_token_rejected(protected: AsyncClient, headers: dict[str, str]) -> None:
    r = await protected.get("/protected", headers=headers)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(
    "kwargs",
    [
        {"exp_delta": -10},
        {"aud": "someone-else"},
        {"iss": "http://evil.example/auth/v1"},
        {"wrong_key": True},
        {"kid": "unknown-kid"},
        {"role": "anon"},
        {"role": "service_role"},
    ],
)
async def test_invalid_tokens_rejected(protected: AsyncClient, kwargs: dict[str, object]) -> None:
    r = await protected.get("/protected", headers=auth(make_token(**kwargs)))  # type: ignore[arg-type]
    assert r.status_code == 401


async def test_unsigned_and_hs256_tokens_rejected(protected: AsyncClient) -> None:
    claims = {
        "sub": "x",
        "aud": "authenticated",
        "role": "authenticated",
        "iss": get_settings().issuer,
        "exp": int(time.time()) + 60,
    }
    none_token = jwt.encode(claims, key=None, algorithm="none", headers={"kid": TEST_KID})  # type: ignore[arg-type]
    hs_token = jwt.encode(claims, "guessable-secret-that-is-long-enough-123", algorithm="HS256")
    for token in (none_token, hs_token):
        r = await protected.get("/protected", headers=auth(token))
        assert r.status_code == 401


async def test_real_app_rest_and_graphql_require_token(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/me/export")).status_code == 401
    assert (await client.put("/api/v1/me/onboarding", json={"level_code": 1, "target_score": 50})).status_code == 401
    r = await client.post("/graphql", json={"query": "{ viewer { id } }"})
    assert r.status_code == 401
    r = await client.post(
        "/graphql", json={"query": "{ learningLevels { code } }"}, headers=auth(make_token(exp_delta=-5))
    )
    assert r.status_code == 401


async def test_health_is_public_and_reports_mock_providers(client: AsyncClient) -> None:
    r = await client.get("/health")
    assert r.status_code == 200
    assert set(r.json()["ai_providers"].values()) == {"mock"}
    assert r.headers["x-content-type-options"] == "nosniff"

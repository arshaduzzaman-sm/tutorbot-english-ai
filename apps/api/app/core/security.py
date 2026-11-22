"""Supabase JWT verification (SPEC 3.1.3).

Checks signature (JWKS public keys, or an optional HS256 secret), expiry,
audience and issuer on every protected endpoint.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings

ASYMMETRIC_ALGS = ["ES256", "RS256", "EdDSA"]
bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    role: str
    claims: dict[str, Any] = field(repr=False)


class JWKSCache:
    """Fetches and caches the Supabase JWKS. Keys can be injected in tests."""

    def __init__(self, url: str, ttl: int) -> None:
        self.url = url
        self.ttl = ttl
        self._keys: dict[str, jwt.PyJWK] = {}
        self._pinned: dict[str, jwt.PyJWK] = {}
        self._fetched_at = 0.0

    def pin(self, jwks: dict[str, Any]) -> None:
        """Add keys that survive refreshes (used by tests to mint their own tokens)."""
        for k in jwks.get("keys", []):
            self._pinned[k["kid"]] = jwt.PyJWK.from_dict(k)

    def set_keys(self, jwks: dict[str, Any]) -> None:
        self._keys = {}
        for k in jwks.get("keys", []):
            kid = k.get("kid")
            if kid:
                self._keys[kid] = jwt.PyJWK.from_dict(k)
        self._fetched_at = time.monotonic()

    async def refresh(self) -> None:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(self.url)
            resp.raise_for_status()
            self.set_keys(resp.json())

    async def get(self, kid: str) -> jwt.PyJWK | None:
        if kid in self._pinned:
            return self._pinned[kid]
        stale = time.monotonic() - self._fetched_at > self.ttl
        if kid not in self._keys or stale:
            try:
                await self.refresh()
            except httpx.HTTPError:
                if kid not in self._keys:
                    return None
        return self._keys.get(kid)


_jwks: JWKSCache | None = None


def get_jwks(settings: Settings) -> JWKSCache:
    global _jwks
    if _jwks is None or _jwks.url != settings.jwks_url:
        _jwks = JWKSCache(settings.jwks_url, settings.jwks_cache_seconds)
    return _jwks


def unauthorized(message: str = "Invalid or missing access token.") -> HTTPException:
    return HTTPException(status_code=401, detail=message, headers={"WWW-Authenticate": "Bearer"})


async def verify_token(token: str, settings: Settings) -> AuthUser:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise unauthorized() from exc
    alg = header.get("alg")
    options = {"require": ["exp", "sub", "aud"]}
    try:
        if alg in ASYMMETRIC_ALGS:
            key = await get_jwks(settings).get(str(header.get("kid", "")))
            if key is None:
                raise unauthorized()
            claims = jwt.decode(
                token,
                key.key,
                algorithms=[alg],
                audience=settings.jwt_audience,
                issuer=settings.issuer,
                options=options,  # type: ignore[arg-type]
            )
        elif alg == "HS256" and settings.jwt_secret:
            claims = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                audience=settings.jwt_audience,
                issuer=settings.issuer,
                options=options,  # type: ignore[arg-type]
            )
        else:
            raise unauthorized()
    except jwt.ExpiredSignatureError as exc:
        raise unauthorized("Access token expired.") from exc
    except jwt.PyJWTError as exc:
        raise unauthorized() from exc
    if claims.get("role") != "authenticated":
        raise unauthorized()
    return AuthUser(id=str(claims["sub"]), email=claims.get("email"), role="authenticated", claims=claims)


def extract_bearer(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token.strip()


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> AuthUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise unauthorized()
    return await verify_token(creds.credentials, settings)

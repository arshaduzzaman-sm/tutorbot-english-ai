"""Test helpers: a test signing key and token minting."""

import json
import time
import uuid
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from jwt.algorithms import ECAlgorithm

from app.core.config import get_settings

TEST_KID = "pytest-key"
_private = ec.generate_private_key(ec.SECP256R1())
_other_private = ec.generate_private_key(ec.SECP256R1())


def test_jwks() -> dict[str, Any]:
    jwk = json.loads(ECAlgorithm.to_jwk(_private.public_key()))
    jwk.update({"kid": TEST_KID, "alg": "ES256", "use": "sig"})
    return {"keys": [jwk]}


def make_token(
    sub: str | None = None,
    *,
    email: str | None = "learner@example.test",
    exp_delta: int = 600,
    aud: str = "authenticated",
    iss: str | None = None,
    role: str = "authenticated",
    wrong_key: bool = False,
    kid: str = TEST_KID,
) -> str:
    now = int(time.time())
    claims = {
        "sub": sub or str(uuid.uuid4()),
        "email": email,
        "aud": aud,
        "iss": iss or get_settings().issuer,
        "role": role,
        "iat": now,
        "exp": now + exp_delta,
    }
    key = _other_private if wrong_key else _private
    return jwt.encode(claims, key, algorithm="ES256", headers={"kid": kid})


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

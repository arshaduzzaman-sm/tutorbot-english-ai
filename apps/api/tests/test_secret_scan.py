"""The secret scanner finds planted secrets and ignores known public local-development values."""

import importlib.util
from pathlib import Path

PATH = Path(__file__).resolve().parents[3] / "scripts" / "secret_scan.py"
spec = importlib.util.spec_from_file_location("secret_scan", PATH)
assert spec and spec.loader
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)


def _diff(*lines: str, file: str = "app/x.py") -> str:
    return "\n".join(["commit abcdef1234", f"+++ b/{file}", *(f"+{x}" for x in lines)])


def test_finds_planted_secrets() -> None:
    # Built from parts so this test file itself never looks like a secret to the scanner
    key = "AKIA" + "ABCDEFGHIJKLMNOP"
    pem = "-----BEGIN RSA " + "PRIVATE KEY-----"
    pw = "pass" + 'word = "Tr0ub4dor&3xyz"'
    found = scanner.scan(_diff(f'aws = "{key}"', pem, pw), "t")
    assert len(found) == 3


def test_ignores_public_and_placeholder_values() -> None:
    ok = scanner.scan(
        _diff(
            'secret = "env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)"',
            'password: "passwordShort",',
            "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres",
            "SUPABASE_ANON_KEY=replace-me",
        ),
        "t",
    )
    assert ok == []
    lock_line = "tok" + 'en = "AKIA' + "0" * 16 + '"'
    assert scanner.scan(_diff(lock_line, file="uv.lock"), "t") == []

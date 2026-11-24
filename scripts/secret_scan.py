#!/usr/bin/env python3
"""Scan the whole Git history (every commit, every branch) for secrets and personal data. Exit 1 on a finding.

Usage: python3 scripts/secret_scan.py [--worktree]   (--worktree also scans uncommitted files)

Known public values are allowed: the Supabase local-development demo keys (published in the Supabase docs and
identical on every computer), test email domains and the placeholder `replace-me`.
"""

import re
import subprocess
import sys

PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "GitHub token": re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b"),
    "Slack token": re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"),
    "Stripe key": re.compile(r"\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b"),
    "OpenAI/Anthropic key": re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    "JWT": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    "password in URL": re.compile(r"[a-z]+://[^/\s:@]+:([^@\s/]{6,})@"),
    "assigned secret": re.compile(
        r"(?i)\b(?:secret|password|passwd|api_key|apikey|token|service_role_key)\b\s*[:=]\s*[\"']([^\"'\s]{12,})[\"']"
    ),
}
# Public by design or obviously fake
ALLOWED = [
    re.compile(r"postgres:postgres@"),  # local Supabase default
    re.compile(r":\$\{POSTGRES_PASSWORD"),
    re.compile(r"supabase-demo"),  # the public local demo JWTs have iss "supabase-demo"
    re.compile(r"replace-me|example\.test|Learner-pass-123|test-only|not-a-secret|pytest"),
]
# Values that are references or message keys, not secrets: env(NAME), ${NAME}, camelCase words
NOT_SECRET = re.compile(r"^(env\(.*\)|\$\{.*\}|[a-z]+(?:[A-Z][a-z]+)+)$")
SKIP_FILES = re.compile(r"(pnpm-lock\.yaml|uv\.lock|seed\.sql|\.svg|generated/|schema\.d\.ts|openapi\.json)$")
DEMO_JWT_PAYLOADS = ("eyJpc3MiOiJzdXBhYmFzZS1kZW1v",)  # base64 of {"iss":"supabase-demo"...


def allowed(line: str) -> bool:
    return any(p.search(line) for p in ALLOWED) or any(d in line for d in DEMO_JWT_PAYLOADS)


def scan(stream: str, label: str) -> list[str]:
    findings = []
    current_file = ""
    commit = ""
    for line in stream.splitlines():
        if line.startswith("commit "):
            commit = line.split()[1][:10]
        elif line.startswith("+++ b/"):
            current_file = line[6:]
        elif line.startswith("+") and not line.startswith("+++"):
            if SKIP_FILES.search(current_file) or allowed(line):
                continue
            for name, pat in PATTERNS.items():
                m = pat.search(line)
                if m and not (m.groups() and NOT_SECRET.match(m.group(1))):
                    findings.append(f"{label} {commit} {current_file}: possible {name}")
    return findings


def main() -> int:
    history = subprocess.run(
        ["git", "log", "--all", "-p", "--no-color", "--unified=0", "--format=commit %H"],
        capture_output=True, text=True, check=True,
    ).stdout
    findings = scan(history, "history")
    if "--worktree" in sys.argv:
        diff = subprocess.run(["git", "diff", "HEAD", "--no-color", "--unified=0"], capture_output=True, text=True).stdout
        findings += scan(diff, "worktree")
    tracked = subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True).stdout.split()
    forbidden = [f for f in tracked if re.search(r"(^|/)\.env($|\.(?!example))|\.(pem|key|p12|wav|webm|opus|onnx|bin|safetensors)$", f)]
    findings += [f"tracked file that must not be committed: {f}" for f in forbidden]
    commits = history.count("\ncommit ") + history.startswith("commit ")
    if findings:
        print("\n".join(sorted(set(findings))))
        print(f"{len(set(findings))} possible secret(s) found in {commits} commits.")
        return 1
    print(f"No secrets found in {commits} commits (all branches) and {len(tracked)} tracked files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

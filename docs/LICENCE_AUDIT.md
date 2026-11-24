# Dependency and licence audit · v1.0.0 · 2026-11-22

Our code is MIT (`LICENSE`). Our content (lessons, questions, academy guides, vocabulary meanings) is CC BY-SA 4.0
(`content/LICENSE.md`). Every third-party part below allows free use and redistribution in an open-source project.

## How to repeat this audit
```
cd apps/web && pnpm licenses list --prod          # web runtime dependencies
cd apps/api && uv run python -c "..."             # see the script in this file's history, or use pip-licenses
pnpm audit --prod                                 # known vulnerabilities (JS)
cd apps/api && uv run --with pip-audit pip-audit  # known vulnerabilities (Python)
python3 scripts/secret_scan.py                    # secrets in the full Git history
```

## Web (production dependencies: 215 packages)
| Licence | Count | Notes |
|---|---|---|
| MIT | 187 | Next.js, React, next-intl, urql, openapi-fetch, Tailwind, Supabase JS and most others |
| Apache-2.0 (incl. Apache-2.0 AND MIT) | 15 | sharp, SWC, Playwright (test only), class-variance-authority |
| ISC | 7 | lucide-react (icons), semver and others |
| BSD-3-Clause | 2 | intl-messageformat, source-map-js |
| 0BSD | 1 | tslib |
| CC-BY-4.0 | 1 | caniuse-lite (browser data; attribution kept in its package) |
| LGPL-3.0-or-later | 2 | libvips binaries used by sharp (image optimisation). Dynamically linked and unmodified, as LGPL allows |

## API (Python environment: 48 packages)
| Licence | Count | Notes |
|---|---|---|
| MIT | 25 | FastAPI, Pydantic, SQLAlchemy, Strawberry, PyJWT, ruff/mypy/pytest (dev) |
| BSD-3-Clause / BSD | 10 | Starlette, uvicorn, httpx, click |
| Apache-2.0 (or dual) | 7 | asyncpg, cryptography, packaging |
| MPL-2.0 | 2 | certifi, pathspec: file-level copyleft, used unmodified |
| PSF-2.0, MIT-0 | 3 | typing_extensions, greenlet, cffi |

Optional AI group (`uv sync --group ai`, not installed by default): faster-whisper (MIT), sentence-transformers
(Apache-2.0), PyTorch (BSD-3-Clause).

## AI models, services and data (not stored in the repository)
| Part | Licence | How it is used |
|---|---|---|
| Whisper weights via faster-whisper / CTranslate2 | MIT | Downloaded by `scripts/download-models.sh`, git-ignored |
| Silero VAD | MIT | Bundled inside faster-whisper |
| all-MiniLM-L6-v2 | Apache-2.0 | Downloaded on first use |
| LanguageTool server 6.6 | LGPL-2.1 | Separate Docker container, called over HTTP |
| Ollama 0.12.6 | MIT | Separate Docker container |
| Qwen3 4B (default LLM) | Apache-2.0 | Pulled by Ollama |
| Kokoro-82M (optional audio) | Apache-2.0 | Used by `make audio`; output audio is git-ignored |
| Browser speech voices | Provided by the user's browser/OS | Used live only; nothing is saved or shipped |
| wordfreq frequency data | CC BY-SA 4.0 (data) / Apache-2.0 (code) | Used once to choose the vocabulary list; meanings and examples are ours |
| Supabase CLI and images | Apache-2.0 / PostgreSQL licence | Local development stack |

## Result
No licence conflicts found for an MIT + CC BY-SA 4.0 open-source project. No copyleft code is linked into our
code (LGPL/MPL parts are used unmodified or run as separate processes). Vulnerability audits: no known issues.

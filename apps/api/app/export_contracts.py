"""Write the GraphQL SDL and OpenAPI JSON used by the frontend code generators.

Usage: uv run python -m app.export_contracts ../web/src
"""

import json
import sys
from pathlib import Path

from app.graphql.schema import build_schema
from app.main import create_app


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "../web/src")
    (out / "graphql").mkdir(parents=True, exist_ok=True)
    (out / "api").mkdir(parents=True, exist_ok=True)
    (out / "graphql" / "schema.graphql").write_text(build_schema().as_str() + "\n", encoding="utf-8")
    spec = create_app().openapi()
    (out / "api" / "openapi.json").write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote contracts to {out}")


if __name__ == "__main__":
    main()

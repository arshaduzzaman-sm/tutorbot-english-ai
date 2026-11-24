#!/usr/bin/env python3
"""Import practice questions from a CSV or JSON file into content/questions/ (SPEC 11).

Content editors and the LLM drafting script write a file; this script checks every question with the same rules as
the seed builder and merges it into a content file in Git, where it can be reviewed. Then run `make seed`.

Usage:
  python3 scripts/import_content.py FILE [--into imported.json] [--status draft|ai_generated|reviewed|published]
                                         [--dry-run]

FILE (.json): {"questions": [...]} or a list, in the same shape as content/questions/*.json.
FILE (.csv): one row per question with these columns (JSON columns hold JSON text):
  external_id, category, difficulty, instructions, explanation, learning_objective,
  content (JSON), answer (JSON), options (A|text|true;B|text|false), scoring_criteria (a;b), key_points (a;b), status

New questions default to status "draft": learners only see "published" ones. A question whose external_id
already exists in the target file is replaced; one that exists in another file is refused.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_rules import STATUSES, check_question  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "content" / "questions"
CATEGORIES = ROOT / "content" / "question_categories.json"


def _split(value: str) -> list[str]:
    return [v.strip() for v in value.split(";") if v.strip()]


def parse_options(value: str) -> list[dict[str, Any]]:
    """`A|Reading aloud|true;B|Watching videos|false` -> option dicts."""
    out = []
    for part in _split(value):
        label, body, correct = (p.strip() for p in part.split("|"))
        out.append({"label": label, "body": body, "is_correct": correct.lower() in ("true", "yes", "1")})
    return out


def read_csv(path: Path) -> list[dict[str, Any]]:
    items = []
    with path.open(newline="", encoding="utf-8") as fh:
        for n, row in enumerate(csv.DictReader(fh), start=2):
            try:
                item: dict[str, Any] = {k: (row.get(k) or "").strip() for k in (
                    "external_id", "category", "difficulty", "instructions", "explanation", "learning_objective")}
                item["content"] = json.loads(row.get("content") or "{}")
                item["answer"] = json.loads(row.get("answer") or "{}")
                if row.get("options"):
                    item["options"] = parse_options(row["options"])
                item["scoring_criteria"] = _split(row.get("scoring_criteria") or "")
                item["key_points"] = _split(row.get("key_points") or "")
                if row.get("status"):
                    item["status"] = row["status"].strip()
            except (json.JSONDecodeError, ValueError) as exc:
                raise SystemExit(f"{path.name} line {n}: {exc}") from exc
            items.append(item)
    return items


def read_items(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".csv":
        return read_csv(path)
    data = json.loads(path.read_text(encoding="utf-8"))
    return list(data["questions"] if isinstance(data, dict) else data)


def merge(existing: list[dict[str, Any]], new: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int, int]:
    by_id = {q["external_id"]: i for i, q in enumerate(existing)}
    out = list(existing)
    added = replaced = 0
    for q in new:
        if q["external_id"] in by_id:
            out[by_id[q["external_id"]]] = q
            replaced += 1
        else:
            out.append(q)
            added += 1
    return out, added, replaced


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", type=Path)
    ap.add_argument("--into", default="imported.json", help="target file name in content/questions/")
    ap.add_argument("--status", choices=sorted(STATUSES), help="set this status on every imported question")
    ap.add_argument("--dry-run", action="store_true", help="check only; do not write")
    args = ap.parse_args(argv)

    categories = {c["code"] for c in json.loads(CATEGORIES.read_text(encoding="utf-8"))["categories"]}
    items = read_items(args.file)
    for q in items:
        if args.status:
            q["status"] = args.status
        q.setdefault("status", "draft")
    target = QUESTIONS / Path(args.into).name

    problems = [p for q in items for p in check_question(q, categories)]
    ids = [q.get("external_id") for q in items]
    problems += [f"{i}: appears twice in the import file" for i in {i for i in ids if ids.count(i) > 1}]
    for other in sorted(QUESTIONS.glob("*.json")):
        if other == target:
            continue
        taken = {q["external_id"] for q in json.loads(other.read_text(encoding="utf-8"))["questions"]}
        problems += [f"{i}: already used in {other.name}" for i in ids if i in taken]
    if problems:
        print("Not imported. Fix these problems:", *problems, sep="\n  ", file=sys.stderr)
        return 1

    existing = json.loads(target.read_text(encoding="utf-8"))["questions"] if target.exists() else []
    merged, added, replaced = merge(existing, items)
    if args.dry_run:
        print(f"OK: {len(items)} question(s) valid. Would add {added} and replace {replaced} in {target.name}.")
        return 0
    target.write_text(json.dumps({"questions": merged}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Imported into content/questions/{target.name}: {added} added, {replaced} replaced. Now run: make seed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

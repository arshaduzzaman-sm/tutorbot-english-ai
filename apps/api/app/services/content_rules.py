"""Shared content checks for practice questions (used by build_seed.py and import_content.py).

Each check returns a list of plain-English problems; an empty list means the question is valid.
"""

from __future__ import annotations

import re
from typing import Any

DIFFICULTIES = {"beginner", "intermediate", "advanced"}
STATUSES = {"draft", "ai_generated", "reviewed", "published"}
REQUIRED = ("external_id", "category", "difficulty", "instructions", "explanation", "learning_objective")
GAP = re.compile(r"\{\{(\d+)\}\}")

CHOICE_TYPES = {
    "reading_mc_single": "single",
    "listening_mc_single": "single",
    "highlight_correct_summary": "single",
    "select_missing_word": "single",
    "reading_mc_multiple": "multiple",
    "listening_mc_multiple": "multiple",
}
BLANK_TYPES = {"rw_fill_blanks", "reading_fill_blanks", "listening_fill_blanks"}
AUDIO_TYPES = {
    "listening_fill_blanks",
    "listening_mc_single",
    "listening_mc_multiple",
    "highlight_correct_summary",
    "select_missing_word",
    "highlight_incorrect_words",
    "write_from_dictation",
    "summarize_spoken_text",
}


def _blanks(item: dict[str, Any], content: dict[str, Any], answer: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    gaps = GAP.findall(str(content.get("text", "")))
    want = answer.get("blanks", {})
    if not gaps:
        errs.append("text has no {{n}} gaps")
    if sorted(gaps) != sorted(want):
        errs.append(f"gaps {sorted(gaps)} do not match answer.blanks {sorted(want)}")
    cat = item["category"]
    if cat == "rw_fill_blanks":
        for k, v in want.items():
            if v not in content.get("blanks", {}).get(k, []):
                errs.append(f"blank {k}: answer {v!r} is not one of its options")
    if cat == "reading_fill_blanks":
        bank = content.get("word_bank", [])
        if any(v not in bank for v in want.values()):
            errs.append("an answer is not in word_bank")
        if len(bank) <= len(want):
            errs.append("word_bank needs extra (wrong) words")
    return errs


def check_question(item: dict[str, Any], categories: set[str]) -> list[str]:
    """All problems with one question, prefixed by its id."""
    ext = item.get("external_id", "<no id>")
    errs = [f"missing {f}" for f in REQUIRED if not item.get(f)]
    if errs:
        return [f"{ext}: {e}" for e in errs]
    cat = item["category"]
    content, answer, options = item.get("content", {}), item.get("answer", {}), item.get("options", [])
    if cat not in categories:
        errs.append(f"unknown category {cat}")
    if item["difficulty"] not in DIFFICULTIES:
        errs.append(f"bad difficulty {item['difficulty']!r}")
    if item.get("status", "published") not in STATUSES:
        errs.append(f"bad status {item.get('status')!r}")
    if cat in AUDIO_TYPES and not content.get("audio_script"):
        errs.append("listening question needs content.audio_script")
    if cat in CHOICE_TYPES:
        labels = [o.get("label") for o in options]
        correct = sorted(o["label"] for o in options if o.get("is_correct"))
        if len(options) < 3 or len(set(labels)) != len(labels):
            errs.append("needs at least 3 options with unique labels")
        if correct != sorted(answer.get("correct", [])):
            errs.append("answer.correct does not match the options marked is_correct")
        if CHOICE_TYPES[cat] == "single" and len(correct) != 1:
            errs.append("single-answer question needs exactly one correct option")
        if CHOICE_TYPES[cat] == "multiple" and len(correct) < 2:
            errs.append("multiple-answer question needs at least two correct options")
        if cat == "select_missing_word" and "[BEEP]" not in str(content.get("audio_script", "")):
            errs.append("audio_script needs a [BEEP] where the word is missing")
    if cat in BLANK_TYPES:
        errs += _blanks(item, content, answer)
    if cat == "reorder_paragraphs":
        ids = [p.get("id") for p in content.get("paragraphs", [])]
        order = answer.get("order", [])
        if len(ids) < 3 or sorted(ids) != sorted(order):
            errs.append("answer.order must list every paragraph id (at least 3)")
        elif ids == order:
            errs.append("paragraphs are already in the right order; shuffle them")
    if cat == "highlight_incorrect_words":
        words = str(content.get("transcript", "")).split()
        for w in answer.get("incorrect_words", []):
            i = w.get("index", -1)
            if not 0 <= i < len(words) or words[i].strip(".,!?;:") != w.get("word"):
                errs.append(f"incorrect word {w.get('word')!r} is not at index {i} of the transcript")
    if cat == "write_from_dictation" and answer.get("reference_text") != content.get("audio_script"):
        errs.append("answer.reference_text must equal the audio_script")
    return [f"{ext}: {e}" for e in errs]

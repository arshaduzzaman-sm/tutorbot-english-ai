"""Content tooling: shared question rules and the import script (scripts/)."""

import csv
import json
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import content_rules  # noqa: E402
import import_content  # noqa: E402

CATS = {"reading_mc_single", "rw_fill_blanks", "reorder_paragraphs", "highlight_incorrect_words", "select_missing_word"}
BASE = {"difficulty": "beginner", "instructions": "Do it.", "explanation": "Because.", "learning_objective": "Learn."}


def mcs(ext: str = "t-mcs-1", correct: str = "B") -> dict:  # type: ignore[type-arg]
    return {
        **BASE,
        "external_id": ext,
        "category": "reading_mc_single",
        "content": {"passage": "p", "question": "q"},
        "options": [{"label": x, "body": x, "is_correct": x == correct} for x in "ABC"],
        "answer": {"correct": [correct]},
    }


def test_rules_accept_valid_and_explain_problems() -> None:
    assert content_rules.check_question(mcs(), CATS) == []
    bad = {**mcs(), "answer": {"correct": ["A"]}}
    assert "answer.correct does not match" in content_rules.check_question(bad, CATS)[0]
    blanks = {
        **BASE,
        "external_id": "t-b",
        "category": "rw_fill_blanks",
        "content": {"text": "I {{1}} tea.", "blanks": {"1": ["like", "likes"]}},
        "answer": {"blanks": {"1": "love"}},
    }
    assert any("not one of its options" in p for p in content_rules.check_question(blanks, CATS))
    order = {
        **BASE,
        "external_id": "t-o",
        "category": "reorder_paragraphs",
        "content": {"paragraphs": [{"id": "a"}, {"id": "b"}, {"id": "c"}]},
        "answer": {"order": ["a", "b", "c"]},
    }
    assert any("shuffle" in p for p in content_rules.check_question(order, CATS))
    hiw = {
        **BASE,
        "external_id": "t-h",
        "category": "highlight_incorrect_words",
        "content": {"audio_script": "a big dog", "transcript": "a small dog"},
        "answer": {"incorrect_words": [{"index": 2, "word": "small"}]},
    }
    assert any("not at index 2" in p for p in content_rules.check_question(hiw, CATS))
    smw = {**mcs("t-s"), "category": "select_missing_word", "content": {"audio_script": "no beep here"}}
    assert any("[BEEP]" in p for p in content_rules.check_question(smw, CATS))


@pytest.fixture
def content_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    q = tmp_path / "questions"
    q.mkdir()
    (q / "reading.json").write_text(json.dumps({"questions": [mcs("taken-1")]}))
    cats = tmp_path / "cats.json"
    cats.write_text(json.dumps({"categories": [{"code": c} for c in CATS]}))
    monkeypatch.setattr(import_content, "QUESTIONS", q)
    monkeypatch.setattr(import_content, "CATEGORIES", cats)
    return q


def test_import_csv_defaults_to_draft_and_replaces_by_id(content_dir: Path, tmp_path: Path) -> None:
    src = tmp_path / "new.csv"
    with src.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(
            [
                "external_id",
                "category",
                "difficulty",
                "instructions",
                "explanation",
                "learning_objective",
                "content",
                "answer",
                "options",
                "scoring_criteria",
                "key_points",
                "status",
            ]
        )
        w.writerow(
            [
                "new-1",
                "reading_mc_single",
                "beginner",
                "Read.",
                "Why.",
                "Goal.",
                '{"passage": "p", "question": "q"}',
                '{"correct": ["A"]}',
                "A|one|true;B|two|false;C|three|false",
                "Reading",
                "",
                "",
            ]
        )
    assert import_content.main([str(src), "--dry-run"]) == 0
    assert not (content_dir / "imported.json").exists()
    assert import_content.main([str(src)]) == 0
    saved = json.loads((content_dir / "imported.json").read_text())["questions"]
    assert saved[0]["status"] == "draft" and saved[0]["options"][0] == {"label": "A", "body": "one", "is_correct": True}
    assert import_content.main([str(src), "--status", "ai_generated"]) == 0  # same id: replaced, not duplicated
    saved = json.loads((content_dir / "imported.json").read_text())["questions"]
    assert len(saved) == 1 and saved[0]["status"] == "ai_generated"


def test_import_refuses_invalid_or_taken_ids(
    content_dir: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    src = tmp_path / "new.json"
    src.write_text(json.dumps([mcs("taken-1"), {**mcs("bad-1"), "difficulty": "hard"}]))
    assert import_content.main([str(src)]) == 1
    err = capsys.readouterr().err
    assert "taken-1: already used in reading.json" in err and "bad-1: bad difficulty" in err
    assert not (content_dir / "imported.json").exists()

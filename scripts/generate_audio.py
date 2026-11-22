#!/usr/bin/env python3
"""Pre-generate listening audio from content/questions/listening.json with Kokoro-82M (Apache-2.0, CPU).

Learners never trigger TTS on the server. Files go to apps/web/public/audio/<external_id>.wav (git-ignored).
If a file is missing, the app falls back to the browser's own speech voice.

Setup (once):  pip install "kokoro>=0.9" soundfile numpy   (downloads the model on first run, about 330 MB)
Run:           python3 scripts/generate_audio.py            # only missing files
               python3 scripts/generate_audio.py --force    # all files
               python3 scripts/generate_audio.py --dry-run  # list what would be made, no model needed
"""

import argparse
import json
import sys
from collections.abc import Callable, Iterator
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "content" / "questions" / "listening.json"
OUT = ROOT / "apps" / "web" / "public" / "audio"
RATE = 24_000  # Kokoro output sample rate
# Several accents, as SPEC 6 asks: (Kokoro language code, voice). Chosen per question, deterministic.
VOICES = [("a", "af_heart"), ("b", "bf_emma"), ("a", "am_michael"), ("b", "bm_george")]


def clips() -> Iterator[tuple[str, list[str]]]:
    for q in json.loads(SOURCE.read_text(encoding="utf-8"))["questions"]:
        script = q.get("content", {}).get("audio_script")
        if script:
            yield q["external_id"], [p.strip() for p in script.split("[BEEP]")]


def beep(np, seconds: float = 0.6, hz: float = 1000.0):  # type: ignore[no-untyped-def]
    t = np.arange(int(RATE * seconds)) / RATE
    return (0.3 * np.sin(2 * np.pi * hz * t)).astype("float32")


def build(np, parts: list[str], speak: Callable[[str], object]):  # type: ignore[no-untyped-def]
    """Speech for each part, with a beep between parts and short silences around it."""
    gap = np.zeros(int(RATE * 0.25), dtype="float32")
    pieces = []
    for i, part in enumerate(parts):
        if i:
            pieces += [gap, beep(np), gap]
        if part:
            pieces.append(np.asarray(speak(part), dtype="float32"))
    return np.concatenate(pieces) if pieces else np.zeros(1, dtype="float32")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="regenerate files that already exist")
    ap.add_argument("--dry-run", action="store_true", help="list the files that would be generated")
    args = ap.parse_args()

    todo = [(ext, parts) for ext, parts in clips() if args.force or not (OUT / f"{ext}.wav").exists()]
    if args.dry_run:
        for ext, parts in todo:
            print(f"{ext}.wav  ({len(parts) - 1} beep(s)): {' [BEEP] '.join(parts)[:70]}")
        print(f"{len(todo)} file(s) to generate in {OUT.relative_to(ROOT)}")
        return 0
    if not todo:
        print("All audio files exist. Use --force to regenerate.")
        return 0
    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline
    except ImportError:
        print('Kokoro is not installed. Run: pip install "kokoro>=0.9" soundfile numpy', file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    pipelines: dict[str, object] = {}
    for n, (ext, parts) in enumerate(todo):
        lang, voice = VOICES[sum(map(ord, ext)) % len(VOICES)]
        pipe = pipelines.setdefault(lang, KPipeline(lang_code=lang))

        def speak(text: str, pipe=pipe, voice=voice):  # type: ignore[no-untyped-def]
            return np.concatenate([np.asarray(audio) for _, _, audio in pipe(text, voice=voice)])  # type: ignore[operator]

        sf.write(OUT / f"{ext}.wav", build(np, parts, speak), RATE)
        print(f"[{n + 1}/{len(todo)}] {ext}.wav ({voice})")
    return 0


if __name__ == "__main__":
    sys.exit(main())

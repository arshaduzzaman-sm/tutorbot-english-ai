# Content guide

1. **Original only.** Never copy Pearson, textbook or website questions. Write your own topics and sentences.
2. Every question has: `external_id`, `category` (one of 22 codes), `difficulty`, `instructions`, `content`,
   `answer`, `explanation`, `learning_objective`, `scoring_criteria`, `key_points`; options need `is_correct`.
   Source/licence/author default to original / CC-BY-SA-4.0 / TutorBot English AI contributors.
3. Lessons follow **Learn → See → Try → Check → Review**, in short sentences and common words.
4. Status: `draft`, `ai_generated`, `reviewed`, `published`. AI-generated items stay `ai_generated` until a
   `content_editor` approves them. Learners only see `published` (enforced by RLS).
5. **Instructions** are short, in our own words, and give **no timings or word limits**. Those come only
   from the verified exam blueprint (M4), never from memory.
6. **Importing:** `make import FILE=my-questions.csv` (or `.json`) checks every question with the same rules
   as the seed builder (`scripts/content_rules.py`) and merges it into `content/questions/imported.json`.
   New questions are `draft` unless you pass `STATUS=...`. See the header of `scripts/import_content.py`
   for the CSV columns. Review the Git diff, then run `make seed`.
7. After editing `content/`, run `make seed` (validates and regenerates `supabase/seed.sql`), then
   `supabase db reset` locally. CI fails if seed.sql is out of date.
8. Audio is generated offline with `make audio` (Kokoro). Questions keep the text to speak in `audio_script`.
9. Scoring criteria names must match Pearson's published Score Guide (to be re-checked before M3).
10. **Vocabulary** (`content/vocabulary/level-N.json`): sets of about 26 words. Each word has `id`
    (`word-partofspeech`), `word`, `part_of_speech`, `meaning` (simple words) and `example` (one short
    original sentence). Word choice follows frequency (see `content/LICENSE.md`); never copy dictionary definitions.
11. **Pronunciation** (`content/pronunciation.json`): each topic has a `tip` in our own words, `examples` and at
    least 5 `drill` items. `listen_choose` items say one word (`say`) and offer real minimal pairs; `choose`
    items have a `prompt` and an `explanation`. Answers and `say` never reach the page.
12. **Question banks**: `content/questions/*_bank.json` hold 28 original topics; each topic supplies one
    question of every auto-marked reading and listening type, so some passages appear in more than one type.

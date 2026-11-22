# Content guide

1. **Original only.** Never copy Pearson, textbook or website questions. Write your own topics and sentences.
2. Every question has: `external_id`, `category` (one of 22 codes), `difficulty`, `instructions`, `content`,
   `answer`, `explanation`, `learning_objective`, `scoring_criteria`, `key_points`; options need `is_correct`.
   Source/licence/author default to original / CC-BY-SA-4.0 / TutorBot English AI contributors.
3. Lessons follow **Learn → See → Try → Check → Review**, in short sentences and common words.
4. Status: `draft`, `ai_generated`, `reviewed`, `published`. AI-generated items stay `ai_generated` until a
   `content_editor` approves them. Learners only see `published` (enforced by RLS).
5. After editing `content/`, run `make seed` (validates and regenerates `supabase/seed.sql`), then
   `supabase db reset` locally. CI fails if seed.sql is out of date.
6. Audio is generated offline later (Kokoro, M2). Questions keep the text to speak in `audio_script`.
7. Scoring criteria names must match Pearson's published Score Guide (to be re-checked before M3).

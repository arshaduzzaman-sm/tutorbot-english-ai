/**
 * Task groups and the timings Pearson publishes on its test-format pages (checked 2026-11-22):
 * https://www.pearsonpte.com/pte-academic/test-format/speaking-writing/ and .../listening/
 * Times in seconds. `prepare` = time before the microphone opens; `answer` = recording or writing time.
 */
export const SPEAKING = new Set([
  "read_aloud", "repeat_sentence", "describe_image", "retell_lecture", "answer_short_question",
  "summarize_group_discussion", "respond_to_situation",
]);
export const WRITING = new Set(["summarize_written_text", "write_essay", "summarize_spoken_text"]);
/** Speaking tasks whose prompt is heard (audio plays once in Exam mode). */
export const SPOKEN_PROMPT = new Set([
  "repeat_sentence", "retell_lecture", "answer_short_question", "summarize_group_discussion", "respond_to_situation",
]);

type Timing = { prepare: number | null; answer: number; tone: boolean };
export const SPEAKING_TIMING: Record<string, Timing> = {
  read_aloud: { prepare: 40, answer: 40, tone: true }, // prep "30-40 seconds"; answer "varies by item" (we use 40)
  repeat_sentence: { prepare: null, answer: 15, tone: true },
  describe_image: { prepare: 25, answer: 40, tone: true },
  retell_lecture: { prepare: 10, answer: 40, tone: true },
  answer_short_question: { prepare: null, answer: 10, tone: false },
  summarize_group_discussion: { prepare: 10, answer: 120, tone: true },
  respond_to_situation: { prepare: 10, answer: 40, tone: true },
};
export const WRITING_TIMING: Record<string, { minutes: number; minWords: number; maxWords: number }> = {
  summarize_written_text: { minutes: 10, minWords: 5, maxWords: 75 },
  write_essay: { minutes: 20, minWords: 200, maxWords: 300 },
  summarize_spoken_text: { minutes: 10, minWords: 50, maxWords: 70 },
};

export const wordCount = (text: string) => (text.match(/[A-Za-z0-9']+/g) ?? []).length;
export const clock = (s: number) => `${Math.floor(Math.max(s, 0) / 60)}:${String(Math.max(s, 0) % 60).padStart(2, "0")}`;

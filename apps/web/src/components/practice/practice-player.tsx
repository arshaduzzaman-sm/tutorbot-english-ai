"use client";

import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { components } from "@/api/schema";
import type { PracticeQuestionsQuery } from "@/graphql/generated/graphql";
import { browserApi } from "@/lib/client-api";
import { AudioPlayer } from "./audio-player";
import { type AnswerState, BlanksView, ChoicesView, DictationView, type QuestionContent, ReorderView, WordsView } from "./question-views";

type Question = PracticeQuestionsQuery["practiceQuestions"][number];
type Outcome = components["schemas"]["AnswerOut"];
type Mode = "learn" | "practice" | "review";
export const SINGLE = new Set(["reading_mc_single", "listening_mc_single", "highlight_correct_summary", "select_missing_word"]);

export function initialAnswer(q: Question): AnswerState {
  const c = q.content as QuestionContent;
  if (q.categoryCode === "reorder_paragraphs") return { order: (c.paragraphs ?? []).map((p) => p.id) };
  if (q.categoryCode.endsWith("fill_blanks")) return { blanks: {} };
  if (q.categoryCode === "highlight_incorrect_words") return { indices: [] };
  if (q.categoryCode === "write_from_dictation") return { text: "" };
  return { selected: [] };
}

export function isAnswered(q: Question, a: AnswerState): boolean {
  if (a.order) return true;
  if (a.indices) return a.indices.length > 0;
  if (a.text !== undefined) return a.text.trim().length > 0;
  if (a.blanks) {
    const gaps = ((q.content as QuestionContent).text ?? "").match(/\{\{\d+\}\}/g) ?? [];
    return gaps.length > 0 && gaps.every((g) => a.blanks?.[g.slice(2, -2)]);
  }
  return (a.selected?.length ?? 0) > 0;
}

/** Turns the correct answer into plain words for learners. */
export function describeAnswer(q: Question, correct: Outcome["correct_answer"]): string {
  const c = q.content as QuestionContent;
  if (Array.isArray(correct.order)) {
    const text = new Map((c.paragraphs ?? []).map((p) => [p.id, p.text]));
    return (correct.order as string[]).map((id, i) => `${i + 1}. ${text.get(id) ?? id}`).join(" ");
  }
  if (Array.isArray(correct.incorrect_words)) {
    return (correct.incorrect_words as { word: string; spoken: string }[]).map((w) => `${w.word} → ${w.spoken}`).join(", ");
  }
  if (typeof correct.reference_text === "string") return correct.reference_text;
  if (correct.blanks && typeof correct.blanks === "object") {
    return Object.entries(correct.blanks as Record<string, string>).map(([k, v]) => `(${k}) ${v}`).join(", ");
  }
  return ((correct.correct as string[] | undefined) ?? []).join(", ");
}

/** Counts up while running. Remount (via key) to restart from zero. */
function Elapsed({ running }: { running: boolean }) {
  const t = useTranslations("practice");
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return <p className="text-sm text-muted-foreground" role="timer">{t("timerUnofficial", { time: clock(seconds) })}</p>;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** fixedMode="review" hides the mode choice: no tips, no transcript, no timer (used by spaced review). */
export function PracticePlayer({ questions, fixedMode }: { questions: Question[]; fixedMode?: "review" }) {
  const t = useTranslations("practice");
  const tc = useTranslations("common");
  const [mode, setMode] = useState<Mode>(fixedMode ?? "learn");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<AnswerState>(() => initialAnswer(questions[0]!));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const startedAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const q = questions[index];

  useEffect(() => {
    startedAt.current = Date.now();
  }, [index]);

  if (!q) return <p>{t("empty")}</p>;
  const content = q.content as QuestionContent;

  function load(i: number) {
    setIndex(i);
    setAnswer(initialAnswer(questions[i]!));
    setOutcome(null);
    setError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q || !isAnswered(q, answer)) return setError(t("answerFirst"));
    setPending(true);
    setError(null);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/practice/questions/{question_id}/answer", {
      params: { path: { question_id: q.id } },
      body: { response: answer, mode, duration_seconds: Math.round((Date.now() - startedAt.current) / 1000) },
    });
    setPending(false);
    if (!res?.data) return setError(tc("errorBody"));
    setOutcome(res.data);
    setScores((s) => [...s, res.data.score_ratio]);
  }

  if (done) {
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return (
      <div className="space-y-4" data-testid="practice-done">
        <h2 className="text-2xl font-bold text-primary">{t("doneTitle")}</h2>
        <p>{t("doneBody", { count: scores.length, value: Math.round(avg * 100) })}</p>
        <Button type="button" onClick={() => { setScores([]); setDone(false); load(0); }}>{t("again")}</Button>
      </div>
    );
  }

  const listening = q.category?.section === "listening";
  const wrongWords = new Set(
    ((outcome?.correct_answer.incorrect_words as { index: number }[] | undefined) ?? []).map((w) => w.index),
  );
  const wrongBlanks = new Set((outcome?.parts ?? []).filter((p) => p.correct === false).map((p) => String(p.key)));
  const last = index === questions.length - 1;
  return (
    <div className="space-y-6">
      {!fixedMode && <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-2 text-sm font-medium">{t("modeLabel")}</legend>
        {(["learn", "practice"] as const).map((m) => (
          <label key={m} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-white p-3 has-[:checked]:border-accent-blue">
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-1 size-4" />
            <span>
              <span className="block font-medium">{m === "learn" ? t("modeLearn") : t("modePractice")}</span>
              <span className="block text-sm text-muted-foreground">{m === "learn" ? t("modeLearnHelp") : t("modePracticeHelp")}</span>
            </span>
          </label>
        ))}
      </fieldset>}

      <Progress value={(index + 1) / questions.length} label={t("questionOf", { current: index + 1, total: questions.length })} />

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-primary">
            {t("questionOf", { current: index + 1, total: questions.length })}
          </h2>
          <Badge>{t(`difficulty.${q.difficulty}` as "difficulty.beginner")}</Badge>
        </div>
        {mode === "practice" && <Elapsed key={`${index}-${mode}`} running={!outcome} />}
        <p className="text-sm text-muted-foreground">{q.instructions}</p>
        {mode === "learn" && q.learningObjective && (
          <p className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm">
            <Lightbulb aria-hidden="true" className="mt-0.5 size-4" /> {t("tip", { text: q.learningObjective })}
          </p>
        )}
        {listening && <AudioPlayer key={q.id} questionId={q.id} externalId={q.externalId} learn={mode === "learn"} />}
        {content.passage && <div className="rounded-xl bg-muted p-4"><Markdown>{content.passage}</Markdown></div>}

        {answer.blanks && (
          <BlanksView content={content} value={answer.blanks} disabled={!!outcome} wrong={outcome ? wrongBlanks : undefined}
            onChange={(blanks) => setAnswer({ blanks })} />
        )}
        {answer.selected && (
          <ChoicesView name={`q-${q.id}`} question={content.question ?? t("chooseBest")} options={q.options}
            single={SINGLE.has(q.categoryCode)} value={answer.selected} disabled={!!outcome}
            onChange={(selected) => setAnswer({ selected })} />
        )}
        {answer.indices && (
          <WordsView transcript={content.transcript ?? ""} value={answer.indices} disabled={!!outcome}
            wrong={outcome ? wrongWords : undefined} onChange={(indices) => setAnswer({ indices })} />
        )}
        {answer.text !== undefined && (
          <DictationView value={answer.text} disabled={!!outcome} onChange={(text) => setAnswer({ text })} />
        )}
        {answer.order && (
          <ReorderView paragraphs={content.paragraphs ?? []} order={answer.order} disabled={!!outcome}
            onChange={(order) => setAnswer({ order })} />
        )}

        {error && <Alert tone="danger">{error}</Alert>}
        {!outcome && <Button type="submit" disabled={pending}>{t("submit")}</Button>}
      </form>

      {outcome && (
        <div className="space-y-3" data-testid="practice-outcome">
          <Alert tone={outcome.is_correct ? "success" : "warning"}>
            <p className="font-semibold">
              {outcome.is_correct ? t("allCorrect") : t("someWrong")} {t("scored", { value: Math.round(outcome.score_ratio * 100) })}
            </p>
            <p>{t("correctAnswer", { answer: describeAnswer(q, outcome.correct_answer) })}</p>
            <Markdown>{outcome.explanation}</Markdown>
            {outcome.notebook && (
              <p className="text-sm font-medium" data-testid="notebook-note">
                {t(outcome.notebook === "added" ? "notebookAdded" : outcome.notebook === "mastered" ? "notebookMastered" : "notebookMoved")}
              </p>
            )}
            <p className="text-xs">{outcome.note}</p>
          </Alert>
          <Button type="button" onClick={() => (last ? setDone(true) : load(index + 1))}>
            {last ? t("finish") : t("next")}
          </Button>
        </div>
      )}
    </div>
  );
}

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
import { type AnswerState, BlanksView, ChoicesView, type QuestionContent, ReorderView } from "./question-views";

type Question = PracticeQuestionsQuery["practiceQuestions"][number];
type Outcome = components["schemas"]["AnswerOut"];
type Mode = "learn" | "practice";

function initialAnswer(q: Question): AnswerState {
  const c = q.content as QuestionContent;
  if (q.categoryCode === "reorder_paragraphs") return { order: (c.paragraphs ?? []).map((p) => p.id) };
  if (q.categoryCode.endsWith("fill_blanks")) return { blanks: {} };
  return { selected: [] };
}

function isAnswered(q: Question, a: AnswerState): boolean {
  if (a.order) return true;
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

export function PracticePlayer({ questions }: { questions: Question[] }) {
  const t = useTranslations("practice");
  const tc = useTranslations("common");
  const [mode, setMode] = useState<Mode>("learn");
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

  const wrongBlanks = new Set((outcome?.parts ?? []).filter((p) => p.correct === false).map((p) => String(p.key)));
  const last = index === questions.length - 1;
  return (
    <div className="space-y-6">
      <fieldset className="flex flex-wrap gap-3">
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
      </fieldset>

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
        {content.passage && <div className="rounded-xl bg-muted p-4"><Markdown>{content.passage}</Markdown></div>}

        {answer.blanks && (
          <BlanksView content={content} value={answer.blanks} disabled={!!outcome} wrong={outcome ? wrongBlanks : undefined}
            onChange={(blanks) => setAnswer({ blanks })} />
        )}
        {answer.selected && (
          <ChoicesView name={`q-${q.id}`} question={content.question ?? ""} options={q.options}
            single={q.categoryCode.endsWith("_single")} value={answer.selected} disabled={!!outcome}
            onChange={(selected) => setAnswer({ selected })} />
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

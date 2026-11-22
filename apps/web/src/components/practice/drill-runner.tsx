"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { EvaluationResultLoader, RecordingConsent } from "@/components/evaluation/evaluated-player";
import { SpeakingTask, Countdown } from "@/components/speaking/speaking-task";
import { WritingTask } from "@/components/writing/writing-task";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PracticeQuestionsQuery } from "@/graphql/generated/graphql";
import { browserApi } from "@/lib/client-api";
import { SPEAKING, WRITING } from "@/lib/tasks";
import { AudioPlayer } from "./audio-player";
import { emptyAnswer, ObjectiveAnswer } from "./objective-answer";
import type { AnswerState } from "./question-views";

type Question = PracticeQuestionsQuery["practiceQuestions"][number];
type Result = { questionId: string; ratio?: number; correct?: boolean; evaluationId?: string; skipped?: boolean };
/** Pearson gives no per-item time for reading and listening items, so drills use our own limit (STATUS.md). */
export const DRILL_ITEM_SECONDS: Record<string, number> = { reading: 120, listening: 90 };
const COUNTS = [5, 10, 15, 20];

export function DrillRunner({ questions, consent }: { questions: Question[]; consent: boolean }) {
  const t = useTranslations("drill");
  const [count, setCount] = useState<number | null>(null);
  const [set, setSet] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<AnswerState>({});
  const [results, setResults] = useState<Result[]>([]);
  const [agreed, setAgreed] = useState(consent);
  const [error, setError] = useState<string | null>(null);
  const code = questions[0]?.categoryCode ?? "";
  const evaluated = SPEAKING.has(code) || WRITING.has(code);
  const q = set[index];

  function begin(n: number) {
    const picked = [...questions].sort(() => Math.random() - 0.5).slice(0, n);
    setSet(picked);
    setCount(picked.length);
    setIndex(0);
    setResults([]);
    setAnswer(emptyAnswer(picked[0]!));
  }

  const next = useCallback((r: Result) => {
    setResults((rs) => [...rs, r]);
    const i = index + 1;
    setIndex(i);
    if (set[i]) setAnswer(emptyAnswer(set[i]!));
  }, [index, set]);

  const submitObjective = useCallback(async () => {
    if (!q) return;
    setError(null);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/practice/questions/{question_id}/answer", {
      params: { path: { question_id: q.id } }, body: { response: answer, mode: "timed_drill" },
    });
    if (!res?.data) { setError(t("error")); return; }
    next({ questionId: q.id, ratio: res.data.score_ratio, correct: res.data.is_correct });
  }, [q, answer, next, t]);

  if (SPEAKING.has(code) && !agreed) return <RecordingConsent onAgree={() => setAgreed(true)} />;
  if (count === null) {
    const options = COUNTS.filter((n) => n <= questions.length);
    return (
      <div className="space-y-3">
        <p>{t("intro")}</p>
        {!evaluated && <p className="text-sm text-muted-foreground">{t("ownTiming", { seconds: DRILL_ITEM_SECONDS[questions[0]?.category?.section ?? "reading"] ?? 120 })}</p>}
        <div className="flex flex-wrap gap-2">
          {(options.length ? options : [questions.length]).map((n) => (
            <Button key={n} type="button" onClick={() => begin(n)}>{t("start", { count: n })}</Button>
          ))}
        </div>
      </div>
    );
  }

  if (!q) {
    const marked = results.filter((r) => r.ratio !== undefined);
    const avg = marked.length ? marked.reduce((a, r) => a + (r.ratio ?? 0), 0) / marked.length : 0;
    return (
      <div className="space-y-4" data-testid="drill-done">
        <h2 className="text-2xl font-bold text-primary">{t("doneTitle")}</h2>
        {marked.length > 0 && <p>{t("doneBody", { count: marked.length, correct: marked.filter((r) => r.correct).length, value: Math.round(avg * 100) })}</p>}
        {results.filter((r) => r.evaluationId).map((r, i) => (
          <details key={r.evaluationId} open={i === 0} className="rounded-xl border border-border bg-white p-4">
            <summary className="cursor-pointer font-medium">{t("answerN", { n: i + 1 })}</summary>
            <div className="mt-3"><EvaluationResultLoader id={r.evaluationId!} /></div>
          </details>
        ))}
        {results.some((r) => r.skipped) && <p className="text-sm text-muted-foreground">{t("skipped", { count: results.filter((r) => r.skipped).length })}</p>}
        <Button type="button" onClick={() => setCount(null)}>{t("again")}</Button>
      </div>
    );
  }

  const section = q.category?.section ?? "reading";
  return (
    <div className="space-y-4" data-testid="drill">
      <Progress value={index / set.length} label={t("progress", { current: index + 1, total: set.length })} />
      {evaluated ? (
        SPEAKING.has(code)
          ? <SpeakingTask key={q.id} question={q} mode="timed_drill" onSubmitted={(id) => next({ questionId: q.id, evaluationId: id })} />
          : <WritingTask key={q.id} question={q} mode="timed_drill"
              onSubmitted={(id) => next(id ? { questionId: q.id, evaluationId: id } : { questionId: q.id, skipped: true })} />
      ) : (
        <form key={q.id} className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submitObjective(); }}>
          <Countdown seconds={DRILL_ITEM_SECONDS[section] ?? 120} label={t("timeLeft")} onEnd={() => void submitObjective()} />
          <p className="text-sm text-muted-foreground">{q.instructions}</p>
          {section === "listening" && <AudioPlayer questionId={q.id} externalId={q.externalId} learn={false} maxPlays={1} autoPlay />}
          <ObjectiveAnswer item={q} value={answer} onChange={setAnswer} />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit">{t("next")}</Button>
        </form>
      )}
    </div>
  );
}

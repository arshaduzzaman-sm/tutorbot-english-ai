"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { AudioPlayer } from "@/components/practice/audio-player";
import { Countdown, type TaskMode, type TaskQuestion } from "@/components/speaking/speaking-task";
import { PromptView, type TaskContent } from "@/components/speaking/prompt-view";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { browserApi } from "@/lib/client-api";
import { WRITING_TIMING, wordCount } from "@/lib/tasks";

/** One writing question: editor with live word count and (in timed modes) the published time limit. */
export function WritingTask({
  question, mode, testSessionId, onSubmitted,
}: { question: TaskQuestion; mode: TaskMode; testSessionId?: string; onSubmitted: (evaluationId: string) => void }) {
  const t = useTranslations("writing");
  const tc = useTranslations("common");
  const limits = WRITING_TIMING[question.categoryCode] ?? { minutes: 10, minWords: 1, maxWords: 300 };
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const exam = mode === "exam" || mode === "timed_drill";
  const n = wordCount(text);

  const submit = useCallback(async (auto = false) => {
    if (!text.trim()) {
      if (auto) return onSubmitted("");
      return setError(t("writeFirst"));
    }
    setPending(true);
    setError(null);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/writing/questions/{question_id}/submit", {
      params: { path: { question_id: question.id } },
      body: { text, mode, duration_seconds: Math.round((Date.now() - startedAt) / 1000), test_session_id: testSessionId ?? null },
    });
    setPending(false);
    if (!res?.data) return setError((res?.error as { error?: { message?: string } } | undefined)?.error?.message ?? tc("errorBody"));
    onSubmitted(res.data.id);
  }, [text, mode, question.id, startedAt, testSessionId, onSubmitted, t, tc]);

  const inRange = n >= limits.minWords && n <= limits.maxWords;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} data-testid="writing-task" noValidate>
      <p className="text-sm text-muted-foreground">{question.instructions}</p>
      <PromptView content={question.content as TaskContent} />
      {question.categoryCode === "summarize_spoken_text" && (
        <AudioPlayer questionId={question.id} externalId={question.externalId} learn={mode === "learn"}
          maxPlays={exam ? 1 : undefined} autoPlay={exam} />
      )}
      {mode !== "learn" && (
        <Countdown seconds={limits.minutes * 60} label={t("timeLeft")} onEnd={() => void submit(true)} />
      )}
      <label className="block">
        <span className="mb-1 block font-medium">{t("yourAnswer")}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={question.categoryCode === "write_essay" ? 14 : 5}
          spellCheck={false} autoCorrect="off" autoCapitalize="off" disabled={pending}
          className="w-full rounded-xl border border-border bg-white p-3 text-base focus-visible:outline-2 focus-visible:outline-accent-blue" />
      </label>
      <p className={inRange ? "text-sm text-success" : "text-sm text-muted-foreground"} aria-live="polite" data-testid="word-count">
        {t("words", { count: n, min: limits.minWords, max: limits.maxWords })}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? t("sending") : t("submit")}</Button>
    </form>
  );
}

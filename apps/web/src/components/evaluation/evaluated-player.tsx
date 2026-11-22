"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SpeakingTask, type TaskMode, type TaskQuestion } from "@/components/speaking/speaking-task";
import { WritingTask } from "@/components/writing/writing-task";
import { browserApi } from "@/lib/client-api";
import { type EvalResult, type EvaluationOut, recordingUrl, waitForEvaluation } from "@/lib/evaluations";
import { SPEAKING } from "@/lib/tasks";
import { EvaluationView } from "./evaluation-view";

type Q = TaskQuestion & { difficulty: string };

/** Asks once before the first recording. Stored as a consent row; can be withdrawn on the profile page. */
export function RecordingConsent({ onAgree }: { onAgree: () => void }) {
  const t = useTranslations("speaking");
  const [pending, setPending] = useState(false);
  async function agree() {
    setPending(true);
    const api = await browserApi();
    const res = await api?.PUT("/api/v1/me/consents/recording", { body: { granted: true } });
    setPending(false);
    if (res?.data?.granted) onAgree();
  }
  return (
    <section className="space-y-3 rounded-xl border border-border bg-white p-5" aria-labelledby="consent-heading" data-testid="recording-consent">
      <h2 id="consent-heading" className="text-lg font-semibold text-primary">{t("consentTitle")}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>{t("consent1")}</li>
        <li>{t("consent2")}</li>
        <li>{t("consent3")}</li>
      </ul>
      <Button type="button" onClick={() => void agree()} disabled={pending}>{t("consentAgree")}</Button>
    </section>
  );
}

/** Waits for an evaluation and shows it (with playback of the learner's own recording). */
export function EvaluationResultLoader({ id }: { id: string }) {
  const t = useTranslations("evaluation");
  const [state, setState] = useState<{ e: EvaluationOut | null; audio: string | null; done: boolean }>({ e: null, audio: null, done: false });
  useEffect(() => {
    let live = true;
    void (async () => {
      const e = await waitForEvaluation(id);
      const audio = e?.recording_id ? await recordingUrl(e.recording_id) : null;
      if (live) setState({ e, audio, done: true });
    })();
    return () => { live = false; };
  }, [id]);
  if (!state.done) return <p role="status" data-testid="evaluating">{t("evaluating")}</p>;
  if (!state.e || state.e.status !== "done" || !state.e.result) return <Alert tone="danger">{t("failed")}</Alert>;
  return (
    <div className="space-y-3">
      {state.audio && <audio controls src={state.audio} className="w-full" aria-label={t("yourRecording")} />}
      <EvaluationView result={state.e.result as unknown as EvalResult} transcript={state.e.recording_id ? state.e.response_text : null} />
    </div>
  );
}

export function EvaluatedPlayer({ questions, consent }: { questions: Q[]; consent: boolean }) {
  const t = useTranslations("practice");
  const [mode, setMode] = useState<TaskMode>("practice");
  const [index, setIndex] = useState(0);
  const [agreed, setAgreed] = useState(consent);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const q = questions[index];
  if (!q) return <p>{t("empty")}</p>;
  const speaking = SPEAKING.has(q.categoryCode);
  if (speaking && !agreed) return <RecordingConsent onAgree={() => setAgreed(true)} />;
  const last = index === questions.length - 1;

  return (
    <div className="space-y-6">
      <fieldset className="flex flex-wrap gap-3" disabled={!!evaluationId}>
        <legend className="mb-2 text-sm font-medium">{t("modeLabel")}</legend>
        {(["learn", "practice"] as const).map((m) => (
          <label key={m} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-white p-3 has-[:checked]:border-accent-blue">
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-1 size-4" />
            <span>
              <span className="block font-medium">{m === "learn" ? t("modeLearn") : t("modePractice")}</span>
              <span className="block text-sm text-muted-foreground">{m === "learn" ? t("evalLearnHelp") : t("evalPracticeHelp")}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Progress value={(index + 1) / questions.length} label={t("questionOf", { current: index + 1, total: questions.length })} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-primary">{t("questionOf", { current: index + 1, total: questions.length })}</h2>
        <Badge>{t(`difficulty.${q.difficulty}` as "difficulty.beginner")}</Badge>
      </div>
      {evaluationId ? (
        <>
          <EvaluationResultLoader key={evaluationId} id={evaluationId} />
          <Button type="button" onClick={() => { setEvaluationId(null); setIndex(last ? 0 : index + 1); }}>
            {last ? t("again") : t("next")}
          </Button>
        </>
      ) : speaking ? (
        <SpeakingTask key={`${q.id}-${mode}`} question={q} mode={mode} onSubmitted={setEvaluationId} />
      ) : (
        <WritingTask key={`${q.id}-${mode}`} question={q} mode={mode} onSubmitted={(id) => id && setEvaluationId(id)} />
      )}
    </div>
  );
}

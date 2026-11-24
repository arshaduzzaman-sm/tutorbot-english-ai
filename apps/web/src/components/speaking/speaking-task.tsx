"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AudioPlayer } from "@/components/practice/audio-player";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { uploadRecording } from "@/lib/evaluations";
import { clock, SPEAKING_TIMING, SPOKEN_PROMPT } from "@/lib/tasks";
import { PromptView, type TaskContent } from "./prompt-view";
import { type Recording, Recorder } from "./recorder";

export type TaskMode = "learn" | "practice" | "timed_drill" | "exam";
export type TaskQuestion = { id: string; externalId: string; categoryCode: string; instructions: string; content: unknown };
// Pearson: these recordings stop after three seconds of silence ("Finish speaking before the progress bar...").
const SILENCE_STOP = new Set(["read_aloud", "repeat_sentence", "describe_image", "retell_lecture", "answer_short_question"]);

/** Counts down from `seconds`, then calls onEnd. Shows the time left. */
export function Countdown({ seconds, label, onEnd }: { seconds: number; label: string; onEnd: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) { onEnd(); return; }
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left, onEnd]);
  return <p className="font-medium" role="timer" aria-live="off">{label}: {clock(left)}</p>;
}

/** One speaking question: listen (if spoken) → prepare → record → (check) → upload. */
export function SpeakingTask({
  question, mode, testSessionId, onSubmitted,
}: { question: TaskQuestion; mode: TaskMode; testSessionId?: string; onSubmitted: (evaluationId: string) => void }) {
  const t = useTranslations("speaking");
  const code = question.categoryCode;
  const timing = SPEAKING_TIMING[code] ?? { prepare: null, answer: 40, tone: true };
  const timed = mode !== "learn";
  const exam = mode === "exam" || mode === "timed_drill";
  const spoken = SPOKEN_PROMPT.has(code);
  const [stage, setStage] = useState<"listen" | "prepare" | "record" | "check" | "sending">(spoken ? "listen" : "prepare");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const content = question.content as TaskContent;

  async function send(r: Recording) {
    setStage("sending");
    setError(null);
    const out = await uploadRecording(question.id, r.blob, r.seconds, mode, testSessionId);
    if ("error" in out) { setError(out.error); setStage("check"); return; }
    onSubmitted(out.id);
  }

  function recorded(r: Recording) {
    setRecording(r);
    if (exam) void send(r);
    else setStage("check");
  }

  const afterListen = () => setStage(!timed || timing.prepare ? "prepare" : "record");

  return (
    <div className="space-y-4" data-testid="speaking-task">
      <p className="text-sm text-muted-foreground">{question.instructions}</p>
      <PromptView content={content} showSituation />
      {spoken && (
        <AudioPlayer questionId={question.id} externalId={question.externalId} learn={mode === "learn"}
          maxPlays={exam ? 1 : undefined} autoPlay={exam} onEnded={stage === "listen" ? afterListen : undefined} />
      )}
      {stage === "listen" && !exam && (
        <Button type="button" variant="ghost" onClick={afterListen}>{t("readyToSpeak")}</Button>
      )}
      {stage === "prepare" && (timed && timing.prepare ? (
        <div className="space-y-2">
          <Countdown seconds={timing.prepare} label={t("prepare")} onEnd={() => setStage("record")} />
          {!exam && <Button type="button" variant="outline" onClick={() => setStage("record")}>{t("startNow")}</Button>}
        </div>
      ) : (
        <Recorder key="manual" maxSeconds={timing.answer} tone={timing.tone} onDone={recorded} />
      ))}
      {stage === "record" && (
        <Recorder key="auto" maxSeconds={timing.answer} autoStart tone={timing.tone && timed} allowStop={!exam}
          silenceStop={exam && SILENCE_STOP.has(code) ? 3 : undefined} onDone={recorded} />
      )}
      {stage === "check" && recording && (
        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <p className="font-medium">{t("listenBack")}</p>
          <audio controls src={recording.url} className="w-full" aria-label={t("yourRecording")} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void send(recording)}>{t("submit")}</Button>
            <Button type="button" variant="outline" onClick={() => { setRecording(null); setStage("prepare"); }}>{t("again")}</Button>
          </div>
        </div>
      )}
      {stage === "sending" && <p role="status">{t("sending")}</p>}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

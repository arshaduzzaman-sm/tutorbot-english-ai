"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AudioPlayer } from "@/components/practice/audio-player";
import { emptyAnswer, ObjectiveAnswer } from "@/components/practice/objective-answer";
import type { AnswerState } from "@/components/practice/question-views";
import { SpeakingTask } from "@/components/speaking/speaking-task";
import { WritingTask } from "@/components/writing/writing-task";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { components } from "@/api/schema";
import { browserApi } from "@/lib/client-api";
import { clock, SPEAKING, WRITING } from "@/lib/tasks";
import { ExamReportView } from "./exam-report";

type State = components["schemas"]["ExamState"];

/** Calm test screen: timer top right, question counter, Next. No going back. */
export function ExamRunner({ id }: { id: string }) {
  const t = useTranslations("exam");
  const [state, setState] = useState<State | null>(null);
  const [answer, setAnswer] = useState<AnswerState>({});
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    void (async () => {
      const api = await browserApi();
      const res = await api?.GET("/api/v1/exams/{test_id}", { params: { path: { test_id: id } } });
      if (!live) return;
      if (!res?.data) { setError(t("loadError")); return; }
      setState(res.data);
      setLeft(res.data.section_seconds_left ?? null);
      if (res.data.item) setAnswer(emptyAnswer({ categoryCode: res.data.item.category_code, content: res.data.item.content }));
    })();
    return () => { live = false; };
  }, [id, t, version]);

  // Section clock: when it reaches zero the server ends the section, so reload.
  const clockOn = left !== null;
  useEffect(() => {
    if (!clockOn) return;
    const h = setInterval(() => {
      setLeft((s) => {
        if (s === null) return null;
        if (s <= 1) { clearInterval(h); setTimeout(reload, 500); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(h);
  }, [clockOn, version, reload]);

  const send = useCallback(async (body: { response?: AnswerState; evaluation_id?: string }) => {
    if (!state) return;
    setBusy(true);
    setError(null);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/exams/{test_id}/answer", {
      params: { path: { test_id: id } },
      body: { index: state.index, response: body.response ?? null, evaluation_id: body.evaluation_id ?? null },
    });
    setBusy(false);
    if (!res?.data && res?.response.status !== 409) { setError(t("saveError")); return; }
    reload();
  }, [state, id, reload, t]);

  if (error && !state) return <div className="mx-auto max-w-3xl px-4 py-10"><Alert tone="danger">{error}</Alert></div>;
  if (!state) return <p className="mx-auto max-w-3xl px-4 py-10" role="status">{t("loading")}</p>;
  if (state.status === "completed") return <div className="mx-auto max-w-4xl px-4 py-10"><ExamReportView id={id} /></div>;
  if (state.status === "abandoned") return <div className="mx-auto max-w-3xl px-4 py-10"><p>{t("abandoned")}</p><Link href="/exams" className="underline">{t("backToExams")}</Link></div>;
  const item = state.item;
  if (!item) return null;
  const q = { id: item.id, externalId: item.external_id, categoryCode: item.category_code, instructions: item.instructions, content: item.content, options: item.options };
  const speaking = SPEAKING.has(item.category_code);
  const writing = WRITING.has(item.category_code);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6" data-testid="exam-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-semibold text-primary">{state.section?.title}</p>
          <p className="text-sm text-muted-foreground" data-testid="exam-counter">{t("counter", { current: state.index + 1, total: state.total })}</p>
        </div>
        {left !== null && <p className="rounded-lg bg-muted px-3 py-1 font-mono text-lg" role="timer" aria-label={t("sectionTime")}>{clock(left)}</p>}
      </header>
      {speaking ? (
        <SpeakingTask key={item.id} question={q} mode="exam" testSessionId={id} onSubmitted={(eid) => void send({ evaluation_id: eid })} />
      ) : writing ? (
        <WritingTask key={item.id} question={q} mode="exam" testSessionId={id}
          onSubmitted={(eid) => void send(eid ? { evaluation_id: eid } : {})} />
      ) : (
        <form key={item.id} className="space-y-4" onSubmit={(e) => { e.preventDefault(); void send({ response: answer }); }}>
          <p className="text-sm text-muted-foreground">{item.instructions}</p>
          {state.section?.code === "listening" && <AudioPlayer questionId={item.id} externalId={item.external_id} learn={false} maxPlays={1} autoPlay />}
          <ObjectiveAnswer item={q} value={answer} onChange={setAnswer} disabled={busy} />
          <div className="flex justify-end"><Button type="submit" disabled={busy}>{t("next")}</Button></div>
        </form>
      )}
      {(speaking || writing) && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void send({})}>{t("skip")}</Button>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-xs text-muted-foreground">{t("noBack")}</p>
    </div>
  );
}

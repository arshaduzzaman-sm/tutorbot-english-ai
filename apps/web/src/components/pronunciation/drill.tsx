"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Choices } from "@/components/lessons/lesson-player";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { components } from "@/api/schema";
import { browserApi } from "@/lib/client-api";

type Item = { id: string; type: string; prompt?: string | null; options: string[] };
type Outcome = components["schemas"]["DrillOut"];

/** Plays the word of a listen-and-choose item. The word is fetched on Play so it is not in the page. */
function PlayItem({ slug, itemId }: { slug: string; itemId: string }) {
  const t = useTranslations("pronunciation");
  const [error, setError] = useState<string | null>(null);

  async function play() {
    setError(null);
    try {
      const started = new Audio(`/audio/pron-${itemId}.wav`).play() as Promise<void> | undefined;
      if (!started) throw new Error("no audio support");
      await started;
      return;
    } catch {
      // fall back to the browser voice below
    }
    if (!("speechSynthesis" in window)) return setError(t("noVoice"));
    const api = await browserApi();
    const res = await api?.GET("/api/v1/pronunciation/{slug}/items/{item_id}/speech", {
      params: { path: { slug, item_id: itemId } },
    });
    if (!res?.data) return setError(t("noVoice"));
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(res.data.parts[0]);
    u.lang = "en-GB";
    u.rate = 0.8;
    window.speechSynthesis.speak(u);
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" onClick={play}><Play aria-hidden="true" className="size-4" /> {t("play")}</Button>
      {error && <span role="status" className="text-xs text-muted-foreground">{error}</span>}
    </span>
  );
}

export function PronunciationDrill({ slug, items }: { slug: string; items: Item[] }) {
  const t = useTranslations("pronunciation");
  const tc = useTranslations("common");
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.some((it) => !answers[it.id])) return setError(t("answerAll"));
    setPending(true);
    setError(null);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/pronunciation/{slug}/drill", { params: { path: { slug } }, body: { answers } });
    setPending(false);
    if (!res?.data) return setError(tc("errorBody"));
    setOutcome(res.data);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {items.some((it) => it.type === "listen_choose") && <p>{t("drillListen")}</p>}
      {items.map((it, i) => {
        const r = outcome?.results.find((x) => x.id === it.id);
        const label = t("item", { n: i + 1 });
        return (
          <div key={it.id} className="space-y-2 rounded-xl bg-muted p-4" data-testid="drill-item">
            {it.type === "listen_choose" && <PlayItem slug={slug} itemId={it.id} />}
            <Choices ex={{ id: it.id, type: it.type, prompt: it.prompt ?? label, options: it.options, hint: null }} value={answers[it.id]}
              disabled={!!outcome} label={label} onChange={(v) => setAnswers((a) => ({ ...a, [it.id]: v }))} />
            {r && (
              <Alert tone={r.correct ? "success" : "warning"}>
                <p className="font-semibold">{r.correct ? t("correct") : t("notQuite", { answer: r.correct_answer })}</p>
                {r.explanation && <p>{r.explanation}</p>}
              </Alert>
            )}
          </div>
        );
      })}
      {error && <Alert tone="danger">{error}</Alert>}
      {!outcome && <Button type="submit" disabled={pending}>{t("submit")}</Button>}
      {outcome && (
        <div className="space-y-3" data-testid="drill-outcome">
          <Alert tone={outcome.score_ratio >= 0.8 ? "success" : "warning"}>
            <p className="font-semibold">{t("result", { value: Math.round(outcome.score_ratio * 100) })}</p>
          </Alert>
          <Button type="button" variant="outline" onClick={() => { setOutcome(null); setAnswers({}); }}>{t("tryAgain")}</Button>
        </div>
      )}
    </form>
  );
}

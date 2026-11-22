"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import type { components } from "@/api/schema";
import type { UnitTestQuery } from "@/graphql/generated/graphql";
import { browserApi } from "@/lib/client-api";
import { Choices } from "./lesson-player";

type Item = NonNullable<UnitTestQuery["unit"]>["testItems"][number];
type Outcome = components["schemas"]["UnitTestOut"];

export function UnitTestForm({ slug, items }: { slug: string; items: Item[] }) {
  const t = useTranslations("units");
  const tl = useTranslations("lessons");
  const tc = useTranslations("common");
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.some((it) => !answers[it.id])) return setError(tl("answerAll"));
    setPending(true);
    setError(null);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/units/{slug}/test", { params: { path: { slug } }, body: { answers } });
    setPending(false);
    if (!res?.data) return setError(tc("errorBody"));
    setOutcome(res.data);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {items.map((it, i) => {
        const r = outcome?.results.find((x) => x.id === it.id);
        return (
          <div key={it.id} className="space-y-2 rounded-xl bg-muted p-4">
            <Choices ex={it} value={answers[it.id]} disabled={!!outcome} label={tl("question", { n: i + 1 })}
              onChange={(v) => setAnswers((a) => ({ ...a, [it.id]: v }))} />
            {r && (
              <Alert tone={r.correct ? "success" : "warning"}>
                <p className="font-semibold">{r.correct ? tl("correct") : tl("notQuite", { answer: r.correct_answer })}</p>
                <Markdown>{r.explanation}</Markdown>
              </Alert>
            )}
          </div>
        );
      })}
      {error && <Alert tone="danger">{error}</Alert>}
      {!outcome && <Button type="submit" disabled={pending}>{tl("submitCheck")}</Button>}
      {outcome && (
        <div className="space-y-3" data-testid="unit-outcome">
          <Alert tone={outcome.passed ? "success" : "warning"}>
            <p className="font-semibold">{t("result", { value: Math.round(outcome.score_ratio * 100) })}</p>
            <p>
              {outcome.passed
                ? outcome.unlocked ? t("resultPassed") : t("resultPassedLast")
                : t("resultFailed", { pass: Math.round(outcome.pass_ratio * 100) })}
            </p>
          </Alert>
          <div className="flex flex-wrap gap-2">
            {!outcome.passed && (
              <Button type="button" variant="outline" onClick={() => { setOutcome(null); setAnswers({}); }}>{tl("tryAgain")}</Button>
            )}
            <Link href="/lessons" className={buttonVariants(outcome.passed ? {} : { variant: "outline" })}>
              {outcome.unlocked ? t("openNext") : tl("backToLessons")}
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}

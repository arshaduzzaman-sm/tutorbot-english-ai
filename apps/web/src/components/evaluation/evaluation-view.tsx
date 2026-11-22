"use client";

import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { Band, EvalResult } from "@/lib/evaluations";

const BAND_STYLE: Record<Band, string> = {
  needs_work: "bg-red-50 text-[#7f1d1d] border-danger/30",
  developing: "bg-amber-50 text-[#713f12] border-warning/30",
  good: "bg-blue-50 text-[#1e3a8a] border-accent-blue/30",
  strong: "bg-green-50 text-[#14532d] border-success/30",
};

/** Bands and explanations only. Never a 10-90 number (SPEC 7.3). */
export function EvaluationView({ result, transcript }: { result: EvalResult; transcript?: string | null }) {
  const t = useTranslations("evaluation");
  return (
    <section className="space-y-4" aria-labelledby="eval-heading" data-testid="evaluation-result">
      <h2 id="eval-heading" className="text-xl font-semibold text-primary">{t("title")}</h2>
      {result.provider === "mock" && <Alert tone="warning">{t("mockNote")}</Alert>}
      {result.flags.map((f) => (
        <Alert key={f} tone="warning">{t(`flag.${f}` as "flag.off_topic")}</Alert>
      ))}
      <ul className="grid gap-3 sm:grid-cols-2">
        {result.criteria.map((c) => (
          <li key={c.name} className={`rounded-xl border p-4 ${BAND_STYLE[c.band]}`}>
            <p className="flex flex-wrap items-center justify-between gap-2 font-semibold">
              <span>{t(`criterion.${c.name}` as "criterion.content")}</span>
              <span className="text-sm">{t(`band.${c.band}` as "band.good")}</span>
            </p>
            {c.explanation && <p className="mt-1 text-sm">{c.explanation}</p>}
          </li>
        ))}
      </ul>
      {result.feedback && (
        <div className="rounded-xl bg-muted p-4">
          <h3 className="font-semibold">{t("feedback")}</h3>
          <p className="mt-1 text-sm">{result.feedback}</p>
        </div>
      )}
      {transcript && (
        <div>
          <h3 className="font-semibold">{t("transcript")}</h3>
          <p className="mt-1 rounded-xl bg-white p-3 text-sm" data-testid="eval-transcript">{transcript}</p>
        </div>
      )}
      {result.errors.length > 0 && (
        <div>
          <h3 className="font-semibold">{t("errors")}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {result.errors.map((e, i) => (
              <li key={i} className="rounded-lg border border-border bg-white p-3">
                <Badge>{t(`errorType.${e.type}` as "errorType.grammar")}</Badge>{" "}
                <span className="font-medium">{e.text}</span>
                {e.correction && <> → <span className="font-medium">{e.correction}</span></>}
                {e.explanation && <span className="block text-muted-foreground">{e.explanation}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.recommendations.length > 0 && (
        <div>
          <h3 className="font-semibold">{t("next")}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {result.recommendations.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
    </section>
  );
}

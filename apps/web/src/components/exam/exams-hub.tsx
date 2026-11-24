"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { RecordingConsent } from "@/components/evaluation/evaluated-player";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ExamsHubQuery } from "@/graphql/generated/graphql";
import { browserApi } from "@/lib/client-api";
import { PreTest } from "./pre-test";

type Bp = ExamsHubQuery["blueprints"][number];
type Past = ExamsHubQuery["viewer"]["mockExams"][number];

export function ExamsHub({ blueprints, history, consent }: { blueprints: Bp[]; history: Past[]; consent: boolean }) {
  const t = useTranslations("exam");
  const router = useRouter();
  const [chosen, setChosen] = useState<Bp | null>(null);
  const [agreed, setAgreed] = useState(consent);
  const [error, setError] = useState<string | null>(null);

  async function create(code: string) {
    setError(null);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/exams", { body: { blueprint_code: code } });
    if (!res?.data) return setError(t("startError"));
    router.push(`/exams/${res.data.id}`);
  }

  if (chosen) {
    const spec = chosen.spec as { pre_test?: string[] };
    const needsMic = (chosen.sections as string[]).includes("Speaking and Writing");
    if (needsMic && !agreed) return <RecordingConsent onAgree={() => setAgreed(true)} />;
    return (
      <>
        <PreTest steps={spec.pre_test ?? []} onDone={() => void create(chosen.code)} />
        {error && <Alert tone="danger">{error}</Alert>}
      </>
    );
  }
  const inProgress = history.filter((h) => h.status === "in_progress");
  return (
    <div className="space-y-8">
      {inProgress.length > 0 && (
        <Alert tone="info">
          {t("resume")}{" "}
          {inProgress.map((h) => <Link key={h.id} href={`/exams/${h.id}`} className="font-medium underline">{t("resumeLink")}</Link>)}
        </Alert>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {blueprints.map((b) => (
          <li key={b.code} className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-white p-4">
            <div>
              <h2 className="font-semibold">{b.name}</h2>
              <p className="text-sm text-muted-foreground">{b.about}</p>
              <p className="text-sm text-muted-foreground">{t("items", { count: b.itemCount })} · {b.sections.join(", ")}</p>
            </div>
            <Button type="button" className="self-start" onClick={() => setChosen(b)} aria-label={t("startLabel", { name: b.name })}>{t("start")}</Button>
          </li>
        ))}
      </ul>
      <section aria-labelledby="past-h">
        <h2 id="past-h" className="text-xl font-semibold text-primary">{t("history")}</h2>
        {history.length === 0 ? <p className="mt-2 text-muted-foreground">{t("noHistory")}</p> : (
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white p-3 text-sm">
                <span>{new Date(h.startedAt as string).toLocaleString("en-GB")} · {h.blueprintCode ?? h.kind}</span>
                <span>{t(`status.${h.status}` as "status.completed")}{h.overallBand ? ` · ${t(`band.${h.overallBand}` as "band.good")}` : ""}</span>
                {h.status !== "abandoned" && <Link href={`/exams/${h.id}`} className="font-medium text-accent-blue underline">{h.status === "completed" ? t("viewReport") : t("resumeLink")}</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function StartByCode({ code }: { code: string }) {
  const t = useTranslations("exam");
  const router = useRouter();
  const [error, setError] = useState(false);
  async function go() {
    const api = await browserApi();
    const res = await api?.POST("/api/v1/exams", { body: { blueprint_code: code } });
    if (!res?.data) return setError(true);
    router.push(`/exams/${res.data.id}`);
  }
  return (
    <div className="space-y-3">
      <Button type="button" onClick={() => void go()}>{t("start")}</Button>
      {error && <Alert tone="danger">{t("startError")}</Alert>}
    </div>
  );
}

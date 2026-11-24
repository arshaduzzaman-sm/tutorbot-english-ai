"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { AudioPlayer } from "@/components/practice/audio-player";
import { ChoicesView } from "@/components/practice/question-views";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { components } from "@/api/schema";
import type { PlacementQuery } from "@/graphql/generated/graphql";
import { browserApi } from "@/lib/client-api";
import { type Plan, StudyPlanList } from "./study-plan";

type Test = NonNullable<PlacementQuery["placementTest"]>;
type Level = PlacementQuery["learningLevels"][number];
type Result = components["schemas"]["PlacementOut"];

const SKILLS = ["reading", "listening", "writing", "speaking"] as const;

export function PlacementRunner({ test, levels }: { test: Test; levels: Level[] }) {
  const t = useTranslations("placement");
  const tc = useTranslations("common");
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const startedAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const item = test.items[index];
  const total = test.items.length;

  async function finish(all: Record<string, string>) {
    setPending(true);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/placement/submit", {
      body: { answers: all, duration_seconds: Math.round((Date.now() - startedAt.current) / 1000) },
    });
    setPending(false);
    if (!res?.data) return setError(tc("errorBody"));
    setResult(res.data);
    router.refresh();
  }

  function next(skip: boolean) {
    if (!item) return;
    if (!skip && choice.length === 0) return setError(t("chooseFirst"));
    setError(null);
    const all = skip ? answers : { ...answers, [item.id]: item.options[choice[0]!.charCodeAt(0) - 65]! };
    setAnswers(all);
    setChoice([]);
    if (index === total - 1) return void finish(all);
    setIndex(index + 1);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  if (result) {
    const level = levels.find((l) => l.code === result.recommended_level);
    return (
      <div className="space-y-6" data-testid="placement-result">
        <h1 className="text-3xl font-bold text-primary">{t("resultTitle")}</h1>
        <Alert tone="success">
          <p className="font-semibold">{t("resultLevel", { code: result.recommended_level, name: level?.name ?? "" })}</p>
          <p>{t("resultScore", { correct: result.correct, total: result.total })}</p>
          <p className="text-sm">{t("levelSaved")}</p>
        </Alert>
        <section aria-labelledby="skills-heading" className="space-y-3">
          <h2 id="skills-heading" className="text-xl font-semibold text-primary">{t("skillsHeading")}</h2>
          {SKILLS.map((s) => {
            const v = result.skill_scores[s];
            return v == null ? (
              <p key={s}>{t(`skill.${s}`)}: {t("notTested")}</p>
            ) : (
              <Progress key={s} value={v} label={`${t(`skill.${s}`)}: ${Math.round(v * 100)}%`} />
            );
          })}
        </section>
        <section aria-labelledby="plan-heading" className="space-y-2">
          <h2 id="plan-heading" className="text-xl font-semibold text-primary">
            {t("planHeading", { minutes: (result.plan as Plan).daily_minutes })}
          </h2>
          <StudyPlanList plan={result.plan as Plan} />
        </section>
        <p className="text-sm text-muted-foreground">{result.note}</p>
        <Link href="/dashboard" className={buttonVariants()}>{t("toDashboard")}</Link>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p>{t("intro", { minutes: test.estimatedMinutes, count: total })}</p>
        <p className="text-sm text-muted-foreground">{t("note")}</p>
        <Button type="button" onClick={() => { startedAt.current = Date.now(); setStarted(true); }}>{t("start")}</Button>
      </div>
    );
  }

  if (!item) return null;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-primary">{t("title")}</h1>
      <Progress value={(index + 1) / total} label={t("questionOf", { current: index + 1, total })} />
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-primary">
        {t("questionOf", { current: index + 1, total })} · {t(`skill.${item.skill}` as "skill.reading")}
      </h2>
      {item.hasAudio && <AudioPlayer key={item.id} questionId={item.id} externalId={`placement-${item.id}`} learn={false} source="placement" />}
      {item.passage && <div className="rounded-xl bg-muted p-4"><Markdown>{item.passage}</Markdown></div>}
      <ChoicesView name={`p-${item.id}`} question={item.prompt} single value={choice} onChange={setChoice}
        options={item.options.map((o, i) => ({ label: String.fromCharCode(65 + i), body: o }))} />
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => next(false)} disabled={pending}>{index === total - 1 ? t("finish") : t("next")}</Button>
        <Button type="button" variant="ghost" onClick={() => next(true)} disabled={pending}>{t("dontKnow")}</Button>
      </div>
    </div>
  );
}

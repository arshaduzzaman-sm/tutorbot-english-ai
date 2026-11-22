"use client";

import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { LessonQuery } from "@/graphql/generated/graphql";
import { browserApi } from "@/lib/client-api";

type LessonData = NonNullable<LessonQuery["lesson"]>;
type Exercise = LessonData["sections"][number]["exercises"][number];
type Result = { id: string; correct: boolean; correct_answer: string; explanation: string };
type CheckOutcome = { score_ratio: number; passed: boolean; pass_ratio: number; results: Result[] };

function Choices({
  ex, value, onChange, disabled, label,
}: { ex: Exercise; value?: string; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 font-medium text-foreground">
        <span className="sr-only">{label}: </span>
        {ex.prompt}
      </legend>
      {ex.options.map((opt) => (
        <label
          key={opt}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-white p-3 has-[:checked]:border-accent-blue has-[:checked]:bg-blue-50"
        >
          <input type="radio" name={ex.id} value={opt} checked={value === opt} onChange={() => onChange(opt)} className="size-4" />
          {opt}
        </label>
      ))}
    </fieldset>
  );
}

function TryExercise({ slug, ex, index }: { slug: string; ex: Exercise; index: number }) {
  const t = useTranslations("lessons");
  const tc = useTranslations("common");
  const [value, setValue] = useState<string>();
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(false);

  async function check() {
    if (!value) return;
    const api = await browserApi();
    const res = await api?.POST("/api/v1/lessons/{slug}/exercises/{exercise_id}/check", {
      params: { path: { slug, exercise_id: ex.id } },
      body: { answer: value },
    });
    if (!res?.data) return setError(true);
    setResult(res.data);
  }

  return (
    <div className="space-y-3 rounded-xl bg-muted p-4">
      <Choices ex={ex} value={value} onChange={(v) => { setValue(v); setResult(null); }} label={t("question", { n: index + 1 })} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={check} disabled={!value}>{t("checkAnswer")}</Button>
        {ex.hint && !hint && (
          <Button type="button" variant="ghost" onClick={() => setHint(true)}>
            <Lightbulb aria-hidden="true" className="size-4" /> {t("showHint")}
          </Button>
        )}
      </div>
      {hint && ex.hint && <p className="text-sm">{t("hint", { text: ex.hint })}</p>}
      {error && <Alert tone="danger">{tc("errorBody")}</Alert>}
      {result && (
        <Alert tone={result.correct ? "success" : "warning"}>
          <p className="font-semibold">{result.correct ? t("correct") : t("notQuite", { answer: result.correct_answer })}</p>
          <Markdown>{result.explanation}</Markdown>
        </Alert>
      )}
    </div>
  );
}

function CheckSection({ slug, exercises, startedAt }: { slug: string; exercises: Exercise[]; startedAt: React.RefObject<number> }) {
  const t = useTranslations("lessons");
  const tc = useTranslations("common");
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (exercises.some((ex) => !answers[ex.id])) return setError(t("answerAll"));
    setPending(true);
    setError(null);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/lessons/{slug}/check", {
      params: { path: { slug } },
      body: { answers, duration_seconds: Math.round((Date.now() - startedAt.current) / 1000) },
    });
    setPending(false);
    if (!res?.data) return setError(tc("errorBody"));
    setOutcome(res.data);
    router.refresh();
  }

  const resultFor = (id: string) => outcome?.results.find((r) => r.id === id);
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {exercises.map((ex, i) => {
        const r = resultFor(ex.id);
        return (
          <div key={ex.id} className="space-y-2 rounded-xl bg-muted p-4">
            <Choices ex={ex} value={answers[ex.id]} disabled={!!outcome}
              onChange={(v) => setAnswers((a) => ({ ...a, [ex.id]: v }))} label={t("question", { n: i + 1 })} />
            {r && (
              <Alert tone={r.correct ? "success" : "warning"}>
                <p className="font-semibold">{r.correct ? t("correct") : t("notQuite", { answer: r.correct_answer })}</p>
                <Markdown>{r.explanation}</Markdown>
              </Alert>
            )}
          </div>
        );
      })}
      {error && <Alert tone="danger">{error}</Alert>}
      {!outcome && <Button type="submit" disabled={pending}>{t("submitCheck")}</Button>}
      {outcome && (
        <div className="space-y-3" data-testid="check-outcome">
          <Alert tone={outcome.passed ? "success" : "warning"}>
            {outcome.passed
              ? t("passed", { value: Math.round(outcome.score_ratio * 100) })
              : t("failed", { value: Math.round(outcome.score_ratio * 100), pass: Math.round(outcome.pass_ratio * 100) })}
          </Alert>
          <div className="flex flex-wrap gap-2">
            {!outcome.passed && (
              <Button type="button" variant="outline" onClick={() => { setOutcome(null); setAnswers({}); }}>{t("tryAgain")}</Button>
            )}
            <Link href="/lessons" className={buttonVariants({ variant: "outline" })}>{t("backToLessons")}</Link>
            <Link href="/dashboard" className={buttonVariants()}>{t("toDashboard")}</Link>
          </div>
        </div>
      )}
    </form>
  );
}

export function LessonPlayer({ lesson }: { lesson: LessonData }) {
  const t = useTranslations("lessons");
  const [step, setStep] = useState(0);
  const startedAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sections = lesson.sections;
  const section = sections[step];

  useEffect(() => {
    startedAt.current = Date.now();
    void browserApi().then((api) => api?.POST("/api/v1/lessons/{slug}/start", { params: { path: { slug: lesson.slug } } }));
  }, [lesson.slug]);

  function go(to: number) {
    setStep(to);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  if (!section) return null;
  return (
    <div className="space-y-6">
      <nav aria-label={t("title")}>
        <ol className="flex flex-wrap gap-2 text-sm">
          {sections.map((s, i) => (
            <li key={`${s.kind}-${i}`}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                className={`rounded-full px-3 py-1 font-medium ${i === step ? "bg-primary text-white" : "bg-muted text-primary"}`}
              >
                {i + 1}. {t(`steps.${s.kind}` as "steps.learn")}
              </button>
            </li>
          ))}
        </ol>
        <Progress className="mt-3" value={(step + 1) / sections.length} label={t("stepOf", { current: step + 1, total: sections.length })} />
      </nav>

      <section aria-labelledby="section-title" className="space-y-4">
        <p className="text-sm font-medium text-accent-purple">{t("stepOf", { current: step + 1, total: sections.length })}</p>
        <h2 id="section-title" ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-primary">
          {section.title || t(`steps.${section.kind}` as "steps.learn")}
        </h2>
        <Markdown>{section.bodyMd}</Markdown>
        {section.kind === "try" && section.exercises.map((ex, i) => <TryExercise key={ex.id} slug={lesson.slug} ex={ex} index={i} />)}
        {section.kind === "check" && <CheckSection slug={lesson.slug} exercises={section.exercises} startedAt={startedAt} />}
      </section>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => go(step - 1)} disabled={step === 0}>
          <ArrowLeft aria-hidden="true" className="size-4" /> {t("back")}
        </Button>
        {step < sections.length - 1 && (
          <Button type="button" onClick={() => go(step + 1)}>
            {t("next")} <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

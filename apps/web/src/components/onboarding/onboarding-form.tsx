"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { restClient } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { validateOnboarding, type FieldErrors } from "@/lib/validation";

export type LevelOption = { code: number; name: string; cefr: string; description: string };
export type OnboardingInitial = { levelCode: number | null; targetScore: number | null; examDate: string | null; dailyGoalMinutes: number };

const GOALS = [15, 30, 60, 120] as const;

export function OnboardingForm({ levels, initial }: { levels: LevelOption[]; initial: OnboardingInitial }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [levelCode, setLevelCode] = useState<number | null>(initial.levelCode);
  const [targetScore, setTargetScore] = useState(initial.targetScore ? String(initial.targetScore) : "");
  const [examDate, setExamDate] = useState(initial.examDate ?? "");
  const [goal, setGoal] = useState<number>(initial.dailyGoalMinutes);
  const [errors, setErrors] = useState<FieldErrors<"level" | "target" | "examDate">>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function nextStep() {
    const errs = validateOnboarding({ levelCode, targetScore: "50", examDate: "" });
    setErrors(errs);
    if (!errs.level) setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateOnboarding({ levelCode, targetScore, examDate });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    setFormError(null);
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace("/login?next=/onboarding");
      return;
    }
    const { error } = await restClient(publicEnv.apiUrl, token).PUT("/api/v1/me/onboarding", {
      body: {
        level_code: levelCode!,
        target_score: Number(targetScore),
        exam_date: examDate || null,
        daily_goal_minutes: goal as 15 | 30 | 60 | 120,
      },
    });
    setPending(false);
    if (error) {
      setFormError(tc("errorBody"));
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <p className="text-sm font-medium text-accent-purple" aria-live="polite">{t("step", { current: step, total: 2 })}</p>
      {formError && <Alert tone="danger">{formError}</Alert>}

      {step === 1 && (
        <fieldset aria-describedby="level-help level-error">
          <legend className="text-lg font-semibold text-primary">{t("levelQuestion")}</legend>
          <p id="level-help" className="mb-3 text-sm text-muted-foreground">{t("levelHelp")}</p>
          <div className="grid gap-3">
            {levels.map((lv) => (
              <label
                key={lv.code}
                className="flex cursor-pointer gap-3 rounded-xl border border-border p-3 has-[:checked]:border-accent-blue has-[:checked]:bg-blue-50"
              >
                <input
                  type="radio" name="level" value={lv.code} className="mt-1 size-4"
                  checked={levelCode === lv.code} onChange={() => setLevelCode(lv.code)}
                />
                <span>
                  <span className="block font-semibold text-foreground">{lv.code}. {lv.name} <span className="text-sm font-normal text-muted-foreground">(CEFR {lv.cefr})</span></span>
                  <span className="block text-sm text-muted-foreground">{lv.description}</span>
                </span>
              </label>
            ))}
          </div>
          <FieldError id="level-error">{errors.level ? t("errors.level") : undefined}</FieldError>
          <Button type="button" className="mt-4" onClick={nextStep}>{t("next")}</Button>
        </fieldset>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <Label htmlFor="target">{t("targetQuestion")}</Label>
            <p id="target-help" className="mb-2 text-sm text-muted-foreground">{t("targetHelp")}</p>
            <Input
              id="target" inputMode="numeric" type="number" min={10} max={90} value={targetScore}
              onChange={(e) => setTargetScore(e.target.value)} aria-invalid={!!errors.target}
              aria-describedby="target-help target-error" className="max-w-40"
            />
            <FieldError id="target-error">{errors.target ? t("errors.target") : undefined}</FieldError>
          </div>
          <div>
            <Label htmlFor="examDate">{t("examDate")}</Label>
            <Input
              id="examDate" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
              aria-invalid={!!errors.examDate} aria-describedby="exam-error" className="max-w-56"
            />
            <FieldError id="exam-error">{errors.examDate ? t("errors.examDate") : undefined}</FieldError>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("dailyGoal")}</legend>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <label key={g} className="cursor-pointer rounded-xl border border-border px-4 py-2 has-[:checked]:border-accent-blue has-[:checked]:bg-blue-50">
                  <input type="radio" name="goal" value={g} className="mr-2" checked={goal === g} onChange={() => setGoal(g)} />
                  {t("minutes", { count: g })}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>{t("back")}</Button>
            <Button type="submit" disabled={pending}>{pending ? "…" : t("finish")}</Button>
          </div>
        </div>
      )}
    </form>
  );
}

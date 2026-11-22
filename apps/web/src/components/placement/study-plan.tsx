import { useTranslations } from "next-intl";

export type PlanBlock = { kind: "lessons" | "practice" | "review"; minutes: number; level?: number; skill?: string };
export type Plan = { daily_minutes: number; focus_skills: string[]; days_to_exam: number | null; blocks: PlanBlock[] };

/** The daily plan as a short list. Used on the placement result and the dashboard. */
export function StudyPlanList({ plan }: { plan: Plan }) {
  const t = useTranslations("placement");
  return (
    <div className="space-y-2">
      <ul className="list-disc space-y-1 pl-5" data-testid="study-plan">
        {plan.blocks.map((b) => (
          <li key={b.kind}>
            {b.kind === "lessons" && t("planLessons", { minutes: b.minutes, level: b.level ?? 1 })}
            {b.kind === "practice" && t("planPractice", { minutes: b.minutes, skill: t(`skill.${b.skill ?? "reading"}` as "skill.reading") })}
            {b.kind === "review" && t("planReview", { minutes: b.minutes })}
          </li>
        ))}
      </ul>
      {plan.days_to_exam != null && <p className="text-sm text-muted-foreground">{t("daysToExam", { count: plan.days_to_exam })}</p>}
    </div>
  );
}

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { BAND_STYLE } from "@/components/evaluation/evaluation-view";
import { type PlanBlock, type Readiness, type Recommendation, type Weekly, pct, recommendationHref } from "@/lib/coach";

type Names = Record<string, string>;

export function RecommendationList({ recs, names, limit }: { recs: Recommendation[]; names: Names; limit?: number }) {
  const t = useTranslations("coach");
  const shown = limit ? recs.slice(0, limit) : recs;
  if (!shown.length) return <p>{t("empty")}</p>;
  return (
    <ol className="space-y-3" data-testid="recommendations">
      {shown.map((r, i) => {
        const name = r.categoryCode ? names[r.categoryCode] ?? r.categoryCode : null;
        const label = r.kind === "review" ? t("openReview") : r.kind === "mock" ? t("openMock")
          : r.kind === "lesson" ? t("openLesson") : t("start");
        return (
          <li key={`${r.reason}-${r.categoryCode ?? i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
            <div className="min-w-0">
              {name && <p className="font-semibold text-foreground">{name}</p>}
              <p className="text-sm text-muted-foreground">
                {t(`reason.${r.reason}`, {
                  count: r.count ?? 0,
                  accuracy: pct(r.accuracy) ?? 0,
                  difficulty: r.difficulty ? t(`difficulty.${r.difficulty}`) : "",
                })}
              </p>
            </div>
            <Link href={recommendationHref(r)} className={buttonVariants({ variant: "outline", size: "sm" })}
              aria-label={name ? `${label}: ${name}` : label}>
              {label}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function ReadinessCard({ readiness }: { readiness: Readiness }) {
  const t = useTranslations("coach");
  const tb = useTranslations("evaluation.band");
  const ts = useTranslations("skills");
  return (
    <Card data-testid="readiness">
      <CardTitle>{t("readiness")}</CardTitle>
      <CardBody className="space-y-3">
        <p className="font-medium text-foreground">{t(`overall.${readiness.overall}`)}</p>
        <p>{t("typesTried", { tried: readiness.typesTried, total: readiness.typesTotal })}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {readiness.skills.map((s) => (
            <li key={s.skill} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="text-foreground">{ts(s.skill.toUpperCase())}</span>
              {s.band
                ? <Badge className={`border ${BAND_STYLE[s.band]}`}>{tb(s.band)}</Badge>
                : <span>{t("noBand")}</span>}
            </li>
          ))}
        </ul>
        <p className="text-xs">{t("readinessHelp")} {t("note")}</p>
      </CardBody>
    </Card>
  );
}

export function WeeklyCard({ weekly }: { weekly: Weekly }) {
  const t = useTranslations("coach");
  const change = Math.abs(pct(weekly.accuracyChange) ?? 0);
  const week = (w: Weekly["thisWeek"]) => (
    <>
      {t("weeklyStats", { attempts: w.attempts, days: w.activeDays })}
      {w.accuracy != null && ` · ${pct(w.accuracy)}%`}
    </>
  );
  return (
    <Card data-testid="weekly">
      <CardTitle>{t("weekly")}</CardTitle>
      <CardBody className="space-y-2">
        <p className="font-medium text-foreground">{t(`weeklyMessage.${weekly.message}`, { change })}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="font-medium">{t("thisWeek")}</dt><dd>{week(weekly.thisWeek)}</dd>
          <dt className="font-medium">{t("lastWeek")}</dt><dd>{week(weekly.lastWeek)}</dd>
        </dl>
      </CardBody>
    </Card>
  );
}

export function TodayPlanCard({ plan, names }: { plan: PlanBlock[]; names: Names }) {
  const t = useTranslations("coach");
  return (
    <Card data-testid="today-plan">
      <CardTitle>{t("todayPlan")}</CardTitle>
      <CardBody>
        <ul className="list-disc space-y-1 pl-5">
          {plan.map((b, i) => (
            <li key={i}>
              {b.kind === "lessons" && t("planLessons", { minutes: b.minutes })}
              {b.kind === "practice" && (
                <Link href={`/practice/${b.categoryCode}?adaptive=1`} className="text-accent-blue underline">
                  {t("planPractice", { name: names[b.categoryCode] ?? b.categoryCode, difficulty: t(`difficulty.${b.difficulty}`), minutes: b.minutes })}
                </Link>
              )}
              {b.kind === "review" && t("planReview", { minutes: b.minutes })}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

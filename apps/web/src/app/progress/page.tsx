import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { AnalyticsView } from "@/components/progress/analytics-view";
import { ReadinessCard, RecommendationList, TodayPlanCard, WeeklyCard } from "@/components/progress/coach-panel";
import { ReportDownload } from "@/components/progress/report-download";
import { ProgressQuery } from "@/graphql/queries";
import type { Analytics, PlanBlock, Readiness, Recommendation, Weekly } from "@/lib/coach";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "My progress" };
export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90] as const;

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { accessToken } = await requireSession("/progress");
  const raw = Number((await searchParams).days);
  const days = (PERIODS as readonly number[]).includes(raw) ? raw : 30;
  const data = await serverQuery(accessToken, ProgressQuery, { days });
  const t = await getTranslations("analytics");
  const tc = await getTranslations("coach");
  const tcommon = await getTranslations("common");
  const names = Object.fromEntries(data.practiceTypes.map((c) => [c.code, c.name]));
  const coach = data.viewer.coach;
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      {data.viewer.demoMode && <Alert tone="warning">{tcommon("demoMode")}</Alert>}
      <div>
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <Card>
        <CardTitle>{tc("title")}</CardTitle>
        <CardBody className="space-y-2">
          <p>{tc("note")}</p>
          <RecommendationList recs={coach.recommendations as Recommendation[]} names={names} />
        </CardBody>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <ReadinessCard readiness={coach.readiness as Readiness} />
        <WeeklyCard weekly={coach.weekly as Weekly} />
      </div>
      <TodayPlanCard plan={coach.todayPlan as PlanBlock[]} names={names} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("period")} className="flex gap-2 text-sm">
          {PERIODS.map((p) => (
            <Link key={p} href={`/progress?days=${p}`} aria-current={p === days ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${p === days ? "border-primary bg-primary text-primary-foreground" : "border-border text-accent-blue underline"}`}>
              {t("days", { count: p })}
            </Link>
          ))}
        </nav>
        <ReportDownload days={days} />
      </div>
      <AnalyticsView data={data.viewer.analytics as Analytics} />
    </div>
  );
}

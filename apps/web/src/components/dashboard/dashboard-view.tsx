import { BookOpen, CalendarCheck, Flame, GraduationCap, History, Target, TriangleAlert, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DashboardQuery } from "@/graphql/generated/graphql";

export type DashboardData = DashboardQuery["viewer"];

/** Pure view: every value comes from the GraphQL response. Empty states for new users; no fake numbers. */
export function DashboardView({ data, notice }: { data: DashboardData; notice?: string }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const ts = useTranslations("skills");
  const p = data.profile;
  const goal = p?.dailyGoalMinutes ?? 30;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {data.demoMode && <Alert tone="warning" data-testid="demo-banner">{tc("demoMode")}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            {p?.displayName ? t("welcome", { name: p.displayName }) : t("welcomeNoName")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("readinessNote")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle><GraduationCap aria-hidden="true" className="size-5 text-accent-blue" />{t("level")}</CardTitle>
          <CardBody>
            <p className="text-lg font-semibold text-foreground" data-testid="level-name">{p?.level?.name ?? "—"}</p>
            {p?.level && <Badge>CEFR {p.level.cefr}</Badge>}
          </CardBody>
        </Card>
        <Card>
          <CardTitle><Target aria-hidden="true" className="size-5 text-accent-purple" />{t("target")}</CardTitle>
          <CardBody>
            <p className="text-lg font-semibold text-foreground" data-testid="target-score">{p?.targetScore ?? t("noTarget")}</p>
          </CardBody>
        </Card>
        <Card>
          <CardTitle><Flame aria-hidden="true" className="size-5 text-warning" />{t("streak")}</CardTitle>
          <CardBody>
            <p className="text-lg font-semibold text-foreground" data-testid="streak">{t("streakValue", { count: data.streakDays })}</p>
          </CardBody>
        </Card>
        <Card>
          <CardTitle><CalendarCheck aria-hidden="true" className="size-5 text-success" />{t("dailyGoal")}</CardTitle>
          <CardBody>
            <p className="mb-2 font-semibold text-foreground">{t("dailyGoalValue", { done: data.todayMinutes, goal })}</p>
            <Progress value={data.todayMinutes / goal} label={t("dailyGoal")} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle><Trophy aria-hidden="true" className="size-5 text-accent-blue" />{t("skills")}</CardTitle>
          <CardBody className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>{t("overall")}</span>
                <span data-testid="lessons-progress">{data.progress.lessonsCompleted} / {data.progress.lessonsTotal}</span>
              </div>
              <Progress value={data.progress.overallRatio} label={t("overall")} />
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.progress.skills.map((s) => (
                <li key={s.skill} className="rounded-xl bg-muted p-3">
                  <p className="font-medium text-foreground">{ts(s.skill)}</p>
                  {s.attempts === 0 ? (
                    <p className="text-sm">{t("noAttemptsSkill")}</p>
                  ) : (
                    <>
                      <p className="text-sm">
                        {s.accuracy == null ? t("attemptsCount", { count: s.attempts }) : t("accuracy", { value: Math.round(s.accuracy * 100) })}
                        {" · "}{t("attemptsCount", { count: s.attempts })}
                      </p>
                      {s.accuracy != null && <Progress className="mt-2" value={s.accuracy} label={ts(s.skill)} />}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardTitle><TriangleAlert aria-hidden="true" className="size-5 text-warning" />{t("weak")}</CardTitle>
          <CardBody>
            {data.weakAreas.length === 0 ? (
              <p>{t("weakEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {data.weakAreas.map((w) => (
                  <li key={w.category?.code} className="flex justify-between gap-2">
                    <span>{w.category?.name}</span>
                    <span>{t("accuracy", { value: Math.round(w.accuracy * 100) })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle><BookOpen aria-hidden="true" className="size-5 text-accent-purple" />{t("recommended")}</CardTitle>
          <CardBody>
            {data.recommendedLessons.length === 0 ? (
              <p>{t("recommendedEmpty")}</p>
            ) : (
              <ul className="space-y-3" data-testid="recommended-lessons">
                {data.recommendedLessons.map((l) => (
                  <li key={l.id} className="rounded-xl border border-border p-3">
                    <p className="font-semibold text-foreground">{l.title}</p>
                    <p>{l.summary}</p>
                    <p className="mt-1 text-xs">
                      {t("minutesShort", { count: l.estimatedMinutes })} · CEFR {l.level?.cefr}
                    </p>
                  </li>
                ))}
                <li className="text-xs">{t("lessonsSoon")}</li>
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardTitle><History aria-hidden="true" className="size-5 text-accent-blue" />{t("recent")}</CardTitle>
          <CardBody>
            {data.recentAttempts.length === 0 ? (
              <p data-testid="recent-empty">{t("recentEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {data.recentAttempts.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>{a.category?.name ?? "Lesson"}</span>
                    <span>{a.isCorrect == null ? t("unmarked") : a.isCorrect ? t("correct") : t("incorrect")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardTitle><Trophy aria-hidden="true" className="size-5 text-accent-purple" />{t("mocks")}</CardTitle>
        <CardBody>
          {data.mockExams.length === 0 ? (
            <p>{t("mocksEmpty")}</p>
          ) : (
            <ul className="space-y-1">
              {data.mockExams.map((m) => (
                <li key={m.id}>{m.kind} · {m.status} · {new Date(m.startedAt).toLocaleDateString()}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs">{tc("practiceEstimate")}</p>
        </CardBody>
      </Card>
    </div>
  );
}

import { Lock } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LessonStatusBadge } from "@/components/lessons/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { LessonsQuery as LessonsData } from "@/graphql/generated/graphql";
import { LessonsQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Lessons" };
export const dynamic = "force-dynamic";

type LessonRow = LessonsData["lessons"][number];

async function LessonList({ lessons, locked }: { lessons: LessonRow[]; locked: boolean }) {
  const t = await getTranslations("lessons");
  return (
    <ol className="mt-3 space-y-3">
      {lessons.map((l, i) => {
        const action = l.progress?.status === "completed" ? t("review") : l.progress ? t("continue") : t("start");
        return (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
            <div>
              <p className="font-semibold text-foreground">{i + 1}. {l.title}</p>
              <p className="text-sm text-muted-foreground">{l.summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <LessonStatusBadge status={l.progress?.status} />
                <span>{t("minutes", { count: l.estimatedMinutes })}</span>
                {l.progress?.bestScore != null && <span>{t("bestScore", { value: Math.round(l.progress.bestScore * 100) })}</span>}
              </div>
            </div>
            {!locked && (
              <Link href={`/lessons/${l.slug}`} className={buttonVariants({ variant: l.progress ? "outline" : "primary", size: "sm" })}
                aria-label={`${action}: ${l.title}`}>
                {action}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default async function LessonsPage() {
  const { accessToken } = await requireSession("/lessons");
  const data = await serverQuery(accessToken, LessonsQuery);
  const t = await getTranslations("lessons");
  const tu = await getTranslations("units");
  const tn = await getTranslations("nav");
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intro")}</p>
        <p className="mt-2 text-sm">
          {t("tracks")}
          <Link href="/vocabulary" className="font-medium text-accent-blue underline">{tn("vocabulary")}</Link>
          {" · "}
          <Link href="/pronunciation" className="font-medium text-accent-blue underline">{tn("pronunciation")}</Link>
        </p>
      </div>
      {data.learningLevels.map((lv) => {
        const units = data.units.filter((u) => u.level?.code === lv.code);
        const loose = data.lessons.filter((l) => l.level?.code === lv.code && !l.unitSlug);
        return (
          <section key={lv.code} aria-labelledby={`level-${lv.code}`} className="space-y-4">
            <h2 id={`level-${lv.code}`} className="text-xl font-semibold text-primary">
              {t("levelHeading", { code: lv.code, name: lv.name })}{" "}
              <span className="text-sm font-normal text-muted-foreground">({t("cefr", { cefr: lv.cefr })})</span>
            </h2>
            {units.length === 0 && loose.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
            {units.map((u) => (
              <div key={u.slug} className="rounded-2xl bg-muted p-4" data-testid={`unit-${u.slug}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{u.title}</h3>
                  <span className="flex flex-wrap items-center gap-2">
                    {u.locked && <Badge><Lock aria-hidden="true" className="mr-1 size-3" />{tu("locked")}</Badge>}
                    {u.progress?.passed && <Badge className="bg-green-100 text-success">{tu("passed")}</Badge>}
                    {u.progress && <span className="text-xs text-muted-foreground">{tu("best", { value: Math.round(u.progress.bestScore * 100) })}</span>}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{u.locked ? tu("lockedHelp") : u.summary}</p>
                <LessonList lessons={data.lessons.filter((l) => l.unitSlug === u.slug)} locked={u.locked} />
                {!u.locked && (
                  <Link href={`/units/${u.slug}/test`} className={buttonVariants({ variant: "outline", size: "sm" }) + " mt-3"}>
                    {u.progress ? tu("retakeTest") : tu("takeTest")}
                  </Link>
                )}
              </div>
            ))}
            {loose.length > 0 && (
              <div>
                {units.length > 0 && <h3 className="text-lg font-semibold text-foreground">{tu("otherLessons")}</h3>}
                <LessonList lessons={loose} locked={false} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LessonStatusBadge } from "@/components/lessons/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { LessonsQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Lessons" };
export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const { accessToken } = await requireSession("/lessons");
  const data = await serverQuery(accessToken, LessonsQuery);
  const t = await getTranslations("lessons");
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intro")}</p>
      </div>
      {data.learningLevels.map((lv) => {
        const lessons = data.lessons.filter((l) => l.level?.code === lv.code);
        return (
          <section key={lv.code} aria-labelledby={`level-${lv.code}`}>
            <h2 id={`level-${lv.code}`} className="text-xl font-semibold text-primary">
              {t("levelHeading", { code: lv.code, name: lv.name })}{" "}
              <span className="text-sm font-normal text-muted-foreground">({t("cefr", { cefr: lv.cefr })})</span>
            </h2>
            {lessons.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {lessons.map((l, i) => (
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
                    <Link href={`/lessons/${l.slug}`} className={buttonVariants({ variant: l.progress ? "outline" : "primary", size: "sm" })}
                      aria-label={`${l.progress?.status === "completed" ? t("review") : l.progress ? t("continue") : t("start")}: ${l.title}`}>
                      {l.progress?.status === "completed" ? t("review") : l.progress ? t("continue") : t("start")}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { VocabularyHubQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Vocabulary" };
export const dynamic = "force-dynamic";

export default async function VocabularyPage() {
  const { accessToken } = await requireSession("/vocabulary");
  const data = await serverQuery(accessToken, VocabularyHubQuery);
  const t = await getTranslations("vocabulary");
  const levels = data.learningLevels.filter((l) => data.vocabularySets.some((s) => s.levelCode === l.code));
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
        <p data-testid="vocab-due">{t("dueCount", { count: data.viewer.vocabularyDueCount })}</p>
        {data.viewer.vocabularyDueCount > 0 && <Link href="/vocabulary/review" className={buttonVariants()}>{t("reviewNow")}</Link>}
      </div>
      {levels.map((lv) => (
        <section key={lv.code} aria-labelledby={`lv-${lv.code}`} className="space-y-3">
          <h2 id={`lv-${lv.code}`} className="text-xl font-semibold text-primary">{t("levelHeading", { code: lv.code, name: lv.name, cefr: lv.cefr })}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.vocabularySets.filter((s) => s.levelCode === lv.code).map((s) => (
              <li key={s.slug} className="space-y-2 rounded-xl border border-border bg-white p-4">
                <Link href={`/vocabulary/${s.slug}`} className="font-semibold text-accent-blue underline-offset-4 hover:underline">{s.title}</Link>
                <p className="text-sm text-muted-foreground">{t("setProgress", { seen: s.seenCount, total: s.wordCount, mastered: s.masteredCount })}</p>
                <Progress value={s.wordCount ? s.seenCount / s.wordCount : 0} label={s.title} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">{t("source")}</p>
    </div>
  );
}

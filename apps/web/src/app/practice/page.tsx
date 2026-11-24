import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { PracticeHubQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Practice" };
export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const { accessToken } = await requireSession("/practice");
  const data = await serverQuery(accessToken, PracticeHubQuery);
  const t = await getTranslations("practice");
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intro")}</p>
      </div>
      {([["speaking-writing", t("speakingHeading"), data.speakingWriting], ["reading", t("readingHeading"), data.reading],
        ["listening", t("listeningHeading"), data.listening]] as const).map(
        ([key, heading, types]) => (
      <section key={key} aria-labelledby={`${key}-heading`}>
        <h2 id={`${key}-heading`} className="text-xl font-semibold text-primary">{heading}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {types.map((pt) => (
            <li key={pt.category.code} className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-white p-4">
              <div>
                <p className="font-semibold text-foreground">{pt.category.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t("questions", { count: pt.questionCount })} · {t("attempts", { count: pt.attempts })}
                </p>
                {pt.averageScore != null && (
                  <p className="text-sm text-muted-foreground">{t("average", { value: Math.round(pt.averageScore * 100) })}</p>
                )}
              </div>
              {pt.autoMarked && pt.questionCount > 0 ? (
                <Link href={`/practice/${pt.category.code}`} aria-label={t("openLabel", { name: pt.category.name })}
                  className={buttonVariants({ size: "sm" }) + " self-start"}>
                  {t("open")}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">{t("notAutoMarked")}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
        ),
      )}
      <p className="rounded-xl bg-muted p-4 text-sm">{t("aiNote")} <Link href="/academy" className="font-medium text-accent-blue underline">{t("academyLink")}</Link></p>
    </div>
  );
}

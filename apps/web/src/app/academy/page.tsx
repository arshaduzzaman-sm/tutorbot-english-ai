import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AcademyHubQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Question-Type Academy" };
export const dynamic = "force-dynamic";

export default async function AcademyPage() {
  const { accessToken } = await requireSession("/academy");
  const data = await serverQuery(accessToken, AcademyHubQuery);
  const t = await getTranslations("academy");
  const groups = [
    ["speaking-writing", t("speakingWriting"), data.speakingWriting],
    ["reading", t("reading"), data.reading],
    ["listening", t("listening"), data.listening],
  ] as const;
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intro")}</p>
      </div>
      {groups.map(([key, heading, types]) => (
        <section key={key} aria-labelledby={`${key}-h`}>
          <h2 id={`${key}-h`} className="text-xl font-semibold text-primary">{heading}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {types.map((pt) => (
              <li key={pt.category.code}>
                <Link href={`/academy/${pt.category.code}`}
                  className="block rounded-xl border border-border bg-white p-4 hover:border-accent-blue focus-visible:outline-2 focus-visible:outline-accent-blue">
                  <span className="block font-semibold">{pt.category.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {t("questions", { count: pt.questionCount })} · {t("attempts", { count: pt.attempts })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

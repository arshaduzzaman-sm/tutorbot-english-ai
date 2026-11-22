import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PronunciationHubQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Pronunciation" };
export const dynamic = "force-dynamic";

const KINDS = ["vowel", "diphthong", "consonant", "stress", "linking", "intonation"] as const;

export default async function PronunciationPage() {
  const { accessToken } = await requireSession("/pronunciation");
  const { pronunciationTopics } = await serverQuery(accessToken, PronunciationHubQuery);
  const t = await getTranslations("pronunciation");
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      {KINDS.map((kind) => {
        const topics = pronunciationTopics.filter((p) => p.kind === kind);
        if (topics.length === 0) return null;
        return (
          <section key={kind} aria-labelledby={`k-${kind}`} className="space-y-3">
            <h2 id={`k-${kind}`} className="text-xl font-semibold text-primary">{t(`kinds.${kind}`)}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {topics.map((p) => (
                <li key={p.slug} className="rounded-xl border border-border bg-white p-4">
                  <Link href={`/pronunciation/${p.slug}`} className="font-semibold text-accent-blue underline-offset-4 hover:underline">{p.title}</Link>
                  {p.symbols.length > 0 && <p className="font-mono text-sm">/{p.symbols.join("/ /")}/</p>}
                  <p className="text-sm text-muted-foreground">
                    {p.bestScore == null ? t("notTried") : t("best", { value: Math.round(p.bestScore * 100) })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">{t("accent")}</p>
    </div>
  );
}

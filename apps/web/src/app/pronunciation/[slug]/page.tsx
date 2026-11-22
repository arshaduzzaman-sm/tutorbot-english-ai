import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PronunciationDrill } from "@/components/pronunciation/drill";
import { SpeakButton } from "@/components/vocabulary/speak-button";
import { PronunciationTopicQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PronunciationTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { accessToken } = await requireSession(`/pronunciation/${slug}`);
  const { pronunciationTopic: topic } = await serverQuery(accessToken, PronunciationTopicQuery, { slug });
  if (!topic) notFound();
  const t = await getTranslations("pronunciation");
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link href="/pronunciation" className="text-sm font-medium text-accent-blue underline">{t("backToTopics")}</Link>
      <h1 className="text-3xl font-bold text-primary">{topic.title}</h1>
      {topic.symbols.length > 0 && <p className="font-mono">{t("symbols", { symbols: topic.symbols.map((s) => `/${s}/`).join(" ") })}</p>}
      <section aria-labelledby="how" className="space-y-2">
        <h2 id="how" className="text-xl font-semibold text-primary">{t("howTo")}</h2>
        <p>{topic.tip}</p>
      </section>
      <section aria-labelledby="ex" className="space-y-2">
        <h2 id="ex" className="text-xl font-semibold text-primary">{t("examples")}</h2>
        <ul className="flex flex-wrap gap-2">
          {topic.examples.map((e) => <li key={e} className="rounded-lg bg-muted px-3 py-1">{e}</li>)}
        </ul>
        <SpeakButton text={topic.examples.join(". ")} label={t("listenExamples")} />
      </section>
      <section aria-labelledby="drill" className="space-y-3">
        <h2 id="drill" className="text-xl font-semibold text-primary">{t("drill")}</h2>
        <PronunciationDrill slug={topic.slug} items={topic.drill} />
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Flashcards } from "@/components/vocabulary/flashcards";
import { VocabularySetQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function VocabularySetPage({ params }: { params: Promise<{ set: string }> }) {
  const { set } = await params;
  const { accessToken } = await requireSession(`/vocabulary/${set}`);
  const { vocabularySet } = await serverQuery(accessToken, VocabularySetQuery, { slug: set });
  if (!vocabularySet) notFound();
  const t = await getTranslations("vocabulary");
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link href="/vocabulary" className="text-sm font-medium text-accent-blue underline">{t("backToSets")}</Link>
      <h1 className="text-3xl font-bold text-primary">{vocabularySet.title}</h1>
      <p className="text-muted-foreground">{t("setProgress", { seen: vocabularySet.seenCount, total: vocabularySet.wordCount, mastered: vocabularySet.masteredCount })}</p>
      <Flashcards words={vocabularySet.words} />
    </div>
  );
}

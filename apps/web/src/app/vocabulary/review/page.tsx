import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Flashcards } from "@/components/vocabulary/flashcards";
import { VocabularyReviewQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Review words" };
export const dynamic = "force-dynamic";

export default async function VocabularyReviewPage() {
  const { accessToken } = await requireSession("/vocabulary/review");
  const { viewer } = await serverQuery(accessToken, VocabularyReviewQuery);
  const t = await getTranslations("vocabulary");
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link href="/vocabulary" className="text-sm font-medium text-accent-blue underline">{t("backToSets")}</Link>
      <h1 className="text-3xl font-bold text-primary">{t("reviewTitle")}</h1>
      {viewer.vocabularyDue.length === 0 ? <p>{t("reviewEmpty")}</p> : <Flashcards words={viewer.vocabularyDue} />}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PracticePlayer } from "@/components/practice/practice-player";
import { PracticeQuestionsQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PracticeTypePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const { accessToken } = await requireSession(`/practice/${category}`);
  const { practiceQuestions } = await serverQuery(accessToken, PracticeQuestionsQuery, { code: category });
  const first = practiceQuestions[0];
  if (!first?.category) notFound();
  const t = await getTranslations("practice");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link href="/practice" className="text-sm font-medium text-accent-blue underline">{t("backToPractice")}</Link>
      <h1 className="text-3xl font-bold text-primary">{first.category.name}</h1>
      <PracticePlayer questions={practiceQuestions} />
    </div>
  );
}

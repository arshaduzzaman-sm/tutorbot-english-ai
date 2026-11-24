import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DrillRunner } from "@/components/practice/drill-runner";
import { PracticeQuestionsQuery, RecordingConsentQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DrillPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const { accessToken } = await requireSession(`/practice/${category}/drill`);
  const { practiceQuestions } = await serverQuery(accessToken, PracticeQuestionsQuery, { code: category });
  const first = practiceQuestions[0];
  if (!first?.category) notFound();
  const consent = (await serverQuery(accessToken, RecordingConsentQuery)).viewer.recordingConsent;
  const t = await getTranslations("drill");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link href={`/practice/${category}`} className="text-sm font-medium text-accent-blue underline">{t("back")}</Link>
      <h1 className="text-3xl font-bold text-primary">{t("title", { name: first.category.name })}</h1>
      <DrillRunner questions={practiceQuestions} consent={consent} />
    </div>
  );
}

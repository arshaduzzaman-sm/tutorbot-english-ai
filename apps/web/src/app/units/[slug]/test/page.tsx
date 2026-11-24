import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UnitTestForm } from "@/components/lessons/unit-test";
import { Alert } from "@/components/ui/alert";
import { UnitTestQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function UnitTestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { accessToken } = await requireSession(`/units/${slug}/test`);
  const { unit } = await serverQuery(accessToken, UnitTestQuery, { slug });
  if (!unit) notFound();
  const t = await getTranslations("units");
  const tl = await getTranslations("lessons");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link href="/lessons" className="text-sm font-medium text-accent-blue underline">{tl("backToLessons")}</Link>
      <h1 className="text-3xl font-bold text-primary">{t("testTitle", { title: unit.title })}</h1>
      {unit.locked ? (
        <Alert tone="warning">{t("lockedHelp")}</Alert>
      ) : (
        <>
          <p>{t("testIntro", { pass: 80 })}</p>
          <UnitTestForm slug={unit.slug} items={unit.testItems} />
        </>
      )}
    </div>
  );
}

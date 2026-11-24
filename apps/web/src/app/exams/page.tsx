import { getTranslations } from "next-intl/server";
import { ExamsHub } from "@/components/exam/exams-hub";
import { ExamsHubQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Mock exams" };
export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  const { accessToken } = await requireSession("/exams");
  const data = await serverQuery(accessToken, ExamsHubQuery);
  const t = await getTranslations("exam");
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intro")}</p>
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm">{t("unverifiedNote")}</p>
      </div>
      <ExamsHub blueprints={data.blueprints} history={data.viewer.mockExams} consent={data.viewer.recordingConsent} />
    </div>
  );
}

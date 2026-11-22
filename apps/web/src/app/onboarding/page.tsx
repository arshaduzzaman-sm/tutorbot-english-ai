import { getTranslations } from "next-intl/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { OnboardingQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Your goals" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { accessToken } = await requireSession("/onboarding");
  const data = await serverQuery(accessToken, OnboardingQuery);
  const t = await getTranslations("onboarding");
  const p = data.viewer.profile;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-primary">{t("title")}</h1>
      <OnboardingForm
        levels={data.learningLevels}
        initial={{
          levelCode: p?.level?.code ?? null,
          targetScore: p?.targetScore ?? null,
          examDate: p?.examDate ?? null,
          dailyGoalMinutes: p?.dailyGoalMinutes ?? 30,
        }}
      />
    </div>
  );
}

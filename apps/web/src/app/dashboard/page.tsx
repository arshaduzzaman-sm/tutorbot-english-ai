import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { accessToken } = await requireSession("/dashboard");
  const data = await serverQuery(accessToken, DashboardQuery);
  if (!data.viewer.profile?.onboardingCompleted) redirect("/onboarding");
  const t = await getTranslations("auth");
  const { notice } = await searchParams;
  return <DashboardView data={{ ...data.viewer, typeNames: Object.fromEntries(data.practiceTypes.map((c) => [c.code, c.name])) }} notice={notice === "password-changed" ? t("resetDone") : undefined} />;
}

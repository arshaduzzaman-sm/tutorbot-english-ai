import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DataActions } from "@/components/profile/data-actions";
import { RecordingConsentToggle } from "@/components/profile/recording-consent-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { ProfileQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { accessToken } = await requireSession("/profile");
  const { viewer } = await serverQuery(accessToken, ProfileQuery);
  const t = await getTranslations("profile");
  const td = await getTranslations("dashboard");
  const p = viewer.profile;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
      <Card>
        <CardTitle>{t("account")}</CardTitle>
        <CardBody>
          <p className="text-foreground">{p?.displayName}</p>
          <p>{viewer.email}</p>
          {viewer.roles.some((r) => r === "admin" || r === "content_editor") && (
            <Link href="/admin" className="mt-2 inline-block font-medium text-accent-blue underline">{t("adminLink")}</Link>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardTitle>{t("goals")}</CardTitle>
        <CardBody className="space-y-1">
          <p>{td("level")}: {p?.level ? `${p.level.name} (CEFR ${p.level.cefr})` : "—"}</p>
          <p>{td("target")}: {p?.targetScore ?? td("noTarget")}</p>
          <p>{td("dailyGoal")}: {p?.dailyGoalMinutes} min</p>
          <Link href="/onboarding" className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-3`}>{t("editGoals")}</Link>
        </CardBody>
      </Card>
      <Card>
        <CardTitle>{t("recordingTitle")}</CardTitle>
        <CardBody>
          <p className="mb-3">{t("recordingBody")}</p>
          <RecordingConsentToggle initial={viewer.recordingConsent} />
        </CardBody>
      </Card>
      <Card>
        <CardTitle>{t("dataTitle")}</CardTitle>
        <CardBody>
          <p className="mb-4">{t("dataBody")}</p>
          <DataActions />
        </CardBody>
      </Card>
    </div>
  );
}

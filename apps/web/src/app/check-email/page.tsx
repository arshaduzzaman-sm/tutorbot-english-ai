import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Check your email" };

export default async function CheckEmailPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("checkEmailTitle")}>
      <MailCheck aria-hidden="true" className="mb-4 size-10 text-accent-blue" />
      <p>{t("checkEmailBody")}</p>
      <Alert tone="info" className="mt-4">{t("checkEmailLocal")}</Alert>
    </AuthCard>
  );
}

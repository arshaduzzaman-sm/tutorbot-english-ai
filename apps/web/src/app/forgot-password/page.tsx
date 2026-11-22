import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata = { title: "Reset password" };

export default async function ForgotPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("forgotTitle")}>
      <ForgotForm />
    </AuthCard>
  );
}

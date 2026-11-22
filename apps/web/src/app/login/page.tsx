import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const t = await getTranslations("auth");
  const tp = await getTranslations("profile");
  const sp = await searchParams;
  const notice =
    sp.notice === "deleted" ? tp("deleted") : sp.error === "link" ? t("errors.linkExpired") : undefined;
  return (
    <AuthCard title={t("loginTitle")}>
      <LoginForm next={sp.next} notice={notice} />
    </AuthCard>
  );
}

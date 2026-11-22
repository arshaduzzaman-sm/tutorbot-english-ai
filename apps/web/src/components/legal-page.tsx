import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";

export async function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const t = await getTranslations("legal");
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-12 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary [&_li]:ml-5 [&_li]:list-disc">
      <h1 className="text-3xl font-bold text-primary">{title}</h1>
      <Alert tone="warning">{t("reviewNote")}</Alert>
      {children}
    </article>
  );
}

import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "About" };

export default async function AboutPage() {
  const t = await getTranslations("legal");
  const f = await getTranslations("footer");
  return (
    <LegalPage title={t("aboutTitle")}>
      <p>
        PTE Master AI is a free, open-source app that helps people learn English from zero and prepare for the PTE
        Academic test. It runs entirely on your own computer.
      </p>
      <p>
        We never guarantee any exam score. Every estimate is a practice estimate, not an official PTE score. Your results
        depend on your study and practice.
      </p>
      <p>All practice questions are original. We do not copy questions from Pearson or any other publisher.</p>
      <p className="font-medium">{f("disclaimer")}</p>
    </LegalPage>
  );
}

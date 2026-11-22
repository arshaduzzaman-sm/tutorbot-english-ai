import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms" };

export default async function TermsPage() {
  const t = await getTranslations("legal");
  const f = await getTranslations("footer");
  return (
    <LegalPage title={t("termsTitle")}>
      <ul>
        <li>You must be 16 years old or older to create an account.</li>
        <li>The app is free. It is provided &quot;as is&quot;, without warranty (see the MIT licence).</li>
        <li>We do not guarantee any exam result. Scores shown are practice estimates, not official PTE scores.</li>
        <li>Use the app for learning. Do not upload content you do not have the right to share.</li>
      </ul>
      <p className="font-medium">{f("disclaimer")}</p>
    </LegalPage>
  );
}

import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  return (
    <LegalPage title={t("privacyTitle")}>
      <h2>Where your data is stored</h2>
      <p>
        Everything (your account, progress, answers and any recordings) is stored only in the database on the computer
        where this app runs. Nothing is sent to a cloud service, and there are no third-party trackers.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>Your email, name, level, target score and optional exam date.</li>
        <li>Your practice attempts and lesson progress.</li>
        <li>Recordings (from a later version), only after you give consent.</li>
      </ul>
      <h2>Recordings</h2>
      <p>
        Recordings are kept in private storage and are deleted automatically after 90 days (the owner of the computer can
        change this). You can delete any recording at any time.
      </p>
      <h2>Your rights</h2>
      <ul>
        <li>Download all your data as a JSON file from your profile page.</li>
        <li>Delete your account and all its data from your profile page.</li>
      </ul>
      <h2>Cookies</h2>
      <p>We only use essential cookies to keep you logged in. Optional cookies are off by default.</p>
    </LegalPage>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  return (
    <footer className="mt-16 border-t border-border bg-muted">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-8 text-sm text-muted-foreground">
        <nav aria-label="Footer" className="flex flex-wrap gap-4 font-medium text-primary">
          <Link href="/about" className="underline-offset-4 hover:underline">{tn("about")}</Link>
          <Link href="/privacy" className="underline-offset-4 hover:underline">{tn("privacy")}</Link>
          <Link href="/terms" className="underline-offset-4 hover:underline">{tn("terms")}</Link>
        </nav>
        <p data-testid="pearson-disclaimer">{t("disclaimer")}</p>
        <p>{t("local")}</p>
        <p>{t("license")}</p>
      </div>
    </footer>
  );
}

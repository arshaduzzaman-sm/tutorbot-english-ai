import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { CookieBanner } from "@/components/cookie-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PTE Master AI", template: "%s | PTE Master AI" },
  description: "Free practice and AI feedback to help you improve your English and prepare for PTE Academic.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f2147" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <html lang={locale} dir="ltr">
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            {t("skipToContent")}
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

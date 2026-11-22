"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const COOKIE = "tutorbot_cookie_notice";

/** Only essential cookies are used; optional cookies stay off unless a future setting turns them on. */
export function CookieBanner() {
  const t = useTranslations("cookies");
  const [show, setShow] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser-only cookie after mount
    setShow(!document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`)));
  }, []);

  if (!show) return null;
  return (
    <section
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm">
        <p>{t("text")}</p>
        <Button
          size="sm"
          onClick={() => {
            document.cookie = `${COOKIE}=essential-only; path=/; max-age=31536000; samesite=lax`;
            setShow(false);
          }}
        >
          {t("accept")}
        </Button>
      </div>
    </section>
  );
}

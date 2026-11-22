"use client";

import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Alert tone="danger">
        <p className="font-semibold">{t("errorTitle")}</p>
        <p>{t("errorBody")}</p>
      </Alert>
      <Button className="mt-4" onClick={reset}>
        {t("tryAgain")}
      </Button>
    </div>
  );
}

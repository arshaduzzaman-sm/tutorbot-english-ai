"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/** Downloads the CSV progress report (the API needs the access token, so a plain link cannot be used). */
export function ReportDownload({ days }: { days: number }) {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const [error, setError] = useState(false);
  async function download() {
    setError(false);
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    const res = token
      ? await fetch(`${publicEnv.apiUrl}/api/v1/me/progress-report.csv?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      : null;
    if (!res?.ok) return setError(true);
    const url = URL.createObjectURL(await res.blob());
    Object.assign(document.createElement("a"), { href: url, download: "tutorbot-progress.csv" }).click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => void download()}>
        <Download aria-hidden="true" className="size-4" /> {t("download")}
      </Button>
      {error && <Alert tone="danger">{tc("errorBody")}</Alert>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { adminCall } from "@/lib/admin-client";

export function ReportActions({ id }: { id: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(status: "resolved" | "dismissed") {
    setBusy(true);
    await adminCall(`/reports/${id}`, "POST", { status }).catch(() => undefined);
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={busy} onClick={() => void act("resolved")}>{t("reports.resolve")}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("dismissed")}>{t("reports.dismiss")}</Button>
    </div>
  );
}

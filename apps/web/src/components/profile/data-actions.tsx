"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { restClient } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

async function token() {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export function DataActions() {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function exportData() {
    const tk = await token();
    if (!tk) return router.replace("/login?next=/profile");
    const { data, error: err } = await restClient(publicEnv.apiUrl, tk).GET("/api/v1/me/export");
    if (err || !data) return setError(tc("errorBody"));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "tutorbot-english-ai-my-data.json" });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== "DELETE") return;
    setPending(true);
    const tk = await token();
    if (!tk) return router.replace("/login?next=/profile");
    const { error: err } = await restClient(publicEnv.apiUrl, tk).DELETE("/api/v1/me", { body: { confirm: "DELETE" } });
    setPending(false);
    if (err) return setError(tc("errorBody"));
    await createClient().auth.signOut();
    router.replace("/login?notice=deleted");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}
      <Button variant="outline" onClick={exportData}>
        <Download aria-hidden="true" className="size-4" /> {t("export")}
      </Button>
      <form onSubmit={deleteAccount} className="space-y-3 rounded-xl border border-danger/30 p-4">
        <h3 className="font-semibold text-danger">{t("deleteTitle")}</h3>
        <p className="text-sm">{t("deleteBody")}</p>
        <div>
          <Label htmlFor="confirm-delete">{t("deleteConfirmLabel")}</Label>
          <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="max-w-48" autoComplete="off" />
        </div>
        <Button type="submit" variant="danger" disabled={confirm !== "DELETE" || pending}>
          <Trash2 aria-hidden="true" className="size-4" /> {t("deleteButton")}
        </Button>
      </form>
    </div>
  );
}

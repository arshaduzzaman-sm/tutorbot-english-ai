"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminError } from "@/lib/admin";
import { adminCall } from "@/lib/admin-client";

export function BlueprintToggle({ code, status, name }: { code: string; status: string; name: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const next = status === "published" ? "draft" : "published";
  async function act() {
    setError(null);
    try {
      await adminCall(`/blueprints/${code}`, "PATCH", { status: next });
      router.refresh();
    } catch (e) {
      setError(e instanceof AdminError ? e.message : t("editor.error"));
    }
  }
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" onClick={() => void act()} aria-label={`${t(next === "published" ? "blueprints.publish" : "blueprints.hide")}: ${name}`}>
        {t(next === "published" ? "blueprints.publish" : "blueprints.hide")}
      </Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

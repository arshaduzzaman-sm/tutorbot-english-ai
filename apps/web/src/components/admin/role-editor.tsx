"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminError } from "@/lib/admin";
import { adminCall } from "@/lib/admin-client";

export function RoleEditor({ userId, label, initial }: { userId: string; label: string; initial: string[] }) {
  const t = useTranslations("admin");
  const [roles, setRoles] = useState(initial.filter((r) => r !== "student"));
  const [error, setError] = useState<string | null>(null);
  async function toggle(role: string, on: boolean) {
    const next = on ? [...roles, role] : roles.filter((r) => r !== role);
    setError(null);
    try {
      const res = await adminCall<{ roles: string[] }>(`/users/${userId}/roles`, "PUT", { roles: next });
      setRoles(res.roles.filter((r) => r !== "student"));
    } catch (e) {
      setError(e instanceof AdminError ? e.message : t("editor.error"));
    }
  }
  return (
    <fieldset className="flex flex-wrap items-center gap-3">
      <legend className="sr-only">{t("users.rolesFor", { name: label })}</legend>
      {(["content_editor", "admin"] as const).map((r) => (
        <label key={r} className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={roles.includes(r)} onChange={(e) => void toggle(r, e.target.checked)} />
          {t(`roles.${r}`)}
        </label>
      ))}
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
    </fieldset>
  );
}

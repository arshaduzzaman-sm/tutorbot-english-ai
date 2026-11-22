"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

export function ForgotForm() {
  const t = useTranslations("auth");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setPending(true);
    // Always show the same message so nobody can find out which emails have accounts.
    await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${publicEnv.siteUrl}/reset-password` });
    setPending(false);
    setSent(true);
  }

  if (sent) return <Alert tone="success">{t("forgotSent")} {t("checkEmailLocal")}</Alert>;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("forgotBody")}</p>
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>{t("forgotSubmit")}</Button>
    </form>
  );
}

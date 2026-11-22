"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function ResetForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) {
      setError(t("errors.passwordShort"));
      return;
    }
    setPending(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (err) {
      setError(t("errors.generic"));
      return;
    }
    router.replace("/dashboard?notice=password-changed");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
          aria-describedby="password-hint" aria-invalid={!!error} />
        <p id="password-hint" className="mt-1 text-xs text-muted-foreground">{t("passwordHint")}</p>
        <FieldError id="password-error">{null}</FieldError>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>{t("resetSubmit")}</Button>
    </form>
  );
}

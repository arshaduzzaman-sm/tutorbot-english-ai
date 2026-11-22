"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/validation";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error: err } = await createClient().auth.signInWithPassword({
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
    });
    setPending(false);
    if (err) {
      setError(err.code === "email_not_confirmed" ? t("errors.notConfirmed") : t("errors.invalidLogin"));
      return;
    }
    router.replace(safeNext(next));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "…" : t("loginSubmit")}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="text-accent-blue underline">{t("forgot")}</Link>
        <span>
          {t("noAccount")} <Link href="/register" className="font-semibold text-accent-blue underline">Register</Link>
        </span>
      </div>
    </form>
  );
}

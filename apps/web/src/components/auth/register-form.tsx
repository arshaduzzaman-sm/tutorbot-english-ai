"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { validateRegister, type FieldErrors } from "@/lib/validation";

type Field = "email" | "password" | "age" | "terms";

export function RegisterForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values = {
      displayName: String(fd.get("displayName") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
      ageConfirmed: fd.get("age") === "on",
      termsAccepted: fd.get("terms") === "on",
    };
    const errs = validateRegister(values);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    setPending(true);
    const { error } = await createClient().auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${publicEnv.siteUrl}/onboarding`,
        data: { display_name: values.displayName, age_confirmed: "true", terms_accepted: "true" },
      },
    });
    setPending(false);
    if (error) {
      setFormError(error.message.toLowerCase().includes("password") ? t("errors.passwordShort") : t("errors.generic"));
      return;
    }
    router.push(`/check-email?email=${encodeURIComponent(values.email)}`);
  }

  const err = (f: Field) => (errors[f] ? t(`errors.${errors[f]}`) : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div>
        <Label htmlFor="displayName">{t("displayName")}</Label>
        <Input id="displayName" name="displayName" autoComplete="name" maxLength={80} />
      </div>
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email" name="email" type="email" autoComplete="email" required
          aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}
        />
        <FieldError id="email-error">{err("email")}</FieldError>
      </div>
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
          aria-invalid={!!errors.password} aria-describedby="password-hint password-error"
        />
        <p id="password-hint" className="mt-1 text-xs text-muted-foreground">{t("passwordHint")}</p>
        <FieldError id="password-error">{err("password")}</FieldError>
      </div>
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="age" className="mt-1 size-4" aria-invalid={!!errors.age}
            aria-describedby={errors.age ? "age-error" : undefined} />
          {t("ageConfirm")}
        </label>
        <FieldError id="age-error">{err("age")}</FieldError>
      </div>
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="terms" className="mt-1 size-4" aria-invalid={!!errors.terms}
            aria-describedby={errors.terms ? "terms-error" : undefined} />
          <span>
            {t("termsConfirm")} (<Link href="/terms" className="underline">Terms</Link>,{" "}
            <Link href="/privacy" className="underline">Privacy</Link>)
          </span>
        </label>
        <FieldError id="terms-error">{err("terms")}</FieldError>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "…" : t("registerSubmit")}
      </Button>
      <p className="text-center text-sm">
        {t("haveAccount")} <Link href="/login" className="font-semibold text-accent-blue underline">Log in</Link>
      </p>
    </form>
  );
}

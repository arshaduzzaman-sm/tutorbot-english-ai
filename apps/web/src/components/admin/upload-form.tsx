"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { AdminError } from "@/lib/admin";
import { adminCall } from "@/lib/admin-client";

type Result = { created: number; status: string; errors: { row: number; external_id: string; problems: string[] }[] };

/** Upload a JSON content file ({"questions": [...]} or a list). New questions start as draft or AI draft. */
export function UploadForm() {
  const t = useTranslations("admin");
  const [file, setFile] = useState<File | null>(null);
  const [origin, setOrigin] = useState<"human" | "ai">("human");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setResult(null);
    let questions: unknown;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      questions = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown }).questions;
      if (!Array.isArray(questions)) throw new Error("no list");
    } catch {
      setError(t("upload.badFile"));
      return;
    }
    setBusy(true);
    try {
      setResult(await adminCall<Result>("/uploads", "POST", { filename: file.name, origin, questions }));
    } catch (err) {
      setError(err instanceof AdminError ? err.message : t("editor.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p>{t("upload.intro")}</p>
      <div className="space-y-1">
        <Label htmlFor="upload-file">{t("upload.file")}</Label>
        <input id="upload-file" type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <fieldset className="space-y-1">
        <legend className="font-medium">{t("upload.origin")}</legend>
        {(["human", "ai"] as const).map((o) => (
          <label key={o} className="flex items-center gap-2">
            <input type="radio" name="origin" value={o} checked={origin === o} onChange={() => setOrigin(o)} />
            {t(`upload.origin_${o}`)}
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={!file || busy}>{t("upload.submit")}</Button>
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {result && (
        <Alert tone={result.errors.length ? "warning" : "success"} role="status" data-testid="upload-result">
          <p>{t("upload.created", { count: result.created, status: t(`status.${result.status}`) })}</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {result.errors.map((er) => <li key={er.row}>{t("upload.rowError", { row: er.row })} {er.problems.join("; ")}</li>)}
            </ul>
          )}
        </Alert>
      )}
    </form>
  );
}

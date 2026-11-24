"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { browserApi } from "@/lib/client-api";

const REASONS = ["wrong_answer", "unclear", "typo", "audio", "offensive", "other"] as const;

/** Lets a learner tell the content team about a problem with this question. */
export function ReportProblem({ questionId }: { questionId: string }) {
  const t = useTranslations("report");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("wrong_answer");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const api = await browserApi();
    const res = await api?.POST("/api/v1/questions/{question_id}/reports", {
      params: { path: { question_id: questionId } },
      body: { reason, message },
    });
    setState(res?.data ? "sent" : "error");
  }

  if (state === "sent") return <p role="status" className="text-sm text-muted-foreground">{t("thanks")}</p>;
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag aria-hidden="true" className="size-4" /> {t("open")}
      </Button>
    );
  }
  return (
    <form onSubmit={send} className="space-y-2 rounded-lg border border-border p-3" aria-label={t("open")}>
      <Label htmlFor={`${id}-reason`}>{t("reasonLabel")}</Label>
      <select id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}
        className="w-full rounded-lg border border-border bg-white p-2 text-foreground">
        {REASONS.map((r) => <option key={r} value={r}>{t(`reason.${r}`)}</option>)}
      </select>
      <Label htmlFor={`${id}-msg`}>{t("messageLabel")}</Label>
      <textarea id={`${id}-msg`} value={message} maxLength={1000} rows={2} onChange={(e) => setMessage(e.target.value)}
        className="w-full rounded-lg border border-border p-2 text-foreground" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={state === "sending"}>{t("send")}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
      </div>
      {state === "error" && <p role="alert" className="text-sm text-danger">{t("error")}</p>}
    </form>
  );
}

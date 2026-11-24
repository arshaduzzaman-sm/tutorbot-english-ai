"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { AdminError, type QuestionDetail } from "@/lib/admin";
import { adminCall } from "@/lib/admin-client";

const field = "w-full rounded-lg border border-border p-2 font-mono text-sm text-foreground";

/** Edit, review and publish one question. Publishing needs an approval of the current version (enforced by the API). */
export function QuestionEditor({ initial }: { initial: QuestionDetail }) {
  const t = useTranslations("admin");
  const [q, setQ] = useState(initial);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [explanation, setExplanation] = useState(initial.explanation);
  const [content, setContent] = useState(JSON.stringify(initial.content, null, 2));
  const [answer, setAnswer] = useState(JSON.stringify(initial.answer, null, 2));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<QuestionDetail>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await fn();
      setQ(next);
      setMessage({ tone: "success", text: ok });
    } catch (e) {
      setMessage({ tone: "danger", text: e instanceof AdminError ? e.message : t("editor.error") });
    } finally {
      setBusy(false);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    let parsed: { content: unknown; answer: unknown };
    try {
      parsed = { content: JSON.parse(content), answer: JSON.parse(answer) };
    } catch {
      setMessage({ tone: "danger", text: t("editor.badJson") });
      return;
    }
    void run(() => adminCall(`/questions/${q.id}`, "PATCH", { instructions, explanation, ...parsed }), t("editor.saved"));
  }

  const approvedNow = q.reviews.some((r) => r.version === q.version && r.decision === "approve");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-semibold text-primary">{q.external_id}</h2>
        <Badge data-testid="question-status">{t(`status.${q.status}`)}</Badge>
        {q.origin === "ai" && <Badge>{t("content.aiBadge")}</Badge>}
        <span className="text-sm text-muted-foreground">{t("editor.version", { version: q.version })} · {q.category}</span>
      </div>
      {message && <Alert tone={message.tone} role={message.tone === "danger" ? "alert" : "status"} data-testid="editor-message">{message.text}</Alert>}

      <Card>
        <CardTitle>{t("editor.reviewTitle")}</CardTitle>
        <CardBody className="space-y-3">
          <p>{approvedNow ? t("editor.approvedNow") : t("editor.needsApproval")}</p>
          {q.origin === "ai" && <p>{t("editor.aiRule")}</p>}
          <Label htmlFor="review-note">{t("editor.note")}</Label>
          <textarea id="review-note" rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} className={field} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void run(() => adminCall(`/questions/${q.id}/review`, "POST", { decision: "approve", note }), t("editor.approved"))}>
              {t("editor.approve")}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => adminCall(`/questions/${q.id}/review`, "POST", { decision: "request_changes", note }), t("editor.changesRequested"))}>
              {t("editor.requestChanges")}
            </Button>
            {q.status === "published" ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => adminCall(`/questions/${q.id}/status`, "POST", { status: "draft" }), t("editor.unpublished"))}>
                {t("editor.unpublish")}
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => void run(() => adminCall(`/questions/${q.id}/status`, "POST", { status: "published" }), t("editor.published"))}>
                {t("editor.publish")}
              </Button>
            )}
          </div>
          <ul className="space-y-1" aria-label={t("editor.history")}>
            {q.reviews.map((r, i) => (
              <li key={i}>{t(`editor.decision.${r.decision}`)} · v{r.version} · {new Date(r.created_at).toLocaleString()}{r.note && `: ${r.note}`}</li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <form onSubmit={save} className="space-y-3">
        <Label htmlFor="q-instructions">{t("editor.instructions")}</Label>
        <textarea id="q-instructions" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={field} />
        <Label htmlFor="q-content">{t("editor.content")}</Label>
        <textarea id="q-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} className={field} />
        <Label htmlFor="q-answer">{t("editor.answer")}</Label>
        <textarea id="q-answer" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} className={field} />
        <Label htmlFor="q-explanation">{t("editor.explanation")}</Label>
        <textarea id="q-explanation" rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} className={field} />
        <p className="text-sm text-muted-foreground">{t("editor.saveNote")}</p>
        <Button type="submit" disabled={busy}>{t("editor.save")}</Button>
      </form>

      {q.reports.length > 0 && (
        <Card>
          <CardTitle>{t("nav.reports")}</CardTitle>
          <CardBody>
            <ul className="space-y-1">
              {q.reports.map((r) => <li key={r.id}>{t(`reason.${r.reason}`)} ({t(`reportStatus.${r.status}`)}){r.message && `: ${r.message}`}</li>)}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

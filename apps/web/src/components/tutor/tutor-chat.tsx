"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { browserApi } from "@/lib/client-api";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const MAX = 1000;

export function TutorChat({ initial }: { initial: ChatMessage[] }) {
  const t = useTranslations("tutor");
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const counter = useRef(0);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/tutor/messages", { body: { message: text } });
    setPending(false);
    if (!res?.data) {
      const code = (res?.error as { error?: { code?: string } } | undefined)?.error?.code;
      setError(code === "tutor_limit" ? t("limit") : t("error"));
      return;
    }
    counter.current += 2;
    setMessages((m) => [
      ...m,
      { id: `local-${counter.current}`, role: "user", content: text },
      { id: `local-${counter.current + 1}`, role: "assistant", content: res.data.reply },
    ]);
    setRemaining(res.data.remaining_today);
    setDraft("");
  }

  async function clear() {
    const api = await browserApi();
    const res = await api?.DELETE("/api/v1/tutor/messages");
    if (res?.data) setMessages([]);
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3" aria-live="polite" data-testid="tutor-messages">
        {messages.length === 0 && <li className="text-muted-foreground">{t("empty")}</li>}
        {messages.map((m) => (
          <li key={m.id} className={`rounded-lg p-3 ${m.role === "user" ? "ml-8 bg-muted" : "mr-8 border border-border bg-white"}`}>
            <p className="text-xs font-semibold text-primary">{m.role === "user" ? t("you") : t("bot")}</p>
            <p className="whitespace-pre-wrap text-foreground">{m.content}</p>
          </li>
        ))}
      </ol>
      {error && <Alert tone="danger">{error}</Alert>}
      <form onSubmit={send} className="space-y-2">
        <Label htmlFor="tutor-input">{t("label")}</Label>
        <textarea
          id="tutor-input"
          value={draft}
          maxLength={MAX}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full rounded-lg border border-border p-3 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || !draft.trim()}>{pending ? t("sending") : t("send")}</Button>
          {messages.length > 0 && <Button type="button" variant="outline" onClick={() => void clear()}>{t("clear")}</Button>}
          {remaining != null && <span className="text-sm text-muted-foreground" data-testid="tutor-remaining">{t("remaining", { count: remaining })}</span>}
        </div>
      </form>
    </div>
  );
}

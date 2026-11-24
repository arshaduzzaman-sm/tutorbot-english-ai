"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type Paragraph = { id: string; text: string };
export type QuestionContent = {
  text?: string;
  blanks?: Record<string, string[]>;
  word_bank?: string[];
  passage?: string;
  question?: string;
  paragraphs?: Paragraph[];
  transcript?: string;
};
export type Option = { label: string; body: string };
export type AnswerState = {
  blanks?: Record<string, string>;
  selected?: string[];
  order?: string[];
  indices?: number[];
  text?: string;
};

/** A text with {{n}} gaps. Each gap is a select (options per blank or a word bank) or, with no options, a text box. */
export function BlanksView({
  content, value, onChange, disabled, wrong,
}: {
  content: QuestionContent;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  disabled?: boolean;
  wrong?: Set<string>;
}) {
  const t = useTranslations("practice");
  const pieces = (content.text ?? "").split(/\{\{(\d+)\}\}/);
  return (
    <p className="leading-10 text-foreground">
      {pieces.map((piece, i) => {
        if (i % 2 === 0) return <span key={i}>{piece}</span>;
        const choices = content.blanks?.[piece] ?? content.word_bank;
        if (!choices) {
          return (
            <input
              key={i}
              type="text"
              aria-label={t("blank", { n: piece })}
              value={value[piece] ?? ""}
              disabled={disabled}
              aria-invalid={wrong?.has(piece) || undefined}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => onChange({ ...value, [piece]: e.target.value })}
              className="mx-1 w-32 rounded-lg border border-border bg-white px-2 py-1 aria-[invalid]:border-danger"
            />
          );
        }
        return (
          <select
            key={i}
            aria-label={t("blank", { n: piece })}
            value={value[piece] ?? ""}
            disabled={disabled}
            aria-invalid={wrong?.has(piece) || undefined}
            onChange={(e) => onChange({ ...value, [piece]: e.target.value })}
            className="mx-1 rounded-lg border border-border bg-white px-2 py-1 aria-[invalid]:border-danger"
          >
            <option value="">{t("choose")}</option>
            {choices.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        );
      })}
    </p>
  );
}

export function ChoicesView({
  name, question, options, single, value, onChange, disabled,
}: {
  name: string;
  question: string;
  options: Option[];
  single: boolean;
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("practice");
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 font-medium text-foreground">
        {question} <span className="text-sm font-normal text-muted-foreground">{single ? t("selectOne") : t("selectAll")}</span>
      </legend>
      {options.map((o) => (
        <label key={o.label}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-3 has-[:checked]:border-accent-blue has-[:checked]:bg-blue-50">
          <input
            type={single ? "radio" : "checkbox"}
            name={name}
            value={o.label}
            checked={value.includes(o.label)}
            onChange={(e) =>
              onChange(single ? [o.label] : e.target.checked ? [...value, o.label] : value.filter((v) => v !== o.label))
            }
            className="mt-1 size-4"
          />
          <span><span className="font-semibold">{o.label}.</span> {o.body}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Reorder with Up/Down buttons (keyboard and screen readers) and native drag and drop (mouse). */
export function ReorderView({
  paragraphs, order, onChange, disabled,
}: { paragraphs: Paragraph[]; order: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const t = useTranslations("practice");
  const [dragging, setDragging] = useState<string | null>(null);
  const byId = new Map(paragraphs.map((p) => [p.id, p.text]));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t("reorderHelp")}</p>
      <ol className="space-y-2" aria-live="polite">
        {order.map((id, i) => {
          const text = byId.get(id) ?? id;
          return (
            <li
              key={id}
              draggable={!disabled}
              onDragStart={() => setDragging(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragging) move(order.indexOf(dragging), i); setDragging(null); }}
              className="flex items-start gap-3 rounded-xl border border-border bg-white p-3"
            >
              <span className="font-semibold text-primary" aria-hidden="true">{i + 1}.</span>
              <span className="flex-1"><span className="sr-only">{t("position", { n: i + 1 })}: </span>{text}</span>
              <span className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" disabled={disabled || i === 0} onClick={() => move(i, i - 1)}
                  aria-label={t("moveUp", { text })}>
                  <ArrowUp aria-hidden="true" className="size-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={disabled || i === order.length - 1} onClick={() => move(i, i + 1)}
                  aria-label={t("moveDown", { text })}>
                  <ArrowDown aria-hidden="true" className="size-4" />
                </Button>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Highlight Incorrect Words: each word of the transcript is a toggle button. */
export function WordsView({
  transcript, value, onChange, disabled, wrong,
}: { transcript: string; value: number[]; onChange: (v: number[]) => void; disabled?: boolean; wrong?: Set<number> }) {
  const t = useTranslations("practice");
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t("wordsHelp")}</p>
      <p className="flex flex-wrap gap-1 leading-8">
        {transcript.split(/\s+/).map((word, i) => {
          const on = value.includes(i);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(on ? value.filter((v) => v !== i) : [...value, i])}
              className={`rounded px-1 ${on ? "bg-yellow-200 font-semibold underline" : "hover:bg-muted"} ${wrong?.has(i) ? "ring-2 ring-danger" : ""}`}
            >
              {word}
            </button>
          );
        })}
      </p>
    </div>
  );
}

export function DictationView({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const t = useTranslations("practice");
  return (
    <label className="block space-y-2">
      <span className="font-medium">{t("dictationLabel")}</span>
      <textarea
        value={value}
        disabled={disabled}
        rows={3}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-white p-3"
      />
    </label>
  );
}

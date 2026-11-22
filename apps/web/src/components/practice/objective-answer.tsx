"use client";

import { useTranslations } from "next-intl";
import { Markdown } from "@/components/markdown";
import { type AnswerState, BlanksView, ChoicesView, DictationView, type Option, type QuestionContent, ReorderView, WordsView } from "./question-views";

export type ObjectiveItem = { id: string; categoryCode: string; content: unknown; options: Option[] };
const SINGLE = new Set(["reading_mc_single", "listening_mc_single", "highlight_correct_summary", "select_missing_word"]);

export function emptyAnswer(q: { categoryCode: string; content: unknown }): AnswerState {
  const c = q.content as QuestionContent;
  if (q.categoryCode === "reorder_paragraphs") return { order: (c.paragraphs ?? []).map((p) => p.id) };
  if (q.categoryCode.endsWith("fill_blanks")) return { blanks: {} };
  if (q.categoryCode === "highlight_incorrect_words") return { indices: [] };
  if (q.categoryCode === "write_from_dictation") return { text: "" };
  return { selected: [] };
}

/** The answer controls for any auto-marked task (used by timed drills and exams). */
export function ObjectiveAnswer({
  item, value, onChange, disabled,
}: { item: ObjectiveItem; value: AnswerState; onChange: (a: AnswerState) => void; disabled?: boolean }) {
  const t = useTranslations("practice");
  const content = item.content as QuestionContent;
  return (
    <div className="space-y-4">
      {content.passage && <div className="rounded-xl bg-muted p-4"><Markdown>{content.passage}</Markdown></div>}
      {value.blanks && <BlanksView content={content} value={value.blanks} disabled={disabled} onChange={(blanks) => onChange({ blanks })} />}
      {value.selected && (
        <ChoicesView name={`q-${item.id}`} question={content.question ?? t("chooseBest")} options={item.options}
          single={SINGLE.has(item.categoryCode)} value={value.selected} disabled={disabled} onChange={(selected) => onChange({ selected })} />
      )}
      {value.indices && <WordsView transcript={content.transcript ?? ""} value={value.indices} disabled={disabled} onChange={(indices) => onChange({ indices })} />}
      {value.text !== undefined && <DictationView value={value.text} disabled={disabled} onChange={(text) => onChange({ text })} />}
      {value.order && <ReorderView paragraphs={content.paragraphs ?? []} order={value.order} disabled={disabled} onChange={(order) => onChange({ order })} />}
    </div>
  );
}

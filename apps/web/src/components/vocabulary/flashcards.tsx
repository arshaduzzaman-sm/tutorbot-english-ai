"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { browserApi } from "@/lib/client-api";
import { SpeakButton } from "./speak-button";

export type Word = {
  id: string; externalId: string; word: string; partOfSpeech: string; meaning: string; example: string;
  box?: number | null; mastered: boolean;
};

export function Flashcards({ words }: { words: Word[] }) {
  const t = useTranslations("vocabulary");
  const tc = useTranslations("common");
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const [known, setKnown] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const card = words[index];

  async function answer(knewIt: boolean) {
    if (!card) return;
    setPending(true);
    setError(false);
    const api = await browserApi();
    const res = await api?.POST("/api/v1/vocabulary/{word_id}/review", {
      params: { path: { word_id: card.id } }, body: { known: knewIt },
    });
    setPending(false);
    if (!res?.data) return setError(true);
    if (knewIt) setKnown((k) => k + 1);
    setShown(false);
    setIndex((i) => i + 1);
    if (index + 1 >= words.length) router.refresh();
  }

  if (!card) {
    return (
      <div className="space-y-3" data-testid="flashcards-done">
        <Alert tone="success">
          <p className="font-semibold">{t("done")}</p>
          <p>{t("doneBody", { known, total: words.length })}</p>
        </Alert>
        <Button type="button" variant="outline" onClick={() => { setIndex(0); setKnown(0); }}>{t("again")}</Button>
      </div>
    );
  }

  return (
    <section aria-live="polite" className="space-y-4 rounded-2xl border border-border bg-white p-6" data-testid="flashcard">
      <p className="text-sm text-muted-foreground">{t("card", { n: index + 1, total: words.length })}</p>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-bold text-primary">{card.word}</h2>
        <Badge>{card.partOfSpeech}</Badge>
        {card.mastered ? <Badge>{t("mastered")}</Badge> : card.box == null ? <Badge>{t("new")}</Badge> : <Badge>{t("box", { box: card.box })}</Badge>}
      </div>
      <SpeakButton text={card.word} file={`vocab-${card.externalId}`} />
      {shown ? (
        <div className="space-y-2" data-testid="flashcard-back">
          <p className="text-lg">{card.meaning}</p>
          <p className="text-muted-foreground"><span className="font-medium">{t("example")}:</span> {card.example}</p>
          <SpeakButton text={card.example} label={t("example")} />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={() => answer(true)} disabled={pending}>{t("knewIt")}</Button>
            <Button type="button" variant="outline" onClick={() => answer(false)} disabled={pending}>{t("notYet")}</Button>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={() => setShown(true)}>{t("show")}</Button>
      )}
      {error && <Alert tone="danger">{tc("errorBody")}</Alert>}
    </section>
  );
}

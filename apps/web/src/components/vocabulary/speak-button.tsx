"use client";

import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Plays /audio/<file>.wav (from `make audio`) when it exists, otherwise the browser's offline speech voice. */
export function SpeakButton({ text, file, label }: { text: string; file?: string; label?: string }) {
  const t = useTranslations("vocabulary");
  const [noVoice, setNoVoice] = useState(false);

  function speak() {
    if (!("speechSynthesis" in window)) return setNoVoice(true);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  async function play() {
    setNoVoice(false);
    if (!file) return speak();
    try {
      const started = new Audio(`/audio/${file}.wav`).play() as Promise<void> | undefined;
      if (!started) throw new Error("no audio support");
      await started;
    } catch {
      speak();
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" onClick={play}>
        <Volume2 aria-hidden="true" className="size-4" /> {label ?? t("listen")}
      </Button>
      {noVoice && <span className="text-xs text-muted-foreground" role="status">{t("noVoice")}</span>}
    </span>
  );
}

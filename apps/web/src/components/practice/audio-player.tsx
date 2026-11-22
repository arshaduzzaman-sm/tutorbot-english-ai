"use client";

import { Play, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { browserApi } from "@/lib/client-api";

type Speech = { external_id: string; parts: string[]; transcript: string };

function playBeep(): Promise<void> {
  return new Promise((resolve) => {
    const Ctx = window.AudioContext;
    if (!Ctx) return resolve();
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    osc.frequency.value = 1000;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); void ctx.close(); resolve(); }, 600);
  });
}

function say(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/**
 * Plays a listening question. Uses the pre-generated Kokoro file (/audio/<id>.wav, from `make audio`) when it exists,
 * otherwise the browser's own offline speech voice. The transcript is offered in Learn mode only.
 */
export function AudioPlayer({
  questionId, externalId, learn, source = "practice",
}: { questionId: string; externalId: string; learn: boolean; source?: "practice" | "placement" }) {
  const t = useTranslations("practice");
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopped = useRef(false);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [questionId]);

  async function loadSpeech(): Promise<Speech | null> {
    if (speech) return speech;
    const api = await browserApi();
    const res = source === "placement"
      ? await api?.GET("/api/v1/placement/items/{item_id}/speech", { params: { path: { item_id: questionId } } })
      : await api?.GET("/api/v1/practice/questions/{question_id}/speech", { params: { path: { question_id: questionId } } });
    if (!res?.data) { setError(t("audioError")); return null; }
    setSpeech(res.data);
    return res.data;
  }

  async function speakFallback() {
    if (!("speechSynthesis" in window)) { setError(t("noVoice")); return; }
    const s = await loadSpeech();
    if (!s) return;
    for (const [i, part] of s.parts.entries()) {
      if (stopped.current) break;
      if (i > 0) await playBeep();
      await say(part);
    }
  }

  async function play() {
    setError(null);
    setPlaying(true);
    stopped.current = false;
    setPlays((n) => n + 1);
    const audio = new Audio(`/audio/${externalId}.wav`);
    audioRef.current = audio;
    try {
      const started = audio.play() as Promise<void> | undefined;
      if (!started) throw new Error("no audio support");
      await started;
      await new Promise<void>((resolve) => { audio.onended = () => resolve(); audio.onpause = () => resolve(); });
    } catch {
      await speakFallback();
    }
    setPlaying(false);
  }

  function stop() {
    stopped.current = true;
    audioRef.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
  }

  async function toggleTranscript() {
    if (!showTranscript && !(await loadSpeech())) return;
    setShowTranscript((v) => !v);
  }

  return (
    <div className="space-y-3 rounded-xl bg-muted p-4">
      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <Button type="button" variant="outline" onClick={stop}><Square aria-hidden="true" className="size-4" /> {t("stopAudio")}</Button>
        ) : (
          <Button type="button" onClick={play}><Play aria-hidden="true" className="size-4" /> {plays ? t("playAgain") : t("playAudio")}</Button>
        )}
        {learn && (
          <Button type="button" variant="ghost" onClick={toggleTranscript} aria-expanded={showTranscript}>
            {showTranscript ? t("hideTranscript") : t("showTranscript")}
          </Button>
        )}
        <span className="text-sm text-muted-foreground" aria-live="polite">{t("plays", { count: plays })}</span>
      </div>
      {learn && showTranscript && speech && <p className="rounded-lg bg-white p-3 text-sm" data-testid="transcript">{speech.transcript}</p>}
      {error && <Alert tone="warning">{error}</Alert>}
    </div>
  );
}

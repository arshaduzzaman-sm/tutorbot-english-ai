"use client";

import { Mic, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { clock } from "@/lib/tasks";

export type Recording = { blob: Blob; seconds: number; url: string };

/** A short tone like a test's "start speaking" signal (our own sound). */
export function playTone(ms = 400): Promise<void> {
  return new Promise((resolve) => {
    const Ctx = typeof window !== "undefined" ? window.AudioContext : undefined;
    if (!Ctx) return resolve();
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    osc.frequency.value = 880;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); void ctx.close(); resolve(); }, ms);
  });
}

function pickMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) ?? "";
}

export const canRecord = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/**
 * Records from the microphone up to `maxSeconds`, then stops by itself.
 * `autoStart` starts as soon as it mounts (Exam/Practice timing); `silenceStop` stops after that many silent seconds.
 */
export function Recorder({
  maxSeconds, autoStart = false, tone = true, silenceStop, allowStop = true, onDone,
}: {
  maxSeconds: number; autoStart?: boolean; tone?: boolean; silenceStop?: number; allowStop?: boolean;
  onDone: (r: Recording) => void;
}) {
  const t = useTranslations("speaking");
  const [state, setState] = useState<"idle" | "recording" | "error">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const timers = useRef<number[]>([]);

  function cleanup() {
    timers.current.forEach((id) => clearInterval(id));
    timers.current = [];
    stream.current?.getTracks().forEach((tr) => tr.stop());
  }

  useEffect(() => {
    if (autoStart) void start();
    return () => { if (rec.current?.state === "recording") rec.current.stop(); cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    if (!canRecord()) { setState("error"); setError(t("noRecorder")); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("error");
      setError(t("micBlocked"));
      return;
    }
    if (tone) await playTone();
    const mime = pickMime();
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      const seconds = Math.min((Date.now() - started.current) / 1000, maxSeconds);
      cleanup();
      const blob = new Blob(chunks, { type: (r.mimeType || mime || "audio/webm").split(";")[0] });
      setState("idle");
      onDone({ blob, seconds, url: URL.createObjectURL(blob) });
    };
    rec.current = r;
    started.current = Date.now();
    r.start(250);
    setState("recording");
    setElapsed(0);
    timers.current.push(window.setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setElapsed(Math.floor(s));
      if (s >= maxSeconds && r.state === "recording") r.stop();
    }, 200));
    if (silenceStop) watchSilence(stream.current, silenceStop, r);
  }

  function watchSilence(s: MediaStream, seconds: number, r: MediaRecorder) {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(s).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let quietSince = Date.now();
    timers.current.push(window.setInterval(() => {
      analyser.getByteTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((a, v) => a + (v - 128) ** 2, 0) / data.length);
      if (rms > 6) quietSince = Date.now();
      // Before any speech we wait the same time, so silence from the start also ends the recording.
      if ((Date.now() - quietSince) / 1000 >= seconds && r.state === "recording") { void ctx.close(); r.stop(); }
    }, 200));
  }

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-white p-4" data-testid="recorder">
      {state === "recording" ? (
        <>
          <p className="flex items-center gap-2 font-semibold text-danger" role="status">
            <span className="size-3 animate-pulse rounded-full bg-danger" aria-hidden="true" /> {t("recording")}
          </p>
          <Progress value={elapsed / maxSeconds} label={t("timeLeft", { time: clock(maxSeconds - elapsed) })} />
          {allowStop && (
            <Button type="button" variant="outline" onClick={stop}>
              <Square aria-hidden="true" className="size-4" /> {t("stop")}
            </Button>
          )}
        </>
      ) : (
        !autoStart && (
          <Button type="button" onClick={() => void start()}>
            <Mic aria-hidden="true" className="size-4" /> {t("start")}
          </Button>
        )
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

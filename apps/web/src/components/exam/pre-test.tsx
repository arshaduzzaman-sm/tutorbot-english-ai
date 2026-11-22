"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Countdown } from "@/components/speaking/speaking-task";
import { canRecord, type Recording, Recorder, playTone } from "@/components/speaking/recorder";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Step = "mic_check" | "headset_check" | "personal_introduction";

/** Steps before the test (SPEC 5A.4): microphone check, headset/volume check and an unscored introduction. */
export function PreTest({ steps, onDone }: { steps: string[]; onDone: () => void }) {
  const t = useTranslations("exam");
  const list = steps.filter((s): s is Step => ["mic_check", "headset_check", "personal_introduction"].includes(s));
  const [i, setI] = useState(0);
  const [rec, setRec] = useState<Recording | null>(null);
  const [introStage, setIntroStage] = useState<"prepare" | "record" | "done">("prepare");
  const step = list[i];
  const next = () => { setRec(null); if (i + 1 >= list.length) onDone(); else setI(i + 1); };
  useEffect(() => {
    if (list.length === 0) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!step) return null;
  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-5" aria-labelledby="pretest-h" data-testid="pre-test">
      <h2 id="pretest-h" className="text-xl font-semibold text-primary">{t(`pre.${step}.title`)}</h2>
      <p>{t(`pre.${step}.body`)}</p>
      {step === "mic_check" && (
        <>
          {!canRecord() && <Alert tone="warning">{t("noMic")}</Alert>}
          {canRecord() && <Recorder maxSeconds={5} tone={false} onDone={setRec} />}
          {rec && <audio controls src={rec.url} className="w-full" aria-label={t("micPlayback")} />}
        </>
      )}
      {step === "headset_check" && (
        <Button type="button" variant="outline" onClick={() => void playTone(800)}>{t("playTest")}</Button>
      )}
      {step === "personal_introduction" && (
        introStage === "prepare" ? <Countdown seconds={25} label={t("prepare")} onEnd={() => setIntroStage("record")} />
          : introStage === "record" ? <Recorder maxSeconds={30} autoStart onDone={() => setIntroStage("done")} />
            : <p>{t("introDone")}</p>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={next}>{t("continue")}</Button>
      </div>
    </section>
  );
}

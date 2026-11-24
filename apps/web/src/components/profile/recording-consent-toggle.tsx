"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { browserApi } from "@/lib/client-api";

/** Agree to, or stop, voice recordings. Stopping keeps old recordings until the account is deleted. */
export function RecordingConsentToggle({ initial }: { initial: boolean }) {
  const t = useTranslations("profile");
  const [granted, setGranted] = useState(initial);
  const [pending, setPending] = useState(false);
  async function toggle() {
    setPending(true);
    const api = await browserApi();
    const res = await api?.PUT("/api/v1/me/consents/recording", { body: { granted: !granted } });
    setPending(false);
    if (res?.data) setGranted(res.data.granted);
  }
  return (
    <div className="space-y-2">
      <p role="status" data-testid="recording-consent-state">{granted ? t("recordingOn") : t("recordingOff")}</p>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void toggle()}>
        {granted ? t("recordingStop") : t("recordingAllow")}
      </Button>
    </div>
  );
}

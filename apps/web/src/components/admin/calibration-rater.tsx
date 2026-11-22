"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { adminCall } from "@/lib/admin-client";

const BANDS = ["needs_work", "developing", "good", "strong"] as const;

export function CalibrationRater({ id, ai, human }: { id: string; ai: Record<string, string>; human: Record<string, string> | null }) {
  const t = useTranslations("admin");
  const tb = useTranslations("evaluation.band");
  const router = useRouter();
  const [bands, setBands] = useState<Record<string, string>>(human ?? ai);
  const [saved, setSaved] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await adminCall(`/calibration/${id}`, "PUT", { bands });
    setSaved(true);
    router.refresh();
  }
  return (
    <form onSubmit={save} className="space-y-2">
      <table className="text-left text-sm">
        <caption className="sr-only">{t("calibration.rateCaption")}</caption>
        <thead><tr><th scope="col" className="pr-3">{t("calibration.criterion")}</th><th scope="col" className="pr-3">{t("calibration.ai")}</th><th scope="col">{t("calibration.human")}</th></tr></thead>
        <tbody>
          {Object.entries(ai).map(([crit, band]) => (
            <tr key={crit}>
              <th scope="row" className="pr-3 font-normal">{crit}</th>
              <td className="pr-3">{tb(band)}</td>
              <td>
                <select aria-label={`${t("calibration.human")}: ${crit}`} value={bands[crit] ?? band}
                  onChange={(e) => setBands({ ...bands, [crit]: e.target.value })} className="rounded border border-border bg-white p-1">
                  {BANDS.map((b) => <option key={b} value={b}>{tb(b)}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button size="sm" type="submit">{t("calibration.save")}</Button>
      {saved && <span role="status" className="ml-2 text-sm">{t("calibration.saved")}</span>}
    </form>
  );
}

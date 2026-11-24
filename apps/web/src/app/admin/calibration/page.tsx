import { getTranslations } from "next-intl/server";
import { CalibrationRater } from "@/components/admin/calibration-rater";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import type { Calibration } from "@/lib/admin";
import { requireStaff } from "@/lib/admin-server";

export default async function AdminCalibrationPage() {
  const { get } = await requireStaff("/admin/calibration", true);
  const data = await get<Calibration>("/calibration");
  const t = await getTranslations("admin");
  const pctv = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-primary">{t("nav.calibration")}</h2>
      <p>{t("calibration.intro")}</p>
      <Card>
        <CardTitle>{t("calibration.report")}</CardTitle>
        <CardBody>
          <table className="w-full text-left text-sm" data-testid="calibration-report">
            <caption className="sr-only">{t("calibration.report")}</caption>
            <thead><tr><th scope="col">{t("content.type")}</th><th scope="col">{t("calibration.ratings")}</th><th scope="col">{t("calibration.exact")}</th><th scope="col">{t("calibration.adjacent")}</th><th scope="col">{t("calibration.minimum")}</th></tr></thead>
            <tbody>
              {data.report.length === 0 && <tr><td colSpan={5}>{t("calibration.noRatings")}</td></tr>}
              {data.report.map((r) => (
                <tr key={r.task_type}><th scope="row" className="font-normal">{r.task_type}</th><td>{r.ratings}</td><td>{pctv(r.exact)}</td><td>{pctv(r.adjacent)}</td><td>{r.meets_minimum ? t("calibration.yes") : t("calibration.no")}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3">{t("calibration.numericOff")}</p>
        </CardBody>
      </Card>
      {data.samples.length === 0 && <p>{t("calibration.noSamples")}</p>}
      <ul className="space-y-3">
        {data.samples.map((s) => (
          <li key={s.evaluation_id} className="space-y-2 rounded-lg border border-border bg-white p-3">
            <p className="font-medium">{s.task_type}</p>
            <p className="whitespace-pre-wrap text-sm">{s.response}</p>
            <CalibrationRater id={s.evaluation_id} ai={s.ai_bands} human={s.human_bands} />
          </li>
        ))}
      </ul>
    </div>
  );
}

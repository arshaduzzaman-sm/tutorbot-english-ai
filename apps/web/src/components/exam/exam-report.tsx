"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import type { components } from "@/api/schema";
import { browserApi } from "@/lib/client-api";

type Report = components["schemas"]["ExamReport"];
type Row = components["schemas"]["ReportRow"];

function Table({ caption, rows, label }: { caption: string; rows: Row[]; label: (r: Row) => string }) {
  const t = useTranslations("exam");
  const tb = useTranslations("evaluation");
  if (!rows.length) return null;
  return (
    <table className="w-full text-left text-sm">
      <caption className="mb-2 text-left text-lg font-semibold text-primary">{caption}</caption>
      <thead><tr><th scope="col" className="py-1">{t("part")}</th><th scope="col">{t("bandCol")}</th><th scope="col">{t("practiceMarks")}</th><th scope="col">{t("itemsCol")}</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.code} className="border-t border-border">
            <th scope="row" className="py-1 font-medium">{label(r)}</th>
            <td>{r.band ? tb(`band.${r.band}` as "band.good") : "—"}</td>
            <td>{r.ratio == null ? "—" : `${Math.round(r.ratio * 100)}%`}</td>
            <td>{r.items}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Report by skill, task type and criterion, with the weakest areas and a comparison (SPEC 5A.4). */
export function ExamReportView({ id }: { id: string }) {
  const t = useTranslations("exam");
  const tb = useTranslations("evaluation");
  const ts = useTranslations("skills");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      for (let i = 0; i < 90 && live; i++) {
        const api = await browserApi();
        const res = await api?.GET("/api/v1/exams/{test_id}/report", { params: { path: { test_id: id } } });
        if (!res?.data) { setError(true); return; }
        setReport(res.data);
        if (res.data.ready) return;
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => { live = false; };
  }, [id]);
  if (error) return <Alert tone="danger">{t("loadError")}</Alert>;
  if (!report) return <p role="status">{t("loading")}</p>;
  return (
    <div className="space-y-8" data-testid="exam-report">
      <h1 className="text-3xl font-bold text-primary">{t("reportTitle")}</h1>
      {!report.ready && <p role="status">{t("pending", { count: report.pending_evaluations })}</p>}
      <div className="rounded-xl bg-muted p-4">
        <p className="text-lg font-semibold">{t("overall")}: {report.overall_band ? tb(`band.${report.overall_band}` as "band.good") : "—"}</p>
        <p className="text-sm">{t("answeredSkipped", { answered: report.answered, skipped: report.skipped, total: report.total })}</p>
        <p className="mt-1 text-xs">{report.disclaimer}</p>
      </div>
      <Table caption={t("bySection")} rows={report.by_section} label={(r) => r.name} />
      <Table caption={t("bySkill")} rows={report.by_skill} label={(r) => ts(r.code as "reading")} />
      <Table caption={t("byType")} rows={report.by_type} label={(r) => r.name} />
      <Table caption={t("byCriterion")} rows={report.by_criterion} label={(r) => tb(`criterion.${r.code}` as "criterion.content")} />
      {report.most_lost.length > 0 && (
        <section aria-labelledby="lost-h">
          <h2 id="lost-h" className="text-lg font-semibold text-primary">{t("mostLost")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {report.most_lost.map((r) => <li key={r.code}><Link href={`/academy/${r.code}`} className="underline">{r.name}</Link></li>)}
          </ul>
        </section>
      )}
      <section aria-labelledby="cmp-h">
        <h2 id="cmp-h" className="text-lg font-semibold text-primary">{t("comparison")}</h2>
        {report.previous.length === 0 ? <p className="mt-1 text-muted-foreground">{t("firstMock")}</p> : (
          <ul className="mt-2 space-y-1 text-sm">
            {report.previous.map((p) => (
              <li key={p.id}>{p.completed_at ? new Date(p.completed_at).toLocaleDateString("en-GB") : ""}: {p.overall_ratio == null ? "—" : `${Math.round(p.overall_ratio * 100)}%`}
                {report.overall_ratio != null && p.overall_ratio != null && ` (${report.overall_ratio >= p.overall_ratio ? t("better") : t("lower")})`}</li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-sm">{t("nextSteps")} <Link href="/dashboard" className="underline">{t("toDashboard")}</Link></p>
    </div>
  );
}

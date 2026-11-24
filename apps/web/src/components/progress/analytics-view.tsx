import { useTranslations } from "next-intl";
import { BarChart, DataTable, HBarChart, LineChart } from "@/components/charts/charts";
import { Card } from "@/components/ui/card";
import { type Analytics, pct } from "@/lib/coach";

const short = (iso: string) => iso.slice(5); // MM-DD

export function AnalyticsView({ data }: { data: Analytics }) {
  const t = useTranslations("analytics");
  const tb = useTranslations("evaluation.band");
  const ts = useTranslations("skills");
  const none = t("none");
  const fmt = (v: number | null) => (v == null ? none : `${pct(v)}%`);
  const s = data.summary;
  const practised = data.daily.filter((d) => d.attempts > 0);
  const best = practised.reduce<(typeof practised)[number] | null>((a, d) => (!a || (d.accuracy ?? 0) > (a.accuracy ?? 0) ? d : a), null);

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-4" data-testid="analytics-summary">
        {([
          [t("summaryAttempts"), s.attempts],
          [t("summaryAccuracy"), fmt(s.accuracy)],
          [t("summaryMinutes"), s.minutes],
          [t("summaryDays"), s.activeDays],
        ] as const).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-white p-3">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="text-2xl font-semibold text-primary">{v}</dd>
          </div>
        ))}
      </dl>

      {s.attempts === 0 && <p data-testid="analytics-empty">{t("empty")}</p>}

      <Card>
        <LineChart
          id="daily-accuracy"
          title={t("dailyTitle")}
          desc={t("dailyDesc", { days: data.days })}
          points={data.daily.map((d) => ({ label: short(d.day), value: pct(d.accuracy) }))}
          summary={practised.length
            ? `${t("dailyTitle")}: ${practised.length} / ${data.days}. ${best ? `${best.day}: ${fmt(best.accuracy)}` : ""}`
            : `${t("dailyTitle")}: ${t("noData")}`}
          table={
            <DataTable summary={t("showTable")} caption={t("dailyTitle")}
              head={[t("colDay"), t("colAttempts"), t("colAccuracy"), t("colMinutes")]}
              rows={data.daily.map((d) => [d.day, d.attempts, fmt(d.accuracy), d.minutes])} />
          }
        />
      </Card>

      <Card>
        <BarChart
          id="daily-attempts"
          title={t("attemptsTitle")}
          points={data.daily.map((d) => ({ label: short(d.day), value: d.attempts }))}
          summary={`${t("attemptsTitle")}: ${s.attempts}`}
          table={
            <DataTable summary={t("showTable")} caption={t("attemptsTitle")}
              head={[t("colDay"), t("colAttempts")]}
              rows={data.daily.map((d) => [d.day, d.attempts])} />
          }
        />
      </Card>

      <Card>
        <HBarChart
          id="by-type"
          title={t("typeTitle")}
          desc={t("typeDesc")}
          rows={data.byType.map((r) => ({ label: r.name, value: pct(r.accuracy) }))}
          summary={data.byType.length
            ? data.byType.map((r) => `${r.name} ${fmt(r.accuracy)}`).join(", ")
            : `${t("typeTitle")}: ${t("noData")}`}
          table={
            <DataTable summary={t("showTable")} caption={t("typeTitle")}
              head={[t("colType"), t("colAttempts"), t("colAccuracy"), t("colBand"), t("colRecent"), t("colPrevious")]}
              rows={data.byType.map((r) => [r.name, r.attempts, fmt(r.accuracy), r.band ? tb(r.band) : none,
                fmt(r.recentAccuracy), fmt(r.previousAccuracy)])} />
          }
        />
      </Card>

      <Card>
        <h3 className="font-semibold text-primary">{t("trendTitle")}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid="skill-trend">
            <caption className="sr-only">{t("trendTitle")}</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-border px-2 py-1 text-primary">{t("colWeek")}</th>
                {(["speaking", "writing", "reading", "listening"] as const).map((k) => (
                  <th key={k} scope="col" className="border-b border-border px-2 py-1 text-primary">{ts(k.toUpperCase())}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.skillTrend.map((w) => (
                <tr key={w.weekStart}>
                  <th scope="row" className="border-b border-border px-2 py-1 font-normal">{w.weekStart}</th>
                  {(["speaking", "writing", "reading", "listening"] as const).map((k) => (
                    <td key={k} className="border-b border-border px-2 py-1 tabular-nums">{fmt(w[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

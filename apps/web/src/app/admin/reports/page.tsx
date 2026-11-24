import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ReportActions } from "@/components/admin/report-actions";
import type { ReportRow } from "@/lib/admin";
import { requireStaff } from "@/lib/admin-server";

export default async function AdminReportsPage() {
  const { get } = await requireStaff("/admin/reports");
  const rows = await get<ReportRow[]>("/reports?status=open");
  const t = await getTranslations("admin");
  return (
    <section aria-labelledby="reports-h" className="space-y-3">
      <h2 id="reports-h" className="text-xl font-semibold text-primary">{t("reports.title")}</h2>
      {rows.length === 0 && <p>{t("reports.none")}</p>}
      <ul className="space-y-3" data-testid="report-list">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-3">
            <div>
              <Link href={`/admin/content/${r.question_id}`} className="font-medium text-accent-blue underline">{r.external_id}</Link>
              <p className="text-sm">{t(`reason.${r.reason}`)}{r.message && `: ${r.message}`}</p>
            </div>
            <ReportActions id={r.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

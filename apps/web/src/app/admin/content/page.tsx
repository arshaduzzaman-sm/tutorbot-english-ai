import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { QuestionRow } from "@/lib/admin";
import { requireStaff } from "@/lib/admin-server";

const STATUSES = ["draft", "ai_generated", "reviewed", "published"];

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { get } = await requireStaff("/admin/content");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? "") ? sp.status : undefined;
  const params = new URLSearchParams({ limit: "100" });
  if (status) params.set("status", status);
  if (sp.q) params.set("search", sp.q.slice(0, 100));
  const rows = await get<QuestionRow[]>(`/questions?${params}`);
  const t = await getTranslations("admin");
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="text-sm">
          <span className="block font-medium">{t("content.status")}</span>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-border bg-white p-2">
            <option value="">{t("content.all")}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium">{t("content.search")}</span>
          <input name="q" defaultValue={sp.q ?? ""} className="rounded-lg border border-border p-2" />
        </label>
        <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{t("content.filter")}</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="question-table">
          <caption className="sr-only">{t("nav.content")}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="p-2">{t("content.id")}</th><th scope="col" className="p-2">{t("content.type")}</th>
              <th scope="col" className="p-2">{t("content.status")}</th><th scope="col" className="p-2">{t("content.version")}</th>
              <th scope="col" className="p-2">{t("content.reports")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-2">{t("content.none")}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <th scope="row" className="p-2 font-normal">
                  <Link href={`/admin/content/${r.id}`} className="text-accent-blue underline">{r.external_id}</Link>
                  <span className="block text-xs text-muted-foreground">{r.instructions}</span>
                </th>
                <td className="p-2">{r.category}</td>
                <td className="p-2"><Badge>{t(`status.${r.status}`)}</Badge>{r.origin === "ai" && <Badge className="ml-1">{t("content.aiBadge")}</Badge>}</td>
                <td className="p-2 tabular-nums">{r.version}</td>
                <td className="p-2 tabular-nums">{r.open_reports}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

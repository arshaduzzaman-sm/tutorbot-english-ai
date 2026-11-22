import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import type { Overview } from "@/lib/admin";
import { requireStaff } from "@/lib/admin-server";

export default async function AdminOverviewPage() {
  const { get } = await requireStaff("/admin");
  const data = await get<Overview>("/overview");
  const t = await getTranslations("admin");
  const statuses = ["draft", "ai_generated", "reviewed", "published"] as const;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardTitle>{t("overview.aiWaiting")}</CardTitle><CardBody><p className="text-2xl font-semibold text-primary" data-testid="ai-waiting">{data.ai_waiting_review}</p></CardBody></Card>
        <Card><CardTitle>{t("overview.openReports")}</CardTitle><CardBody><p className="text-2xl font-semibold text-primary">{data.open_reports}</p></CardBody></Card>
        <Card>
          <CardTitle>{t("overview.content")}</CardTitle>
          <CardBody>
            <dl className="grid grid-cols-2 gap-1">
              {statuses.map((s) => (
                <div key={s} className="contents">
                  <dt>{t(`status.${s}`)}</dt>
                  <dd className="text-right tabular-nums" data-testid={`count-${s}`}>{data.content[s] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
      {data.usage && (
        <Card data-testid="usage">
          <CardTitle>{t("overview.usage")}</CardTitle>
          <CardBody className="space-y-3">
            <p>{t("overview.users", { users: data.usage.users, active: data.usage.active_7d })}</p>
            <p>{t("overview.queue", { queued: data.usage.evaluation_queue.queued ?? 0, failed: data.usage.failed_7d })}</p>
            <table className="w-full text-left">
              <caption className="sr-only">{t("overview.aiTable")}</caption>
              <thead><tr><th scope="col">{t("overview.feature")}</th><th scope="col">{t("overview.provider")}</th><th scope="col">{t("overview.count")}</th></tr></thead>
              <tbody>
                {data.usage.ai_7d.length === 0 && <tr><td colSpan={3}>{t("overview.noUsage")}</td></tr>}
                {data.usage.ai_7d.map((u) => (
                  <tr key={`${u.feature}-${u.provider}`}><th scope="row" className="font-normal">{u.feature}</th><td>{u.provider}</td><td className="tabular-nums">{u.count}</td></tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

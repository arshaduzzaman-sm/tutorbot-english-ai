import { getTranslations } from "next-intl/server";
import { BlueprintToggle } from "@/components/admin/blueprint-toggle";
import { Badge } from "@/components/ui/badge";
import type { BlueprintRow } from "@/lib/admin";
import { requireStaff } from "@/lib/admin-server";

export default async function AdminBlueprintsPage() {
  const { get } = await requireStaff("/admin/blueprints", true);
  const rows = await get<BlueprintRow[]>("/blueprints");
  const t = await getTranslations("admin");
  return (
    <section aria-labelledby="bp-h" className="space-y-3">
      <h2 id="bp-h" className="text-xl font-semibold text-primary">{t("nav.blueprints")}</h2>
      <p className="text-sm text-muted-foreground">{t("blueprints.note")}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="blueprint-table">
          <caption className="sr-only">{t("nav.blueprints")}</caption>
          <thead><tr className="border-b border-border">
            <th scope="col" className="p-2">{t("blueprints.name")}</th><th scope="col" className="p-2">{t("blueprints.items")}</th>
            <th scope="col" className="p-2">{t("content.status")}</th><th scope="col" className="p-2">{t("blueprints.check")}</th><th scope="col" className="p-2"><span className="sr-only">{t("blueprints.actions")}</span></th>
          </tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.code} className="border-b border-border">
                <th scope="row" className="p-2 font-normal">{b.name}<span className="block text-xs text-muted-foreground">{b.code} · v{b.version}</span></th>
                <td className="p-2 tabular-nums">{b.items}</td>
                <td className="p-2"><Badge>{t(`status.${b.status}`)}</Badge>{!b.verified && <Badge className="ml-1">{t("blueprints.unverified")}</Badge>}</td>
                <td className="p-2">{b.shortages.length === 0 ? t("blueprints.enough") : b.shortages.map((s) => t("blueprints.short", s)).join("; ")}</td>
                <td className="p-2"><BlueprintToggle code={b.code} status={b.status} name={b.name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

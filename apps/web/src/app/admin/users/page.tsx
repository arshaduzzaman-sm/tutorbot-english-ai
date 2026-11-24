import { getTranslations } from "next-intl/server";
import { RoleEditor } from "@/components/admin/role-editor";
import type { UserRow } from "@/lib/admin";
import { requireStaff } from "@/lib/admin-server";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { get } = await requireStaff("/admin/users", true);
  const q = (await searchParams).q?.slice(0, 100) ?? "";
  const users = await get<UserRow[]>(`/users?limit=100${q ? `&search=${encodeURIComponent(q)}` : ""}`);
  const t = await getTranslations("admin");
  return (
    <section aria-labelledby="users-h" className="space-y-3">
      <h2 id="users-h" className="text-xl font-semibold text-primary">{t("nav.users")}</h2>
      <form role="search" className="flex gap-2">
        <label className="text-sm"><span className="sr-only">{t("content.search")}</span>
          <input name="q" defaultValue={q} placeholder={t("users.search")} className="rounded-lg border border-border p-2" />
        </label>
        <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{t("content.filter")}</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="user-table">
          <caption className="sr-only">{t("nav.users")}</caption>
          <thead><tr className="border-b border-border">
            <th scope="col" className="p-2">{t("users.user")}</th><th scope="col" className="p-2">{t("users.joined")}</th>
            <th scope="col" className="p-2">{t("users.attempts")}</th><th scope="col" className="p-2">{t("users.roles")}</th>
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border">
                <th scope="row" className="p-2 font-normal">{u.display_name ?? "—"}<span className="block text-xs text-muted-foreground">{u.email}</span></th>
                <td className="p-2">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="p-2 tabular-nums">{u.attempts}</td>
                <td className="p-2"><RoleEditor userId={u.id} label={u.email ?? u.id} initial={u.roles} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

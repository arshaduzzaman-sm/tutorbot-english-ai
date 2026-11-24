import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = await requireStaff("/admin");
  const t = await getTranslations("admin");
  const links = [
    ["/admin", t("nav.overview")],
    ["/admin/content", t("nav.content")],
    ["/admin/reports", t("nav.reports")],
    ["/admin/upload", t("nav.upload")],
    ...(isAdmin
      ? [["/admin/users", t("nav.users")], ["/admin/blueprints", t("nav.blueprints")], ["/admin/calibration", t("nav.calibration")]]
      : []),
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <nav aria-label={t("navLabel")} className="flex flex-wrap gap-2 text-sm">
          {links.map(([href, label]) => (
            <Link key={href} href={href!} className="rounded-full border border-border px-3 py-1 text-accent-blue underline">{label}</Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

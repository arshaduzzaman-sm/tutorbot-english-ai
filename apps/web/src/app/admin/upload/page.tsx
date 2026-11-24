import { getTranslations } from "next-intl/server";
import { UploadForm } from "@/components/admin/upload-form";
import { requireStaff } from "@/lib/admin-server";

export default async function AdminUploadPage() {
  await requireStaff("/admin/upload");
  const t = await getTranslations("admin");
  return (
    <section aria-labelledby="upload-h" className="space-y-3">
      <h2 id="upload-h" className="text-xl font-semibold text-primary">{t("upload.title")}</h2>
      <UploadForm />
    </section>
  );
}

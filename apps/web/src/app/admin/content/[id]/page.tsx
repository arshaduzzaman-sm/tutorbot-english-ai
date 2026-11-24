import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { QuestionEditor } from "@/components/admin/question-editor";
import { AdminError, type QuestionDetail } from "@/lib/admin";
import { requireStaff } from "@/lib/admin-server";

export default async function AdminQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { get } = await requireStaff(`/admin/content/${id}`);
  const q = await get<QuestionDetail>(`/questions/${encodeURIComponent(id)}`).catch((e: unknown) => {
    if (e instanceof AdminError && (e.status === 404 || e.status === 422)) notFound();
    throw e;
  });
  const t = await getTranslations("admin");
  return (
    <div className="space-y-4">
      <Link href="/admin/content" className="text-sm text-accent-blue underline">{t("content.back")}</Link>
      <QuestionEditor initial={q} />
    </div>
  );
}

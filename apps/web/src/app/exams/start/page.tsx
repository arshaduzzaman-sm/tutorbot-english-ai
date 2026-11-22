import { StartByCode } from "@/components/exam/exams-hub";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** /exams/start?code=... starts a blueprint by its code (also used for the short test blueprint in e2e tests). */
export default async function StartExamPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  await requireSession(`/exams/start?code=${code ?? ""}`);
  return <div className="mx-auto max-w-3xl px-4 py-10"><StartByCode code={(code ?? "").replace(/[^a-z0-9_]/g, "")} /></div>;
}

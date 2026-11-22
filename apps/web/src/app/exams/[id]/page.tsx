import { ExamRunner } from "@/components/exam/exam-runner";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Mock exam" };
export const dynamic = "force-dynamic";

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/exams/${id}`);
  return <ExamRunner id={id} />;
}

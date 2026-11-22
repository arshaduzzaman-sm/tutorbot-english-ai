import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LessonPlayer } from "@/components/lessons/lesson-player";
import { LessonStatusBadge } from "@/components/lessons/status-badge";
import { LessonQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { accessToken } = await requireSession(`/lessons/${slug}`);
  const { lesson } = await serverQuery(accessToken, LessonQuery, { slug });
  if (!lesson) notFound();
  const t = await getTranslations("lessons");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link href="/lessons" className="text-sm font-medium text-accent-blue underline">{t("backToLessons")}</Link>
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {lesson.level ? t("levelHeading", { code: lesson.level.code, name: lesson.level.name }) : null}
        </p>
        <h1 className="text-3xl font-bold text-primary">{lesson.title}</h1>
        <p className="text-muted-foreground">{lesson.summary}</p>
        <LessonStatusBadge status={lesson.progress?.status} />
      </header>
      <LessonPlayer lesson={lesson} />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { type ChatMessage, TutorChat } from "@/components/tutor/tutor-chat";
import { TutorQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const metadata = { title: "Tutor" };
export const dynamic = "force-dynamic";

export default async function TutorPage() {
  const { accessToken } = await requireSession("/tutor");
  const { viewer } = await serverQuery(accessToken, TutorQuery);
  const t = await getTranslations("tutor");
  const tc = await getTranslations("common");
  const level = viewer.profile?.level;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      {viewer.demoMode && <Alert tone="warning" data-testid="demo-banner">{tc("demoMode")}</Alert>}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
        {level && <Badge>{level.name} · CEFR {level.cefr}</Badge>}
        <p className="text-sm text-muted-foreground">{t("note")}</p>
      </div>
      <TutorChat initial={viewer.tutorMessages.map((m) => ({ id: m.id, role: m.role as ChatMessage["role"], content: m.content }))} />
    </div>
  );
}

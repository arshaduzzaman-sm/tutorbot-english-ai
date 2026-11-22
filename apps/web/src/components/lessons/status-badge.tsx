import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function LessonStatusBadge({ status }: { status: string | null | undefined }) {
  const t = useTranslations("lessons");
  if (status === "completed")
    return (
      <Badge className="bg-green-50 text-[#14532d]">
        <CheckCircle2 aria-hidden="true" className="mr-1 size-3.5" />
        {t("statusCompleted")}
      </Badge>
    );
  if (status === "in_progress")
    return (
      <Badge className="bg-blue-50 text-[#1e3a8a]">
        <CircleDot aria-hidden="true" className="mr-1 size-3.5" />
        {t("statusInProgress")}
      </Badge>
    );
  return (
    <Badge>
      <Circle aria-hidden="true" className="mr-1 size-3.5" />
      {t("statusNew")}
    </Badge>
  );
}

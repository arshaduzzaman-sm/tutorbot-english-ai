import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { ReviewQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";
import { ReviewSession } from "./review-session";

export const metadata = { title: "Mistake notebook" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { accessToken } = await requireSession("/review");
  const { viewer } = await serverQuery(accessToken, ReviewQuery);
  const t = await getTranslations("review");
  const format = await getFormatter();
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intro")}</p>
      </div>
      <section aria-labelledby="due-heading" className="space-y-3">
        <h2 id="due-heading" className="text-xl font-semibold text-primary">{t("dueHeading")}</h2>
        <p data-testid="review-due-count">{t("dueCount", { count: viewer.reviewDueCount })}</p>
        {viewer.due.length > 0 && <ReviewSession questions={viewer.due.map((d) => d.question)} />}
      </section>
      <section aria-labelledby="all-heading" className="space-y-3">
        <h2 id="all-heading" className="text-xl font-semibold text-primary">{t("allHeading")}</h2>
        {viewer.reviewItems.length === 0 ? (
          <p className="text-muted-foreground" data-testid="review-empty">{t("empty")}</p>
        ) : (
          <ul className="space-y-2" data-testid="review-list">
            {viewer.reviewItems.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white p-3">
                <span className="font-medium">{r.question.category?.name ?? r.question.categoryCode}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {r.mastered ? <Badge>{t("mastered")}</Badge> : <Badge>{t("box", { box: r.box })}</Badge>}
                  <span>{t("wrongCount", { count: r.wrongCount })}</span>
                  {!r.mastered && (
                    <span>{r.isDue ? t("dueNow") : t("nextDue", { date: format.dateTime(new Date(r.dueAt), { dateStyle: "medium" }) })}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

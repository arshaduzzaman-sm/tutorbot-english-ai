import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { QuestionTypeQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

export const dynamic = "force-dynamic";

type Guide = {
  what: string;
  tests: string;
  scoring: { traits: string[]; note: string; source: string; checked: string };
  strategy: string[];
  example_prompt?: string;
  examples: Record<"strong" | "medium" | "weak", { answer: string; why: string }>;
  mistakes: string[];
  rules: Record<string, string | number | boolean>;
  rules_source: string;
};
const RULE_KEYS = ["prepare_seconds", "answer_seconds", "prompt", "words", "plays", "options", "tone", "silence_stop_seconds", "scoring"] as const;

export default async function QuestionTypePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { accessToken } = await requireSession(`/academy/${code}`);
  const data = await serverQuery(accessToken, QuestionTypeQuery, { code });
  if (!data.questionType) notFound();
  const t = await getTranslations("academy");
  const { category, questionCount } = data.questionType;
  const g = data.questionType.guide as Guide;
  const rules = RULE_KEYS.filter((k) => g.rules[k] !== undefined);
  const history = data.viewer.typeHistory;
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <Link href="/academy" className="text-sm font-medium text-accent-blue underline">{t("back")}</Link>
      <header>
        <h1 className="text-3xl font-bold text-primary">{category.name}</h1>
        <p className="mt-2 text-lg">{g.what}</p>
        <p className="mt-1 text-muted-foreground">{t("tests", { text: g.tests })}</p>
      </header>

      <section aria-labelledby="rules-h">
        <h2 id="rules-h" className="text-xl font-semibold text-primary">{t("rulesTitle")}</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {rules.map((k) => (
            <div key={k} className="rounded-lg bg-muted p-3">
              <dt className="text-sm text-muted-foreground">{t(`rule.${k}`)}</dt>
              <dd className="font-medium">{typeof g.rules[k] === "boolean" ? (g.rules[k] ? t("yes") : t("no")) : String(g.rules[k])}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">{t("rulesSource")}</p>
      </section>

      <section aria-labelledby="score-h">
        <h2 id="score-h" className="text-xl font-semibold text-primary">{t("scoringTitle")}</h2>
        {g.scoring.traits.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {g.scoring.traits.map((tr) => <li key={tr} className="rounded-full bg-blue-50 px-3 py-1 text-sm">{tr}</li>)}
          </ul>
        )}
        <p className="mt-2">{g.scoring.note}</p>
        <p className="mt-1 text-sm">
          {t("source")} <a href={g.scoring.source} className="text-accent-blue underline" rel="noopener noreferrer" target="_blank">{g.scoring.source}</a> ({t("checked", { date: g.scoring.checked })})
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t("ourMarking")}</p>
      </section>

      <section aria-labelledby="strategy-h">
        <h2 id="strategy-h" className="text-xl font-semibold text-primary">{t("strategyTitle")}</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">{g.strategy.map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="mt-2 text-sm text-muted-foreground">{t("noTemplates")}</p>
      </section>

      <section aria-labelledby="examples-h">
        <h2 id="examples-h" className="text-xl font-semibold text-primary">{t("examplesTitle")}</h2>
        {g.example_prompt && <p className="mt-2 rounded-lg bg-muted p-3 text-sm">{t("examplePrompt", { text: g.example_prompt })}</p>}
        <div className="mt-3 space-y-3">
          {(["strong", "medium", "weak"] as const).map((k) => (
            <div key={k} className="rounded-xl border border-border bg-white p-4">
              <h3 className="font-semibold">{t(`example.${k}`)}</h3>
              <p className="mt-1">{g.examples[k].answer}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("why", { text: g.examples[k].why })}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="mistakes-h">
        <h2 id="mistakes-h" className="text-xl font-semibold text-primary">{t("mistakesTitle")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">{g.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
      </section>

      <section aria-labelledby="modes-h">
        <h2 id="modes-h" className="text-xl font-semibold text-primary">{t("modesTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("questions", { count: questionCount })}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/practice/${code}`} className={buttonVariants()}>{t("learnPractice")}</Link>
          <Link href={`/practice/${code}/drill`} className={buttonVariants({ variant: "outline" })}>{t("drill")}</Link>
          <Link href="/exams" className={buttonVariants({ variant: "outline" })}>{t("exam")}</Link>
        </div>
      </section>

      <section aria-labelledby="history-h">
        <h2 id="history-h" className="text-xl font-semibold text-primary">{t("historyTitle")}</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr><th scope="col" className="py-1">{t("date")}</th><th scope="col">{t("mode")}</th><th scope="col">{t("result")}</th></tr></thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-1">{new Date(a.createdAt as string).toLocaleDateString("en-GB")}</td>
                  <td>{t(`modeName.${a.mode}`)}</td>
                  <td>{a.scoreRatio == null ? "—" : `${Math.round(a.scoreRatio * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </article>
  );
}

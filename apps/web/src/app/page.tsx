import { BookOpen, Brain, Headphones, Mic, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import levels from "../../../../content/levels.json";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const skills = [
    { icon: Mic, title: t("speaking"), body: t("speakingBody") },
    { icon: PenLine, title: t("writing"), body: t("writingBody") },
    { icon: BookOpen, title: t("reading"), body: t("readingBody") },
    { icon: Headphones, title: t("listening"), body: t("listeningBody") },
  ];
  const faqs = [1, 2, 3, 4] as const;

  return (
    <div>
      <section className="bg-gradient-to-b from-[#eef2ff] to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-accent-purple shadow-sm">
            <Sparkles aria-hidden="true" className="size-4" /> Free · Open source · Runs on your computer
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-primary sm:text-5xl">{t("heroTitle")}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground" data-testid="hero-message">
            {t("heroBody")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className={buttonVariants({ size: "lg" })}>
              {t("start")}
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
              {t("haveAccount")}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="intro">
        <h2 id="intro" className="text-2xl font-bold text-primary">{t("introTitle")}</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">{t("introBody")}</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="skills">
        <h2 id="skills" className="text-2xl font-bold text-primary">{t("skillsTitle")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {skills.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardTitle>
                <Icon aria-hidden="true" className="size-5 text-accent-blue" />
                <span>{title}</span>
              </CardTitle>
              <CardBody>{body}</CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="ai">
        <h2 id="ai" className="flex items-center gap-2 text-2xl font-bold text-primary">
          <Brain aria-hidden="true" className="size-6 text-accent-purple" /> {t("aiTitle")}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["ai1", "ai2", "ai3", "ai4"] as const).map((k) => (
            <li key={k} className="rounded-xl border border-border bg-white p-4 text-sm">{t(k)}</li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="paths">
        <h2 id="paths" className="text-2xl font-bold text-primary">{t("pathsTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("pathsBody")}</p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map((lv) => (
            <li key={lv.code} className="rounded-xl border border-border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-purple">
                Level {lv.code} · CEFR {lv.cefr}
              </p>
              <p className="mt-1 font-semibold text-primary">{lv.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{lv.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="features">
        <h2 id="features" className="text-2xl font-bold text-primary">{t("featuresTitle")}</h2>
        <ul className="mt-4 grid list-disc gap-2 pl-5 text-muted-foreground sm:grid-cols-2">
          {(["f1", "f2", "f3", "f4"] as const).map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-bold text-primary">{t("faqTitle")}</h2>
        <div className="mt-4 space-y-3">
          {faqs.map((n) => (
            <details key={n} className="rounded-xl border border-border bg-white p-4">
              <summary className="cursor-pointer font-semibold text-primary">{t(`q${n}`)}</summary>
              <p className="mt-2 text-muted-foreground">{t(`a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

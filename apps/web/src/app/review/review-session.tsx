"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { PracticePlayer } from "@/components/practice/practice-player";
import { Button } from "@/components/ui/button";
import type { ReviewQuery } from "@/graphql/generated/graphql";

type Question = ReviewQuery["viewer"]["due"][number]["question"];

export function ReviewSession({ questions }: { questions: Question[] }) {
  const t = useTranslations("review");
  const [started, setStarted] = useState(false);
  if (!started) return <Button type="button" onClick={() => setStarted(true)}>{t("start")}</Button>;
  return <PracticePlayer questions={questions} fixedMode="review" />;
}

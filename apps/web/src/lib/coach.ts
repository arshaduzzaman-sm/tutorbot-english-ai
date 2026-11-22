/** Shapes of the JSON returned by viewer.coach and viewer.analytics (see apps/api/app/services/coach.py, analytics.py). */

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Band = "needs_work" | "developing" | "good" | "strong";

export type Recommendation = {
  kind: "review" | "practice" | "mock" | "lesson";
  reason: "review_due" | "weak" | "declining" | "not_tried" | "stale" | "ready_for_mock" | "keep_going";
  categoryCode: string | null;
  accuracy?: number | null;
  difficulty?: Difficulty;
  count?: number;
};

export type Readiness = {
  overall: "not_enough_data" | "building" | "getting_close" | "ready";
  skills: { skill: string; band: Band | null; typesTried: number; typesTotal: number }[];
  typesTried: number;
  typesTotal: number;
  attempts: number;
};

type Week = { attempts: number; activeDays: number; accuracy: number | null; types: number };
export type Weekly = {
  thisWeek: Week;
  lastWeek: Week;
  accuracyChange: number | null;
  message: "start" | "first_week" | "improving" | "slipping" | "steady";
};

export type PlanBlock =
  | { kind: "lessons"; minutes: number; level: number }
  | { kind: "practice"; minutes: number; categoryCode: string; difficulty: Difficulty }
  | { kind: "review"; minutes: number };

export type Analytics = {
  days: number;
  summary: { attempts: number; accuracy: number | null; minutes: number; activeDays: number; types: number };
  daily: { day: string; attempts: number; accuracy: number | null; minutes: number }[];
  byType: {
    code: string;
    name: string;
    section: string;
    attempts: number;
    accuracy: number | null;
    band: Band | null;
    recentAccuracy: number | null;
    previousAccuracy: number | null;
    change: number | null;
  }[];
  skillTrend: ({ weekStart: string } & Record<"speaking" | "writing" | "reading" | "listening", number | null>)[];
};

export const pct = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100));

/** Where a recommendation leads. Practice links ask for questions at the suggested difficulty. */
export function recommendationHref(r: Recommendation): string {
  if (r.kind === "review") return "/review";
  if (r.kind === "mock") return "/exams";
  if (r.kind === "practice" && r.categoryCode) return `/practice/${r.categoryCode}?adaptive=1`;
  return "/lessons";
}

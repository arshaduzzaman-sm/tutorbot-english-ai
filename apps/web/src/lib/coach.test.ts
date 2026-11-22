import { describe, expect, it } from "vitest";
import { pct, recommendationHref } from "./coach";

describe("coach helpers", () => {
  it("links each recommendation to the right page", () => {
    expect(recommendationHref({ kind: "review", reason: "review_due", categoryCode: null, count: 2 })).toBe("/review");
    expect(recommendationHref({ kind: "practice", reason: "weak", categoryCode: "read_aloud" })).toBe("/practice/read_aloud?adaptive=1");
    expect(recommendationHref({ kind: "mock", reason: "ready_for_mock", categoryCode: null })).toBe("/exams");
    expect(recommendationHref({ kind: "lesson", reason: "keep_going", categoryCode: null })).toBe("/lessons");
  });
  it("turns ratios into whole percentages", () => {
    expect(pct(0.756)).toBe(76);
    expect(pct(null)).toBeNull();
  });
});

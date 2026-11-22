import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { PlacementRunner } from "./placement-runner";

const post = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/client-api", () => ({ browserApi: async () => ({ POST: post, GET: vi.fn() }) }));

const test_ = {
  slug: "p", title: "Placement", estimatedMinutes: 15,
  items: [
    { id: "a", level: 1, skill: "reading", prompt: "How old?", passage: "I am ten.", options: ["Eight", "Ten"], hasAudio: false },
    { id: "b", level: 2, skill: "writing", prompt: "Pick", passage: null, options: ["x", "y"], hasAudio: false },
  ],
};
const levels = [{ code: 2, name: "Elementary English", cefr: "A2" }];

describe("PlacementRunner", () => {
  it("sends the chosen option text, allows I don't know, and shows level, skills and plan", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: {
      recommended_level: 2, level_scores: { "1": 1, "2": 0 }, skill_scores: { reading: 1, writing: 0 }, correct: 1, total: 2,
      plan: { daily_minutes: 30, focus_skills: ["writing"], days_to_exam: null,
        blocks: [{ kind: "lessons", minutes: 12, level: 2 }, { kind: "practice", minutes: 12, skill: "writing" }, { kind: "review", minutes: 6 }] },
      note: "Practice estimate of where to start. Not an official PTE score or level." } });
    renderWithIntl(<PlacementRunner test={test_} levels={levels} />);
    await user.click(screen.getByRole("button", { name: "Start the placement test" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please choose an answer");
    await user.click(screen.getByLabelText(/Ten/));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "I don't know" }));
    expect(post.mock.calls[0]?.[1].body.answers).toEqual({ a: "Ten" });
    const result = await screen.findByTestId("placement-result");
    expect(result).toHaveTextContent("We suggest you start at Level 2: Elementary English.");
    expect(result).toHaveTextContent("Speaking: Not tested");
    expect(screen.getByTestId("study-plan")).toHaveTextContent("12 min: Writing practice");
  });
});

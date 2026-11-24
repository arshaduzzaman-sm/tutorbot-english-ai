import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { LessonPlayer } from "./lesson-player";

const post = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/client-api", () => ({ browserApi: async () => ({ POST: post }) }));

const ex = (id: string) => ({ id, type: "single_choice", prompt: `Pick ${id}`, options: ["a", "b"], hint: "Think" });
const lesson = {
  id: "1", slug: "demo", title: "Demo", summary: "", estimatedMinutes: 5, locked: false, unitSlug: null,
  level: { code: 1, name: "Beginner", cefr: "A1" }, progress: null,
  sections: [
    { kind: "learn", title: "Read this", bodyMd: "Some **text**", exercises: [] },
    { kind: "try", title: "", bodyMd: "", exercises: [ex("t1")] },
    { kind: "check", title: "", bodyMd: "", exercises: [ex("c1"), ex("c2")] },
  ],
};

describe("LessonPlayer", () => {
  beforeEach(() => post.mockReset());

  it("starts the lesson, gives feedback in Try and marks the Check", async () => {
    const user = userEvent.setup();
    post.mockImplementation(async (path = "") => {
      if (path.endsWith("/start")) return { data: { status: "in_progress" } };
      if (path.includes("/exercises/")) return { data: { id: "t1", correct: false, correct_answer: "a", explanation: "Because." } };
      return { data: { score_ratio: 1, passed: true, pass_ratio: 0.8, results: [
        { id: "c1", correct: true, correct_answer: "a", explanation: "ok" },
        { id: "c2", correct: true, correct_answer: "b", explanation: "ok" },
      ] } };
    });
    renderWithIntl(<LessonPlayer lesson={lesson} />);
    expect(screen.getByRole("heading", { name: "Read this" })).toBeInTheDocument();
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/v1/lessons/{slug}/start", expect.anything()));

    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByLabelText("b"));
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(await screen.findByText("Not quite. The answer is: a")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: "Submit my answers" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please answer every question.");

    const radios = screen.getAllByLabelText("a");
    for (const r of radios) await user.click(r);
    await user.click(screen.getByRole("button", { name: "Submit my answers" }));
    expect(await screen.findByText("Well done! You scored 100%. This lesson is complete.")).toBeInTheDocument();
    const call = post.mock.calls.find((c) => c[0] === "/api/v1/lessons/{slug}/check");
    expect(call?.[1].body.answers).toEqual({ c1: "a", c2: "a" });
  });
});

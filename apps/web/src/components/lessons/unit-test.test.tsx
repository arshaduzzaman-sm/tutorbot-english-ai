import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { UnitTestForm } from "./unit-test";

const post = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/client-api", () => ({ browserApi: async () => ({ POST: post }) }));

const items = [{ id: "t1", type: "single_choice", prompt: "Pick a vowel", options: ["k", "o"], hint: null }];

describe("UnitTestForm", () => {
  it("needs every answer, then shows the pass message and a link to the next unit", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: { score_ratio: 1, passed: true, pass_ratio: 0.8, unlocked: "u2",
      results: [{ id: "t1", correct: true, correct_answer: "o", explanation: "Vowel." }] } });
    renderWithIntl(<UnitTestForm slug="u1" items={items} />);
    await user.click(screen.getByRole("button", { name: "Submit my answers" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please answer every question.");
    await user.click(screen.getByLabelText("o"));
    await user.click(screen.getByRole("button", { name: "Submit my answers" }));
    expect(await screen.findByText("You passed! The next unit is open.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the next unit" })).toHaveAttribute("href", "/lessons");
    expect(post.mock.calls[0]?.[1]).toMatchObject({ params: { path: { slug: "u1" } }, body: { answers: { t1: "o" } } });
  });
});

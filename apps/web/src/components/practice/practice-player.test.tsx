import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { PracticePlayer } from "./practice-player";

const post = vi.fn();
vi.mock("@/lib/client-api", () => ({ browserApi: async () => ({ POST: post }) }));

const base = { difficulty: "beginner", instructions: "Do it.", learningObjective: "Read carefully.", options: [], category: null };
const blanks = { ...base, id: "q1", externalId: "x1", categoryCode: "rw_fill_blanks",
  content: { text: "I {{1}} tea.", blanks: { "1": ["like", "likes"] } } };
const order = { ...base, id: "q2", externalId: "x2", categoryCode: "reorder_paragraphs",
  content: { paragraphs: [{ id: "p1", text: "Second" }, { id: "p2", text: "First" }] } };

describe("PracticePlayer", () => {
  beforeEach(() => post.mockReset());

  it("marks a fill-in-the-blanks answer, then reorders with buttons and shows results", async () => {
    const user = userEvent.setup();
    post.mockResolvedValueOnce({ data: { score_ratio: 1, is_correct: true, correct_answer: { blanks: { "1": "like" } },
      parts: [], explanation: "Base verb.", note: "Practice marking: not an official PTE score." } });
    post.mockResolvedValueOnce({ data: { score_ratio: 0, is_correct: false, correct_answer: { order: ["p2", "p1"] },
      parts: [], explanation: "Order.", note: "n" } });
    renderWithIntl(<PracticePlayer questions={[blanks, order]} />);

    expect(screen.getByText("Tip: Read carefully.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please answer the question first.");
    await user.selectOptions(screen.getByLabelText("Blank 1"), "like");
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(await screen.findByText(/All correct! You scored 100%/)).toBeInTheDocument();
    expect(post.mock.calls[0]?.[1].body).toMatchObject({ response: { blanks: { "1": "like" } }, mode: "learn" });

    await user.click(screen.getByRole("button", { name: "Next question" }));
    await user.click(screen.getByLabelText(/^Practice mode/));
    expect(screen.getByRole("timer")).toHaveTextContent("Time so far: 0:00");
    await user.click(screen.getByRole("button", { name: "Move up: First" }));
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(post.mock.calls[1]?.[1].body).toMatchObject({ response: { order: ["p2", "p1"] }, mode: "practice" });
    expect(await screen.findByText("Correct answer: 1. First 2. Second")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "See my results" }));
    expect(screen.getByTestId("practice-done")).toHaveTextContent("You answered 2 questions. Your average was 50%.");
  });
});

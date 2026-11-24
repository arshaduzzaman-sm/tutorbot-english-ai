import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { PracticePlayer } from "./practice-player";

const post = vi.fn();
const get = vi.fn();
vi.mock("@/lib/client-api", () => ({ browserApi: async () => ({ POST: post, GET: get }) }));

const cat = { code: "x", name: "x", section: "listening" };
const base = { difficulty: "beginner", instructions: "Listen.", learningObjective: "", options: [], category: cat };
const hiw = { ...base, id: "h1", externalId: "hiw-1", categoryCode: "highlight_incorrect_words",
  content: { transcript: "I like green tea" } };
const wfd = { ...base, id: "w1", externalId: "wfd-1", categoryCode: "write_from_dictation", content: {} };

describe("Listening practice", () => {
  beforeEach(() => { post.mockReset(); get.mockReset(); });

  it("shows the transcript only in Learn mode and marks clicked words and dictation", async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: { external_id: "hiw-1", parts: ["I like red tea"], transcript: "I like red tea" } });
    post.mockResolvedValueOnce({ data: { score_ratio: 1, is_correct: true,
      correct_answer: { incorrect_words: [{ index: 2, word: "green", spoken: "red" }] }, parts: [], explanation: "e", note: "n" } });
    post.mockResolvedValueOnce({ data: { score_ratio: 0.5, is_correct: false, correct_answer: { reference_text: "Hi there." },
      parts: [], explanation: "e", note: "n" } });
    renderWithIntl(<PracticePlayer questions={[hiw, wfd]} />);

    await user.click(screen.getByRole("button", { name: "Show transcript" }));
    expect(await screen.findByTestId("transcript")).toHaveTextContent("I like red tea");
    await user.click(screen.getByRole("button", { name: "green" }));
    expect(screen.getByRole("button", { name: "green" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(post.mock.calls[0]?.[1].body.response).toEqual({ indices: [2] });
    expect(await screen.findByText("Correct answer: green → red")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next question" }));
    await user.click(screen.getByLabelText(/^Practice mode/));
    expect(screen.queryByRole("button", { name: "Show transcript" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Type the sentence you hear."), "Hi");
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(post.mock.calls[1]?.[1].body.response).toEqual({ text: "Hi" });
    expect(await screen.findByText("Correct answer: Hi there.")).toBeInTheDocument();
  });

  it("explains when the browser has no audio or voice", async () => {
    const user = userEvent.setup();
    renderWithIntl(<PracticePlayer questions={[wfd]} />);
    await user.click(screen.getByRole("button", { name: "Play audio" }));
    expect(await screen.findByText(/Your browser has no speech voice/)).toBeInTheDocument();
    expect(screen.getByText("Played once")).toBeInTheDocument();
  });
});

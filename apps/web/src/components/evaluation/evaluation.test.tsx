import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { WritingTask } from "@/components/writing/writing-task";
import type { EvalResult } from "@/lib/evaluations";
import { EvaluationView } from "./evaluation-view";

const post = vi.fn();
vi.mock("@/lib/client-api", () => ({ browserApi: async () => ({ POST: post, GET: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));

const result: EvalResult = {
  task_type: "write_essay",
  criteria: [
    { name: "content", band: "good", explanation: "You covered 2 of 3 main points.", signals: { ratio: 0.67 } },
    { name: "grammar_usage_mechanics", band: "needs_work", explanation: "5 grammar issue(s) found.", signals: { ratio: 0.2 } },
  ],
  errors: [{ type: "spelling", text: "recieve", correction: "receive", explanation: "Possible spelling mistake.", position: 3 }],
  strengths: [], weaknesses: [], recommendations: ["Check the spelling of every word."],
  flags: ["template_like"], feedback: "Demo mode: AI not connected.", provider: "mock",
  disclaimer: "Practice estimate. Not an official PTE score.",
};

describe("EvaluationView", () => {
  it("shows bands, errors, flags and the disclaimer, and never a 10-90 score", () => {
    renderWithIntl(<EvaluationView result={result} />);
    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("Needs work")).toBeInTheDocument();
    expect(screen.getByText("Grammar usage and mechanics")).toBeInTheDocument();
    expect(screen.getByText("recieve")).toBeInTheDocument();
    expect(screen.getByText(/memorised phrases/)).toBeInTheDocument();
    expect(screen.getByText(/Demo mode: AI not connected. These results/)).toBeInTheDocument();
    expect(screen.getByText("Practice estimate. Not an official PTE score.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(?:[1-8]\d|90)\/90\b|score: \d/i);
  });
});

describe("WritingTask", () => {
  it("counts words live and submits the text", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: { id: "e1", status: "queued", task_type: "summarize_written_text" } });
    const done = vi.fn();
    const q = { id: "q1", externalId: "swt-0001", categoryCode: "summarize_written_text", instructions: "Sum it up.", content: { passage: "Text." } };
    renderWithIntl(<WritingTask question={q} mode="learn" onSubmitted={done} />);
    expect(screen.getByTestId("word-count")).toHaveTextContent("0 words (the task asks for 5 to 75)");
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "Gardens help people but need volunteers.");
    expect(screen.getByTestId("word-count")).toHaveTextContent("6 words");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    expect(post.mock.calls[0]?.[1].body.text).toBe("Gardens help people but need volunteers.");
    expect(done).toHaveBeenCalledWith("e1");
  });
});

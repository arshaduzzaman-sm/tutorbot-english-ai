import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { Flashcards } from "./flashcards";

const post = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/client-api", () => ({ browserApi: async () => ({ POST: post, GET: vi.fn() }) }));

const words = [
  { id: "w1", externalId: "apple-noun", word: "apple", partOfSpeech: "noun", meaning: "a round fruit", example: "I eat an apple.", box: null, mastered: false },
  { id: "w2", externalId: "go-verb", word: "go", partOfSpeech: "verb", meaning: "move to another place", example: "We go home.", box: 2, mastered: false },
];

describe("Flashcards", () => {
  it("hides the meaning until asked, records known / not yet, and shows a summary", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: { box: 1, due_at: "2026-11-23T00:00:00Z", mastered: false } });
    renderWithIntl(<Flashcards words={words} />);
    expect(screen.getByRole("heading", { name: "apple" })).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByText("a round fruit")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show meaning" }));
    expect(screen.getByText("a round fruit")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I knew it" }));
    expect(post.mock.calls[0]?.[1]).toEqual({ params: { path: { word_id: "w1" } }, body: { known: true } });
    expect(await screen.findByRole("heading", { name: "go" })).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show meaning" }));
    await user.click(screen.getByRole("button", { name: "Not yet" }));
    expect(post.mock.calls[1]?.[1].body).toEqual({ known: false });
    expect(await screen.findByTestId("flashcards-done")).toHaveTextContent("You knew 1 of 2 words.");
  });
});

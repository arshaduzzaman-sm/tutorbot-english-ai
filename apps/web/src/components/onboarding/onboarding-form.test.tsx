import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { OnboardingForm } from "./onboarding-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));

const levels = [
  { code: 1, name: "Beginner English", cefr: "Pre-A1 to A1", description: "Start here" },
  { code: 4, name: "PTE Preparation", cefr: "B2", description: "Exam skills" },
];

describe("OnboardingForm", () => {
  it("asks for a level before moving on, then validates the target score", async () => {
    const user = userEvent.setup();
    renderWithIntl(<OnboardingForm levels={levels} initial={{ levelCode: null, targetScore: null, examDate: null, dailyGoalMinutes: 30 }} />);
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please choose a level.");

    await user.click(screen.getByLabelText(/PTE Preparation/));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();

    await user.type(screen.getByLabelText("What PTE score are you aiming for?"), "95");
    await user.click(screen.getByRole("button", { name: "Save and go to my dashboard" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a score from 10 to 90.");
  });
});

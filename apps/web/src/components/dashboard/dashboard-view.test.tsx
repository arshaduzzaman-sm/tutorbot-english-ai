import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/render";
import { DashboardView, type DashboardData } from "./dashboard-view";

const empty: DashboardData = {
  id: "u1",
  email: "new@example.test",
  demoMode: true,
  profile: {
    displayName: "Rina",
    targetScore: 79,
    examDate: null,
    dailyGoalMinutes: 30,
    onboardingCompleted: true,
    level: { code: 4, name: "PTE Preparation", cefr: "B2" },
  },
  progress: {
    lessonsCompleted: 0,
    lessonsTotal: 5,
    overallRatio: 0,
    skills: (["SPEAKING", "WRITING", "READING", "LISTENING"] as const).map((skill) => ({ skill, attempts: 0, accuracy: null })),
  },
  streakDays: 0,
  todayMinutes: 0,
  reviewDueCount: 0, vocabularyDueCount: 0,
  studyPlan: null,
  recentAttempts: [],
  recommendedLessons: [],
  weakAreas: [],
  mockExams: [],
  coach: { recommendations: [{ kind: "practice", reason: "not_tried", categoryCode: "read_aloud", difficulty: "intermediate" }] },
  typeNames: { read_aloud: "Read Aloud" },
};

describe("DashboardView", () => {
  it("shows next steps from the coach", () => {
    renderWithIntl(<DashboardView data={empty} />);
    expect(screen.getByText("Read Aloud")).toBeInTheDocument();
    expect(screen.getByText("You have not tried this question type yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start: Read Aloud" })).toHaveAttribute("href", "/practice/read_aloud?adaptive=1");
  });

  it("shows friendly empty states and no fake numbers for a new user", () => {
    renderWithIntl(<DashboardView data={empty} />);
    expect(screen.getByRole("heading", { name: "Welcome, Rina!" })).toBeInTheDocument();
    expect(screen.getByTestId("level-name")).toHaveTextContent("PTE Preparation");
    expect(screen.getByTestId("target-score")).toHaveTextContent("79");
    expect(screen.getByTestId("streak")).toHaveTextContent("Start today!");
    expect(screen.getByTestId("recent-empty")).toBeInTheDocument();
    expect(screen.getAllByText("No practice yet")).toHaveLength(4);
    expect(screen.getByText(/Practise a few questions/)).toBeInTheDocument();
    expect(screen.getByText(/No mock exams yet/)).toBeInTheDocument();
    expect(screen.getByTestId("demo-banner")).toHaveTextContent("Demo mode: AI not connected");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("renders real values from the API", () => {
    renderWithIntl(
      <DashboardView
        data={{
          ...empty,
          demoMode: false,
          streakDays: 3,
          todayMinutes: 12,
          progress: {
            ...empty.progress,
            lessonsCompleted: 2,
            overallRatio: 0.4,
            skills: [{ skill: "READING", attempts: 4, accuracy: 0.75 }, ...empty.progress.skills.slice(1)],
          },
          recentAttempts: [
            { id: "a1", createdAt: "2026-11-22T10:00:00Z", isCorrect: false, scoreRatio: null, category: { code: "reorder_paragraphs", name: "Reorder Paragraphs" } },
          ],
          weakAreas: [{ accuracy: 0.33, attempts: 3, category: { code: "reorder_paragraphs", name: "Reorder Paragraphs" } }],
        }}
      />,
    );
    expect(screen.getByTestId("streak")).toHaveTextContent("3 days");
    expect(screen.getByText("12 of 30 minutes")).toBeInTheDocument();
    expect(screen.getByTestId("lessons-progress")).toHaveTextContent("2 / 5");
    expect(screen.getByText(/75% correct/)).toBeInTheDocument();
    expect(screen.getByText("33% correct")).toBeInTheDocument();
    expect(screen.getByText("Not correct")).toBeInTheDocument();
    expect(screen.queryByTestId("demo-banner")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Lessons completed" })).toHaveAttribute("aria-valuenow", "40");
  });
});

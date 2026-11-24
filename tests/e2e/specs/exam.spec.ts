import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

/** Completes the shortened test blueprint (e2e_short) in Exam mode, end to end. */
test("a shortened mock exam can be completed in Exam mode, resumed after refresh, and reported", async ({ page, request }) => {
  await newLearner(page, request, /3\. Intermediate English/);
  await page.goto("/exams");
  await expect(page.getByRole("button", { name: "Start: Full mock exam" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // The shortened test blueprint is not listed; start it by its code.
  await page.goto("/exams/start?code=e2e_short");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/exams\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("exam-counter")).toHaveText("Question 1 of 5");
  await expect(page.getByTestId("read-text")).toBeVisible();
  await page.getByRole("button", { name: "Skip this question" }).click();

  // Writing item with the published 10-minute timer
  await expect(page.getByTestId("exam-counter")).toHaveText("Question 2 of 5");
  await expect(page.getByText(/Time left: 9:5\d|Time left: 10:00/)).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer" }).fill("Shared bikes are cheap and popular, but some cities now need parking zones.");
  await page.getByRole("button", { name: "Get feedback" }).click();

  // Reading section has a clock; refresh resumes at the same question
  await expect(page.getByTestId("exam-counter")).toHaveText("Question 3 of 5");
  await expect(page.getByRole("timer", { name: "Time left in this section" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("exam-counter")).toHaveText("Question 3 of 5");
  for (const n of [3, 4]) {
    await expect(page.getByTestId("exam-counter")).toHaveText(`Question ${n} of 5`);
    const radio = page.getByRole("radio").first();
    if (await radio.count()) await radio.check();
    await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByTestId("exam-counter")).toHaveText("Question 5 of 5");
  await page.getByRole("textbox").fill("students must return their books");
  await page.getByRole("button", { name: "Next" }).click();

  const report = page.getByTestId("exam-report");
  await expect(report).toBeVisible();
  await expect(report.getByText("By question type")).toBeVisible();
  await expect(report).toContainText("Practice estimate. Not an official PTE score.", { timeout: 30_000 });
  await expect(report.getByText(/still being evaluated/)).toHaveCount(0, { timeout: 30_000 });
  await expect(report.getByRole("rowheader", { name: "Summarize Written Text" })).toBeVisible();
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

test("learner takes the placement test, gets a level and a plan, and sees the plan on the dashboard", async ({ page, request }) => {
  await newLearner(page, request, /4\. PTE Preparation/);
  await expect(page.getByTestId("plan-empty")).toBeVisible();
  await page.getByRole("link", { name: "Take the placement test" }).click();
  await expect(page).toHaveURL(/\/placement$/);
  await page.getByRole("button", { name: "Start the placement test" }).click();

  // Q1 (Level 1 reading): right answer; then "I don't know" for the rest
  await page.getByLabel(/Ten/).check();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: /Question 2 of 18/ })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  for (let i = 2; i <= 18; i++) await page.getByRole("button", { name: "I don't know" }).click();

  const result = page.getByTestId("placement-result");
  await expect(result).toContainText("We suggest you start at Level 1: Beginner English.");
  await expect(result).toContainText("You answered 1 of 18 questions correctly.");
  await expect(result).toContainText("Not an official PTE score");
  await expect(page.getByTestId("study-plan")).toContainText("lessons at Level 1");

  await page.getByRole("link", { name: "Go to my dashboard" }).click();
  await expect(page.getByTestId("level-name")).toHaveText("Beginner English");
  await expect(page.getByTestId("study-plan")).toContainText("review your mistakes");
});

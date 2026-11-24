import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

test("learner opens a lesson, steps through Learn/See/Try/Check, and the dashboard counts it", async ({ page, request }) => {
  await newLearner(page, request, /1\. Beginner English/);
  await expect(page.getByTestId("lessons-progress")).toHaveText(/^0 \/ \d+$/);

  await page.getByRole("link", { name: "See all lessons" }).click();
  await expect(page).toHaveURL(/\/lessons$/);
  await page.getByRole("link", { name: /The English alphabet/ }).first().click();
  await expect(page).toHaveURL(/\/lessons\/the-alphabet$/);
  await expect(page.getByRole("heading", { level: 1, name: "The English alphabet" })).toBeVisible();

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("button", { name: /^Next/ }).click(); // See
  await page.getByRole("button", { name: /^Next/ }).click(); // Try
  await page.getByLabel("b", { exact: true }).check();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByText("Not quite. The answer is: e")).toBeVisible();

  await page.getByRole("button", { name: /^Next/ }).click(); // Check
  // Wrong first time: one of two correct is 50%, below the 80% pass mark
  await page.getByLabel("26", { exact: true }).check();
  await page.getByLabel("my name is ali.", { exact: true }).check();
  await page.getByRole("button", { name: "Submit my answers" }).click();
  await expect(page.getByTestId("check-outcome")).toContainText("You need 80%");

  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByLabel("26", { exact: true }).check();
  await page.getByLabel("My name is Ali.", { exact: true }).check();
  await page.getByRole("button", { name: "Submit my answers" }).click();
  await expect(page.getByTestId("check-outcome")).toContainText("This lesson is complete.");

  await page.getByRole("link", { name: "Go to my dashboard" }).click();
  await expect(page.getByTestId("lessons-progress")).toHaveText(/^1 \/ \d+$/);
});

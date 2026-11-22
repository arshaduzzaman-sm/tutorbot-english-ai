import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

test("a wrong answer goes into the mistake notebook and comes back in spaced review", async ({ page, request }) => {
  await newLearner(page, request, /4\. PTE Preparation/);
  await expect(page.getByTestId("review-due")).toHaveText("Nothing due");

  await page.goto("/practice/reading_mc_single");
  await page.getByLabel(/^A\./).check();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByTestId("notebook-note")).toHaveText("This question is saved in your mistake notebook for review.");

  await page.goto("/dashboard");
  await expect(page.getByTestId("review-due")).toHaveText("1 mistake to review");
  await page.getByRole("link", { name: "Open my mistake notebook" }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByTestId("review-due-count")).toHaveText("1 mistake is ready to review.");
  await expect(page.getByTestId("review-list")).toContainText("Step 0 of 5");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByRole("group", { name: "Mode" })).toHaveCount(0);
  await page.getByLabel(/^B\./).check();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByTestId("notebook-note")).toHaveText("Mistake notebook updated.");

  await page.reload();
  await expect(page.getByTestId("review-due-count")).toHaveText("Nothing is due right now. Well done!");
  await expect(page.getByTestId("review-list")).toContainText("Step 1 of 5");
  await expect(page.getByTestId("review-list")).toContainText("Next review:");
});

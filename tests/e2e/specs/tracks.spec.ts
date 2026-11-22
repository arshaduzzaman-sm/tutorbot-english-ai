import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test("vocabulary flashcards record known words and missed words", async ({ page, request }) => {
  await newLearner(page, request, /1\. Beginner English/);
  await page.getByRole("link", { name: "Vocabulary flashcards" }).click();
  await expect(page).toHaveURL(/\/vocabulary$/);
  await expect(page.getByTestId("vocab-due")).toHaveText("No words are due for review right now.");
  await expect(page.getByRole("link", { name: "Starter words 1", exact: true })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("link", { name: "Starter words 1", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "apple" })).toBeVisible();
  await page.getByRole("button", { name: "Show meaning" }).click();
  await expect(page.getByTestId("flashcard-back")).toContainText("a round fruit");
  await page.getByRole("button", { name: "I knew it" }).click();
  await page.getByRole("button", { name: "Show meaning" }).click();
  await page.getByRole("button", { name: "Not yet" }).click();
  await expect(page.getByTestId("flashcard")).toContainText("Card 3 of 26");
  await page.goto("/vocabulary");
  await expect(page.getByText("2 of 26 practised · 0 mastered")).toBeVisible();
});

test("pronunciation drill is marked and saves the best score", async ({ page, request }) => {
  await newLearner(page, request, /1\. Beginner English/);
  await page.goto("/pronunciation");
  await expect(page.getByRole("heading", { name: "Vowels", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Intonation" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.goto("/pronunciation/word-stress");
  await expect(page.getByRole("heading", { level: 1, name: "Word stress" })).toBeVisible();
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(page.getByText("Please answer every item.")).toBeVisible();
  const items = page.getByTestId("drill-item");
  const n = await items.count();
  for (let i = 0; i < n; i++) await items.nth(i).getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(page.getByTestId("drill-outcome")).toContainText("You scored");
  await page.goto("/pronunciation");
  await expect(page.getByRole("listitem").filter({ hasText: "Word stress" })).toContainText("Best score:");
});

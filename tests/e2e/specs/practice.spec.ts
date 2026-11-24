import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

test("learner practises reading tasks with instant marking, and the hub shows their results", async ({ page, request }) => {
  await newLearner(page, request, /4\. PTE Preparation/);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Practice" }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole("region", { name: "Reading" }).getByRole("link", { name: /^Practise: / })).toHaveCount(5);

  // Reading & Writing: Fill in the Blanks, Learn mode
  await page.getByRole("link", { name: "Practise: Reading & Writing: Fill in the Blanks" }).click();
  await expect(page.getByText(/Tip: Choose words/)).toBeVisible();
  await page.getByLabel("Blank 1").selectOption("mind");
  await page.getByLabel("Blank 2").selectOption("slept");
  await page.getByRole("button", { name: "Check my answer" }).click();
  const outcome = page.getByTestId("practice-outcome");
  await expect(outcome).toContainText("You scored 50%.");
  await expect(outcome).toContainText("Correct answer: (1) mind, (2) sleep");
  await expect(outcome).toContainText("not an official PTE score");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // Reorder Paragraphs with the keyboard-friendly buttons, Practice mode
  await page.getByRole("link", { name: "Back to practice" }).click();
  await page.getByRole("link", { name: "Practise: Reorder Paragraphs" }).click();
  await page.getByLabel(/^Practice mode/).check();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: /^Move down: Finally/ }).click();
  await page.getByRole("button", { name: /^Move down: Finally/ }).click();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByTestId("practice-outcome")).toContainText("All correct! You scored 100%.");

  await page.goto("/practice");
  const rwfib = page.getByRole("listitem").filter({ hasText: "Reading & Writing: Fill in the Blanks" });
  await expect(rwfib).toContainText("Tried once");
  await expect(rwfib).toContainText("Your average: 50%");
});

test("learner practises listening tasks; the transcript is shown in Learn mode only", async ({ page, request }) => {
  await newLearner(page, request, /4\. PTE Preparation/);
  await page.goto("/practice");
  await expect(page.getByRole("region", { name: "Listening" }).getByRole("link", { name: /^Practise: / })).toHaveCount(8);

  await page.getByRole("link", { name: "Practise: Write From Dictation" }).click();
  await page.getByRole("button", { name: "Show transcript" }).click();
  await expect(page.getByTestId("transcript")).toHaveText("The lecture will start in the main hall.");
  await page.getByLabel("Type the sentence you hear.").fill("The lecture will start in the main hall");
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByTestId("practice-outcome")).toContainText("All correct! You scored 100%.");

  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByLabel(/^Practice mode/).check();
  await expect(page.getByRole("button", { name: "Show transcript" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play audio" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("link", { name: "Back to practice" }).click();
  await page.getByRole("link", { name: "Practise: Highlight Incorrect Words" }).click();
  await page.getByRole("button", { name: "history", exact: true }).click();
  await page.getByRole("button", { name: "small", exact: true }).click();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByTestId("practice-outcome")).toContainText("history → science, small → large");
});

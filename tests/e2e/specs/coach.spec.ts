import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test("progress page: coaching and charts follow the learner's own answers, with data tables", async ({ page, request }) => {
  await newLearner(page, request, /4\. PTE Preparation/);
  await page.goto("/progress");
  await expect(page.getByTestId("analytics-empty")).toBeVisible();
  await expect(page.getByTestId("readiness")).toContainText("Not enough practice yet");
  await expect(page.getByTestId("recommendations")).toContainText("You have not tried this question type yet.");

  // One half-right answer
  await page.goto("/practice/rw_fill_blanks");
  await page.getByLabel("Learn mode").check();
  await page.getByLabel("Blank 1").selectOption("mind");
  await page.getByLabel("Blank 2").selectOption("slept");
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByTestId("practice-outcome")).toContainText("You scored 50%.");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My progress" }).click();
  await expect(page).toHaveURL(/\/progress$/);
  const summary = page.getByTestId("analytics-summary");
  await expect(summary).toContainText("Questions answered1");
  await expect(summary).toContainText("Accuracy50%");
  await expect(page.getByTestId("weekly")).toContainText("1 question on 1 day");
  const byType = page.getByTestId("chart-by-type");
  await byType.getByText("Show the data as a table").click();
  await expect(byType.getByRole("row", { name: /Reading & Writing: Fill in the Blanks/ })).toContainText("50%");
  await expect(page.getByRole("img", { name: /Reading & Writing: Fill in the Blanks 50%/ })).toBeVisible();
  await expect(page.getByText("Not an official PTE score", { exact: false }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("/90");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report (CSV)" }).click();
  expect((await download).suggestedFilename()).toBe("tutorbot-progress.csv");

  await page.getByRole("link", { name: "7 days" }).click();
  await expect(page.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "page");
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your next steps" })).toBeVisible();
});

test("the tutor answers English questions, refuses off-topic ones and keeps the chat", async ({ page, request }) => {
  await newLearner(page, request, /2\. Elementary English/);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Tutor" }).click();
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await expect(page.getByText("Elementary English · CEFR A2")).toBeVisible();
  const input = page.getByLabel("Your question");
  await input.fill("What is the difference between 'affect' and 'effect'?");
  await page.getByRole("button", { name: "Send" }).click();
  const chat = page.getByTestId("tutor-messages");
  await expect(chat).toContainText("Demo mode: AI not connected");
  await expect(page.getByTestId("tutor-remaining")).toContainText("59 messages left today");

  await input.fill("Who won the football match?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(chat).toContainText("I can help with English and PTE practice only.");
  await expect(page.getByTestId("tutor-remaining")).toContainText("59 messages left today");

  await page.reload();
  await expect(chat.getByRole("listitem")).toHaveCount(4);
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Clear chat" }).click();
  await expect(chat).toContainText("No messages yet.");
});

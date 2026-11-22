import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const SUMMARY =
  "Community gardens improve access to fresh food and bring neighbours together, but their reliance on volunteers and temporary land agreements often makes them hard to sustain.";

test("a writing task returns a structured evaluation with bands only", async ({ page, request }) => {
  await newLearner(page, request, /3\. Intermediate English/);
  await page.goto("/practice");
  await page.getByRole("link", { name: "Practise: Summarize Written Text" }).click();
  await page.getByLabel("Learn mode").check();
  await page.getByRole("textbox", { name: "Your answer" }).fill(SUMMARY);
  await expect(page.getByTestId("word-count")).toContainText("26 words");
  await page.getByRole("button", { name: "Get feedback" }).click();
  const result = page.getByTestId("evaluation-result");
  await expect(result).toBeVisible({ timeout: 20_000 });
  await expect(result.getByText("Form", { exact: true })).toBeVisible();
  await expect(result).toContainText("Practice estimate. Not an official PTE score.");
  await expect(result).toContainText("Demo mode: AI not connected");
  await expect(result).not.toContainText("/90");
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("a speaking task asks for consent, records with the microphone and is evaluated", async ({ page, request }) => {
  await newLearner(page, request, /3\. Intermediate English/);
  await page.goto("/practice/read_aloud");
  await expect(page.getByTestId("recording-consent")).toBeVisible();
  await page.getByRole("button", { name: "I agree, let me record" }).click();
  await page.getByLabel("Learn mode").check();
  await expect(page.getByTestId("read-text")).toBeVisible();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByText("Recording…")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: "Get feedback" }).click();
  const result = page.getByTestId("evaluation-result");
  await expect(result).toBeVisible({ timeout: 20_000 });
  await expect(result.getByText("Oral fluency")).toBeVisible();
  await expect(page.getByTestId("eval-transcript")).toHaveText("this is a mock transcript");
});

test("the academy explains every task type with examples and sources", async ({ page, request }) => {
  await newLearner(page, request, /3\. Intermediate English/);
  await page.goto("/academy");
  await expect(page.getByRole("link", { name: /Respond to a Situation/ })).toBeVisible();
  await expect(page.locator("ul li a")).toHaveCount(22);
  await page.getByRole("link", { name: /Write Essay/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Write Essay" })).toBeVisible();
  await expect(page.getByText("200-300 words")).toBeVisible();
  await expect(page.getByText("Development, structure and coherence")).toBeVisible();
  await expect(page.getByRole("heading", { name: "A strong answer" })).toBeVisible();
  await expect(page.getByRole("link", { name: /pearsonpte\.com/ })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("a timed drill gives feedback at the end", async ({ page, request }) => {
  await newLearner(page, request, /3\. Intermediate English/);
  await page.goto("/practice/reading_mc_single/drill");
  await page.getByRole("button", { name: "5 questions", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await expect(page.getByRole("progressbar", { name: `Question ${i + 1} of 5` })).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByTestId("drill-done")).toContainText("You answered 5 questions");
});

test("the profile page turns voice recording consent on and off", async ({ page, request }) => {
  await newLearner(page, request, /3\. Intermediate English/);
  await page.goto("/profile");
  const state = page.getByTestId("recording-consent-state");
  await expect(state).toContainText("Voice recordings are off");
  await page.getByRole("button", { name: "Allow recordings" }).click();
  await expect(state).toContainText("You have agreed to voice recordings.");
  await page.reload();
  await expect(state).toContainText("You have agreed to voice recordings.");
  await page.getByRole("button", { name: "Stop recordings" }).click();
  await expect(state).toContainText("Voice recordings are off");
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

const RIGHT = ["o", "h", "I live in London.", "Good night", "name"];

test("passing the end-of-unit test opens the next unit", async ({ page, request }) => {
  await newLearner(page, request, /1\. Beginner English/);
  await page.goto("/lessons");
  const unit2 = page.getByTestId("unit-l1-u2-words-and-sentences");
  await expect(unit2).toContainText("Locked");
  await expect(unit2.getByRole("link")).toHaveCount(0);
  await page.goto("/lessons/pronouns");
  await expect(page.getByText("This lesson is in a locked unit.")).toBeVisible();

  await page.goto("/lessons");
  await page.getByTestId("unit-l1-u1-first-steps").getByRole("link", { name: "Take the end-of-unit test" }).click();
  await expect(page).toHaveURL(/\/units\/l1-u1-first-steps\/test$/);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  for (const [i, answer] of RIGHT.entries()) {
    await page.getByRole("group", { name: new RegExp(`^Question ${i + 1}:`) }).getByLabel(answer, { exact: true }).check();
  }
  await page.getByRole("button", { name: "Submit my answers" }).click();
  await expect(page.getByTestId("unit-outcome")).toContainText("You scored 100%.");
  await expect(page.getByTestId("unit-outcome")).toContainText("You passed! The next unit is open.");

  await page.getByRole("link", { name: "Go to the next unit" }).click();
  await expect(unit2).not.toContainText("Locked");
  await expect(page.getByTestId("unit-l1-u1-first-steps")).toContainText("Passed");
  await unit2.getByRole("link", { name: /Start: Pronouns/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pronouns" })).toBeVisible();
});

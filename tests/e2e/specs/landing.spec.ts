import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const HERO =
  "Free practice and AI feedback to help you improve your English and prepare for PTE Academic. Your results depend on your study and practice.";
const DISCLAIMER =
  "PTE Master AI is an independent learning platform. It is not affiliated with, endorsed by, or sponsored by Pearson. PTE and PTE Academic are trademarks of Pearson.";

test("landing page shows hero message, Start Learning and Pearson disclaimer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("hero-message")).toHaveText(HERO);
  await expect(page.getByRole("link", { name: "Start Learning" })).toBeVisible();
  await expect(page.getByTestId("pearson-disclaimer")).toHaveText(DISCLAIMER);
});

test("landing page has no automated accessibility violations (axe, WCAG 2.2 AA)", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("landing page is responsive with no horizontal scrolling", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: "Start Learning" })).toBeInViewport();
});

for (const path of ["/login", "/register", "/privacy", "/terms", "/about"]) {
  test(`${path} passes axe`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await expect(page.getByTestId("pearson-disclaimer")).toBeVisible();
  });
}

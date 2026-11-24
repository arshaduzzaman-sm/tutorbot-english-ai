import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login, newLearner } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const grant = (email: string, role: string) =>
  execFileSync("bash", [fileURLToPath(new URL("../../../scripts/grant-role.sh", import.meta.url)), email, role], {
    encoding: "utf8",
  });

test("learners cannot open the admin area", async ({ page, request }) => {
  await newLearner(page, request, /3\. Intermediate English/);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: "Open the admin area" })).toHaveCount(0);
});

test("a learner reports a problem; an admin reviews content and manages mock exams", async ({ page, request, browser }) => {
  // A learner reports a question
  const note = `e2e ${Date.now()}: the second paragraph is confusing`;
  await newLearner(page, request, /4\. PTE Preparation/);
  await page.goto("/practice/reorder_paragraphs");
  await page.getByRole("button", { name: "Check my answer" }).click();
  await page.getByRole("button", { name: "Report a problem" }).click();
  await page.getByLabel("What is wrong?").selectOption("unclear");
  await page.getByLabel("Details (optional)").fill(note);
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Thank you. The content team will check this question.")).toBeVisible();

  // An admin sees and resolves it
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  const { email, password } = await newLearner(admin, request, /5\. Advanced PTE Preparation/, "Ada");
  expect(grant(email, "admin")).toContain("now has the admin role");
  await login(admin, email, password);
  await admin.goto("/profile");
  await admin.getByRole("link", { name: "Open the admin area" }).click();
  await expect(admin.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();
  await expect(admin.getByTestId("usage")).toContainText("accounts");
  expect((await new AxeBuilder({ page: admin }).withTags(WCAG).analyze()).violations.map((v) => v.id)).toEqual([]);

  await admin.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Reports" }).click();
  const report = admin.getByTestId("report-list").getByRole("listitem").filter({ hasText: note });
  await expect(report).toContainText("The question is unclear");
  await report.getByRole("link").click();
  await expect(admin.getByTestId("question-status")).toHaveText("Published");
  expect((await new AxeBuilder({ page: admin }).withTags(WCAG).analyze()).violations.map((v) => v.id)).toEqual([]);
  await admin.goBack();
  await report.getByRole("button", { name: "Mark fixed" }).click();
  await expect(report).toHaveCount(0);

  // Upload an AI draft: it cannot be published until another staff member approves it
  await admin.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Upload" }).click();
  const ext = `e2e-ai-${Date.now()}`;
  await admin.getByLabel("Content file (.json)").setInputFiles({
    name: "ai.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ questions: [{
      external_id: ext, category: "reading_mc_single", difficulty: "beginner",
      instructions: "Read the text and choose the best answer.",
      content: { text: "Mia takes the train because it is faster than the bus.", question: "Why does Mia take the train?" },
      options: [
        { label: "A", body: "It is faster.", is_correct: true },
        { label: "B", body: "It is cheaper.", is_correct: false },
        { label: "C", body: "She likes trains.", is_correct: false },
      ],
      answer: { correct: ["A"] }, explanation: "The text says it is faster.", learning_objective: "Find a stated reason.",
    }] })),
  });
  await admin.getByLabel("Drafted with AI (needs a human approval)").check();
  await admin.getByRole("button", { name: "Upload" }).click();
  await expect(admin.getByTestId("upload-result")).toContainText("1 question added as AI draft.");
  await admin.goto(`/admin/content?q=${ext}`);
  await admin.getByRole("link", { name: ext }).click();
  await admin.getByRole("button", { name: "Publish" }).click();
  await expect(admin.getByTestId("editor-message")).toContainText("must approve this version");
  await admin.getByRole("button", { name: "Approve this version" }).click();
  await expect(admin.getByTestId("editor-message")).toContainText("different staff member");
  await expect(admin.getByTestId("question-status")).toHaveText("AI draft");

  // Mock exams: hide and show again
  await admin.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Mock exams" }).click();
  const row = admin.getByTestId("blueprint-table").getByRole("row", { name: /Mini mock/ });
  await row.getByRole("button", { name: /Hide from learners/ }).click();
  await expect(row.getByRole("button", { name: /Show to learners/ })).toBeVisible();
  await row.getByRole("button", { name: /Show to learners/ }).click();
  await expect(row.getByRole("button", { name: /Hide from learners/ })).toBeVisible();
  expect((await new AxeBuilder({ page: admin }).withTags(WCAG).analyze()).violations.map((v) => v.id)).toEqual([]);
  await ctx.close();
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { dismissCookies, linkFromEmail, login, uniqueEmail } from "./helpers";

test("protected pages redirect logged-out users to login", async ({ page }) => {
  for (const path of ["/dashboard", "/onboarding", "/profile"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
  }
});

test("register validation explains problems in simple English", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Please enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Your password needs at least 8 characters.")).toBeVisible();
  await expect(page.getByText("You must be 16 or older to use PTE Master AI.")).toBeVisible();
});

test("register → verify email → onboarding → dashboard → logout → login → reset password", async ({ page, request }) => {
  const email = uniqueEmail();
  const password = "Learner-pass-123";
  const newPassword = "Learner-pass-456";

  // Register
  await page.goto("/register");
  await dismissCookies(page);
  await page.getByLabel("Your name").fill("Rina");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("I am 16 years old or older.").check();
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/check-email/);

  // Login is blocked until the email is confirmed
  await login(page, email, password);
  await expect(page.getByText("Please confirm your email first.")).toBeVisible();

  // Verify through the local mail viewer (Mailpit)
  const confirmLink = await linkFromEmail(request, email, "Confirm your PTE Master AI account");
  await page.goto(confirmLink);
  await expect(page).toHaveURL(/\/onboarding/);

  // Onboarding: level + target
  await page.getByLabel(/4\. PTE Preparation/).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("What PTE score are you aiming for?").fill("79");
  await page.getByLabel("60 minutes").check();
  await page.getByRole("button", { name: "Save and go to my dashboard" }).click();

  // Dashboard shows the saved data and empty states
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Welcome, Rina!" })).toBeVisible();
  await expect(page.getByTestId("level-name")).toHaveText("PTE Preparation");
  await expect(page.getByTestId("target-score")).toHaveText("79");
  await expect(page.getByTestId("streak")).toHaveText("Start today!");
  await expect(page.getByTestId("lessons-progress")).toHaveText(/^0 \/ \d+$/);
  await expect(page.getByTestId("recent-empty")).toBeVisible();
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // Logout
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  // Login again
  await login(page, email, password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "Log out" }).click();

  // Reset password
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/a reset link is on its way/)).toBeVisible();
  const resetLink = await linkFromEmail(request, email, "Reset your PTE Master AI password");
  await page.goto(resetLink);
  await expect(page).toHaveURL(/\/reset-password/);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Your password has been changed.")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();

  // Old password fails, new one works
  await login(page, email, password);
  await expect(page.getByText("Email or password is not correct.")).toBeVisible();
  await login(page, email, newPassword);
  await expect(page).toHaveURL(/\/dashboard/);

  // Clean up: delete the account from the profile page
  await page.goto("/profile");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/login\?notice=deleted/);
  await login(page, email, newPassword);
  await expect(page.getByText("Email or password is not correct.")).toBeVisible();
});

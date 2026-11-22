import { expect, type APIRequestContext, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Waits for an email to `to` whose subject contains `subject`, and returns the /auth/confirm link in it. */
export async function linkFromEmail(request: APIRequestContext, to: string, subject: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
        const list = (await res.json()) as { messages: { ID: string; Subject: string }[] };
        const msg = list.messages.find((m) => m.Subject.includes(subject));
        if (!msg) return false;
        const full = (await (await request.get(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { HTML: string };
        const match = full.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
        link = match?.[1]?.replace(/&amp;/g, "&");
        return Boolean(link);
      },
      { timeout: 20_000, message: `email "${subject}" to ${to}` },
    )
    .toBe(true);
  return link!;
}

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function dismissCookies(page: Page) {
  const ok = page.getByRole("region", { name: "Cookie notice" }).getByRole("button", { name: "OK" });
  if (await ok.isVisible().catch(() => false)) await ok.click();
}

/** Registers, confirms and onboards a new learner at `level` (e.g. "1. Beginner English"). Ends on /dashboard. */
export async function newLearner(page: Page, request: APIRequestContext, level: RegExp, name = "Sam") {
  const email = uniqueEmail();
  const password = "Learner-pass-123";
  await page.goto("/register");
  await dismissCookies(page);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("I am 16 years old or older.").check();
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/check-email/);
  await page.goto(await linkFromEmail(request, email, "Confirm your TutorBot English AI account"));
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel(level).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("What PTE score are you aiming for?").fill("50");
  await page.getByRole("button", { name: "Save and go to my dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return { email, password };
}

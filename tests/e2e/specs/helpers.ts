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

import { expect, test } from "@playwright/test";

test("home page is in Russian under a strict nonce-based CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      violations.push(message.text());
    }
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Inspecto" })).toBeVisible();
  await expect(page.getByText("Осмотр и приёмка недвижимости")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");

  const policy = response?.headers()["content-security-policy"] ?? "";
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(policy).not.toContain("unsafe-inline");
  // Every script of the page carries the nonce of this response.
  const scripts = await page
    .locator("script")
    .evaluateAll((elements) => elements.map((element) => (element as HTMLScriptElement).nonce));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((value) => value === nonce)).toBe(true);
  expect(violations).toEqual([]);
});

test("a second visit gets another nonce", async ({ request }) => {
  const first = (await request.get("/")).headers()["content-security-policy"];
  const second = (await request.get("/")).headers()["content-security-policy"];
  expect(first).not.toEqual(second);
});

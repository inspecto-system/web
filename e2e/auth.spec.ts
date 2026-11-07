import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Sign-in flow in the browser under the production CSP. The API is faked at the network level
 * (the CI job of this repository has no backend); the real one is checked behind nginx in platform.
 */
const user = {
  id: "0190f0c8-0000-7000-8000-000000000001",
  email: "anna@example.com",
  fullName: "Анна Инспектор",
  role: "INSPECTOR",
  locale: "ru",
  createdAt: "2026-11-01T10:00:00Z",
  version: 0,
};
const property = {
  id: "0190f0c8-0000-7000-8000-000000000002",
  name: "Квартира на Мира",
  type: "APARTMENT",
  address: "ул. Мира, 5",
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
  version: 0,
};

/** Fake API with a server-side session: the refresh cookie is valid after a successful sign-in. */
async function fakeApi(page: Page) {
  let signedIn = false;
  const calls: string[] = [];
  const reply = (route: Route, status: number, body?: unknown) =>
    route.fulfill({
      status,
      contentType: status >= 400 ? "application/problem+json" : "application/json",
      body: body === undefined ? "" : JSON.stringify(body),
    });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    calls.push(`${request.method()} ${path}`);
    const token = { accessToken: "access", tokenType: "Bearer", expiresIn: 900 };
    switch (`${request.method()} ${path}`) {
      case "POST /auth/refresh":
        if (request.headers()["x-csrf-protection"] !== "1") return reply(route, 403, { code: "FORBIDDEN" });
        return signedIn ? reply(route, 200, token) : reply(route, 401, { code: "UNAUTHENTICATED" });
      case "POST /auth/login": {
        const body = request.postDataJSON() as { password: string; client: string };
        if (body.password !== "Kitchen-Window-Crack-42" || body.client !== "web") {
          return reply(route, 401, { status: 401, code: "INVALID_CREDENTIALS" });
        }
        signedIn = true;
        return reply(route, 200, token);
      }
      case "POST /auth/logout":
        signedIn = false;
        return reply(route, 204);
      case "GET /users/me":
      case "GET /properties": {
        if (request.headers()["authorization"] !== "Bearer access") return reply(route, 401, {});
        return path === "/users/me"
          ? reply(route, 200, user)
          : reply(route, 200, { items: [property], page: 0, size: 100, totalElements: 1, totalPages: 1 });
      }
      default:
        return reply(route, 404, { code: "NOT_FOUND" });
    }
  });
  return calls;
}

function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  return violations;
}

test("a visitor signs in, sees the properties, keeps the session after a reload and signs out", async ({
  page,
}) => {
  const violations = watchCsp(page);
  await fakeApi(page);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill("anna@example.com");
  await page.getByLabel("Пароль").fill("wrong-password-1");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный email или пароль")).toBeVisible();

  await page.getByLabel("Пароль").fill("Kitchen-Window-Crack-42");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Квартира на Мира")).toBeVisible();
  await expect(page.getByTestId("current-user")).toHaveText("Анна Инспектор");

  // The access token was only in memory: after a reload the session comes back from the cookie.
  await page.reload();
  await expect(page.getByText("Квартира на Мира")).toBeVisible();

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(violations).toEqual([]);
});

test("registration form explains a short password without calling the API", async ({ page }) => {
  const calls = await fakeApi(page);
  await page.goto("/register");
  await page.getByLabel("Имя и фамилия").fill("Анна");
  await page.getByLabel("Email").fill("anna@example.com");
  await page.getByLabel("Пароль").fill("short");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();

  await expect(page.getByText("Пароль должен быть не короче 10 символов")).toBeVisible();
  expect(calls).not.toContain("POST /auth/register");
});

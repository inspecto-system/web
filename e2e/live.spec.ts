import { expect, test } from "@playwright/test";

/**
 * Against the real stack behind nginx (platform/deploy, profile "apps"): registration, the refresh
 * cookie through a reload, sign-out. Runs only with E2E_LIVE=1 and E2E_BASE_URL, for example from a
 * container in the compose network with E2E_BASE_URL=https://nginx (self-signed certificate).
 */
test.skip(!process.env.E2E_LIVE, "needs the compose stack (E2E_LIVE=1)");

test("register, see the empty dashboard, survive a reload, sign out, sign in again", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  const email = `web-${Date.now()}@example.com`;
  const password = "Kitchen-Window-Crack-42";

  await page.goto("/register");
  await page.getByLabel("Имя и фамилия").fill("Веб Проверка");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();

  await expect(page.getByTestId("current-user")).toHaveText("Веб Проверка");
  await expect(page.getByText("Объектов пока нет.")).toBeVisible();
  const cookies = await page.context().cookies();
  const refresh = cookies.find((cookie) => cookie.name === "refresh_token");
  expect(refresh?.httpOnly).toBe(true);
  expect(refresh?.secure).toBe(true);
  expect(refresh?.sameSite).toBe("Strict");
  expect(refresh?.path).toBe("/api/v1/auth");

  await page.reload();
  await expect(page.getByTestId("current-user")).toHaveText("Веб Проверка");

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Объектов пока нет.")).toBeVisible();

  // T-503: a property with a room, found from the dashboard.
  await page.getByRole("link", { name: "Добавить объект" }).click();
  await page.getByLabel("Название", { exact: true }).fill("Квартира на Мира");
  await page.getByLabel("Адрес").fill("Казань, ул. Мира, 5");
  await page.getByLabel("Площадь, м²").fill("54.5");
  await page.getByRole("button", { name: "Создать объект" }).click();
  await expect(page.getByRole("heading", { name: "Квартира на Мира" })).toBeVisible();
  await page.getByRole("textbox", { name: "Название помещения" }).fill("Кухня");
  await page.getByRole("combobox", { name: "Тип помещения" }).selectOption("KITCHEN");
  await page.getByRole("button", { name: "Добавить помещение" }).click();
  await expect(page.getByRole("button", { name: "Изменить помещение «Кухня»" })).toBeVisible();
  await page.getByRole("link", { name: "← Все объекты" }).click();
  await expect(page.getByRole("link", { name: "Квартира на Мира" })).toBeVisible();
  expect(violations).toEqual([]);
});

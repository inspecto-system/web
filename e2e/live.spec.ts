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
  // T-503: conduct an inspection with a defect, then a repeat inspection that resolves it.
  const card = page.url();
  await page.getByRole("link", { name: "Новый осмотр" }).click();
  await page.getByLabel("Дата осмотра").fill("2026-10-01");
  await page.getByLabel("Название (необязательно)").fill("Приёмка");
  await page.getByRole("button", { name: "Создать осмотр" }).click();
  await page.getByRole("button", { name: "Начать осмотр" }).click();
  const items = page.getByRole("list", { name: "Кухня" }).getByRole("group");
  await items.first().getByRole("button", { name: "Норма" }).click();
  await expect(items.first().getByRole("button", { name: "Норма" })).toHaveAttribute("aria-pressed", "true");
  await items.nth(1).getByRole("button", { name: "Дефект" }).click();
  await page.getByLabel("Описание дефекта кратко").fill("Трещина у окна");
  await page.getByLabel("Серьёзность").selectOption("MAJOR");
  // A photo in the form (T-603): uploaded to media-service, ml-service is asked for categories.
  // With a model the suggestions appear, without one (CI) the form says so; either way the photo
  // is attached to the new defect.
  await page.getByLabel("Выбрать фото дефекта", { exact: true }).setInputFiles(`${__dirname}/fixtures/room.jpg`);
  await expect(page.getByText(/Похоже на:|Подсказки нет/)).toBeVisible();
  await page.getByRole("button", { name: "Сохранить дефект" }).click();
  await expect(page.getByText("Трещина у окна")).toBeVisible();
  const thumbnail = page.getByRole("button", { name: "Открыть фото" }).locator("img");
  await expect(thumbnail).toBeVisible();
  expect(await thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Открыть фото" }).click();
  await expect(page.getByRole("img", { name: "Фото дефекта" })).toBeVisible();
  await page.getByRole("button", { name: "Завершить осмотр" }).click();
  await expect(page.getByText(/Не отмечено пунктов/)).toBeVisible();
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await expect(page.getByText("Завершён — изменить нельзя")).toBeVisible();

  await page.goto(card);
  await page.getByRole("link", { name: "Новый осмотр" }).click();
  await page.getByLabel("Дата осмотра").fill("2026-11-01");
  await page.getByRole("button", { name: "Создать осмотр" }).click();
  await page.getByRole("button", { name: "Начать осмотр" }).click();
  await page.getByRole("button", { name: "Дефект «Трещина у окна» устранён" }).click();
  await expect(page.getByText("Отмечен: устранён")).toBeVisible();
  await page.getByRole("button", { name: "Завершить осмотр" }).click();
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await expect(page.getByText("Завершён — изменить нельзя")).toBeVisible();
  await page.goto(card);
  await expect(page.getByText("Открытых дефектов")).toBeVisible();
  await expect(page.getByRole("link", { name: "Приёмка" })).toBeVisible();

  // T-504: statistics, comparison of the two inspections, a PDF report of the first one.
  await expect(page.getByRole("heading", { name: "Статистика" })).toBeVisible();
  await expect(page.getByText("Всего дефектов")).toBeVisible();
  await page.getByRole("link", { name: "Сравнить осмотры →" }).click();
  await expect(page.getByRole("button", { name: "Устранены: 1" })).toBeVisible();
  await expect(page.getByText("Трещина у окна")).toBeVisible();
  await page.goto(card);
  await page.getByRole("link", { name: "Приёмка" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  const pdf = await downloading;
  expect(pdf.suggestedFilename()).toBe("inspection-2026-10-01.pdf");
  const bytes = await pdf.createReadStream().then(async (stream) => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  });
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await expect(page.getByRole("button", { name: "Скачать" })).toBeVisible();
  expect(violations).toEqual([]);
});

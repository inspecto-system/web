import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/auth/session";
import { NewProperty } from "@/properties/new-property";
import { PropertyCard } from "@/properties/property-card";
import { fakeApi, json, problem, renderApp, tokens, user, type Routes } from "@/testing/render";

const replace = vi.fn();
const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, back }) }));

const id = "0190f0c8-0000-7000-8000-0000000000aa";
const kitchen = { id: "r1", propertyId: id, name: "Кухня", roomType: "KITCHEN", sortOrder: 0, version: 2 };
const details = (overrides: object = {}) => ({
  id,
  name: "Квартира на Мира",
  type: "APARTMENT",
  address: "ул. Мира, 5",
  city: "Казань",
  areaSqm: 54.5,
  notes: null,
  archivedAt: null,
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
  version: 3,
  rooms: [kitchen],
  inspectionCount: 2,
  openDefectCount: 1,
  lastInspectionAt: "2026-11-01T09:00:00Z",
  ...overrides,
});

const session: Routes = {
  "POST /auth/refresh": () => json(200, tokens),
  "GET /users/me": () => json(200, user),
};

beforeEach(() => {
  setAccessToken(null);
  replace.mockReset();
  back.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("PropertyCard", () => {
  it("shows the facts and saves an edit with the version of the card", async () => {
    const { requests } = fakeApi({
      ...session,
      [`GET /properties/${id}`]: () => json(200, details()),
      [`PATCH /properties/${id}`]: () => json(200, details({ name: "Квартира на Ленина", version: 4 })),
    });
    renderApp(<PropertyCard id={id} />);

    expect(await screen.findByRole("heading", { name: "Квартира на Мира" })).toBeInTheDocument();
    expect(screen.getByText("Казань")).toBeInTheDocument();
    expect(screen.getByText("54,5")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Изменить" }));
    const name = screen.getByLabelText("Название");
    await userEvent.clear(name);
    await userEvent.type(name, "Квартира на Ленина");
    await userEvent.clear(screen.getByLabelText("Город"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(requests.some((r) => r.method === "PATCH")).toBe(true));
    const patch = requests.find((r) => r.method === "PATCH");
    expect(await patch?.json()).toEqual({
      name: "Квартира на Ленина",
      type: "APARTMENT",
      address: "ул. Мира, 5",
      city: null,
      areaSqm: 54.5,
      notes: null,
      version: 3,
    });
  });

  it("archives, and deletes only after a confirmation", async () => {
    const { requests } = fakeApi({
      ...session,
      [`GET /properties/${id}`]: () => json(200, details()),
      [`POST /properties/${id}/archive`]: () => json(200, details({ archivedAt: "2026-11-07T10:00:00Z" })),
      [`DELETE /properties/${id}`]: () => new Response(null, { status: 202 }),
    });
    renderApp(<PropertyCard id={id} />);

    await userEvent.click(await screen.findByRole("button", { name: "В архив" }));
    await waitFor(() => expect(requests.some((r) => r.url.endsWith("/archive"))).toBe(true));

    await userEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(screen.getByText(/Это нельзя отменить/)).toBeInTheDocument();
    expect(requests.some((r) => r.method === "DELETE")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Удалить навсегда" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("explains an unknown or foreign property", async () => {
    fakeApi({ ...session, [`GET /properties/${id}`]: () => problem(404, "NOT_FOUND") });
    renderApp(<PropertyCard id={id} />);

    expect(await screen.findByText("Объект не найден или был удалён")).toBeInTheDocument();
  });

  it("adds, renames and deletes rooms; a used room is not deleted", async () => {
    const { requests } = fakeApi({
      ...session,
      [`GET /properties/${id}`]: () => json(200, details()),
      [`POST /properties/${id}/rooms`]: () => json(201, { ...kitchen, id: "r2", name: "Спальня" }),
      "PATCH /rooms/r1": () => json(200, { ...kitchen, name: "Кухня-гостиная", version: 3 }),
      "DELETE /rooms/r1": () => problem(409, "RESOURCE_IN_USE"),
    });
    renderApp(<PropertyCard id={id} />);
    await screen.findByRole("button", { name: "Изменить помещение «Кухня»" });

    await userEvent.type(screen.getAllByLabelText("Название помещения").at(-1)!, "Спальня");
    await userEvent.click(screen.getByRole("button", { name: "Добавить помещение" }));
    await waitFor(() =>
      expect(requests.some((r) => r.url.endsWith("/rooms") && r.method === "POST")).toBe(true),
    );
    const added = requests.find((r) => r.url.endsWith("/rooms") && r.method === "POST");
    expect(await added?.json()).toEqual({ name: "Спальня", roomType: "LIVING" });

    await userEvent.click(screen.getByRole("button", { name: "Изменить помещение «Кухня»" }));
    // The edited row comes before the form of a new room.
    const [input] = screen.getAllByRole("textbox", { name: "Название помещения" });
    await userEvent.clear(input);
    await userEvent.type(input, "Кухня-гостиная");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(requests.some((r) => r.method === "PATCH")).toBe(true));
    const patch = requests.find((r) => r.method === "PATCH");
    expect(await patch?.json()).toEqual({ name: "Кухня-гостиная", roomType: "KITCHEN", version: 2 });

    await userEvent.click(await screen.findByRole("button", { name: "Удалить помещение «Кухня»" }));
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить удаление помещения «Кухня»" }));
    expect(
      await screen.findByText("Нельзя удалить: используется в осмотрах или дефектах"),
    ).toBeInTheDocument();
  });

  it("archived property is read-only", async () => {
    fakeApi({
      ...session,
      [`GET /properties/${id}`]: () => json(200, details({ archivedAt: "2026-11-07T10:00:00Z" })),
    });
    renderApp(<PropertyCard id={id} />);

    expect(await screen.findByText("(в архиве)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Изменить" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить помещение" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Вернуть из архива" })).toBeInTheDocument();
  });
});

describe("NewProperty", () => {
  it("creates a property and opens its card", async () => {
    const { requests } = fakeApi({
      ...session,
      "POST /properties": () => json(201, details()),
    });
    renderApp(<NewProperty />);

    await userEvent.type(await screen.findByLabelText("Название"), "Дом у озера");
    await userEvent.selectOptions(screen.getByLabelText("Тип"), "HOUSE");
    await userEvent.type(screen.getByLabelText("Адрес"), "с. Лесное, 1");
    await userEvent.type(screen.getByLabelText("Площадь, м²"), "120");
    await userEvent.click(screen.getByRole("button", { name: "Создать объект" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/properties/${id}`));
    const created = requests.find((r) => r.method === "POST" && r.url.endsWith("/properties"));
    expect(await created?.json()).toEqual({
      name: "Дом у озера",
      type: "HOUSE",
      address: "с. Лесное, 1",
      city: null,
      areaSqm: 120,
      notes: null,
    });
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(back).toHaveBeenCalled();
  });

  it("shows why the server refused the property", async () => {
    fakeApi({ ...session, "POST /properties": () => problem(400, "VALIDATION_ERROR") });
    renderApp(<NewProperty />);
    await userEvent.type(await screen.findByLabelText("Название"), "X");
    await userEvent.type(screen.getByLabelText("Адрес"), "Y");
    await userEvent.click(screen.getByRole("button", { name: "Создать объект" }));

    expect(await screen.findByText("Проверьте правильность заполнения полей")).toBeInTheDocument();
  });
});

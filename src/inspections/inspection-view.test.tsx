import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/auth/session";
import { InspectionView } from "@/inspections/inspection-view";
import { NewInspection } from "@/inspections/new-inspection";
import { fakeApi, json, problem, renderApp, tokens, user, type Routes } from "@/testing/render";

const replace = vi.fn();
const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, back }) }));

const id = "insp-1";
const propertyId = "prop-1";
const kitchen = { id: "room-1", propertyId, name: "Кухня", roomType: "KITCHEN", sortOrder: 0, version: 0 };
const item = (n: number, result = "NOT_CHECKED") => ({
  id: `item-${n}`,
  inspectionId: id,
  roomId: kitchen.id,
  elementGroup: n === 1 ? "WALLS" : "WINDOWS",
  title: n === 1 ? "Стены: ровность" : "Окна: открывание",
  result,
  custom: false,
  sortOrder: n,
  version: 1,
});
const crack = {
  id: "defect-1",
  propertyId,
  roomId: kitchen.id,
  categoryId: "cat-crack",
  elementGroup: "WALLS",
  title: "Трещина у окна",
  severity: "MAJOR",
  currentStatus: "OPEN",
  firstInspectionId: "insp-0",
  createdAt: "2026-10-01T09:00:00Z",
  updatedAt: "2026-10-01T09:00:00Z",
  version: 0,
};
const inspection = (status: string, results: string[] = ["NOT_CHECKED", "NOT_CHECKED"]) => ({
  id,
  propertyId,
  inspectorId: user.id,
  inspectedAt: "2026-11-01T09:00:00Z",
  title: "Повторный",
  status,
  createdAt: "2026-11-01T09:00:00Z",
  updatedAt: "2026-11-01T09:00:00Z",
  version: 5,
  rooms: [{ room: kitchen, checklist: [item(1, results[0]), item(2, results[1])], observations: [] }],
});
const categories = [
  { id: "cat-paint", name: "Покраска", system: true, active: true, elementGroup: "WALLS" },
  { id: "cat-crack", name: "Трещина", system: true, active: true, elementGroup: "WINDOWS" },
];

function api(status: string, extra: Routes = {}) {
  return fakeApi({
    "POST /auth/refresh": () => json(200, tokens),
    "GET /users/me": () => json(200, user),
    [`GET /inspections/${id}`]: () => json(200, inspection(status)),
    [`GET /inspections/${id}/open-defects`]: () => json(200, [{ defect: crack }]),
    "GET /defect-categories": () => json(200, categories),
    ...extra,
  });
}

const body = async (requests: Request[], method: string, path: string) =>
  requests
    .find((r) => r.method === method && new URL(r.url).pathname.endsWith(path))
    ?.clone()
    .json();

beforeEach(() => {
  setAccessToken(null);
  replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("InspectionView", () => {
  it("starts a draft with its version; a draft cannot be marked", async () => {
    const { requests } = api("DRAFT", {
      [`PATCH /inspections/${id}`]: () => json(200, inspection("IN_PROGRESS")),
    });
    renderApp(<InspectionView id={id} />);

    expect(
      await screen.findByText("Чтобы отмечать пункты и добавлять дефекты, начните осмотр."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Норма" })[0]).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Начать осмотр" }));

    await waitFor(async () =>
      expect(await body(requests, "PATCH", `/inspections/${id}`)).toEqual({
        status: "IN_PROGRESS",
        version: 5,
      }),
    );
  });

  it("marks items; a defect mark opens the defect form for that item", async () => {
    const { requests } = api("IN_PROGRESS", {
      "PATCH /checklist-items/item-1": () => json(200, item(1, "OK")),
      "PATCH /checklist-items/item-2": () => json(200, item(2, "DEFECT")),
      [`POST /inspections/${id}/defects`]: () => json(201, {}),
    });
    renderApp(<InspectionView id={id} />);
    const walls = await screen.findByRole("group", { name: "Стены: ровность" });

    await userEvent.click(within(walls).getByRole("button", { name: "Норма" }));
    await waitFor(async () =>
      expect(await body(requests, "PATCH", "/item-1")).toEqual({ result: "OK", version: 1 }),
    );

    const windows = screen.getByRole("group", { name: "Окна: открывание" });
    await userEvent.click(within(windows).getByRole("button", { name: "Дефект" }));
    const form = await screen.findByRole("form", { name: "Новый дефект" });
    expect(within(form).getByLabelText("Описание дефекта кратко")).toHaveValue("Окна: открывание");
    // The category of the item's element group is offered first.
    expect(within(form).getByLabelText("Категория")).toHaveValue("cat-crack");
    await userEvent.clear(within(form).getByLabelText("Описание дефекта кратко"));
    await userEvent.type(within(form).getByLabelText("Описание дефекта кратко"), "Трещина откоса");
    await userEvent.selectOptions(within(form).getByLabelText("Серьёзность"), "CRITICAL");
    await userEvent.click(within(form).getByRole("button", { name: "Сохранить дефект" }));

    await waitFor(async () =>
      expect(await body(requests, "POST", "/defects")).toEqual({
        roomId: "room-1",
        checklistItemId: "item-2",
        categoryId: "cat-crack",
        elementGroup: "WINDOWS",
        title: "Трещина откоса",
        severity: "CRITICAL",
      }),
    );
  });

  it("marks a defect of an earlier inspection as resolved only explicitly", async () => {
    const { requests } = api("IN_PROGRESS", {
      [`POST /inspections/${id}/observations`]: () => json(201, {}),
    });
    renderApp(<InspectionView id={id} />);

    expect(
      await screen.findByText("Без отметки: 1. Отметьте каждый: остался или устранён."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Дефект «Трещина у окна» устранён" }));

    await waitFor(async () =>
      expect(await body(requests, "POST", "/observations")).toEqual({
        defectId: "defect-1",
        status: "RESOLVED",
      }),
    );
  });

  it("warns about what is left before completing, then completes with the version", async () => {
    const { requests } = api("IN_PROGRESS", { [`POST /inspections/${id}/complete`]: () => json(200, {}) });
    renderApp(<InspectionView id={id} />);

    await userEvent.click(await screen.findByRole("button", { name: "Завершить осмотр" }));
    expect(screen.getByText("Не отмечено пунктов: 2")).toBeInTheDocument();
    expect(screen.getByText("Прошлых дефектов без отметки «остался / устранён»: 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Завершить" }));

    await waitFor(async () => expect(await body(requests, "POST", "/complete")).toEqual({ version: 5 }));
  });

  it("shows a conflict made on another device", async () => {
    api("IN_PROGRESS", { "PATCH /checklist-items/item-1": () => problem(409, "VERSION_CONFLICT") });
    renderApp(<InspectionView id={id} />);
    const walls = await screen.findByRole("group", { name: "Стены: ровность" });

    await userEvent.click(within(walls).getByRole("button", { name: "Норма" }));

    expect(
      await screen.findByText("Данные изменились в другом месте. Обновите страницу."),
    ).toBeInTheDocument();
  });

  it("a completed inspection is read-only", async () => {
    api("COMPLETED");
    renderApp(<InspectionView id={id} />);

    expect(await screen.findByText("Завершён — изменить нельзя")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Завершить осмотр" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить дефект" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /устранён/ })).not.toBeInTheDocument();
  });

  it("deletes a draft after a confirmation", async () => {
    api("DRAFT", { [`DELETE /inspections/${id}`]: () => new Response(null, { status: 204 }) });
    renderApp(<InspectionView id={id} />);

    await userEvent.click(await screen.findByRole("button", { name: "Удалить черновик" }));
    await userEvent.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/properties/${propertyId}`));
  });
});

describe("NewInspection", () => {
  it("creates an inspection of the chosen rooms with the standard checklist", async () => {
    const bedroom = { ...kitchen, id: "room-2", name: "Спальня", roomType: "LIVING" };
    const { requests } = fakeApi({
      "POST /auth/refresh": () => json(200, tokens),
      "GET /users/me": () => json(200, user),
      [`GET /properties/${propertyId}`]: () =>
        json(200, { id: propertyId, name: "Квартира", rooms: [kitchen, bedroom], version: 0 }),
      "GET /checklist-templates": () =>
        json(200, [
          { id: "t1", code: "ROOM_STANDARD", name: "Стандартный", items: [{}, {}] },
          { id: "t2", code: "WET_ROOM", name: "Влажные помещения", items: [{}] },
        ]),
      [`POST /properties/${propertyId}/inspections`]: () => json(201, { id: "new-inspection" }),
    });
    renderApp(<NewInspection propertyId={propertyId} />);

    await userEvent.click(await screen.findByLabelText("Спальня"));
    await userEvent.type(screen.getByLabelText("Название (необязательно)"), "Приёмка");
    await userEvent.clear(screen.getByLabelText("Дата осмотра"));
    await userEvent.type(screen.getByLabelText("Дата осмотра"), "2026-10-01");
    await userEvent.click(screen.getByRole("button", { name: "Создать осмотр" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inspections/new-inspection"));
    const created = await body(requests, "POST", "/inspections");
    expect(created).toMatchObject({
      title: "Приёмка",
      roomIds: ["room-1"],
      templateCodes: ["ROOM_STANDARD"],
    });
    expect(new Date(created.inspectedAt).getDate()).toBe(1);
    expect(
      requests
        .find((r) => r.method === "POST" && r.url.endsWith("/inspections"))
        ?.headers.get("Accept-Language"),
    ).toBe("ru");
  });

  it("requires a room and a checklist", async () => {
    fakeApi({
      "POST /auth/refresh": () => json(200, tokens),
      "GET /users/me": () => json(200, user),
      [`GET /properties/${propertyId}`]: () =>
        json(200, { id: propertyId, name: "Квартира", rooms: [kitchen] }),
      "GET /checklist-templates": () =>
        json(200, [{ id: "t1", code: "ROOM_STANDARD", name: "Стандартный", items: [] }]),
    });
    renderApp(<NewInspection propertyId={propertyId} />);

    await userEvent.click(await screen.findByLabelText("Кухня"));
    await userEvent.click(screen.getByRole("button", { name: "Создать осмотр" }));
    expect(screen.getByText("Выберите хотя бы одно помещение")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Кухня"));
    await userEvent.click(screen.getByLabelText(/Стандартный/));
    await userEvent.click(screen.getByRole("button", { name: "Создать осмотр" }));
    expect(screen.getByText("Выберите хотя бы один чек-лист")).toBeInTheDocument();
  });
});

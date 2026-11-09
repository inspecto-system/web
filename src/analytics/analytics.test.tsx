import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Comparison } from "@/analytics/comparison";
import { Statistics } from "@/analytics/statistics";
import { setAccessToken } from "@/auth/session";
import { fakeApi, json, renderApp, tokens, user, type Routes } from "@/testing/render";

const propertyId = "prop-1";
const session: Routes = {
  "POST /auth/refresh": () => json(200, tokens),
  "GET /users/me": () => json(200, user),
};
const inspection = (id: string, date: string, title?: string) => ({
  id,
  propertyId,
  inspectorId: user.id,
  inspectedAt: `${date}T09:00:00Z`,
  title,
  status: "COMPLETED",
  createdAt: `${date}T09:00:00Z`,
  updatedAt: `${date}T09:00:00Z`,
  version: 1,
  defectCount: 1,
  newDefectCount: 1,
});
const defect = (id: string, state: string, roomName: string, reopened = false) => ({
  defectId: id,
  state,
  reopened,
  title: `Дефект ${id}`,
  severity: "MAJOR",
  roomId: roomName,
  roomName,
  categoryId: "cat",
});

beforeEach(() => setAccessToken(null));
afterEach(() => vi.unstubAllGlobals());

describe("Statistics", () => {
  it("shows totals and bars with labels of the API or of the severity scale", async () => {
    fakeApi({
      ...session,
      [`GET /properties/${propertyId}/statistics`]: () =>
        json(200, {
          totalDefects: 5,
          openDefects: 3,
          resolvedDefects: 2,
          bySeverity: [{ key: "CRITICAL", count: 1 }],
          byCategory: [{ key: "CRACK", label: "Трещина", count: 2 }],
          byRoom: [{ key: "r1", label: "Кухня", count: 3 }],
          byInspection: [
            { inspectionId: "i1", inspectedAt: "2026-10-01T09:00:00Z", status: "COMPLETED", openDefects: 2 },
          ],
        }),
    });
    renderApp(<Statistics propertyId={propertyId} />);

    const totals = await screen.findByText("Всего дефектов");
    expect(totals.nextElementSibling).toHaveTextContent("5");
    expect(screen.getByText("Критический")).toBeInTheDocument();
    expect(screen.getByText("Трещина")).toBeInTheDocument();
    expect(screen.getByText("Кухня")).toBeInTheDocument();
    expect(screen.getByText("01.10.2026")).toBeInTheDocument();
    // Bars are SVG attributes, not inline styles (strict CSP).
    expect(document.querySelector("[style]")).toBeNull();
  });

  it("says when there is nothing to count", async () => {
    fakeApi({
      ...session,
      [`GET /properties/${propertyId}/statistics`]: () =>
        json(200, {
          totalDefects: 0,
          openDefects: 0,
          resolvedDefects: 0,
          bySeverity: [],
          byCategory: [],
          byRoom: [],
          byInspection: [],
        }),
    });
    renderApp(<Statistics propertyId={propertyId} />);

    expect(await screen.findByText(/статистика появится после осмотров/)).toBeInTheDocument();
  });
});

describe("Comparison", () => {
  const routes = (calls: string[]): Routes => ({
    ...session,
    [`GET /properties/${propertyId}/inspections`]: () =>
      json(200, {
        items: [
          inspection("i3", "2026-11-01", "Повторный"),
          inspection("i1", "2026-09-01", "Приёмка"),
          inspection("i2", "2026-10-01"),
        ],
        page: 0,
        size: 100,
        totalElements: 3,
        totalPages: 1,
      }),
    "GET /inspections/compare": (request) => {
      const query = new URL(request.url).searchParams;
      calls.push(`${query.get("base")}>${query.get("target")}`);
      return json(200, {
        base: { id: query.get("base"), inspectedAt: "2026-10-01T09:00:00Z" },
        target: { id: query.get("target"), inspectedAt: "2026-11-01T09:00:00Z" },
        summary: { new: 1, resolved: 1, remaining: 1, notChecked: 0 },
        defects: [
          defect("a", "RESOLVED", "Кухня"),
          defect("b", "NEW", "Кухня", true),
          defect("c", "REMAINING", "Спальня"),
        ],
        bySeverity: {},
        byCategory: [],
      });
    },
  });

  it("compares the two latest inspections, groups by room and filters by state", async () => {
    const calls: string[] = [];
    fakeApi(routes(calls));
    renderApp(<Comparison propertyId={propertyId} />);

    expect(await screen.findByRole("button", { name: "Устранены: 1" })).toBeInTheDocument();
    expect(calls).toEqual(["i2>i3"]);
    expect(screen.getByRole("heading", { name: "Спальня" })).toBeInTheDocument();
    expect(screen.getByText("Новые · снова появился")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Остались: 1" }));
    expect(screen.queryByRole("heading", { name: "Кухня" })).not.toBeInTheDocument();
    expect(screen.getByText("Дефект c")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Остались: 1" }));
    expect(screen.getByRole("heading", { name: "Кухня" })).toBeInTheDocument();
  });

  it("does not ask the API when the first inspection is not earlier", async () => {
    const calls: string[] = [];
    fakeApi(routes(calls));
    renderApp(<Comparison propertyId={propertyId} />);
    await screen.findByRole("button", { name: "Устранены: 1" });

    await userEvent.selectOptions(screen.getByLabelText("Было (более ранний осмотр)"), "i3");

    expect(screen.getByText(/Первый осмотр должен быть раньше второго/)).toBeInTheDocument();
    expect(calls).toEqual(["i2>i3"]);
    await userEvent.selectOptions(screen.getByLabelText("Было (более ранний осмотр)"), "i1");
    await waitFor(() => expect(calls).toContain("i1>i3"));
    expect(
      within(screen.getByLabelText("Было (более ранний осмотр)")).getByRole("option", { selected: true }),
    ).toHaveTextContent("Приёмка");
  });

  it("needs two inspections", async () => {
    fakeApi({
      ...session,
      [`GET /properties/${propertyId}/inspections`]: () =>
        json(200, {
          items: [inspection("i1", "2026-09-01")],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
        }),
    });
    renderApp(<Comparison propertyId={propertyId} />);

    expect(await screen.findByText("Для сравнения нужно хотя бы два осмотра.")).toBeInTheDocument();
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/auth/session";
import { ReportsPanel } from "@/reports/reports-panel";
import { fakeApi, json, problem, renderApp, tokens, user, type Routes } from "@/testing/render";

const inspectionId = "insp-1";
const job = (status: string, extra: object = {}) => ({
  id: "rep-1",
  inspectionId,
  status,
  locale: "ru",
  createdAt: "2026-11-07T10:00:00Z",
  ...extra,
});
const session: Routes = {
  "POST /auth/refresh": () => json(200, tokens),
  "GET /users/me": () => json(200, user),
};

let clicks: string[];
beforeEach(() => {
  setAccessToken(null);
  clicks = [];
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:pdf", revokeObjectURL: () => {} }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push(`${this.download} ${this.href}`);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ReportsPanel", () => {
  it("orders a report with an Idempotency-Key, waits until it is ready and downloads it", async () => {
    let polls = 0;
    const { requests } = fakeApi({
      ...session,
      "GET /reports": () => json(200, []),
      "POST /reports": () => json(202, job("QUEUED")),
      "GET /reports/rep-1": () => json(200, ++polls < 2 ? job("RUNNING") : job("DONE", { pageCount: 2 })),
      "GET /reports/rep-1/file": () => new Response(new Blob(["%PDF-1.7"]), { status: 200 }),
    });
    renderApp(<ReportsPanel inspectionId={inspectionId} fileName="inspection-2026-10-01.pdf" />);
    await screen.findByText("Отчётов пока нет.");

    await userEvent.click(screen.getByRole("button", { name: "Сформировать отчёт" }));

    await waitFor(() => expect(clicks).toEqual(["inspection-2026-10-01.pdf blob:pdf"]), { timeout: 8000 });
    const order = requests.find((r) => r.method === "POST" && r.url.endsWith("/reports"))!;
    expect(order.headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await order.json()).toEqual({ inspectionId, locale: "ru" });
    const file = requests.find((r) => r.url.endsWith("/file"))!;
    expect(file.headers.get("Authorization")).toBe("Bearer access-1");
  }, 10_000);

  it("explains a failed report", async () => {
    fakeApi({
      ...session,
      "GET /reports": () => json(200, [job("FAILED", { errorCode: "REPORT_TOO_LARGE" })]),
      "POST /reports": () => json(202, job("FAILED", { errorCode: "DEPENDENCY_UNAVAILABLE" })),
    });
    renderApp(<ReportsPanel inspectionId={inspectionId} fileName="x.pdf" />);

    expect(await screen.findByText(/слишком много фото/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Сформировать отчёт" }));
    expect(
      await screen.findByText("Сервер был временно недоступен. Попробуйте ещё раз."),
    ).toBeInTheDocument();
    expect(clicks).toEqual([]);
  });

  it("downloads a ready report from the list and shows an error of the API", async () => {
    fakeApi({
      ...session,
      "GET /reports": () => json(200, [job("DONE", { pageCount: 3 })]),
      "GET /reports/rep-1/file": () => new Response(new Blob(["%PDF"]), { status: 200 }),
      "POST /reports": () => problem(409, "INVALID_STATE_TRANSITION"),
    });
    renderApp(<ReportsPanel inspectionId={inspectionId} fileName="x.pdf" />);

    expect(await screen.findByText(/страниц: 3/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Скачать" }));
    await waitFor(() => expect(clicks).toEqual(["x.pdf blob:pdf"]));
    await userEvent.click(screen.getByRole("button", { name: "Сформировать отчёт" }));
    expect(await screen.findByText(/Осмотр уже завершён или изменил статус/)).toBeInTheDocument();
  });
});

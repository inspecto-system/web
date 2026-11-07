import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/auth/session";
import { PropertyList } from "@/properties/property-list";
import { fakeApi, json, problem, renderApp, tokens, user } from "@/testing/render";

const property = (name: string, address: string) => ({
  id: crypto.randomUUID(),
  name,
  type: "APARTMENT",
  address,
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
  version: 0,
});
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 100,
  totalElements: items.length,
  totalPages: 1,
});

beforeEach(() => setAccessToken(null));
afterEach(() => vi.unstubAllGlobals());

describe("PropertyList", () => {
  it("lists active properties and searches after a pause in typing", async () => {
    const { requests } = fakeApi({
      "POST /auth/refresh": () => json(200, tokens),
      "GET /users/me": () => json(200, user),
      "GET /properties": (request) => {
        const query = new URL(request.url).searchParams.get("query");
        return json(200, page(query ? [] : [property("Квартира на Мира", "ул. Мира, 5")]));
      },
    });
    renderApp(<PropertyList />);

    expect(await screen.findByText("Квартира на Мира")).toBeInTheDocument();
    expect(screen.getByText("Квартира · ул. Мира, 5")).toBeInTheDocument();
    const first = new URL(requests.find((request) => request.url.includes("/properties"))!.url);
    expect(first.searchParams.get("archived")).toBe("false");
    expect(first.searchParams.has("query")).toBe(false);

    await userEvent.type(screen.getByRole("searchbox"), "Ленина");

    expect(await screen.findByText("Ничего не найдено.")).toBeInTheDocument();
    const searches = requests.filter((request) => new URL(request.url).searchParams.has("query"));
    expect(searches.map((request) => new URL(request.url).searchParams.get("query"))).toEqual(["Ленина"]);
  });

  it("shows an error with a retry", async () => {
    let calls = 0;
    fakeApi({
      "POST /auth/refresh": () => json(200, tokens),
      "GET /users/me": () => json(200, user),
      "GET /properties": () => (++calls === 1 ? problem(503, "DEPENDENCY_UNAVAILABLE") : json(200, page([]))),
    });
    renderApp(<PropertyList />);

    expect(await screen.findByText("Ошибка сервера. Повторите попытку позже.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(screen.getByText("Объектов пока нет.")).toBeInTheDocument());
  });
});

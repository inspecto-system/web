import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuestOnly, RequireSession } from "@/auth/guards";
import { setAccessToken } from "@/auth/session";
import { AppHeader } from "@/components/app-header";
import { fakeApi, json, problem, renderApp, tokens, user } from "@/testing/render";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  setAccessToken(null);
  replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("RequireSession", () => {
  it("sends a visitor without a session to the sign-in page", async () => {
    fakeApi({ "POST /auth/refresh": () => problem(401, "UNAUTHENTICATED") });
    renderApp(
      <RequireSession>
        <p>secret</p>
      </RequireSession>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("restores the session from the cookie after a reload and signs out", async () => {
    const { requests } = fakeApi({
      "POST /auth/refresh": () => json(200, tokens),
      "GET /users/me": () => json(200, user),
      "POST /auth/logout": () => new Response(null, { status: 204 }),
    });
    renderApp(
      <RequireSession>
        <AppHeader />
      </RequireSession>,
    );

    expect(await screen.findByText("Анна Инспектор")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Выйти" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    const logout = requests.find((request) => request.url.endsWith("/auth/logout"));
    expect(logout?.headers.get("Authorization")).toBe("Bearer access-1");
  });
});

describe("GuestOnly", () => {
  it("sends a signed-in user to the dashboard", async () => {
    fakeApi({ "POST /auth/refresh": () => json(200, tokens), "GET /users/me": () => json(200, user) });
    renderApp(
      <GuestOnly>
        <p>form</p>
      </GuestOnly>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText("form")).not.toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiBaseUrl,
  authFetch,
  hasAccessToken,
  onSessionEnded,
  refreshSession,
  setAccessToken,
} from "@/auth/session";
import { fakeApi, json, problem, tokens } from "@/testing/render";

const url = (path: string) => `${apiBaseUrl()}${path}`;

beforeEach(() => setAccessToken(null));
afterEach(() => vi.unstubAllGlobals());

describe("refreshSession", () => {
  it("renews the token from the cookie with the CSRF header, once for concurrent callers", async () => {
    const { requests } = fakeApi({ "POST /auth/refresh": () => json(200, tokens) });

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(results).toEqual([true, true, true]);
    expect(requests).toHaveLength(1);
    expect(requests[0].headers.get("X-CSRF-Protection")).toBe("1");
    expect(requests[0].credentials).toBe("same-origin");
    expect(hasAccessToken()).toBe(true);
  });

  it("forgets the token when the cookie is no longer valid", async () => {
    setAccessToken("old");
    fakeApi({ "POST /auth/refresh": () => problem(401, "UNAUTHENTICATED") });

    expect(await refreshSession()).toBe(false);
    expect(hasAccessToken()).toBe(false);
  });

  it("keeps the token when the server cannot be reached", async () => {
    setAccessToken("current");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );

    expect(await refreshSession()).toBe(false);
    expect(hasAccessToken()).toBe(true);
  });
});

describe("authFetch", () => {
  it("sends the access token", async () => {
    setAccessToken("access-0");
    const { requests } = fakeApi({ "GET /users/me": () => json(200, {}) });

    await authFetch(new Request(url("/users/me")));

    expect(requests[0].headers.get("Authorization")).toBe("Bearer access-0");
  });

  it("renews an expired token once and repeats the request with the new one", async () => {
    setAccessToken("expired");
    let calls = 0;
    const { requests } = fakeApi({
      "GET /properties": (request) =>
        ++calls === 1
          ? problem(401, "TOKEN_EXPIRED")
          : json(200, { auth: request.headers.get("Authorization") }),
      "POST /auth/refresh": () => json(200, tokens),
    });

    const response = await authFetch(new Request(url("/properties")));

    expect(await response.json()).toEqual({ auth: "Bearer access-1" });
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/api/v1/properties",
      "/api/v1/auth/refresh",
      "/api/v1/properties",
    ]);
  });

  it("ends the session when the token cannot be renewed", async () => {
    setAccessToken("expired");
    fakeApi({
      "GET /properties": () => problem(401, "TOKEN_EXPIRED"),
      "POST /auth/refresh": () => problem(401, "UNAUTHENTICATED"),
    });
    const ended = vi.fn();
    const unsubscribe = onSessionEnded(ended);

    const response = await authFetch(new Request(url("/properties")));
    unsubscribe();

    expect(response.status).toBe(401);
    expect(ended).toHaveBeenCalledOnce();
  });

  it("does not renew the token for sign-in itself", async () => {
    const { requests } = fakeApi({ "POST /auth/login": () => problem(401, "INVALID_CREDENTIALS") });

    const response = await authFetch(new Request(url("/auth/login"), { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
    expect(requests).toHaveLength(1);
  });
});

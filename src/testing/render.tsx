import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { vi } from "vitest";
import messages from "../../messages/ru.json";
import { SessionProvider } from "@/auth/session-provider";

/** A fake API: "METHOD /path" (path after /api/v1, without query) → answer. */
export type Routes = Record<string, (request: Request) => Response | Promise<Response>>;

export function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" },
  });
}

export function problem(status: number, code: string, errors: { field: string; code: string }[] = []) {
  return json(status, { type: "about:blank", title: "t", status, code, requestId: "r", errors });
}

/**
 * Replaces fetch with the routes and records every request. Unknown routes answer 404, so a
 * forgotten route fails the test visibly.
 */
export function fakeApi(routes: Routes) {
  const requests: Request[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request.clone());
    const path = new URL(request.url).pathname.replace(/^\/api\/v1/, "");
    const handler = routes[`${request.method} ${path}`];
    return handler ? handler(request) : problem(404, "NOT_FOUND");
  });
  vi.stubGlobal("fetch", fetchMock);
  return { requests, fetchMock };
}

export const user = {
  id: "0190f0c8-0000-7000-8000-000000000001",
  email: "anna@example.com",
  fullName: "Анна Инспектор",
  role: "INSPECTOR",
  locale: "ru",
  createdAt: "2026-11-01T10:00:00Z",
  version: 0,
};

export const tokens = { accessToken: "access-1", tokenType: "Bearer", expiresIn: 900 };

/** Renders with the providers of the root layout (Russian texts, queries, session). */
export function renderApp(ui: ReactNode) {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="ru" messages={messages}>
      <QueryClientProvider client={queries}>
        <SessionProvider>{ui}</SessionProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

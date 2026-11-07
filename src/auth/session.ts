/**
 * Session of the web app (ADR-008): the access token lives only in this module's memory; the refresh
 * token is an HttpOnly cookie (Path=/api/v1/auth) that scripts cannot read. A reload or a new tab
 * gets a new access token from the cookie through POST /auth/refresh with the X-CSRF-Protection
 * header, which a page of another origin cannot send.
 */

const REFRESH_PATH = "/auth/refresh";
const AUTH_PATHS = ["/auth/login", "/auth/register", REFRESH_PATH];

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const signOutListeners = new Set<() => void>();

/** Base URL of the API: the same origin as the page, behind nginx (ADR-013). */
export function apiBaseUrl(): string {
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  return `${origin}/api/v1`;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/** Called when the session ends without the user asking (the refresh token expired or was revoked). */
export function onSessionEnded(listener: () => void): () => void {
  signOutListeners.add(listener);
  return () => signOutListeners.delete(listener);
}

/**
 * Gets a new access token from the refresh cookie. Concurrent callers share one request, so the
 * rotated refresh token is used once (reusing a revoked one would end the whole session family).
 *
 * @returns whether the session is valid
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${apiBaseUrl()}${REFRESH_PATH}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Protection": "1" },
      });
      if (!response.ok) {
        accessToken = null;
        return false;
      }
      const body = (await response.json()) as { accessToken: string };
      accessToken = body.accessToken;
      return true;
    } catch {
      // No network: the session may still be valid; nothing is cleared.
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function withToken(request: Request): Request {
  if (accessToken === null) return request;
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return new Request(request, { headers });
}

/**
 * fetch of the API clients: sends the access token and, when it has expired (401), renews it once
 * and repeats the request. If the session cannot be renewed, listeners of onSessionEnded are told.
 */
export async function authFetch(request: Request): Promise<Response> {
  const isAuthCall = AUTH_PATHS.some((path) => new URL(request.url).pathname.endsWith(path));
  const retry = isAuthCall ? null : request.clone();
  const response = await fetch(withToken(request));
  if (response.status !== 401 || retry === null) return response;
  if (await refreshSession()) return fetch(withToken(retry));
  if (accessToken === null) signOutListeners.forEach((listener) => listener());
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "@/security/csp";

/**
 * Sets a strict Content Security Policy with a fresh nonce on every page (SECURITY.md §10, ADR-008).
 * Next.js reads the nonce from the request's policy and adds it to its own scripts; any other
 * script, including one injected through user text, is blocked.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Isolation from other origins (T-506, OWASP ZAP 90004): no window of another site keeps a reference to
  // this one, and the page loads only resources of its own origin (all of them are, behind nginx).
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return response;
}

export const config = {
  matcher: [
    // Pages and the favicon; hashed static files of Next.js get their headers from nginx, prefetches need none.
    {
      source: "/((?!_next/static|_next/image).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

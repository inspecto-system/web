import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

function nonceOf(policy: string | null): string | undefined {
  return policy?.match(/'nonce-([^']+)'/)?.[1];
}

describe("proxy", () => {
  it("sets a policy with a fresh nonce and passes the nonce to rendering", () => {
    const first = proxy(new NextRequest("https://localhost/"));
    const second = proxy(new NextRequest("https://localhost/"));

    const nonce = nonceOf(first.headers.get("Content-Security-Policy"));
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(nonceOf(second.headers.get("Content-Security-Policy"))).not.toBe(nonce);
    // The rewritten request headers reach the page renderer.
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(first.headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(first.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("skips static files and prefetches", () => {
    const [matcher] = config.matcher;
    expect(matcher.source).toContain("_next/static");
    expect(matcher.missing.map((header) => header.key)).toEqual(["next-router-prefetch", "purpose"]);
  });
});

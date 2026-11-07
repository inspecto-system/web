import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/security/csp";

function directives(policy: string): Map<string, string> {
  return new Map(
    policy.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values.join(" ")];
    }),
  );
}

describe("contentSecurityPolicy", () => {
  it("allows scripts and styles only with the nonce in production", () => {
    const policy = directives(contentSecurityPolicy("abc123", false));

    expect(policy.get("script-src")).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(policy.get("style-src")).toBe("'self' 'nonce-abc123'");
    expect(policy.get("object-src")).toBe("'none'");
    expect(policy.get("frame-ancestors")).toBe("'none'");
    expect(policy.get("connect-src")).toBe("'self'");
    expect(contentSecurityPolicy("abc123", false)).not.toContain("unsafe");
  });

  it("relaxes only what next dev needs", () => {
    const policy = directives(contentSecurityPolicy("n", true));

    expect(policy.get("script-src")).toContain("'unsafe-eval'");
    expect(policy.get("style-src")).toBe("'self' 'unsafe-inline'");
  });
});

import { describe, expect, it } from "vitest";
import { ApiError, errorKey, unwrap } from "@/api/errors";

describe("unwrap", () => {
  it("returns the body of a successful answer", async () => {
    const data = { id: 1 };
    expect(await unwrap(Promise.resolve({ data, response: new Response(null, { status: 200 }) }))).toBe(data);
  });

  it("turns an error answer into ApiError with its problem details", async () => {
    const call = Promise.resolve({
      error: { code: "EMAIL_TAKEN" },
      response: new Response(null, { status: 409 }),
    });
    await expect(unwrap(call)).rejects.toMatchObject({ status: 409, problem: { code: "EMAIL_TAKEN" } });
  });

  it("turns a failed network call into status 0", async () => {
    await expect(unwrap(Promise.reject(new TypeError("offline")))).rejects.toMatchObject({ status: 0 });
  });
});

describe("errorKey", () => {
  it.each([
    [new ApiError(0), "network"],
    [new ApiError(401, { code: "INVALID_CREDENTIALS" }), "invalidCredentials"],
    [new ApiError(423, { code: "ACCOUNT_LOCKED" }), "accountLocked"],
    [new ApiError(429, { code: "RATE_LIMITED" }), "rateLimited"],
    [new ApiError(429), "rateLimited"],
    [new ApiError(409, { code: "EMAIL_TAKEN" }), "emailTaken"],
    [new ApiError(404, { code: "NOT_FOUND" }), "notFound"],
    [new ApiError(409, { code: "VERSION_CONFLICT" }), "versionConflict"],
    [
      new ApiError(400, { code: "VALIDATION_ERROR", errors: [{ field: "password", code: "WEAK_PASSWORD" }] }),
      "weakPassword",
    ],
    [
      new ApiError(400, { code: "VALIDATION_ERROR", errors: [{ field: "email", code: "INVALID_FORMAT" }] }),
      "validation",
    ],
    [new ApiError(503, { code: "DEPENDENCY_UNAVAILABLE" }), "server"],
    [new ApiError(418), "unexpected"],
    [new Error("bug"), "unexpected"],
  ])("%o → %s", (error, key) => {
    expect(errorKey(error)).toBe(key);
  });
});

/** RFC 9457 problem details of the API (platform/api/common.yaml, Problem); only what the UI needs. */
export interface Problem {
  status?: number;
  code?: string;
  errors?: { field: string; code: string }[];
}

/** Failure of an API call, classified for the UI. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem = {},
  ) {
    super(`API error ${status} ${problem.code ?? ""}`.trim());
  }
}

/**
 * Body of a successful answer of openapi-fetch, or an ApiError. A failed network call becomes
 * status 0, so that the UI can say "no connection".
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: Awaited<typeof call>;
  try {
    result = await call;
  } catch {
    throw new ApiError(0);
  }
  if (!result.response.ok) {
    throw new ApiError(result.response.status, (result.error ?? {}) as Problem);
  }
  return result.data as T;
}

/**
 * Key of the user message (messages/*.json, "errors") for a failure: the API code decides, the
 * status is only a fallback (as in the Android app).
 */
export function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "unexpected";
  if (error.status === 0) return "network";
  const fieldCodes = (error.problem.errors ?? []).map((item) => item.code);
  switch (error.problem.code) {
    case "INVALID_CREDENTIALS":
      return "invalidCredentials";
    case "ACCOUNT_LOCKED":
      return "accountLocked";
    case "RATE_LIMITED":
      return "rateLimited";
    case "EMAIL_TAKEN":
      return "emailTaken";
    case "NOT_FOUND":
      return "notFound";
    case "VERSION_CONFLICT":
      return "versionConflict";
    case "VALIDATION_ERROR":
      return fieldCodes.includes("WEAK_PASSWORD") ? "weakPassword" : "validation";
    default:
      if (error.status === 429) return "rateLimited";
      if (error.status >= 500) return "server";
      return "unexpected";
  }
}

import createClient from "openapi-fetch";
import type { paths as CorePaths } from "@/api/generated/core";
import type { paths as MediaPaths } from "@/api/generated/media";
import type { paths as ReportPaths } from "@/api/generated/report";
import { apiBaseUrl, authFetch } from "@/auth/session";

/**
 * Clients of the public API, typed from the tagged contract in api/ (ADR-014). nginx serves the
 * web app and all services on one origin (ADR-013); every call carries the access token of the
 * session and renews it once on 401 (src/auth/session.ts).
 */
const options = () => ({ baseUrl: apiBaseUrl(), fetch: authFetch });

export const core = createClient<CorePaths>(options());
export const media = createClient<MediaPaths>(options());
export const reports = createClient<ReportPaths>(options());

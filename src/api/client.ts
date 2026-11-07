import createClient from "openapi-fetch";
import type { paths as CorePaths } from "@/api/generated/core";
import type { paths as MediaPaths } from "@/api/generated/media";
import type { paths as ReportPaths } from "@/api/generated/report";

/**
 * Clients of the public API, typed from the tagged contract in api/ (ADR-014). nginx serves the
 * web app and all services on one origin (ADR-013), so the base URL is a path.
 */
export const API_BASE_URL = "/api/v1";

export const core = createClient<CorePaths>({ baseUrl: API_BASE_URL });
export const media = createClient<MediaPaths>({ baseUrl: API_BASE_URL });
export const reports = createClient<ReportPaths>({ baseUrl: API_BASE_URL });

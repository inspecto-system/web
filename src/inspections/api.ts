import { core } from "@/api/client";
import { unwrap } from "@/api/errors";
import type { components } from "@/api/generated/core";

type Schemas = components["schemas"];
export type InspectionSummary = Schemas["InspectionSummary"];
export type InspectionDetails = Schemas["InspectionDetails"];
export type InspectionRoom = Schemas["InspectionRoom"];
export type ChecklistItem = Schemas["ChecklistItem"];
export type ChecklistResult = Schemas["ChecklistResult"];
export type ObservationWithDefect = Schemas["ObservationWithDefect"];
export type OpenDefect = Schemas["OpenDefect"];
export type DefectCategory = Schemas["DefectCategory"];
export type ChecklistTemplate = Schemas["ChecklistTemplate"];
export type Severity = Schemas["Severity"];
export type ElementGroup = Schemas["ElementGroup"];
export type ObservationStatus = Schemas["ObservationStatus"];
export type NewDefect = Schemas["CreateDefectRequest"];
export type CategorySuggestions = Schemas["SuggestionResponse"];

export const SEVERITIES: Severity[] = ["COSMETIC", "MINOR", "MAJOR", "CRITICAL"];
export const ELEMENT_GROUPS: ElementGroup[] = [
  "WALLS",
  "CEILING",
  "FLOOR",
  "WINDOWS",
  "DOORS",
  "PLUMBING",
  "ELECTRICAL",
  "OTHER",
];

/** Names of dictionaries and checklist items come in the language of the interface (ADR-019). */
const language = { "Accept-Language": "ru" as const };
/** The API allows up to 100 items per page; a property has far fewer inspections. */
const PAGE_SIZE = 100;

export const inspectionKeys = {
  ofProperty: (propertyId: string) => ["inspections", propertyId] as const,
  details: (id: string) => ["inspection", id] as const,
  openDefects: (id: string) => ["open-defects", id] as const,
  categories: ["defect-categories"] as const,
  templates: ["checklist-templates"] as const,
};

export const inspectionQueries = {
  ofProperty: (propertyId: string) => ({
    queryKey: inspectionKeys.ofProperty(propertyId),
    queryFn: () =>
      unwrap(
        core.GET("/properties/{propertyId}/inspections", {
          params: { path: { propertyId }, query: { page: 0, size: PAGE_SIZE } },
        }),
      ),
  }),
  details: (id: string) => ({
    queryKey: inspectionKeys.details(id),
    queryFn: () =>
      unwrap(core.GET("/inspections/{inspectionId}", { params: { path: { inspectionId: id } } })),
  }),
  openDefects: (id: string) => ({
    queryKey: inspectionKeys.openDefects(id),
    queryFn: () =>
      unwrap(
        core.GET("/inspections/{inspectionId}/open-defects", { params: { path: { inspectionId: id } } }),
      ),
  }),
  categories: () => ({
    queryKey: inspectionKeys.categories,
    queryFn: () => unwrap(core.GET("/defect-categories", { params: { header: language } })),
    staleTime: Infinity,
  }),
  templates: () => ({
    queryKey: inspectionKeys.templates,
    queryFn: () => unwrap(core.GET("/checklist-templates", { params: { header: language } })),
    staleTime: Infinity,
  }),
};

/** Inspections, checklist, defects and observations (platform/api/core.yaml, ADR-004). */
export const inspectionApi = {
  create: (propertyId: string, body: Schemas["CreateInspectionRequest"]) =>
    unwrap(
      core.POST("/properties/{propertyId}/inspections", {
        params: { path: { propertyId }, header: language },
        body,
      }),
    ),
  /** DRAFT → IN_PROGRESS. */
  start: (inspection: InspectionDetails) =>
    unwrap(
      core.PATCH("/inspections/{inspectionId}", {
        params: { path: { inspectionId: inspection.id } },
        body: { status: "IN_PROGRESS", version: inspection.version },
      }),
    ),
  /** IN_PROGRESS → COMPLETED: the inspection cannot be changed afterwards. */
  complete: (inspection: InspectionDetails) =>
    unwrap(
      core.POST("/inspections/{inspectionId}/complete", {
        params: { path: { inspectionId: inspection.id } },
        body: { version: inspection.version },
      }),
    ),
  /** Only a draft can be deleted. */
  remove: (id: string) =>
    unwrap(core.DELETE("/inspections/{inspectionId}", { params: { path: { inspectionId: id } } })),
  mark: (item: ChecklistItem, result: ChecklistResult) =>
    unwrap(
      core.PATCH("/checklist-items/{checklistItemId}", {
        params: { path: { checklistItemId: item.id } },
        body: { result, version: item.version },
      }),
    ),
  createDefect: (inspectionId: string, body: NewDefect) =>
    unwrap(core.POST("/inspections/{inspectionId}/defects", { params: { path: { inspectionId } }, body })),
  /**
   * Categories ml-service suggests for an uploaded photo (T-602). Always an answer: an empty list
   * when the model is unsure or unavailable.
   */
  suggestCategories: (photoId: string) => unwrap(core.POST("/category-suggestions", { body: { photoId } })),
  /** A defect of an earlier inspection seen again: still open or confirmed resolved (ADR-004). */
  observe: (inspectionId: string, defectId: string, status: ObservationStatus) =>
    unwrap(
      core.POST("/inspections/{inspectionId}/observations", {
        params: { path: { inspectionId } },
        body: { defectId, status },
      }),
    ),
};

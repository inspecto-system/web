import { core, media } from "@/api/client";
import { ApiError, unwrap } from "@/api/errors";
import type { components } from "@/api/generated/media";
import { apiBaseUrl, authFetch } from "@/auth/session";

export type PhotoLimits = components["schemas"]["PhotoLimits"];
export type PhotoVariant = "thumb" | "preview" | "original";

export const photoKeys = {
  limits: ["photo-limits"] as const,
  content: (photoId: string, variant: PhotoVariant) => ["photo", photoId, variant] as const,
};

export const photoQueries = {
  /** Limits of the server (GET /photos/limits); they change only with its configuration. */
  limits: () => ({
    queryKey: photoKeys.limits,
    queryFn: () => unwrap(media.GET("/photos/limits")),
    staleTime: Infinity,
  }),
  /**
   * A variant of a photo as a blob: URL. An <img> cannot send the access token, so the image is
   * downloaded with it and shown from memory (the CSP allows img-src blob:).
   */
  content: (photoId: string, variant: PhotoVariant) => ({
    queryKey: photoKeys.content(photoId, variant),
    queryFn: async () => {
      const response = await authFetch(
        new Request(`${apiBaseUrl()}/photos/${photoId}/content?variant=${variant}`),
      );
      if (!response.ok) throw new ApiError(response.status);
      return URL.createObjectURL(await response.blob());
    },
    staleTime: Infinity,
  }),
};

/**
 * Uploads a photo to media-service and attaches it to an observation in core-service. The
 * Idempotency-Key makes a repeated upload (after a lost answer) return the same photo; an
 * uploaded but unattached photo is deleted by media-service after 24 hours.
 */
export async function addPhoto(propertyId: string, observationId: string, file: File, key: string) {
  const form = new FormData();
  form.append("propertyId", propertyId);
  form.append("file", file);
  const photo = await unwrap(
    media.POST("/photos", {
      params: { header: { "Idempotency-Key": key } },
      // The generated type describes the multipart fields; the browser sends the FormData as is.
      body: form as unknown as components["schemas"]["UploadPhotoRequest"],
      bodySerializer: (body) => body as unknown as FormData,
    }),
  );
  await unwrap(
    core.POST("/observations/{observationId}/photos", {
      params: { path: { observationId } },
      body: { photoId: photo.id },
    }),
  );
  return photo;
}

/** Detaches the photo; core-service deletes it in media-service through its clean-up job (ADR-018). */
export function removePhoto(observationId: string, photoId: string) {
  return unwrap(
    core.DELETE("/observations/{observationId}/photos/{photoId}", {
      params: { path: { observationId, photoId } },
    }),
  );
}

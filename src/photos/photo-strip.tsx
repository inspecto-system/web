"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState, type ChangeEvent } from "react";
import { errorKey } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { addPhoto, photoQueries, removePhoto } from "@/photos/api";

function Thumbnail({ photoId, onOpen }: { photoId: string; onOpen(): void }) {
  const t = useTranslations("photos");
  const { data } = useQuery(photoQueries.content(photoId, "thumb"));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-muted size-20 overflow-hidden rounded-md"
      aria-label={t("open")}
    >
      {/* A blob: URL of an authenticated download; next/image cannot optimise it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {data && <img src={data} alt="" className="size-full object-cover" />}
    </button>
  );
}

function Preview({ photoId }: { photoId: string }) {
  const t = useTranslations("photos");
  const { data } = useQuery(photoQueries.content(photoId, "preview"));
  // eslint-disable-next-line @next/next/no-img-element
  return data ? <img src={data} alt={t("preview")} className="max-h-[70vh] w-auto rounded-md" /> : null;
}

/**
 * Photos of one observation (T-503): thumbnails, a larger preview, upload of a file (the camera is
 * the Android app's) and detaching. The server limits are checked before uploading.
 */
export function PhotoStrip({
  propertyId,
  observationId,
  photoIds,
  editable,
  onChanged,
}: {
  propertyId: string;
  observationId: string;
  photoIds: string[];
  editable: boolean;
  onChanged(): void;
}) {
  const t = useTranslations("photos");
  const errors = useTranslations("errors");
  const input = useRef<HTMLInputElement>(null);
  const limits = useQuery({ ...photoQueries.limits(), enabled: editable });
  const [opened, setOpened] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => addPhoto(propertyId, observationId, file, crypto.randomUUID()),
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (failure) => setError(errors(errorKey(failure))),
  });
  const remove = useMutation({
    mutationFn: (photoId: string) => removePhoto(observationId, photoId),
    onSuccess: () => {
      setOpened(null);
      onChanged();
    },
    onError: (failure) => setError(errors(errorKey(failure))),
  });

  const max = limits.data?.maxPhotosPerObservation;
  const full = max !== undefined && photoIds.length >= max;

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !limits.data) return;
    const allowed: readonly string[] = limits.data.allowedContentTypes;
    if (!allowed.includes(file.type)) return setError(errors("unsupportedImage"));
    if (file.size > limits.data.maxFileSizeBytes) {
      return setError(t("tooLarge", { mb: Math.floor(limits.data.maxFileSizeBytes / 1024 / 1024) }));
    }
    upload.mutate(file);
  }

  if (photoIds.length === 0 && !editable) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {photoIds.map((photoId) => (
          <Thumbnail
            key={photoId}
            photoId={photoId}
            onOpen={() => setOpened(opened === photoId ? null : photoId)}
          />
        ))}
        {editable && (
          <>
            <input
              ref={input}
              type="file"
              className="hidden"
              accept={limits.data?.allowedContentTypes.join(",")}
              aria-label={t("choose")}
              onChange={choose}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={full || upload.isPending || !limits.data}
              onClick={() => input.current?.click()}
            >
              {upload.isPending ? t("uploading") : full ? t("full", { max: max ?? 0 }) : t("add")}
            </Button>
          </>
        )}
      </div>
      {opened && (
        <div className="flex flex-col items-start gap-2">
          <Preview photoId={opened} />
          {editable && (
            <Button
              size="sm"
              variant="outline"
              disabled={remove.isPending}
              onClick={() => remove.mutate(opened)}
            >
              {t("remove")}
            </Button>
          )}
        </div>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

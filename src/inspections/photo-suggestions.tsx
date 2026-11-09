"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState, type ChangeEvent } from "react";
import { errorKey } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { inspectionApi, type CategorySuggestions } from "@/inspections/api";
import { photoQueries, uploadPhoto } from "@/photos/api";

export interface PhotoChoice {
  photoId: string;
  suggestionId?: string;
}

interface Props {
  propertyId: string;
  /** Category currently chosen in the form, to highlight its suggestion. */
  categoryId: string;
  onPhoto(choice: PhotoChoice): void;
  onCategory(categoryId: string): void;
}

/**
 * Optional first step of a new defect (T-603): a photo is uploaded at once, ml-service suggests
 * up to three categories, and a tap puts one into the form. No answer from the model is not an
 * error: the form simply works as without the photo step.
 */
export function PhotoSuggestions({ propertyId, categoryId, onPhoto, onCategory }: Props) {
  const t = useTranslations("suggestions");
  const errors = useTranslations("errors");
  const input = useRef<HTMLInputElement>(null);
  const limits = useQuery(photoQueries.limits());
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [answer, setAnswer] = useState<CategorySuggestions | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const photo = await uploadPhoto(propertyId, file, crypto.randomUUID());
      onPhoto({ photoId: photo.id });
      return { photo, suggestions: await inspectionApi.suggestCategories(photo.id) };
    },
    onSuccess: ({ photo, suggestions }) => {
      setError(null);
      setAnswer(suggestions);
      onPhoto({ photoId: photo.id, suggestionId: suggestions.suggestionId });
      const first = suggestions.items[0];
      if (first) onCategory(first.categoryId);
    },
    onError: (failure) => setError(errors(errorKey(failure))),
  });

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !limits.data) return;
    const allowed: readonly string[] = limits.data.allowedContentTypes;
    if (!allowed.includes(file.type)) return setError(errors("unsupportedImage"));
    if (file.size > limits.data.maxFileSizeBytes) {
      return setError(t("tooLarge", { mb: Math.floor(limits.data.maxFileSizeBytes / 1024 / 1024) }));
    }
    setAnswer(null);
    setFileName(file.name);
    upload.mutate(file);
  }

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={t("title")}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          className="hidden"
          accept={limits.data?.allowedContentTypes.join(",")}
          aria-label={t("choose")}
          onChange={choose}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={upload.isPending || !limits.data}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? t("working") : fileName ? t("replace") : t("add")}
        </Button>
        {fileName && !upload.isPending && <span className="text-muted-foreground text-sm">{fileName}</span>}
      </div>
      {answer && answer.items.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm">{t("hint")}</p>
          <div className="flex flex-wrap gap-2">
            {answer.items.map((item) => (
              <Button
                key={item.categoryId}
                type="button"
                size="sm"
                variant={item.categoryId === categoryId ? "default" : "outline"}
                aria-pressed={item.categoryId === categoryId}
                onClick={() => onCategory(item.categoryId)}
              >
                {t("item", { name: item.name, percent: Math.round(item.probability * 100) })}
              </Button>
            ))}
          </div>
        </div>
      )}
      {answer && answer.items.length === 0 && <p className="text-muted-foreground text-sm">{t("none")}</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

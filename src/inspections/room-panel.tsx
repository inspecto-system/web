"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DefectForm } from "@/inspections/defect-form";
import {
  inspectionApi,
  inspectionQueries,
  type ChecklistItem,
  type ChecklistResult,
  type InspectionRoom,
} from "@/inspections/api";
import { cn } from "@/lib/utils";
import { PhotoStrip } from "@/photos/photo-strip";

/** Quick marks of a checklist item, in the order of the buttons (as in the Android app). */
const MARKS: ChecklistResult[] = ["OK", "DEFECT", "NOT_APPLICABLE"];

function ChecklistRow({
  item,
  editable,
  onMark,
}: {
  item: ChecklistItem;
  editable: boolean;
  onMark(item: ChecklistItem, result: ChecklistResult): void;
}) {
  const t = useTranslations("checklist");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
      <span>{item.title}</span>
      <span className="flex gap-1" role="group" aria-label={item.title}>
        {MARKS.map((mark) => (
          <Button
            key={mark}
            size="sm"
            variant={item.result === mark ? "default" : "outline"}
            aria-pressed={item.result === mark}
            disabled={!editable}
            // Pressing the chosen mark again clears it.
            onClick={() => onMark(item, item.result === mark ? "NOT_CHECKED" : mark)}
          >
            {t(`result.${mark}`)}
          </Button>
        ))}
      </span>
    </li>
  );
}

/** One room of an inspection: its checklist and the defects observed in it. */
export function RoomPanel({
  inspectionId,
  room,
  editable,
  onChanged,
  onError,
}: {
  inspectionId: string;
  room: InspectionRoom;
  editable: boolean;
  onChanged(): void;
  onError(error: unknown): void;
}) {
  const t = useTranslations("defects");
  const categories = useQuery(inspectionQueries.categories());
  const [draftFor, setDraftFor] = useState<ChecklistItem | null | undefined>(undefined);
  const mark = useMutation({
    mutationFn: ({ item, result }: { item: ChecklistItem; result: ChecklistResult }) =>
      inspectionApi.mark(item, result),
    onSuccess: (_, { item, result }) => {
      onChanged();
      // A defect mark starts a defect of this item unless one is already linked to it.
      const linked = room.observations.some((observation) => observation.checklistItemId === item.id);
      if (result === "DEFECT" && !linked) setDraftFor(item);
    },
    onError,
  });
  const categoryName = (id: string) => categories.data?.find((category) => category.id === id)?.name ?? "";

  return (
    <div className="flex flex-col gap-6">
      <ul aria-label={room.room.name}>
        {room.checklist.map((item) => (
          <ChecklistRow
            key={`${item.id}-${item.version}`}
            item={item}
            editable={editable && !mark.isPending}
            onMark={(target, result) => mark.mutate({ item: target, result })}
          />
        ))}
      </ul>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{t("title")}</h3>
          {editable && draftFor === undefined && (
            <Button variant="outline" onClick={() => setDraftFor(null)}>
              {t("add")}
            </Button>
          )}
        </div>
        {draftFor !== undefined && (
          <DefectForm
            key={draftFor?.id ?? "free"}
            roomId={room.room.id}
            item={draftFor ?? undefined}
            onCancel={() => setDraftFor(undefined)}
            onSubmit={async (defect) => {
              await inspectionApi.createDefect(inspectionId, defect);
              setDraftFor(undefined);
              onChanged();
            }}
          />
        )}
        {room.observations.length === 0 && <p className="text-muted-foreground">{t("none")}</p>}
        <ul className="flex flex-col gap-2">
          {room.observations.map((observation) => (
            <li key={observation.id} className="rounded-lg border p-3">
              <p className="font-medium">{observation.defect.title}</p>
              <p className="text-muted-foreground text-sm">
                {categoryName(observation.defect.categoryId)} ·{" "}
                {t(`group.${observation.defect.elementGroup}`)} · {t(`severityName.${observation.severity}`)}
              </p>
              <p
                className={cn(
                  "text-sm",
                  observation.status === "OPEN" ? "text-destructive" : "text-green-700",
                )}
              >
                {t(`status.${observation.status}`)}
              </p>
              <PhotoStrip
                propertyId={observation.defect.propertyId}
                observationId={observation.id}
                photoIds={observation.photos.map((photo) => photo.photoId)}
                editable={editable}
                onChanged={onChanged}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

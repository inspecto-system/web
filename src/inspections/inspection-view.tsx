"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { errorKey } from "@/api/errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inspectionApi, inspectionKeys, inspectionQueries, type InspectionDetails } from "@/inspections/api";
import { useInspectionName } from "@/inspections/inspection-list";
import { OpenDefects } from "@/inspections/open-defects";
import { RoomPanel } from "@/inspections/room-panel";
import { propertyKeys } from "@/properties/api";

/** What still needs the inspector before completion (a warning, the server does not require it). */
function unfinished(inspection: InspectionDetails, unmarkedDefects: number) {
  const unchecked = inspection.rooms
    .flatMap((room) => room.checklist)
    .filter((item) => item.result === "NOT_CHECKED").length;
  return { unchecked, unmarkedDefects };
}

/** Conducting an inspection (T-503): start, checklist marks and defects per room, repeat marks, completion. */
export function InspectionView({ id }: { id: string }) {
  const t = useTranslations("inspection");
  const errors = useTranslations("errors");
  const name = useInspectionName();
  const router = useRouter();
  const queries = useQueryClient();
  const details = useQuery(inspectionQueries.details(id));
  const open = useQuery(inspectionQueries.openDefects(id));
  const [roomIndex, setRoomIndex] = useState(0);
  const [confirm, setConfirm] = useState<"complete" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inspection = details.data;
  const refresh = () => {
    setError(null);
    void queries.invalidateQueries({ queryKey: inspectionKeys.details(id) });
    void queries.invalidateQueries({ queryKey: inspectionKeys.openDefects(id) });
    if (inspection) {
      void queries.invalidateQueries({ queryKey: inspectionKeys.ofProperty(inspection.propertyId) });
      void queries.invalidateQueries({ queryKey: propertyKeys.details(inspection.propertyId) });
    }
  };
  const failed = (failure: unknown) => {
    setError(errors(errorKey(failure)));
    // Another device may have changed the inspection (VERSION_CONFLICT, INVALID_STATE_TRANSITION).
    void queries.invalidateQueries({ queryKey: inspectionKeys.details(id) });
  };
  const action = useMutation({
    mutationFn: async (kind: "start" | "complete" | "delete") => {
      if (!inspection) return;
      if (kind === "start") await inspectionApi.start(inspection);
      if (kind === "complete") await inspectionApi.complete(inspection);
      if (kind === "delete") await inspectionApi.remove(inspection.id);
    },
    onSuccess: (_, kind) => {
      setConfirm(null);
      refresh();
      if (kind === "delete" && inspection) router.replace(`/properties/${inspection.propertyId}`);
    },
    onError: failed,
  });

  if (details.isPending) return <p role="status">{t("loading")}</p>;
  if (details.error || !inspection) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errors(errorKey(details.error))}</AlertDescription>
      </Alert>
    );
  }
  const editable = inspection.status === "IN_PROGRESS";
  const openDefects = open.data ?? [];
  const left = unfinished(inspection, openDefects.filter((item) => !item.currentObservation).length);
  const room = inspection.rooms[Math.min(roomIndex, inspection.rooms.length - 1)];

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/properties/${inspection.propertyId}`} className="text-sm underline">
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{name(inspection)}</h1>
          <p className="text-muted-foreground">{t(`status.${inspection.status}`)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inspection.status === "DRAFT" && (
            <>
              <Button disabled={action.isPending} onClick={() => action.mutate("start")}>
                {t("start")}
              </Button>
              <Button variant="outline" onClick={() => setConfirm("delete")}>
                {t("delete")}
              </Button>
            </>
          )}
          {editable && <Button onClick={() => setConfirm("complete")}>{t("complete")}</Button>}
        </div>
      </div>
      {inspection.status === "DRAFT" && <p>{t("draftHint")}</p>}
      {confirm && (
        <Alert>
          <AlertDescription className="flex flex-col gap-3">
            {confirm === "complete" ? (
              <>
                <span>{t("completeConfirm")}</span>
                {left.unchecked > 0 && <span>{t("uncheckedLeft", { count: left.unchecked })}</span>}
                {left.unmarkedDefects > 0 && (
                  <span>{t("unmarkedLeft", { count: left.unmarkedDefects })}</span>
                )}
              </>
            ) : (
              <span>{t("deleteConfirm")}</span>
            )}
            <span className="flex gap-2">
              <Button
                variant={confirm === "delete" ? "destructive" : "default"}
                disabled={action.isPending}
                onClick={() => action.mutate(confirm)}
              >
                {confirm === "complete" ? t("completeAction") : t("deleteAction")}
              </Button>
              <Button variant="outline" onClick={() => setConfirm(null)}>
                {t("cancel")}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <OpenDefects
        inspectionId={id}
        defects={openDefects}
        editable={editable}
        onChanged={refresh}
        onError={failed}
      />
      <div role="tablist" aria-label={t("rooms")} className="flex flex-wrap gap-2 border-b pb-2">
        {inspection.rooms.map((item, index) => (
          <Button
            key={item.room.id}
            role="tab"
            aria-selected={item === room}
            variant={item === room ? "default" : "ghost"}
            size="sm"
            onClick={() => setRoomIndex(index)}
          >
            {item.room.name}
          </Button>
        ))}
      </div>
      {room && (
        <RoomPanel
          key={room.room.id}
          inspectionId={id}
          room={room}
          editable={editable}
          onChanged={refresh}
          onError={failed}
        />
      )}
    </div>
  );
}

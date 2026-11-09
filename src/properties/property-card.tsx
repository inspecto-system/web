"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { errorKey } from "@/api/errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { propertyApi, propertyDetailsQuery, propertyKeys, type PropertyDetails } from "@/properties/api";
import { PropertyForm } from "@/properties/property-form";
import { Rooms } from "@/properties/rooms";
import { InspectionList } from "@/inspections/inspection-list";
import { Statistics } from "@/analytics/statistics";

function Facts({ property }: { property: PropertyDetails }) {
  const t = useTranslations("properties");
  const format = useFormatter();
  const facts: [string, string][] = [
    [t("typeLabel"), t(`type.${property.type}`)],
    [t("address"), property.address],
  ];
  if (property.city) facts.push([t("city"), property.city]);
  if (property.areaSqm != null) facts.push([t("area"), format.number(property.areaSqm)]);
  facts.push([t("inspections"), String(property.inspectionCount)]);
  facts.push([t("openDefects"), String(property.openDefectCount)]);
  if (property.lastInspectionAt) {
    facts.push([
      t("lastInspection"),
      format.dateTime(new Date(property.lastInspectionAt), { dateStyle: "short" }),
    ]);
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
      {facts.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      {property.notes && (
        <div className="contents">
          <dt className="text-muted-foreground">{t("notes")}</dt>
          <dd className="whitespace-pre-line">{property.notes}</dd>
        </div>
      )}
    </dl>
  );
}

/** Card of a property (T-503): facts, editing, archive, deletion and rooms. */
export function PropertyCard({ id }: { id: string }) {
  const t = useTranslations("properties");
  const errors = useTranslations("errors");
  const router = useRouter();
  const queries = useQueryClient();
  const { data: property, error, isPending } = useQuery(propertyDetailsQuery(id));
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => {
    void queries.invalidateQueries({ queryKey: propertyKeys.details(id) });
    void queries.invalidateQueries({ queryKey: propertyKeys.all });
  };
  const archive = useMutation({
    mutationFn: () => (property?.archivedAt ? propertyApi.unarchive(id) : propertyApi.archive(id)),
    onSuccess: refresh,
    onError: (failure) => setActionError(errors(errorKey(failure))),
  });
  const remove = useMutation({
    mutationFn: () => propertyApi.remove(id),
    onSuccess: () => {
      queries.removeQueries({ queryKey: propertyKeys.details(id) });
      void queries.invalidateQueries({ queryKey: propertyKeys.all });
      router.replace("/");
    },
    onError: (failure) => setActionError(errors(errorKey(failure))),
  });

  if (isPending) return <p role="status">{t("loading")}</p>;
  if (error || !property) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errors(errorKey(error))}</AlertDescription>
      </Alert>
    );
  }
  const archived = property.archivedAt != null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm underline">
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {property.name}
          {archived && <span className="text-muted-foreground ml-2 text-base">({t("archived")})</span>}
        </h1>
        {!editing && (
          <div className="flex flex-wrap gap-2">
            {!archived && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                {t("edit")}
              </Button>
            )}
            <Button variant="outline" disabled={archive.isPending} onClick={() => archive.mutate()}>
              {archived ? t("unarchive") : t("archive")}
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(true)}>
              {t("delete")}
            </Button>
          </div>
        )}
      </div>
      {confirmDelete && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-3">
            {t("deleteConfirm")}
            <span className="flex gap-2">
              <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
                {t("deleteForever")}
              </Button>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                {t("cancel")}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      {editing ? (
        <PropertyForm
          initial={property}
          submitLabel={t("save")}
          onCancel={() => setEditing(false)}
          onSubmit={async (fields) => {
            await propertyApi.update(property, fields);
            setEditing(false);
            refresh();
          }}
        />
      ) : (
        <Facts property={property} />
      )}
      <Rooms propertyId={id} rooms={property.rooms} editable={!archived} />
      <InspectionList propertyId={id} canCreate={!archived && property.rooms.length > 0} />
      {property.inspectionCount >= 2 && (
        <Link href={`/properties/${id}/compare`} className="underline">
          {t("compare")}
        </Link>
      )}
      <Statistics propertyId={id} />
    </div>
  );
}

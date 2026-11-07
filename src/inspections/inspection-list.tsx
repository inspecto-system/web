"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { errorKey } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { inspectionQueries, type InspectionSummary } from "@/inspections/api";

/** Name of an inspection: its title, or the date when it has none (as in the Android app). */
export function useInspectionName() {
  const t = useTranslations("inspections");
  const format = useFormatter();
  return (inspection: Pick<InspectionSummary, "title" | "inspectedAt">) =>
    inspection.title ||
    t("defaultTitle", { date: format.dateTime(new Date(inspection.inspectedAt), { dateStyle: "short" }) });
}

/** Inspections of a property, newest first, in its card. */
export function InspectionList({ propertyId, canCreate }: { propertyId: string; canCreate: boolean }) {
  const t = useTranslations("inspections");
  const errors = useTranslations("errors");
  const name = useInspectionName();
  const { data, error, isPending } = useQuery(inspectionQueries.ofProperty(propertyId));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        {canCreate && (
          <Button asChild>
            <Link href={`/properties/${propertyId}/inspections/new`}>{t("new")}</Link>
          </Button>
        )}
      </div>
      {isPending && <p role="status">{t("loading")}</p>}
      {error && <p className="text-destructive">{errors(errorKey(error))}</p>}
      {data?.items.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
      <ul className="flex flex-col">
        {data?.items.map((inspection) => (
          <li key={inspection.id} className="border-b py-2">
            <Link
              href={`/inspections/${inspection.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {name(inspection)}
            </Link>
            <span className="text-muted-foreground ml-2 text-sm">
              {t(`status.${inspection.status}`)} · {t("defectCount", { count: inspection.defectCount })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

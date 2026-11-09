"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { core } from "@/api/client";
import { errorKey, unwrap } from "@/api/errors";
import type { components } from "@/api/generated/core";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/fields";
import { Label } from "@/components/ui/label";
import { inspectionQueries } from "@/inspections/api";
import { useInspectionName } from "@/inspections/inspection-list";

type State = components["schemas"]["ComparisonState"];
const STATES: State[] = ["NEW", "RESOLVED", "REMAINING", "NOT_CHECKED"];
const COUNT_KEYS = {
  NEW: "new",
  RESOLVED: "resolved",
  REMAINING: "remaining",
  NOT_CHECKED: "notChecked",
} as const;

/**
 * Comparison of two inspections of a property (T-301 data, T-504, ADR-004): what is new,
 * resolved, remaining or not checked in the later inspection, by room.
 */
export function Comparison({ propertyId }: { propertyId: string }) {
  const t = useTranslations("comparison");
  const names = useTranslations("defects");
  const errors = useTranslations("errors");
  const name = useInspectionName();
  const list = useQuery(inspectionQueries.ofProperty(propertyId));
  // The API lists newest first; the pickers show them in time order.
  const inspections = [...(list.data?.items ?? [])].sort((a, b) =>
    a.inspectedAt.localeCompare(b.inspectedAt),
  );
  const [base, setBase] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState<State | null>(null);
  const baseId = base ?? inspections.at(-2)?.id;
  const targetId = target ?? inspections.at(-1)?.id;
  const a = inspections.find((item) => item.id === baseId);
  const b = inspections.find((item) => item.id === targetId);
  const ordered = a !== undefined && b !== undefined && a.inspectedAt < b.inspectedAt;

  const comparison = useQuery({
    queryKey: ["comparison", baseId, targetId] as const,
    queryFn: () =>
      unwrap(core.GET("/inspections/compare", { params: { query: { base: baseId!, target: targetId! } } })),
    // The API requires A to be earlier than B; checked here so that no request is wasted.
    enabled: ordered,
  });

  if (list.isPending) return <p role="status">{t("loading")}</p>;
  if (list.error) return <p className="text-destructive">{errors(errorKey(list.error))}</p>;
  if (inspections.length < 2) return <p>{t("needTwo")}</p>;

  const defects = (comparison.data?.defects ?? []).filter(
    (defect) => filter === null || defect.state === filter,
  );
  const rooms = Map.groupBy(defects, (defect) => defect.roomName);
  const picker = (
    id: string,
    label: string,
    value: string | undefined,
    onChange: (value: string) => void,
  ) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {inspections.map((item) => (
          <option key={item.id} value={item.id}>
            {name(item)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/properties/${propertyId}`} className="text-sm underline">
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {picker("compare-base", t("base"), baseId, setBase)}
        {picker("compare-target", t("target"), targetId, setTarget)}
      </div>
      {!ordered && <p className="text-destructive">{t("order")}</p>}
      {comparison.error && <p className="text-destructive">{errors(errorKey(comparison.error))}</p>}
      {ordered && comparison.isPending && <p role="status">{t("loading")}</p>}
      {comparison.data && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("filter")}>
            {STATES.map((state) => (
              <Button
                key={state}
                size="sm"
                variant={filter === state ? "default" : "outline"}
                aria-pressed={filter === state}
                onClick={() => setFilter(filter === state ? null : state)}
              >
                {t("count", {
                  state: t(`state.${state}`),
                  count: comparison.data.summary[COUNT_KEYS[state]],
                })}
              </Button>
            ))}
          </div>
          {defects.length === 0 && <p>{t("empty")}</p>}
          {[...rooms].map(([room, items]) => (
            <div key={room} className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">{room}</h2>
              <ul className="flex flex-col gap-2">
                {items.map((defect) => (
                  <li key={defect.defectId} className="rounded-lg border p-3">
                    <p>{defect.title}</p>
                    <p className="text-primary text-sm">
                      {t(`state.${defect.state}`)}
                      {defect.reopened ? ` · ${t("reopened")}` : ""}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {names(`severityName.${defect.severity}`)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

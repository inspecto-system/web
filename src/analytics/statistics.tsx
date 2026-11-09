"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { core } from "@/api/client";
import { errorKey, unwrap } from "@/api/errors";
import type { components } from "@/api/generated/core";

type CountByKey = components["schemas"]["CountByKey"];

export const statisticsQuery = (propertyId: string) => ({
  queryKey: ["statistics", propertyId] as const,
  queryFn: () =>
    unwrap(
      core.GET("/properties/{propertyId}/statistics", {
        params: { path: { propertyId }, header: { "Accept-Language": "ru" } },
      }),
    ),
});

/**
 * Horizontal bars drawn with SVG attributes, not inline styles: the strict CSP of the app
 * (src/security/csp.ts) allows no style attributes, and no chart library is needed for this.
 */
function Bars({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (rows.length === 0) return null;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="font-medium">{title}</figcaption>
      <ul className="flex flex-col gap-1">
        {rows.map((row, index) => (
          <li
            key={`${row.label}-${index}`}
            className="grid grid-cols-[minmax(8rem,12rem)_1fr_2rem] items-center gap-2 text-sm"
          >
            <span className="truncate">{row.label}</span>
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-3 w-full" aria-hidden="true">
              <rect width="100" height="10" className="fill-muted" />
              <rect width={(row.count / max) * 100} height="10" className="fill-primary" />
            </svg>
            <span className="text-right tabular-nums">{row.count}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Statistics of a property (T-302 data, T-504): totals, open defects by severity, category, room and over time. */
export function Statistics({ propertyId }: { propertyId: string }) {
  const t = useTranslations("statistics");
  const names = useTranslations("defects");
  const errors = useTranslations("errors");
  const format = useFormatter();
  const { data, error, isPending } = useQuery(statisticsQuery(propertyId));

  if (isPending) return <p role="status">{t("loading")}</p>;
  if (error || !data) return <p className="text-destructive">{errors(errorKey(error))}</p>;
  if (data.totalDefects === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("empty")}</p>
      </section>
    );
  }
  const labelled = (rows: CountByKey[], name: (key: string) => string = (key) => key) =>
    rows.map((row) => ({ label: row.label ?? name(row.key), count: row.count }));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <dl className="grid grid-cols-3 gap-3 text-center">
        {(
          [
            ["total", data.totalDefects],
            ["open", data.openDefects],
            ["resolved", data.resolvedDefects],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="rounded-lg border p-3">
            <dt className="text-muted-foreground text-sm">{t(key)}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 md:grid-cols-2">
        <Bars
          title={t("bySeverity")}
          rows={labelled(data.bySeverity, (key) => names(`severityName.${key}`))}
        />
        <Bars title={t("byCategory")} rows={labelled(data.byCategory)} />
        <Bars title={t("byRoom")} rows={labelled(data.byRoom)} />
        <Bars
          title={t("byInspection")}
          rows={data.byInspection.map((item) => ({
            label: format.dateTime(new Date(item.inspectedAt), { dateStyle: "short" }),
            count: item.openDefects,
          }))}
        />
      </div>
    </section>
  );
}

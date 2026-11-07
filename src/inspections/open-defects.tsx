"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { inspectionApi, type ObservationStatus, type OpenDefect } from "@/inspections/api";

/**
 * Defects open before this inspection (repeat inspection, T-403 / ADR-004): the inspector says
 * explicitly whether each one remains or is resolved; nothing is resolved by silence.
 */
export function OpenDefects({
  inspectionId,
  defects,
  editable,
  onChanged,
  onError,
}: {
  inspectionId: string;
  defects: OpenDefect[];
  editable: boolean;
  onChanged(): void;
  onError(error: unknown): void;
}) {
  const t = useTranslations("openDefects");
  const names = useTranslations("defects");
  const observe = useMutation({
    mutationFn: ({ defectId, status }: { defectId: string; status: ObservationStatus }) =>
      inspectionApi.observe(inspectionId, defectId, status),
    onSuccess: onChanged,
    onError,
  });
  if (defects.length === 0) return null;
  const unmarked = defects.filter((item) => !item.currentObservation).length;

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      {editable && unmarked > 0 && (
        <p className="text-muted-foreground text-sm">{t("hint", { count: unmarked })}</p>
      )}
      <ul className="flex flex-col gap-2">
        {defects.map(({ defect, currentObservation }) => (
          <li key={defect.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
            <span>
              {defect.title}{" "}
              <span className="text-muted-foreground text-sm">
                · {names(`severityName.${defect.severity}`)}
              </span>
            </span>
            {currentObservation ? (
              <span className="text-sm font-medium">{t(`marked.${currentObservation.status}`)}</span>
            ) : (
              editable && (
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={t("remainsNamed", { title: defect.title })}
                    disabled={observe.isPending}
                    onClick={() => observe.mutate({ defectId: defect.id, status: "OPEN" })}
                  >
                    {t("remains")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={t("resolvedNamed", { title: defect.title })}
                    disabled={observe.isPending}
                    onClick={() => observe.mutate({ defectId: defect.id, status: "RESOLVED" })}
                  >
                    {t("resolved")}
                  </Button>
                </span>
              )
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

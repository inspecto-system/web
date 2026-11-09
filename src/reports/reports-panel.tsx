"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { reports } from "@/api/client";
import { ApiError, errorKey, unwrap } from "@/api/errors";
import type { components } from "@/api/generated/report";
import { apiBaseUrl, authFetch } from "@/auth/session";
import { Button } from "@/components/ui/button";

type ReportJob = components["schemas"]["ReportJob"];

/** Polling of a job as the contract says: every 2 s, up to 60 s. */
export const POLL_INTERVAL_MS = 2_000;
const MAX_POLLS = 30;

const reportsKey = (inspectionId: string) => ["reports", inspectionId] as const;
const finished = (job: ReportJob) => job.status === "DONE" || job.status === "FAILED";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Downloads the PDF with the access token and saves it under a readable name. */
async function download(job: ReportJob, fileName: string) {
  const response = await authFetch(new Request(`${apiBaseUrl()}/reports/${job.id}/file`));
  if (!response.ok) throw new ApiError(response.status);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** PDF reports of a completed inspection (T-402 service, T-504): order, wait, download. */
export function ReportsPanel({ inspectionId, fileName }: { inspectionId: string; fileName: string }) {
  const t = useTranslations("reports");
  const errors = useTranslations("errors");
  const format = useFormatter();
  const queries = useQueryClient();
  const list = useQuery({
    queryKey: reportsKey(inspectionId),
    queryFn: () => unwrap(reports.GET("/reports", { params: { query: { inspectionId } } })),
  });
  // Kept until the order is accepted: repeating it after a lost answer does not create a second report.
  const pendingKey = useRef<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const order = useMutation({
    mutationFn: async () => {
      pendingKey.current ??= crypto.randomUUID();
      let job = await unwrap(
        reports.POST("/reports", {
          params: { header: { "Idempotency-Key": pendingKey.current } },
          body: { inspectionId, locale: "ru" },
        }),
      );
      pendingKey.current = null;
      for (let poll = 0; poll < MAX_POLLS && !finished(job); poll++) {
        await sleep(POLL_INTERVAL_MS);
        job = await unwrap(reports.GET("/reports/{reportId}", { params: { path: { reportId: job.id } } }));
      }
      return job;
    },
    onSuccess: async (job) => {
      void queries.invalidateQueries({ queryKey: reportsKey(inspectionId) });
      if (job.status === "DONE") {
        setMessage(null);
        await download(job, fileName);
      } else if (job.status === "FAILED") {
        setMessage(failure(job.errorCode));
      } else {
        setMessage(t("stillGenerating"));
      }
    },
    onError: (error) => setMessage(errors(errorKey(error))),
  });
  const save = useMutation({
    mutationFn: (job: ReportJob) => download(job, fileName),
    onError: (error) => setMessage(errors(errorKey(error))),
  });

  function failure(code: string | null | undefined): string {
    if (code === "REPORT_TOO_LARGE") return t("failedTooLarge");
    if (code === "DEPENDENCY_UNAVAILABLE") return t("failedUnavailable");
    return t("failed");
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <Button disabled={order.isPending} onClick={() => order.mutate()}>
          {order.isPending ? t("generating") : t("order")}
        </Button>
      </div>
      {message && <p className="text-destructive text-sm">{message}</p>}
      {list.data?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
      <ul className="flex flex-col gap-2">
        {list.data?.map((job) => (
          <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
            <span>
              {format.dateTime(new Date(job.createdAt), { dateStyle: "short", timeStyle: "short" })} ·{" "}
              {t(`status.${job.status}`)}
              {job.status === "DONE" && job.pageCount != null && (
                <span className="text-muted-foreground text-sm">
                  {" "}
                  · {t("pages", { count: job.pageCount })}
                </span>
              )}
              {job.status === "FAILED" && (
                <span className="text-destructive text-sm"> · {failure(job.errorCode)}</span>
              )}
            </span>
            {job.status === "DONE" && (
              <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate(job)}>
                {t("download")}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

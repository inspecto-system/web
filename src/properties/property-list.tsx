"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { core } from "@/api/client";
import { errorKey, unwrap } from "@/api/errors";
import type { components } from "@/api/generated/core";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type Property = components["schemas"]["Property"];

/** The API allows up to 100 items per page; an inspector has far fewer properties. */
const PAGE_SIZE = 100;
/** Search starts after a pause in typing, not on every key. */
export const SEARCH_DELAY_MS = 300;

/** Waits until the value has not changed for the delay. */
function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function propertiesQuery(query: string) {
  return {
    queryKey: ["properties", query] as const,
    queryFn: () =>
      unwrap(
        core.GET("/properties", {
          params: { query: { page: 0, size: PAGE_SIZE, archived: false, query: query || undefined } },
        }),
      ),
  };
}

/** Dashboard of T-502: own active properties with search by name or address. */
export function PropertyList() {
  const t = useTranslations("properties");
  const errors = useTranslations("errors");
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim(), SEARCH_DELAY_MS);
  const { data, error, isPending, refetch } = useQuery(propertiesQuery(query));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Input
          className="max-w-xs"
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            {errors(errorKey(error))}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {isPending && <p role="status">{t("loading")}</p>}
      {data && data.items.length === 0 && <p>{query ? t("notFound") : t("empty")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {data?.items.map((property) => (
          <li key={property.id}>
            <Card>
              <CardHeader>
                <CardTitle>{property.name}</CardTitle>
                <CardDescription>
                  {t(`type.${property.type}`)} · {property.address}
                </CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

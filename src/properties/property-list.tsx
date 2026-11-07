"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { core } from "@/api/client";
import { errorKey, unwrap } from "@/api/errors";
import type { components } from "@/api/generated/core";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { propertyKeys } from "@/properties/api";

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

export function propertiesQuery(query: string, archived = false) {
  return {
    queryKey: [...propertyKeys.all, query, archived] as const,
    queryFn: () =>
      unwrap(
        core.GET("/properties", {
          params: { query: { page: 0, size: PAGE_SIZE, archived, query: query || undefined } },
        }),
      ),
  };
}

/** Dashboard (T-502, T-503): own properties with search by name or address, archive on demand. */
export function PropertyList() {
  const t = useTranslations("properties");
  const errors = useTranslations("errors");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const query = useDebounced(search.trim(), SEARCH_DELAY_MS);
  const { data, error, isPending, refetch } = useQuery(propertiesQuery(query, archived));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
            />
            {t("showArchived")}
          </label>
          <Button asChild>
            <Link href="/properties/new">{t("add")}</Link>
          </Button>
        </div>
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
            <Card className="hover:bg-muted/50 relative transition-colors">
              <CardHeader>
                <CardTitle>
                  {/* The whole card is clickable through the stretched link. */}
                  <Link href={`/properties/${property.id}`} className="after:absolute after:inset-0">
                    {property.name}
                  </Link>
                </CardTitle>
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

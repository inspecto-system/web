"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { errorKey } from "@/api/errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inspectionApi, inspectionKeys, inspectionQueries } from "@/inspections/api";
import { propertyDetailsQuery, propertyKeys } from "@/properties/api";

/** Today in the date input format (YYYY-MM-DD) of the browser's local day. */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function toggle(values: string[], value: string, on: boolean): string[] {
  return on ? [...values, value] : values.filter((item) => item !== value);
}

/**
 * New inspection (T-503): the rooms to inspect and the checklist templates; a checklist item is
 * created for every room × template item. All rooms and the standard template are preselected.
 */
export function NewInspection({ propertyId }: { propertyId: string }) {
  const t = useTranslations("inspections");
  const errors = useTranslations("errors");
  const router = useRouter();
  const queries = useQueryClient();
  const property = useQuery(propertyDetailsQuery(propertyId));
  const templates = useQuery(inspectionQueries.templates());
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [rooms, setRooms] = useState<string[] | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roomIds = rooms ?? property.data?.rooms.map((room) => room.id) ?? [];
  const templateCodes =
    codes ?? templates.data?.filter((tpl) => tpl.code === "ROOM_STANDARD").map((tpl) => tpl.code) ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (roomIds.length === 0) return setError(t("roomsRequired"));
    if (templateCodes.length === 0) return setError(t("templatesRequired"));
    setBusy(true);
    setError(null);
    try {
      // Noon of the chosen day: the date stays the same in any time zone of the users.
      const created = await inspectionApi.create(propertyId, {
        inspectedAt: new Date(`${date}T12:00:00`).toISOString(),
        title: title.trim() || undefined,
        roomIds,
        templateCodes,
      });
      void queries.invalidateQueries({ queryKey: inspectionKeys.ofProperty(propertyId) });
      void queries.invalidateQueries({ queryKey: propertyKeys.details(propertyId) });
      router.replace(`/inspections/${created.id}`);
    } catch (failure) {
      setError(errors(errorKey(failure)));
      setBusy(false);
    }
  }

  if (property.isPending || templates.isPending) return <p role="status">{t("loading")}</p>;
  if (property.error || templates.error) {
    return <p className="text-destructive">{errors(errorKey(property.error ?? templates.error))}</p>;
  }
  if (property.data.rooms.length === 0) return <p>{t("noRooms")}</p>;

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">{t("newTitle", { property: property.data.name })}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="inspection-date">{t("date")}</Label>
          <Input
            id="inspection-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="inspection-title">{t("titleField")}</Label>
          <Input
            id="inspection-title"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t("rooms")}</legend>
        {property.data.rooms.map((room) => (
          <label key={room.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={roomIds.includes(room.id)}
              onChange={(e) => setRooms(toggle(roomIds, room.id, e.target.checked))}
            />
            {room.name}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t("templates")}</legend>
        {templates.data.map((template) => (
          <label key={template.code} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={templateCodes.includes(template.code)}
              onChange={(e) => setCodes(toggle(templateCodes, template.code, e.target.checked))}
            />
            {template.name}{" "}
            <span className="text-muted-foreground text-sm">
              ({t("itemCount", { count: template.items.length })})
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {t("create")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

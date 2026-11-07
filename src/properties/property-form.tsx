"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { errorKey } from "@/api/errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROPERTY_TYPES, type PropertyFields, type PropertyType } from "@/properties/api";

interface Props {
  initial?: Partial<PropertyFields>;
  submitLabel: string;
  onSubmit(fields: PropertyFields): Promise<unknown>;
  onCancel?(): void;
}

/** Fields of a property (platform/api/core.yaml, PropertyFields); empty optional fields are sent as null. */
export function PropertyForm({ initial = {}, submitLabel, onSubmit, onCancel }: Props) {
  const t = useTranslations("properties");
  const errors = useTranslations("errors");
  const [name, setName] = useState(initial.name ?? "");
  const [type, setType] = useState<PropertyType>(initial.type ?? "APARTMENT");
  const [address, setAddress] = useState(initial.address ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [area, setArea] = useState(initial.areaSqm == null ? "" : String(initial.areaSqm));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        type,
        address: address.trim(),
        city: city.trim() || null,
        areaSqm: area.trim() === "" ? null : Number(area.replace(",", ".")),
        notes: notes.trim() || null,
      });
    } catch (failure) {
      setError(errors(errorKey(failure)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="property-name">{t("name")}</Label>
        <Input
          id="property-name"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="property-type">{t("typeLabel")}</Label>
        <NativeSelect
          id="property-type"
          value={type}
          onChange={(e) => setType(e.target.value as PropertyType)}
        >
          {PROPERTY_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`type.${value}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="property-address">{t("address")}</Label>
        <Input
          id="property-address"
          required
          maxLength={500}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="property-city">{t("city")}</Label>
          <Input id="property-city" maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="property-area">{t("area")}</Label>
          <Input
            id="property-area"
            type="number"
            min={0}
            max={100000}
            step="0.01"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="property-notes">{t("notes")}</Label>
        <Textarea
          id="property-notes"
          maxLength={4000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

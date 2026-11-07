"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { errorKey } from "@/api/errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ELEMENT_GROUPS,
  inspectionQueries,
  SEVERITIES,
  type ChecklistItem,
  type ElementGroup,
  type NewDefect,
  type Severity,
} from "@/inspections/api";

interface Props {
  roomId: string;
  /** The checklist item marked as a defect, if the defect starts from one. */
  item?: ChecklistItem;
  onSubmit(defect: NewDefect): Promise<unknown>;
  onCancel(): void;
}

/** A new defect with its first observation (platform/api/core.yaml, CreateDefectRequest). */
export function DefectForm({ roomId, item, onSubmit, onCancel }: Props) {
  const t = useTranslations("defects");
  const errors = useTranslations("errors");
  const categories = useQuery(inspectionQueries.categories());
  const [title, setTitle] = useState(item?.title ?? "");
  const [group, setGroup] = useState<ElementGroup>(item?.elementGroup ?? "WALLS");
  const [categoryId, setCategoryId] = useState("");
  const [severity, setSeverity] = useState<Severity>("MINOR");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = (categories.data ?? []).filter((category) => category.active);
  // A category of the element group is offered first; the inspector may choose any other.
  const suggested = active.find((category) => category.elementGroup === group) ?? active[0];
  const category = categoryId || suggested?.id || "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        roomId,
        checklistItemId: item?.id,
        categoryId: category,
        elementGroup: group,
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
      });
    } catch (failure) {
      setError(errors(errorKey(failure)));
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-3 rounded-lg border p-4" onSubmit={submit} aria-label={t("new")}>
      <h3 className="font-semibold">{t("new")}</h3>
      <div className="flex flex-col gap-2">
        <Label htmlFor="defect-title">{t("titleField")}</Label>
        <Input
          id="defect-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="defect-group">{t("elementGroup")}</Label>
          <NativeSelect
            id="defect-group"
            value={group}
            onChange={(e) => setGroup(e.target.value as ElementGroup)}
          >
            {ELEMENT_GROUPS.map((value) => (
              <option key={value} value={value}>
                {t(`group.${value}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="defect-category">{t("category")}</Label>
          <NativeSelect
            id="defect-category"
            required
            value={category}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {active.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="defect-severity">{t("severity")}</Label>
          <NativeSelect
            id="defect-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
          >
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {t(`severityName.${value}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="defect-description">{t("description")}</Label>
        <Textarea
          id="defect-description"
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !category}>
          {t("save")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

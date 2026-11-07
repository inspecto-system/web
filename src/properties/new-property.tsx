"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { propertyApi, propertyKeys } from "@/properties/api";
import { PropertyForm } from "@/properties/property-form";

/** New property: after saving, its card opens to add rooms. */
export function NewProperty() {
  const t = useTranslations("properties");
  const router = useRouter();
  const queries = useQueryClient();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
      <PropertyForm
        submitLabel={t("create")}
        onCancel={() => router.back()}
        onSubmit={async (fields) => {
          const created = await propertyApi.create(fields);
          void queries.invalidateQueries({ queryKey: propertyKeys.all });
          router.replace(`/properties/${created.id}`);
        }}
      />
    </section>
  );
}

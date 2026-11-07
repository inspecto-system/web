"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { errorKey } from "@/api/errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { propertyApi, propertyKeys, ROOM_TYPES, type Room, type RoomType } from "@/properties/api";

function RoomFields({
  name,
  type,
  onName,
  onType,
  idPrefix,
}: {
  name: string;
  type: RoomType;
  onName(value: string): void;
  onType(value: RoomType): void;
  idPrefix: string;
}) {
  const t = useTranslations("rooms");
  return (
    <>
      <Input
        aria-label={t("name")}
        placeholder={t("name")}
        id={`${idPrefix}-name`}
        required
        maxLength={100}
        value={name}
        onChange={(e) => onName(e.target.value)}
      />
      <NativeSelect
        aria-label={t("typeLabel")}
        id={`${idPrefix}-type`}
        className="sm:max-w-48"
        value={type}
        onChange={(e) => onType(e.target.value as RoomType)}
      >
        {ROOM_TYPES.map((value) => (
          <option key={value} value={value}>
            {t(`type.${value}`)}
          </option>
        ))}
      </NativeSelect>
    </>
  );
}

function RoomRow({ room, onChanged }: { room: Room; onChanged(error: unknown): void }) {
  const t = useTranslations("rooms");
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(room.name);
  const [type, setType] = useState<RoomType>(room.roomType);
  const update = useMutation({
    mutationFn: () => propertyApi.updateRoom(room, name, type),
    onSuccess: () => {
      setEditing(false);
      onChanged(null);
    },
    onError: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => propertyApi.deleteRoom(room.id),
    onSuccess: () => onChanged(null),
    onError: (error) => {
      setConfirming(false);
      onChanged(error);
    },
  });

  if (editing) {
    return (
      <li className="flex flex-col gap-2 sm:flex-row">
        <RoomFields idPrefix={`room-${room.id}`} name={name} type={type} onName={setName} onType={setType} />
        <Button size="sm" disabled={update.isPending || !name.trim()} onClick={() => update.mutate()}>
          {t("save")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
          {t("cancel")}
        </Button>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
      <span>
        {room.name} <span className="text-muted-foreground text-sm">· {t(`type.${room.roomType}`)}</span>
      </span>
      <span className="flex gap-2">
        {confirming ? (
          <>
            <span className="text-sm">{t("deleteConfirm")}</span>
            <Button
              size="sm"
              variant="destructive"
              aria-label={t("confirmDeleteNamed", { name: room.name })}
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t("delete")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              aria-label={t("editNamed", { name: room.name })}
              onClick={() => setEditing(true)}
            >
              {t("edit")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={t("deleteNamed", { name: room.name })}
              onClick={() => setConfirming(true)}
            >
              {t("delete")}
            </Button>
          </>
        )}
      </span>
    </li>
  );
}

/** Rooms of a property: add, rename or change the type, delete (refused while inspections use the room). */
export function Rooms({
  propertyId,
  rooms,
  editable,
}: {
  propertyId: string;
  rooms: Room[];
  editable: boolean;
}) {
  const t = useTranslations("rooms");
  const errors = useTranslations("errors");
  const queries = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<RoomType>("LIVING");
  const [error, setError] = useState<string | null>(null);

  const changed = (failure: unknown) => {
    setError(failure ? errors(errorKey(failure)) : null);
    void queries.invalidateQueries({ queryKey: propertyKeys.details(propertyId) });
  };
  const add = useMutation({
    mutationFn: () => propertyApi.addRoom(propertyId, name, type),
    onSuccess: () => {
      setName("");
      changed(null);
    },
    onError: changed,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) add.mutate();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      {rooms.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
      <ul>
        {rooms.map((room) =>
          editable ? (
            <RoomRow key={`${room.id}-${room.version}`} room={room} onChanged={changed} />
          ) : (
            <li key={room.id} className="border-b py-2">
              {room.name}{" "}
              <span className="text-muted-foreground text-sm">· {t(`type.${room.roomType}`)}</span>
            </li>
          ),
        )}
      </ul>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {editable && (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
          <RoomFields idPrefix="new-room" name={name} type={type} onName={setName} onType={setType} />
          <Button type="submit" disabled={add.isPending || !name.trim()}>
            {t("add")}
          </Button>
        </form>
      )}
    </section>
  );
}

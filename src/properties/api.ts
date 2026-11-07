import { core } from "@/api/client";
import { unwrap } from "@/api/errors";
import type { components } from "@/api/generated/core";

export type PropertyDetails = components["schemas"]["PropertyDetails"];
export type PropertyFields = components["schemas"]["CreatePropertyRequest"];
export type PropertyType = components["schemas"]["PropertyType"];
export type Room = components["schemas"]["Room"];
export type RoomType = components["schemas"]["RoomType"];

export const PROPERTY_TYPES: PropertyType[] = ["APARTMENT", "HOUSE", "COMMERCIAL", "OTHER"];
export const ROOM_TYPES: RoomType[] = [
  "LIVING",
  "KITCHEN",
  "BATHROOM",
  "TOILET",
  "HALLWAY",
  "BALCONY",
  "OTHER",
];

/** Query keys: the list of a search and the card of one property. */
export const propertyKeys = {
  all: ["properties"] as const,
  details: (id: string) => ["property", id] as const,
};

export function propertyDetailsQuery(id: string) {
  return {
    queryKey: propertyKeys.details(id),
    queryFn: () => unwrap(core.GET("/properties/{propertyId}", { params: { path: { propertyId: id } } })),
  };
}

/** Properties and rooms (platform/api/core.yaml, tags properties and rooms). */
export const propertyApi = {
  create: (fields: PropertyFields) => unwrap(core.POST("/properties", { body: fields })),
  update: (property: PropertyDetails, fields: PropertyFields) =>
    unwrap(
      core.PATCH("/properties/{propertyId}", {
        params: { path: { propertyId: property.id } },
        body: { ...fields, version: property.version },
      }),
    ),
  archive: (id: string) =>
    unwrap(core.POST("/properties/{propertyId}/archive", { params: { path: { propertyId: id } } })),
  unarchive: (id: string) =>
    unwrap(core.POST("/properties/{propertyId}/unarchive", { params: { path: { propertyId: id } } })),
  /** Deletes the property with all its data; photos and reports are removed by clean-up jobs (ADR-018). */
  remove: (id: string) =>
    unwrap(core.DELETE("/properties/{propertyId}", { params: { path: { propertyId: id } } })),
  addRoom: (propertyId: string, name: string, roomType: RoomType) =>
    unwrap(
      core.POST("/properties/{propertyId}/rooms", {
        params: { path: { propertyId } },
        body: { name: name.trim(), roomType },
      }),
    ),
  updateRoom: (room: Room, name: string, roomType: RoomType) =>
    unwrap(
      core.PATCH("/rooms/{roomId}", {
        params: { path: { roomId: room.id } },
        body: { name: name.trim(), roomType, version: room.version },
      }),
    ),
  /** Fails with RESOURCE_IN_USE when inspections or defects use the room. */
  deleteRoom: (roomId: string) => unwrap(core.DELETE("/rooms/{roomId}", { params: { path: { roomId } } })),
};

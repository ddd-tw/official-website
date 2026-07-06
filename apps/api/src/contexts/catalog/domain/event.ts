import type { EventStatus, VenueKind } from "@dddtw/contracts";
import { ValidationError } from "../../../shared/errors";

/** 活動目錄 BC — read-only aggregate sourced from content/events/*.json. */

export interface Speaker {
  speakerId: string;
  name: string;
  photoUrl: string | null;
  jobTitle: string | null;
  bio: string | null;
  topic: string | null;
}

export interface Venue {
  kind: VenueKind;
  address: string | null;
  meetingUrl: string | null;
}

/** Ticket-type *definition* — the registration BC owns the live counters. */
export interface TicketTypeDefinition {
  ticketTypeId: string;
  name: string;
  description: string | null;
  price: number;
  quota: number;
  salesOpensAt: Date;
  salesClosesAt: Date;
  requiresApproval: boolean;
}

export interface CatalogEvent {
  eventId: string;
  title: string;
  bannerUrl: string | null;
  summary: string;
  fullDescriptionMd: string;
  startsAt: Date;
  endsAt: Date;
  venue: Venue;
  status: EventStatus;
  tags: string[];
  speakers: Speaker[];
  ticketTypes: TicketTypeDefinition[];
}

const EVENT_STATUSES: readonly EventStatus[] = ["draft", "rc", "published", "ended"];
const VENUE_KINDS: readonly VenueKind[] = ["onsite", "online"];

function requireString(raw: Record<string, unknown>, field: string, source: string): string {
  const value = raw[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new ValidationError(`${source}: field "${field}" must be a non-empty string`);
  }
  return value;
}

function optionalString(raw: Record<string, unknown>, field: string, source: string): string | null {
  const value = raw[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ValidationError(`${source}: field "${field}" must be a string when present`);
  }
  return value;
}

function requireDate(raw: Record<string, unknown>, field: string, source: string): Date {
  const value = new Date(requireString(raw, field, source));
  if (Number.isNaN(value.getTime())) {
    throw new ValidationError(`${source}: field "${field}" must be an ISO 8601 date`);
  }
  return value;
}

function asRecord(value: unknown, what: string, source: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(`${source}: ${what} must be an object`);
  }
  return value as Record<string, unknown>;
}

/** Parses + validates one content file. Throws ValidationError on bad content. */
export function parseCatalogEvent(rawInput: unknown, source: string): CatalogEvent {
  const raw = asRecord(rawInput, "event", source);

  const status = requireString(raw, "status", source) as EventStatus;
  if (!EVENT_STATUSES.includes(status)) {
    throw new ValidationError(`${source}: invalid status "${status}"`);
  }

  const venueRaw = asRecord(raw.venue, "venue", source);
  const venueKind = requireString(venueRaw, "kind", source) as VenueKind;
  if (!VENUE_KINDS.includes(venueKind)) {
    throw new ValidationError(`${source}: invalid venue.kind "${venueKind}"`);
  }

  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  if (!tags.every((t): t is string => typeof t === "string")) {
    throw new ValidationError(`${source}: tags must be strings`);
  }

  const speakersRaw = Array.isArray(raw.speakers) ? raw.speakers : [];
  const speakers: Speaker[] = speakersRaw.map((entry, i) => {
    const s = asRecord(entry, `speakers[${i}]`, source);
    return {
      speakerId: requireString(s, "speakerId", source),
      name: requireString(s, "name", source),
      photoUrl: optionalString(s, "photoUrl", source),
      jobTitle: optionalString(s, "jobTitle", source),
      bio: optionalString(s, "bio", source),
      topic: optionalString(s, "topic", source),
    };
  });

  const ticketTypesRaw = Array.isArray(raw.ticketTypes) ? raw.ticketTypes : [];
  const ticketTypes: TicketTypeDefinition[] = ticketTypesRaw.map((entry, i) => {
    const t = asRecord(entry, `ticketTypes[${i}]`, source);
    const price = t.price;
    const quota = t.quota;
    if (typeof price !== "number" || !Number.isInteger(price) || price < 0) {
      throw new ValidationError(`${source}: ticketTypes[${i}].price must be a non-negative integer (TWD)`);
    }
    if (typeof quota !== "number" || !Number.isInteger(quota) || quota < 0) {
      throw new ValidationError(`${source}: ticketTypes[${i}].quota must be a non-negative integer`);
    }
    return {
      ticketTypeId: requireString(t, "ticketTypeId", source),
      name: requireString(t, "name", source),
      description: optionalString(t, "description", source),
      price,
      quota,
      salesOpensAt: requireDate(t, "salesOpensAt", source),
      salesClosesAt: requireDate(t, "salesClosesAt", source),
      requiresApproval: t.requiresApproval === true,
    };
  });

  return {
    eventId: requireString(raw, "eventId", source),
    title: requireString(raw, "title", source),
    bannerUrl: optionalString(raw, "bannerUrl", source),
    summary: requireString(raw, "summary", source),
    fullDescriptionMd: requireString(raw, "fullDescriptionMd", source),
    startsAt: requireDate(raw, "startsAt", source),
    endsAt: requireDate(raw, "endsAt", source),
    venue: {
      kind: venueKind,
      address: optionalString(venueRaw, "address", source),
      meetingUrl: optionalString(venueRaw, "meetingUrl", source),
    },
    status,
    tags,
    speakers,
    ticketTypes,
  };
}

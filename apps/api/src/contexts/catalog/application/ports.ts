import type { TicketTypeDto } from "@dddtw/contracts";
import type { CatalogEvent } from "../domain/event";

/** Read-only access to the GitHub-managed content. */
export interface EventCatalog {
  all(): CatalogEvent[];
  byId(eventId: string): CatalogEvent | null;
}

export type EventAvailability = "on_sale" | "sold_out" | "closed" | "upcoming";

/**
 * Cross-context port: the registration BC (owner of live seat counters)
 * supplies sale availability. Catalog only knows IDs — never the other
 * context's domain.
 */
export interface TicketAvailabilityPort {
  /** Availability per event, computed from live ticket-type counters. */
  eventAvailability(eventIds: string[]): Promise<Map<string, EventAvailability>>;
  /** Live ticket types (with `remaining`) for one event. */
  ticketTypesOf(eventId: string): Promise<TicketTypeDto[]>;
}

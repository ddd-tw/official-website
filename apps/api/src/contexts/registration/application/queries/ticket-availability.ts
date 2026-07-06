import type { TicketTypeDto } from "@dddtw/contracts";
import type { Clock } from "../../../../shared/ports";
import type { EventAvailability, TicketAvailabilityPort } from "../../../catalog/application/ports";
import { isOnSale, remainingOf, type TicketType } from "../../domain/ticket-type";
import type { TicketTypeRepository } from "../ports";

export function computeEventAvailability(ticketTypes: TicketType[], now: Date): EventAvailability {
  if (ticketTypes.length === 0) return "closed";
  const open = ticketTypes.filter((t) => isOnSale(t, now));
  if (open.length > 0) {
    return open.some((t) => remainingOf(t) > 0) ? "on_sale" : "sold_out";
  }
  const earliestOpen = Math.min(...ticketTypes.map((t) => t.salesOpensAt.getTime()));
  return now.getTime() < earliestOpen ? "upcoming" : "closed";
}

/**
 * Registration BC's implementation of the catalog's TicketAvailabilityPort —
 * this is the only place the two contexts meet, and only IDs cross it.
 */
export class TicketAvailabilityQuery implements TicketAvailabilityPort {
  constructor(
    private readonly ticketTypes: TicketTypeRepository,
    private readonly clock: Clock,
  ) {}

  async eventAvailability(eventIds: string[]): Promise<Map<string, EventAvailability>> {
    const now = this.clock.now();
    const result = new Map<string, EventAvailability>();
    for (const eventId of eventIds) {
      result.set(eventId, computeEventAvailability(await this.ticketTypes.byEventId(eventId), now));
    }
    return result;
  }

  async ticketTypesOf(eventId: string): Promise<TicketTypeDto[]> {
    const types = await this.ticketTypes.byEventId(eventId);
    return types.map((t) => ({
      ticketTypeId: t.ticketTypeId,
      name: t.name,
      description: t.description,
      price: t.price,
      quota: t.quota,
      remaining: remainingOf(t),
      salesOpensAt: t.salesOpensAt.toISOString(),
      salesClosesAt: t.salesClosesAt.toISOString(),
      requiresApproval: t.requiresApproval,
    }));
  }
}

import { SalesClosedError, SoldOutError } from "../../../shared/errors";

/**
 * TicketType aggregate. The `reserved <= quota` invariant is enforced
 * ATOMICALLY in SQL (conditional UPDATE … WHERE reserved < quota) via the
 * repository's tryReserve port — this class expresses the same rule for the
 * domain (and for in-memory fakes/tests).
 */
export interface TicketType {
  ticketTypeId: string;
  eventId: string;
  name: string;
  description: string | null;
  /** TWD 元; 0 = free */
  price: number;
  quota: number;
  reserved: number;
  salesOpensAt: Date;
  salesClosesAt: Date;
  requiresApproval: boolean;
}

export function remainingOf(ticketType: Pick<TicketType, "quota" | "reserved">): number {
  return Math.max(0, ticketType.quota - ticketType.reserved);
}

export function isOnSale(ticketType: Pick<TicketType, "salesOpensAt" | "salesClosesAt">, now: Date): boolean {
  return now >= ticketType.salesOpensAt && now <= ticketType.salesClosesAt;
}

export function canReserve(ticketType: Pick<TicketType, "quota" | "reserved">): boolean {
  return ticketType.reserved < ticketType.quota;
}

/** Guard used by submitRegistration before attempting the atomic reserve. */
export function assertPurchasable(ticketType: TicketType, now: Date): void {
  if (!isOnSale(ticketType, now)) {
    throw new SalesClosedError(`Sales for "${ticketType.name}" are closed`);
  }
  if (!canReserve(ticketType)) {
    throw new SoldOutError(`"${ticketType.name}" is sold out`);
  }
}

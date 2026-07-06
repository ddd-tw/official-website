import type { Registration } from "../domain/registration";
import type { Ticket } from "../domain/ticket";
import type { TicketType } from "../domain/ticket-type";

export interface TicketTypeRepository {
  byId(ticketTypeId: string): Promise<TicketType | null>;
  byEventId(eventId: string): Promise<TicketType[]>;
  /**
   * Atomic seat reservation — must be implemented as a conditional UPDATE
   * (`SET reserved = reserved + 1 WHERE reserved < quota`). Returns false
   * when the quota is exhausted.
   */
  tryReserve(ticketTypeId: string): Promise<boolean>;
  /** Releases one reserved seat (reject / cancel). Never goes below zero. */
  release(ticketTypeId: string): Promise<void>;
}

export interface RegistrationRepository {
  byId(registrationId: string): Promise<Registration | null>;
  insert(registration: Registration): Promise<void>;
  update(registration: Registration): Promise<void>;
}

export interface TicketRepository {
  byRegistrationId(registrationId: string): Promise<Ticket | null>;
  insert(ticket: Ticket): Promise<void>;
  /** Voids the registration's ticket(s) if any (cancel after confirm). */
  voidByRegistrationId(registrationId: string): Promise<void>;
}

/** Signs the QR payload for a ticket (HMAC — implemented in infrastructure). */
export interface QrTokenSigner {
  sign(payload: { ticketId: string; eventId: string }): string;
}

/**
 * Unit of work: one command = one transaction. All repositories handed to the
 * callback are bound to that transaction, and `publish` dispatches domain
 * events to in-process policies inside it.
 */
export interface RegistrationUnitOfWork {
  ticketTypes: TicketTypeRepository;
  registrations: RegistrationRepository;
  tickets: TicketRepository;
  publish(events: readonly import("../../../shared/domain-event").DomainEvent[]): Promise<void>;
}

export type RunInRegistrationTransaction = <T>(work: (uow: RegistrationUnitOfWork) => Promise<T>) => Promise<T>;

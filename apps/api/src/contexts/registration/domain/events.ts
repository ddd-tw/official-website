import type { PaymentStatus } from "@dddtw/contracts";
import type { DomainEvent } from "../../../shared/domain-event";

export interface RegistrationConfirmed extends DomainEvent {
  type: "RegistrationConfirmed";
  registrationId: string;
  eventId: string;
  ticketTypeId: string;
  attendeeName: string;
  attendeeEmail: string;
  payment: PaymentStatus;
}

export interface RegistrationRejected extends DomainEvent {
  type: "RegistrationRejected";
  registrationId: string;
  eventId: string;
  ticketTypeId: string;
  attendeeEmail: string;
  reason: string;
}

export interface RegistrationCancelled extends DomainEvent {
  type: "RegistrationCancelled";
  registrationId: string;
  eventId: string;
  ticketTypeId: string;
  attendeeEmail: string;
  /** true when the registration had already passed review (seat + possibly ticket held). */
  wasConfirmed: boolean;
}

export type RegistrationDomainEvent = RegistrationConfirmed | RegistrationRejected | RegistrationCancelled;

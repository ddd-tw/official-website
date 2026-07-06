import type { AttendeeInfoDto, RegistrationDto, TicketDto } from "@dddtw/contracts";
import type { Registration } from "../domain/registration";
import type { Ticket } from "../domain/ticket";

/** Cross-context port: catalog supplies display titles (IDs only cross the boundary). */
export interface EventInfoPort {
  titleOf(eventId: string): string | null;
}

export function toAttendeeInfoDto(registration: Registration): AttendeeInfoDto {
  const { attendee } = registration;
  return {
    name: attendee.name,
    email: attendee.email,
    ...(attendee.phone !== undefined ? { phone: attendee.phone } : {}),
    ...(attendee.diet !== undefined ? { diet: attendee.diet } : {}),
    ...(attendee.note !== undefined ? { note: attendee.note } : {}),
  };
}

export function toTicketDto(ticket: Ticket): TicketDto {
  return { ticketId: ticket.ticketId, status: ticket.status, qrToken: ticket.qrToken };
}

export function toRegistrationDto(
  registration: Registration,
  ticket: Ticket | null,
  eventTitle: string,
  ticketTypeName: string,
): RegistrationDto {
  return {
    registrationId: registration.registrationId,
    eventId: registration.eventId,
    eventTitle,
    ticketTypeId: registration.ticketTypeId,
    ticketTypeName,
    attendee: toAttendeeInfoDto(registration),
    status: registration.status,
    payment: registration.payment,
    ticket: ticket && ticket.status !== "void" ? toTicketDto(ticket) : null,
    submittedAt: registration.submittedAt.toISOString(),
  };
}

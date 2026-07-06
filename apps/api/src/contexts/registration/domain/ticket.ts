import type { TicketStatus } from "@dddtw/contracts";

/** Ticket entity — issued on RegistrationConfirmed; checked_in is terminal. */
export interface Ticket {
  ticketId: string;
  registrationId: string;
  qrToken: string;
  status: TicketStatus;
  issuedAt: Date;
  checkedInAt: Date | null;
}

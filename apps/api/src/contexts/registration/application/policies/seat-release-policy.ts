import type { RegistrationCancelled, RegistrationRejected } from "../../domain/events";
import type { TicketRepository, TicketTypeRepository } from "../ports";

/**
 * Policy: rejected or cancelled registrations give their reserved seat back
 * (atomic decrement); a cancelled-after-confirm registration also voids its
 * issued ticket. Runs inside the command's transaction.
 */
export class SeatReleasePolicy {
  constructor(
    private readonly ticketTypes: TicketTypeRepository,
    private readonly tickets: TicketRepository,
  ) {}

  async onRegistrationRejected(event: RegistrationRejected): Promise<void> {
    await this.ticketTypes.release(event.ticketTypeId);
  }

  async onRegistrationCancelled(event: RegistrationCancelled): Promise<void> {
    await this.ticketTypes.release(event.ticketTypeId);
    if (event.wasConfirmed) {
      await this.tickets.voidByRegistrationId(event.registrationId);
    }
  }
}

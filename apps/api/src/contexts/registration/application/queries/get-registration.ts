import type { RegistrationDto } from "@dddtw/contracts";
import { NotFoundError, ValidationError } from "../../../../shared/errors";
import { toRegistrationDto, type EventInfoPort } from "../dto";
import type { RegistrationRepository, TicketRepository, TicketTypeRepository } from "../ports";

export class GetRegistration {
  constructor(
    private readonly registrations: RegistrationRepository,
    private readonly tickets: TicketRepository,
    private readonly ticketTypes: TicketTypeRepository,
    private readonly eventInfo: EventInfoPort,
  ) {}

  /** Owner lookup — the email must match the attendee's. */
  async execute(registrationId: string, email: string): Promise<RegistrationDto> {
    if (!email?.trim()) throw new ValidationError("email query parameter is required");

    const registration = await this.registrations.byId(registrationId);
    if (!registration || !registration.attendee.emailMatches(email)) {
      throw new NotFoundError(`Registration ${registrationId} not found`);
    }

    const [ticket, ticketType] = await Promise.all([
      this.tickets.byRegistrationId(registration.registrationId),
      this.ticketTypes.byId(registration.ticketTypeId),
    ]);
    return toRegistrationDto(
      registration,
      ticket,
      this.eventInfo.titleOf(registration.eventId) ?? registration.eventId,
      ticketType?.name ?? registration.ticketTypeId,
    );
  }
}

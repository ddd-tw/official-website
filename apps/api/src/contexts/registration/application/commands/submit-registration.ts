import type { RegistrationDto, SubmitRegistrationRequest } from "@dddtw/contracts";
import { NotFoundError, SoldOutError } from "../../../../shared/errors";
import type { Clock, IdGenerator } from "../../../../shared/ports";
import { Attendee } from "../../domain/attendee";
import { Registration } from "../../domain/registration";
import { assertPurchasable } from "../../domain/ticket-type";
import { toRegistrationDto, type EventInfoPort } from "../dto";
import type { RunInRegistrationTransaction } from "../ports";

export class SubmitRegistration {
  constructor(
    private readonly runInTransaction: RunInRegistrationTransaction,
    private readonly eventInfo: EventInfoPort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(eventId: string, request: SubmitRegistrationRequest): Promise<RegistrationDto> {
    const eventTitle = this.eventInfo.titleOf(eventId);
    if (eventTitle === null) throw new NotFoundError(`Event ${eventId} not found`);

    const attendee = Attendee.create(request.attendee); // throws ValidationError → 422
    const now = this.clock.now();

    return this.runInTransaction(async (uow) => {
      const ticketType = await uow.ticketTypes.byId(request.ticketTypeId);
      if (!ticketType || ticketType.eventId !== eventId) {
        throw new NotFoundError(`Ticket type ${request.ticketTypeId} not found for event ${eventId}`);
      }
      assertPurchasable(ticketType, now); // SALES_CLOSED / SOLD_OUT

      // The invariant reserved <= quota is enforced atomically in SQL.
      const reserved = await uow.ticketTypes.tryReserve(ticketType.ticketTypeId);
      if (!reserved) throw new SoldOutError(`"${ticketType.name}" is sold out`);

      const registration = Registration.submit({
        registrationId: this.idGenerator.next(),
        eventId,
        ticketTypeId: ticketType.ticketTypeId,
        attendee,
        requiresApproval: ticketType.requiresApproval,
        price: ticketType.price,
        now,
      });
      await uow.registrations.insert(registration);
      await uow.publish(registration.pullDomainEvents()); // may issue the ticket

      const ticket = await uow.tickets.byRegistrationId(registration.registrationId);
      return toRegistrationDto(registration, ticket, eventTitle, ticketType.name);
    });
  }
}

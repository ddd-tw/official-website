import type { RegistrationDto } from "@dddtw/contracts";
import { NotFoundError } from "../../../../shared/errors";
import type { Registration } from "../../domain/registration";
import { toRegistrationDto, type EventInfoPort } from "../dto";
import type { RegistrationUnitOfWork, RunInRegistrationTransaction } from "../ports";

/**
 * Shared skeleton for state-changing commands on an existing registration:
 * load → mutate (domain behavior) → persist → publish events → map DTO.
 * Each concrete command stays a single-responsibility class.
 */
export abstract class RegistrationCommand {
  constructor(
    protected readonly runInTransaction: RunInRegistrationTransaction,
    protected readonly eventInfo: EventInfoPort,
  ) {}

  protected async mutate(
    registrationId: string,
    behavior: (registration: Registration, uow: RegistrationUnitOfWork) => void | Promise<void>,
  ): Promise<RegistrationDto> {
    return this.runInTransaction(async (uow) => {
      const registration = await uow.registrations.byId(registrationId);
      if (!registration) throw new NotFoundError(`Registration ${registrationId} not found`);

      await behavior(registration, uow);

      await uow.registrations.update(registration);
      await uow.publish(registration.pullDomainEvents());

      const [ticket, ticketType] = await Promise.all([
        uow.tickets.byRegistrationId(registration.registrationId),
        uow.ticketTypes.byId(registration.ticketTypeId),
      ]);
      return toRegistrationDto(
        registration,
        ticket,
        this.eventInfo.titleOf(registration.eventId) ?? registration.eventId,
        ticketType?.name ?? registration.ticketTypeId,
      );
    });
  }
}

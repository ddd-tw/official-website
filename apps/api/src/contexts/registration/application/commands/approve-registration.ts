import type { RegistrationDto } from "@dddtw/contracts";
import type { Clock } from "../../../../shared/ports";
import type { EventInfoPort } from "../dto";
import type { RunInRegistrationTransaction } from "../ports";
import { RegistrationCommand } from "./registration-command-base";

export class ApproveRegistration extends RegistrationCommand {
  constructor(
    runInTransaction: RunInRegistrationTransaction,
    eventInfo: EventInfoPort,
    private readonly clock: Clock,
  ) {
    super(runInTransaction, eventInfo);
  }

  async execute(registrationId: string): Promise<RegistrationDto> {
    return this.mutate(registrationId, (registration) => {
      registration.approve(this.clock.now()); // → RegistrationConfirmed → TicketIssuancePolicy
    });
  }
}

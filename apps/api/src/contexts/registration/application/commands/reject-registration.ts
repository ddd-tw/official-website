import type { RegistrationDto } from "@dddtw/contracts";
import { ValidationError } from "../../../../shared/errors";
import type { Clock } from "../../../../shared/ports";
import type { EventInfoPort } from "../dto";
import type { RunInRegistrationTransaction } from "../ports";
import { RegistrationCommand } from "./registration-command-base";

export class RejectRegistration extends RegistrationCommand {
  constructor(
    runInTransaction: RunInRegistrationTransaction,
    eventInfo: EventInfoPort,
    private readonly clock: Clock,
  ) {
    super(runInTransaction, eventInfo);
  }

  async execute(registrationId: string, reason: string): Promise<RegistrationDto> {
    const trimmed = reason?.trim();
    if (!trimmed) throw new ValidationError("reason is required");
    return this.mutate(registrationId, (registration) => {
      registration.reject(trimmed, this.clock.now()); // → RegistrationRejected → seat released
    });
  }
}

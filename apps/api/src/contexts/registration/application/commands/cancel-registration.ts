import type { RegistrationDto } from "@dddtw/contracts";
import { NotFoundError, ValidationError } from "../../../../shared/errors";
import type { Clock } from "../../../../shared/ports";
import type { EventInfoPort } from "../dto";
import type { RunInRegistrationTransaction } from "../ports";
import { RegistrationCommand } from "./registration-command-base";

export class CancelRegistration extends RegistrationCommand {
  constructor(
    runInTransaction: RunInRegistrationTransaction,
    eventInfo: EventInfoPort,
    private readonly clock: Clock,
  ) {
    super(runInTransaction, eventInfo);
  }

  /** Self-service cancel — the caller must prove ownership with the attendee email. */
  async execute(registrationId: string, email: string): Promise<RegistrationDto> {
    if (!email?.trim()) throw new ValidationError("email is required");
    return this.mutate(registrationId, (registration) => {
      if (!registration.attendee.emailMatches(email)) {
        // Do not leak existence to non-owners.
        throw new NotFoundError(`Registration ${registrationId} not found`);
      }
      registration.cancel(this.clock.now()); // → RegistrationCancelled → seat released (+ ticket voided)
    });
  }
}

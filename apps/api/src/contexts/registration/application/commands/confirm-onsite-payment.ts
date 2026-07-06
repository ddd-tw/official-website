import type { RegistrationDto } from "@dddtw/contracts";
import type { EventInfoPort } from "../dto";
import type { RunInRegistrationTransaction } from "../ports";
import { RegistrationCommand } from "./registration-command-base";

/** MVP 決議: 現場繳費 — staff marks a confirmed & unpaid registration as paid onsite. */
export class ConfirmOnsitePayment extends RegistrationCommand {
  constructor(runInTransaction: RunInRegistrationTransaction, eventInfo: EventInfoPort) {
    super(runInTransaction, eventInfo);
  }

  async execute(registrationId: string): Promise<RegistrationDto> {
    return this.mutate(registrationId, (registration) => {
      registration.confirmOnsitePayment();
    });
  }
}

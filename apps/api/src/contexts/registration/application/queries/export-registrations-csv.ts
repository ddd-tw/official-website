import { NotFoundError } from "../../../../shared/errors";
import type { EventInfoPort } from "../dto";
import type { RegistrationReadModel } from "./read-model";

function csvCell(value: string | null): string {
  if (value === null || value === "") return "";
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export class ExportRegistrationsCsv {
  constructor(
    private readonly readModel: RegistrationReadModel,
    private readonly eventInfo: EventInfoPort,
  ) {}

  async execute(eventId: string): Promise<string> {
    if (this.eventInfo.titleOf(eventId) === null) throw new NotFoundError(`Event ${eventId} not found`);
    const rows = await this.readModel.listByEvent(eventId);
    const header = [
      "registrationId",
      "ticketTypeName",
      "name",
      "email",
      "phone",
      "diet",
      "note",
      "status",
      "payment",
      "submittedAt",
      "reviewedAt",
      "rejectReason",
    ].join(",");
    const lines = rows.map((r) =>
      [
        r.registrationId,
        r.ticketTypeName,
        r.attendeeName,
        r.attendeeEmail,
        r.attendeePhone,
        r.attendeeDiet,
        r.attendeeNote,
        r.status,
        r.payment,
        r.submittedAt.toISOString(),
        r.reviewedAt ? r.reviewedAt.toISOString() : null,
        r.rejectReason,
      ]
        .map(csvCell)
        .join(","),
    );
    return [header, ...lines].join("\r\n") + "\r\n";
  }
}

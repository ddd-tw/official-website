import type { AdminRegistrationListItemDto, RegistrationStatus, ReviewStatsDto } from "@dddtw/contracts";
import { NotFoundError, ValidationError } from "../../../../shared/errors";
import type { EventInfoPort } from "../dto";
import type { RegistrationListRow, RegistrationReadModel } from "./read-model";

const STATUSES: readonly RegistrationStatus[] = [
  "submitted",
  "pending_review",
  "rejected",
  "confirmed",
  "cancelled",
  "checked_in",
  "no_show",
];

export function toAdminListItemDto(row: RegistrationListRow): AdminRegistrationListItemDto {
  return {
    registrationId: row.registrationId,
    ticketTypeName: row.ticketTypeName,
    attendee: {
      name: row.attendeeName,
      email: row.attendeeEmail,
      ...(row.attendeePhone !== null ? { phone: row.attendeePhone } : {}),
      ...(row.attendeeDiet !== null ? { diet: row.attendeeDiet } : {}),
      ...(row.attendeeNote !== null ? { note: row.attendeeNote } : {}),
    },
    status: row.status,
    payment: row.payment,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    rejectReason: row.rejectReason,
  };
}

export class ListRegistrationsForAdmin {
  constructor(
    private readonly readModel: RegistrationReadModel,
    private readonly eventInfo: EventInfoPort,
  ) {}

  async execute(
    eventId: string,
    status?: string,
  ): Promise<{ items: AdminRegistrationListItemDto[]; stats: ReviewStatsDto }> {
    if (this.eventInfo.titleOf(eventId) === null) throw new NotFoundError(`Event ${eventId} not found`);
    let filter: RegistrationStatus | undefined;
    if (status !== undefined) {
      if (!STATUSES.includes(status as RegistrationStatus)) {
        throw new ValidationError(`invalid status filter "${status}"`);
      }
      filter = status as RegistrationStatus;
    }

    const [rows, stats] = await Promise.all([
      this.readModel.listByEvent(eventId, filter),
      this.readModel.reviewStats(eventId),
    ]);
    return { items: rows.map(toAdminListItemDto), stats };
  }
}

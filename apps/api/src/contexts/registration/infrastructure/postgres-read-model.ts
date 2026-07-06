import type { SQL } from "bun";
import type { RegistrationStatus } from "@dddtw/contracts";
import type { RegistrationListRow, RegistrationReadModel } from "../application/queries/read-model";

interface Row {
  registration_id: string;
  ticket_type_name: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string | null;
  attendee_diet: string | null;
  attendee_note: string | null;
  status: RegistrationStatus;
  payment: RegistrationListRow["payment"];
  submitted_at: Date;
  reviewed_at: Date | null;
  reject_reason: string | null;
}

function toListRow(row: Row): RegistrationListRow {
  return {
    registrationId: row.registration_id,
    ticketTypeName: row.ticket_type_name,
    attendeeName: row.attendee_name,
    attendeeEmail: row.attendee_email,
    attendeePhone: row.attendee_phone,
    attendeeDiet: row.attendee_diet,
    attendeeNote: row.attendee_note,
    status: row.status,
    payment: row.payment,
    submittedAt: new Date(row.submitted_at),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
    rejectReason: row.reject_reason,
  };
}

export class PostgresRegistrationReadModel implements RegistrationReadModel {
  constructor(private readonly sql: SQL) {}

  async listByEvent(eventId: string, status?: RegistrationStatus): Promise<RegistrationListRow[]> {
    const rows = await this.sql<Row[]>`
      SELECT r.registration_id, tt.name AS ticket_type_name,
             r.attendee_name, r.attendee_email, r.attendee_phone, r.attendee_diet, r.attendee_note,
             r.status, r.payment, r.submitted_at, r.reviewed_at, r.reject_reason
        FROM registrations r
        JOIN ticket_types tt ON tt.ticket_type_id = r.ticket_type_id
       WHERE r.event_id = ${eventId}
         AND (${status ?? null}::text IS NULL OR r.status = ${status ?? null})
       ORDER BY r.submitted_at ASC`;
    return rows.map(toListRow);
  }

  async reviewStats(eventId: string): Promise<{ pendingReview: number; approved: number; rejected: number }> {
    const rows = await this.sql<{ pending_review: number; approved: number; rejected: number }[]>`
      SELECT count(*) FILTER (WHERE status = 'pending_review')::int AS pending_review,
             count(*) FILTER (WHERE status IN ('confirmed', 'checked_in') AND reviewed_at IS NOT NULL)::int AS approved,
             count(*) FILTER (WHERE status = 'rejected')::int AS rejected
        FROM registrations
       WHERE event_id = ${eventId}`;
    const row = rows[0] ?? { pending_review: 0, approved: 0, rejected: 0 };
    return {
      pendingReview: Number(row.pending_review),
      approved: Number(row.approved),
      rejected: Number(row.rejected),
    };
  }
}

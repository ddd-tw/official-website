import type { SQL } from "bun";
import type { TicketStatus } from "@dddtw/contracts";
import { verifyQrToken } from "../../../shared/qr-token";
import type { CheckInRecord } from "../domain/check-in-record";
import type {
  AdmissionStore,
  AdmissionTicket,
  CheckInRecordRepository,
  CheckinUnitOfWork,
  QrTokenVerifier,
  RunInCheckinTransaction,
} from "../application/ports";
import type { AttendanceRow, CheckinReadModel, ManifestEntry } from "../application/queries/read-model";

export class HmacQrTokenVerifier implements QrTokenVerifier {
  constructor(private readonly secret: string) {}

  verify(token: string): { ticketId: string; eventId: string } | null {
    return verifyQrToken(token, this.secret);
  }
}

export class PostgresAdmissionStore implements AdmissionStore {
  constructor(private readonly sql: SQL) {}

  async findTicket(ticketId: string): Promise<AdmissionTicket | null> {
    const rows = await this.sql<
      {
        ticket_id: string;
        event_id: string;
        ticket_status: TicketStatus;
        registration_status: string;
        attendee_name: string;
        ticket_type_name: string;
        checked_in_at: Date | null;
      }[]
    >`
      SELECT t.ticket_id, r.event_id, t.status AS ticket_status, r.status AS registration_status,
             r.attendee_name, tt.name AS ticket_type_name, t.checked_in_at
        FROM tickets t
        JOIN registrations r ON r.registration_id = t.registration_id
        JOIN ticket_types tt ON tt.ticket_type_id = r.ticket_type_id
       WHERE t.ticket_id = ${ticketId}
       FOR UPDATE OF t`;
    const row = rows[0];
    if (!row) return null;
    return {
      ticketId: row.ticket_id,
      eventId: row.event_id,
      ticketStatus: row.ticket_status,
      admissible: row.registration_status === "confirmed" || row.registration_status === "checked_in",
      attendeeName: row.attendee_name,
      ticketTypeName: row.ticket_type_name,
      checkedInAt: row.checked_in_at ? new Date(row.checked_in_at) : null,
    };
  }

  async markCheckedIn(ticketId: string, at: Date): Promise<void> {
    await this.sql`
      UPDATE tickets SET status = 'checked_in', checked_in_at = ${at}, updated_at = now()
       WHERE ticket_id = ${ticketId}`;
    await this.sql`
      UPDATE registrations SET status = 'checked_in', updated_at = now()
       WHERE registration_id = (SELECT registration_id FROM tickets WHERE ticket_id = ${ticketId})
         AND status = 'confirmed'`;
  }
}

export class PostgresCheckInRecordRepository implements CheckInRecordRepository {
  constructor(private readonly sql: SQL) {}

  async append(record: CheckInRecord): Promise<void> {
    await this.sql`
      INSERT INTO check_in_records (record_id, ticket_id, gate, scanned_at, result)
      VALUES (${record.recordId}, ${record.ticketId}, ${record.gate}, ${record.scannedAt}, ${record.result})`;
  }

  async firstSuccessAt(ticketId: string): Promise<Date | null> {
    const rows = await this.sql<{ scanned_at: Date }[]>`
      SELECT scanned_at FROM check_in_records
       WHERE ticket_id = ${ticketId} AND result = 'success'
       ORDER BY scanned_at ASC LIMIT 1`;
    return rows[0] ? new Date(rows[0].scanned_at) : null;
  }
}

export function makeRunInCheckinTransaction(sql: SQL): RunInCheckinTransaction {
  return async <T>(work: (uow: CheckinUnitOfWork) => Promise<T>): Promise<T> => {
    return (await sql.begin(async (tx) => {
      const txSql = tx as unknown as SQL;
      return work({
        admission: new PostgresAdmissionStore(txSql),
        records: new PostgresCheckInRecordRepository(txSql),
      });
    })) as T;
  };
}

export class PostgresCheckinReadModel implements CheckinReadModel {
  constructor(private readonly sql: SQL) {}

  async attendanceByTicketType(eventId: string): Promise<AttendanceRow[]> {
    const rows = await this.sql<{ ticket_type_name: string; confirmed: number; checked_in: number }[]>`
      SELECT tt.name AS ticket_type_name,
             count(*) FILTER (WHERE r.status IN ('confirmed', 'checked_in'))::int AS confirmed,
             count(*) FILTER (WHERE r.status = 'checked_in')::int AS checked_in
        FROM registrations r
        JOIN ticket_types tt ON tt.ticket_type_id = r.ticket_type_id
       WHERE r.event_id = ${eventId}
       GROUP BY tt.name
       ORDER BY tt.name`;
    return rows.map((r) => ({
      ticketTypeName: r.ticket_type_name,
      confirmed: Number(r.confirmed),
      checkedIn: Number(r.checked_in),
    }));
  }

  async manifestEntries(eventId: string): Promise<ManifestEntry[]> {
    const rows = await this.sql<
      { ticket_id: string; attendee_name: string; ticket_type_name: string; status: TicketStatus }[]
    >`
      SELECT t.ticket_id, r.attendee_name, tt.name AS ticket_type_name, t.status
        FROM tickets t
        JOIN registrations r ON r.registration_id = t.registration_id
        JOIN ticket_types tt ON tt.ticket_type_id = r.ticket_type_id
       WHERE r.event_id = ${eventId}
       ORDER BY r.attendee_name`;
    return rows.map((r) => ({
      ticketId: r.ticket_id,
      attendeeName: r.attendee_name,
      ticketTypeName: r.ticket_type_name,
      status: r.status,
    }));
  }
}

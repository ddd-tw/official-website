import type { TicketStatus } from "@dddtw/contracts";

export interface AttendanceRow {
  ticketTypeName: string;
  confirmed: number;
  checkedIn: number;
}

export interface ManifestEntry {
  ticketId: string;
  attendeeName: string;
  ticketTypeName: string;
  status: TicketStatus;
}

/** CQS read model for check-in dashboards/offline manifest. */
export interface CheckinReadModel {
  attendanceByTicketType(eventId: string): Promise<AttendanceRow[]>;
  manifestEntries(eventId: string): Promise<ManifestEntry[]>;
}

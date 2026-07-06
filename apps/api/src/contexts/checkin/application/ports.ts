import type { CheckInRecord } from "../domain/check-in-record";

/** Verifies the HMAC-signed QR token (implemented in infrastructure). */
export interface QrTokenVerifier {
  verify(token: string): { ticketId: string; eventId: string } | null;
}

/**
 * Read/write access to admission state. Check-in never touches the
 * registration BC's domain — only this port (IDs + flat data cross over).
 */
export interface AdmissionTicket {
  ticketId: string;
  eventId: string;
  ticketStatus: "issued" | "checked_in" | "void";
  /** false when the underlying registration is cancelled/rejected/etc. */
  admissible: boolean;
  attendeeName: string;
  ticketTypeName: string;
  checkedInAt: Date | null;
}

export interface AdmissionStore {
  findTicket(ticketId: string): Promise<AdmissionTicket | null>;
  /** Marks ticket AND its registration as checked_in. */
  markCheckedIn(ticketId: string, at: Date): Promise<void>;
}

export interface CheckInRecordRepository {
  append(record: CheckInRecord): Promise<void>;
  /** First successful scan time for a ticket (fallback for duplicate responses). */
  firstSuccessAt(ticketId: string): Promise<Date | null>;
}

export interface CheckinUnitOfWork {
  admission: AdmissionStore;
  records: CheckInRecordRepository;
}

export type RunInCheckinTransaction = <T>(work: (uow: CheckinUnitOfWork) => Promise<T>) => Promise<T>;

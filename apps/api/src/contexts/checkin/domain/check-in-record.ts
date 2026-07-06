import type { ScanResult } from "@dddtw/contracts";

/**
 * CheckInRecord — append-only audit log of every scan attempt.
 * Records are never updated or deleted; a second successful scan of the same
 * ticket is recorded as `duplicate`.
 */
export interface CheckInRecord {
  recordId: string;
  /** null when the QR token could not even be parsed/verified. */
  ticketId: string | null;
  gate: string | null;
  scannedAt: Date;
  result: ScanResult;
}

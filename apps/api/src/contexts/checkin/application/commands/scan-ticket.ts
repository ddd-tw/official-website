import type { ScanRequest, ScanResponse } from "@dddtw/contracts";
import type { Clock, IdGenerator } from "../../../../shared/ports";
import type { CheckinUnitOfWork, QrTokenVerifier, RunInCheckinTransaction } from "../ports";

/**
 * scanTicket — one transaction per scan:
 *   1. verify HMAC signature → invalid when forged/malformed
 *   2. look up the ticket → invalid when unknown / void / not admissible
 *   3. already checked_in → duplicate (with firstScannedAt)
 *   4. otherwise mark ticket + registration checked_in and append a success
 *      record (check_in_records stays append-only for the audit trail)
 */
export class ScanTicket {
  constructor(
    private readonly runInTransaction: RunInCheckinTransaction,
    private readonly verifier: QrTokenVerifier,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(request: ScanRequest): Promise<ScanResponse> {
    const scannedAt = this.clock.now();
    const gate = request.gate?.trim() || null;
    const payload = this.verifier.verify(request.qrToken ?? "");

    return this.runInTransaction(async (uow) => {
      const record = (ticketId: string | null, result: "success" | "duplicate" | "invalid") =>
        uow.records.append({ recordId: this.idGenerator.next(), ticketId, gate, scannedAt, result });

      if (!payload) {
        await record(null, "invalid");
        return { result: "invalid", scannedAt: scannedAt.toISOString() } satisfies ScanResponse;
      }

      const ticket = await uow.admission.findTicket(payload.ticketId);
      if (!ticket || ticket.eventId !== payload.eventId || ticket.ticketStatus === "void" || !ticket.admissible) {
        await record(payload.ticketId, "invalid");
        return { result: "invalid", scannedAt: scannedAt.toISOString() } satisfies ScanResponse;
      }

      if (ticket.ticketStatus === "checked_in") {
        await record(ticket.ticketId, "duplicate");
        const firstScannedAt = ticket.checkedInAt ?? (await uow.records.firstSuccessAt(ticket.ticketId));
        return {
          result: "duplicate",
          ...(firstScannedAt ? { firstScannedAt: firstScannedAt.toISOString() } : {}),
          attendeeName: ticket.attendeeName,
          ticketTypeName: ticket.ticketTypeName,
          scannedAt: scannedAt.toISOString(),
        } satisfies ScanResponse;
      }

      await uow.admission.markCheckedIn(ticket.ticketId, scannedAt);
      await record(ticket.ticketId, "success");
      return {
        result: "success",
        attendeeName: ticket.attendeeName,
        ticketTypeName: ticket.ticketTypeName,
        scannedAt: scannedAt.toISOString(),
      } satisfies ScanResponse;
    });
  }
}

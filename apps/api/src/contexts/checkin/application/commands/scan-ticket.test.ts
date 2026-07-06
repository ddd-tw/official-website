import { describe, expect, test } from "bun:test";
import { signQrToken, verifyQrToken } from "../../../../shared/qr-token";
import type { CheckInRecord } from "../../domain/check-in-record";
import type { AdmissionStore, AdmissionTicket, CheckInRecordRepository, CheckinUnitOfWork } from "../ports";
import { ScanTicket } from "./scan-ticket";

const SECRET = "test-secret";
const NOW = new Date("2026-09-12T01:05:00Z");

class FakeAdmissionStore implements AdmissionStore {
  constructor(public tickets: Map<string, AdmissionTicket>) {}
  async findTicket(ticketId: string): Promise<AdmissionTicket | null> {
    return this.tickets.get(ticketId) ?? null;
  }
  async markCheckedIn(ticketId: string, at: Date): Promise<void> {
    const t = this.tickets.get(ticketId);
    if (t) {
      t.ticketStatus = "checked_in";
      t.checkedInAt = at;
    }
  }
}

class FakeRecordRepo implements CheckInRecordRepository {
  records: CheckInRecord[] = [];
  async append(record: CheckInRecord): Promise<void> {
    this.records.push(record);
  }
  async firstSuccessAt(ticketId: string): Promise<Date | null> {
    return this.records.find((r) => r.ticketId === ticketId && r.result === "success")?.scannedAt ?? null;
  }
}

function makeScanner(tickets: AdmissionTicket[]) {
  const admission = new FakeAdmissionStore(new Map(tickets.map((t) => [t.ticketId, t])));
  const records = new FakeRecordRepo();
  const uow: CheckinUnitOfWork = { admission, records };
  const scanner = new ScanTicket(
    async (work) => work(uow), // in-memory "transaction"
    { verify: (token) => verifyQrToken(token, SECRET) },
    { next: () => crypto.randomUUID() },
    { now: () => NOW },
  );
  return { scanner, admission, records };
}

function issuedTicket(overrides: Partial<AdmissionTicket> = {}): AdmissionTicket {
  return {
    ticketId: "t-1",
    eventId: "evt-1",
    ticketStatus: "issued",
    admissible: true,
    attendeeName: "Alice",
    ticketTypeName: "一般票",
    checkedInAt: null,
    ...overrides,
  };
}

describe("ScanTicket", () => {
  test("valid signed token for an issued ticket → success and records it", async () => {
    const { scanner, admission, records } = makeScanner([issuedTicket()]);
    const token = signQrToken({ ticketId: "t-1", eventId: "evt-1" }, SECRET);

    const res = await scanner.execute({ qrToken: token, gate: "A" });
    expect(res.result).toBe("success");
    expect(res.attendeeName).toBe("Alice");
    expect(res.ticketTypeName).toBe("一般票");
    expect(admission.tickets.get("t-1")?.ticketStatus).toBe("checked_in");
    expect(records.records.map((r) => r.result)).toEqual(["success"]);
    expect(records.records[0]?.gate).toBe("A");
  });

  test("second scan of the same ticket → duplicate with firstScannedAt", async () => {
    const { scanner } = makeScanner([issuedTicket()]);
    const token = signQrToken({ ticketId: "t-1", eventId: "evt-1" }, SECRET);

    await scanner.execute({ qrToken: token });
    const second = await scanner.execute({ qrToken: token });
    expect(second.result).toBe("duplicate");
    expect(second.firstScannedAt).toBe(NOW.toISOString());
    expect(second.attendeeName).toBe("Alice");
  });

  test("tampered token → invalid, recorded without a ticketId", async () => {
    const { scanner, records } = makeScanner([issuedTicket()]);
    const token = signQrToken({ ticketId: "t-1", eventId: "evt-1" }, SECRET);
    const res = await scanner.execute({ qrToken: token.slice(0, -4) + "AAAA" });
    expect(res.result).toBe("invalid");
    expect(records.records).toHaveLength(1);
    expect(records.records[0]?.ticketId).toBeNull();
  });

  test("well-signed token for an unknown ticket → invalid", async () => {
    const { scanner } = makeScanner([]);
    const token = signQrToken({ ticketId: "ghost", eventId: "evt-1" }, SECRET);
    const res = await scanner.execute({ qrToken: token });
    expect(res.result).toBe("invalid");
  });

  test("void ticket or cancelled registration → invalid", async () => {
    const { scanner } = makeScanner([
      issuedTicket({ ticketId: "t-void", ticketStatus: "void" }),
      issuedTicket({ ticketId: "t-cancelled", admissible: false }),
    ]);
    expect(
      (await scanner.execute({ qrToken: signQrToken({ ticketId: "t-void", eventId: "evt-1" }, SECRET) })).result,
    ).toBe("invalid");
    expect(
      (await scanner.execute({ qrToken: signQrToken({ ticketId: "t-cancelled", eventId: "evt-1" }, SECRET) }))
        .result,
    ).toBe("invalid");
  });

  test("token whose eventId does not match the ticket → invalid", async () => {
    const { scanner } = makeScanner([issuedTicket()]);
    const res = await scanner.execute({
      qrToken: signQrToken({ ticketId: "t-1", eventId: "another-event" }, SECRET),
    });
    expect(res.result).toBe("invalid");
  });
});

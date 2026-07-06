import { describe, expect, test } from "bun:test";
import { makeTestEnv, makeTicketType, seedRegistration, NOW } from "../testing/fakes";
import { RejectRegistration } from "./reject-registration";

function makeHandler(env: ReturnType<typeof makeTestEnv>) {
  return new RejectRegistration(env.runInTransaction, env.eventInfo, env.clock);
}

describe("RejectRegistration use case", () => {
  test("pending_review → rejected with reason, reviewedAt set, seat released, no ticket, no email", async () => {
    const env = makeTestEnv({ ticketTypes: [makeTicketType({ reserved: 1 })] });
    seedRegistration(env, { status: "pending_review" });

    const dto = await makeHandler(env).execute("reg-1", "志工名額已滿");

    expect(dto.status).toBe("rejected");
    expect(dto.ticket).toBeNull();
    expect(env.registrations.items.get("reg-1")?.rejectReason).toBe("志工名額已滿");
    expect(env.registrations.items.get("reg-1")?.reviewedAt).toEqual(NOW);
    expect(env.ticketTypes.items[0]?.reserved).toBe(0); // SeatReleasePolicy gave the seat back
    expect(env.tickets.items).toHaveLength(0);
    expect(env.emailSender.sent).toHaveLength(0);
  });

  test("missing/blank reason → VALIDATION_ERROR, state untouched", async () => {
    const env = makeTestEnv();
    seedRegistration(env, { status: "pending_review" });
    await expect(makeHandler(env).execute("reg-1", "   ")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(env.registrations.items.get("reg-1")?.status).toBe("pending_review");
  });

  test.each(["confirmed", "rejected", "cancelled", "checked_in"] as const)(
    "reject from %s → INVALID_STATE and seat NOT released",
    async (status) => {
      const env = makeTestEnv({ ticketTypes: [makeTicketType({ reserved: 1 })] });
      seedRegistration(env, { status });
      await expect(makeHandler(env).execute("reg-1", "too late")).rejects.toMatchObject({ code: "INVALID_STATE" });
      expect(env.ticketTypes.items[0]?.reserved).toBe(1);
    },
  );

  test("unknown registration → NOT_FOUND", async () => {
    const env = makeTestEnv();
    await expect(makeHandler(env).execute("ghost", "reason")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

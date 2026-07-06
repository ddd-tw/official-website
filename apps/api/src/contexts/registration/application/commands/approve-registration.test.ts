import { describe, expect, test } from "bun:test";
import { verifyQrToken } from "../../../../shared/qr-token";
import { makeTestEnv, seedRegistration, NOW, TEST_SECRET } from "../testing/fakes";
import { ApproveRegistration } from "./approve-registration";

function makeHandler(env: ReturnType<typeof makeTestEnv>) {
  return new ApproveRegistration(env.runInTransaction, env.eventInfo, env.clock);
}

describe("ApproveRegistration use case", () => {
  test("pending_review → confirmed: ticket issued with signed QR, confirmation email sent", async () => {
    const env = makeTestEnv();
    seedRegistration(env, { status: "pending_review", payment: "not_required" });

    const dto = await makeHandler(env).execute("reg-1");

    expect(dto.status).toBe("confirmed");
    expect(dto.payment).toBe("not_required"); // free approved volunteer ticket
    expect(dto.ticket).not.toBeNull();
    expect(dto.ticket?.status).toBe("issued");
    expect(verifyQrToken(dto.ticket!.qrToken, TEST_SECRET)).toEqual({
      ticketId: dto.ticket!.ticketId,
      eventId: "evt-1",
    });
    expect(env.emailSender.sent).toHaveLength(1);
    expect(env.emailSender.sent[0]?.to).toBe("alice@example.com");
    // persisted state matches
    const persisted = env.registrations.items.get("reg-1")!;
    expect(persisted.status).toBe("confirmed");
    expect(persisted.reviewedAt).toEqual(NOW);
  });

  test("approving an already-confirmed registration → INVALID_STATE, no second ticket", async () => {
    const env = makeTestEnv();
    seedRegistration(env, { status: "pending_review" });
    const handler = makeHandler(env);
    await handler.execute("reg-1");
    await expect(handler.execute("reg-1")).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(env.tickets.items).toHaveLength(1);
    expect(env.emailSender.sent).toHaveLength(1);
  });

  test.each(["submitted", "rejected", "cancelled", "checked_in"] as const)(
    "approve from %s → INVALID_STATE",
    async (status) => {
      const env = makeTestEnv();
      seedRegistration(env, { status });
      await expect(makeHandler(env).execute("reg-1")).rejects.toMatchObject({ code: "INVALID_STATE" });
    },
  );

  test("unknown registration → NOT_FOUND", async () => {
    const env = makeTestEnv();
    await expect(makeHandler(env).execute("ghost")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

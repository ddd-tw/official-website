import { describe, expect, test } from "bun:test";
import { makeTestEnv, makeTicketType, seedRegistration } from "../testing/fakes";
import { CancelRegistration } from "./cancel-registration";

function makeHandler(env: ReturnType<typeof makeTestEnv>) {
  return new CancelRegistration(env.runInTransaction, env.eventInfo, env.clock);
}

const OWNER_EMAIL = "alice@example.com";

describe("CancelRegistration use case", () => {
  test("cancel a pending_review registration → cancelled, seat released", async () => {
    const env = makeTestEnv({ ticketTypes: [makeTicketType({ reserved: 1 })] });
    seedRegistration(env, { status: "pending_review" });

    const dto = await makeHandler(env).execute("reg-1", OWNER_EMAIL);
    expect(dto.status).toBe("cancelled");
    expect(env.ticketTypes.items[0]?.reserved).toBe(0);
  });

  test("cancel a confirmed registration → cancelled, seat released AND issued ticket voided", async () => {
    const env = makeTestEnv({ ticketTypes: [makeTicketType({ reserved: 1 })] });
    seedRegistration(env, { status: "confirmed", payment: "unpaid", withTicket: true });

    const dto = await makeHandler(env).execute("reg-1", OWNER_EMAIL);
    expect(dto.status).toBe("cancelled");
    expect(dto.ticket).toBeNull(); // void tickets are not exposed
    expect(env.tickets.items[0]?.status).toBe("void");
    expect(env.ticketTypes.items[0]?.reserved).toBe(0);
  });

  test("email is matched case-insensitively", async () => {
    const env = makeTestEnv();
    seedRegistration(env, { status: "pending_review" });
    const dto = await makeHandler(env).execute("reg-1", "Alice@Example.COM");
    expect(dto.status).toBe("cancelled");
  });

  test("wrong email → NOT_FOUND (no existence leak), state untouched", async () => {
    const env = makeTestEnv({ ticketTypes: [makeTicketType({ reserved: 1 })] });
    seedRegistration(env, { status: "pending_review" });
    await expect(makeHandler(env).execute("reg-1", "mallory@example.com")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(env.registrations.items.get("reg-1")?.status).toBe("pending_review");
    expect(env.ticketTypes.items[0]?.reserved).toBe(1);
  });

  test("missing email → VALIDATION_ERROR", async () => {
    const env = makeTestEnv();
    seedRegistration(env, { status: "pending_review" });
    await expect(makeHandler(env).execute("reg-1", "")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("cancel twice → ALREADY_CANCELLED", async () => {
    const env = makeTestEnv();
    seedRegistration(env, { status: "pending_review" });
    const handler = makeHandler(env);
    await handler.execute("reg-1", OWNER_EMAIL);
    await expect(handler.execute("reg-1", OWNER_EMAIL)).rejects.toMatchObject({ code: "ALREADY_CANCELLED" });
  });

  test.each(["checked_in", "rejected", "no_show"] as const)("cancel from %s → INVALID_STATE", async (status) => {
    const env = makeTestEnv();
    seedRegistration(env, { status });
    await expect(makeHandler(env).execute("reg-1", OWNER_EMAIL)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  test("unknown registration → NOT_FOUND", async () => {
    const env = makeTestEnv();
    await expect(makeHandler(env).execute("ghost", OWNER_EMAIL)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

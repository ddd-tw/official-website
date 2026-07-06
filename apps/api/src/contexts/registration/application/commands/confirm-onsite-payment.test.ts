import { describe, expect, test } from "bun:test";
import { makeTestEnv, seedRegistration } from "../testing/fakes";
import { ConfirmOnsitePayment } from "./confirm-onsite-payment";

function makeHandler(env: ReturnType<typeof makeTestEnv>) {
  return new ConfirmOnsitePayment(env.runInTransaction, env.eventInfo);
}

describe("ConfirmOnsitePayment use case (MVP 現場繳費)", () => {
  test("confirmed & unpaid → paid_onsite, status stays confirmed", async () => {
    const env = makeTestEnv();
    seedRegistration(env, { status: "confirmed", payment: "unpaid", withTicket: true });

    const dto = await makeHandler(env).execute("reg-1");
    expect(dto.status).toBe("confirmed");
    expect(dto.payment).toBe("paid_onsite");
    expect(env.registrations.items.get("reg-1")?.payment).toBe("paid_onsite");
  });

  test("paying twice → INVALID_STATE", async () => {
    const env = makeTestEnv();
    seedRegistration(env, { status: "confirmed", payment: "unpaid" });
    const handler = makeHandler(env);
    await handler.execute("reg-1");
    await expect(handler.execute("reg-1")).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  test("free ticket (payment=not_required) → INVALID_STATE", async () => {
    const env = makeTestEnv();
    seedRegistration(env, { status: "confirmed", payment: "not_required" });
    await expect(makeHandler(env).execute("reg-1")).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  test.each(["pending_review", "cancelled", "rejected", "checked_in"] as const)(
    "payment on a %s registration → INVALID_STATE",
    async (status) => {
      const env = makeTestEnv();
      seedRegistration(env, { status, payment: "unpaid" });
      await expect(makeHandler(env).execute("reg-1")).rejects.toMatchObject({ code: "INVALID_STATE" });
    },
  );

  test("unknown registration → NOT_FOUND", async () => {
    const env = makeTestEnv();
    await expect(makeHandler(env).execute("ghost")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

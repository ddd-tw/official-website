import { describe, expect, test } from "bun:test";
import { verifyQrToken } from "../../../../shared/qr-token";
import { makeTestEnv, makeTicketType, NOW, TEST_SECRET } from "../testing/fakes";
import { SubmitRegistration } from "./submit-registration";

function makeHandler(env: ReturnType<typeof makeTestEnv>) {
  return new SubmitRegistration(env.runInTransaction, env.eventInfo, env.idGenerator, env.clock);
}

const attendee = { name: "Alice", email: "alice@example.com" };

describe("SubmitRegistration use case", () => {
  test("paid ticket without approval → confirmed immediately, unpaid, ticket issued, email sent, seat reserved", async () => {
    const env = makeTestEnv({ ticketTypes: [makeTicketType({ price: 800, requiresApproval: false })] });
    const dto = await makeHandler(env).execute("evt-1", { ticketTypeId: "tt-general", attendee });

    expect(dto.status).toBe("confirmed");
    expect(dto.payment).toBe("unpaid"); // MVP 現場繳費
    expect(dto.eventTitle).toBe("Test Event");
    expect(dto.ticketTypeName).toBe("一般票");
    expect(dto.submittedAt).toBe(NOW.toISOString());
    expect(dto.ticket).not.toBeNull();
    expect(dto.ticket?.status).toBe("issued");
    // QR token is properly signed and points at this ticket/event
    expect(verifyQrToken(dto.ticket!.qrToken, TEST_SECRET)).toEqual({
      ticketId: dto.ticket!.ticketId,
      eventId: "evt-1",
    });
    expect(env.emailSender.sent).toHaveLength(1);
    expect(env.emailSender.sent[0]?.to).toBe("alice@example.com");
    expect(env.ticketTypes.items[0]?.reserved).toBe(1);
  });

  test("free ticket requiring approval → pending_review, not_required, NO ticket, NO email, seat still reserved", async () => {
    const env = makeTestEnv({
      ticketTypes: [makeTicketType({ ticketTypeId: "tt-vol", price: 0, requiresApproval: true })],
    });
    const dto = await makeHandler(env).execute("evt-1", {
      ticketTypeId: "tt-vol",
      attendee: { ...attendee, note: "想當志工" },
    });

    expect(dto.status).toBe("pending_review");
    expect(dto.payment).toBe("not_required");
    expect(dto.ticket).toBeNull();
    expect(dto.attendee.note).toBe("想當志工");
    expect(env.emailSender.sent).toHaveLength(0);
    expect(env.tickets.items).toHaveLength(0);
    expect(env.ticketTypes.items[0]?.reserved).toBe(1); // 決議: 報名先保留名額
  });

  test("sold out (reserved == quota) → SOLD_OUT", async () => {
    const env = makeTestEnv({ ticketTypes: [makeTicketType({ quota: 1, reserved: 1 })] });
    await expect(makeHandler(env).execute("evt-1", { ticketTypeId: "tt-general", attendee })).rejects.toMatchObject({
      code: "SOLD_OUT",
    });
  });

  test("quota exhausts across successive submits → later one gets SOLD_OUT and reserved never exceeds quota", async () => {
    const env = makeTestEnv({ ticketTypes: [makeTicketType({ quota: 1 })] });
    const handler = makeHandler(env);
    await handler.execute("evt-1", { ticketTypeId: "tt-general", attendee });
    await expect(
      handler.execute("evt-1", { ticketTypeId: "tt-general", attendee: { name: "Bob", email: "b@x.tw" } }),
    ).rejects.toMatchObject({ code: "SOLD_OUT" });
    expect(env.ticketTypes.items[0]?.reserved).toBe(1);
  });

  test("sales window: exactly at opensAt/closesAt is allowed, outside → SALES_CLOSED", async () => {
    const tt = makeTicketType({ quota: 10 });
    const env = makeTestEnv({ ticketTypes: [tt] });
    const handler = makeHandler(env);

    env.clock.current = tt.salesOpensAt; // inclusive boundary
    await handler.execute("evt-1", { ticketTypeId: "tt-general", attendee });
    env.clock.current = tt.salesClosesAt; // inclusive boundary
    await handler.execute("evt-1", { ticketTypeId: "tt-general", attendee });

    env.clock.current = new Date(tt.salesOpensAt.getTime() - 1000);
    await expect(handler.execute("evt-1", { ticketTypeId: "tt-general", attendee })).rejects.toMatchObject({
      code: "SALES_CLOSED",
    });
    env.clock.current = new Date(tt.salesClosesAt.getTime() + 1000);
    await expect(handler.execute("evt-1", { ticketTypeId: "tt-general", attendee })).rejects.toMatchObject({
      code: "SALES_CLOSED",
    });
  });

  test("unknown event → NOT_FOUND", async () => {
    const env = makeTestEnv();
    await expect(
      makeHandler(env).execute("no-such-event", { ticketTypeId: "tt-general", attendee }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("ticket type of another event → NOT_FOUND", async () => {
    const env = makeTestEnv({
      ticketTypes: [makeTicketType({ ticketTypeId: "tt-other", eventId: "evt-2" })],
      eventTitles: { "evt-1": "Test Event", "evt-2": "Other" },
    });
    await expect(makeHandler(env).execute("evt-1", { ticketTypeId: "tt-other", attendee })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("invalid attendee (bad email / missing name) → VALIDATION_ERROR and no seat reserved", async () => {
    const env = makeTestEnv();
    const handler = makeHandler(env);
    await expect(
      handler.execute("evt-1", { ticketTypeId: "tt-general", attendee: { name: "Alice", email: "nope" } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      handler.execute("evt-1", { ticketTypeId: "tt-general", attendee: { name: "", email: "a@b.tw" } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(env.ticketTypes.items[0]?.reserved).toBe(0);
  });
});

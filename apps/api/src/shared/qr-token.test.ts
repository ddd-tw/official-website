import { describe, expect, test } from "bun:test";
import { signQrToken, verifyQrToken } from "./qr-token";

const SECRET = "test-secret";
const payload = { ticketId: "ticket-123", eventId: "ddd-tw-conference-2026" };

describe("QR token sign/verify", () => {
  test("round-trip: sign then verify returns the payload", () => {
    const token = signQrToken(payload, SECRET);
    expect(token.split(".")).toHaveLength(2);
    expect(verifyQrToken(token, SECRET)).toEqual(payload);
  });

  test("tampered payload is rejected", () => {
    const token = signQrToken(payload, SECRET);
    const [, signature] = token.split(".") as [string, string];
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...payload, ticketId: "someone-elses-ticket" }),
      "utf8",
    ).toString("base64url");
    expect(verifyQrToken(`${forgedPayload}.${signature}`, SECRET)).toBeNull();
  });

  test("tampered signature is rejected", () => {
    const token = signQrToken(payload, SECRET);
    const [body] = token.split(".") as [string, string];
    expect(verifyQrToken(`${body}.${Buffer.from("forged-signature").toString("base64url")}`, SECRET)).toBeNull();
  });

  test("token signed with a different secret is rejected", () => {
    const token = signQrToken(payload, "other-secret");
    expect(verifyQrToken(token, SECRET)).toBeNull();
  });

  test("malformed tokens are rejected, not thrown", () => {
    expect(verifyQrToken("", SECRET)).toBeNull();
    expect(verifyQrToken("no-dot-here", SECRET)).toBeNull();
    expect(verifyQrToken("a.b.c", SECRET)).toBeNull();
    expect(verifyQrToken("!!.!!", SECRET)).toBeNull();
  });
});

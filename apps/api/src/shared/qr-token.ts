import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed QR token format (see docs/architecture.md 離線驗票):
 *   base64url(JSON{ticketId,eventId}) + "." + base64url(HMAC-SHA256(payloadPart, secret))
 */
export interface QrTokenPayload {
  ticketId: string;
  eventId: string;
}

function hmac(payloadPart: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payloadPart).digest();
}

export function signQrToken(payload: QrTokenPayload, secret: string): string {
  const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signaturePart = hmac(payloadPart, secret).toString("base64url");
  return `${payloadPart}.${signaturePart}`;
}

/** Returns the payload when the signature is valid, otherwise null. */
export function verifyQrToken(token: string, secret: string): QrTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, signaturePart] = parts as [string, string];
  if (payloadPart.length === 0 || signaturePart.length === 0) return null;

  const expected = hmac(payloadPart, secret);
  let given: Buffer;
  try {
    given = Buffer.from(signaturePart, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as QrTokenPayload).ticketId === "string" &&
      typeof (parsed as QrTokenPayload).eventId === "string"
    ) {
      const { ticketId, eventId } = parsed as QrTokenPayload;
      return { ticketId, eventId };
    }
    return null;
  } catch {
    return null;
  }
}

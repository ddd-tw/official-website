import { signQrToken } from "../../../shared/qr-token";
import type { QrTokenSigner } from "../application/ports";

export class HmacQrTokenSigner implements QrTokenSigner {
  constructor(private readonly secret: string) {}

  sign(payload: { ticketId: string; eventId: string }): string {
    return signQrToken(payload, this.secret);
  }
}

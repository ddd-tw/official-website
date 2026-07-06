import type { Clock, EmailSender, IdGenerator } from "../../../../shared/ports";
import type { RegistrationConfirmed } from "../../domain/events";
import type { Ticket } from "../../domain/ticket";
import type { QrTokenSigner, TicketRepository } from "../ports";

/**
 * Policy: on RegistrationConfirmed → issue a signed ticket and send the
 * confirmation email. Runs inside the confirming command's transaction.
 *
 * 決議: paid tickets are issued immediately with payment=unpaid
 * (報名先保留名額, 現場繳費); free tickets are payment=not_required.
 */
export class TicketIssuancePolicy {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly signer: QrTokenSigner,
    private readonly emailSender: EmailSender,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async onRegistrationConfirmed(event: RegistrationConfirmed): Promise<void> {
    // Idempotency guard: never double-issue for the same registration.
    const existing = await this.tickets.byRegistrationId(event.registrationId);
    if (existing) return;

    const ticketId = this.idGenerator.next();
    const ticket: Ticket = {
      ticketId,
      registrationId: event.registrationId,
      qrToken: this.signer.sign({ ticketId, eventId: event.eventId }),
      status: "issued",
      issuedAt: this.clock.now(),
      checkedInAt: null,
    };
    await this.tickets.insert(ticket);

    const paymentLine =
      event.payment === "not_required"
        ? "此票券為免費票,無需付款。"
        : "請於活動當日現場繳費(MVP 決議:現場繳費)。";
    await this.emailSender.send({
      to: event.attendeeEmail,
      subject: "報名成功確認 — DDD Taiwan",
      body: [
        `${event.attendeeName} 您好,`,
        "",
        `您的報名已確認(報名編號 ${event.registrationId})。`,
        `${paymentLine}`,
        "",
        `入場 QR 票券代碼: ${ticket.qrToken}`,
        "",
        "DDD Taiwan 社群",
      ].join("\n"),
    });
  }
}

import type { PaymentStatus, RegistrationStatus } from "@dddtw/contracts";
import { AlreadyCancelledError, InvalidStateError } from "../../../shared/errors";
import type { Attendee } from "./attendee";
import type { RegistrationCancelled, RegistrationConfirmed, RegistrationDomainEvent, RegistrationRejected } from "./events";

/**
 * Registration aggregate — owns the state machine:
 *
 *   submit ──▶ pending_review ──approve──▶ confirmed ──▶ checked_in
 *      │             │reject                    │
 *      └──(no        ▼                          │cancel (any state before checked_in)
 *          approval) rejected                   ▼
 *          ──▶ confirmed                    cancelled
 */
export interface RegistrationSnapshot {
  registrationId: string;
  eventId: string;
  ticketTypeId: string;
  attendee: Attendee;
  status: RegistrationStatus;
  payment: PaymentStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectReason: string | null;
}

export class Registration {
  private events: RegistrationDomainEvent[] = [];

  private constructor(
    public readonly registrationId: string,
    public readonly eventId: string,
    public readonly ticketTypeId: string,
    public readonly attendee: Attendee,
    private _status: RegistrationStatus,
    private _payment: PaymentStatus,
    public readonly submittedAt: Date,
    private _reviewedAt: Date | null,
    private _rejectReason: string | null,
  ) {}

  get status(): RegistrationStatus {
    return this._status;
  }
  get payment(): PaymentStatus {
    return this._payment;
  }
  get reviewedAt(): Date | null {
    return this._reviewedAt;
  }
  get rejectReason(): string | null {
    return this._rejectReason;
  }

  /**
   * submit: requiresApproval → pending_review; otherwise straight to
   * confirmed (raises RegistrationConfirmed). Free tickets need no payment;
   * paid tickets start unpaid (MVP 決議: 現場繳費, 名額先保留).
   */
  static submit(input: {
    registrationId: string;
    eventId: string;
    ticketTypeId: string;
    attendee: Attendee;
    requiresApproval: boolean;
    price: number;
    now: Date;
  }): Registration {
    const payment: PaymentStatus = input.price === 0 ? "not_required" : "unpaid";
    const registration = new Registration(
      input.registrationId,
      input.eventId,
      input.ticketTypeId,
      input.attendee,
      "submitted",
      payment,
      input.now,
      null,
      null,
    );
    if (input.requiresApproval) {
      registration._status = "pending_review";
    } else {
      registration._status = "confirmed";
      registration.raiseConfirmed(input.now);
    }
    return registration;
  }

  static restore(snapshot: RegistrationSnapshot): Registration {
    return new Registration(
      snapshot.registrationId,
      snapshot.eventId,
      snapshot.ticketTypeId,
      snapshot.attendee,
      snapshot.status,
      snapshot.payment,
      snapshot.submittedAt,
      snapshot.reviewedAt,
      snapshot.rejectReason,
    );
  }

  /** approve: only pending_review → confirmed. */
  approve(now: Date): void {
    if (this._status !== "pending_review") {
      throw new InvalidStateError(`Cannot approve a registration in status "${this._status}"`);
    }
    this._status = "confirmed";
    this._reviewedAt = now;
    this.raiseConfirmed(now);
  }

  /** reject: only pending_review → rejected. */
  reject(reason: string, now: Date): void {
    if (this._status !== "pending_review") {
      throw new InvalidStateError(`Cannot reject a registration in status "${this._status}"`);
    }
    this._status = "rejected";
    this._reviewedAt = now;
    this._rejectReason = reason;
    const event: RegistrationRejected = {
      type: "RegistrationRejected",
      occurredAt: now,
      registrationId: this.registrationId,
      eventId: this.eventId,
      ticketTypeId: this.ticketTypeId,
      attendeeEmail: this.attendee.email,
      reason,
    };
    this.events.push(event);
  }

  /** cancel: allowed any time before check-in (submitted/pending_review/confirmed). */
  cancel(now: Date): void {
    if (this._status === "cancelled") {
      throw new AlreadyCancelledError();
    }
    if (this._status === "checked_in" || this._status === "no_show" || this._status === "rejected") {
      throw new InvalidStateError(`Cannot cancel a registration in status "${this._status}"`);
    }
    const wasConfirmed = this._status === "confirmed";
    this._status = "cancelled";
    const event: RegistrationCancelled = {
      type: "RegistrationCancelled",
      occurredAt: now,
      registrationId: this.registrationId,
      eventId: this.eventId,
      ticketTypeId: this.ticketTypeId,
      attendeeEmail: this.attendee.email,
      wasConfirmed,
    };
    this.events.push(event);
  }

  /** MVP 現場繳費: only a confirmed & unpaid registration can be marked paid onsite. */
  confirmOnsitePayment(): void {
    if (this._status !== "confirmed") {
      throw new InvalidStateError(`Cannot record onsite payment for a registration in status "${this._status}"`);
    }
    if (this._payment !== "unpaid") {
      throw new InvalidStateError(`Cannot record onsite payment when payment is "${this._payment}"`);
    }
    this._payment = "paid_onsite";
  }

  /** Called by the check-in BC flow via repository update; kept for completeness. */
  checkIn(): void {
    if (this._status !== "confirmed") {
      throw new InvalidStateError(`Cannot check in a registration in status "${this._status}"`);
    }
    this._status = "checked_in";
  }

  private raiseConfirmed(now: Date): void {
    const event: RegistrationConfirmed = {
      type: "RegistrationConfirmed",
      occurredAt: now,
      registrationId: this.registrationId,
      eventId: this.eventId,
      ticketTypeId: this.ticketTypeId,
      attendeeName: this.attendee.name,
      attendeeEmail: this.attendee.email,
      payment: this._payment,
    };
    this.events.push(event);
  }

  /** Drains events raised since load — the command handler dispatches them in-transaction. */
  pullDomainEvents(): RegistrationDomainEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }
}

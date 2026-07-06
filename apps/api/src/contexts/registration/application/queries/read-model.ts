import type { PaymentStatus, RegistrationStatus } from "@dddtw/contracts";

/** Flat read-model row (CQS: queries bypass the domain and read directly). */
export interface RegistrationListRow {
  registrationId: string;
  ticketTypeName: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  attendeeDiet: string | null;
  attendeeNote: string | null;
  status: RegistrationStatus;
  payment: PaymentStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectReason: string | null;
}

export interface RegistrationReadModel {
  listByEvent(eventId: string, status?: RegistrationStatus): Promise<RegistrationListRow[]>;
  reviewStats(eventId: string): Promise<{ pendingReview: number; approved: number; rejected: number }>;
}

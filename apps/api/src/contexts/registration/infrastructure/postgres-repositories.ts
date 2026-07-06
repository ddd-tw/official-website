import type { SQL } from "bun";
import type { PaymentStatus, RegistrationStatus, TicketStatus } from "@dddtw/contracts";
import { Attendee } from "../domain/attendee";
import { Registration } from "../domain/registration";
import type { Ticket } from "../domain/ticket";
import type { TicketType } from "../domain/ticket-type";
import type { RegistrationRepository, TicketRepository, TicketTypeRepository } from "../application/ports";

interface TicketTypeRow {
  ticket_type_id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  quota: number;
  reserved: number;
  sales_opens_at: Date;
  sales_closes_at: Date;
  requires_approval: boolean;
}

function toTicketType(row: TicketTypeRow): TicketType {
  return {
    ticketTypeId: row.ticket_type_id,
    eventId: row.event_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    quota: Number(row.quota),
    reserved: Number(row.reserved),
    salesOpensAt: new Date(row.sales_opens_at),
    salesClosesAt: new Date(row.sales_closes_at),
    requiresApproval: row.requires_approval,
  };
}

export class PostgresTicketTypeRepository implements TicketTypeRepository {
  constructor(private readonly sql: SQL) {}

  async byId(ticketTypeId: string): Promise<TicketType | null> {
    const rows = await this.sql<TicketTypeRow[]>`
      SELECT * FROM ticket_types WHERE ticket_type_id = ${ticketTypeId}`;
    return rows[0] ? toTicketType(rows[0]) : null;
  }

  async byEventId(eventId: string): Promise<TicketType[]> {
    const rows = await this.sql<TicketTypeRow[]>`
      SELECT * FROM ticket_types WHERE event_id = ${eventId} ORDER BY price, ticket_type_id`;
    return rows.map(toTicketType);
  }

  /** Invariant reserved <= quota enforced atomically by the conditional UPDATE. */
  async tryReserve(ticketTypeId: string): Promise<boolean> {
    const rows = await this.sql<{ ticket_type_id: string }[]>`
      UPDATE ticket_types
         SET reserved = reserved + 1, updated_at = now()
       WHERE ticket_type_id = ${ticketTypeId} AND reserved < quota
       RETURNING ticket_type_id`;
    return rows.length === 1;
  }

  async release(ticketTypeId: string): Promise<void> {
    await this.sql`
      UPDATE ticket_types
         SET reserved = GREATEST(reserved - 1, 0), updated_at = now()
       WHERE ticket_type_id = ${ticketTypeId}`;
  }
}

interface RegistrationRow {
  registration_id: string;
  event_id: string;
  ticket_type_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string | null;
  attendee_diet: string | null;
  attendee_note: string | null;
  status: RegistrationStatus;
  payment: PaymentStatus;
  submitted_at: Date;
  reviewed_at: Date | null;
  reject_reason: string | null;
}

function toRegistration(row: RegistrationRow): Registration {
  return Registration.restore({
    registrationId: row.registration_id,
    eventId: row.event_id,
    ticketTypeId: row.ticket_type_id,
    attendee: Attendee.create({
      name: row.attendee_name,
      email: row.attendee_email,
      ...(row.attendee_phone !== null ? { phone: row.attendee_phone } : {}),
      ...(row.attendee_diet !== null ? { diet: row.attendee_diet } : {}),
      ...(row.attendee_note !== null ? { note: row.attendee_note } : {}),
    }),
    status: row.status,
    payment: row.payment,
    submittedAt: new Date(row.submitted_at),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
    rejectReason: row.reject_reason,
  });
}

export class PostgresRegistrationRepository implements RegistrationRepository {
  constructor(private readonly sql: SQL) {}

  async byId(registrationId: string): Promise<Registration | null> {
    const rows = await this.sql<RegistrationRow[]>`
      SELECT * FROM registrations WHERE registration_id = ${registrationId}`;
    return rows[0] ? toRegistration(rows[0]) : null;
  }

  async insert(registration: Registration): Promise<void> {
    const a = registration.attendee;
    await this.sql`
      INSERT INTO registrations (
        registration_id, event_id, ticket_type_id,
        attendee_name, attendee_email, attendee_phone, attendee_diet, attendee_note,
        status, payment, submitted_at, reviewed_at, reject_reason
      ) VALUES (
        ${registration.registrationId}, ${registration.eventId}, ${registration.ticketTypeId},
        ${a.name}, ${a.email}, ${a.phone ?? null}, ${a.diet ?? null}, ${a.note ?? null},
        ${registration.status}, ${registration.payment}, ${registration.submittedAt},
        ${registration.reviewedAt}, ${registration.rejectReason}
      )`;
  }

  async update(registration: Registration): Promise<void> {
    await this.sql`
      UPDATE registrations
         SET status = ${registration.status},
             payment = ${registration.payment},
             reviewed_at = ${registration.reviewedAt},
             reject_reason = ${registration.rejectReason},
             updated_at = now()
       WHERE registration_id = ${registration.registrationId}`;
  }
}

interface TicketRow {
  ticket_id: string;
  registration_id: string;
  qr_token: string;
  status: TicketStatus;
  issued_at: Date;
  checked_in_at: Date | null;
}

function toTicket(row: TicketRow): Ticket {
  return {
    ticketId: row.ticket_id,
    registrationId: row.registration_id,
    qrToken: row.qr_token,
    status: row.status,
    issuedAt: new Date(row.issued_at),
    checkedInAt: row.checked_in_at ? new Date(row.checked_in_at) : null,
  };
}

export class PostgresTicketRepository implements TicketRepository {
  constructor(private readonly sql: SQL) {}

  async byRegistrationId(registrationId: string): Promise<Ticket | null> {
    const rows = await this.sql<TicketRow[]>`
      SELECT * FROM tickets WHERE registration_id = ${registrationId}
      ORDER BY issued_at DESC LIMIT 1`;
    return rows[0] ? toTicket(rows[0]) : null;
  }

  async insert(ticket: Ticket): Promise<void> {
    await this.sql`
      INSERT INTO tickets (ticket_id, registration_id, qr_token, status, issued_at, checked_in_at)
      VALUES (${ticket.ticketId}, ${ticket.registrationId}, ${ticket.qrToken},
              ${ticket.status}, ${ticket.issuedAt}, ${ticket.checkedInAt})`;
  }

  async voidByRegistrationId(registrationId: string): Promise<void> {
    await this.sql`
      UPDATE tickets SET status = 'void', updated_at = now()
       WHERE registration_id = ${registrationId} AND status = 'issued'`;
  }
}

/**
 * In-memory fakes for use-case level tests. The unit-of-work mirrors the real
 * infrastructure wiring (same policies, same dispatcher) so command handlers
 * are exercised end-to-end through their public API — only the ports are fake.
 */
import { DomainEventDispatcher } from "../../../../shared/domain-event";
import type { Clock, EmailMessage, EmailSender, IdGenerator } from "../../../../shared/ports";
import { signQrToken } from "../../../../shared/qr-token";
import { Attendee } from "../../domain/attendee";
import { Registration } from "../../domain/registration";
import type { RegistrationCancelled, RegistrationConfirmed, RegistrationRejected } from "../../domain/events";
import type { Ticket } from "../../domain/ticket";
import type { TicketType } from "../../domain/ticket-type";
import type { EventInfoPort } from "../dto";
import { SeatReleasePolicy } from "../policies/seat-release-policy";
import { TicketIssuancePolicy } from "../policies/ticket-issuance-policy";
import type {
  RegistrationRepository,
  RegistrationUnitOfWork,
  RunInRegistrationTransaction,
  TicketRepository,
  TicketTypeRepository,
} from "../ports";

export const TEST_SECRET = "test-secret";
export const NOW = new Date("2026-07-06T00:00:00Z");

export class FixedClock implements Clock {
  constructor(public current: Date = NOW) {}
  now(): Date {
    return this.current;
  }
}

export class SeqIdGenerator implements IdGenerator {
  private n = 0;
  next(): string {
    return `id-${++this.n}`;
  }
}

export class FakeEmailSender implements EmailSender {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

export class InMemoryTicketTypeRepository implements TicketTypeRepository {
  constructor(public items: TicketType[]) {}
  async byId(ticketTypeId: string): Promise<TicketType | null> {
    return this.items.find((t) => t.ticketTypeId === ticketTypeId) ?? null;
  }
  async byEventId(eventId: string): Promise<TicketType[]> {
    return this.items.filter((t) => t.eventId === eventId);
  }
  async tryReserve(ticketTypeId: string): Promise<boolean> {
    const t = this.items.find((x) => x.ticketTypeId === ticketTypeId);
    if (!t || t.reserved >= t.quota) return false; // mirrors the conditional UPDATE
    t.reserved += 1;
    return true;
  }
  async release(ticketTypeId: string): Promise<void> {
    const t = this.items.find((x) => x.ticketTypeId === ticketTypeId);
    if (t) t.reserved = Math.max(0, t.reserved - 1);
  }
}

export class InMemoryRegistrationRepository implements RegistrationRepository {
  items = new Map<string, Registration>();
  async byId(registrationId: string): Promise<Registration | null> {
    return this.items.get(registrationId) ?? null;
  }
  async insert(registration: Registration): Promise<void> {
    this.items.set(registration.registrationId, registration);
  }
  async update(registration: Registration): Promise<void> {
    this.items.set(registration.registrationId, registration);
  }
}

export class InMemoryTicketRepository implements TicketRepository {
  items: Ticket[] = [];
  async byRegistrationId(registrationId: string): Promise<Ticket | null> {
    const forReg = this.items.filter((t) => t.registrationId === registrationId);
    return forReg[forReg.length - 1] ?? null;
  }
  async insert(ticket: Ticket): Promise<void> {
    this.items.push(ticket);
  }
  async voidByRegistrationId(registrationId: string): Promise<void> {
    for (const t of this.items) {
      if (t.registrationId === registrationId && t.status === "issued") t.status = "void";
    }
  }
}

export interface TestEnv {
  runInTransaction: RunInRegistrationTransaction;
  eventInfo: EventInfoPort;
  clock: FixedClock;
  idGenerator: SeqIdGenerator;
  emailSender: FakeEmailSender;
  ticketTypes: InMemoryTicketTypeRepository;
  registrations: InMemoryRegistrationRepository;
  tickets: InMemoryTicketRepository;
}

export function makeTicketType(overrides: Partial<TicketType> = {}): TicketType {
  return {
    ticketTypeId: "tt-general",
    eventId: "evt-1",
    name: "一般票",
    description: null,
    price: 800,
    quota: 10,
    reserved: 0,
    salesOpensAt: new Date("2026-06-01T00:00:00Z"),
    salesClosesAt: new Date("2026-09-05T00:00:00Z"),
    requiresApproval: false,
    ...overrides,
  };
}

export function makeTestEnv(options: {
  ticketTypes?: TicketType[];
  eventTitles?: Record<string, string>;
} = {}): TestEnv {
  const clock = new FixedClock();
  const idGenerator = new SeqIdGenerator();
  const emailSender = new FakeEmailSender();
  const ticketTypes = new InMemoryTicketTypeRepository(options.ticketTypes ?? [makeTicketType()]);
  const registrations = new InMemoryRegistrationRepository();
  const tickets = new InMemoryTicketRepository();
  const titles = options.eventTitles ?? { "evt-1": "Test Event" };

  // Same policy wiring as infrastructure/unit-of-work.ts — with fake ports.
  const issuance = new TicketIssuancePolicy(
    tickets,
    { sign: (payload) => signQrToken(payload, TEST_SECRET) },
    emailSender,
    idGenerator,
    clock,
  );
  const seatRelease = new SeatReleasePolicy(ticketTypes, tickets);
  const dispatcher = new DomainEventDispatcher();
  dispatcher.subscribe<RegistrationConfirmed>("RegistrationConfirmed", (e) => issuance.onRegistrationConfirmed(e));
  dispatcher.subscribe<RegistrationRejected>("RegistrationRejected", (e) => seatRelease.onRegistrationRejected(e));
  dispatcher.subscribe<RegistrationCancelled>("RegistrationCancelled", (e) => seatRelease.onRegistrationCancelled(e));

  const uow: RegistrationUnitOfWork = {
    ticketTypes,
    registrations,
    tickets,
    publish: (events) => dispatcher.dispatch(events),
  };

  return {
    runInTransaction: (work) => work(uow),
    eventInfo: { titleOf: (eventId) => titles[eventId] ?? null },
    clock,
    idGenerator,
    emailSender,
    ticketTypes,
    registrations,
    tickets,
  };
}

/** Seeds a registration in a given state directly (arrange step). */
export function seedRegistration(
  env: TestEnv,
  overrides: Partial<Parameters<typeof Registration.restore>[0]> & { withTicket?: boolean } = {},
): Registration {
  const { withTicket, ...snapshot } = overrides;
  const registration = Registration.restore({
    registrationId: "reg-1",
    eventId: "evt-1",
    ticketTypeId: "tt-general",
    attendee: Attendee.create({ name: "Alice", email: "alice@example.com" }),
    status: "pending_review",
    payment: "not_required",
    submittedAt: NOW,
    reviewedAt: null,
    rejectReason: null,
    ...snapshot,
  });
  env.registrations.items.set(registration.registrationId, registration);
  if (withTicket) {
    env.tickets.items.push({
      ticketId: `ticket-for-${registration.registrationId}`,
      registrationId: registration.registrationId,
      qrToken: signQrToken(
        { ticketId: `ticket-for-${registration.registrationId}`, eventId: registration.eventId },
        TEST_SECRET,
      ),
      status: "issued",
      issuedAt: NOW,
      checkedInAt: null,
    });
  }
  return registration;
}

import type { SQL } from "bun";
import { DomainEventDispatcher } from "../../../shared/domain-event";
import type { Clock, EmailSender, IdGenerator } from "../../../shared/ports";
import { SeatReleasePolicy } from "../application/policies/seat-release-policy";
import { TicketIssuancePolicy } from "../application/policies/ticket-issuance-policy";
import type { QrTokenSigner, RegistrationUnitOfWork, RunInRegistrationTransaction } from "../application/ports";
import type { RegistrationCancelled, RegistrationConfirmed, RegistrationRejected } from "../domain/events";
import {
  PostgresRegistrationRepository,
  PostgresTicketRepository,
  PostgresTicketTypeRepository,
} from "./postgres-repositories";

export interface RegistrationUowDeps {
  signer: QrTokenSigner;
  emailSender: EmailSender;
  idGenerator: IdGenerator;
  clock: Clock;
}

function buildUow(tx: SQL, deps: RegistrationUowDeps): RegistrationUnitOfWork {
  const ticketTypes = new PostgresTicketTypeRepository(tx);
  const registrations = new PostgresRegistrationRepository(tx);
  const tickets = new PostgresTicketRepository(tx);

  const issuance = new TicketIssuancePolicy(tickets, deps.signer, deps.emailSender, deps.idGenerator, deps.clock);
  const seatRelease = new SeatReleasePolicy(ticketTypes, tickets);

  const dispatcher = new DomainEventDispatcher();
  dispatcher.subscribe<RegistrationConfirmed>("RegistrationConfirmed", (e) => issuance.onRegistrationConfirmed(e));
  dispatcher.subscribe<RegistrationRejected>("RegistrationRejected", (e) => seatRelease.onRegistrationRejected(e));
  dispatcher.subscribe<RegistrationCancelled>("RegistrationCancelled", (e) => seatRelease.onRegistrationCancelled(e));

  return {
    ticketTypes,
    registrations,
    tickets,
    publish: (events) => dispatcher.dispatch(events),
  };
}

/** One command = one `sql.begin` transaction; policies run inside it. */
export function makeRunInRegistrationTransaction(sql: SQL, deps: RegistrationUowDeps): RunInRegistrationTransaction {
  return async <T>(work: (uow: RegistrationUnitOfWork) => Promise<T>): Promise<T> => {
    return (await sql.begin(async (tx) => work(buildUow(tx as unknown as SQL, deps)))) as T;
  };
}

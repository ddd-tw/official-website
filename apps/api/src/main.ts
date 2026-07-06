/**
 * Composition root — the only place where concrete infrastructure is
 * constructed and wired to application use cases (DIP).
 */
import { SQL } from "bun";
import { loadConfig } from "./config";
import { ConsoleEmailSender, SystemClock, UuidGenerator } from "./shared/infrastructure";

// catalog
import { FileEventCatalog } from "./contexts/catalog/infrastructure/file-event-catalog";
import { ListPublishedEvents } from "./contexts/catalog/application/queries/list-published-events";
import { GetEventDetail } from "./contexts/catalog/application/queries/get-event-detail";

// registration
import { HmacQrTokenSigner } from "./contexts/registration/infrastructure/hmac-qr-token-signer";
import { makeRunInRegistrationTransaction } from "./contexts/registration/infrastructure/unit-of-work";
import {
  PostgresRegistrationRepository,
  PostgresTicketRepository,
  PostgresTicketTypeRepository,
} from "./contexts/registration/infrastructure/postgres-repositories";
import { PostgresRegistrationReadModel } from "./contexts/registration/infrastructure/postgres-read-model";
import { SubmitRegistration } from "./contexts/registration/application/commands/submit-registration";
import { ApproveRegistration } from "./contexts/registration/application/commands/approve-registration";
import { RejectRegistration } from "./contexts/registration/application/commands/reject-registration";
import { CancelRegistration } from "./contexts/registration/application/commands/cancel-registration";
import { ConfirmOnsitePayment } from "./contexts/registration/application/commands/confirm-onsite-payment";
import { GetRegistration } from "./contexts/registration/application/queries/get-registration";
import { ListRegistrationsForAdmin } from "./contexts/registration/application/queries/list-registrations-for-admin";
import { ExportRegistrationsCsv } from "./contexts/registration/application/queries/export-registrations-csv";
import { TicketAvailabilityQuery } from "./contexts/registration/application/queries/ticket-availability";
import type { EventInfoPort } from "./contexts/registration/application/dto";

// checkin
import {
  HmacQrTokenVerifier,
  PostgresCheckinReadModel,
  makeRunInCheckinTransaction,
} from "./contexts/checkin/infrastructure/postgres-checkin";
import { ScanTicket } from "./contexts/checkin/application/commands/scan-ticket";
import { GetAttendance } from "./contexts/checkin/application/queries/attendance";
import { GetCheckinManifest } from "./contexts/checkin/application/queries/checkin-manifest";

import { buildApp } from "./http/app";

const config = loadConfig();
const sql = new SQL(config.databaseUrl);

// shared adapters
const clock = new SystemClock();
const idGenerator = new UuidGenerator();
const emailSender = new ConsoleEmailSender();

// catalog BC (read-only content, loaded once at startup)
const catalog = new FileEventCatalog(config.contentDir);

// registration BC
const signer = new HmacQrTokenSigner(config.ticketSecret);
const runInRegistrationTx = makeRunInRegistrationTransaction(sql, { signer, emailSender, idGenerator, clock });
const ticketTypes = new PostgresTicketTypeRepository(sql);
const registrations = new PostgresRegistrationRepository(sql);
const tickets = new PostgresTicketRepository(sql);
const registrationReadModel = new PostgresRegistrationReadModel(sql);

// cross-context adapters (IDs only cross the boundary)
const eventInfo: EventInfoPort = { titleOf: (eventId) => catalog.byId(eventId)?.title ?? null };
const ticketAvailability = new TicketAvailabilityQuery(ticketTypes, clock);

// checkin BC
const verifier = new HmacQrTokenVerifier(config.ticketSecret);
const runInCheckinTx = makeRunInCheckinTransaction(sql);
const checkinReadModel = new PostgresCheckinReadModel(sql);

const app = buildApp({
  config: { adminToken: config.adminToken, corsOrigin: config.corsOrigin },
  catalog: {
    listPublishedEvents: new ListPublishedEvents(catalog, ticketAvailability),
    getEventDetail: new GetEventDetail(catalog, ticketAvailability),
  },
  registration: {
    submitRegistration: new SubmitRegistration(runInRegistrationTx, eventInfo, idGenerator, clock),
    approveRegistration: new ApproveRegistration(runInRegistrationTx, eventInfo, clock),
    rejectRegistration: new RejectRegistration(runInRegistrationTx, eventInfo, clock),
    cancelRegistration: new CancelRegistration(runInRegistrationTx, eventInfo, clock),
    confirmOnsitePayment: new ConfirmOnsitePayment(runInRegistrationTx, eventInfo),
    getRegistration: new GetRegistration(registrations, tickets, ticketTypes, eventInfo),
    listRegistrationsForAdmin: new ListRegistrationsForAdmin(registrationReadModel, eventInfo),
    exportRegistrationsCsv: new ExportRegistrationsCsv(registrationReadModel, eventInfo),
  },
  checkin: {
    scanTicket: new ScanTicket(runInCheckinTx, verifier, idGenerator, clock),
    getAttendance: new GetAttendance(checkinReadModel),
    getCheckinManifest: new GetCheckinManifest(checkinReadModel, clock),
  },
});

const server = Bun.serve({ port: config.port, fetch: app.fetch });
console.log(`[api] DDD TW API listening on http://localhost:${server.port} (${catalog.all().length} events loaded)`);

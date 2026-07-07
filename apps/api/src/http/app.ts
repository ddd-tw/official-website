import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ScanRequest, SubmitRegistrationRequest } from "@dddtw/contracts";
import { ValidationError } from "../shared/errors";
import type { GetEventDetail } from "../contexts/catalog/application/queries/get-event-detail";
import type { ListPublishedEvents } from "../contexts/catalog/application/queries/list-published-events";
import type { ApproveRegistration } from "../contexts/registration/application/commands/approve-registration";
import type { CancelRegistration } from "../contexts/registration/application/commands/cancel-registration";
import type { ConfirmOnsitePayment } from "../contexts/registration/application/commands/confirm-onsite-payment";
import type { RejectRegistration } from "../contexts/registration/application/commands/reject-registration";
import type { SubmitRegistration } from "../contexts/registration/application/commands/submit-registration";
import type { ExportRegistrationsCsv } from "../contexts/registration/application/queries/export-registrations-csv";
import type { GetRegistration } from "../contexts/registration/application/queries/get-registration";
import type { ListRegistrationsForAdmin } from "../contexts/registration/application/queries/list-registrations-for-admin";
import type { ScanTicket } from "../contexts/checkin/application/commands/scan-ticket";
import type { GetAttendance } from "../contexts/checkin/application/queries/attendance";
import type { GetCheckinManifest } from "../contexts/checkin/application/queries/checkin-manifest";
import { adminAuth } from "./admin-auth";
import { handleError } from "./error-mapper";

export interface AppDependencies {
  config: { adminToken: string; corsOrigin: string };
  catalog: {
    listPublishedEvents: ListPublishedEvents;
    getEventDetail: GetEventDetail;
  };
  registration: {
    submitRegistration: SubmitRegistration;
    approveRegistration: ApproveRegistration;
    rejectRegistration: RejectRegistration;
    cancelRegistration: CancelRegistration;
    confirmOnsitePayment: ConfirmOnsitePayment;
    getRegistration: GetRegistration;
    listRegistrationsForAdmin: ListRegistrationsForAdmin;
    exportRegistrationsCsv: ExportRegistrationsCsv;
  };
  checkin: {
    scanTicket: ScanTicket;
    getAttendance: GetAttendance;
    getCheckinManifest: GetCheckinManifest;
  };
}

async function jsonBody<T>(c: { req: { json(): Promise<unknown> } }): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

/** HTTP handlers only parse and translate — all behavior lives in the use cases. */
export function buildApp(deps: AppDependencies): Hono {
  const app = new Hono();

  app.use(
    "/api/*",
    cors({
      origin: deps.config.corsOrigin,
      allowHeaders: ["content-type", "x-admin-token"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );
  app.onError(handleError);

  // --- Liveness ---------------------------------------------------------------
  // DB-free health check for the platform (Render). Kept out of /api/* so it
  // never blocks on the registration DB (e.g. Neon waking from scale-to-zero).
  app.get("/healthz", (c) => c.json({ status: "ok" }));

  // --- Catalog 活動目錄 ------------------------------------------------------
  app.get("/api/events", async (c) => c.json(await deps.catalog.listPublishedEvents.execute()));
  app.get("/api/events/:eventId", async (c) =>
    c.json(await deps.catalog.getEventDetail.execute(c.req.param("eventId"))),
  );

  // --- Registration 報名 -----------------------------------------------------
  app.post("/api/events/:eventId/registrations", async (c) => {
    const body = await jsonBody<SubmitRegistrationRequest>(c);
    if (!body || typeof body.ticketTypeId !== "string" || typeof body.attendee !== "object" || body.attendee === null) {
      throw new ValidationError("ticketTypeId and attendee are required");
    }
    const dto = await deps.registration.submitRegistration.execute(c.req.param("eventId"), body);
    return c.json(dto, 201);
  });

  app.get("/api/registrations/:registrationId", async (c) =>
    c.json(
      await deps.registration.getRegistration.execute(
        c.req.param("registrationId"),
        c.req.query("email") ?? "",
      ),
    ),
  );

  app.post("/api/registrations/:registrationId/cancel", async (c) => {
    const body = await jsonBody<{ email?: string }>(c);
    return c.json(
      await deps.registration.cancelRegistration.execute(c.req.param("registrationId"), body?.email ?? ""),
    );
  });

  // --- Admin 後台 (x-admin-token) --------------------------------------------
  const admin = new Hono();
  admin.use("*", adminAuth(deps.config.adminToken));
  admin.get("/events/:eventId/registrations", async (c) =>
    c.json(
      await deps.registration.listRegistrationsForAdmin.execute(c.req.param("eventId"), c.req.query("status")),
    ),
  );
  admin.get("/events/:eventId/registrations.csv", async (c) => {
    const csv = await deps.registration.exportRegistrationsCsv.execute(c.req.param("eventId"));
    c.header("content-type", "text/csv; charset=utf-8");
    c.header("content-disposition", `attachment; filename="registrations-${c.req.param("eventId")}.csv"`);
    return c.body(csv);
  });
  admin.post("/registrations/:id/approve", async (c) =>
    c.json(await deps.registration.approveRegistration.execute(c.req.param("id"))),
  );
  admin.post("/registrations/:id/reject", async (c) => {
    const body = await jsonBody<{ reason?: string }>(c);
    return c.json(await deps.registration.rejectRegistration.execute(c.req.param("id"), body?.reason ?? ""));
  });
  admin.post("/registrations/:id/onsite-payment", async (c) =>
    c.json(await deps.registration.confirmOnsitePayment.execute(c.req.param("id"))),
  );
  app.route("/api/admin", admin);

  // --- Check-in 驗票 (shares the admin token — MVP 決議) -----------------------
  const checkin = new Hono();
  checkin.use("*", adminAuth(deps.config.adminToken));
  checkin.post("/scan", async (c) => {
    const body = await jsonBody<ScanRequest>(c);
    if (!body || typeof body.qrToken !== "string") throw new ValidationError("qrToken is required");
    return c.json(await deps.checkin.scanTicket.execute(body));
  });
  checkin.get("/events/:eventId/attendance", async (c) =>
    c.json(await deps.checkin.getAttendance.execute(c.req.param("eventId"))),
  );
  checkin.get("/events/:eventId/manifest", async (c) =>
    c.json(await deps.checkin.getCheckinManifest.execute(c.req.param("eventId"))),
  );
  app.route("/api/checkin", checkin);

  app.get("/health", (c) => c.json({ ok: true }));

  return app;
}

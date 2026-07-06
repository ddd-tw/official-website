/**
 * @dddtw/contracts — API contract shared between apps/api and apps/web.
 *
 * This is the single source of truth for the HTTP interface.
 * Backend implements it; frontend consumes it. Neither side may drift.
 *
 * Bounded contexts (see Miro board "DDD TW 官網"):
 *  - Catalog     活動目錄(GitHub-managed content, read-only at runtime)
 *  - Registration 報名(Postgres, 獨立 DB — 已決議)
 *  - Check-in    驗票(活動當天, 離線可驗)
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type EventStatus = "draft" | "rc" | "published" | "ended";
export type VenueKind = "onsite" | "online";

export type RegistrationStatus =
  | "submitted"
  | "pending_review"
  | "rejected"
  | "confirmed"
  | "cancelled"
  | "checked_in"
  | "no_show";

/** MVP 決議:現場繳費。線上金流(paid_online)為未來擴充。 */
export type PaymentStatus = "not_required" | "unpaid" | "paid_onsite" | "paid_online";

export type TicketStatus = "issued" | "checked_in" | "void";

export type ScanResult = "success" | "duplicate" | "invalid";

export interface ApiError {
  error: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// Catalog 活動目錄
// ---------------------------------------------------------------------------

export interface SpeakerDto {
  speakerId: string;
  name: string;
  photoUrl: string | null;
  jobTitle: string | null;
  bio: string | null;
  topic: string | null;
}

export interface VenueDto {
  kind: VenueKind;
  /** onsite 才有 */
  address: string | null;
  /** online 才有;未發布給一般會眾前可為 null */
  meetingUrl: string | null;
}

export interface EventSummaryDto {
  eventId: string;
  title: string;
  bannerUrl: string | null;
  summary: string;
  startsAt: string; // ISO 8601
  endsAt: string;
  venue: VenueDto;
  status: EventStatus;
  tags: string[];
  /** 售票彙總狀態,由報名 BC 提供 */
  availability: "on_sale" | "sold_out" | "closed" | "upcoming";
}

export interface TicketTypeDto {
  ticketTypeId: string;
  name: string;
  description: string | null;
  /** 單位:TWD 元;0 = 免費 */
  price: number;
  quota: number;
  remaining: number;
  salesOpensAt: string;
  salesClosesAt: string;
  requiresApproval: boolean;
}

export interface EventDetailDto extends EventSummaryDto {
  fullDescriptionMd: string;
  speakers: SpeakerDto[];
  ticketTypes: TicketTypeDto[];
}

// GET /api/events                      → EventSummaryDto[]
// GET /api/events/:eventId             → EventDetailDto

// ---------------------------------------------------------------------------
// Registration 報名
// ---------------------------------------------------------------------------

export interface AttendeeInfoDto {
  name: string;
  email: string;
  phone?: string;
  diet?: string;
  /** 志工票:申請理由 */
  note?: string;
}

export interface SubmitRegistrationRequest {
  ticketTypeId: string;
  attendee: AttendeeInfoDto;
}

export interface TicketDto {
  ticketId: string;
  status: TicketStatus;
  /** 簽章 QR 內容(前端 render 成 QR code) */
  qrToken: string;
}

export interface RegistrationDto {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  attendee: AttendeeInfoDto;
  status: RegistrationStatus;
  payment: PaymentStatus;
  /** confirmed 之後才有 */
  ticket: TicketDto | null;
  submittedAt: string;
}

// POST /api/events/:eventId/registrations  body: SubmitRegistrationRequest
//   → 201 RegistrationDto | 409 ApiError(code=SOLD_OUT|SALES_CLOSED) | 422
// GET  /api/registrations/:registrationId?email=…  → RegistrationDto(email 需相符)
// POST /api/registrations/:registrationId/cancel body:{email} → RegistrationDto

// ---------------------------------------------------------------------------
// Admin 後台(header: x-admin-token)
// ---------------------------------------------------------------------------

export interface AdminRegistrationListItemDto {
  registrationId: string;
  ticketTypeName: string;
  attendee: AttendeeInfoDto;
  status: RegistrationStatus;
  payment: PaymentStatus;
  submittedAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
}

export interface ReviewStatsDto {
  pendingReview: number;
  approved: number;
  rejected: number;
}

export interface AdminRegistrationsResponse {
  items: AdminRegistrationListItemDto[];
  stats: ReviewStatsDto;
}

// GET  /api/admin/events/:eventId/registrations?status=…  → AdminRegistrationsResponse
// POST /api/admin/registrations/:id/approve         → RegistrationDto
// POST /api/admin/registrations/:id/reject  body:{reason} → RegistrationDto
// POST /api/admin/registrations/:id/onsite-payment  → RegistrationDto(MVP 現場繳費)
// GET  /api/admin/events/:eventId/registrations.csv → text/csv 名單匯出

// ---------------------------------------------------------------------------
// Check-in 驗票(header: x-admin-token;MVP 與 admin 共用 token)
// ---------------------------------------------------------------------------

export interface ScanRequest {
  qrToken: string;
  gate?: string;
}

export interface ScanResponse {
  result: ScanResult;
  /** result=duplicate 時,附上首次入場時間 */
  firstScannedAt?: string;
  attendeeName?: string;
  ticketTypeName?: string;
  scannedAt: string;
}

export interface AttendanceDto {
  eventId: string;
  confirmedTotal: number;
  checkedIn: number;
  byTicketType: Array<{ ticketTypeName: string; confirmed: number; checkedIn: number }>;
}

/** 離線驗票用:開場前下載名單快取(見板上「離線驗票備案」方案 A) */
export interface CheckinManifestDto {
  eventId: string;
  generatedAt: string;
  entries: Array<{
    ticketId: string;
    attendeeName: string;
    ticketTypeName: string;
    status: TicketStatus;
  }>;
}

// POST /api/checkin/scan                          body: ScanRequest → ScanResponse
// GET  /api/checkin/events/:eventId/attendance    → AttendanceDto
// GET  /api/checkin/events/:eventId/manifest      → CheckinManifestDto

// ---------------------------------------------------------------------------
// Route constants(前後端共用,避免字串 drift)
// ---------------------------------------------------------------------------

export const routes = {
  listEvents: () => `/api/events`,
  eventDetail: (eventId: string) => `/api/events/${eventId}`,
  submitRegistration: (eventId: string) => `/api/events/${eventId}/registrations`,
  registration: (id: string) => `/api/registrations/${id}`,
  cancelRegistration: (id: string) => `/api/registrations/${id}/cancel`,
  adminRegistrations: (eventId: string) => `/api/admin/events/${eventId}/registrations`,
  adminRegistrationsCsv: (eventId: string) => `/api/admin/events/${eventId}/registrations.csv`,
  adminApprove: (id: string) => `/api/admin/registrations/${id}/approve`,
  adminReject: (id: string) => `/api/admin/registrations/${id}/reject`,
  adminOnsitePayment: (id: string) => `/api/admin/registrations/${id}/onsite-payment`,
  checkinScan: () => `/api/checkin/scan`,
  attendance: (eventId: string) => `/api/checkin/events/${eventId}/attendance`,
  checkinManifest: (eventId: string) => `/api/checkin/events/${eventId}/manifest`,
} as const;

export const ADMIN_TOKEN_HEADER = "x-admin-token";

import type {
  EventSummaryDto,
  PaymentStatus,
  RegistrationStatus,
  VenueKind,
} from "@dddtw/contracts";

const dateTimeFmt = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const timeFmt = new Intl.DateTimeFormat("zh-TW", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d);
}

export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} – ${endIso}`;
  }
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${dateTimeFmt.format(start)} – ${timeFmt.format(end)}`
    : `${dateTimeFmt.format(start)} – ${dateTimeFmt.format(end)}`;
}

export function formatPrice(price: number): string {
  return price === 0 ? "免費" : `NT$ ${price.toLocaleString("zh-TW")}`;
}

export function venueKindLabel(kind: VenueKind): string {
  return kind === "online" ? "線上" : "線下";
}

type Availability = EventSummaryDto["availability"];

export const availabilityMeta: Record<Availability, { label: string; className: string }> = {
  on_sale: { label: "開賣中", className: "badge badge-green" },
  sold_out: { label: "已額滿", className: "badge badge-red" },
  closed: { label: "已結束", className: "badge badge-gray" },
  upcoming: { label: "即將開賣", className: "badge badge-amber" },
};

export const registrationStatusMeta: Record<
  RegistrationStatus,
  { label: string; className: string }
> = {
  submitted: { label: "已送出", className: "badge badge-gray" },
  pending_review: { label: "待審核", className: "badge badge-amber" },
  rejected: { label: "已拒絕", className: "badge badge-red" },
  confirmed: { label: "已確認", className: "badge badge-green" },
  cancelled: { label: "已取消", className: "badge badge-gray" },
  checked_in: { label: "已報到", className: "badge badge-green" },
  no_show: { label: "未出席", className: "badge badge-gray" },
};

export const paymentStatusMeta: Record<PaymentStatus, { label: string; className: string }> = {
  not_required: { label: "免費", className: "badge badge-gray" },
  unpaid: { label: "現場繳費", className: "badge badge-amber" },
  paid_onsite: { label: "已繳費", className: "badge badge-green" },
  paid_online: { label: "已繳費", className: "badge badge-green" },
};

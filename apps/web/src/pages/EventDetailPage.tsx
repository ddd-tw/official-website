import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { routes, type EventDetailDto, type SpeakerDto, type TicketTypeDto } from "@dddtw/contracts";
import { api } from "../api/client";
import { useApi } from "../api/useApi";
import { Badge, EmptyState, ErrorBox, Loading } from "../components/ui";
import {
  availabilityMeta,
  formatDateRange,
  formatDateTime,
  formatPrice,
  venueKindLabel,
} from "../lib/format";
import { Markdown } from "../lib/markdown";

function SpeakerCard({ speaker }: { speaker: SpeakerDto }): ReactNode {
  return (
    <div className="card speaker-card">
      {speaker.photoUrl ? (
        <img className="speaker-photo" src={speaker.photoUrl} alt={speaker.name} />
      ) : (
        <div className="speaker-photo speaker-photo-placeholder" aria-hidden="true">
          {speaker.name.slice(0, 1)}
        </div>
      )}
      <div>
        <h4 className="speaker-name">{speaker.name}</h4>
        {speaker.jobTitle ? <p className="speaker-job">{speaker.jobTitle}</p> : null}
        {speaker.topic ? <p className="speaker-topic">講題:{speaker.topic}</p> : null}
      </div>
    </div>
  );
}

function TicketTypeRow({ ticket }: { ticket: TicketTypeDto }): ReactNode {
  return (
    <div className="ticket-row">
      <div className="ticket-row-main">
        <div className="ticket-row-name">
          <strong>{ticket.name}</strong>
          {ticket.requiresApproval ? <Badge label="需審核" className="badge badge-amber" /> : null}
        </div>
        {ticket.description ? <p className="ticket-row-desc">{ticket.description}</p> : null}
        <p className="ticket-row-sale">
          售票期間:{formatDateTime(ticket.salesOpensAt)} – {formatDateTime(ticket.salesClosesAt)}
        </p>
      </div>
      <div className="ticket-row-side">
        <span className="ticket-price">{formatPrice(ticket.price)}</span>
        <span className={ticket.remaining > 0 ? "ticket-remaining" : "ticket-remaining ticket-remaining-none"}>
          {ticket.remaining > 0 ? `剩餘 ${ticket.remaining} 名額` : "已額滿"}
        </span>
      </div>
    </div>
  );
}

export function EventDetailPage(): ReactNode {
  const { eventId } = useParams<"eventId">();
  const detail = useApi(
    () => api.get<EventDetailDto>(routes.eventDetail(eventId ?? "")),
    [eventId],
  );

  if (!eventId) return <EmptyState text="缺少活動編號。" />;
  if (detail.loading) return <Loading text="活動資料載入中…" />;
  if (detail.error) return <ErrorBox error={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return <EmptyState text="找不到這個活動。" />;

  const event = detail.data;
  const availability = availabilityMeta[event.availability];
  const canRegister = event.availability === "on_sale";

  return (
    <article>
      {event.bannerUrl ? (
        <img className="event-banner" src={event.bannerUrl} alt={event.title} />
      ) : (
        <div className="event-banner banner-placeholder" aria-hidden="true">
          DDD TAIWAN
        </div>
      )}

      <div className="event-head">
        <div className="event-card-badges">
          <Badge label={venueKindLabel(event.venue.kind)} className="badge badge-outline" />
          <Badge label={availability.label} className={availability.className} />
          {event.tags.map((tag) => (
            <Badge key={tag} label={tag} className="badge badge-outline" />
          ))}
        </div>
        <h1>{event.title}</h1>
        <p className="event-card-meta">時間:{formatDateRange(event.startsAt, event.endsAt)}</p>
        <p className="event-card-meta">
          地點:
          {event.venue.kind === "onsite"
            ? (event.venue.address ?? "線下場地(待公布)")
            : (event.venue.meetingUrl ?? "線上活動(連結報名後提供)")}
        </p>
        <p className="event-summary">{event.summary}</p>
        {canRegister ? (
          <Link to={`/events/${event.eventId}/register`} className="btn btn-primary btn-lg">
            立即報名
          </Link>
        ) : (
          <button type="button" className="btn btn-primary btn-lg" disabled>
            {availability.label}
          </button>
        )}
      </div>

      <section className="detail-section">
        <h2 className="section-title">完整介紹</h2>
        <div className="card card-pad">
          <Markdown source={event.fullDescriptionMd} />
        </div>
      </section>

      <section className="detail-section">
        <h2 className="section-title">講者</h2>
        {event.speakers.length > 0 ? (
          <div className="speaker-grid">
            {event.speakers.map((sp) => (
              <SpeakerCard key={sp.speakerId} speaker={sp} />
            ))}
          </div>
        ) : (
          <EmptyState text="講者資訊即將公布。" />
        )}
      </section>

      <section className="detail-section">
        <h2 className="section-title">票種</h2>
        <div className="card">
          {event.ticketTypes.length > 0 ? (
            event.ticketTypes.map((t) => <TicketTypeRow key={t.ticketTypeId} ticket={t} />)
          ) : (
            <EmptyState text="票種尚未公布。" />
          )}
        </div>
        {canRegister ? (
          <div className="detail-cta">
            <Link to={`/events/${event.eventId}/register`} className="btn btn-primary btn-lg">
              立即報名
            </Link>
          </div>
        ) : null}
      </section>
    </article>
  );
}

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { routes, type EventSummaryDto } from "@dddtw/contracts";
import { api } from "../api/client";
import { useApi } from "../api/useApi";
import { Badge, EmptyState, ErrorBox, Loading } from "../components/ui";
import { availabilityMeta, formatDateRange, venueKindLabel } from "../lib/format";

function EventCard({ event }: { event: EventSummaryDto }): ReactNode {
  const availability = availabilityMeta[event.availability];
  return (
    <article className="card event-card">
      {event.bannerUrl ? (
        <img className="event-card-banner" src={event.bannerUrl} alt={event.title} />
      ) : (
        <div className="event-card-banner banner-placeholder" aria-hidden="true">
          DDD TAIWAN
        </div>
      )}
      <div className="event-card-body">
        <div className="event-card-badges">
          <Badge label={venueKindLabel(event.venue.kind)} className="badge badge-outline" />
          <Badge label={availability.label} className={availability.className} />
        </div>
        <h3 className="event-card-title">{event.title}</h3>
        <p className="event-card-meta">{formatDateRange(event.startsAt, event.endsAt)}</p>
        {event.venue.kind === "onsite" && event.venue.address ? (
          <p className="event-card-meta">{event.venue.address}</p>
        ) : null}
        <p className="event-card-summary">{event.summary}</p>
        <Link to={`/events/${event.eventId}`} className="btn btn-secondary">
          查看活動詳情
        </Link>
      </div>
    </article>
  );
}

export function HomePage(): ReactNode {
  const events = useApi(() => api.get<EventSummaryDto[]>(routes.listEvents()), []);

  return (
    <>
      <section className="hero card">
        <h1>DDD Taiwan 社群</h1>
        <p>
          DDD Taiwan 是台灣的 Domain-Driven Design 實踐社群,我們透過工作坊、講座與年度大會,
          推廣領域驅動設計、事件風暴(Event Storming)與軟體建模實務,
          讓開發者與領域專家能用共通語言打造更貼近業務的軟體。
        </p>
        <p className="hero-sub">歡迎參加我們的活動,一起交流、一起成長。</p>
      </section>

      <section>
        <h2 className="section-title">近期活動</h2>
        {events.loading ? (
          <Loading text="活動載入中…" />
        ) : events.error ? (
          <ErrorBox error={events.error} onRetry={events.reload} />
        ) : events.data && events.data.length > 0 ? (
          <div className="event-grid">
            {events.data.map((ev) => (
              <EventCard key={ev.eventId} event={ev} />
            ))}
          </div>
        ) : (
          <EmptyState text="目前沒有活動,敬請期待。" />
        )}
      </section>
    </>
  );
}

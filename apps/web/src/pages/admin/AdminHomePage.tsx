import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { routes, type EventSummaryDto } from "@dddtw/contracts";
import { api } from "../../api/client";
import { useApi } from "../../api/useApi";
import { Badge, EmptyState, ErrorBox, Loading } from "../../components/ui";
import { availabilityMeta, formatDateRange } from "../../lib/format";

export function AdminHomePage(): ReactNode {
  const events = useApi(() => api.get<EventSummaryDto[]>(routes.listEvents()), []);

  return (
    <div>
      <h1>選擇活動</h1>
      {events.loading ? (
        <Loading text="活動載入中…" />
      ) : events.error ? (
        <ErrorBox error={events.error} onRetry={events.reload} />
      ) : events.data && events.data.length > 0 ? (
        <div className="admin-event-list">
          {events.data.map((ev) => {
            const availability = availabilityMeta[ev.availability];
            return (
              <div key={ev.eventId} className="card card-pad admin-event-item">
                <div>
                  <h3>{ev.title}</h3>
                  <p className="event-card-meta">{formatDateRange(ev.startsAt, ev.endsAt)}</p>
                  <Badge label={availability.label} className={availability.className} />
                </div>
                <div className="admin-event-links">
                  <Link to={`/admin/events/${ev.eventId}/review`} className="btn btn-secondary">
                    志工審核
                  </Link>
                  <Link
                    to={`/admin/events/${ev.eventId}/registrations`}
                    className="btn btn-secondary"
                  >
                    報名名單
                  </Link>
                  <Link to={`/admin/events/${ev.eventId}/checkin`} className="btn btn-secondary">
                    現場報到
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState text="目前沒有活動。" />
      )}
    </div>
  );
}

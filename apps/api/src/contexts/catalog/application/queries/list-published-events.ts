import type { EventSummaryDto } from "@dddtw/contracts";
import type { CatalogEvent } from "../../domain/event";
import type { EventAvailability, EventCatalog, TicketAvailabilityPort } from "../ports";

export function toEventSummaryDto(event: CatalogEvent, availability: EventAvailability): EventSummaryDto {
  return {
    eventId: event.eventId,
    title: event.title,
    bannerUrl: event.bannerUrl,
    summary: event.summary,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    venue: { ...event.venue },
    status: event.status,
    tags: [...event.tags],
    availability,
  };
}

export class ListPublishedEvents {
  constructor(
    private readonly catalog: EventCatalog,
    private readonly availability: TicketAvailabilityPort,
  ) {}

  async execute(): Promise<EventSummaryDto[]> {
    const published = this.catalog
      .all()
      .filter((e) => e.status === "published" || e.status === "ended")
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    const availabilityByEvent = await this.availability.eventAvailability(published.map((e) => e.eventId));

    return published.map((event) =>
      toEventSummaryDto(
        event,
        event.status === "ended" ? "closed" : (availabilityByEvent.get(event.eventId) ?? "closed"),
      ),
    );
  }
}

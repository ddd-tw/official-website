import type { EventDetailDto } from "@dddtw/contracts";
import { NotFoundError } from "../../../../shared/errors";
import type { EventCatalog, TicketAvailabilityPort } from "../ports";
import { toEventSummaryDto } from "./list-published-events";

export class GetEventDetail {
  constructor(
    private readonly catalog: EventCatalog,
    private readonly availability: TicketAvailabilityPort,
  ) {}

  async execute(eventId: string): Promise<EventDetailDto> {
    const event = this.catalog.byId(eventId);
    if (!event || (event.status !== "published" && event.status !== "ended")) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }

    const [availabilityByEvent, ticketTypes] = await Promise.all([
      this.availability.eventAvailability([event.eventId]),
      this.availability.ticketTypesOf(event.eventId),
    ]);

    return {
      ...toEventSummaryDto(
        event,
        event.status === "ended" ? "closed" : (availabilityByEvent.get(event.eventId) ?? "closed"),
      ),
      fullDescriptionMd: event.fullDescriptionMd,
      speakers: event.speakers.map((s) => ({ ...s })),
      ticketTypes,
    };
  }
}

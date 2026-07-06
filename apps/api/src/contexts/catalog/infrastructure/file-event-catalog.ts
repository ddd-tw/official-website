import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ValidationError } from "../../../shared/errors";
import type { EventCatalog } from "../application/ports";
import { parseCatalogEvent, type CatalogEvent } from "../domain/event";

/**
 * Loads and validates content/events/*.json once at startup.
 * Content is GitHub-managed and immutable at runtime (RC → Release flow).
 */
export class FileEventCatalog implements EventCatalog {
  private readonly events: Map<string, CatalogEvent>;

  constructor(contentDir: string) {
    this.events = new Map();
    const files = readdirSync(contentDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    for (const file of files) {
      const path = join(contentDir, file);
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(path, "utf8"));
      } catch (e) {
        throw new ValidationError(`${file}: invalid JSON — ${(e as Error).message}`);
      }
      const event = parseCatalogEvent(raw, file);
      if (this.events.has(event.eventId)) {
        throw new ValidationError(`${file}: duplicate eventId "${event.eventId}"`);
      }
      this.events.set(event.eventId, event);
    }
  }

  all(): CatalogEvent[] {
    return [...this.events.values()];
  }

  byId(eventId: string): CatalogEvent | null {
    return this.events.get(eventId) ?? null;
  }
}

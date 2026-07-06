/**
 * Syncs ticket-type definitions from content/events/*.json into the
 * registration DB (upsert; live `reserved` counters are never touched).
 */
import { SQL } from "bun";
import { loadConfig } from "../config";
import { FileEventCatalog } from "../contexts/catalog/infrastructure/file-event-catalog";

const config = loadConfig();
const sql = new SQL(config.databaseUrl);
const catalog = new FileEventCatalog(config.contentDir);

let count = 0;
for (const event of catalog.all()) {
  for (const tt of event.ticketTypes) {
    await sql`
      INSERT INTO ticket_types (
        ticket_type_id, event_id, name, description, price, quota,
        sales_opens_at, sales_closes_at, requires_approval
      ) VALUES (
        ${tt.ticketTypeId}, ${event.eventId}, ${tt.name}, ${tt.description}, ${tt.price}, ${tt.quota},
        ${tt.salesOpensAt}, ${tt.salesClosesAt}, ${tt.requiresApproval}
      )
      ON CONFLICT (ticket_type_id) DO UPDATE SET
        event_id = EXCLUDED.event_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        quota = EXCLUDED.quota,
        sales_opens_at = EXCLUDED.sales_opens_at,
        sales_closes_at = EXCLUDED.sales_closes_at,
        requires_approval = EXCLUDED.requires_approval,
        updated_at = now()`;
    count++;
    console.log(`[seed] upserted ticket type ${tt.ticketTypeId} (${event.eventId} / ${tt.name})`);
  }
}

console.log(`[seed] done — ${count} ticket type(s) synced from ${catalog.all().length} event(s)`);
await sql.end();

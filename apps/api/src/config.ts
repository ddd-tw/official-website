/**
 * Single config module — every env var is read here and nowhere else.
 */
export interface AppConfig {
  databaseUrl: string;
  port: number;
  adminToken: string;
  ticketSecret: string;
  corsOrigin: string;
  contentDir: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    databaseUrl: env.DATABASE_URL ?? "postgres://dddtw:dddtw@localhost:5433/dddtw",
    port: Number(env.PORT ?? "3000"),
    adminToken: env.ADMIN_TOKEN ?? "dev-admin-token",
    ticketSecret: env.TICKET_SECRET ?? "dev-ticket-secret",
    corsOrigin: env.CORS_ORIGIN ?? "http://localhost:5173",
    contentDir: env.CONTENT_DIR ?? new URL("../../../content/events", import.meta.url).pathname,
  };
}

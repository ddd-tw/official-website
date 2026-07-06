/** Runs db/migrations/*.sql in filename order; tracks applied in schema_migrations. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SQL } from "bun";
import { loadConfig } from "../config";

const MIGRATIONS_DIR = new URL("../../../../db/migrations", import.meta.url).pathname;

const config = loadConfig();
const sql = new SQL(config.databaseUrl);

await sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

const applied = new Set(
  (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name),
);

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  if (applied.has(file)) {
    console.log(`[migrate] skip    ${file} (already applied)`);
    continue;
  }
  const ddl = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(ddl);
    await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
  });
  console.log(`[migrate] applied ${file}`);
}

console.log(`[migrate] done (${files.length} file(s), ${files.filter((f) => !applied.has(f)).length} newly applied)`);
await sql.end();

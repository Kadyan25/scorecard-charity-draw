// Applies supabase/migrations/*.sql (and optionally supabase/seed.sql) to any
// Postgres database, without needing the Supabase CLI.
//
//   node --env-file=.env.local scripts/db-push.mjs [--seed]
//
// Reads SUPABASE_DB_URL (the project's Session pooler URI, password included).
// Tracks what has run in supabase_migrations.schema_migrations — the same table
// the CLI uses — so it is safe to re-run and picks up only new migrations.
// Each migration runs in its own transaction: one failure rolls that file back
// and stops, leaving earlier migrations applied and recorded.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Set SUPABASE_DB_URL in .env.local (Supabase dashboard > Connect > Session pooler).");
  process.exit(1);
}

const withSeed = process.argv.includes("--seed");
const dir = path.join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();

// Supabase requires TLS; a local stack does not offer it.
const isLocal = /@(localhost|127\.0\.0\.1)\b/.test(url);
const client = new pg.Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  const { rows: version } = await client.query("select current_setting('server_version') as v");
  console.info(`Connected to Postgres ${version[0].v}`);

  await client.query("create schema if not exists supabase_migrations");
  await client.query("create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[])");
  const { rows: done } = await client.query("select version from supabase_migrations.schema_migrations");
  const applied = new Set(done.map((row) => row.version));

  let count = 0;
  for (const file of files) {
    const version = file.split("_")[0];
    if (applied.has(version)) {
      console.info(`  skip  ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(path.join(dir, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)", [version, file.replace(/^\d+_/, "").replace(/\.sql$/, "")]);
      await client.query("commit");
      console.info(`  ok    ${file}`);
      count += 1;
    } catch (error) {
      await client.query("rollback");
      throw new Error(`${file}: ${error.message}`);
    }
  }

  if (withSeed) {
    const seed = readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8");
    await client.query(seed);
    console.info("  ok    seed.sql");
  }

  const { rows: tables } = await client.query("select count(*)::int as n from pg_tables where schemaname = 'public'");
  console.info(`\n${count} migration(s) applied. ${tables[0].n} tables in public.`);
}

main()
  .catch((error) => {
    console.error("\nMigration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());

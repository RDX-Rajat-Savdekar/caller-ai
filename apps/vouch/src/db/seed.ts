import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { ensureSchema } from "./ensure";

const dbFile = process.env.VOUCH_DB ?? join(process.cwd(), "data/vouch.db");
mkdirSync(dirname(dbFile), { recursive: true });
const sqlite = new Database(dbFile);
ensureSchema(sqlite);

sqlite.exec("DELETE FROM consents");
sqlite
  .prepare(
    `INSERT INTO consents (
      id, candidate_name, employer, jurisdiction, requested_json, consent_fields_json, signed_at, expires_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  )
  .run(
    "cns_demo",
    "Alex Rivera",
    "Northbay Civic Works",
    "US-CA",
    JSON.stringify([
      "employment_confirmed",
      "title_stated",
      "start_date_stated",
      "end_date_stated",
      "eligible_for_rehire",
      "salary_history",
    ]),
    JSON.stringify([
      "employment_confirmed",
      "title_stated",
      "start_date_stated",
      "end_date_stated",
      "eligible_for_rehire",
      "salary_history",
    ]),
    "2026-08-12",
    "2026-11-12",
  );

console.log(`[seed] wrote consent cns_demo to ${dbFile}`);

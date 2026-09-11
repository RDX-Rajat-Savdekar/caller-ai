import type Database from "better-sqlite3";

export function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY,
      candidate_name TEXT NOT NULL,
      employer TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      requested_json TEXT NOT NULL,
      consent_fields_json TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
  `);
}

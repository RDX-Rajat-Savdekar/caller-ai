import type Database from "better-sqlite3";

export function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      agency TEXT NOT NULL,
      timezone TEXT NOT NULL,
      callback_number TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS instruments (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      task_text TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS roster (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      phone_masked TEXT NOT NULL,
      phone_e164 TEXT NOT NULL,
      region TEXT NOT NULL,
      locale TEXT NOT NULL,
      timezone TEXT NOT NULL,
      household_size INTEGER,
      flags_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS waves (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      instrument_id TEXT NOT NULL,
      wave_no INTEGER NOT NULL,
      filter_json TEXT NOT NULL,
      budget_cap INTEGER NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      wave_id TEXT NOT NULL,
      roster_entry_id TEXT NOT NULL,
      run_id TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      disposition TEXT,
      result_json TEXT,
      transcript_json TEXT,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS triage_cards (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      attempt_id TEXT NOT NULL,
      roster_entry_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      needs_json TEXT NOT NULL,
      assignee TEXT,
      status TEXT NOT NULL
    );
  `);
}

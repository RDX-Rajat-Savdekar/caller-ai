import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { headcountKey } from "@caller-ai/core/idempotency";
import { compileTaskText } from "../lib/instrument";
import { ensureSchema } from "./ensure";

const eventId = "evt_bennett_valley";
const instrumentId = "ins_casper_v1";
const waveId = "wav_1";

const taskText = compileTaskText({
  agency: "Sonoma County Emergency Management",
  event: "Bennett Valley fire (CASPER drill)",
  callback: "+1 707 ••• ••00",
});

type SeedRow = {
  id: string;
  name: string;
  phone: string;
  masked: string;
  hh: number;
  disposition: string;
  result: Record<string, unknown>;
  severity: "critical" | "follow_up" | "safe" | "unaccounted";
  needs: string[];
};

const rows: SeedRow[] = [
  {
    id: "rst_01",
    name: "Household 01",
    phone: "+15555550101",
    masked: "+1 555 ••• ••01",
    hh: 3,
    disposition: "answered_confirmed",
    result: {
      safety_status: "safe",
      evacuation: "sheltering_in_place",
      has_power: "yes",
      has_water: "yes",
      medication: "none_needed",
      household: "all_accounted",
      needs_human: "no",
    },
    severity: "safe",
    needs: [],
  },
  {
    id: "rst_02",
    name: "Household 02",
    phone: "+15555550102",
    masked: "+1 555 ••• ••02",
    hh: 2,
    disposition: "voicemail_left",
    result: {
      safety_status: "unknown",
      evacuation: "unknown",
      has_power: "unknown",
      has_water: "unknown",
      medication: "unknown",
      household: "unknown",
      needs_human: "unknown",
    },
    severity: "unaccounted",
    needs: ["no_contact"],
  },
  {
    id: "rst_03",
    name: "Household 03",
    phone: "+15555550103",
    masked: "+1 555 ••• ••03",
    hh: 4,
    disposition: "answered_unknown",
    result: {
      safety_status: "needs_assistance",
      evacuation: "sheltering_in_place",
      has_power: "no",
      has_water: "unknown",
      medication: "unknown",
      household: "unknown",
      needs_human: "unknown",
    },
    severity: "follow_up",
    needs: ["power", "recontact"],
  },
  {
    id: "rst_04",
    name: "Household 04",
    phone: "+15555550104",
    masked: "+1 555 ••• ••04",
    hh: 2,
    disposition: "answered_confirmed",
    result: {
      safety_status: "medical_emergency",
      evacuation: "trapped",
      has_power: "no",
      has_water: "unknown",
      medication: "unknown",
      household: "partial",
      needs_human: "yes",
    },
    severity: "critical",
    needs: ["medical", "rescue"],
  },
  {
    id: "rst_05",
    name: "Household 05",
    phone: "+15555550105",
    masked: "+1 555 ••• ••05",
    hh: 1,
    disposition: "wrong_person",
    result: {
      safety_status: "unknown",
      evacuation: "unknown",
      has_power: "unknown",
      has_water: "unknown",
      medication: "unknown",
      household: "unknown",
      needs_human: "unknown",
    },
    severity: "unaccounted",
    needs: ["wrong_number"],
  },
  {
    id: "rst_06",
    name: "Household 06",
    phone: "+15555550108",
    masked: "+1 555 ••• ••08",
    hh: 5,
    disposition: "hung_up",
    result: {
      safety_status: "unknown",
      evacuation: "unknown",
      has_power: "unknown",
      has_water: "unknown",
      medication: "unknown",
      household: "unknown",
      needs_human: "unknown",
    },
    severity: "unaccounted",
    needs: ["hung_up"],
  },
  {
    id: "rst_07",
    name: "Household 07",
    phone: "+15555550109",
    masked: "+1 555 ••• ••09",
    hh: 3,
    disposition: "answered_confirmed",
    result: {
      safety_status: "safe",
      evacuation: "sheltering_in_place",
      has_power: "yes",
      has_water: "yes",
      medication: "none_needed",
      household: "all_accounted",
      needs_human: "no",
    },
    severity: "follow_up",
    needs: ["unsupported_has_power"],
  },
  {
    id: "rst_08",
    name: "Household 08",
    phone: "+15555550110",
    masked: "+1 555 ••• ••10",
    hh: 2,
    disposition: "no_answer",
    result: {
      safety_status: "unknown",
      evacuation: "unknown",
      has_power: "unknown",
      has_water: "unknown",
      medication: "unknown",
      household: "unknown",
      needs_human: "unknown",
    },
    severity: "unaccounted",
    needs: ["no_contact"],
  },
  {
    id: "rst_09",
    name: "Household 09",
    phone: "+15555550111",
    masked: "+1 555 ••• ••11",
    hh: 6,
    disposition: "answered_confirmed",
    result: {
      safety_status: "safe",
      evacuation: "evacuated",
      has_power: "unknown",
      has_water: "yes",
      medication: "none_needed",
      household: "all_accounted",
      needs_human: "no",
    },
    severity: "safe",
    needs: [],
  },
  {
    id: "rst_10",
    name: "Household 10",
    phone: "+15555550112",
    masked: "+1 555 ••• ••12",
    hh: 2,
    disposition: "voicemail_left",
    result: {
      safety_status: "unknown",
      evacuation: "unknown",
      has_power: "unknown",
      has_water: "unknown",
      medication: "unknown",
      household: "unknown",
      needs_human: "unknown",
    },
    severity: "unaccounted",
    needs: ["no_contact"],
  },
  {
    id: "rst_11",
    name: "Household 11",
    phone: "+15555550113",
    masked: "+1 555 ••• ••13",
    hh: 1,
    disposition: "invalid_number",
    result: {
      safety_status: "unknown",
      evacuation: "unknown",
      has_power: "unknown",
      has_water: "unknown",
      medication: "unknown",
      household: "unknown",
      needs_human: "unknown",
    },
    severity: "unaccounted",
    needs: ["invalid_number"],
  },
  {
    id: "rst_12",
    name: "Household 12",
    phone: "+15555550114",
    masked: "+1 555 ••• ••14",
    hh: 4,
    disposition: "answered_confirmed",
    result: {
      safety_status: "safe",
      evacuation: "sheltering_in_place",
      has_power: "yes",
      has_water: "yes",
      medication: "running_low",
      household: "all_accounted",
      needs_human: "no",
    },
    severity: "follow_up",
    needs: ["medication"],
  },
];

const dbFile = process.env.HEADCOUNT_DB ?? join(dirname(fileURLToPath(import.meta.url)), "../../data/headcount.db");
mkdirSync(dirname(dbFile), { recursive: true });
const sqlite = new Database(dbFile);
ensureSchema(sqlite);

sqlite.exec(`
  DELETE FROM triage_cards;
  DELETE FROM attempts;
  DELETE FROM waves;
  DELETE FROM roster;
  DELETE FROM instruments;
  DELETE FROM events;
`);

sqlite
  .prepare(
    `INSERT INTO events (id, name, agency, timezone, callback_number, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
  )
  .run(
    eventId,
    "Bennett Valley fire — CASPER drill",
    "Sonoma County Emergency Management",
    "America/Los_Angeles",
    "+1 707 ••• ••00",
  );

sqlite
  .prepare(
    `INSERT INTO instruments (id, event_id, version, title, questions_json, task_text)
     VALUES (?, ?, 1, ?, ?, ?)`,
  )
  .run(
    instrumentId,
    eventId,
    "CASPER household needs check v1",
    JSON.stringify([
      "Is everyone in the household safe and accounted for?",
      "Are you sheltering in place, or have you evacuated?",
      "Do you have electricity right now? Running water?",
      "Does anyone need prescription medication you cannot get?",
      "Is there anything urgent you need help with right now?",
    ]),
    taskText,
  );

sqlite
  .prepare(
    `INSERT INTO waves (id, event_id, instrument_id, wave_no, filter_json, budget_cap, status)
     VALUES (?, ?, ?, 1, ?, 12, 'complete')`,
  )
  .run(waveId, eventId, instrumentId, JSON.stringify({ slice: "full_roster" }));

const insertRoster = sqlite.prepare(
  `INSERT INTO roster (id, event_id, display_name, phone_masked, phone_e164, region, locale, timezone, household_size, flags_json)
   VALUES (?, ?, ?, ?, ?, 'US', 'en-US', 'America/Los_Angeles', ?, ?)`,
);
const insertAttempt = sqlite.prepare(
  `INSERT INTO attempts (id, wave_id, roster_entry_id, run_id, idempotency_key, disposition, result_json, transcript_json, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'terminal')`,
);
const insertTriage = sqlite.prepare(
  `INSERT INTO triage_cards (id, event_id, attempt_id, roster_entry_id, severity, needs_json, assignee, status)
   VALUES (?, ?, ?, ?, ?, ?, NULL, 'open')`,
);

for (const row of rows) {
  insertRoster.run(row.id, eventId, row.name, row.masked, row.phone, row.hh, "[]");
  const attemptId = `att_${row.id}`;
  insertAttempt.run(
    attemptId,
    waveId,
    row.id,
    `sim_${row.id}`,
    headcountKey({
      eventId,
      rosterEntryId: row.id,
      waveNo: 1,
      instrumentVersion: 1,
    }),
    row.disposition,
    JSON.stringify(row.result),
  );
  insertTriage.run(
    `tri_${row.id}`,
    eventId,
    attemptId,
    row.id,
    row.severity,
    JSON.stringify(row.needs),
  );
}

console.log(`[seed] wrote ${rows.length} roster rows to ${dbFile}`);
console.log("[seed] coverage: 12 dialed / 8 reached / 4 unreached (voicemail is unreached)");

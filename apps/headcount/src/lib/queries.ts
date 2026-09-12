import { eq } from "drizzle-orm";
import {
  DEFAULT_PROJECT_CAP,
  isReached,
  remainingCalls,
  resolveCalleMode,
  type Disposition,
} from "@caller-ai/core";
import { db, schema } from "@/db";
import { parseJson } from "./utils";
import { countAttempts, getKilled } from "./wave-runner";

export const SEED_EVENT_ID = "evt_bennett_valley";

export async function listEvents() {
  return db.select().from(schema.events).all();
}

export async function getEvent(id: string) {
  return db.select().from(schema.events).where(eq(schema.events.id, id)).get();
}

export async function getInstrument(id: string) {
  return db.select().from(schema.instruments).where(eq(schema.instruments.id, id)).get();
}

export async function listInstruments(eventId: string) {
  return db.select().from(schema.instruments).where(eq(schema.instruments.eventId, eventId)).all();
}

export async function listRoster(eventId: string) {
  return db.select().from(schema.roster).where(eq(schema.roster.eventId, eventId)).all();
}

export async function listWaves(eventId: string) {
  return db.select().from(schema.waves).where(eq(schema.waves.eventId, eventId)).all();
}

export async function getAttempt(id: string) {
  return db.select().from(schema.attempts).where(eq(schema.attempts.id, id)).get();
}

export async function getWave(id: string) {
  return db.select().from(schema.waves).where(eq(schema.waves.id, id)).get();
}

export async function getConsoleState() {
  const used = countAttempts();
  const killed = getKilled();
  const cap = DEFAULT_PROJECT_CAP;
  const remaining = remainingCalls({ projectCap: cap, used, killed, blocklist: [] });
  return {
    used,
    cap,
    remaining,
    killed,
    mode: resolveCalleMode(),
  };
}

export async function getRosterEntry(id: string) {
  return db.select().from(schema.roster).where(eq(schema.roster.id, id)).get();
}

export async function coverageForEvent(eventId: string) {
  const eventWaves = await listWaves(eventId);
  const waveIds = new Set(eventWaves.map((wave) => wave.id));
  const allAttempts = db.select().from(schema.attempts).all().filter((row) => waveIds.has(row.waveId));
  const dialed = allAttempts.length;
  const reached = allAttempts.filter((row) => row.disposition && isReached(row.disposition as Disposition)).length;
  return {
    dialed,
    reached,
    unreached: dialed - reached,
  };
}

export async function triageForEvent(eventId: string) {
  const cards = db.select().from(schema.triageCards).where(eq(schema.triageCards.eventId, eventId)).all();
  const people = await listRoster(eventId);
  const byId = new Map(people.map((row) => [row.id, row]));
  const latest = new Map<string, (typeof cards)[number]>();
  for (const card of cards) {
    const current = latest.get(card.rosterEntryId);
    if (!current || card.id > current.id) latest.set(card.rosterEntryId, card);
  }

  return [...latest.values()].map((card) => ({
    ...card,
    needs: parseJson<string[]>(card.needsJson, []),
    household: byId.get(card.rosterEntryId),
  }));
}

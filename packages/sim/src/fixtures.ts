import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PersonaFixture, PersonaId } from "./types";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

const cache = new Map<PersonaId, PersonaFixture>();

export function loadFixture(id: PersonaId): PersonaFixture {
  const cached = cache.get(id);
  if (cached) return cached;
  const raw = readFileSync(join(fixturesDir, `${id}.json`), "utf8");
  const fixture = JSON.parse(raw) as PersonaFixture;
  cache.set(id, fixture);
  return fixture;
}

export function listPersonaIds(): PersonaId[] {
  return readdirSync(fixturesDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, "") as PersonaId);
}

export function pickPersona(request: Record<string, unknown>): PersonaId {
  const metadata = (request.metadata ?? {}) as Record<string, unknown>;
  if (typeof metadata.persona === "string") return metadata.persona as PersonaId;
  const recipients = (request.recipients ?? []) as Array<{ phones?: string[] }>;
  const phone = recipients[0]?.phones?.[0] ?? "";
  if (phone.endsWith("01")) return "cooperative";
  if (phone.endsWith("02")) return "voicemail";
  if (phone.endsWith("03")) return "partial";
  if (phone.endsWith("04")) return "emergency";
  if (phone.endsWith("05")) return "wrong_person";
  if (phone.endsWith("06")) return "gatekeeper";
  if (phone.endsWith("07")) return "ivr_maze";
  if (phone.endsWith("08")) return "hostile";
  if (phone.endsWith("09")) return "unsupported_claim";
  return "cooperative";
}

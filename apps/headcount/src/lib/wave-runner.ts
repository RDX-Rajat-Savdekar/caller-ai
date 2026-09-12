import {
  DEFAULT_PROJECT_CAP,
  accountWave,
  canDial,
  headcountKey,
  isRetryable,
  linkEvidence,
  type Disposition,
} from "@caller-ai/core";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { triageAttempt } from "./escalate";
import { loadCallScript, ROSTER_SCRIPTS, scriptForWaveTwo, type ScriptId } from "./scripts";
import { parseJson } from "./utils";

export type WavePreview = {
  waveNo: number;
  alreadyRan: boolean;
  killed: boolean;
  targets: Array<{
    rosterEntryId: string;
    displayName: string;
    phoneMasked: string;
    reason: string;
  }>;
  wouldDial: number;
  wouldRemain: number;
};

export function scriptForRoster(rosterEntryId: string): ScriptId {
  return ROSTER_SCRIPTS[rosterEntryId] ?? "cooperative";
}

export function getKilled(): boolean {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, "killed")).get();
  return row?.value === "1";
}

export function setKilled(killed: boolean) {
  const value = killed ? "1" : "0";
  const existing = db.select().from(schema.settings).where(eq(schema.settings.key, "killed")).get();
  if (existing) {
    db.update(schema.settings).set({ value }).where(eq(schema.settings.key, "killed")).run();
    return;
  }
  db.insert(schema.settings).values({ key: "killed", value }).run();
}

export function countAttempts(): number {
  return db.select().from(schema.attempts).all().length;
}

export function previewNextWave(eventId: string): WavePreview {
  const waves = db.select().from(schema.waves).where(eq(schema.waves.eventId, eventId)).all();
  const nextNo = waves.reduce((max, wave) => Math.max(max, wave.waveNo), 0) + 1;
  const already = waves.some((wave) => wave.waveNo === nextNo);
  const killed = getKilled();
  const used = countAttempts();
  const targets = already ? [] : selectTargets(eventId, nextNo);
  const budget = accountWave(
    { projectCap: DEFAULT_PROJECT_CAP, used, killed, blocklist: [] },
    targets.length,
  );

  return {
    waveNo: nextNo,
    alreadyRan: already,
    killed,
    targets: targets.slice(0, budget.wouldDial),
    wouldDial: budget.wouldDial,
    wouldRemain: budget.wouldRemain,
  };
}

export function runNextWave(eventId: string): { ok: true; waveId: string } | { ok: false; reason: string } {
  const preview = previewNextWave(eventId);
  if (preview.killed) return { ok: false, reason: "kill_switch" };
  if (preview.alreadyRan) return { ok: false, reason: "already_ran" };
  if (preview.wouldDial === 0) return { ok: false, reason: "no_targets" };

  const event = db.select().from(schema.events).where(eq(schema.events.id, eventId)).get();
  const instrument = db
    .select()
    .from(schema.instruments)
    .where(eq(schema.instruments.eventId, eventId))
    .get();
  if (!event || !instrument) return { ok: false, reason: "missing_event" };

  const waveId = `wav_${preview.waveNo}`;
  db.insert(schema.waves)
    .values({
      id: waveId,
      eventId,
      instrumentId: instrument.id,
      waveNo: preview.waveNo,
      filterJson: JSON.stringify({ slice: preview.waveNo === 1 ? "full_roster" : "retryable_and_needs" }),
      budgetCap: preview.wouldDial,
      status: "complete",
    })
    .run();

  for (const target of preview.targets) {
    persistAttempt({
      eventId,
      waveId,
      waveNo: preview.waveNo,
      instrumentVersion: instrument.version,
      rosterEntryId: target.rosterEntryId,
    });
  }

  return { ok: true, waveId };
}

export function persistAttempt(input: {
  eventId: string;
  waveId: string;
  waveNo: number;
  instrumentVersion: number;
  rosterEntryId: string;
}) {
  const key = headcountKey({
    eventId: input.eventId,
    rosterEntryId: input.rosterEntryId,
    waveNo: input.waveNo,
    instrumentVersion: input.instrumentVersion,
  });
  const existing = db.select().from(schema.attempts).where(eq(schema.attempts.idempotencyKey, key)).get();
  if (existing) return existing.id;

  const roster = db.select().from(schema.roster).where(eq(schema.roster.id, input.rosterEntryId)).get();
  const decision = canDial(
    { projectCap: DEFAULT_PROJECT_CAP, used: countAttempts(), killed: getKilled(), blocklist: [] },
    roster?.phoneE164 ?? "",
  );
  if (!decision.ok) return null;

  const scriptId =
    input.waveNo > 1
      ? scriptForWaveTwo(scriptForRoster(input.rosterEntryId))
      : scriptForRoster(input.rosterEntryId);
  const script = loadCallScript(scriptId);
  const linked = linkEvidence({
    structuredResult: script.result,
    evidence: script.evidence,
    turns: script.turns,
  });
  const triage = triageAttempt({
    disposition: script.disposition as Disposition,
    result: script.result,
    linked,
    confidence: script.confidence,
  });

  const attemptId = `att_${input.rosterEntryId}_w${input.waveNo}`;
  db.insert(schema.attempts)
    .values({
      id: attemptId,
      waveId: input.waveId,
      rosterEntryId: input.rosterEntryId,
      runId: `sim_${scriptId}_${input.waveNo}`,
      idempotencyKey: key,
      disposition: script.disposition,
      resultJson: JSON.stringify(script.result),
      transcriptJson: JSON.stringify(script.turns),
      evidenceJson: JSON.stringify(script.evidence),
      confidenceScore: String(script.confidence),
      status: "terminal",
    })
    .run();

  db.insert(schema.triageCards)
    .values({
      id: `tri_${input.rosterEntryId}_w${input.waveNo}`,
      eventId: input.eventId,
      attemptId,
      rosterEntryId: input.rosterEntryId,
      severity: triage.severity,
      needsJson: JSON.stringify(triage.needs),
      assignee: null,
      status: triage.dispatch ? "open" : triage.severity === "safe" ? "closed" : "open",
    })
    .run();

  return attemptId;
}

function selectTargets(eventId: string, waveNo: number) {
  const roster = db.select().from(schema.roster).where(eq(schema.roster.eventId, eventId)).all();
  if (waveNo === 1) {
    return roster.map((row) => ({
      rosterEntryId: row.id,
      displayName: row.displayName,
      phoneMasked: row.phoneMasked,
      reason: "full roster",
    }));
  }

  const attempts = db.select().from(schema.attempts).all();
  const latest = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    const current = latest.get(attempt.rosterEntryId);
    if (!current || attempt.id > current.id) latest.set(attempt.rosterEntryId, attempt);
  }

  return roster.flatMap((row) => {
    const attempt = latest.get(row.id);
    if (!attempt?.disposition) return [];
    const result = parseJson<Record<string, unknown>>(attempt.resultJson, {});
    const retryable = isRetryable(attempt.disposition as Disposition);
    const needsHelp = result.safety_status === "needs_assistance";
    if (!retryable && !needsHelp) return [];
    return [
      {
        rosterEntryId: row.id,
        displayName: row.displayName,
        phoneMasked: row.phoneMasked,
        reason: retryable ? attempt.disposition : "needs assistance",
      },
    ];
  });
}

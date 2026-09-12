import Link from "next/link";
import { notFound } from "next/navigation";
import { isReached, linkEvidence, type Disposition, type TranscriptTurn } from "@caller-ai/core";
import { ConsoleShell } from "@/components/console-shell";
import { CallReelPlayer } from "@/components/reel-player";
import { triageAttempt } from "@/lib/escalate";
import { fieldLabel, prettyValue } from "@/lib/fields";
import { getAttempt, getEvent, getInstrument, getRosterEntry, getWave } from "@/lib/queries";
import { parseJson } from "@/lib/utils";

function formatClock(seconds?: number) {
  const value = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attempt = await getAttempt(id);
  if (!attempt) notFound();

  const household = await getRosterEntry(attempt.rosterEntryId);
  const wave = await getWave(attempt.waveId);
  const event = wave ? await getEvent(wave.eventId) : null;
  const instrument = wave ? await getInstrument(wave.instrumentId) : null;
  const result = parseJson<Record<string, unknown>>(attempt.resultJson, {});
  const turns = parseJson<TranscriptTurn[]>(attempt.transcriptJson, []);
  const evidence = parseJson<string[]>(attempt.evidenceJson, []);
  const linked = linkEvidence({ structuredResult: result, evidence, turns });
  const reached = attempt.disposition ? isReached(attempt.disposition as Disposition) : false;
  const confidence = attempt.confidenceScore ? Number(attempt.confidenceScore) : null;
  const triage = triageAttempt({
    disposition: (attempt.disposition as Disposition | null) ?? null,
    result,
    linked,
    confidence,
  });

  return (
    <ConsoleShell eventId={event?.id} eventName={event?.name} active="call" tight>
      <div className="flex items-end justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-card">
        <div>
          <Link href={event ? `/events/${event.id}` : "/"} className="text-xs text-mute hover:text-ink">
            Coverage
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{household?.displayName ?? attempt.rosterEntryId}</h1>
          <p className="mt-0.5 text-xs text-mute">{household?.phoneMasked}</p>
        </div>
        <p className={`text-sm font-medium ${reached ? "text-safe" : "text-unaccounted"}`}>
          {prettyValue(attempt.disposition ?? "pending")}
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl bg-white px-5 py-4 shadow-card">
          <h2 className="text-sm font-semibold">Why this call?</h2>
          <dl className="mt-3 space-y-1.5 text-xs">
            <Row label="Authorization" value={`${event?.agency ?? "—"} · opt-in roster`} />
            <Row label="Event" value={event?.name ?? "—"} />
            <Row label="Instrument" value={instrument ? `${instrument.title} · v${instrument.version}` : "—"} />
            <Row label="Wave" value={wave ? `Wave ${wave.waveNo}` : "—"} />
            <Row
              label="Recipient"
              value={
                household
                  ? `${household.region} · ${household.locale} · ${household.timezone}`
                  : "region set on the roster, not inferred"
              }
            />
            <Row label="Callback" value={event?.callbackNumber ?? "—"} />
          </dl>
        </article>

        {triage.dispatch ? (
          <article className="rounded-2xl bg-white px-5 py-4 shadow-card">
            <p className="text-xs font-medium text-critical">Dispatch</p>
            <h2 className="mt-1 text-sm font-semibold">Flagged for a human. Not resolved.</h2>
            <p className="mt-2 text-xs text-mute">
              Ambiguity and unsupported claims stay with a person. This card cannot be auto-closed.
            </p>
            {triage.needs.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {triage.needs.map((need) => (
                  <li key={need} className="rounded-full bg-canvas px-2.5 py-0.5 text-xs text-mute">
                    {need.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ) : (
          <article className="rounded-2xl bg-white px-5 py-4 shadow-card">
            <p className="text-xs text-mute">{triage.severity === "safe" ? "Assessment" : "Status"}</p>
            <h2 className="mt-1 text-sm font-semibold">
              {triage.severity === "safe"
                ? "No dispatch. Household is accounted for."
                : "Still unaccounted. Not a completed assessment."}
            </h2>
            <p className="mt-2 text-xs text-mute">
              {reached
                ? "Reached a person. Fields below are scored against the transcript."
                : "Voicemail and no-answer stay in the unreached count."}
            </p>
          </article>
        )}
      </section>

      <CallReelPlayer
        compact
        household={household?.displayName ?? attempt.rosterEntryId}
        disposition={attempt.disposition ?? "pending"}
        transcript_turns={turns}
        linked={linked.map((field) => ({
          field: field.field,
          value: field.value,
          supported: field.supported,
          score: field.score,
          turnText: field.turn?.text ?? null,
          turnOffset: field.turn?.offset_seconds ?? null,
        }))}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {linked.map((field) => (
          <article key={field.field} className="rounded-2xl bg-white px-4 py-3.5 shadow-card">
            <p className="text-xs text-mute">{fieldLabel(field.field)}</p>
            <p
              className={`mt-1 text-base font-semibold ${
                field.supported ? "text-ink" : "text-critical line-through"
              }`}
            >
              {prettyValue(field.value)}
            </p>
            {field.supported && field.turn ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-mute">“{field.turn.text}”</p>
            ) : (
              <p className="mt-1.5 text-xs text-critical">Not on the transcript — send to dispatch</p>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-2xl bg-white px-5 py-4 shadow-card">
        <h2 className="text-sm font-semibold">Transcript</h2>
        <ol className="mt-3 space-y-2">
          {turns.map((turn, index) => (
            <li
              key={`${turn.offset_seconds}-${index}`}
              className={`max-w-[72%] rounded-xl px-3 py-2 ${
                turn.speaker === "user" ? "ml-auto bg-canvas" : "bg-[#f7f7f7]"
              }`}
            >
              <p className="text-[11px] text-mute">
                {turn.speaker === "user" ? "Household" : "Assistant"} · {formatClock(turn.offset_seconds)}
              </p>
              <p className="mt-0.5 text-sm leading-5">{turn.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </ConsoleShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-mute">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}

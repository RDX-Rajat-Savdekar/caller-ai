import Link from "next/link";
import { notFound } from "next/navigation";
import { isReached, linkEvidence, type Disposition } from "@caller-ai/core";
import { ConsoleShell } from "@/components/console-shell";
import { SEED_EVENT_ID, getAttempt, getEvent, getRosterEntry } from "@/lib/queries";
import { parseJson } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  safety_status: "Safety",
  evacuation: "Evacuation",
  has_power: "Power",
  has_water: "Water",
  medication: "Medication",
  household: "Household",
  needs_human: "Needs human",
};

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attempt = await getAttempt(id);
  if (!attempt) notFound();
  const household = await getRosterEntry(attempt.rosterEntryId);
  const event = await getEvent(SEED_EVENT_ID);
  const result = parseJson<Record<string, unknown>>(attempt.resultJson, {});
  const turns = parseJson<Array<{ speaker: string; text: string }>>(attempt.transcriptJson, []);
  const linked = linkEvidence({ structuredResult: result, turns });
  const reached = attempt.disposition ? isReached(attempt.disposition as Disposition) : false;

  return (
    <ConsoleShell eventId={event?.id} eventName={event?.name} active="call">
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <Link href={`/events/${event?.id}`} className="text-sm text-mute hover:text-ink">
          Coverage
        </Link>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {household?.displayName ?? attempt.rosterEntryId}
            </h1>
            <p className="mt-1 text-sm text-mute">{household?.phoneMasked}</p>
          </div>
          <p className={`text-sm font-medium ${reached ? "text-safe" : "text-unaccounted"}`}>
            {attempt.disposition ?? "pending"}
          </p>
        </div>
        <p className="mt-4 text-xs text-mute">{attempt.idempotencyKey}</p>
      </div>

      <section className="grid gap-5 md:grid-cols-2">
        {linked.map((field) => (
          <article key={field.field} className="rounded-2xl bg-white p-6 shadow-card">
            <p className="text-sm text-mute">{FIELD_LABELS[field.field] ?? field.field}</p>
            <p
              className={`mt-2 text-xl font-semibold ${
                field.supported ? "text-ink" : "text-critical line-through"
              }`}
            >
              {String(field.value)}
            </p>
            <p className="mt-2 text-xs text-mute">
              {field.supported ? "On the transcript" : "Not on the transcript — send to dispatch"}
            </p>
          </article>
        ))}
      </section>
    </ConsoleShell>
  );
}

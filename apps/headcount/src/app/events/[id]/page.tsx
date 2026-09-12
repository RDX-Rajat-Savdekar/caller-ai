import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsoleShell } from "@/components/console-shell";
import { CoverageReelPlayer } from "@/components/reel-player";
import { coverageForEvent, getEvent, triageForEvent } from "@/lib/queries";

const COLUMNS = [
  { key: "critical", label: "Critical", count: "text-critical" },
  { key: "follow_up", label: "Follow-up", count: "text-follow" },
  { key: "safe", label: "Safe", count: "text-safe" },
  { key: "unaccounted", label: "Unaccounted", count: "text-unaccounted" },
] as const;

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const coverage = await coverageForEvent(id);
  const cards = await triageForEvent(id);
  const max = Math.max(coverage.dialed, 1);
  const unaccounted = cards.filter((card) => card.severity === "unaccounted");

  return (
    <ConsoleShell eventId={event.id} eventName={event.name} active="coverage">
      <section className="grid gap-5 md:grid-cols-3">
        <Metric label="Dialed" value={coverage.dialed} />
        <Metric label="Reached" value={coverage.reached} tone="text-safe" />
        <Metric label="Unreached" value={coverage.unreached} tone="text-unaccounted" hint="Voicemail sits here" />
      </section>

      <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-card">
        <div className="flex h-2 overflow-hidden rounded-full bg-canvas">
          <div className="bg-safe" style={{ width: `${(coverage.reached / max) * 100}%` }} />
          <div className="bg-unaccounted" style={{ width: `${(coverage.unreached / max) * 100}%` }} />
        </div>
      </div>

      <CoverageReelPlayer
        dialed={coverage.dialed}
        reached={coverage.reached}
        unaccounted={coverage.unreached}
        names={unaccounted.map((card) => card.household?.displayName ?? card.rosterEntryId)}
      />

      <section className="grid gap-5 md:grid-cols-4">
        {COLUMNS.map((column) => {
          const items = cards.filter((card) => card.severity === column.key);
          const important = column.key === "unaccounted";
          return (
            <div
              key={column.key}
              className={`rounded-2xl bg-white p-5 shadow-card ${important ? "ring-1 ring-unaccounted/30" : ""}`}
            >
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-base font-medium">{column.label}</h2>
                <span className={`tabular text-2xl font-semibold ${column.count}`}>{items.length}</span>
              </div>
              <ul className="space-y-2">
                {items.map((card) => (
                  <li key={card.id}>
                    <Link
                      href={`/calls/${card.attemptId}`}
                      className="block rounded-xl bg-canvas px-3.5 py-3 hover:bg-line"
                    >
                      <p className="text-sm font-medium">
                        {card.household?.displayName ?? card.rosterEntryId}
                      </p>
                      <p className="mt-0.5 text-xs text-mute">{card.household?.phoneMasked}</p>
                      {card.needs.length > 0 ? (
                        <p className="mt-1 text-xs text-mute">{card.needs.map((need) => need.replaceAll("_", " ")).join(", ")}</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </ConsoleShell>
  );
}

function Metric({
  label,
  value,
  tone = "text-ink",
  hint,
}: {
  label: string;
  value: number;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <p className="text-sm text-mute">{label}</p>
      <p className={`mt-3 tabular text-5xl font-semibold leading-none ${tone}`}>{value}</p>
      {hint ? <p className="mt-3 text-xs text-mute">{hint}</p> : null}
    </div>
  );
}

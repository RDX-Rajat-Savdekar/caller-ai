import { notFound } from "next/navigation";
import { accountWave } from "@caller-ai/core";
import { ConsoleShell } from "@/components/console-shell";
import { getEvent, listInstruments, listRoster } from "@/lib/queries";

export default async function NewWavePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const [instrument] = await listInstruments(id);
  const roster = await listRoster(id);
  const budget = accountWave({ projectCap: 20, used: 0, killed: false, blocklist: [] }, roster.length);

  return (
    <ConsoleShell eventId={event.id} eventName={event.name} active="wave">
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <h1 className="text-2xl font-semibold">{instrument?.title ?? "Household needs check"}</h1>
        <p className="mt-2 text-sm text-mute">
          {roster.length} planned, {budget.wouldDial} will dial, {budget.wouldRemain} remain
        </p>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <p className="mb-3 text-sm text-mute">Task</p>
        <pre className="whitespace-pre-wrap text-[13px] leading-6 text-ink">{instrument?.taskText}</pre>
      </div>
      <div className="flex justify-end">
        <button type="button" className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">
          Confirm wave
        </button>
      </div>
    </ConsoleShell>
  );
}

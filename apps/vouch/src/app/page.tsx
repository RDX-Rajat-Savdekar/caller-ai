import { ConsoleShell } from "@/components/console-shell";
import { sqlite } from "@/db";
import { compileVouchTask, permittedFields } from "@/lib/scope";

type ConsentRow = {
  id: string;
  candidate_name: string;
  employer: string;
  jurisdiction: string;
  requested_json: string;
  consent_fields_json: string;
  signed_at: string;
  expires_at: string;
  revoked_at: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  employment_confirmed: "Employment",
  title_stated: "Title",
  start_date_stated: "Start date",
  end_date_stated: "End date",
  eligible_for_rehire: "Eligible for rehire",
  salary_history: "Salary history",
};

export default function VouchHomePage() {
  const consent = sqlite.prepare("SELECT * FROM consents WHERE id = ?").get("cns_demo") as
    | ConsentRow
    | undefined;

  if (!consent) {
    return (
      <ConsoleShell>
        <div className="rounded-2xl bg-white p-8 shadow-card">
          <p className="text-sm">No consent on file. Run pnpm db:seed.</p>
        </div>
      </ConsoleShell>
    );
  }

  const requested = JSON.parse(consent.requested_json) as string[];
  const consentFields = JSON.parse(consent.consent_fields_json) as string[];
  const scope = permittedFields({
    requested,
    jurisdiction: consent.jurisdiction,
    consentFields,
  });
  const blockedByField = new Map(scope.blocked.map((item) => [item.field, item.reason]));
  const task = compileVouchTask({
    employer: consent.employer,
    candidate: consent.candidate_name,
    consentDate: consent.signed_at,
    requestingOrg: "Harbor Lane Staffing",
    employerCode: "NB-4491",
    permitted: scope.permitted,
  });

  return (
    <ConsoleShell title={`${consent.candidate_name}, ${consent.employer}`}>
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <p className="text-sm text-mute">
          {consent.jurisdiction}
          <span className="mx-2">·</span>
          signed {consent.signed_at}
          {consent.revoked_at ? <span className="text-critical"> · revoked {consent.revoked_at}</span> : null}
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold">Requested</h2>
          <ul className="mt-4 space-y-2">
            {requested.map((field) => {
              const reason = blockedByField.get(field);
              return (
                <li
                  key={field}
                  className={`rounded-xl px-4 py-3 text-sm ${
                    reason ? "bg-critical/10 text-critical line-through" : "bg-canvas"
                  }`}
                >
                  {FIELD_LABELS[field] ?? field}
                  {reason ? <span className="ml-2 text-xs no-underline">{reason}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold">Permitted</h2>
          <ul className="mt-4 space-y-2">
            {scope.permitted.map((field) => (
              <li key={field} className="rounded-xl bg-canvas px-4 py-3 text-sm">
                {FIELD_LABELS[field] ?? field}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="rounded-2xl bg-white p-6 shadow-card">
        <p className="mb-3 text-sm text-mute">Task</p>
        <pre className="whitespace-pre-wrap text-[13px] leading-6">{task}</pre>
      </div>

      <div className="flex justify-end">
        <button type="button" className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">
          Confirm dial
        </button>
      </div>
    </ConsoleShell>
  );
}

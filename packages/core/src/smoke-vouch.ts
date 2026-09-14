/**
 * Live Vouch smoke: Alex Rivera / Northbay Civic Works.
 * Task text matches compileVouchTask() for the seeded CA consent.
 *
 *   CALLE_LIVE=1 CALLE_API_KEY=... CALLE_SMOKE_PHONE=+1... pnpm smoke:vouch
 */

import { createCalleClient, resolveCalleBaseUrl, resolveCalleMode } from "./client";

const task = `You are calling Northbay Civic Works to verify employment for Alex Rivera, who gave written
authorization dated 2026-08-12. Identify yourself as an automated verification assistant
acting for Harbor Lane Staffing.

If you reach a phone menu, navigate to Human Resources or employment verification.
If asked for an employer code, use NB-4491.

Confirm ONLY the following:
- employment confirmed
- title stated
- start date stated
- end date stated
- eligible for rehire

You are NOT authorized to ask about compensation or salary history, reason for separation,
medical or disability information, or job performance.

Before recording any answer, ask for the person's name and role, and whether they are
authorized to confirm employment for the company.

If they say verification is handled only through a third-party service, record that and end
the call. Do not attempt to persuade.`;

async function main() {
  const mode = resolveCalleMode();
  const baseUrl = resolveCalleBaseUrl();
  const phone = process.env.CALLE_SMOKE_PHONE ?? "+15555550100";

  console.log(`[smoke-vouch] mode=${mode} baseUrl=${baseUrl} phone=${phone}`);

  if (mode === "live") {
    if (!process.env.CALLE_API_KEY || process.env.CALLE_API_KEY === "sim-local") {
      throw new Error("CALLE_LIVE=1 requires a real CALLE_API_KEY from dashboard.heycall-e.com/account/api-keys");
    }
    if (phone.startsWith("+1555")) {
      throw new Error("CALLE_LIVE=1 requires CALLE_SMOKE_PHONE set to your own E.164 number");
    }
  }

  const client = createCalleClient();
  const call = await client.calls.create({
    task,
    recipients: [{ phones: [phone], region: "US", locale: "en-US" }],
    recipientResultSchema: {
      type: "object",
      required: [
        "employment_confirmed",
        "title_stated",
        "start_date_stated",
        "end_date_stated",
        "eligible_for_rehire",
        "verifier_name",
        "verifier_role",
        "verifier_authority",
        "refusal_reason",
      ],
      properties: {
        employment_confirmed: { type: "string", enum: ["yes", "no", "unknown"] },
        title_stated: { type: "string" },
        start_date_stated: { type: "string" },
        end_date_stated: { type: "string" },
        eligible_for_rehire: { type: "string", enum: ["yes", "no", "policy_no_comment", "unknown"] },
        verifier_name: { type: "string" },
        verifier_role: { type: "string" },
        verifier_authority: { type: "string", enum: ["yes", "no", "unknown"] },
        refusal_reason: { type: "string", enum: ["none", "third_party_only", "policy", "wrong_department", "unknown"] },
      },
    },
  });

  console.log(`[smoke-vouch] created id=${(call as { id?: string }).id ?? "(see payload)"}`);
  console.log(JSON.stringify(call, null, 2));
}

main().catch((error) => {
  console.error("[smoke-vouch] failed");
  console.error(error);
  process.exitCode = 1;
});

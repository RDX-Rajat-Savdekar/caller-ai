/**
 * Auth / wiring smoke test. Defaults to the local simulator.
 * A live dial requires CALLE_LIVE=1, a real API key, and an explicit phone.
 *
 * Usage:
 *   pnpm smoke
 *   CALLE_LIVE=1 CALLE_API_KEY=... CALLE_SMOKE_PHONE=+1... pnpm smoke
 */

import { createCalleClient, resolveCalleBaseUrl, resolveCalleMode } from "./client";

const task = `You are an automated assistance line calling on behalf of Sonoma County Emergency Management after the Bennett Valley fire (CASPER drill).
Identify yourself immediately as an automated AI assistant from Sonoma County Emergency Management, and say this is a safety and needs check, not an emergency service.

Ask, in order, stopping early if the person reports an emergency:
1. Is everyone in the household safe and accounted for?
2. Are you sheltering in place, or have you evacuated?
3. Do you have electricity right now? Running water?
4. Does anyone need prescription medication you cannot get?
5. Is there anything urgent you need help with right now?

If the person reports a medical emergency, someone trapped, or anyone unaccounted for:
say "I am flagging this for a human responder right now", and end the call politely.

Never give medical, evacuation, or safety advice. Never promise a response time.
Do not ask for names, addresses, dates of birth, or any identifier beyond these five questions.
If you reach voicemail, leave a short message that this was a drill safety check and end.`;

async function main() {
  const mode = resolveCalleMode();
  const baseUrl = resolveCalleBaseUrl();
  const phone = process.env.CALLE_SMOKE_PHONE ?? "+15555550100";

  console.log(`[smoke] mode=${mode} baseUrl=${baseUrl} phone=${phone}`);

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
      required: ["safety_status", "evacuation", "has_power", "has_water", "medication", "needs_human"],
      properties: {
        safety_status: { type: "string", enum: ["safe", "needs_assistance", "medical_emergency", "unknown"] },
        evacuation: { type: "string", enum: ["sheltering_in_place", "evacuated", "trapped", "unknown"] },
        has_power: { type: "string", enum: ["yes", "no", "unknown"] },
        has_water: { type: "string", enum: ["yes", "no", "unknown"] },
        medication: { type: "string", enum: ["none_needed", "cannot_get", "unknown"] },
        needs_human: { type: "string", enum: ["yes", "no"] },
      },
    },
  });

  console.log(`[smoke] created id=${(call as { id?: string }).id ?? "(see payload)"}`);
  console.log(JSON.stringify(call, null, 2));
}

main().catch((error) => {
  console.error("[smoke] failed");
  console.error(error);
  process.exitCode = 1;
});

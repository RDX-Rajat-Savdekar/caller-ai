# CALL-E — platform notes and hackathon strategy

For **CALL-E: Your Code Is Calling** (Devpost). Deadline **Sep 14, 2026 @ 8:45am PDT**.
$10,000 across 4 main prizes + 5 feedback prizes. 2,962 registered participants.

Compiled Sep 10, 2026 from `CALLE-AI/call-e-integrations`, `CALLE-AI/awesome-phone-call-agents`,
`docs.heycall-e.com`, and the published SDKs. Versions move fast — the Python SDK went 0.1 → 0.7
in ten weeks and 0.7 added a feature the main README doesn't document yet.

---

## 1. What CALL-E actually is

The single most important thing to understand, because it determines what's worth building:

> **CALL-E is not a voice-agent toolkit. It's a task-completion API that happens to use the phone.**

Platforms like ElevenLabs, Vapi, or Retell hand you a voice *runtime* — you supply a system prompt,
pick a voice, wire up tools, manage turn-taking config, and own the conversation. CALL-E sits a full
layer above that. You hand it a **goal in plain English**, a **phone number**, and a **JSON schema
for the answer you want**. It plans the call, asks you for missing details, dials, holds a natural
conversation, adapts when the human says something unexpected, navigates IVR menus, handles
voicemail, and hands back **schema-validated JSON plus a transcript plus an evidence trail**.

```
Goal + phone number → Plan → (Clarify if details missing) → Dial
                                                             → Live conversation
                                                             → Structured result + transcript + summary
```

Their own framing: traditional platforms use prebuilt bots optimized for high-volume repetitive
scripts; CALL-E is for tasks where a rigid script would fail.

### What this means for us

The conversation is a **black box**. You cannot inject a tool call mid-call, swap the voice, or
stream audio. You get one shot to specify intent, and then a result.

That sounds limiting, and it is — but it's also the whole point. It collapses "build a voice agent"
into roughly five lines of code:

```ts
import { CalleClient } from "@call-e/calle";

const client = new CalleClient({ apiKey: "your_api_key" });
const call = await client.calls.createAndWait({
  task: "Call +15550123456 and confirm tomorrow's 9am appointment.",
});
console.log(call.status, call.taskCompleted);
```

**So the call is not the project. The call is one function invocation.** Everything that makes a
submission good lives in the ~95% of code around it: deciding whether to call at all, getting
authorization, composing the task text, validating that the returned result is actually supported by
the transcript, and routing the outcome. Every strong project in their showcase repo is shaped
exactly this way. Budget your four days accordingly — do not spend them trying to make the call
itself better, because you can't.

---

## 2. The four integration surfaces

| Surface | Install | Use when |
| --- | --- | --- |
| **Agent install (skill)** | Paste one prompt into Cursor/Claude Code/Codex | Driving CALL-E interactively while developing |
| **MCP** | Streamable HTTP endpoint + OAuth | Any MCP client; agent-to-agent workflows |
| **SDK** | `pnpm add @call-e/calle` / `pip install calle-ai` | Backend services, workers — **the main path for an app** |
| **REST API** | `Bearer` token against `api.heycall-e.com` | Any other backend, or plugins on no-code platforms |
| **CLI** | `npm i -g @call-e/cli` | Terminal agents, auth bootstrapping, scripting |

### Agent install (do this first)

```text
Install CALL-E for me: https://open.heycall-e.com/document/mcp-archive/CALL-E-installation-guide.md
```

Paste that into Cursor and it handles the rest. The linked guide is kept current, so the prompt
never changes.

### MCP

Endpoint: `https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth` (Streamable HTTP, OAuth).

Exactly three tools, and the order is enforced for safety:

| Tool | Behavior |
| --- | --- |
| `plan_call` | Creates/refines a plan. **Does not dial.** Returns `plan_id`, `confirm_token`, `ready_to_run` |
| `run_call` | Starts the call. Requires the exact `plan_id` + `confirm_token` from the preceding plan. **Places a real call** |
| `get_call_run` | Read-only. Status, activity, summary, transcript |

Polling discipline: after `run_call`, **wait ~60 seconds before the first `get_call_run`**, then
every 5–10 seconds until terminal. That 60s is a polling recommendation, not a deadline. Persist
`run_id` — on a local timeout or restart, resume polling; **never re-issue `run_call`**, or you
place a second real call. MCP `run_call` does not accept `webhook_url`, so MCP clients must poll.

Cursor MCP config, if you want it without the full plugin:

```json
{
  "mcpServers": {
    "calle": { "url": "https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth" }
  }
}
```

### REST API

```bash
export CALLE_API_KEY="iams_live_example"     # dashboard.heycall-e.com/account/api-keys
export CALLE_BASE_URL="https://api.heycall-e.com"
# test env: https://test-api.heycall-e.com
```

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/v1/calls` | Create a one-recipient or batch call task |
| `GET` | `/v1/calls/{call_id}` | Status, summaries, structured results, transcripts |
| `GET` | `/v1/calls/{call_id}/events` | Developer-facing call events |
| `POST` | `/calle/webhook` | *(your endpoint)* receives terminal results |

---

## 3. The data model — where the real design work happens

This is the part to actually internalise. Getting the schemas right *is* the engineering.

**Request:**

| Field | Purpose |
| --- | --- |
| `task` | Plain-English goal. This is your "prompt" and it's the whole conversational spec |
| `recipients[]` | `{ phones: [...], region: "US", locale: "en-US" }` — batch is native |
| `result_schema` | JSON Schema for the **task-level** result (e.g. `completed_count`) |
| `recipient_result_schema` | JSON Schema for the **per-recipient** result (e.g. `can_attend`) |
| `metadata` | Your own IDs — e.g. `{ workflow_run_id: "wf_123" }` |
| `idempotency_key` | Also an `Idempotency-Key` header. **Load-bearing; see below** |
| `webhook_url` | Terminal-result callback (REST/SDK only, not MCP) |

**Response:**

| Field | Meaning |
| --- | --- |
| `status` | `completed`, etc. |
| `task_completed` | Boolean — did the goal get achieved |
| `completion_confidence` | `{ score: 0.92, label: "high" }` |
| `evidence[]` | Natural-language justifications: `"The recipient said they can attend."` |
| `structured_result` | Your `result_schema`, filled |
| `recipients[].structured_result` | Per-recipient schema, filled |
| `recipients[].attempts[].transcript_turns[]` | `{ offset_seconds, speaker: "bot"\|"user", text }` |

Three non-obvious design consequences:

1. **`completion_confidence` and `evidence` exist because the model can be wrong.** The single most
   common pattern across their showcase repo is *not trusting `task_completed`* — re-reading the
   transcript to verify the claimed value actually appears in words the human spoke. There's an
   entire skill (`verity-verification-core`) that does only this. Treat `task_completed: true` as a
   claim to audit, not a fact.
2. **Always model `unknown` explicitly.** Use `enum: ["yes", "no", "unknown"]`, never a bare boolean.
   Voicemail, refusal, hangup, and "I'm not sure" are all real outcomes, and collapsing them into
   `false` is the bug that makes these systems dangerous. Keep "didn't answer" separate from
   "answered no."
3. **Derive the idempotency key from the authorization, not the attempt.** A client timeout that
   causes a retry with a fresh key means you dial a real human twice. Persist the key *before* the
   first request.

### Goals (SDK 0.7.0, newer than the README)

The SDK now supports reusable **published Goals** that own their own input and result schemas; each
run supplies only a phone, per-run variables, and an idempotency key:

```python
goal = client.goals.get("goal_delivery_confirmation")
run = client.goals.run_and_wait(
    goal_id=goal["id"],
    phone="+14155550100",
    variables={"customer_name": "Taylor", "order_reference": "ORD-8472"},
    idempotency_key="delivery:ORD-8472:confirm-window:v1",
)
```

`wait_for_result` returns when `result` or `error` is non-null. Note the subtlety: an execution
`status` of `completed` **can still be waiting on result materialization**.

This is barely documented and nothing in the showcase repo uses it. Building on Goals is a cheap way
to score on "thoroughly and skillfully uses CALL-E."

---

## 4. Capabilities and bounds

### What it does that's genuinely distinctive

| Capability | Why it matters |
| --- | --- |
| **IVR navigation with DTMF** | Detects phone trees and presses keys to reach the right department. Very few competitors do this, and it unlocks the worst real-world phone tasks |
| **Real-world call handling** | Live pickup, voicemail, call screening, hold, transfers, silence, interruptions |
| **Smart goal clarification** | Asks *you* for missing details before dialing rather than improvising |
| **In-task optimization** | Adapts strategy based on earlier attempts within the same task |
| **Native batch + scheduling** | Multi-recipient in one task |
| **Structured results** | Schema-validated JSON, not transcript scraping |

**In development, not available:** "Goal-Driven Long Tasks" — multi-step campaigns that learn across
attempts. Don't build a submission that depends on it.

### The bounds

**Hard limits:**

- **20 free calls per new account.** This is *the* constraint on the entire hackathon. Not 20
  minutes — twenty calls. Request more through the form linked on the Devpost page, and do it
  **today**, because approval isn't instant.
- **Outbound only.** There is no inbound story. Anything shaped like "a receptionist," "answer my
  phone," or "screen my calls" is out of scope. This kills a lot of obvious ideas.
- **No mid-call control.** No tool injection, no live audio stream, no voice selection, no
  interrupting your own agent. Plan, run, read result.
- **No webhook signatures.** Delivery is unsigned — no secret, no `CALL-E-Timestamp`, no
  `CALL-E-Signature`. Dedupe on the required `CALL-E-Event-Id` header before performing side
  effects. `client.webhooks.verify` / `.unwrap` are deprecated 0.2-era leftovers and are
  incompatible with current deliveries.
- **MCP can't use webhooks** — poll `get_call_run`.
- Concurrency and rate limits exist under "number governance, rate limits, concurrency controls,
  blocklists, kill switches" but aren't published. Assume modest.

**Coverage:** ~40 countries. US, SG, MY, AE, MX, BR have *local* lines; India, Canada, UK, Germany,
Japan, France and most others route as *international*. Multilingual where listed — Hindi/Tamil (IN),
Arabic (AE/SA/EG/OM), Spanish (MX/ES), Portuguese (BR/MZ), Japanese, French, Vietnamese, Thai,
Bengali, Urdu, Polish, Ukrainian, Turkish, Finnish, Sinhala, Malay, Chinese.

**The bound that should shape your architecture:** because the call is a black box and calls are
scarce, *the interesting engineering has to happen before and after the call.* Pre-call: is a call
even warranted, do we have authorization, what exactly should be asked. Post-call: is the result
actually supported by the transcript, what happens now. Their whole showcase repo has independently
converged on this shape.

---

## 5. Competitive landscape — read this before picking an idea

I went through every entry currently in `awesome-phone-call-agents`. There are already **~33 skills,
~60 apps, and 5 plugins** merged. With 2,962 participants and four main prizes, idea selection
matters more than execution quality.

### Already taken (pick these only with a sharp, defensible twist)

| Pattern | Existing entries |
| --- | --- |
| Appointment confirmation | `appointment-confirm` (skill + app), `multi-party-scheduler` |
| Elder / wellbeing check-in | `metapelet-elder-checkin`, `connected`, `kincall` |
| Parallel quote / sourcing / haggling | `callsweep`, `supplyline`, `partline`, `sparescout`, `blood-bank-dispatch` |
| Approval gate before irreversible action | `phone-approval-gate`, `deployment-approval-call`, `leash`, `dollar-consent-first-callback` |
| Recruiting coordination | `hirecall`, `candidate-availability-call`, `audition-agent` |
| Result / claim verification | `verity-verification-core`, `verify-by-phone`, `verify-contact-claim`, `reality-resolver` |
| Consumer chores (bills, refunds, cancellations) | `ringer`, `casechaser` |
| Shift filling / mobilization | `standby`, `mobilize` |
| Incident escalation | `incident-escalation-call`, `incidentbridge`, `gridguard` |
| Line monitoring / QA | `linecanary`, `voice-preflight` |
| Campaign runners, callback triage, webhook receivers | `callflow-campaign-runner`, `callback-coordinator`, `batch-runner`, `webhook-result-receiver` |
| Accessibility audits | `accessline`, `accesscall` |
| Healthcare intake | `rdn-intake-referral`, `labline-critical-result`, `openings`, `shohojsheba` |

That covers most of the obvious ideas — including three I would have suggested on day one.

### Wide open

**Plugins are dramatically underserved.** Only five exist: n8n (×2), Dify, HubSpot, Zapier. The
roadmap explicitly names these as open and wanted, and says *"Concrete platform plugin examples are
still open for community exploration"*:

> Salesforce · Zendesk · Slack Workflow Builder · Notion · Airtable · Shopify Flow ·
> GitHub Actions · Make · Activepieces · ServiceNow · Feishu/Lark · Jira Automation/Forge ·
> Twilio Flex · Google Apps Script · Power Automate · Intercom · Freshdesk · Pipedrive ·
> monday.com · Workato · AWS EventBridge · Odoo · Greenhouse

**Three roadmap-named apps that nobody has built:** `calle-call-chat`, `call-review-console`,
`call-scheduler-ui`. The roadmap's Open Questions section literally asks *"What should the first
`calle-call-chat` experience include?"* — an open question from the people judging the contest.

**IVR-heavy tasks are under-exploited.** IVR navigation with DTMF is CALL-E's most distinctive
capability and almost nothing in the repo leans on it hard.

### The house style (this is basically a rubric)

Read fifteen entries and the same vocabulary appears in nearly every one. This is what maintainers
merge:

- **No-call / dry-run / fixture mode is the default.** Live calling is opt-in. Non-negotiable —
  it's Design Principle 7, and it also means judges can run your project without spending calls.
- **Consent-first and disclosed.** The agent identifies itself as AI.
- **Fail-closed.** Ambiguity, low confidence, and unrecognized statuses route to a human, never to
  the success branch.
- **Evidence-backed.** Every claim traceable to a transcript span.
- **Human owns the commitment.** Gather answers automatically; let a person accept them.
- **Denominator-honest.** Don't report 3/3 when you only reached 3 of 10 people.
- **Idempotent** with masked phone numbers in all samples.
- **Tests run without live credentials.**

Design principles worth reading in full: separate scheduling from calling (the host scheduler owns
recurrence, CALL-E places one call per trigger); require explicit intent; never guess phone numbers,
regions, timezones, or tokens; use IANA timezone names; cancellation is first-class.

---

## 6. Judging criteria, decoded

| Criterion | What it actually rewards |
| --- | --- |
| **Real World Impact** | A *specific* phone-work problem with named users. Explicitly not "generic AI that makes phone calls." Must be worth continuing after the hackathon |
| **Quality of the Idea** | Creative, **non-obvious** use of CALL-E. Well-scoped and **reusable by the community** — favors skills/plugins over one-off apps |
| **Technical Implementation** | "CALL-E imported and **actually called at runtime**, not just referenced." A mock-only submission scores zero here — you need at least one real call on video |
| **Product Experience & Demo** | Coherent end-to-end experience; the 3-minute video must land |

Note the tension: dry-run-by-default is house style, but "actually called at runtime" is a judging
criterion. **Resolve it by shipping dry-run as the default and showing one real call in the video.**

**Don't skip the feedback survey.** Five prizes at $200 + 10,000 credits each, judged on usefulness
of feedback. You will hit real bugs on a platform this young — the unsigned webhooks, the deprecated
verify methods, the Cursor sandbox failure, the undocumented Goals API. Writing those up carefully is
maybe an hour of work against much better odds than the four main prizes.

---

## 7. Ideas

Filtered against everything already merged. Ranked by expected value, not just coolness.

### Tier 1

**1. Prior-authorization / insurance claim chaser.** The most miserable phone task in American
life: 40 minutes of IVR trees and hold music to find out whether a procedure is approved. CALL-E's
IVR + DTMF + hold handling is *purpose-built* for it, and nothing in the repo targets it.
Structured result: approval status, reference number, next action, callback date, who you spoke to.
Fail-closed on anything ambiguous; a human confirms before any patient is told anything.
*Why it wins:* strongest possible "Real World Impact" story, and it uses the one capability
competitors don't have. `casechaser` is adjacent but generic — going deep on one regulated,
IVR-hostile domain is the differentiator. Watch the safety framing: never state clinical
conclusions, and mark every value as pending human verification.

**2. IVR cartographer — a public map of phone trees.** Have CALL-E navigate the customer-service
lines of common institutions and publish the **shortest keypress path to a human**, plus hold times
by time of day, as an open dataset that other agents (and people) can query. Refresh on a decaying
cadence; hang up at the human queue boundary.
*Why it wins:* genuinely non-obvious, it's *infrastructure* rather than another workflow wrapper,
and it produces a reusable community artifact — which is explicitly what "Quality of the Idea"
asks for. `linecanary` monitors lines you own; this maps lines you don't.
*Handle the ethics explicitly or it fails review:* published customer-service numbers only,
immediate disclosure if a human picks up, hard opt-out list, strict rate limiting per line, and
never occupy an agent's time. Put that reasoning in a `docs/` safety note — the repo rewards it.

**3. A workflow plugin for a platform nobody has covered.** Pick from the roadmap's own open list.
Best candidates: **Slack Workflow Builder** (enormous install base, approval and escalation calls
fit naturally), **GitHub Actions** (developer audience, release approval and incident escalation —
and `linecanary` proves Actions integration is welcome), or **Airtable/Notion** (row-triggered
calls with writeback).
*Why it wins:* five plugins versus sixty apps, and it directly fills a gap the judges wrote down.
Highest score-per-hour on this list. Weakest on demo drama, so invest in the video.
Document triggers, inputs, side effects, credential handling, dry-run behavior, and rollback.

### Tier 2

**4. `calle-call-chat` — the reference chat experience.** The roadmap asks for it by name and asks
an open question about what it should contain. A clean chat UI that composes a task, surfaces
CALL-E's clarifying questions, previews the exact script and masked number, requires confirmation,
streams live status, and renders the result against its schema with transcript evidence inline.
*Why it wins:* "Most Practical Use Case" is a real category, and this becomes the front door
everyone else's demos reuse. Risk: it's a UI project, so it lives or dies on polish, and it's
plausible another team has the same idea.

**5. Schema-quality linter as a service.** `calle-script-advisor` drafts task text; nobody has built
the *evaluation* side — a harness that runs a proposed task + schema against synthetic recipient
personas (stubborn, confused, voicemail, wrong person, hostile, hard of hearing) and reports where
extraction breaks, **before you spend real calls**. Given 20 free calls, a tool that de-risks each
one is directly, obviously valuable to every other participant.
*Why it wins:* meta but genuinely useful, and it can run almost entirely without live calls, which
makes it cheap to build and easy for judges to try.

**6. Cross-border remittance / document-requirement resolver.** Call consulates, banks, and
government offices to determine what documents a specific process actually requires today — because
the website is always wrong or out of date. Heavy IVR, high multilingual value, real immigrant-user
impact. Related to `afterword` (death notification) in structure but a different, larger domain.

### Tier 3 — only with a strong twist

Anything from the "already taken" table. If you have real domain expertise in one of them, a
narrow vertical version can still win — but you're now competing against a merged implementation
rather than an empty slot.

### My recommendation

**Idea 1 or 2 as the main submission, plus a small plugin (idea 3) as a second PR.** Nothing stops
you contributing twice, the plugin is a few hours with an entirely different competitive field, and
the prize pool has four independent main slots.

---

## 8. Submission mechanics

1. **PR to `github.com/CALLE-AI/awesome-phone-call-agents`**, in the right contribution area:
   `skills/<name>/`, `apps/<language>/<name>/`, or `plugins/<name>/`.
2. **Run validation before opening the PR:** `python3 scripts/validate_repository.py`
3. Follow `docs/git-naming-conventions.md` for branch, commit, and PR title.
4. **~3-minute demo video**, YouTube or Vimeo, public.
5. **Devpost form:** PR URL + video URL + the email on your CALL-E account.
6. Optional but do it: live demo URL, and the **feedback survey**.

Skill folder layout:

```text
skill-name/
├── SKILL.md          # keep focused
├── references/       # provider/host detail lives here (progressive disclosure)
├── scripts/
└── assets/
```

Checklist from `CONTRIBUTING.md`: English only; no secrets, tokens, or real personal phone numbers;
state the host/provider; describe side effects; install and usage instructions; masked or fictional
numbers; cancellation/rollback for anything recurring; a dry-run or fake-server path; passes
validation.

Explicitly out of scope: telephony vendor directories, marketing pages, projects without setup
instructions, unsafe credential handling, and anything that hides calls or side effects from the
user.

### Four-day plan

| Day | Work |
| --- | --- |
| **Today (Sep 10)** | Install + auth + **one real test call to your own phone**. Request extra calls via the form — do this first, approval takes time. Lock the idea. |
| **Sep 11** | Core loop end to end in fixture mode. Nail `result_schema` and `recipient_result_schema`. Zero real calls. |
| **Sep 12** | Verification layer, fail-closed dispositions, README, safety doc, tests. Spend ~3 real calls on validation. |
| **Sep 13** | Record the video (budget ~5 real calls for takes). Open the PR early — leave room for review comments. Submit the feedback survey. |
| **Sep 14, pre-8:45am PDT** | Buffer only. Do not plan to build on the deadline day. |

Call budget across all of that: roughly 10 of your 20, leaving headroom for things going wrong.

---

## 9. Gotchas

1. **Cursor's sandbox blocks CALL-E.** `curl: (56) CONNECT tunnel failed, response 403`, or
   `calle auth login` failing with a generic `fetch failed`, means Cursor's network gate is
   blocking `seleven-mcp-sg.airudder.com`. Fix: Cursor Settings → Agents → Auto-Run Mode →
   **Run Everything (Unsandboxed)**. This is documented in their troubleshooting guide, which tells
   you how often it bites.
2. **20 calls.** Request more immediately.
3. **Never re-issue `run_call` after a timeout** — resume `get_call_run` with the stored `run_id`.
   Re-running dials a real human again.
4. **Wait ~60s before your first poll**, then 5–10s intervals.
5. **Webhooks are unsigned.** Dedupe on `CALL-E-Event-Id`. Don't use the deprecated
   `verify`/`unwrap` methods — they implement a contract CALL-E no longer sends.
6. **`status: completed` doesn't mean the result is ready.** Wait for `result` or `error` to be
   non-null.
7. **Never model outcomes as booleans.** `unknown` is a first-class answer.
8. **Derive idempotency keys from the authorization, not the attempt.**
9. **Ship dry-run as the default** but show a real call in the video — you need both.
10. **`region` and `locale` are required per recipient** and must not be guessed from the phone
    number. Same rule applies to timezones (use IANA names).
11. **Check India/Canada/UK route as *international***, which may affect answer rates and caller ID
    if your demo recipient is there.

---

## 10. Links

- [Devpost hackathon](https://devpost.com/) · deadline Sep 14, 2026 8:45am PDT
- **Setup:** [`CALLE-AI/call-e-integrations`](https://github.com/CALLE-AI/call-e-integrations) ·
  [install guide](https://github.com/CALLE-AI/call-e-integrations/blob/main/docs/install/install-guide.md) ·
  [troubleshooting](https://github.com/CALLE-AI/call-e-integrations/blob/main/docs/install/troubleshooting.md)
- **Submission:** [`CALLE-AI/awesome-phone-call-agents`](https://github.com/CALLE-AI/awesome-phone-call-agents) ·
  [roadmap](https://github.com/CALLE-AI/awesome-phone-call-agents/blob/main/docs/roadmap.md) ·
  [design principles](https://github.com/CALLE-AI/awesome-phone-call-agents/blob/main/docs/design-principles.md) ·
  [production workflows](https://github.com/CALLE-AI/awesome-phone-call-agents/blob/main/docs/production-workflows.md)
- **Docs:** [docs.heycall-e.com](https://docs.heycall-e.com/) ·
  [MCP guide](https://github.com/CALLE-AI/call-e-integrations/blob/main/docs/mcp/openagent-oauth.md) ·
  [CLI reference](https://github.com/CALLE-AI/call-e-integrations/blob/main/packages/cli/docs/cli-reference.md)
- **Packages:** [`@call-e/cli`](https://www.npmjs.com/package/@call-e/cli) ·
  [`calle-ai` (PyPI)](https://pypi.org/project/calle-ai/) ·
  [`CALLE-AI/server-sdk-python`](https://github.com/CALLE-AI/server-sdk-python)
- [Dashboard / API keys](https://dashboard.heycall-e.com/account/api-keys) ·
  [Discord](https://discord.gg/6AbXUzUV8w)

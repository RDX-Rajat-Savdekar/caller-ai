# CALL-E — build plan

Locked plan for **CALL-E: Your Code Is Calling**. Deadline **Mon Sep 14, 2026 @ 8:45am PDT**.
Written Thu Sep 10 ~9:30pm PDT, so roughly **three and a half working days**.

Companion to [`calle-platform.md`](./calle-platform.md) (platform facts, competitive scan, rubric)
and [`ideas.md`](./ideas.md) (the long list). This doc supersedes both on *what we are building*.

---

## 0. The decision

Two submissions sharing one private core.

| | Name | Pitch | Role |
| --- | --- | --- | --- |
| **Main** | `headcount` | Disaster rapid needs assessment by phone. **The denominator is the product.** | Primary submission, gets the video |
| **Second** | `vouch` | Consent-scoped employment verification. **No consent artifact, no dial.** | Second PR, thinner, reuses ~70% of the code |
| **Third** | *(extract)* | Disposition taxonomy or consent ledger as a standalone skill | Free PR if Sunday allows |

Nothing stops us contributing three times into a four-slot prize pool.

**Do not pitch the shared engine.** Two narrowly-framed submissions that happen to share a private
core beat one generic platform under this rubric — §6 of the platform doc calls out "generic AI
that makes phone calls" by name as the thing that loses.

### Why these two survive the competitive scan

`headcount` is adjacent to four merged entries and has to be framed away from all of them:

| Merged | How we differ |
| --- | --- |
| `metapelet-elder-checkin`, `connected`, `kincall` | Those are ongoing relationships with known individuals. This is a one-shot population assessment after an event. |
| `mobilize`, `standby` | Those push *out* (fill a shift, summon people). This pulls *in* (collect structured need). |
| `callflow-campaign-runner`, `batch-runner` | Those report completions. This reports **non-completions as the deliverable**. |
| `gridguard`, `incident-escalation-call` | Those escalate to staff you employ. This assesses residents who opted into an alert list. |

The framing that makes it defensible: it is the phone version of **CDC CASPER** (Community
Assessment for Public Health Emergency Response) — a real, documented public-health methodology
currently executed by humans going door to door with clipboards across 30 clusters of 7 households
over about three days. We compress it to an hour. That gives us a named methodology, a named buyer
(county emergency management / public health), and a named user (the duty officer at the EOC).

`vouch` differs from `verity-verification-core`, `verify-by-phone`, `verify-contact-claim` and
`hirecall` on one axis: those verify a claim, but none of them can prove they were **allowed to
ask**. Background verification in the US is FCRA-regulated — consent scope, candidate right of
access, dispute, and pre-adverse-action are all mandatory and all unmodelled in the repo.

---

## 1. Architecture

```text
caller-ai/
├─ packages/
│  ├─ core/                 # everything neither app should own
│  │  ├─ dispositions.ts    # the canonical enum + terminal/retryable mapping
│  │  ├─ idempotency.ts     # key derivation from authorization, not attempt
│  │  ├─ runner.ts          # create → persist run_id → poll → reconcile
│  │  ├─ evidence.ts        # structured_result field → transcript span linker
│  │  ├─ budget.ts          # call governor: caps, quiet hours, blocklist, kill switch
│  │  └─ client.ts          # thin wrapper over @call-e/calle, base-URL swappable
│  ├─ sim/                  # fake CALL-E server — persona-driven transcript replay
│  └─ reel/                 # Remotion compositions (Player in-app + MP4 render)
├─ apps/
│  ├─ headcount/            # Next.js — EOC console
│  └─ vouch/                # Next.js — verification console
└─ docs/
   ├─ calle-platform.md
   ├─ ideas.md
   ├─ build-plan.md         # this file
   └─ safety.md             # WRITE THIS — it is how maintainers decide to merge
```

**Stack:** Next.js 15 App Router · TypeScript · Tailwind · shadcn/ui · Drizzle + `better-sqlite3`
(zero-setup for judges: `pnpm db:seed` and go) · SSE for live run status · Vitest on `core` ·
`@remotion/player` in-app, `@remotion/renderer` for the video.

**Monorepo:** pnpm workspaces. At submission time each app is copied into its own PR folder under
`apps/typescript/<name>/` with `core` vendored in — do not make the maintainers install a
workspace. Vendoring a few hundred lines twice is cheaper than a broken install.

---

## 2. `packages/core`

The parts every merged entry hand-rolls badly. Build this Friday morning, once.

### 2.1 Disposition taxonomy

Platform doc §3: never model outcomes as booleans, keep "didn't answer" separate from "answered
no." This is that rule as a type.

```ts
export type Disposition =
  | "answered_confirmed"      // reached, gave a usable answer
  | "answered_declined"       // reached, explicitly said no
  | "answered_unknown"        // reached, could not or would not say
  | "wrong_person"            // reached a human, not the intended one
  | "gatekeeper_refused"      // receptionist/policy block before the subject
  | "voicemail_left"
  | "voicemail_no_message"
  | "ivr_dead_end"            // phone tree with no path to the goal
  | "hung_up"
  | "no_answer"
  | "invalid_number"
  | "cancelled";

export const RETRYABLE: ReadonlySet<Disposition>;   // no_answer, voicemail_*, ivr_dead_end
export const REACHED:   ReadonlySet<Disposition>;   // the honest numerator
```

`REACHED` is deliberately narrow. `voicemail_left` is **not** reached. That one line is the whole
denominator-honesty argument and it should be visible in the README.

### 2.2 Idempotency

Platform doc §9 gotcha 8: derive the key from the **authorization**, not the attempt. Persist it
*before* the first request, or a client timeout dials a real human twice.

```
headcount:  hc:{event_id}:{roster_entry_id}:{wave_no}:{instrument_version}
vouch:      vo:{consent_id}:{employer_id}:{field_set_hash}:{scope_version}
```

Note what is absent from both: timestamps, UUIDs, retry counters. Re-running the same wave against
the same roster with the same instrument is a **no-op**, by construction.

### 2.3 Runner

The §9 gotchas 3, 4 and 6, implemented once:

1. Write `run_id` to SQLite **before** returning from create.
2. Wait ~60s before first poll, then 5–10s until terminal.
3. On restart, resume polling from stored `run_id`. **Never re-issue `run_call`.**
4. `status: "completed"` does not mean ready — wait for `result` or `error` to be non-null.
5. Webhook deliveries are unsigned: dedupe on the `CALL-E-Event-Id` header before any side effect,
   and reconcile against polled state rather than trusting either alone. Do **not** touch
   `client.webhooks.verify` / `.unwrap` — deprecated 0.2-era, incompatible with current deliveries.

Crash-resume is also a great 20 seconds of video: kill the process mid-call, restart, watch it pick
the run back up.

### 2.4 Evidence linker

This is the differentiator and the honest part. CALL-E returns `evidence[]` as natural-language
justifications, not transcript offsets — so linking a field to a *span* is our job.

```ts
linkEvidence(result, turns) -> Array<{
  field: string;
  value: unknown;
  turn: TranscriptTurn | null;   // best-scoring user turn above threshold
  score: number;
  supported: boolean;            // false → field is a claim, not a fact
}>
```

Score by normalized token overlap between the claimed value plus its evidence string and each
`speaker: "user"` turn. **Any field with `supported: false` routes to a human and is rendered
struck-through in the UI.** Platform doc §3: treat `task_completed: true` as a claim to audit.

### 2.5 Budget governor

Twenty free calls is the binding constraint on the whole hackathon. Hard caps per project and per
line, quiet hours in IANA timezone names (with a per-recipient region check — §9 gotcha 10 says
never infer region or timezone from the number), a blocklist, a kill switch, and a **dry-run
accountant** that prints what a wave *would* cost before it runs.

Surface the remaining budget in the app header. Judges notice discipline.

---

## 3. `packages/sim` — the most important non-obvious piece

A local server implementing `POST /v1/calls` and `GET /v1/calls/{id}`, replaying scripted personas
with realistic turn timing so the dashboard streams exactly like a live call while burning zero
calls. Switch with `CALLE_BASE_URL=http://localhost:4000`.

| Persona | Exercises |
| --- | --- |
| `cooperative` | Happy path, all fields populated |
| `voicemail` | `voicemail_left`, no fields, must not count as reached |
| `partial` | Answers two of five questions, rest `unknown` |
| `emergency` | Triggers the fail-closed escalation branch immediately |
| `wrong_person` | Someone else's phone |
| `gatekeeper` | "We only verify through a third-party service" (`vouch`) |
| `ivr_maze` | DTMF tree, then dead end |
| `hostile` | Hangs up mid-question |
| `unsupported_claim` | Model asserts a value the transcript does not contain → linker must catch it |

This single component buys four separately-scored things: dry-run as the default (Design Principle
7, non-negotiable house style), tests that run without live credentials, judges who can actually
run the project, and a deterministic demo we can re-record as many times as we want.

Ship the personas as JSON fixtures in `packages/sim/fixtures/` so they read as documentation.

---

## 4. `packages/reel` — Remotion

The unfair advantage, given Stage 8 transitions / Stage 9 Player / Stage 10 Skia already shipped in
`rdx-dev-creator-lab`. Compositions take **a real call's JSON as `inputProps`** and render twice:
in the dashboard via `@remotion/player`, and to MP4 via `npx remotion render` for Devpost.

The submission video is generated by the product. Say that out loud in the video.

| Composition | Input | Beat |
| --- | --- | --- |
| `CallReel` | `transcript_turns`, `structured_result`, linker output | Turns scroll on a timeline; as each field is extracted it flies to a result card with a connector back to the supporting turn. Unsupported fields land in red. |
| `CoverageReel` | wave totals | `200 dialed → 143 reached → 57 unaccounted`, then the 57 resolve into a search list. The thesis of `headcount` in eight seconds. |
| `ScopeReel` | consent + jurisdiction ruleset | Requested vs permitted columns, salary history struck through. The thesis of `vouch`. |
| `TitleCards` | — | Problem framing, architecture, closing |

Budget half a day. `CallReel` and `CoverageReel` are required; `ScopeReel` is nice-to-have.

---

## 5. `headcount` — main submission

### 5.1 Model

```
Event        one disaster. name, agency, IANA timezone, callback number, active
Instrument   versioned survey: questions[] → compiles to task text + result schema
Roster       opt-in contacts: phone, region, locale, tz, household size, flags
Wave         one pass over a filtered roster slice. wave_no, filter, budget cap
Attempt      one CALL-E call. run_id, idempotency_key, disposition, result
TriageCard   severity, needs[], evidence links, assignee, status
```

`Roster` entries must carry `region` and `locale` explicitly — §9 gotcha 10 forbids inferring them
from the number. Seed data uses masked numbers throughout (`+1 415 ••• ••00`).

### 5.2 Schemas

`recipient_result_schema` — every field a three-or-more-way enum, never a boolean:

```json
{
  "safety_status": { "enum": ["safe", "needs_assistance", "medical_emergency", "unknown"] },
  "evacuation":    { "enum": ["sheltering_in_place", "evacuated", "trapped", "unknown"] },
  "has_power":     { "enum": ["yes", "no", "unknown"] },
  "has_water":     { "enum": ["yes", "no", "unknown"] },
  "medication":    { "enum": ["none_needed", "running_low", "out", "unknown"] },
  "household":     { "enum": ["all_accounted", "partial", "unknown"] },
  "needs_human":   { "enum": ["yes", "no", "unknown"] }
}
```

`result_schema` (task level) — note there is no "success rate" field anywhere:

```json
{
  "dialed_count":     { "type": "integer" },
  "reached_count":    { "type": "integer" },
  "unreached_count":  { "type": "integer" },
  "critical_count":   { "type": "integer" }
}
```

### 5.3 Compiled task text

The instrument compiles to this. Judges should be able to read the exact string before confirming.

```text
You are an automated assistance line calling on behalf of {{agency}} after the {{event}}.
Identify yourself immediately as an automated AI assistant from {{agency}}, and say this is a
safety and needs check, not an emergency service.

Ask, in order, stopping early if the person reports an emergency:
1. Is everyone in the household safe and accounted for?
2. Are you sheltering in place, or have you evacuated?
3. Do you have electricity right now? Running water?
4. Does anyone need prescription medication you cannot get?
5. Is there anything urgent you need help with right now?

If the person reports a medical emergency, someone trapped, or anyone unaccounted for:
say "I am flagging this for a human responder right now", and end the call politely.

Never give medical, evacuation, or safety advice. Never promise a response time.
If you reach voicemail, leave a short message with the callback number {{callback}} and ask
no questions.
```

### 5.4 Fail-closed escalation

`safety_status == "medical_emergency"` **or** `evacuation == "trapped"` **or** `needs_human == "yes"`
**or** `completion_confidence.score < 0.8` on any critical field **or** any field with
`supported: false` → a human dispatch card. Never auto-resolved, never counted as a completed
assessment. Ambiguity routes to a person; that is the entire safety posture.

### 5.5 Waves

The host scheduler owns recurrence and CALL-E places one call per trigger — their design principle,
followed literally. Wave 1 hits the full roster. Wave 2 hits only `RETRYABLE` dispositions plus
anyone flagged `needs_assistance`, on a decaying cadence. Because the idempotency key includes
`wave_no`, re-running a wave is a no-op and advancing a wave is explicit.

### 5.6 Routes

| Route | Content |
| --- | --- |
| `/events/[id]` | **Hero screen.** Coverage bar pinned top, triage board below |
| `/events/[id]/waves/new` | Instrument preview → verbatim task text → budget check → confirm |
| `/events/[id]/roster` | Opt-in list, masked numbers, region/locale/tz per row |
| `/calls/[id]` | Transcript, field cards, evidence links, `CallReel` in the Remotion Player |
| `/instruments/[id]` | Survey editor — this is the "any data collection" generality |

**Coverage bar** is always visible and never lies: `dialed / reached / unreached`, with
`voicemail_left` sitting in unreached. **Triage board** is four columns — Critical, Needs Follow-up,
Safe, Unaccounted For — and Unaccounted For is styled as the most important one, not the leftovers.

---

## 6. `vouch` — second submission

Timeboxed to Sunday morning. If it slips, ship the skill extraction instead and do not mourn it.

### 6.1 Model

```
Candidate    person
Claim        employer | institution, title | degree, start, end
Consent      scope (employers × fields), jurisdiction, signed_at, expires_at, revoked_at
Verifier     org, phone, department, type: hr_direct | voe_line | registrar
Run          calle call_id, idempotency_key, disposition
FieldResult  claim_value, stated_value, match, evidence span, verifier name + authority
Dispute      candidate-raised objection to a FieldResult
```

### 6.2 The scope compiler — build this first, it is the demo

Consent record + jurisdiction ruleset → permitted field set → task text. Enforced in code, not in
the prompt: a field absent from the permitted set cannot reach the task string.

The hero screen is a two-column diff — **requested** vs **permitted** — with salary history struck
through in red under California SB 1162, then the verbatim compiled task below it, then Confirm.
Thirty seconds of video no other submission will have.

Missing, expired, or revoked consent is a **hard block with no override in the UI**. Not a warning.

### 6.3 Schema

```json
{
  "employment_confirmed":  { "enum": ["yes", "no", "unknown"] },
  "title_stated":          { "type": ["string", "null"] },
  "start_date_stated":     { "type": ["string", "null"] },
  "end_date_stated":       { "type": ["string", "null"] },
  "eligible_for_rehire":   { "enum": ["yes", "no", "policy_no_comment", "unknown"] },
  "verifier_name":         { "type": ["string", "null"] },
  "verifier_role":         { "type": ["string", "null"] },
  "verifier_authority":    { "enum": ["yes", "no", "unknown"] },
  "refusal_reason":        { "enum": ["none", "third_party_only", "policy",
                                      "wrong_department", "needs_written_request", "unknown"] }
}
```

`verifier_authority` is the non-obvious field: we record not just what was said but whether the
speaker claimed standing to say it.

### 6.4 Task text

```text
You are calling {{employer}} to verify employment for {{candidate}}, who gave written
authorization dated {{consent_date}}. Identify yourself as an automated verification assistant
acting for {{requesting_org}}.

If you reach a phone menu, navigate to Human Resources or employment verification.
If asked for an employer code, use {{employer_code}}.

Confirm ONLY the following:
{{permitted_fields}}

You are NOT authorized to ask about compensation or salary history, reason for separation,
medical or disability information, or job performance.

Before recording any answer, ask for the person's name and role, and whether they are
authorized to confirm employment for the company.

If they say verification is handled only through a third-party service, record that and end
the call. Do not attempt to persuade.
```

### 6.5 Scope

Employment **and education only**. Criminal and credit stay out entirely — those are database
lookups rather than phone work, and including them makes the safety story much harder to defend.
Say so explicitly in the README; the boundary is a feature.

The CALL-E fit is strong because large employers route verification to automated VOE lines wanting
an employer code and last-four by keypad. That is DTMF plus hold handling — the one capability the
competition does not have, and §5 notes almost nothing in the repo leans on it.

---

## 7. UI direction

An **operations console**, not a SaaS landing page. Dark, dense, tabular. Geist or Inter, tabular
numerals on every counter, one accent colour, severity encoded in a four-step ramp. No hero
sections, no marketing copy, no gradients.

Five details that carry disproportionate weight with these judges:

1. **Budget meter** in the header — calls remaining, always.
2. **Kill switch / cancel**, visible, not buried. Cancellation is first-class in their principles.
3. **"Why this call?"** panel on every run: the authorization trail that permitted the dial.
4. **Masked numbers** everywhere in seed data and screenshots.
5. **Unsupported fields struck through**, with the reason inline. Showing where the model was wrong
   is more persuasive than a clean success screen.

---

## 8. Call budget

Twenty total. Plan spends about ten and leaves headroom.

| When | Calls | For |
| --- | --- | --- |
| Tonight | 1 | Auth smoke test to own phone |
| Fri | 0 | Fixture mode only |
| Sat | 3 | `headcount` batch of three — own phone, a friend, one left to ring out |
| Sun | ~6 | Video takes, plus 1 for `vouch` |
| Reserve | ~10 | Things going wrong |

The Saturday batch matters more than its size: **three numbers where one goes to voicemail
demonstrates denominator honesty better than ten successful calls would.** One reached, one
voicemail, one no-answer is exactly the screenshot the pitch needs.

Record the walkthrough against the simulator and splice in the real call. Do not gamble a live dial
on camera.

---

## 9. Schedule

| When | Work |
| --- | --- |
| **Thu tonight, ~2h** | Install + auth + **one real call to own phone**. **Submit the extra-calls request form first** — approval is not instant. Scaffold the monorepo. |
| **Fri AM** | `packages/core`: dispositions, idempotency, runner, budget. `packages/sim` with all nine personas. Vitest as we go. |
| **Fri PM** | `headcount` schemas, instrument compiler, wave runner. End to end in fixture mode, ugly UI, **zero real calls**. |
| **Sat AM** | `headcount` dashboard: coverage bar, triage board, call detail, dispatch cards. |
| **Sat PM** | Evidence linker + `CallReel` and `CoverageReel` in the Remotion Player. **3 real calls** to validate the schema against reality. |
| **Sun AM** | `vouch`, timeboxed. Consent gate, scope compiler, report view. Reuses core wholesale. |
| **Sun PM** | READMEs ×2, `docs/safety.md`, tests green without credentials, seed data, run `validate_repository.py`, record video (**~6 calls**), **open both PRs early** to leave room for review comments. Submit the feedback survey. |
| **Mon pre-8:45am** | Buffer only. Build nothing. |

---

## 10. Submission checklist

Per platform doc §8. PRs go to `github.com/CALLE-AI/awesome-phone-call-agents`.

- [ ] `apps/typescript/headcount/` — PR 1
- [ ] `apps/typescript/vouch/` — PR 2
- [ ] `skills/<extracted>/` — PR 3 if time allows
- [ ] `python3 scripts/validate_repository.py` passes before opening each PR
- [ ] Branch, commit, and PR titles follow `docs/git-naming-conventions.md`
- [ ] ~3-minute video, public on YouTube, **shows at least one real call** (scored criterion)
- [ ] Devpost form: PR URL + video URL + the email on the CALL-E account
- [ ] `docs/safety.md`: disclosure, opt-out, rate limiting, and what happens when the model is wrong
- [ ] English only, no secrets, no real personal numbers, masked samples throughout
- [ ] Dry-run is the default; live calling is opt-in via an explicit flag
- [ ] Tests pass with no live credentials
- [ ] **Feedback survey** — 5 prizes at $200 + credits, judged on usefulness, best expected value on
      the board. Material already available: unsigned webhooks, deprecated `verify`/`unwrap`, the
      Cursor sandbox 403, and the undocumented Goals API.

---

## 11. Known risks

| Risk | Mitigation |
| --- | --- |
| `headcount` reads as another campaign runner | Lead every surface with the unreached count. CASPER framing in the first line of the README. |
| Extra-call approval does not arrive | Plan already fits inside 20. Submit the form tonight regardless. |
| Cursor sandbox blocks CALL-E (`curl: (56)`, `fetch failed`) | Settings → Agents → Auto-Run Mode → Run Everything (Unsandboxed). §9 gotcha 1. |
| Remotion render eats Sunday | `CallReel` and `CoverageReel` only. `ScopeReel` is cut first. |
| `vouch` slips | Ship the skill extraction instead. One good PR beats two rushed ones. |
| Live demo call fails on camera | Record against the simulator, splice the real call. Never live. |

# CALL-E — idea long list

Companion to [`calle-platform.md`](./calle-platform.md). That doc's §7 has six ranked ideas
(prior-auth chaser, IVR cartographer, uncovered plugin, `calle-call-chat`, schema linter,
document-requirement resolver). **Nothing here repeats those.** This is the wider list, written
after the competitive scan in §5 — every entry is checked against the ~33 skills / ~60 apps /
5 plugins already merged into `awesome-phone-call-agents`.

Filters applied to everything below, from §4 of the platform doc:

- **Outbound only.** No receptionist, no screening, no inbound.
- **The call is a black box.** All engineering is pre-call (should we dial, are we authorized,
  what exactly do we ask) and post-call (is the result supported by the transcript, what now).
- **20 free calls.** Anything needing dozens of live calls to demo is dead on arrival.
- **IVR + DTMF is the moat.** Ideas that lean on phone trees beat ideas that don't.
- **Dry-run default, fail-closed, evidence-backed, denominator-honest.**

---

## 0. Verdict on background verification

Your idea, assessed first because it's the one you're attached to.

**The risk:** two rows of the "already taken" table touch it. `verify-contact-claim`,
`verify-by-phone` and `verity-verification-core` own generic claim verification;
`hirecall` and `candidate-availability-call` own recruiting coordination. A skill called
"background-verification" that calls a previous employer and asks "did this person work here"
lands in the gap between two occupied slots and reads as a third take on the same idea.

**The twist that makes it defensible:** background verification is not a verification problem,
it's a **consent-and-custody** problem. In the US it's FCRA-regulated — you may not make the
call at all without the candidate's signed authorization, the scope of what you may ask is
bounded by that authorization, the candidate has a right to see and dispute the result, and an
adverse decision requires a documented pre-adverse-action step. None of the merged verification
entries model any of that. They verify a claim; they don't prove they were allowed to ask.

So build the **authorization layer**, and let CALL-E be the boring part:

| Piece | What it does |
| --- | --- |
| Consent artifact | Signed scope (employers, date range, permitted questions), expiry, revocation. No artifact → no dial, ever. |
| Scope compiler | Turns the consent record into the `task` text, so the agent literally cannot ask beyond scope. Salary-history questions get stripped per-jurisdiction. |
| Idempotency from consent | Key derived from `consent_id + employer_id + field_set`, not from the attempt — the §9 gotcha, applied where it actually bites. |
| Per-field provenance | Every returned field carries the transcript span, the speaker, who at the employer said it, and their stated authority to say it. |
| Candidate mirror | The candidate sees the same evidence the employer sees, and can dispute a field. |
| Fail-closed dispositions | `unknown` for HR-won't-confirm, third-party-service-only, wrong-department, voicemail — each a distinct outcome, never collapsed into "failed verification." |

**Why it's a good CALL-E fit specifically:** employment verification is one of the most
IVR-hostile tasks that exists. Big employers route you to an automated Verification-of-Employment
line that wants an employer code and an SSN's last four via keypad; universities route you to a
registrar that transfers you twice. DTMF navigation plus hold handling is the whole job. And the
result is naturally schema-shaped: dates confirmed, title match, eligible-for-rehire,
verifier name and role, refusal reason.

**Scope it down to demo well:** one lane, not three. Pick **employment + education verification
for one hiring pipeline**, not a general-purpose BGV suite. Keep criminal/credit records out
entirely — those are database lookups, not phone work, and dragging them in makes the safety
story much harder to defend.

**Pairing:** the consent layer is independently reusable (see idea 13), and background
verification is the single best excuse to build a **Greenhouse plugin** (idea 19), which lands in
the emptiest competitive field in the contest. That's a two-PR submission with one codebase.

---

## 1. The "published data is stale, the phone has the truth" family

The strongest pattern available, and the same shape as the IVR cartographer in §7 — you produce
a **reusable dataset**, which is explicitly what "Quality of the Idea" rewards. A directory
exists, it's authoritative-looking, it's wrong, and the only way to know is to call.

**1. Ghost-network auditor — is this doctor actually in-network and taking new patients?**
Insurance provider directories are notoriously wrong: the listed number is a fax, the practice
left the network two years ago, the doctor isn't taking new patients, the next opening is in
seven months. Regulators and journalists study this by hiring people to make phone calls — it's
one of the few research methodologies that is *literally* a call center. The No Surprises Act
pushes plans to reverify directory entries on a rolling ~90-day cycle, so the buyer is real.
Structured result: reachable, accepting-new-patients, in-network-for-this-plan, next available
date, and the specific person who said so.
*Why it wins:* highest-impact version of the stale-directory pattern, mandated phone work with a
named buyer, and **denominator honesty is the actual finding** — "9 of 20 listings unreachable"
is the headline, not a caveat. Nothing in the repo is close.
*Risk:* call-hungry to demo. Mitigate with a fixture corpus and 2–3 live calls on video.

**2. Clinical-trial site reality check.** ClinicalTrials.gov says "recruiting"; the coordinator
says the site closed enrollment in March, or the PI left, or they're only taking patients who
haven't had prior therapy. Desperate patients and their families cold-call sites one at a time
to find this out. Call coordinators for a given NCT number and return: still enrolling at this
site, screening-visit lead time, hard exclusions the listing omits, coordinator contact.
*Why it wins:* extremely sympathetic users, a well-defined public dataset to diff against, and
coordinators are *expecting* these calls — the ethics are clean. Adjacent to nothing merged.
*Risk:* never let it read as medical advice. Every field pending human verification.

**3. Safety-net services truth layer.** 211 directories, food-bank hours, free-clinic
eligibility, shelter intake rules and legal-aid walk-in windows are stale almost everywhere,
and the people relying on them can least afford a wasted bus trip. Call to confirm hours today,
what documents you must bring, walk-in versus appointment, languages spoken.
*Why it wins:* cheapest ethics story on this list, deeply multilingual (leans on CALL-E's
language coverage), and the output is a public JSON feed other people's apps can consume.
*Risk:* small orgs with volunteer-staffed phones — rate limit hard, disclose immediately, and
respect an opt-out list. Say all of that in a `docs/` safety note.

**4. Pharmacy stock-out finder for drugs in shortage.** When a drug is on the FDA shortage list,
patients phone pharmacies one by one. Fan out across a radius and return: in stock, quantity
band, will-order lead time, accepts-this-insurance.
*Why it wins:* visceral demo, obvious impact.
*Risk:* this is the parallel-sourcing pattern, which is the single most crowded row in the taken
table (`callsweep`, `supplyline`, `partline`, `sparescout`). You'd win on vertical depth only.

**5. Disaster capacity board.** In the 48 hours after a hurricane or wildfire, nobody knows which
shelters have beds, which clinics have power, which pharmacies can fill prescriptions. Call the
list on a decaying refresh cadence and publish a live capacity feed.
*Why it wins:* infrastructure, not another workflow wrapper; the refresh-cadence design is
genuinely interesting engineering; and it's the best video on this page.
*Risk:* you can't demo a real disaster, so it demos as a drill. `mobilize` and `gridguard` are
adjacent but both are about people you already have a relationship with.

---

## 2. Regulated phone-work verticals

Same DNA as the §7 prior-auth chaser: one miserable, IVR-hostile, compliance-bound task, done
properly. Pick one of these *or* prior-auth, not both.

**6. Court-date confirmation for public defenders and legal aid.** Hearing dates move, notices
arrive late or at an old address, and missing a date can produce a bench warrant. Clerk offices
answer by phone behind a phone tree. Call the clerk, confirm date/time/courtroom/judge against
what the client believes, and flag mismatches to a human paralegal.
*Why it wins:* the consequence of the failure mode is someone's arrest, which makes fail-closed
design feel load-bearing rather than ceremonial. IVR-native. Nothing merged touches courts.
*Risk:* never render legal advice or notify the client directly — output goes to the legal
worker, who owns the commitment. That's house style anyway.

**7. Tenant habitability escalation ladder.** Heat's been out for six days. The tool walks the
ladder — super, then property manager, then the city code-enforcement line (pure IVR) — logging
each attempt, what was promised, and by whom. The **evidence trail is the product**: a tenant who
later files a complaint or withholds rent needs a dated record of good-faith attempts.
*Why it wins:* reframes CALL-E's transcript-and-evidence output as legal documentation rather
than data extraction, which is a genuinely non-obvious read of the platform. Clean ethics —
you're calling your own landlord and your own city.
*Risk:* jurisdiction-specific; scope to one city's process and say so.

**8. Recall and safety-notice outreach with proof of attempt.** Recall campaigns are judged on
documented contact attempts across a whole owner list. Return per-recipient: reached, identity
confirmed, remedy scheduled, refused, unreachable-after-N — with masked numbers and honest
denominators.
*Why it wins:* batch is native to CALL-E, and "denominator-honest" stops being a principle and
becomes the deliverable. Regulated buyer, unclaimed slot.
*Risk:* reads as a campaign runner, and `callflow-campaign-runner` / `batch-runner` exist. The
compliance-artifact output is what separates it.

**9. Medical-records release (ROI) chaser.** Records requests vanish into Health Information
Management departments for weeks. Call, navigate the tree, get status, fee, format, ETA, and the
reason for any hold.
*Why it wins:* closest sibling to the §7 prior-auth idea with the same IVR advantage and a
lighter safety burden — you're chasing paperwork, not clinical facts.
*Risk:* quite similar to prior-auth. Don't pitch both.

**10. B2B receivables follow-up with promise-to-pay capture.** Small firms chase invoices by
phone through AP departments. Structured result: promise date, amount, dispute reason, correct AP
contact, PO mismatch.
*Why it wins:* clearest paying customer of anything on this list, and the schema is unusually
clean.
*Risk:* `ringer` and `casechaser` own consumer chores; this is a different buyer but the same
smell. Weakest impact story here.

**11. Vendor-compliance attestation.** Before onboarding, procurement confirms insurance
certificates, certifications and subcontractor status by phone with the issuing broker or body.
Same consent-and-provenance skeleton as background verification, pointed at companies instead of
people — which means it can share your code if you go the BGV route.
*Why it wins:* cheap second lane on an existing codebase.
*Risk:* boring demo.

**12. Housing availability and voucher acceptance.** Listings stay up after units are gone, and
"do you accept a housing voucher" is often unanswered until you call. Call listings, return
still-available, voucher-accepted, deposit, income requirement.
*Why it wins:* strong real-world impact, and the dataset has policy value.
*Ethics — read before building:* the established research method here is paired-tester auditing,
which depends on the caller *not* disclosing what they are. CALL-E discloses that it's an AI, so
a deception-based audit is off the table. Build it as an honest inquiry tool for an actual
apartment seeker, not as a discrimination study, or skip it.

---

## 3. Infrastructure and skills — best score-per-hour

§6 says "Quality of the Idea" favors things **reusable by the community**, and §5 says plugins
and shared skills are underserved. These are small, and other people's projects would import them.

**13. `calle-consent-ledger` — authorization as a first-class artifact.** §3 of the platform doc
says to derive idempotency keys from the authorization rather than the attempt, and §5 says
"require explicit intent" — but nobody has built the authorization object those rules imply. Ship
one: scoped consent records with expiry and revocation, a deterministic key derivation, a
`can_i_call(recipient, purpose)` gate that fails closed, and an append-only audit export.
*Why it wins:* it's the missing primitive under half the merged entries, it's maybe a day of
work, and it needs zero live calls to be correct. Also the natural extraction from idea 0.

**14. `calle-call-budget-governor`.** Every participant is rationing 20 calls. Enforce per-project
and per-line budgets, dedupe by idempotency key, quiet-hours windows in IANA timezones (with a
per-recipient region check, per the §9 gotcha), a blocklist, a kill switch, and a dry-run
accountant that tells you what a campaign *would* cost before you run it.
*Why it wins:* solves the contest's own binding constraint, so every other team is a user. Pure
pre-call logic — fully testable without credentials.

**15. Goals-API reference skill.** §3 notes that published Goals shipped in SDK 0.7, is barely
documented, and **nothing in the showcase repo uses it**. Ship the canonical wrapper: versioned
goal definitions in source control, schema migration between versions, the
`status: completed` versus result-materialization trap handled correctly, and a fixture harness.
*Why it wins:* directly targets "thoroughly and skillfully uses CALL-E" on a surface with zero
competition, and it's the most likely thing on this page to get cited by the maintainers.
*Risk:* it's a library, so the video needs a real consumer app to be watchable.

**16. Resumable run reconciler.** §9's scariest gotcha is that re-issuing `run_call` after a
client timeout dials a real human twice. Ship durable run state: persist `run_id` before
dialing, resume polling after restart with the correct ~60s-then-5–10s cadence, reconcile
unsigned webhook deliveries against polled state, and dedupe on `CALL-E-Event-Id`.
*Why it wins:* it's the correctness layer everyone hand-rolls badly, and you can demo it by
killing the process mid-call — a great 20 seconds of video.
*Risk:* `webhook-result-receiver` covers a slice of this; lead with crash-resume, not webhooks.

**17. Disposition taxonomy + conformance suite.** §3 says never model outcomes as booleans and
keep "didn't answer" separate from "answered no." Publish the canonical disposition enum
(answered-confirmed, answered-declined, answered-unknown, wrong-person, gatekeeper-refused,
voicemail, IVR-dead-end, hung-up, never-reached) with a test suite that runs a project's schemas
against it and fails the build on boolean collapse or a missing `unknown`.
*Why it wins:* turns a design principle into a linter. Complements the §7 persona harness rather
than competing with it.

**18. `call-review-console`.** Named in the roadmap, unbuilt, and mentioned in §5 — a reviewer UI
where a human sees the claimed structured result beside the transcript, with each field linked to
its supporting span, and accepts or rejects field by field.
*Why it wins:* it's the "human owns the commitment" principle made visible, it's the natural
front-end for *any* verification project including idea 0, and the roadmap asked for it.
*Risk:* UI polish decides it, and `calle-call-chat` (§7 idea 4) is the flashier of the two
roadmap apps. Don't build both.

---

## 4. Plugins — emptiest field in the contest

Five plugins versus sixty apps, against a roadmap that names ~22 wanted platforms. Restating §5
only to add the picks that pair with the ideas above.

| Platform | Trigger → call → writeback | Pairs with |
| --- | --- | --- |
| **Greenhouse** | Candidate hits *Offer* → verification calls → results and evidence back on the candidate record | Idea 0 — strongest pairing on this page |
| **ServiceNow** | P1 incident with no ack → escalation call → outcome on the ticket | Idea 16 |
| **Airtable / Notion** | Row flagged *needs-verification* → call → writeback with transcript link | Ideas 1–4 |
| **Slack Workflow Builder** | Approval step → call the on-call human → reply in thread | Ideas 13–14 |
| **GitHub Actions** | Release gate → approval call → job passes or fails closed | Idea 14 |

A plugin is a few hours, competes in an almost empty field, and §7 already recommends it as a
second PR. Its weakness is demo drama — so pair it with an app that supplies the story.

---

## 5. How I'd choose

| If you want… | Build |
| --- | --- |
| To keep background verification | Idea 0 scoped to employment + education, extract idea 13, add the Greenhouse plugin. Two PRs, one codebase. |
| The best impact story on this page | Idea 1 (ghost networks) or idea 6 (court dates) |
| A reusable public artifact | Idea 2 or 3 — same infrastructure shape as the §7 IVR cartographer |
| Highest score per hour | Idea 13, 14, or 15 plus any plugin |
| The best three-minute video | Idea 5 (capacity board) or idea 16 (kill the process mid-call) |

Three things every one of these needs, from §5 and §6: **fixture mode as the default** so judges
can run it without spending calls, **one real call on video** because "actually called at
runtime" is a scored criterion, and **an explicit safety note in `docs/`** covering disclosure,
opt-out, rate limiting and what happens when the model is wrong. The safety note is not
overhead — it's how the maintainers decide whether to merge.

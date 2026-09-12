# Safety note

How maintainers decide whether to merge. Companion to [`build-plan.md`](./build-plan.md).

Both apps identify as automated AI on the first turn, default to dry-run / fixture mode, and
never infer region, locale, or timezone from a phone number. Seed data and screenshots use
masked fictional numbers only (`+1 707 ••• ••40`).

Live calling is opt-in: `CALLE_LIVE=1` plus a real API key. The header always shows remaining
budget against a project cap of 20. The kill switch is on every screen; it blocks new dials and
cancels in-progress fixture attempts.

---

## `headcount`

Disaster rapid needs assessment for a duty officer. The denominator is the product:
`voicemail_left` is **not** reached.

### Disclosure

- Compiled task text says this is an automated AI assistant from the named agency, a safety and
  needs check, **not** an emergency service.
- Voicemail leaves a short callback and asks no questions.

### Opt-out and retries

- Roster is opt-in. Wave 2 only retries `RETRYABLE` dispositions.
- Wrong-person and hostile do not retry.
- Kill mid-wave cancels remaining queued attempts (`cancelled` → Unaccounted).

### When the model is wrong

- `task_completed: true` is a claim to audit, not a fact.
- `linkEvidence` marks unsupported fields. Those render struck-through and never count as a
  completed assessment.
- Fail-closed → a human dispatch card, never auto-resolved:
  `safety_status == medical_emergency`, `evacuation == trapped`, `needs_human == yes`,
  low completion confidence on a critical field, or any unsupported critical field.

### Out of scope

- Not an emergency service. It never gives medical, evacuation, or safety advice, and never
  promises a response time.

---

## `vouch`

Consent-scoped employment verification. **No consent artifact, no dial.** There is no override
in the UI for missing, revoked, or expired consent.

### Disclosure

- Compiled task identifies as an automated verification assistant acting for the requesting org.
- The candidate's written authorization date is in the task. The agent asks the speaker's name,
  role, and authority before recording answers.

### Authorization

- Consent gate runs in code before enqueue. Confirm is disabled when the gate fails or kill is on.
- Scope compiler: requested ∩ consent fields, minus jurisdiction blocks (California SB 1162
  strips `salary_history`). A field absent from the permitted set cannot reach the task string.
- Idempotency key is `vo:{consent_id}:{employer_id}:{field_set_hash}:{scope_version}` — derived
  from the authorization, not the attempt.
- Employment and education only. Criminal and credit stay out — those are database lookups, not
  phone work.

### When the model is wrong

- Same evidence linker. Unsupported fields strike through on the run report and on `CallReel`.
- Third-party-only / policy / wrong-department are distinct dispositions, not a collapsed "fail."
- Gatekeeper fixture records `refusal_reason: third_party_only` and ends the call. No persuasion.

### Out of scope

- No salary history in California, even if the requester asked and the consent form included it.
- No criminal, credit, medical, disability, or performance questions.

# Safety note

How maintainers decide whether to merge. Fill this before the PR — Sunday work
per [`build-plan.md`](./build-plan.md) §10.

## Disclosure

- The agent identifies itself as an automated AI assistant on the first turn.
- Seed data and screenshots use masked fictional numbers only (`+1 555 ••• ••00`).

## Opt-out

- Roster is opt-in. Wrong-person and hostile dispositions do not retry.
- Blocklist lives in `packages/core` budget governor.

## Rate limiting

- Project cap defaults to 20. Dry-run / fixture mode is the default (`CALLE_LIVE=0`).
- Live dials require an explicit flag and a real API key.

## When the model is wrong

- `task_completed: true` is a claim to audit, not a fact.
- `linkEvidence` marks unsupported fields. Those render struck-through and route
  to a human dispatch card. They are never counted as a completed assessment.
- Fail-closed triggers: `medical_emergency`, `trapped`, `needs_human=yes`,
  low completion confidence, or any unsupported critical field.

## Out of scope

- `headcount` is a needs-assessment tool, not an emergency service. It never
  gives medical, evacuation, or safety advice.
- `vouch` covers employment and education only. Criminal and credit stay out.

# CALL-E workspace

Two submissions sharing one private core for
[CALL-E: Your Code Is Calling](https://call-e.devpost.com/).
Deadline **Mon Sep 14, 2026 @ 8:45am PDT**.

What to build next: [`docs/build-plan.md`](docs/build-plan.md) §9.
Safety note for maintainers: [`docs/safety.md`](docs/safety.md).

| App | Pitch | Dev |
| --- | --- | --- |
| `headcount` | Disaster rapid needs assessment. **The denominator is the product.** | http://localhost:3000 |
| `vouch` | Consent-scoped employment verification. **No consent artifact, no dial.** | http://localhost:3001 |

Both consoles are operational in fixture mode. PRs are open:

- Headcount: https://github.com/CALLE-AI/awesome-phone-call-agents/pull/601
- Vouch: https://github.com/CALLE-AI/awesome-phone-call-agents/pull/605

Remaining: public YouTube upload, Devpost form, feedback survey.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm db:seed
pnpm dev:stack          # simulator :4000 + headcount :3000
pnpm dev:vouch          # vouch on :3001
```

Headcount default seed is **empty** (roster + instrument only). Confirm wave 1 from the
coverage board. After-action screenshots: `pnpm db:seed:after`.

Vouch seed is three consents: Alex Rivera (SB 1162 blocks salary), Sam Cole (third-party
gatekeeper), Jordan Hale (revoked — Confirm disabled).

Dry-run is the default. `CALLE_BASE_URL` points at the local simulator (`packages/sim`).
Live calling is opt-in:

```bash
CALLE_LIVE=1 CALLE_API_KEY=... CALLE_SMOKE_PHONE=+1... pnpm smoke
```

Do not run a live smoke until the extra-calls form is in:
https://forms.gle/EPQttEZ1rkW8iq9q6

Saturday leftover if approval landed: three live `headcount` dials (reached / voicemail /
no-answer). Record the video against the simulator and splice one real call.

## Auth

```bash
calle auth login
calle auth status
```

API keys: https://dashboard.heycall-e.com/account/api-keys

## Tests

```bash
pnpm test
pnpm typecheck
```

No live credentials required.

# CALL-E workspace

Two submissions sharing one private core for
[CALL-E: Your Code Is Calling](https://call-e.devpost.com/). Plan:
[`docs/build-plan.md`](docs/build-plan.md).

| App | Pitch | Dev |
| --- | --- | --- |
| `headcount` | Disaster rapid needs assessment. The denominator is the product. | http://localhost:3000 |
| `vouch` | Consent-scoped employment verification. No consent artifact, no dial. | http://localhost:3001 |

## Setup

```bash
cp .env.example .env
pnpm install
pnpm db:seed
pnpm dev:stack          # simulator :4000 + headcount :3000
# pnpm dev:vouch        # vouch on :3001
```

Dry-run is the default. `CALLE_BASE_URL` points at the local simulator
(`packages/sim`). Live calling is opt-in:

```bash
CALLE_LIVE=1 CALLE_API_KEY=... CALLE_SMOKE_PHONE=+1... pnpm smoke
```

Do not run a live smoke call until you have submitted the extra-calls form:
https://forms.gle/EPQttEZ1rkW8iq9q6

## Auth

```bash
calle auth login
calle auth status
```

API keys: https://dashboard.heycall-e.com/account/api-keys

## Tests

```bash
pnpm test
```

No live credentials required.

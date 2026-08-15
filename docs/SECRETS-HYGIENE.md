# Secrets hygiene

## Current state

All credentials are env-var-only and never committed as real values — verified by searching the
full tracked git history for JWT-shaped strings, `sk-ant-`, `AIza`, `ghp_`, `xox`, and AWS-style
key patterns. The only hardcoded credential-shaped strings found are the Supabase **anon/public**
key in three deploy workflows (`deploy-dashboard.yml`, `deploy-frontend.yml`,
`deploy-pages.yml`) and `artifacts/front-desk/.env.local.example` — decoding the JWT payload
confirms `"role":"anon"` in each case, not `service_role`. This is standard, expected practice:
the anon key is designed to be public (it ships in every browser bundle of any Supabase
frontend regardless), and Row Level Security — not anon-key secrecy — is what actually protects
data. No `service_role` key, API key, or other genuine secret was found committed anywhere.

`.gitignore` correctly excludes `.env`/`.env.*` while allowlisting `.env*.example` template
files, and every `.env.example` in the repo contains only placeholders or genuinely public
values (the Supabase project URL, the practice's public phone number/email) — nothing sensitive.

## GitHub secret scanning — not enabled, needs a repo admin

Running the on-demand scan (`gh api` / the GitHub secret-scanning tool) against this repo
returns: **"Repository does not have GitHub Advanced Security enabled."** Enabling it requires
repository admin access to Settings → Code security — the same category of action as deleting a
merged branch elsewhere in this project: something a session working from this codebase cannot
do itself. To enable: **Settings → Code security and analysis → Secret scanning → Enable**
(and enable **Push protection** alongside it, which blocks a commit containing a detected secret
before it's even pushed, rather than only flagging it after).

## Rotation cadence

No rotation has ever been performed on these credentials as far as this repo's history shows.
Recommended cadence for the highest-blast-radius secrets, in priority order:

| Secret | Blast radius if leaked | Suggested cadence |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Full read/write on every table, bypasses RLS entirely | Every 90 days, or immediately on suspected exposure |
| `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_OAUTH_REFRESH_TOKEN` | Full Gmail send-as + Calendar read/write for the practice's real email | Every 90 days |
| `TWILIO_AUTH_TOKEN` | Send SMS as the practice, read call/SMS history | Every 90 days |
| `ANTHROPIC_API_KEY` | Billing exposure, no PHI access on its own (PHI only flows *to* Claude, not stored by the key) | Every 180 days |
| `SESSION_SECRET` | Session forgery for the api-server | Every 180 days, or immediately if ever logged/exposed |
| `CRON_SECRET` | Unauthenticated trigger of cron endpoints (reminders, escalations) — no PHI read access itself | Every 180 days |

Rotation mechanics: all of the above are set in the Render dashboard (`amise-medflow-api` →
Environment) per `render.yaml`'s comment block, and changing one triggers a redeploy —
see `docs/INCIDENT-RUNBOOK.md`'s MODE kill-switch section for what a Render env-var change
actually does to the running process (restart, not hot-reload). Rotate one secret at a time and
confirm `GET /api/healthz/env` still reports every integration as configured before moving to
the next.

## What's still open

- Enabling GitHub secret scanning + push protection (needs a repo admin — see above).
- Actually rotating the six secrets above for the first time and recording the date here.
- No automated reminder exists for "it's been 90 days" — this is a manual calendar-tracking
  problem today, not a code problem.

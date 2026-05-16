# Amise Front Desk AI

An adaptive triage and scheduling assistant for Amise Medical Services (Saint Lucia), a general and endoscopic surgery practice led by Dr Dawit Daniel Kabiye, MD, DM.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: see **Required secrets** below

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite (proxied at `/`)
- API: Express 5 (proxied at `/api`)
- Shared logic: `lib/triage-engine` (composite lib, used by both frontend and backend)
- Triage AI: Anthropic Claude (`@anthropic-ai/sdk`)
- Patient DB / audit log: Supabase (`@supabase/supabase-js`)
- Calendar scheduling: Google Calendar API (`googleapis`)
- Email intake / drafting: Gmail API (`googleapis`)
- SMS reminders: Twilio (`twilio`)
- Validation: Zod

## Where things live

| Path | Purpose |
|---|---|
| `artifacts/dashboard/` | React/Vite triage dashboard (client-side) |
| `artifacts/dashboard/src/pages/Home.tsx` | Main triage UI |
| `artifacts/dashboard/src/lib/` | Client-side copies of triage engine |
| `artifacts/api-server/src/routes/` | Express routes |
| `artifacts/api-server/src/lib/` | Backend integrations (Claude, Gmail, Calendar, SMS, Supabase) |
| `lib/triage-engine/src/` | Shared rules + adaptive triage scoring (canonical source) |

## Architecture decisions

- **Client-side triage**: The adaptive triage engine runs entirely in the browser on the dashboard — no API round-trip needed for scoring. This gives instant live feedback as the front desk fills in fields.
- **Shared lib pattern**: `lib/triage-engine` is a composite TypeScript lib consumed by both the dashboard (bundled by Vite) and the API server (bundled by esbuild). No duplication.
- **Mode gate**: All outbound actions (email send/draft, SMS, calendar writes) are gated by `process.env.MODE` (`dry_run` / `supervised` / `auto`). Always start with `dry_run`.
- **Safety layer**: Every Claude-drafted reply is scanned against `FORBIDDEN_PATTERNS` before sending. Forbidden content (fees, diagnoses, drug doses, results) causes the message to be quarantined for human review.
- **No DB in Replit**: Patient records and audit logs live in Supabase (external). The Replit DB is not used — this project's data layer is Supabase.

## Product

- **Triage dashboard** (`/`): Front desk staff fill in patient age, sex, symptoms, vitals, comorbidities, medications, and a free-text patient message. The system scores acuity in real time (routine / review / priority / urgent) and outputs: recommended action, suggested appointment type, adaptive form blocks, questions to ask, and a safe scripted response.
- **Email intake** (`POST /api/intake/run`): Reads unread Gmail messages, classifies them with Claude, runs red-flag triage, finds calendar slots, and sends/drafts replies — all in one pipeline.
- **Triage preview** (`POST /api/triage/preview`): REST endpoint that exposes the adaptive triage engine for external callers.
- **Reminders** (`POST /api/cron/reminders`): Sends SMS (48h, 2h) and email (24h) reminders for confirmed appointments.
- **Daily summary** (`POST /api/cron/daily-summary`): Emails Dr Kabiye a brief of the day's schedule, escalations, and pending replies.

## Required secrets

| Secret | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON of the Google service account |
| `GMAIL_USER` | Gmail address to act as (service account subject) |
| `CALENDAR_ID_RODNEY_BAY` | Google Calendar ID for Rodney Bay |
| `CALENDAR_ID_CASTRIES` | Google Calendar ID for Castries |
| `CALENDAR_ID_TAPION_ERCP` | Google Calendar ID for Tapion/ERCP |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Twilio sender number |
| `MODE` | `dry_run` (default) / `supervised` / `auto` |
| `CRON_SECRET` | Shared secret for cron endpoint auth |
| `DOCTOR_NOTIFY_EMAIL` | Email address for escalations and daily summary |
| `SMS_PROVIDER` | `dry_run` (default) / `twilio` / `digicel` |

## Gotchas

- Always run with `MODE=dry_run` first and review drafted messages before switching to `supervised` or `auto`.
- The frontend dashboard runs triage purely client-side — changing triage rules in `lib/triage-engine` requires updating the copy in `artifacts/dashboard/src/lib/` as well (or refactor to use the shared lib via Vite bundling).
- Supabase schema must include: `patients`, `pending_bookings`, `confirmed_appointments`, `audit_log` tables (see original `supabase-schema.sql` from the imported ZIP).
- Google service account must have domain-wide delegation for `gmail.modify`, `gmail.send`, and `calendar` scopes.

## User preferences

- British-Caribbean professional tone in all patient-facing copy.
- Never expose clinical advice, fees, diagnoses, medication dosages, or results in any automated message.

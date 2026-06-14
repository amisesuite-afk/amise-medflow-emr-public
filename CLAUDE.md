# Amise MedFlow EMR — Claude Code Guide

## Project

Adaptive triage and scheduling assistant for **Amise Medical Services** (Saint Lucia), a general and endoscopic surgery practice led by Dr Dawit Daniel Kabiye, MD, DM.

## Timezone

All dates, times, and scheduling logic use **Eastern Caribbean Time — `America/St_Lucia` (UTC-4, no DST)**.

## Commands

```bash
pnpm --filter @workspace/api-server run dev   # API server — port 8080 (proxied at /api)
pnpm --filter @workspace/dashboard run dev    # Dashboard (proxied at /)
pnpm run typecheck                             # Full typecheck across all packages
pnpm run build                                 # Typecheck + build all packages
```

## Stack

- **Runtime**: Node.js 24, TypeScript 5.9, pnpm workspaces
- **Frontend**: React 19 + Vite
- **API**: Express 5
- **Shared lib**: `lib/triage-engine` (used by both frontend and backend)
- **Auth**: Supabase Auth (`@supabase/supabase-js` v2), email/password, `user_profiles` table, RLS
- **AI**: Anthropic Claude (`@anthropic-ai/sdk`)
- **DB / audit log**: Supabase
- **Calendar**: Google Calendar API
- **Email**: Gmail API
- **SMS**: Twilio

## Repo layout

| Path | Purpose |
|---|---|
| `artifacts/dashboard/` | React/Vite triage dashboard |
| `artifacts/dashboard/src/pages/Home.tsx` | Main triage UI |
| `artifacts/dashboard/src/lib/supabase.ts` | Supabase client singleton |
| `artifacts/dashboard/src/context/AuthContext.tsx` | Auth state, sign-in/out, profile loading |
| `artifacts/dashboard/src/components/LoginPage.tsx` | Login form + diagnostics panel |
| `artifacts/dashboard/src/lib/` | Client-side triage engine |
| `artifacts/api-server/src/routes/` | Express routes |
| `artifacts/api-server/src/lib/` | Backend integrations (Claude, Gmail, Calendar, SMS, Supabase) |
| `lib/triage-engine/src/` | Shared adaptive triage rules + scoring |
| `supabase-schema.sql` | 12-table schema, RLS policies, triggers |

## Architecture

- **Client-side triage**: Scoring runs entirely in the browser — no API round-trip for acuity calculation.
- **Shared lib**: `lib/triage-engine` is consumed by both dashboard (Vite) and API server (esbuild).
- **Mode gate**: All outbound actions (email, SMS, calendar writes) are gated by `MODE` env var — always start with `dry_run`.
- **Safety layer**: Every Claude-drafted reply is scanned against `FORBIDDEN_PATTERNS` before sending. Forbidden content (fees, diagnoses, drug doses, results) is quarantined for human review.
- **Auth flow**: Staff log in via Supabase email/password. `AuthGuard` blocks access until a valid session exists.
- **Vite proxy**: In dev, Supabase requests go through `/sb-proxy` to avoid CORS. Production uses the Supabase URL directly.

## Required env vars

### Frontend (`VITE_` prefix required)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon JWT key (`eyJ…`, ~200+ chars) — **not** the opaque `sb_publishable_…` format |

### Backend

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL (server-side copy) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — never expose to browser |
| `ANTHROPIC_API_KEY` | Claude API key |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON of the Google service account |
| `GMAIL_USER` | Gmail address for service account impersonation |
| `CALENDAR_ID_RODNEY_BAY` | Google Calendar ID — Rodney Bay |
| `CALENDAR_ID_CASTRIES` | Google Calendar ID — Castries |
| `CALENDAR_ID_TAPION_ERCP` | Google Calendar ID — Tapion/ERCP |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Twilio sender number |
| `SESSION_SECRET` | Express session secret |
| `MODE` | `dry_run` (default) / `supervised` / `auto` |
| `CRON_SECRET` | Shared secret for cron endpoint auth |
| `DOCTOR_NOTIFY_EMAIL` | Email for escalations and daily summary |
| `SMS_PROVIDER` | `dry_run` (default) / `twilio` / `digicel` |

## Gotchas

- `VITE_SUPABASE_ANON_KEY` must be the JWT anon key (`eyJ…`). The opaque `sb_publishable_…` format is rejected by supabase-js v2 with `AuthUnknownError`.
- The login page has a **connection diagnostics** panel — check it first when auth fails.
- Always start with `MODE=dry_run` and review drafted messages before switching to `supervised` or `auto`.
- Triage rules in `lib/triage-engine` must stay in sync with the copy in `artifacts/dashboard/src/lib/` until the dashboard imports the shared lib directly via Vite bundling.
- Google service account needs domain-wide delegation for `gmail.modify`, `gmail.send`, and `calendar` scopes.
- Patient records and audit logs live in Supabase — the Replit DB is not used.
- **Every new table needs an explicit `grant ... to service_role` (in addition to `authenticated`).** `artifacts/api-server`'s `sb()` client connects as `service_role` — RLS is bypassed for that role, but the underlying table-level GRANT is still checked first, so a missing grant causes `permission denied for table X` (42501) → HTTP 502 on any endpoint touching that table. This bit `patients`, `documents`, `clinical_notes`, etc. (fixed in `supabase-service-role-grants-fix-migration.sql`) — when adding a new migration, grant `service_role` alongside `authenticated` from the start instead of patching it later.

## Tone

British-Caribbean professional tone in all patient-facing copy. Never include clinical advice, fees, diagnoses, medication dosages, or results in any automated message.

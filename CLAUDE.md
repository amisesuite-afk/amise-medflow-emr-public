# Amise MedFlow EMR — Claude Code Guide

## Product Vision

AMISE MedFlow EMR is an **AI-assisted Surgical Clinical Operating System designed by surgeons for surgeons.** It supports the complete continuum of surgical care — from referral and consultation to emergency surgery, endoscopy, operative management, postoperative follow-up, quality improvement, research, billing, and long-term patient surveillance.

### Guiding Principle

The platform should feel like having an experienced medical AI, surgical registrar, medical secretary, theatre coordinator, perioperative nurse, quality and safety officer, clinical auditor, coding specialist, and clinical researcher working beside the surgeon during every patient encounter. The system should **anticipate the surgeon's next need**, organise information intelligently, identify missing or high-risk items, draft high-quality documentation, and provide timely, evidence-informed suggestions without interrupting clinical workflow.

**The AI supports — but never replaces — the surgeon's judgment.**

### The Medical AI Assistant must

- Think like a consultant-trained surgical assistant, adapting to the patient's presentation rather than following rigid templates.
- Highlight clinically significant positive findings and detect red flags requiring urgent intervention.
- Generate concise, professional documentation in real time.
- Recommend investigations, referrals, and evidence-based management options.
- Produce operative notes, endoscopy reports, discharge summaries, referral letters, insurance reports, and patient instructions.
- Monitor pathology, imaging, laboratory results, and postoperative follow-up.
- Support clinical coding, billing, audit, quality improvement, and research data collection.
- Learn the surgeon's preferred documentation style and workflow while remaining fully configurable.
- Never conceal uncertainty and clearly distinguish confirmed facts from AI-generated suggestions.

### Engineering gate — every feature must satisfy at least one of

1. Improve patient safety
2. Reduce clinician cognitive load
3. Reduce clicks and documentation time
4. Improve surgical decision support
5. Improve communication between healthcare professionals
6. Improve continuity of care
7. Improve documentation quality
8. Improve compliance with evidence-based practice
9. Improve audit and research capability
10. Improve patient experience

**If a feature does not clearly contribute to one or more of these, it should not be included.**

### Human authority — the surgeon always retains full responsibility for

Clinical assessment · Diagnosis · Investigations · Treatment decisions · Operative planning · Procedures · Documentation approval · Prescribing · Referrals · Final sign-off.

The AI may recommend, organise, summarise, and assist — but it must **never** independently diagnose, prescribe, order procedures, or modify the medical record without explicit clinician approval.

---

## Project

Specialist general and endoscopic surgery practice — **Amise Medical Services**, Saint Lucia, led by Dr Dawit Daniel Kabiye, MD, DM. Covers surgical follow-up, elective and emergency surgery, endoscopy (including ERCP), and broad screening / wellness / preventive care.

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
| `VITE_SENTRY_DSN` | Sentry DSN for dashboard error monitoring (optional) |

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
| `STAFF_NOTIFY_EMAIL` | Email for staff booking alerts (falls back to `DOCTOR_NOTIFY_EMAIL`) |
| `STAFF_NOTIFY_PHONE` | Phone for staff SMS alerts on new bookings |
| `PRACTICE_PHONE` | Primary practice phone shown in patient SMS (default `+17582840557` — Tapion) |
| `PRACTICE_LINE_TAPION` | E.164 number for Tapion Hospital line (default `+17582840557`, WhatsApp enabled) |
| `PRACTICE_LINE_RODNEY_BAY` | E.164 number for Rodney Bay / outpatient line (default `+17587207111`, WhatsApp enabled) |
| `PRACTICE_LINE_LANDLINE` | E.164 number for landline (default `+17584592227`, no WhatsApp) |
| `PRACTICE_LINE_TAPION_LABEL` | Display label for Tapion line (default `Tapion`) |
| `PRACTICE_LINE_RODNEY_BAY_LABEL` | Display label for Rodney Bay line (default `Rodney Bay`) |
| `WHATSAPP_NUMBERS` | Comma-separated E.164 list of WhatsApp-capable lines (default: Tapion + Rodney Bay) |
| `SMS_PROVIDER` | `dry_run` (default) / `twilio` / `digicel` |
| `SENTRY_DSN` | Sentry DSN for API error monitoring (optional) |
| `PORTAL_URL` | Front-desk portal URL for CORS and WhatsApp links |
| `DASHBOARD_URL` | Dashboard URL for CORS |
| `CLAUDE_MODEL` | Override Claude model (default `claude-haiku-4-5-20251001`) |
| `LOG_LEVEL` | Pino log level (default `info`) |

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

## Clinical context — outpatient practice

This is an **outpatient general and endoscopic surgery practice**, not an emergency department. Key rules:

- **Emergency-severity symptoms → ER/911.** Patients reporting symptoms flagged as `emergency` by the APCQ engine must be shown a prominent redirect to call 911/999 or go to the nearest ER. The clinic does not manage acute emergencies through its booking queue.
- **Red flags ≠ emergencies.** Red flags (e.g., unintentional weight loss, progressive dysphagia) warrant expedited outpatient review and staff alerts — not ER redirect.
- **Not medical advice.** The intake form is an administrative scheduling tool, not a clinical consultation. The entry point must state this clearly as part of consent. No diagnosis, treatment recommendation, or clinical opinion is provided through the intake flow.
- **Human gates are mandatory.** Front desk staff or nurse review → doctor approval is the required safety workflow. Front desk staff are the first and last line — they handle the booking inbox, triage queue, and most day-to-day review. Nurses are present occasionally, not full-time. Either a front desk staff review (`staff_reviewed_at`) or a nurse review (`nurse_reviewed_at`) satisfies the pre-approval gate; the doctor-approve endpoint enforces this.
- **AI urgency floor.** AI-generated urgency must never downgrade a deterministic red-flag severity — always use `max(questionnaire_severity, ai_severity)`.

## Cross-application data integrity

The three apps (front-desk, API server, dashboard) share a Supabase backend. Key linkage rules:

- **`appointment_requests` ↔ `questionnaire_sessions`**: Every web intake must link these via `questionnaire_session_id` FK on `appointment_requests`. Without this, staff cannot see questionnaire answers from the booking inbox.
- **Supabase fallback mode**: When the API server (Render) is down, the dashboard falls back to direct Supabase queries for reads. Write actions (confirm/waitlist/cancel) still require the API server. A degraded-mode banner must be shown.
- **`delivery_method` constraint**: The `questionnaire_sessions.delivery_method` CHECK constraint must include `'web_intake'`. Migration: `supabase-web-intake-delivery-method-migration.sql`.
- **`source` column**: Always set `source: 'web'` on `appointment_requests` created via web intake so the dashboard can distinguish intake sources.
- **`service_role` grants**: Every new table needs `GRANT ... TO service_role` — the API server connects as `service_role` and RLS bypass doesn't skip table-level GRANTs.

## Audit trail

Engineering audit completed 2026-06-23. Deliverables in repo root:
- `AMISE-MedFlow-EMR-Audit-2026-06-23.pdf` — full findings report
- `AMISE-MedFlow-EMR-Flowcharts.html` — interactive Mermaid diagrams
- `supabase-web-intake-delivery-method-migration.sql` — pending migration

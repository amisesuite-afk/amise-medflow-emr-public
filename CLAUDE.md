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
pnpm run test:e2e                              # Playwright walkthrough — requires dashboard dev server on :3000
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
| `migrations/README.md` | Migration source of truth, how to add a new one, and the current list of unresolved conflicting duplicate table definitions |

## Architecture

- **Client-side triage**: Scoring runs entirely in the browser — no API round-trip for acuity calculation.
- **Shared lib**: `lib/triage-engine` is consumed by both dashboard (Vite) and API server (esbuild).
- **Mode gate**: All outbound actions (email, SMS, calendar writes) are gated by `MODE` env var — always start with `dry_run`. Booting with `MODE=auto` requires `CONFIRM_AUTO_MODE=true` or the api-server refuses to start (CI-independent, enforced at boot in `artifacts/api-server/src/index.ts`) — the active mode is also logged as a loud banner on every boot.
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
| `CONFIRM_AUTO_MODE` | Must be `true` for the api-server to boot when `MODE=auto` — a bare `MODE=auto` refuses to start. Prevents a misconfigured environment from going live into unsupervised outbound messaging silently. |
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
| `API_BASE_URL` | Public URL of the API server (used in Twilio TwiML callbacks, e.g. `https://api.example.com`) |
| `FORWARD_TO_NUMBERS` | Comma-separated E.164 list of staff cell phones to ring before voicemail (e.g. `+17582840557,+17587207111`) |
| `FORWARD_RING_TIMEOUT` | Seconds to ring forwarding numbers before falling back to voicemail (default `25` ≈ 4 rings) |
| `RECORDING_UPLOAD_KEY` | Shared secret for Android call recorder webhook (`X-Upload-Key` header in Tasker HTTP task) |
| `OPENAI_API_KEY` | OpenAI API key — enables Whisper transcription of uploaded cell phone recordings (optional) |
| `TWILIO_TRANSCRIPTION` | `true` to enable Twilio's own transcription on voicemail recordings (English only, less accurate than Whisper) |
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
- **`dx-variants.ts`'s `allowedPhases` correctness is CI-enforced.** `pnpm --filter @workspace/scripts run lint:dx-phases` (`scripts/src/lint-dx-variant-phases.ts`) checks every audited variant's `allowedPhases` against the evidence-based reference table in `.claude/skills/emr-review/SKILL.md`. If you change a variant's phases, update both files together — see the SKILL.md table for why a phase can be clinically correct even when it looks surprising (e.g. `'surgical'` covers endoscopic/interventional procedures, not just open/lap operations). A separate, non-blocking scan (`scan:nav-lockout`) flags newly-added navigation conditionals in `NavSidebar.tsx`/`Home.tsx`/`PlanTab.tsx`/`AssessmentTab.tsx` for human review — it can't reliably judge "is there a fallback," so it warns rather than fails the build.
- Google service account needs domain-wide delegation for `gmail.modify`, `gmail.send`, and `calendar` scopes.
- Patient records and audit logs live in Supabase — the Replit DB is not used.
- **Every new table needs an explicit `grant ... to service_role` (in addition to `authenticated`).** `artifacts/api-server`'s `sb()` client connects as `service_role` — RLS is bypassed for that role, but the underlying table-level GRANT is still checked first, so a missing grant causes `permission denied for table X` (42501) → HTTP 502 on any endpoint touching that table. This bit `patients`, `documents`, `clinical_notes`, etc. (fixed in `supabase-service-role-grants-fix-migration.sql`) — when adding a new migration, grant `service_role` alongside `authenticated` from the start instead of patching it later.
- **A new `.sql` file at the repo root is not "applied" until it's a step in `.github/workflows/run-migrations.yml`.** 44 migration files accumulated over this project's history without ever being wired into the runner — see `migrations/README.md` for the full state (64 now wired, 3 intentionally-excluded reference/snapshot files, 12 excluded because they define conflicting duplicate schemas for the same table name under different files). Add the new step in the same PR as the migration file, every time.
- **Auth model is single-tenant, role-based — not per-patient.** Access control runs on `user_profiles.role` (`front_desk`/`nurse`/`doctor`/`admin`, via the `auth_role()` SQL function), not row ownership. `patients`, `documents`, and `appointment_requests` grant `select` to any authenticated staff member — there is no patient/tenant-scoped RLS policy on these tables. Only `clinical_notes` narrows by status (drafts visible to author + admin only). Don't assume a `provider_id`/`created_by` column implies per-user row isolation is enforced — check the actual policy before relying on one.
- **RLS policy presence on `patients`/`clinical_notes`/`documents`/`appointment_requests` is CI-enforced** via `pnpm --filter @workspace/scripts run lint:rls-policies` (`scripts/src/lint-rls-policies.ts`) — it fails the build if `enable row level security` or any of the known policy names disappears from the migration tree. This is a presence check only, not a live-enforcement test: no test in this repo authenticates as a real non-service_role user, since CI has no Supabase secrets and there's no local/dockerized Supabase to test against. If you intentionally rename or replace a policy, update `REQUIRED_POLICIES` in that script to match — don't just silence the failure. Excludes `supabase-all-migrations-consolidated.sql` (a static historical snapshot) from the scan, since a stale duplicate there would mask a real rename/removal in the live schema file.
- **The `e2e` CI job boots the dashboard and runs `e2e/emr-walkthrough.mjs` against a real browser in every PR.** Unlike the build job's `vite build` (a static compile), this actually executes the app's runtime code — which surfaced a real bug: `VITE_SUPABASE_ANON_KEY` placeholders must be a well-formed 3-segment JWT shape (`eyJ....`.`....`.`....`), or `artifacts/dashboard/src/lib/supabase.ts`'s own config validation rejects it and the Supabase client never constructs, silently stranding the app on the login page. The `e2e` job's placeholder key is intentionally different from the build job's (which is fine as a 2-segment string precisely because it's never executed in a browser). `e2e/emr-walkthrough.mjs` prefers this sandbox's pre-installed Playwright/Chromium when present (interactive/agent runs are unchanged) and falls back to the `playwright` root devDependency + its own managed browser otherwise (installed via `playwright install --with-deps chromium` in CI) — keep both paths in sync if you touch the browser-launch code.

### New Table Checklist

Every `CREATE TABLE` migration MUST include all of the following before being applied:

```sql
-- 1. Enable RLS
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

-- 2. RLS policy for authenticated users
CREATE POLICY "staff access" ON public.<table>
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Table-level grants (BOTH roles required)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table> TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table> TO service_role;

-- 4. FK columns must be NOT NULL if the relationship is required
-- 5. CHECK constraints defined at creation, not patched later
```

Missing any of these produces: 42501 (missing grant) → HTTP 502, silent CHECK rejections, or broken RLS. Use `supabase-seam-fixes-migration.sql` as a reference for the canonical pattern.

**Item 3 (service_role grant) is enforced in CI, not just convention.** `pnpm --filter @workspace/scripts run lint:grants` (`scripts/src/lint-migration-grants.ts`) scans every `supabase*.sql` file at the repo root and fails the build if any table is created without a `grant ... to service_role` somewhere in the tree — the grant doesn't have to be in the same file (some tables in this repo's history were granted retroactively in a separate fix migration, which is fine), it just has to exist. Genuine exceptions can be marked with a trailing `-- lint:allow-missing-service-role-grant` comment on the `CREATE TABLE` line.

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

See `docs/AUDIT-TRAIL-COVERAGE.md` for the audit-log coverage sweep across every mutating API
route: what was fixed (a patient-merge audit bug writing to the wrong table, five AI
document-generation routes with zero coverage), what's confirmed still missing (19
administrative/scheduling route files), and the two parallel audit-logging helpers
(`logAudit()` vs `audit()`) that both exist in this codebase.

See `docs/SECRETS-HYGIENE.md` for the current secrets audit (no real secrets committed — only
the public Supabase anon key is hardcoded in deploy workflows, which is standard practice),
rotation cadence for the highest-blast-radius credentials, and why GitHub secret scanning isn't
enabled on this repo yet (needs a repo admin, not something fixable from inside the codebase).

## Incident response

See `docs/INCIDENT-RUNBOOK.md` for where to look first during an incident (health/readyz
endpoints, Render logs, Sentry) and how to roll back each part of the stack (Vercel frontends,
the Render-hosted API server, a bad migration, a bad cron run) — none of this was written down
before this file existed.

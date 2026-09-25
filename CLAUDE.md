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
- **Mode gate**: All outbound actions (email, SMS, WhatsApp via Twilio/Meta/Telnyx, calendar writes) are gated by `MODE` env var — always start with `dry_run`. The single gate is `artifacts/api-server/src/lib/outbound.ts` (`outboundBlocked()`, `resolveEmailMode()`); every provider call must consult it. An unrecognised `MODE` value fails closed to `dry_run`, and a per-call `sendOrDraft(..., force)` override can tighten the mode or promote a staff-internal alert under `supervised`, but can never lift `dry_run`. Booting with `MODE=auto` requires `CONFIRM_AUTO_MODE=true` or the api-server refuses to start (CI-independent, enforced at boot in `artifacts/api-server/src/index.ts`) — the active mode is also logged as a loud banner on every boot. The front-desk app is a separate deployment with its own copy of the gate, `artifacts/front-desk/lib/outbound.ts` (same fail-closed semantics: an unset, empty or misspelt `MODE` is `dry_run`), consulted by `lib/twilio.ts` (SMS, WhatsApp) and `lib/email.ts`; `test/outbound-mode.test.ts` fails if any other front-desk file reads `process.env.MODE`. The one exception is the inbound `validateTwilioSignature()`, which skips signature checking only when `MODE` is literally `dry_run` — for an inbound check, fail-closed means "validate". Front-desk's own Google Calendar insert (`lib/calendar.ts` `createCalendarEvent`, practice calendar, no attendees) is not MODE-gated.
- **Safety layer**: Every Claude-drafted reply is scanned against `FORBIDDEN_PATTERNS` before sending (`screenOutboundText()` in `lib/outbound.ts`). Forbidden content (fees, diagnoses, drug doses, results, medication-hold instructions) is quarantined for human review — never sent to the patient; recorded as an audit `skip` with the matched rules, and (for the 24h reminder) forwarded to `STAFF_NOTIFY_EMAIL`/`DOCTOR_NOTIFY_EMAIL` as a `[REVIEW REQUIRED]` alert. Static prep templates in `lib/sms.ts` must never tell a patient to take, hold or stop a medicine (hazard H-10) — `src/test/outbound-safety.test.ts` enforces this.
- **AI gate**: Every Anthropic client is created with `createAnthropicClient()` from `lib/ai-gate.ts` (one copy in api-server, one in front-desk). Its request methods refuse to run while `DISABLE_AI=true`, and each route checks `rejectIfAiDisabled(res)` / `isAiEnabled()` first so it degrades gracefully (503 or deterministic fallback) instead of 500ing. `new Anthropic(` anywhere else fails `ai-gate.test.ts` in CI. A new AI route needs both: the gated client and an up-front check with a fallback.
- **Auth flow**: Staff log in via Supabase email/password. `AuthGuard` blocks access until a valid session exists.
- **Vite proxy**: In dev, Supabase requests go through `/sb-proxy` to avoid CORS. Production uses the Supabase URL directly.

## Required env vars

### Frontend (`VITE_` prefix required)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon JWT key (`eyJ…`, ~200+ chars) — **not** the opaque `sb_publishable_…` format |
| `VITE_SENTRY_DSN` | Sentry DSN for dashboard error monitoring (optional). Init options are PHI-safe (`src/lib/sentry.ts` + `src/lib/sentry-scrub.ts`: no default PII, no replay, no request/user/extra, no console or DOM breadcrumbs, tracing off) — don't add `replayIntegration`, `setUser` with an email, or raise `tracesSampleRate` without a compliance review |
| `VITE_IDLE_TIMEOUT_MINUTES` | Dashboard idle auto sign-out, in minutes (default `15`; clamped to 2–120; unset, `0`, negative or non-numeric → 15, so it cannot be switched off). A 60-second "Stay signed in" warning comes first. On expiry the app flushes pending saves and the offline outbox, then signs out this browser only (`scope: 'local'`) and clears PHI from browser storage — or, if unsynced clinical data remains, locks the screen instead of discarding it (`src/components/IdleLock.tsx`, `src/lib/idle-timeout.ts`) |
| `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES` | Same, for the front-desk staff pages (`artifacts/front-desk/app/staff/StaffIdleTimeout.tsx`, set on the front-desk Vercel project). Inlined at build time, so a change needs a redeploy |
| `NEXT_PUBLIC_SITE_URL` | Front-desk canonical public origin (default `https://amisemedical.com`), read only through `artifacts/front-desk/lib/site.ts` `siteUrl()`: sitemap, robots, JSON-LD, `metadataBase` and the `<link rel="canonical">` on every page, so whichever domain (amisemedical.com / amisesuite.com / www / vercel.app) serves a page, search engines see one URL. Set it on the front-desk Vercel project (the deploy workflow no longer overwrites it). Inlined at build time — redeploy after a change. See `docs/DOMAINS.md` |

### Backend

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL (server-side copy) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — never expose to browser |
| `ANTHROPIC_API_KEY` | Claude API key |
| `DISABLE_AI` | `true` switches off **every** Anthropic and OpenAI Whisper call (AI kill switch). Exactly `true` disables; any other value or unset leaves AI on. Read on each call through `lib/ai-gate.ts` (api-server) and `artifacts/front-desk/lib/ai-gate.ts` — set it on **both** Render and the front-desk Vercel project. Routes return 503 `{ disabled: true }` or their deterministic fallback; see `docs/compliance/data-inventory.md` §6 |
| `DISABLE_TRANSCRIPTION` | `true` switches off call transcription only (Whisper and Twilio voicemail transcription), leaving Claude on. `DISABLE_AI=true` implies it |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON of the Google service account |
| `GMAIL_USER` | Gmail address for service account impersonation |
| `CALENDAR_ID_RODNEY_BAY` | Google Calendar ID — Rodney Bay |
| `CALENDAR_ID_TAPION_ERCP` | Google Calendar ID — Tapion/ERCP |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Twilio sender number |
| `SESSION_SECRET` | Express session secret |
| `MODE` | `dry_run` (default) / `supervised` / `auto` |
| `CONFIRM_AUTO_MODE` | Must be `true` for the api-server to boot when `MODE=auto` — a bare `MODE=auto` refuses to start. Prevents a misconfigured environment from going live into unsupervised outbound messaging silently. |
| `REMINDER_EMAIL_AUTO_SEND` | `true` lets the patient 24h reminder email (`/api/cron/reminders`) send directly under `MODE=supervised` instead of being left as a Gmail draft for staff review. Defaults off. Never overrides `MODE=dry_run`, and the body is still `FORBIDDEN_PATTERNS`-screened. Practice-owner opt-in only (hazard H-09). |
| `CRON_SECRET` | Shared secret for cron endpoint auth (`x-cron-secret`). Also accepted as `x-staff-token` only while `STAFF_MACHINE_TOKEN` is unset |
| `STAFF_MACHINE_TOKEN` | Machine-to-machine secret for the `x-staff-token` header on staff routes (`requireStaffAuth()`), sent by front-desk (e.g. questionnaire link provisioning). When set, it is the only value accepted there. When unset, the api-server falls back to `CRON_SECRET` and logs a one-time warning. Set the same value on the api-server (Render) and front-desk (Vercel) together, and use a value different from `CRON_SECRET` |
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
| `SENTRY_DSN` | Sentry DSN for API error monitoring (optional). Init options are PHI-safe (`src/lib/sentry.ts` + `src/lib/sentry-scrub.ts`, the same code as the dashboard scrubber apart from the header comment — a dashboard test fails if they drift): no default PII, no RequestData, no console/HTTP breadcrumbs, no local variables, tracing off |
| `PORTAL_URL` | Front-desk (public website) origin(s) for CORS and patient links. Accepts a comma-separated list (`https://amisemedical.com,https://www.amisemedical.com,https://amisesuite.com,…`): CORS allows every entry, and links sent to patients (SMS, WhatsApp, email, portal invites) use the **first** entry only, via `patientSiteBaseUrl()` in `artifacts/api-server/src/lib/site-urls.ts` (falls back to `FRONTEND_URL`, then the vercel.app address). A single value works as before. See `docs/DOMAINS.md` |
| `DASHBOARD_URL` | Dashboard origin(s) for CORS (comma-separated list accepted) |
| `CLAUDE_MODEL` | Override Claude model (default `claude-haiku-4-5-20251001`) |
| `LOG_LEVEL` | Pino log level (default `info`) |

## Gotchas

- `VITE_SUPABASE_ANON_KEY` must be the JWT anon key (`eyJ…`). The opaque `sb_publishable_…` format is rejected by supabase-js v2 with `AuthUnknownError`.
- The login page has a **connection diagnostics** panel — check it first when auth fails.
- Always start with `MODE=dry_run` and review drafted messages before switching to `supervised` or `auto`. The front-desk app does **not** use `lib/outbound.ts`: `artifacts/front-desk/lib/email.ts` sends unless `MODE` is exactly `dry_run` (unset or misspelt sends), so set `MODE` explicitly on the front-desk Vercel project (compliance G-17).
- **Patient-facing prep and booking text is CI-linted.** `pnpm --filter @workspace/scripts run lint:patient-instructions` (`scripts/src/lint-patient-instructions.ts`) fails on any sentence pairing insulin, a diabetes medicine or a blood thinner with take/hold/stop/adjust/skip, on any fast-from-midnight line, and on a front-desk booking type without an explicit `APPOINTMENT_INSTRUCTIONS` mapping (`artifacts/front-desk/lib/instructions.ts`). The api-server templates (`lib/sms.ts`) are covered by `outbound-safety.test.ts`. The wording follows the surgeon's decisions (hazard H-10); change it only on his instruction, in both places. **Herbal-products carve-out (surgeon decision 2026-09-25, `docs/clinical-validation/SURGEON-DECISIONS.md` I1):** the one approved paragraph telling patients to stop herbal remedies, bush teas and supplements 2 weeks before an operation or a procedure with sedation/anaesthesia (with the reason and circumstances) is allowed, verbatim only, in the procedure sets of `instructions.ts` (`HERBAL_SUPPLEMENTS_STOP`), `lib/sms.ts` (`PREP_HERBAL`) and the dashboard (`HERBAL_PREOP_PATIENT_TEXT` in `supplement-catalogue.ts`); the lint and the test pin all three and still fail any sentence pairing stop with a prescribed medicine. Prescribed medicines are unchanged.
- **`DISABLE_AI=true` is a complete kill switch** for every Anthropic and Whisper call in the api-server and front-desk (see Architecture → AI gate; per-route fallbacks in `docs/compliance/data-inventory.md` §6). It must be set on Render **and** the front-desk Vercel project. iOS AI is off separately (`AIService.swift` throws `AIError.disabled`).
- **The dashboard already imports `@workspace/triage-engine` directly via Vite bundling** (`adaptiveTriage`, `matchPathways`/`usePathway`, `searchMedications`/`useFormulary`, `useSurgicalCatalog`, `useConditionCodes` all resolve to the shared package, not a local copy) — an earlier version of this note claimed otherwise; verified stale and corrected. What's real: two dashboard-local files (`clinical-pathways.ts`'s `DECISION_SUPPORT_PATHWAYS`, `prescription-formulary.ts`'s `INPATIENT_FORMULARY`) cover genuinely different content than their shared-package namesakes (EMR-section-completion guidance vs. differential/red-flag decision support; the full outpatient formulary vs. a smaller inpatient dosing-only subset) but were both exported under the *same* name as the shared package's export (`CLINICAL_PATHWAYS`, `FORMULARY`) — a real footgun (wrong-import risk) rather than genuine data drift, since the two pairs were never meant to hold identical data. Renamed to make the split unambiguous. The interaction-checking safety net (`drug-interactions.ts` / `DrugInteractionAlert.tsx`) is shared across both formularies regardless — confirmed before deciding not to force a data merge, since re-deriving one formulary's dosing text from the other's free-text `commonDoses` strings would risk introducing a real dosing error for a P3 cleanup item.
- **`dx-variants.ts`'s `allowedPhases` correctness is CI-enforced.** `pnpm --filter @workspace/scripts run lint:dx-phases` (`scripts/src/lint-dx-variant-phases.ts`) checks every audited variant's `allowedPhases` against the evidence-based reference table in `.claude/skills/emr-review/SKILL.md`. If you change a variant's phases, update both files together — see the SKILL.md table for why a phase can be clinically correct even when it looks surprising (e.g. `'surgical'` covers endoscopic/interventional procedures, not just open/lap operations). The same script also checks every `DxVariantGroup.diseaseIds` entry against pane-engine's real disease registry (`lib/pane-engine/src/vademecum/specialties/*.ts`) — `detectDxVariants()` matches `diseaseId.startsWith(id)` as its first, fastest signal before falling back to `icdPrefixes`, so a wrong id doesn't error, it just silently never fires. This shipped undetected for the Hernia group (`'hernia_inguinal'` vs the real `'inguinal_hernia'` — reversed word order) until this check was added; every hernia diagnosis was quietly falling through to ICD-only matching. A separate, non-blocking scan (`scan:nav-lockout`) flags newly-added navigation conditionals in `NavSidebar.tsx`/`Home.tsx`/`PlanTab.tsx`/`AssessmentTab.tsx` for human review — it can't reliably judge "is there a fallback," so it warns rather than fails the build.
- **Drug-interaction rules must stay in parity between web and iOS (CI-enforced).** `pnpm --filter @workspace/scripts run lint:interaction-parity` (`scripts/src/lint-interaction-parity.ts`) parses `drug-interactions.ts`/`drug-classes.ts` and `DrugInteractionService.swift`/`DrugClasses.swift` from source and fails if a rule pair exists on one platform and the other can't raise it (the same pair, or a broader class rule whose members contain it), if a term or its member list differs, or if a shared pair's grade differs. The one known grade difference (opioid + benzodiazepine: web contraindicated, iOS major) is in `GRADE_ALLOWLIST` pending a surgeon decision. Add a rule or synonym on both platforms, with the same grade and wording, in the same PR.
- **Lab / imaging report import is deterministic on both platforms, and its analyte catalogue is CI-enforced.** The web port of the iOS parsers lives in `lib/triage-engine/src/report-import` (`@workspace/triage-engine/report-import`; the iOS vectors are ported in `artifacts/dashboard/src/lib/__tests__/report-import-parity.test.ts`). `pnpm --filter @workspace/scripts run lint:report-import-parity` parses `LabAnalyteCatalog.swift` and fails if a saved name, synonym, unit, conversion factor or ambiguous-unit rule differs from `catalog.ts` — change both in the same PR. On the web a lab import is saved as one `investigation_results` row (multi-analyte `analytes`), plus the consultation's `investigationResults` and the encounter's `extractedLabs` (`src/lib/report-import-save.ts`); names a dashboard reader would take for another analyte stay out of `investigationResults` (`src/lib/lab-reader-keywords.ts`, whose test fails when a `numLab()` keyword list is not covered). No AI, no OCR; only nurse/doctor/admin save results, front desk attaches the PDF.
- **Every clinical rule set is registered in `clinical-content/registry.json` (CI-enforced).** `pnpm --filter @workspace/scripts run lint:guideline-registry` fails when a registered path disappears, when a file in its `KNOWN_RULE_SET_FILES` list (the inventory in `docs/CLINICAL-CONTENT-INVENTORY.md`) is not covered by an entry, or when a version stamp disagrees with the registry (`DiagnosticDatabase.json` `"version"`, `rules.ts` `RULES_VERSION`). It only warns about review status (every `lastReviewed` is `"unknown"`: no clinical review is documented yet), about files that look like clinical content but are unregistered, and about `DiagnosticDatabase.json` not decoding with the iOS Codable structs. A new rule set goes into the inventory, the lint's list and the registry in the same PR. Bump a rule set's version together with its stamp and add a `changelog` entry. Don't put a date in `lastReviewed` without a real clinical review and a named reviewer. Upgrade workflow and the Bayesian engine plan are in `docs/CLINICAL-CONTENT-UPGRADES.md`.
- **The website's health-information library publishes only surgeon-approved articles.** Articles live in `artifacts/front-desk/content/health-info.ts`; only `status: 'approved'` ones render at `/health-information` (drafts 404, stay out of the sitemap, and the site links appear only once one is approved); staff preview everything at `/staff/health-information`. Never set `approved`, `lastReviewed` or `reviewedBy` without the surgeon's actual approval. The text is held to `lint:patient-instructions` (no medicine word with an instruction verb, no doses, no fees, no "midnight"), and `lint:guideline-registry` fails an approved article without `lastReviewed`/`reviewedBy`/`reviewDue`/sources and warns once `reviewDue` passes. A wording change bumps the article's `version` and `HEALTH_INFO_LIBRARY_VERSION` with the registry entry, and needs re-approval (`docs/CLINICAL-CONTENT-UPGRADES.md` §9). Don't import the content module from a `'use client'` file (drafts would ship in client JS; a test checks this).
- **iOS `DiagnosticDatabase.json` (2.1.0) decodes and is live content awaiting sign-off.** Before 2.0.0 it failed `CandidateSpec` decoding (non-integer `logLR`/`logPrior`) and the app silently ran the built-in fallback lists. 2.0.0 and later (162+ pools, 1,350+ candidates, 29 complaint `presentations`) decode, and `lint:guideline-registry` now fails if it would not (`scripts/src/diagnostic-database-schema.ts` mirrors the Swift Codable structs; change both together). Routing reads the chief complaint only; displayed percentages divide stored log units by 5; places 4–5 of the five shown are held for the likeliest emergency/critical diagnoses. Settings → Diagnostics shows "Using the database" or "Built-in fallback lists" (`DiagnosticDatabaseInfo.swift`). Weights, priors and citations are listed for surgeon/physician sign-off in `docs/clinical-validation/changes/fix-ios-differential.md` and `ios-last-criticals.md` (2.1.0: NEWS2 boost by urgency tier, post-op day, masking contexts); don't put a `lastReviewed` date on it without that review.
- **Sign-out clears patient data from the browser; unsynced edits are never dropped silently.** `artifacts/dashboard/src/lib/phi-storage.ts` is the inventory of every localStorage/IndexedDB key and whether it holds PHI. `signOut()` (AuthContext → `lib/secure-sign-out.ts`) flushes debounced autosaves and the outbox first, then counts what would be lost (outbox entries, open local follow-up reminders, local referral drafts); if anything remains, a manual sign-out asks "N unsaved changes will be lost — stay signed in to sync?" and the idle timeout locks instead of signing out. PHI keys are cleared only after the session ends. **A new localStorage key holding patient data must be added to `PHI_CACHE_KEYS` (or, if it is the only copy of clinical data, to the local-only counting) in the same PR** — otherwise it survives sign-out. `sign-out-phi.test.ts` covers the rules.
- Google service account needs domain-wide delegation for `gmail.modify`, `gmail.send`, and `calendar` scopes.
- Patient records and audit logs live in Supabase — the Replit DB is not used.
- **Every new table needs an explicit `grant ... to service_role` (in addition to `authenticated`).** `artifacts/api-server`'s `sb()` client connects as `service_role` — RLS is bypassed for that role, but the underlying table-level GRANT is still checked first, so a missing grant causes `permission denied for table X` (42501) → HTTP 502 on any endpoint touching that table. This bit `patients`, `documents`, `clinical_notes`, etc. (fixed in `supabase-service-role-grants-fix-migration.sql`) — when adding a new migration, grant `service_role` alongside `authenticated` from the start instead of patching it later.
- **A new `.sql` file at the repo root is not "applied" until it's a step in `.github/workflows/run-migrations.yml`** — and a wired step is not applied until someone runs that manual workflow. The runner has never completed on production; **Migrations 87–91 (soft delete, NEWS2 Scale 2, staff-only RLS, deferred forward refs, web vitals NEWS2 fields) are wired but not yet applied**, so code that depends on them must tolerate their absence (e.g. iOS falls back when `deleted_at` or `news2_spo2_scale2` is missing; the dashboard falls back when `vitals.avpu`/`on_supplemental_o2` or `news2_spo2_scale2` is missing, `src/lib/vitals-news2-fields.ts`). 44 migration files accumulated over this project's history without ever being wired into the runner — see `migrations/README.md` for the full state (base schema + Migrations 1–93 now wired, 3 intentionally-excluded reference/snapshot files, 12 excluded because they define conflicting duplicate schemas for the same table name under different files — `audit_log` and `patient_problems` are both in that excluded set, which is why `supabase-clinical-audit-trigger-migration.sql` checks `to_regclass()` before attaching anything rather than assuming any of its target tables exist). Add the new step in the same PR as the migration file, every time.
- **`x-staff-token` takes `STAFF_MACHINE_TOKEN`, not `CRON_SECRET`, once it is set.** Until it is set on both Render and front-desk Vercel (same value, same time), `requireStaffAuth()` falls back to `CRON_SECRET` and warns once. Don't reuse `CRON_SECRET` as the value, and don't add a new machine caller that sends `CRON_SECRET` to staff routes (`front-desk/lib/machine-auth.ts` is the pattern).
- **Every wired migration must apply to an empty database and re-run cleanly.** CI runs `pnpm --filter @workspace/scripts run check:migrations-fresh` (`scripts/src/check-migrations-fresh.ts`): every `run-migrations.yml` step, in order, twice, against in-process PGlite with Supabase stand-ins. It fails on a forward reference (using a table, column or function that a later step creates), a non-idempotent statement (use `do $guard$ begin create policy ...; exception when duplicate_object then null; end $guard$;`, since Postgres has no `CREATE POLICY IF NOT EXISTS`), or a policy/grant a re-run would re-open before Migration 89. See `migrations/README.md` → "Fresh-database check".
- **Auth model is single-tenant, role-based — not per-patient.** Access control runs on `user_profiles.role` (`front_desk`/`nurse`/`doctor`/`admin`, via the `auth_role()` SQL function), not row ownership. Once Migration 89 (`supabase-staff-only-rls-migration.sql`, written but not yet applied) runs:
  - Staff policies on PHI tables test `auth_role() in (...)`, not "is authenticated". Portal patients are Supabase Auth users in the same project, and without a staff profile they get only their own-row portal policies.
  - New auth users (including invited portal patients) no longer get an automatic `front_desk` profile. A staff member needs an admin-created `user_profiles` row, or `app_metadata.staff_role` set via the admin API. Until then they can sign in but see nothing. Never set `app_metadata.staff_role` from portal-invite code. Before applying Migration 89, run its pre-flight queries in `migrations/README.md` (real staff without a profile get locked out).
  - Open issue: a front-desk device cannot write `hpi` or insert the pre-visit `clinical_notes` row, so those stay on the iPad (peer sync only) pending a surgeon decision.
  - Any staff role can still read every patient, document and booking (no tenant/patient scoping). Only `clinical_notes` narrows further, by role and status.
  - `patients` UPDATE has column guards (BEFORE UPDATE triggers). Front desk may change admin and patient-reported intake columns only, and a portal patient only their own contact fields. Anything else fails with `42501`. Adding a `patients` column means deciding whether to add it to either allow-list, and keeping iOS `FrontDeskPatientColumns` in step. The service role (API server) bypasses both guards.
  - Don't assume a `provider_id`/`created_by` column implies per-user row isolation is enforced — check the actual policy before relying on one.
- **RLS policy presence on `patients`/`clinical_notes`/`documents`/`appointment_requests` is CI-enforced** via `pnpm --filter @workspace/scripts run lint:rls-policies` (`scripts/src/lint-rls-policies.ts`) — it fails the build if `enable row level security` or any of the known policy names disappears from the migration tree. This is a presence check only, not a live-enforcement test: no test in this repo authenticates as a real non-service_role user, since CI has no Supabase secrets and there's no local/dockerized Supabase to test against. If you intentionally rename or replace a policy, update `REQUIRED_POLICIES` in that script to match — don't just silence the failure. Excludes `supabase-all-migrations-consolidated.sql` (a static historical snapshot) from the scan, since a stale duplicate there would mask a real rename/removal in the live schema file.
- **The `e2e` CI job boots the dashboard and runs `e2e/emr-walkthrough.mjs` against a real browser in every PR.** Unlike the build job's `vite build` (a static compile), this actually executes the app's runtime code — which surfaced a real bug: `VITE_SUPABASE_ANON_KEY` placeholders must be a well-formed 3-segment JWT shape (`eyJ....`.`....`.`....`), or `artifacts/dashboard/src/lib/supabase.ts`'s own config validation rejects it and the Supabase client never constructs, silently stranding the app on the login page. The `e2e` job's placeholder key is intentionally different from the build job's (which is fine as a 2-segment string precisely because it's never executed in a browser). `e2e/emr-walkthrough.mjs` prefers this sandbox's pre-installed Playwright/Chromium when present (interactive/agent runs are unchanged) and falls back to the `playwright` root devDependency + its own managed browser otherwise (installed via `playwright install --with-deps chromium` in CI) — keep both paths in sync if you touch the browser-launch code.
- **iOS sync has hard rules — read the `ios-arch` skill ("Three sync tiers") before touching any `SyncService*`/`PeerSyncService*` file.** In short: a pull never overwrites a record with `pendingSync == true`; `pendingSync` clears only when the server returns the written row and `updatedAt` didn't change mid-request; a 0-row UPDATE is a refusal (`SyncZeroRowUpdate`); a `42501` marks the record refused and the sync carries on (`SyncService+Refusals.swift`); remote ids go through `SyncRemoteId.serverId(_:)` (never send an `appt:` placeholder); child records UPDATE once they have a server id (call `markEdited()`); peer apply never clears `pendingSync`; prescription `route` goes out as `PrescriptionRoute.serverValue`. Front-desk pushes send only `FrontDeskPatientColumns`, which must mirror Migration 89's allow-list.
- **NEWS2 has exactly one engine per platform**, `lib/triage-engine/src/news2.ts` (web, every panel) and `ios/AmiseMedFlow/Services/NEWS2Chart.swift` (iOS). They are twins with the same RCP boundary vectors in `artifacts/dashboard/src/lib/__tests__/news2.test.ts` and `NEWS2Tests.swift`; change both together. SpO₂ Scale 2 is a clinician opt-in only, never inferred from oxygen.
- **`sync-outbox.ts`'s IndexedDB offline write queue was fully built but never wired up.** `enqueue()`/`flush()`/`registerExecutor()`/`pendingCount()` all existed and `SyncStatusIndicator.tsx` polled `pendingCount()` every 10s, but nothing in the app ever called `enqueue()` or `registerExecutor()` — a failed autosave (network blip, backend down) just logged to console and the edit was gone on reload, while the sync badge silently showed nothing because the queue was always empty. Fixed by: `AppContext.tsx`'s `trackedSave()` now takes an optional `{ entityType, entityId, payload }` descriptor and calls `enqueue()` on any save failure (not just `navigator.onLine === false` — that flag only reflects whether a network interface is up, not whether the backend is reachable); all 33 `trackedSave(...)` call sites (both the debounced autosave effect and the page-hide `flushPendingSaves` path) now pass a descriptor; `sync-executors.ts` (new) registers one `registerExecutor()` per entity type that replays the original `db.ts` call from the stored payload when the outbox flushes on reconnect. When adding a new autosaved field, add both the descriptor at its `trackedSave()` call site and a matching executor in `sync-executors.ts` — one without the other means either nothing queues on failure, or queued entries never drain.

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

## Central diagnosis radiation

`workingDiagnosis` (the confirmed diagnosis from `lib/pane-engine`) radiates out to several tabs
as a weak, reactive suggestion — never an auto-applied clinical action. Established pattern:
compute a match against the diagnosis, surface it as a dismissible "Suggested for X" badge or
sort boost, and require an explicit clinician tap before anything is added/printed/billed. See
`BillingTab.tsx` (fee-code suggestion), `SurgicalConsentTab.tsx`/`PerioperativeTab.tsx`
(one-shot text-field seeding, only if still empty), `ScalesTab.tsx` (`CdsContext.workingDiagnosis`
feeds scale suggestions, never scale input values), and `PatientEducationTab.tsx` (handout sheet
sort boost + badge, mirrors `SurgicalConsentTab`'s `DISEASE_ID_TO_TEMPLATE` map for the same
three diagnoses).

Deliberately **not** wired to `workingDiagnosis`: `QualityImprovementTab.tsx` (M&M case logging
is often retrospective and for a different encounter than the one currently active in context —
pre-filling from the *active* chart's diagnosis risks silently mislabelling a case logged for a
different patient) and `DosingTab.tsx` (medication-adjacent — same caution that kept prescription
auto-fill "on-demand, not auto-firing" elsewhere in this codebase; don't let a diagnosis
pre-select which drugs appear).

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

## iOS compile error patterns

Known Swift/SwiftUI type-ambiguity bugs encountered in this codebase — check these first before
attempting other fixes.

### `Color.opacity()` ambiguity (`"Ambiguous use of 'opacity'"`)

`SwiftUI.Color` conforms to BOTH `ShapeStyle` AND `View`. Both protocols define an `opacity`
method with different return types (`some ShapeStyle` vs `some View`). When the compiler cannot
narrow the base type to one conformance, it reports "Ambiguous use of 'opacity'".

**Triggers that cause ambiguity:**
- `Color.red.opacity(0.85)` passed as the single argument to `.background()` — `.background()`
  accepts both `ShapeStyle` and the deprecated `View` overload, so `Color` satisfies both and
  the call is ambiguous.
- `Color.white.opacity(0.9)` passed to `.foregroundStyle()` — even though `foregroundStyle`
  only takes `ShapeStyle`, writing `Color.white.opacity(...)` makes the base type explicitly
  `Color` (both conformances visible), confusing the type-checker in some Xcode versions.

**What does NOT cause ambiguity (safe patterns):**
- `.white.opacity(0.9)` dot-syntax in `.foregroundStyle()` — Swift infers `.white` from the
  `ShapeStyle` context (not from `Color`), making `.opacity()` unambiguous.
- `Color.red.opacity(0.15)` in `.background(_ style: ShapeStyle, in: Shape)` — the two-argument
  form uniquely matches the `ShapeStyle` + `Shape` overload.
- `Color(white: 1, opacity: 0.3)` or `Color(red:green:blue:opacity:)` initializer — avoids
  calling `.opacity()` on `Color` entirely; no ambiguity possible.
- A private helper/property with explicit `-> Color` return type: `private var bg: Color { Color.red.opacity(0.85) }`.
  The `-> Color` annotation forces the compiler to use `Color.opacity()->Color`, unambiguous.
  Use it as `.background { bg }` in call sites.
- `.background { Color.red.opacity(0.85) }` closure form MAY still be ambiguous in some Xcode
  versions even with `@ViewBuilder` — prefer the two patterns above when you get cascades.

**Fix strategy for `.background(Color.X.opacity(...))`:**
Use the `@ViewBuilder` closure form instead of passing the color directly:
```swift
// Before (ambiguous):
.background(Color.red.opacity(0.85))

// After (unambiguous):
.background { Color.red.opacity(0.85) }
```

**Fix strategy for `.foregroundStyle(Color.X.opacity(...))`:**
Revert to dot-syntax so Swift infers the base type from the `ShapeStyle` context:
```swift
// Before (ambiguous — Color is both ShapeStyle and View):
.foregroundStyle(Color.white.opacity(0.9))

// After (unambiguous — dot-syntax lets Swift infer ShapeStyle.white):
.foregroundStyle(.white.opacity(0.9))
```

### Cascade errors from opacity ambiguity

A single unresolved `Color.opacity()` ambiguity inside a `@ViewBuilder` function body causes the
Swift type-checker to fail the entire function scope, generating spurious cascade errors on
unrelated lines — e.g. `"Ambiguous use of 'count'"` on `array.count` in a `.animation(value:)`
modifier in the same function. When you see `"Ambiguous use of 'count'"` (or similar) on an
expression that is clearly unambiguous, look UPWARD in the same `@ViewBuilder` scope for an
unresolved `Color.opacity()` call.

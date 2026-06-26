# Amise MedFlow EMR — Premortem Analysis

**Date:** 2026-06-26
**Scope:** Front-desk (Next.js/Vercel), Dashboard EMR (React+Vite/Vercel), API Server (Express/Render)
**Practice:** Amise Medical Services, Saint Lucia — General and Endoscopic Surgery
**Method:** Structured premortem — "It is six months from now and the system has caused a serious problem. What went wrong?"

---

## 1. Data Loss Scenarios

### 1.1 localStorage Clearing Destroys Remaining Clinical Data

**What fails:** Despite recent persistence work, several clinical data categories still reside solely in the browser's localStorage: attachments (clinical photos stored as base64), billing records, generated documents, and radiology orders. A browser cache clear, incognito mode switch, or iOS Safari storage pressure purge eliminates this data permanently.

**Impact:** Clinical photographs taken during procedures (wound photos, endoscopic images) are lost with no recovery path. On iPad — the primary clinical device — Safari aggressively evicts localStorage under storage pressure, making this a near-certainty over time.

**Likelihood:** HIGH

**Mitigation:**
- Implement Supabase Storage bucket for clinical attachments (table `clinical_attachments` already exists; the storage layer is pending).
- Add a visual indicator showing when data is "local only" versus "saved to server."
- Add a pre-logout warning if unsaved local-only data exists.

---

### 1.2 Autosave Fire-and-Forget — Silent Save Failures

**What fails:** All autosave operations in `AppContext.tsx` use the `void` keyword (fire-and-forget), meaning the return value — including any error — is discarded. If a save fails (network drop, Supabase outage, permission error), the clinician receives absolutely no feedback. The UI continues to display the data as though it were saved. There is no "saving..." indicator, no "unsaved changes" warning, and no retry logic.

Combined with the 2-3 second debounce, if the clinician enters data and closes the browser within the debounce window, the final batch of changes is silently dropped. The `beforeunload` event is not hooked.

**Impact:** Clinical documentation that the clinician believes is persisted may not exist in the database. This creates a dangerous false sense of security — the doctor completes a consultation, documents findings, and moves on to the next patient, unaware that none of the data was saved. In a medicolegal context, the absence of documentation is treated as absence of care.

**Likelihood:** HIGH for the silent-failure aspect (any transient error is invisible); MEDIUM for the debounce-window aspect.

**Mitigation:**
- Stop using `void` for autosave calls — capture the return value and update a centralised `lastSaveError` / `isSaving` state in AppContext.
- Show a persistent "saving..." / "saved" / "save failed" indicator in the dashboard header.
- Implement retry with exponential backoff for failed saves.
- Add a `beforeunload` event listener that flushes any pending debounced save.
- On mobile/iPad, hook into `visibilitychange` and `pagehide` events to trigger immediate flush.
- Show a blocking modal on persistent save failure: "Unable to save — do not close this browser."

---

### 1.3 Supabase Outage During Active Consultation

**What fails:** During a Supabase outage (planned maintenance, regional network issue, or quota exhaustion), all autosave operations fail silently. The dashboard's `db.ts` functions log errors to console but do not show user-facing alerts. The clinician continues documenting, believing data is persisting, when in reality nothing is being saved.

**Impact:** An entire consultation's documentation — assessment, plan, medications, allergies — is lost. The `loadEncounterData` function on next login returns empty fields with no indication that prior data was lost versus never entered.

**Likelihood:** LOW (Supabase has 99.9% uptime) but CATASTROPHIC when it occurs.

**Mitigation:**
- Implement a Supabase health check (ping on an interval) and show a degraded-mode banner when writes fail.
- Queue failed autosave payloads in localStorage as a write-ahead log, and replay them when connectivity returns.
- Alert the clinician immediately on first save failure: "Unable to save to server — data is being held locally. Do not close this browser."

---

### 1.4 Migration Ordering Failure

**What fails:** The system has 25+ migration files with interdependencies documented in `supabase-migration-order.sql`. If migrations are run out of order, or if the `supabase-clinical-persistence-migration.sql` is forgotten, autosave operations fail with "relation does not exist" errors (42P01). These errors are caught silently in the dashboard.

**Impact:** Staff believes clinical persistence is working but all autosave operations fail. Data accumulates only in localStorage, returning the system to its pre-migration state without anyone realising.

**Likelihood:** MEDIUM — migration discipline is manual and relies on a single operator.

**Mitigation:**
- Add a `/api/healthz/schema` endpoint that validates expected tables exist (spot-check `surgical_history`, `operative_notes`, `ros_findings`, `trauma_records`).
- Log migration state on API server startup.
- Include migration verification in the deployment checklist.

---

### 1.5 No Database Backup or Point-in-Time Recovery

**What fails:** The existing backup script (`scripts/export-backup.sh`) only archives source code — not patient data. There is no mechanism to export Supabase data, no `pg_dump` automation, and no point-in-time recovery (PITR) configuration documented.

**Impact:** A catastrophic data event (accidental table drop, Supabase account compromise, rogue migration) results in permanent loss of all patient records, encounters, and clinical documentation.

**Likelihood:** LOW but EXISTENTIAL.

**Mitigation:**
- Enable Supabase PITR (available on Pro plan).
- Create a scheduled `pg_dump` via Supabase CLI or direct connection, stored in an encrypted off-site location.
- Document and test recovery procedures quarterly.

---

## 2. Security and Compliance

### 2.1 RLS Policy on `appointment_requests` is Wide Open

**What fails:** The `appointment_requests` table has the policy `"staff_all" for all using (true)` — every authenticated user (including `front_desk` role) can read, update, and delete any appointment request. Combined with the `anon` role being granted `select, insert, update`, unauthenticated API calls via the Supabase client could potentially read or modify booking data.

**Impact:** Patient PII (names, phone numbers, emails, medical reasons for visit) exposed to any user with a valid anon key. A leaked `VITE_SUPABASE_ANON_KEY` (which is public by design in the browser bundle) could allow enumeration of all appointment requests.

**Likelihood:** HIGH — the anon key is embedded in the frontend JavaScript bundle.

**Mitigation:**
- Restrict `appointment_requests` RLS to authenticated staff only (remove `anon` from grants or add `auth.uid() is not null` check).
- Review all tables for overly permissive RLS policies.
- Audit which tables have grants to `anon` and restrict to the minimum necessary for patient-facing intake forms.

---

### 2.2 Service Role Key Exposure Risk

**What fails:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. It is used by the API server (correct) but must never appear in frontend bundles. If it is accidentally set as `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` or `VITE_SUPABASE_SERVICE_ROLE_KEY`, it ships to every browser.

**Impact:** Full read/write/delete access to every table in the database, including `audit_logs`, `user_profiles`, and patient records. Complete data breach.

**Likelihood:** LOW (current code does not expose it) but the risk is permanent — a single misconfigured environment variable causes total compromise.

**Mitigation:**
- Add a build-time check that fails if any env var containing `SERVICE_ROLE` starts with `VITE_` or `NEXT_PUBLIC_`.
- Monitor Supabase audit logs for service_role access from unexpected IP addresses.
- Rotate the service role key quarterly.

---

### 2.3 CORS Configuration Accepts Broad Vercel Patterns

**What fails:** The API server CORS configuration (`app.ts` lines 73-76) accepts any origin matching `amise*.vercel.app` or the Vercel auto-generated three-word preview pattern (`word-word-word-NN.vercel.app`). Abandoned preview deployments or similarly named projects could make authenticated cross-origin requests.

**Impact:** A third party could deploy a malicious site to a matching Vercel URL and make credentialled API requests if a staff member visits it while authenticated.

**Likelihood:** LOW — requires social engineering plus Vercel naming collision.

**Mitigation:**
- Tighten CORS regex to require the exact Vercel project slug (`amise-medflow-*` or the specific team slug).
- In production, use explicit allowed origins via `PORTAL_URL` and `DASHBOARD_URL` only; disable regex patterns.

---

### 2.4 No Session Expiry or Idle Timeout on Dashboard

**What fails:** The Supabase auth session uses default token refresh behaviour. There is no explicit idle timeout on the dashboard — a clinician who walks away from an iPad in an exam room leaves the full EMR accessible indefinitely.

**Impact:** Unauthorised access to patient records by anyone with physical access to the device (other patients, cleaning staff, visitors).

**Likelihood:** HIGH in a clinical setting — devices are left unattended routinely.

**Mitigation:**
- Implement a 15-minute idle timeout that locks the screen and requires re-authentication.
- Use the `visibilitychange` API to trigger lock on tab switch/minimise.
- Consider biometric unlock (Face ID/Touch ID) for iPad as a convenience alternative to full re-auth.

---

### 2.5 Audit Log Gaps

**What fails:** The `audit_logs` table records actions, but coverage is inconsistent. Direct Supabase writes from the dashboard (autosave operations via `db.ts`) bypass the API server and therefore bypass its audit logging. A clinician modifying a patient's assessment or medication list generates no audit trail.

**Impact:** In a medicolegal dispute, there is no record of who changed what and when for dashboard-originated clinical data. This undermines the clinical record's evidentiary value.

**Likelihood:** HIGH — every autosave operation skips audit logging.

**Mitigation:**
- Add Supabase database triggers (postgres functions) that write to `audit_logs` on INSERT/UPDATE/DELETE for all clinical tables.
- Alternatively, route all dashboard writes through the API server so audit logging is centralised.

---

## 3. Availability and Reliability

### 3.1 Render Cold Starts — API Server Unavailable for 30-60 Seconds

**What fails:** The API server runs on Render's "starter" plan. Render spins down free/starter tier services after inactivity. The first request after spin-down takes 30-60 seconds as the container cold-starts, during which all API calls fail or time out.

**Impact:** Booking confirmations, SMS deliveries, cron jobs, and any dashboard write operation fail during cold start. A patient submitting a booking at 7:00 AM (first activity of the day) gets a timeout error. Cron jobs that hit the API during spin-down silently fail.

**Likelihood:** HIGH — occurs daily after overnight inactivity, and after any period of low traffic.

**Mitigation:**
- Upgrade to a Render plan with "always on" instances, or add a synthetic health check ping every 10 minutes.
- Ensure the GitHub Actions cron workflow (which runs every 30 minutes) effectively keeps the service warm — but verify that its `curl -sf` does not silently absorb cold-start timeouts.
- Increase curl timeout in cron workflow to accommodate cold starts: `curl --max-time 120`.

---

### 3.2 Single Point of Failure — API Server

**What fails:** The API server is a single Express instance on Render. There is no horizontal scaling, no load balancer redundancy, and no failover. If the Render service crashes, restarts, or the underlying infrastructure has issues, all write operations across all three apps stop.

**Impact:** Booking confirmations cannot be sent, SMS reminders do not go out, escalation timers stall, and the doctor cannot approve or complete encounters. The dashboard falls back to read-only mode via direct Supabase queries, but staff cannot act on any booking.

**Likelihood:** MEDIUM — Render has occasional platform incidents.

**Mitigation:**
- Document the degraded-mode experience and train staff on what they can/cannot do when the API is down.
- Consider a critical-path backup: allow the front-desk app to write booking status updates directly to Supabase when the API is unreachable (with a `source: 'fallback'` marker for audit).
- Set up uptime monitoring (e.g., Better Stack, Render health checks) with SMS alerts to staff.

---

### 3.3 Supabase Rate Limits and Connection Pool Exhaustion

**What fails:** The dashboard autosaves across multiple tabs with 2-3 second debounce. If a clinician rapidly switches between tabs, or if multiple clinicians are active simultaneously, the number of concurrent Supabase requests spikes. Supabase's free/pro tier has connection pool limits (typically 50-200 connections). The dashboard uses the `anon` key client, which goes through Supabase's connection pooler (PgBouncer), but each tab autosave creates a new request.

**Impact:** Connection pool exhaustion causes 500 errors on autosave, read queries, and patient lookup — the dashboard becomes unusable for all active users simultaneously.

**Likelihood:** LOW at current scale (single practitioner), MEDIUM if scaled to multiple concurrent clinicians.

**Mitigation:**
- Batch autosave operations: instead of separate saves per tab, queue all pending changes and send a single batch request on a timer.
- Monitor Supabase connection usage via the dashboard metrics.
- Set Supabase project to a plan with adequate pooler limits for projected concurrent users.

---

### 3.4 GitHub Actions Cron Reliability

**What fails:** Cron jobs (reminders, booking reminders, staff escalation, daily summary) run via GitHub Actions scheduled workflows. GitHub Actions has no SLA for schedule accuracy — jobs can be delayed by 5-30 minutes during peak periods, or skipped entirely during incidents.

**Impact:** Patient SMS reminders arrive late or not at all. Staff escalation timers (2h/4h/8h) drift, potentially missing the auto-cancel window. Daily summary emails arrive late.

**Likelihood:** MEDIUM — GitHub Actions schedule delays are well-documented.

**Mitigation:**
- Use a dedicated cron service (cron-job.org, Render Cron Jobs, or Vercel Cron) as the primary trigger, with GitHub Actions as a backup.
- Add monitoring: if the daily summary has not been sent by 07:00 ECT, send an alert.
- Log cron execution timestamps in the `audit_logs` table and alert on gaps.

---

## 4. Clinical Safety

### 4.1 AI Hallucination in Clinical Consultation

**What fails:** The AI Consultant tab sends patient data to Claude and displays structured clinical advice (differential diagnoses, investigations, management approach). Claude may hallucinate drug interactions, invent contraindications, suggest investigations unavailable in Saint Lucia, or recommend procedures outside the practice scope.

**Impact:** If the clinician treats the AI output as authoritative rather than advisory, clinical decisions could be based on fabricated evidence. In a small practice without immediate peer review, a confident but incorrect AI suggestion may not be challenged.

**Likelihood:** MEDIUM — hallucination is inherent to large language models; clinical domains amplify the risk because errors are harder to spot.

**Mitigation:**
- Display a persistent, prominent disclaimer: "AI-generated — verify independently before clinical use."
- Log all AI consultation outputs to `audit_logs` for retrospective review.
- Persist AI consult history per patient so patterns of reliance or correction can be audited.
- Consider adding a "clinician validated" checkbox that must be ticked before the AI output can influence the assessment or plan.

---

### 4.2 FORBIDDEN_PATTERNS Filter Bypass

**What fails:** The `FORBIDDEN_PATTERNS` regex array (defined in both `artifacts/front-desk/lib/constants.ts` and `lib/triage-engine/src/rules.ts`) screens Claude outputs for diagnoses, fees, drug doses, and procedure-prep instructions. However, regexes are brittle — Claude can rephrase to avoid triggers (e.g., "the imaging indicates a mass consistent with..." instead of "you have cancer"), use clinical abbreviations, or provide information in structured formats (tables, bullet points) that the patterns do not match.

Additionally, a critical code path bypass exists: the `/api/soap/polish` endpoint has **no authentication requirement and no rate limit**. If the `ANTHROPIC_API_KEY` environment variable is missing, the system falls back to `buildTemplateSoap()` which returns unfiltered user input, bypassing all forbidden-pattern checks entirely.

**Impact:** A patient receives an automated message containing a diagnosis, test result, medication dose, or fee amount — any of which could cause distress, constitute practising medicine without a consultation, or create legal liability. The unauthenticated SOAP endpoint also represents a cost exposure risk (unconstrained Claude API calls).

**Likelihood:** MEDIUM — language models are creative in their phrasing; the unauthenticated endpoint is HIGH risk.

**Mitigation:**
- Start with `MODE=supervised` (current plan) — all patient-facing messages require staff approval.
- Add authentication and rate limiting to `/api/soap/polish` and `/api/summary/generate`.
- Add a secondary AI safety check: use a second Claude call to classify "does this message contain clinical advice, diagnoses, or fees?" as a defence in depth.
- Periodically red-team the filter with adversarial prompts.
- Never move to `MODE=auto` for patient-facing clinical content.

---

### 4.3 Encounter Data Load — All-or-Nothing Failure

**What fails:** The `loadEncounterData` function in `db.ts` runs two parallel query batches. If any query in the first batch (assessment, plan, allergies, medications) fails, the entire load returns an error and no data. The second batch (surgical history, toxic habits, ROS, procedures, trauma) is never attempted. This means a transient failure on a single table query causes the clinician to see an empty encounter.

**Impact:** Doctor opens a returning patient's record and sees blank fields for all clinical data, despite most data being available in the database. The error toast says "could not fetch encounter" without indicating which specific query failed. The clinician may re-enter data that already exists, creating duplicates, or proceed without historical context.

**Likelihood:** MEDIUM — any transient database query failure triggers this.

**Mitigation:**
- Restructure `loadEncounterData` to return partial results: populate whichever sections succeed and report per-section errors.
- Show section-specific error indicators (e.g., "Allergies: unable to load" rather than "encounter load failed").
- Implement retry for individual failed sections rather than re-fetching everything.

---

### 4.4 Wrong Patient Data Loaded — Cross-Contamination

**What fails:** The dashboard loads patient data based on the selected patient's UUID. If the `loadEncounterData` function fetches data for the wrong encounter (due to a stale patient context, race condition during rapid patient switching, or a UUID mismatch), clinical data from Patient A could appear under Patient B.

**Impact:** Clinician documents findings, prescribes medications, or plans procedures based on another patient's history. This is among the most dangerous categories of clinical error — wrong-patient/wrong-site incidents.

**Likelihood:** LOW but CATASTROPHIC.

**Mitigation:**
- Display patient name, DOB, and MRN prominently on every tab as a verification header — not just in the patient selector.
- Add a server-side validation: `loadEncounterData` should verify that the encounter's `patient_id` matches the requested `patientId`.
- Log every patient context switch in `audit_logs`.
- Implement a "three-point patient check" prompt when switching patients: name, DOB, reason for visit.

---

### 4.5 Triage Engine Desynchronisation

**What fails:** The CLAUDE.md notes that "triage rules in `lib/triage-engine` must stay in sync with the copy in `artifacts/dashboard/src/lib/` until the dashboard imports the shared lib directly." If these diverge, the same symptoms produce different acuity scores on the front-desk intake versus the dashboard.

**Impact:** A patient triaged as "priority" on intake could appear as "routine" on the dashboard, delaying their appointment. Conversely, a routine patient could be flagged as urgent, consuming limited expedited slots.

**Likelihood:** MEDIUM — any code change to one copy without updating the other causes divergence.

**Mitigation:**
- Complete the Vite bundling work to import `lib/triage-engine` directly from the dashboard — eliminate the duplicate.
- Add a build-time or CI check that compares triage rule hashes between the two copies.
- Write integration tests that run the same symptom profiles through both engines and assert identical scores.

---

### 4.6 Emergency Severity Not Reaching 911/ER Redirect

**What fails:** The APCQ triage engine is supposed to flag emergency-severity symptoms and redirect patients to call 911/999 or visit the nearest ER. If the emergency detection logic has a gap (new symptom not covered, unusual phrasing, or a code bug), the patient enters the booking queue instead of being told to seek emergency care.

**Impact:** A patient with an acute emergency (e.g., acute abdomen, GI bleed, bowel obstruction) waits for a clinic booking instead of going to the ER. Delay in emergency care can be life-threatening.

**Likelihood:** LOW — the triage engine is deterministic and well-tested — but the consequence is extreme.

**Mitigation:**
- Maintain a comprehensive emergency symptom registry and test it exhaustively.
- Add an AI urgency floor: if Claude flags a symptom as emergency-level, the deterministic engine's lower rating does not suppress the emergency redirect (this is documented as existing — verify implementation).
- Review the emergency redirect UI quarterly with the clinician to ensure coverage of new scenarios.

---

## 5. Operational

### 5.1 Cron Job Silent Failure

**What fails:** Cron jobs use `curl -sf` (silent, fail-on-error). If the API server returns a 500 or times out, the cron step exits with a non-zero code but there is no alerting mechanism. The GitHub Actions run shows as failed, but nobody is monitoring GitHub Actions dashboards.

**Impact:** Patient reminders stop being sent. Staff escalation timers do not fire. Unactioned bookings are not auto-cancelled. The daily summary email stops. These failures are invisible until a patient complains about not receiving a reminder, or a booking sits unactioned for days.

**Likelihood:** HIGH — cron-server coupling with no alerting is a classic failure mode.

Additional cron-specific risks: the reminder cron has a partial-success bug where if the Twilio SMS send succeeds but the subsequent database UPDATE to set `reminder_sent_at` fails, the SMS will be sent again on the next run. The staff-escalation auto-cancel logic at 8 hours has no idempotency check — if the cron crashes mid-execution and restarts, it may attempt to cancel the same booking twice.

**Mitigation:**
- Add GitHub Actions failure notifications (email or Slack via workflow `on: failure`).
- Implement a "heartbeat" check: if no cron execution is logged in `audit_logs` within the expected window, send an alert via a separate monitoring service.
- Consider a dead man's switch (e.g., Cronitor, Healthchecks.io) that alerts if a ping is not received on schedule.
- Add idempotency checks to cron operations: verify the current status before updating.
- Make SMS send + database update atomic (or at least ordered to fail safely).

---

### 5.2 SMS/Twilio Delivery Failure and Cost Overrun

**What fails:** SMS delivery to Saint Lucia mobile numbers routes through international carrier networks. Delivery is not guaranteed — numbers may be unreachable, carriers may block short-code messages, or Twilio's routing to Digicel/Flow networks may have intermittent issues. There are no per-day or per-patient SMS limits. An escalation loop bug or a batch of bookings could trigger hundreds of SMS messages.

Critically, the SMS send functions in `artifacts/front-desk/lib/twilio.ts` have **no try-catch error handling** — if Twilio API fails, the exception propagates uncaught. There is no message queue, no retry logic, and no deduplication. If the request times out but succeeds server-side, the same message may be sent twice on the next cron run.

**Impact:** Patients do not receive reminders and miss appointments. Alternatively, a runaway loop sends excessive SMS, incurring significant Twilio charges (international SMS to Caribbean destinations costs $0.05-0.15 per message). Failed SMS sends are not retried — the message is simply lost.

**Likelihood:** MEDIUM for delivery failures; LOW for cost overrun but potentially expensive.

**Mitigation:**
- Wrap SMS send functions in try-catch with structured error logging.
- Create an `outbound_sms` table to queue messages with status tracking (queued/sent/failed/delivered).
- Implement SMS delivery status tracking via Twilio status callbacks.
- Add daily SMS send limits (e.g., max 200 per day) with alerting when approaching the threshold.
- Track SMS cost per month and set Twilio spend alerts.
- Implement per-patient rate limits (max 3 SMS per day per number).
- Add idempotency keys to prevent duplicate sends on cron retry.

---

### 5.3 Google Calendar API Quota Exhaustion

**What fails:** Google Calendar API has a per-user quota (typically 1,000,000 queries/day, but per-second limits are 10 QPS for free, 100 QPS for paid). The calendar sync cron runs every 15 minutes. If the cron job or slot lookup function enters a tight loop or retries aggressively, it can exhaust the per-second quota, causing 403 rate limit errors.

**Impact:** Calendar operations fail — the front desk cannot check availability or create events. Bookings must be managed manually until the quota resets.

**Likelihood:** LOW under normal usage; MEDIUM if calendar sync logic has a retry bug.

**Mitigation:**
- Implement exponential backoff on Google API 429/403 responses.
- Cache calendar availability locally (the `calendar-sync` cron already does this — verify the cache TTL is adequate).
- Monitor Google API quota usage via the Google Cloud Console.

---

### 5.4 Gmail API Token Expiry

**What fails:** The Gmail API uses a service account with domain-wide delegation. If the delegation is revoked in Google Workspace admin, if the service account key is rotated without updating `GOOGLE_SERVICE_ACCOUNT_JSON`, or if the impersonated user's account is suspended, all email operations fail.

**Impact:** Email confirmations, referral letters, daily summaries, and document intake processing all stop. The email document intake cron (which processes inbound referrals) silently fails, causing referral letters to be lost.

**Likelihood:** LOW but invisible — email failures may not be noticed for days.

**Mitigation:**
- Add email delivery verification to the `/api/healthz` endpoint: send a test email on startup and verify it succeeds.
- Log email send success/failure in `audit_logs`.
- Set up a Google Workspace alert for service account delegation changes.

---

## 6. User Experience

### 6.1 iPad Safari Compatibility Issues

**What fails:** The primary clinical device is an iPad. Safari on iPadOS has specific behaviours that break common web patterns: aggressive caching, storage pressure eviction of localStorage, different viewport handling, no support for `beforeunload` (unreliable), and aggressive suspension of background tabs.

**Impact:** Clinical data entered in a suspended tab may not autosave. localStorage eviction loses any remaining local-only data. PDF generation and printing may behave differently. Date/time pickers may render differently.

**Likelihood:** HIGH — iPad Safari is a notoriously challenging browser for complex web apps.

**Mitigation:**
- Test all clinical workflows on iPad Safari (not just desktop Chrome).
- Use `visibilitychange` and `pagehide` events instead of `beforeunload` for save-on-exit.
- Prioritise eliminating all localStorage-only data paths.
- Test PDF export/print workflows on iPad specifically.

---

### 6.2 Offline Operation Not Supported

**What fails:** The system has no offline capability. A WiFi drop at the clinic (common in Caribbean infrastructure) renders the entire EMR unusable — no patient lookup, no documentation, no booking management.

**Impact:** Clinical operations halt during connectivity outages. The clinician must revert to paper records, which then need manual transcription when connectivity returns (if it is done at all).

**Likelihood:** MEDIUM — Caribbean internet infrastructure is improving but not yet at First World reliability levels.

**Mitigation:**
- Implement a service worker that caches the current patient's data for offline viewing (read-only).
- Queue writes locally and sync when online (offline-first pattern).
- As a minimum, ensure the current consultation's in-progress data survives a connectivity drop.

---

### 6.3 Concurrent Editing Conflicts

**What fails:** The dashboard uses upsert (last-write-wins) semantics for autosave. If two staff members (e.g., nurse entering vitals and doctor writing assessment) edit the same encounter simultaneously, their saves overwrite each other. There is no optimistic concurrency control (no `updated_at` check, no version counter).

**Impact:** Data entered by one staff member is silently overwritten by another. A nurse's vitals entry could be lost when the doctor's assessment autosave fires, or vice versa.

**Likelihood:** LOW at current scale (single practitioner) but MEDIUM as the practice grows or during busy periods with nurse/doctor overlap.

**Mitigation:**
- Add optimistic concurrency control: include `updated_at` in the WHERE clause of upserts and reject if stale.
- Implement per-field conflict resolution rather than whole-record replacement.
- Show a warning when another user has modified the same record since it was loaded.

---

### 6.4 Slow Initial Load

**What fails:** The dashboard is a single-page React app that loads the entire application on first visit. With 20+ tabs, each importing their own components and libraries, the initial bundle may be substantial. Combined with Supabase auth token validation and patient list fetching, the time from navigation to usable interface could exceed 5-10 seconds.

**Impact:** Clinician frustration during busy clinic hours. Perceived unreliability. Temptation to use alternative (paper) workflows.

**Likelihood:** MEDIUM — depends on bundle size and network conditions in Saint Lucia.

**Mitigation:**
- Implement code splitting: lazy-load tab components on demand.
- Measure and monitor Core Web Vitals (LCP, FID) on the production deployment.
- Pre-fetch critical data (today's patient list) during the auth flow.

---

## 7. Integration

### 7.1 Supabase Schema Drift Across Environments

**What fails:** With 25+ migration files and manual execution via the SQL Editor, there is no migration state tracking. It is possible for production to be missing a migration that staging has, or vice versa. There is no way to programmatically verify which migrations have been applied.

**Impact:** Features that depend on new tables or columns fail in production. Autosave to `surgical_history` works in development but throws "relation does not exist" in production. These errors are caught silently in the dashboard.

**Likelihood:** HIGH — manual migration management without state tracking almost guarantees drift.

**Mitigation:**
- Adopt Supabase CLI migrations or a migration framework (e.g., `dbmate`, `prisma migrate`) with a `schema_migrations` table.
- Add a CI check that compares the expected table inventory against the live database.
- Create a single consolidated migration script (`supabase-all-migrations-consolidated.sql` exists — verify it is complete and use it as the canonical reference).

---

### 7.2 API Server and Front-Desk Version Mismatch

**What fails:** The front-desk app (Vercel) and API server (Render) are deployed independently. A front-desk deployment that expects a new API endpoint will fail if the API server has not been deployed with that endpoint yet. Conversely, an API server change that modifies a response shape breaks the front-desk until it is redeployed.

**Impact:** Booking form submissions fail. Patient portal features break. Error messages are cryptic (network errors, undefined property access).

**Likelihood:** MEDIUM — independent deployments without coordinated releases create this risk on every change.

**Mitigation:**
- Version the API: add an `x-api-version` header and have the front-desk check compatibility on startup.
- Deploy API server first, then front-desk, as standard practice.
- Use API response schema validation on the client side with graceful degradation.

---

### 7.3 Environment Variable Misconfiguration

**What fails:** The system requires 25+ environment variables across three deployment targets (Vercel front-desk, Vercel dashboard, Render API server). A single misconfigured variable causes a silent failure. Known gotchas include: the `VITE_SUPABASE_ANON_KEY` must be a JWT (not the opaque `sb_publishable_` format); calendar IDs in `render.yaml` are currently placeholder values (`amisesuite@gmail.com`); the `PORTAL_URL` and `DASHBOARD_URL` must match actual deployment URLs for CORS.

**Impact:** Auth fails (wrong anon key format). Calendar events go to the wrong calendar or fail entirely. CORS blocks all API requests from the dashboard. SMS sends from the wrong number.

**Likelihood:** HIGH — env var misconfiguration is the most common deployment failure.

**Mitigation:**
- The `/api/healthz` env check endpoint exists — extend it to validate format/connectivity for each integration (Supabase connection, Twilio credentials, Google Calendar access, Anthropic API key).
- Create a deployment checklist with required env vars, expected formats, and test commands.
- Use Render's and Vercel's environment variable groups to reduce duplication.

---

### 7.4 Appointment Request to Questionnaire Linkage Failure

**What fails:** Web intake must link `appointment_requests` to `questionnaire_sessions` via the `questionnaire_session_id` FK. If this linkage is broken (e.g., the questionnaire session is created but the FK is not set on the appointment request), staff cannot view the patient's questionnaire answers from the booking inbox.

**Impact:** Staff reviews a booking request without seeing the patient's symptom history, triage score, or red-flag alerts. Triage decisions are made blind, potentially delaying urgent cases.

**Likelihood:** MEDIUM — the linkage depends on correct client-side orchestration across two API calls.

**Mitigation:**
- Make the linkage atomic: create the appointment request and questionnaire session in a single API transaction.
- Add a dashboard query that identifies orphaned appointment requests (no linked questionnaire session) and flags them for manual review.

---

## 8. Scale

### 8.1 At 100 Patients Per Day

**What fails:** The current architecture handles a single-practitioner surgical practice. At 100 patients/day:
- Patient list queries (`SELECT * FROM patients`) become slow without pagination.
- Autosave from 5+ concurrent clinicians exhausts Supabase connection pooler.
- The booking inbox (which fetches all pending requests) becomes unwieldy.
- SMS sends approach Twilio per-second rate limits.
- Google Calendar event creation serialises on a single calendar.

**Impact:** Dashboard becomes sluggish. Autosave failures increase. Booking management becomes chaotic. SMS delivery delays compound.

**Likelihood:** LOW in the near term (practice currently sees 15-30 patients/day) but relevant for growth planning.

**Mitigation:**
- Add pagination to all list queries (patients, bookings, encounters).
- Implement cursor-based pagination for the booking inbox.
- Use database connection pooling (Supabase PgBouncer is already in place — verify configuration).
- Split calendars by practitioner when adding clinicians.

---

### 8.2 At 1,000 Encounters

**What fails:** The `encounters` table grows linearly. The `loadEncounterData` function fetches data based on `encounter_id` with indexed lookups, which should remain performant. However, the patient search and encounter history views do not paginate — loading a patient with 50+ encounters fetches all of them.

**Impact:** Slow patient profile loading. Clinician waits 5+ seconds to see a returning patient's history. Browser memory usage increases with large encounter histories.

**Likelihood:** MEDIUM — a regular surgical follow-up patient could accumulate 50+ encounters within 2-3 years.

**Mitigation:**
- Paginate encounter history (show last 10, load more on demand).
- Add a summary view for long-term patients that shows trends rather than raw encounter lists.
- Index encounter queries on `(patient_id, encounter_date DESC)` — this index already exists.

---

### 8.3 At 50 Concurrent Users

**What fails:** The dashboard authenticates via Supabase Auth (JWT tokens). At 50 concurrent users, each performing autosave every 2-3 seconds:
- Supabase realtime subscriptions (if used) consume connection slots.
- The API server (single instance on Render starter plan) processes requests sequentially on its event loop. CPU-intensive operations (Claude API calls, PDF generation) block the event loop.
- Express rate limiters are per-IP — behind a shared office NAT, all staff share the same rate limit bucket.

**Impact:** API timeouts. Autosave failures. Rate limiting blocks legitimate staff requests. AI consultation requests queue behind each other.

**Likelihood:** LOW in the near term but relevant if the practice expands or the system is adopted by other practices.

**Mitigation:**
- Move rate limiting to per-user (JWT-based) rather than per-IP.
- Use worker threads or a job queue (e.g., BullMQ) for CPU-intensive operations (Claude API calls, PDF generation).
- Scale to multiple Render instances with a load balancer.
- Profile the event loop under load to identify blocking operations.

---

## 9. Disaster Recovery

### 9.1 Supabase Account Compromise

**What fails:** A compromised Supabase account (via phished credentials, leaked service role key, or Supabase platform breach) gives an attacker full access to all patient data, the ability to modify or delete records, and the ability to impersonate any user.

**Impact:** Complete patient data breach. Regulatory exposure. Reputational damage. Potential clinical harm if records are modified.

**Likelihood:** LOW but the consequence is total.

**Mitigation:**
- Enable MFA on the Supabase dashboard account.
- Restrict service role key usage to the API server's IP range (if supported).
- Enable Supabase audit logging for all DDL and admin operations.
- Maintain encrypted off-site backups that would survive a Supabase compromise.
- Have an incident response plan documented and rehearsed.

---

### 9.2 Render Platform Outage

**What fails:** Render experiences a full platform outage. The API server is unavailable, all cron jobs fail, and the dashboard enters degraded read-only mode.

**Impact:** No new bookings can be confirmed. No SMS or email can be sent. Escalation timers stall. Clinical documentation continues (autosave goes directly to Supabase) but workflow actions halt.

**Likelihood:** LOW — Render has had multi-hour outages in the past.

**Mitigation:**
- Document the degraded-mode workflow: what staff can and cannot do when the API is down.
- Pre-position a backup API deployment on an alternative platform (Vercel serverless functions, Railway, or Fly.io) that can be activated manually.
- Ensure the dashboard's Supabase fallback mode is tested and functional.

---

## 10. Prioritised Action List — Top 10 Before Go-Live

| Priority | Action | Category | Effort | Risk Addressed |
|----------|--------|----------|--------|----------------|
| **1** | Run all pending Supabase migrations and verify table existence via `/api/healthz` | Integration | Low | Silent autosave failures (1.4), schema drift (7.1) |
| **2** | Implement idle-timeout screen lock (15 min) on the dashboard | Security | Medium | Unattended device access in clinic (2.4) |
| **3** | Fix `appointment_requests` RLS — remove `anon` grants, restrict to authenticated staff | Security | Low | Patient PII exposure via public anon key (2.1) |
| **4** | Add `beforeunload`/`pagehide`/`visibilitychange` flush for autosave debounce | Data Loss | Low | Data loss on abrupt close or iPad sleep (1.2) |
| **5** | Set up cron failure alerting (GitHub Actions `on: failure` notification + dead man's switch) | Operational | Low | Silent cron failures (5.1) |
| **6** | Enable Supabase PITR and configure automated `pg_dump` backups | Data Loss | Medium | No backup recovery path (1.5) |
| **7** | Add Supabase DB triggers for audit logging on all clinical tables | Security | Medium | Audit trail gaps for dashboard-originated writes (2.5) |
| **8** | Implement Supabase Storage bucket for clinical attachments | Data Loss | Medium | Photo/image data loss from localStorage (1.1) |
| **9** | Add API server uptime monitoring with SMS alert to staff | Availability | Low | Undetected API outages (3.1, 3.2) |
| **10** | Test all clinical workflows on iPad Safari and fix identified issues | UX | Medium | iPad-specific failures in primary clinical device (6.1) |

---

## Conclusion

The Amise MedFlow EMR has a solid architectural foundation — safety gates, multi-channel intake, escalation cascades, and MODE gating are well-designed. The most pressing risks cluster around **data persistence reliability** (autosave edge cases, migration state, backup gaps), **physical security** (idle timeout on clinical devices), and **operational visibility** (cron monitoring, API uptime alerting). The system should enter production with `MODE=supervised` and `SMS_PROVIDER=dry_run` initially, graduating to live delivery only after the top 10 actions above have been addressed and verified in situ at the Rodney Bay and Castries sites.

---

*Analysis conducted against the full codebase as of 2026-06-26. Next review recommended after the first two weeks of clinical use.*

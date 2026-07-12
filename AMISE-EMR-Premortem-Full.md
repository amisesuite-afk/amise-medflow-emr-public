# Amise MedFlow EMR + Front-Desk Portal — Full System Premortem

**Date:** 2026-06-28 | **Scope:** EMR Dashboard, Front-Desk Portal, API Server, Database Layer
**Purpose:** Identify every failure mode that could block or degrade a production launch. Prioritised for action.

---

## Severity Key

| Tier | Meaning | Action |
|------|---------|--------|
| **P0 — BLOCKER** | Will cause data loss, security breach, or complete service failure | Must fix before go-live |
| **P1 — CRITICAL** | High probability of user-facing failure or clinical safety risk | Fix in first sprint |
| **P2 — HIGH** | Degrades reliability or UX significantly under real load | Fix within 2 weeks |
| **P3 — MEDIUM** | Best-practice gap; acceptable short-term risk | Track and schedule |
| **P4 — LOW** | Polish, docs, minor hardening | Backlog |

---

## P0 — BLOCKERS (11 items)

### 1. Exposed Supabase Anon Key in Git History
**Component:** Front-Desk Portal
**File:** `artifacts/front-desk/.env.local.example` (lines 6-7)

A real, valid JWT anon key (`eyJhbGci…`) is committed to the repository. Anyone with repo access can use it to query the Supabase project directly.

**Impact:** Unauthorised read/write access to patient data via Supabase REST API.
**Mitigation:**
- Rotate the Supabase anon key immediately in the Supabase dashboard
- Scrub from git history with `git filter-repo` or BFG
- Replace with placeholder `your-anon-key-here` in the example file

---

### 2. TOCTOU Race Condition on Appointment Slot Booking
**Component:** API Server
**File:** `artifacts/api-server/src/routes/booking.ts` (lines 158-171)

The conflict check (`SELECT … WHERE confirmed_slot = X`) and the subsequent `UPDATE` are two separate queries. Two concurrent requests can both pass the check and book the same slot.

**Impact:** Double-booked appointments; two Google Calendar events created, only one stored.
**Mitigation:**
- Add a `UNIQUE` partial index: `CREATE UNIQUE INDEX ON appointment_requests(confirmed_slot) WHERE status IN ('staff_confirmed','patient_confirmed')`
- Catch the unique violation in app code and return 409

---

### 3. No React Error Boundary — White-Screen Crash
**Component:** EMR Dashboard
**File:** No ErrorBoundary exists anywhere in `artifacts/dashboard/src/`

If any tab component throws during render (malformed JSON from Supabase, undefined property access), the entire app crashes to a blank white screen. All unsaved work is lost.

**Impact:** Complete app failure; clinician loses encounter data mid-consultation.
**Mitigation:**
- Add a root-level `<ErrorBoundary>` wrapping `<AppProvider>` children
- Add per-tab error boundaries with "Something went wrong — click to retry" fallback
- Log caught errors to Sentry

---

### 4. Save Race Condition — Data Written to Wrong Patient
**Component:** EMR Dashboard
**File:** `artifacts/dashboard/src/context/AppContext.tsx` (lines 619-651, 795-848)

`clearPatient()` resets all state immediately, but in-flight `trackedSave()` calls still hold stale `patientId`/`encounterId` in their closures. If a new patient is loaded before pending saves complete, clinical data can be written to the wrong patient record.

**Impact:** Clinical data corruption — medication list from Patient A saved to Patient B's encounter.
**Mitigation:**
- Add a generation/epoch counter incremented on `clearPatient()`
- Pass the epoch into `trackedSave()`; abort if epoch has changed when the save resolves
- Cancel all pending debounce timers in `clearPatient()` before clearing state

---

### 5. WhatsApp Webhook Accepts Unauthenticated Requests
**Component:** API Server
**File:** `artifacts/api-server/src/routes/whatsapp.ts` (lines 69-91)

Twilio signature validation is conditional: `if (sig && token)`. If the `x-twilio-signature` header is omitted, the request is accepted without any authentication. An attacker can forge inbound WhatsApp messages to create fake booking requests.

**Impact:** Fake appointments injected into the booking queue; staff wastes time on non-existent patients.
**Mitigation:**
- Require `TWILIO_AUTH_TOKEN` at startup; refuse to register the route without it
- Reject requests where `x-twilio-signature` is missing (not just invalid)

---

### 6. Questionnaire Session Tokens Never Expire
**Component:** API Server
**File:** `artifacts/api-server/src/routes/questionnaire.ts` (line 1557+)

Session tokens (32-char hex) are generated for anonymous questionnaire access but have no TTL enforcement. A leaked token grants indefinite access to patient intake data.

**Impact:** PHI exposure if a questionnaire link is forwarded or cached.
**Mitigation:**
- Add `expires_at` column (migration exists: `supabase-questionnaire-token-expiry-migration.sql`) and enforce it in the session lookup query
- Default TTL: 72 hours
- Return 410 Gone for expired tokens

---

### 7. Silent Failure When CRON_SECRET / API_SERVER_URL Missing
**Component:** Front-Desk Portal
**Files:** `artifacts/front-desk/app/api/booking/create/route.ts` (lines 26-40), `app/api/intake/submit/route.ts` (line 132)

If `CRON_SECRET` is not set, questionnaire links are silently omitted from booking confirmations. If `API_SERVER_URL` is not set, red-flag alerts are never sent to staff. No error is logged or shown.

**Impact:** Patients never receive pre-visit questionnaires; emergency red flags are silently swallowed.
**Mitigation:**
- Validate all required env vars at app startup; fail fast with clear error message
- Log a warning on every request where a critical var is missing
- Add startup health check endpoint that reports missing configuration

---

### 8. N+1 Query Pattern in Cron Jobs — Timeout Cascade
**Component:** API Server
**File:** `artifacts/api-server/src/routes/cron.ts` (lines 36-81, 251-360)

Appointment reminder and escalation loops execute one `UPDATE` + one `audit()` INSERT per row, sequentially. With 100 pending bookings, that's 200+ sequential DB calls. The Express server timeout is 120s (index.ts line 50).

**Impact:** Cron job times out; no reminders sent; escalation emails never fire; patients no-show.
**Mitigation:**
- Batch updates: `UPDATE … WHERE id IN (…)` with a single query
- Batch audit inserts with a single multi-row INSERT
- Add a circuit breaker: if >50 items, process in chunks with partial commit

---

### 9. localStorage Quota Exhaustion — Silent Data Loss
**Component:** EMR Dashboard
**File:** `artifacts/dashboard/src/context/AppContext.tsx` (lines 560-603)

State is serialized to localStorage every 500ms. All `setItem()` calls are wrapped in `try/catch { /* ignore */ }`. On mobile devices (5-10 MB quota), clinical photos or large attachment data URLs will exceed quota silently. The user sees no warning; next session loads stale data.

**Impact:** Patient data loss after browser restart; clinician unaware data was not persisted.
**Mitigation:**
- Check `navigator.storage.estimate()` on mount and warn if <1 MB free
- Show a toast notification if any `localStorage.setItem()` throws
- Move large blobs (photos, attachments) to IndexedDB or upload to Supabase Storage immediately

---

### 10. Auto Mode Sends to Unverified Email Addresses
**Component:** API Server
**File:** `artifacts/api-server/src/routes/intake.ts` (lines 47-79)

When `MODE=auto`, the intake pipeline sends Claude-drafted replies directly to the `From:` address of incoming emails. A spoofed `From:` header causes patient confirmations to be sent to an attacker's email.

**Impact:** PHI leakage (patient name, appointment details) to arbitrary email addresses.
**Mitigation:**
- Never auto-send on first contact; require at least one prior verified exchange
- Add a whitelist of known patient email domains
- Default intake routes to `supervised` mode even when global MODE is `auto`

---

### 11. No Auth on Patient Confirmation Endpoint
**Component:** API Server
**File:** `artifacts/api-server/src/routes/booking.ts` (lines 222-271)

`POST /api/booking/patient-confirm/:id` has no authentication. Anyone who guesses or intercepts a booking UUID can confirm an appointment on behalf of a patient, creating a Google Calendar event.

**Impact:** Fake confirmations; calendar pollution; real patient's slot consumed.
**Mitigation:**
- Require a confirmation token (sent via SMS/email) in the request body
- Validate token matches the one stored on the booking row
- Rate-limit by IP

---

## P1 — CRITICAL (12 items)

### 12. No Token Refresh Retry in Dashboard
**File:** `artifacts/dashboard/src/context/AuthContext.tsx` (lines 72-82), `lib/staff-auth.ts`

Supabase `autoRefreshToken` is enabled but there's no handling for refresh failures. `staffAuthHeaders()` fetches the access token without checking staleness. A 55-minute-old token will expire mid-flight.

**Mitigation:** Wrap `staffAuthHeaders()` in retry logic that calls `supabase.auth.refreshSession()` on 401.

### 13. Gmail API Failure Blocks Entire Intake Pipeline
**File:** `artifacts/api-server/src/routes/intake.ts` (lines 23-29), `lib/gmail.ts` (lines 170-193)

A single Gmail outage blocks all intake processing. No retry, no circuit breaker, no fallback to draft-only mode.

**Mitigation:** Add exponential retry (3 attempts, 2s/4s/8s); fall back to `draft` on persistent failure; alert staff.

### 14. Claude AI Timeout Hangs Intake Loop
**File:** `artifacts/api-server/src/routes/intake.ts` (line 34)

`classifyMessage()` has no timeout override. If Claude is slow (30s+), the entire intake cron hangs on one message; all subsequent messages are never processed.

**Mitigation:** Set `timeout: 15000` on Anthropic SDK calls; skip message on timeout; process remaining.

### 15. Cron Reminder Not Idempotent — Duplicate SMS
**File:** `artifacts/api-server/src/routes/cron.ts` (lines 51-56)

SMS is sent before `reminder_sent_at` is updated. If the update fails, the next cron run sends the reminder again.

**Mitigation:** Set `reminder_sent_at` first (optimistic), then send SMS. If SMS fails, clear the flag.

### 16. Non-Atomic Multi-Table Writes in Visit Lifecycle
**File:** `artifacts/api-server/src/routes/visit-lifecycle.ts` (lines 240-251)

Medication upserts loop individually. If iteration 5/10 fails, medications 1-4 are committed but the encounter status update never runs.

**Mitigation:** Wrap in a Supabase RPC function or use `Promise.allSettled()` with rollback on any failure.

### 17. Rate Limiting is Single-Instance / In-Memory Only
**File:** `artifacts/front-desk/lib/rate-limit.ts`

`new Map<string, number[]>()` resets on every cold start and is not shared across serverless instances. On Vercel, each function instance has its own counters.

**Mitigation:** Migrate to Upstash Redis rate limiting or Vercel Edge Middleware rate limiting.

### 18. Forbidden Content Patterns Are Regex-Only — Semantic Bypass
**File:** `lib/triage-engine/src/rules.ts` (lines 174-194)

Patterns catch `$50`, `10 mg`, etc. but Claude can output "FIFTY DOLLARS" or "TEN MILLIGRAMS" in words to evade numeric patterns.

**Mitigation:** Add a secondary AI validation pass: re-prompt Claude "Does this text contain fees, doses, or diagnoses? YES/NO" before sending.

### 19. SMS Dedup Map In-Memory Only
**File:** `artifacts/api-server/src/lib/sms.ts` (lines 24-50)

`recentSends` Map resets on process restart. If the API server restarts mid-cron, duplicate SMS is sent.

**Mitigation:** Move dedup tracking to Supabase (column `last_sms_sent_at` on `appointment_requests`).

### 20. No Input Validation (Zod) on Most API Routes
**Files:** `artifacts/api-server/src/routes/booking.ts` (lines 47-52), `portal.ts`, `visit-lifecycle.ts`

`patient_name`, `reason`, `preferred_slot` pass through as raw strings with no length limit, format validation, or sanitisation.

**Mitigation:** Add Zod schemas to all POST/PUT endpoints. Reject payloads >10 KB. Sanitise text fields.

### 21. Missing Database Indexes on Hot Query Paths
**File:** `supabase-schema.sql`

Missing indexes on:
- `appointment_requests(confirmed_slot, status)` — used in every booking confirmation
- `audit_logs(action, created_at)` — daily summary scans entire table
- `appointment_requests(created_at, status)` — escalation query

**Mitigation:** Add partial indexes; test with `EXPLAIN ANALYZE`.

### 22. Google Calendar maxResults=500 Can Miss Busy Slots
**File:** `artifacts/api-server/src/lib/calendar.ts` (lines 68-90)

If >500 events exist in the query window, the API silently truncates. The system thinks a slot is free when it's actually booked.

**Mitigation:** Use pagination (`nextPageToken`) or narrow the time window.

### 23. Kiosk SessionStorage Leaks Previous Patient Data
**File:** `artifacts/front-desk/app/intake/page.tsx` (lines 329-361)

Patient health data is stored in `sessionStorage`. On shared kiosks, the previous patient's symptoms, medications, and red flags are recoverable by the next user.

**Mitigation:** Clear `sessionStorage` on page load (not just on component mount). Add a "Start New Session" button.

---

## P2 — HIGH (14 items)

### 24. No Supabase Downtime Fallback in Front-Desk Intake
**File:** `artifacts/front-desk/app/api/intake/submit/route.ts` (lines 22-26)

If Supabase is unreachable, intake submission returns 503. Booking data is lost — no queue, no retry.

**Mitigation:** Queue failed submissions to a local file or in-memory buffer; retry on next cron tick.

### 25. Concurrent `trackedSave()` Calls Race on Status
**File:** `artifacts/dashboard/src/context/AppContext.tsx` (lines 689-700)

Lines 699-700 fire assessment, plan, and medications saves simultaneously. The `pendingSaves` counter tracks them, but if save #2 fails while #1 succeeds, `saveStatus` shows 'error' briefly then flips to 'saved' when #3 completes.

**Mitigation:** Use `Promise.allSettled()` for grouped saves; only show 'saved' when all in a batch succeed.

### 26. Phone Validation Too Permissive
**Files:** `artifacts/front-desk/app/intake/page.tsx` (lines 38-40), `artifacts/dashboard/src/lib/db.ts`

Accepts any 7-15 digit number. Invalid numbers (e.g., `1234567`) get stored; SMS/WhatsApp delivery fails silently.

**Mitigation:** Require 10+ digits; validate against E.164 format.

### 27. Email Validation Too Loose
**Files:** `artifacts/front-desk/app/intake/page.tsx` (lines 43-45), `app/book/BookingForm.tsx` (lines 347-349)

Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` allows `a@b.c`. No typo detection.

**Mitigation:** Use Zod `.email()` or a stricter regex; consider "did you mean gmail.com?" suggestions.

### 28. No Timeout on Upstream API Calls
**Files:** `artifacts/front-desk/app/api/booking/create/route.ts` (line 152), `app/questionnaire/[token]/page.tsx` (lines 454-506)

`fetch()` calls to the API server have no explicit timeout. If the API hangs, the serverless function hangs until Vercel's 10s/30s limit.

**Mitigation:** Use `AbortController` with 5-second timeout on all upstream fetches.

### 29. WheelPicker Touch Conflicts on iPad
**File:** `artifacts/dashboard/src/components/WheelPicker.tsx` (lines 99-102)

Non-passive `wheel` listener may interfere with iPad OS gestures. Number items are text-selectable, breaking the drag UX.

**Mitigation:** Add `user-select: none` to wheel items; test on real iPad hardware.

### 30. Z-Index Conflicts Between Dropdowns and Dialogs
**File:** `artifacts/dashboard/src/components/ui/dialog.tsx` (lines 22, 39)

Both dialog overlay and IntakeTab dropdowns use `z-index: 50`. If a dropdown is open when a dialog appears, they overlap unpredictably.

**Mitigation:** Audit all z-index values; use a layered scale (dropdowns: 40, dialogs: 50, toasts: 60).

### 31. DOB Not Validated Before Save
**Files:** `artifacts/front-desk/app/intake/page.tsx` (lines 808-812), `artifacts/dashboard/src/lib/db.ts`

Date of birth accepts future dates, nonsense dates, and has no age range check.

**Mitigation:** Validate DOB is in the past and age is 0-120 years.

### 32. Sentry Not Configured = Zero Error Visibility
**File:** `artifacts/api-server/src/index.ts` (lines 5-11)

Sentry only initialises if `SENTRY_DSN` is set. A production deploy without it means zero visibility into errors.

**Mitigation:** Make `SENTRY_DSN` required for production; log a startup warning if missing.

### 33. Audit Log Writes Silently Swallowed
**File:** `artifacts/api-server/src/lib/supabase.ts` (lines 67-88)

`audit()` catches errors and only logs them. If the audit table is unreachable, there's no way to know audit logging is down.

**Mitigation:** Add a health check that verifies audit writes; alert if audit fails >3 times in 5 minutes.

### 34. Hardcoded API Fallback URL
**File:** `artifacts/dashboard/src/lib/api-origin.ts`

Falls back to `https://amise-medflow-api.onrender.com` in production. If this URL becomes stale, the dashboard silently uses the wrong API server.

**Mitigation:** Remove hardcoded fallback; require `VITE_API_URL` to be set explicitly.

### 35. clearPatient() Doesn't Cancel Debounce Timers
**File:** `artifacts/dashboard/src/context/AppContext.tsx` (lines 619-651)

`clearPatient()` clears state but doesn't cancel the 8 debounce timer refs. A timer that fires after clear will attempt to save empty data to the old patient ID.

**Mitigation:** Clear all `*TimerRef.current` values in `clearPatient()` with `clearTimeout()`.

### 36. WhatsApp + SMS Double-Send on Partial Failure
**File:** `artifacts/api-server/src/lib/sms.ts` (lines 62-92)

If WhatsApp send returns an error after partial delivery, the fallback sends the same message via SMS. Patient receives it twice.

**Mitigation:** Check WhatsApp delivery status before falling back; add a 30s delay for SMS fallback.

### 37. Red Flag Emergency Redirect Can Be Bypassed
**File:** `artifacts/front-desk/app/intake/page.tsx` (lines 431-442)

When emergency symptoms are detected, the patient sees a redirect screen but can click "Continue questionnaire" and ignore it.

**Mitigation:** Remove the "Continue" button after emergency detection; require explicit acknowledgement.

---

## P3 — MEDIUM (10 items)

### 38. Token Entropy Inconsistency
**Files:** `artifacts/front-desk/app/questionnaire/page.tsx` (line 82) vs `app/intake/page.tsx` (line 402)

Some tokens use `randomBytes(16)` (128 bits), others use `crypto.randomUUID()` (122 bits). Inconsistent but not exploitable.

**Mitigation:** Standardise on `randomBytes(16).toString('hex')` everywhere.

### 39. No CSRF Protection on Front-Desk POST Endpoints
**Files:** `artifacts/front-desk/app/api/intake/submit/route.ts`, `app/api/booking/create/route.ts`

No CSRF tokens validated. Next.js provides some protection via SameSite cookies, but it's not explicitly configured.

**Mitigation:** Add explicit CSRF token validation or verify Origin header.

### 40. Missing Accessibility Labels on WheelPicker
**File:** `artifacts/dashboard/src/components/WheelPicker.tsx`

No `aria-label`, `role="spinbutton"`, or `aria-valuemin`/`aria-valuemax`. Screen reader users cannot interact with vitals entry.

**Mitigation:** Add ARIA attributes: `role="spinbutton"`, `aria-valuenow`, `aria-label`.

### 41. Inconsistent Error Return Types in db.ts
**File:** `artifacts/dashboard/src/lib/db.ts`

Some functions return `{ error: string | null }`, others `{ patient: T | null; error: string }`. No consistent `Result<T>` type.

**Mitigation:** Define `type DbResult<T> = { data: T; error: null } | { data: null; error: string }`.

### 42. No Analytics on Intake Dropoff
**Component:** Front-Desk Portal

No telemetry on which screen patients abandon intake. If 80% drop at "medication list", no one knows.

**Mitigation:** Add anonymous funnel tracking (PostHog/Segment) — screen transitions only, no PHI.

### 43. Supervised Mode Drafts Pile Up Without Review Queue
**File:** `artifacts/api-server/src/lib/gmail.ts` (lines 174-189)

In `supervised` mode, messages are drafted but never surfaced to staff in a review queue. Drafts accumulate indefinitely.

**Mitigation:** Build a review queue UI in the dashboard or send a daily digest of pending drafts.

### 44. Forbidden Patterns Missing Procedure Scheduling Changes
**File:** `lib/triage-engine/src/rules.ts` (lines 174-194)

No pattern catches "Cancel your colonoscopy" or "Stop taking warfarin". Generic medication names are not flagged.

**Mitigation:** Add patterns for procedure verbs (`cancel`, `reschedule`, `stop`) and a medication name dictionary.

### 45. Request Body Size Limit Too Large
**File:** `artifacts/api-server/src/app.ts` (line 81)

`express.json({ limit: '10mb' })` allows very large payloads. Combined with Pino request logging, this can cause I/O spikes.

**Mitigation:** Reduce to `1mb` for most routes; use a separate limit for file upload endpoints.

### 46. Service Role Key Leak = Full DB Access
**File:** `supabase-schema.sql` (lines 460-475)

The API server uses `service_role` which bypasses all RLS. If the key leaks, an attacker has unrestricted access to every table.

**Mitigation:** Rotate keys quarterly; restrict service_role grants to only tables the API actually needs; add IP allowlist in Supabase.

### 47. Procedure Prep Instructions Sent in Plaintext SMS
**File:** `artifacts/api-server/src/lib/sms.ts` (lines 108-159)

Clinical prep instructions (bowel prep, medication holds) are sent via unencrypted SMS. Twilio logs SMS content in plaintext.

**Mitigation:** Send a link to a secure portal page instead of inline instructions; add SMS content retention policy.

---

## P4 — LOW (5 items)

### 48. TypeScript Unsafe Casts in IntakeTab
**File:** `artifacts/dashboard/src/pages/tabs/IntakeTab.tsx` (lines 175, 191-192)

Multiple `as string`, `as unknown[]` casts that could silently fail if data shape changes.

### 49. CORS Documentation Missing
**File:** `artifacts/dashboard/src/lib/supabase.ts` (lines 78-82)

Comment says "Supabase sets permissive CORS" but the API server CORS setup is not documented for production.

### 50. No Mobile-First Accessibility Audit
**Component:** Front-Desk Portal

Intake form uses inline CSS with fixed font sizes. Not verified on real mobile devices.

### 51. Google OAuth Credentials Stored as Env Var JSON
**File:** `artifacts/front-desk/lib/email.ts` (lines 28-39)

`GOOGLE_SERVICE_ACCOUNT_JSON` stored as a single env var. No rotation mechanism.

### 52. No Backup Strategy for Supabase Data
No documented backup/restore procedure. Supabase has automatic backups on Pro plan, but no tested restore runbook.

---

## Prioritised Action List — Pre-Launch Checklist

### Week 1: Must-Ship (P0)

| # | Action | Effort | Owner |
|---|--------|--------|-------|
| 1 | Rotate Supabase anon key; scrub from git history | 1 hr | DevOps |
| 2 | Add UNIQUE partial index on `appointment_requests(confirmed_slot)` | 30 min | DB |
| 3 | Add React ErrorBoundary (root + per-tab) | 2 hr | Frontend |
| 4 | Add epoch/generation counter to `trackedSave()` to prevent cross-patient writes | 3 hr | Frontend |
| 5 | Enforce WhatsApp webhook signature validation (reject missing sig) | 30 min | Backend |
| 6 | Enforce questionnaire token TTL (72h default) | 1 hr | Backend |
| 7 | Add startup env var validation in front-desk + API server | 2 hr | Both |
| 8 | Batch cron DB operations (bulk UPDATE/INSERT) | 3 hr | Backend |
| 9 | Show toast on localStorage quota failure | 30 min | Frontend |
| 10 | Gate auto-mode intake to `supervised` only | 30 min | Backend |
| 11 | Add confirmation token to patient-confirm endpoint | 2 hr | Backend |

### Week 2: Critical Fixes (P1)

| # | Action | Effort |
|---|--------|--------|
| 12 | Token refresh retry in `staffAuthHeaders()` | 2 hr |
| 13 | Gmail API retry with exponential backoff | 2 hr |
| 14 | Claude API timeout (15s) + skip-on-timeout | 1 hr |
| 15 | Make cron reminders idempotent (set flag before send) | 1 hr |
| 16 | Wrap visit-lifecycle writes in transaction | 3 hr |
| 17 | Migrate rate limiting to Redis/Upstash | 3 hr |
| 18 | Add secondary AI content validation pass | 4 hr |
| 19 | Move SMS dedup to database column | 1 hr |
| 20 | Add Zod schemas to booking + portal routes | 4 hr |
| 21 | Add missing database indexes | 1 hr |
| 22 | Paginate Google Calendar event queries | 1 hr |
| 23 | Clear sessionStorage on intake page load | 30 min |

### Week 3-4: High Priority (P2)

| # | Action | Effort |
|---|--------|--------|
| 24-37 | See P2 items above | ~30 hr total |

---

## System-Wide Risk Summary

```
                        ┌──────────────────────────────────────────────┐
                        │          RISK HEAT MAP BY COMPONENT          │
                        ├──────────────────────────────────────────────┤
                        │                                              │
    Data Loss           │  ████████░░  EMR Dashboard (localStorage)    │
                        │  ████░░░░░░  API Server (non-atomic writes)  │
                        │  ██░░░░░░░░  Front-Desk (no queue on fail)   │
                        │                                              │
    Security            │  ████████░░  API Server (no auth on confirm) │
                        │  ████████░░  Front-Desk (exposed key, CSRF)  │
                        │  ████░░░░░░  EMR Dashboard (token expiry)    │
                        │                                              │
    Availability        │  ██████░░░░  API Server (Gmail/Claude deps)  │
                        │  ████░░░░░░  Cron Jobs (N+1 timeout)        │
                        │  ██░░░░░░░░  Front-Desk (rate limit bypass)  │
                        │                                              │
    Clinical Safety     │  ██████░░░░  Forbidden pattern bypass (AI)   │
                        │  ████░░░░░░  Emergency redirect bypassable   │
                        │  ████░░░░░░  Wrong-patient data write        │
                        │                                              │
    UX / Reliability    │  ████░░░░░░  White-screen crash (no boundary)│
                        │  ████░░░░░░  iPad WheelPicker touch issues   │
                        │  ██░░░░░░░░  Z-index dropdown/dialog clash   │
                        └──────────────────────────────────────────────┘
```

---

## Conclusion

**52 findings** across 4 tiers. **11 are P0 blockers** that must be resolved before any patient data flows through the system in production. The most dangerous cluster is the intersection of **data integrity** (save race conditions, non-atomic writes) and **security** (exposed keys, missing auth, token expiry). The clinical safety items (forbidden pattern bypass, emergency redirect bypass, wrong-patient writes) carry the highest liability risk even if lower probability.

The system architecture is sound — client-side triage, Supabase backend, mode-gated outbound actions — but the gaps are in the **seams**: concurrent operations, failure handling, and input validation at system boundaries. Fixing the P0 and P1 items (~40 hours of work) brings the system to a defensible production state.

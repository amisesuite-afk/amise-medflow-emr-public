> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Security controls, known gaps, and pen-test and SOC 2 readiness

> Findings come from static code review at baseline `c9a7293`, refreshed on 2026-09-25 against `cc83845` (tip of `claude/pr-37-gbg22z`) and `23904fd`. Nothing was tested against production. Items marked **to verify** need a live test by an authorised person. This document contains no secrets.
>
> **Status terms.** *Fixed in code*: merged, commit and file cited, not verified in production. *Pending migration*: needs Migrations 87–90, which are wired into `run-migrations.yml` but **not yet applied to production**. *Pending env*: needs a variable set on Render or Vercel. *Open*: no fix yet.

## 1. Current controls

### 1.1 Identity and access

| Control | Evidence | Notes |
|---|---|---|
| Staff authentication: Supabase email/password | `artifacts/dashboard/src/context/AuthContext.tsx`, `AuthGuard` (`CLAUDE.md`) | **No MFA found** (a search for `mfa`, `totp` and `aal2` found nothing). No idle auto-logout found. `persistSession: true` (`dashboard/src/lib/supabase.ts:110`) |
| Role model `front_desk < nurse < doctor < admin` | `user_profiles.role`, `auth_role()` (`supabase-schema.sql:295-297`); UI gates in `dashboard/src/lib/roles.ts:36-47` | **The UI gates are client-side only.** Every api-server staff route now requires a staff `user_profiles` role (`f3338ca`, `verifyStaffToken()` in `api-server/src/lib/supabase.ts` and `middlewares/auth.ts`), but role-*specific* checks exist on just one route (`routes/visit-lifecycle.ts`, doctor-only reopen). See G-3 |
| **Front-desk staff API checks the session and role** (S-1). Fixed in code | `artifacts/front-desk/lib/staff-auth.ts` (`requireStaff()`), `middleware.ts`; `19a7479`; tests in `artifacts/front-desk/test/` | Every `/api/staff/*` handler validates the token with `auth.getUser()` and requires a staff role: 401 for a missing or forged token, 403 for a portal patient, 503 if the role lookup fails. Sign-out now really signs out |
| Row-level security enabled on core tables; policy presence enforced in CI | `supabase-schema.sql:299-307`; `scripts/src/lint-rls-policies.ts` (`REQUIRED_POLICIES`) | This is a **presence** check, not an enforcement test (`CLAUDE.md`). Since `dd49997` it also fails if a required policy's last definition, in runner order, is "any authenticated user" |
| **Staff-only RLS on PHI tables** (Migration 89, fixes S-2). **Pending migration** | `supabase-staff-only-rls-migration.sql`; `migrations/README.md`; `946bdbe` | Staff policies test `auth_role() in ('front_desk','nurse','doctor','admin')`, not "is authenticated", so a signed-in user without a staff profile (a portal patient) gets only the own-row portal policies. Covers about 55 PHI tables and the four storage buckets. **Written and verified in a local PGlite emulator, not yet applied** (the runner is manual dispatch) |
| **Migration runner re-runnable, checked on a fresh database in CI** | `scripts/src/check-migrations-fresh.ts` (`check:migrations-fresh`, `bf6f602`); fixes in `8824214`; `migrations/README.md` "Fresh-database check" | Applies every wired step twice to in-process PGlite with Supabase stand-ins. Fails on a forward reference, a non-idempotent statement, or a policy or grant that a re-run would re-open before Migration 89. **The runner has never completed on production**; its first complete run will apply 68, 77 and 87–90 |
| **Soft delete through a role-checked RPC** (Migration 87). **Pending migration** | `supabase-soft-delete-migration.sql` (`soft_delete()`, `cad8d9c`) | `SECURITY DEFINER`; checks `auth_role()` per table (front desk refused), sets only `deleted_at`/`deleted_by`, and writes an `audit_log` row in the same transaction. No RLS policy widened |
| **Staff provisioning is explicit** (Migration 89) | `handle_new_user()` in the same file | New auth users, including invited portal patients, no longer get an automatic `front_desk` profile. Staff need an admin-created `user_profiles` row, or `app_metadata.staff_role` set with the admin API. Profiles the old trigger created for portal patients are moved to `user_profiles_revoked` |
| **Column guards on `patients` UPDATE** (Migration 89) | BEFORE UPDATE triggers `patients_front_desk_column_guard`, `patients_self_update_column_guard` | Front desk may change only identity, contact, next-of-kin, insurance, scheduling and patient-reported intake columns. A portal patient may change only their own contact, next-of-kin, emergency-contact and portal-profile fields. Anything else fails with `42501`. The service role (API server) is not restricted |
| `clinical_notes` narrowed by role and status (drafts visible to author and admin) | `supabase-clinical-records-migration.sql:296-306` | Uses `auth_role()`, so users without a profile (such as portal patients) get no access. **This is the correct pattern** |
| Explicit `service_role` grants, enforced in CI | `scripts/src/lint-migration-grants.ts`, `CLAUDE.md` New Table Checklist | Prevents 42501 failures. Not an access restriction |
| Patient-portal credentials: scrypt hashes, 72-hour temporary passwords, deny-all RLS on `patient_accounts` | `patient-auth-migration.sql` | |
| Private storage buckets | `supabase-*.sql` (`public = false` for all four buckets) | `getPublicUrl()` is used on `patient-photos` (`dashboard/src/lib/db.ts:181`), **to verify** |
| Cron endpoints authenticated by a header-only shared secret | `api-server/src/lib/supabase.ts` (`requireCronSecret`) | The comparison is not constant-time. Until `STAFF_MACHINE_TOKEN` is set, the same secret also works as the `x-staff-token` machine credential (next row) |
| **Separate machine secret for `x-staff-token`** (S-3) | `api-server/src/lib/supabase.ts` (`staffMachineToken()`, `requireStaffAuth()`); caller `front-desk/lib/machine-auth.ts`; tests in `api-server/src/test/staff-auth.test.ts` | When `STAFF_MACHINE_TOKEN` is set, it is the only value accepted in `x-staff-token`, and `CRON_SECRET` no longer opens staff routes. Compared in constant time. While it is unset, the api-server falls back to `CRON_SECRET` and logs a warning once per process. **To do:** set `STAFF_MACHINE_TOKEN` on Render and on the front-desk Vercel project (same value, at the same time), then remove `CRON_SECRET` from front-desk. `/api/healthz/env` reports `staffMachine.token` |

### 1.2 Outbound-messaging safety (MODE gate)

- The api-server **refuses to boot with `MODE=auto` unless `CONFIRM_AUTO_MODE=true`**, and it logs a mode banner (`artifacts/api-server/src/index.ts:8, 33-40`).
- MODE is read at each send: `lib/sms.ts:45-59`, `lib/gmail.ts:196-205`, `front-desk/lib/twilio.ts:41-45, 62, 86`, `front-desk/lib/email.ts:232`.
- `FORBIDDEN_PATTERNS` content filter: `lib/triage-engine/src/rules.ts:174-196`, applied in `api-server/src/lib/claude.ts:166` and in the other places listed under H-09 in `hazard-log.md`.
- ~~**Known bypasses.**~~ **Fixed in code** (`e094063`, hazard H-09):
  - One gate for the api-server: `artifacts/api-server/src/lib/outbound.ts` (`outboundBlocked()`, `resolveEmailMode()`, `screenOutboundText()`). SMS, Gmail, WhatsApp via Twilio, Meta and Telnyx (`lib/whatsapp-send.ts`), and calendar writes all consult it. An unrecognised `MODE` fails closed to `dry_run`, and no per-call override can lift `dry_run`.
  - The 24-hour reminder (formerly `cron.ts:85`) follows `MODE`, and its AI-drafted body is screened; a quarantined draft goes to staff, not the patient. Direct send under `supervised` needs the opt-in `REMINDER_EMAIL_AUTO_SEND=true` (off by default).
  - Staff-internal alerts may send directly under `supervised`, but not under `dry_run`.
  - Tests: `src/test/outbound-safety.test.ts`, `src/test/cron-reminders.test.ts`.
- **Still open:**
  - The front-desk app has its own checks (`artifacts/front-desk/lib/email.ts`, `lib/twilio.ts`) that do **not** fail closed: `email.ts` sends unless `MODE` is exactly `dry_run`, so an unset or misspelt value sends. See G-17.
  - A second `FORBIDDEN_PATTERNS` copy remains in `artifacts/front-desk/lib/constants.ts`.
  - No CI check for provider calls that bypass the gate.
- **Patient prep text** carries no medication-hold advice (hazard H-10). CI enforces this with `lint:patient-instructions` (`scripts/src/lint-patient-instructions.ts`) and `outbound-safety.test.ts`.
- **AI kill switch.** `DISABLE_AI=true` stops every Anthropic and Whisper call in the api-server and front-desk (`lib/ai-gate.ts` in each; `113b1d9`). `new Anthropic(` outside the gate fails CI (`ai-gate.test.ts`).

### 1.3 iOS device controls

| Control | Evidence | Notes |
|---|---|---|
| **App lock**: Face ID or Touch ID on iPhone, device passcode on iPad. Locks on launch and after 30 s in the background. Content is blurred and disabled while locked | `ios/AmiseMedFlow/Services/BiometricAuthService.swift:17-50`, `AmiseMedFlowApp.swift:57-66` | The app-switcher snapshot is blurred only if the lock engages before the snapshot is taken (**to verify**) |
| **File protection** | `Services/AuditLog.swift:134` uses `.completeFileProtectionUntilFirstUserAuthentication` | **The SwiftData store has no explicit protection class.** `AmiseMedFlow.entitlements` is empty (no `com.apple.developer.default-data-protection`), so the store uses the OS default (expected to be *Complete Until First User Authentication*, **to verify**). Consider `NSFileProtectionComplete` |
| **No iCloud database sync** | `AmiseMedFlowApp.swift:27` (`cloudKitDatabase: .none`) | The store is **not excluded from device backups** (no `isExcludedFromBackup`, **to verify**) |
| **Keychain** for NAS credentials | `Services/NASBackupService.swift:5-40` | Default accessibility |
| **PHI-safe crash reporting** | `Services/CrashReporting.swift`: `sendDefaultPii = false`, no screenshots or view hierarchy, no network breadcrumbs or tracing, auto-breadcrumbs off, `beforeSend` strips user, request and server name. Active only when `SENTRY_DSN` is configured | This is the reference pattern. The web and API Sentry setups do **not** follow it (§2) |
| **iOS audit trail** | `Services/AuditLog.swift`. Events are queued on device and uploaded to `audit_log`, with no clinical free text by design | |
| **AI disabled pending a BAA** | `Services/AIService.swift` (all generation methods throw `AIError.disabled`) | |
| **Peer-sync transport encryption and pairing** (fixed in code) | `Services/PeerSyncService+Pairing.swift` (`makeSession`: `encryptionPreference: .required`, one session per peer), `Services/PeerPairingCrypto.swift`, `Services/PeerPairingStore.swift`; tests `PeerPairingTests.swift` | One-time 6-digit-code pairing, per-peer Keychain secret (`AfterFirstUnlockThisDeviceOnly`), mutual HMAC challenge-response every session, then the same-account check. See S-5 for the residual risk |
| **On-device dictation when supported** (fixed in code) | `Services/SpeechService.swift` (`requiresOnDeviceRecognition` follows `supportsOnDeviceRecognition`; `16435f3`) | Falls back to Apple's servers where the recogniser has no on-device model (G-12) |
| **Questionnaire hand-over mode** (fixed in code) | `Views/FrontDesk/PatientHandoverPresentation.swift`, `Services/QuestionnairePatientSearch.swift`, `BiometricAuthService.verifyDeviceOwner`; `23904fd`; tests `QuestionnairePrivacyTests.swift` | When the device is handed to a patient: no default patient list, search only after 3+ letters or an MRN (at most 5 results), full-screen cover, staff-only exit with device-owner authentication, camera-only prescription photo, audit events on open and exit |
| **Sync respects server refusals** (fixed in code) | `Services/SyncService+Refusals.swift` (`8e350a0`, `9565db7`) | A `42501` or an UPDATE that RLS filters to 0 rows marks that record refused. It stays local and pending, and the rest of the sync continues. A confirmed front-desk user sends only the Migration 89 allow-listed patient columns (`FrontDeskPatientColumns`) |
| **Practice identity configurable** (fixed in code) | `Services/PracticeProfile.swift`, `Views/PracticeProfileView.swift` (`53d1e52`, `6e15238`, `1572c87`) | Also removed the practice's NAS host name and IP from the in-app example text |

### 1.4 Server and platform

- **Helmet with a CSP.** CORS is restricted to configured origins and to the team's Vercel preview patterns (`api-server/src/app.ts:49-90`).
- **Rate limits** on public booking, SMS-code, consult-request and WhatsApp webhook routes (`app.ts:113-139`).
- **Query strings stripped** from request logs (`app.ts:34`). Authorization and cookie headers are redacted (`lib/logger.ts:13-17`).
- **PHI read auditing** for API GETs (`lib/phi-audit-middleware.ts`). Mutation auditing is covered per `docs/AUDIT-TRAIL-COVERAGE.md`. `audit_log` is append-only by grant (`supabase-slice-d-audit-migration.sql:42-65`).
- **Secrets are env-only.** No real secrets were committed (`docs/SECRETS-HYGIENE.md`). The rotation cadence is defined there, but **no rotation has ever been performed**.
- **Backups.**
  - Nightly GPG AES-256 DB dumps to the NAS (`.github/workflows/backup.yml`, `scripts/backup/backup-db.sh:45-51`).
  - Manual `pg_dump` (`docs/INCIDENT-RUNBOOK.md`).
  - **PITR disabled.**

## 2. Known gaps (summary)

| # | Gap | Evidence | Severity | Status (2026-09-25) |
|---|---|---|---|---|
| G-1 | **No multi-tenant isolation.** There is no tenant or practice column or policy. One Supabase project serves one practice | `CLAUDE.md` ("single-tenant, role-based"); policies in `supabase-schema.sql` | **Blocker for selling to other practices.** Each customer needs its own project or stack, or a tenant model must be built | Open. Plan written: `docs/MULTI-TENANCY-PLAN.md`. iOS practice identity is configurable (`PracticeProfile`); web and API identity is still hard-coded |
| G-2 | **Every authenticated user can read every patient and document** (`auth.uid() is not null`) | `supabase-schema.sql:319-320`; `supabase-clinical-records-migration.sql:312-313`; `appointment_requests` `using (true)` (`supabase-schema.sql:502`) | High. See S-2 for how this interacts with patient-portal users | **Pending migration** (Migration 89). Afterwards every *staff* user can still read every patient: that is the intended single-practice model, not a gap |
| G-3 | API authorisation is authentication-only. There is no server-side role check except one route | `api-server/src/lib/supabase.ts:28-50`; `visit-lifecycle.ts:266-271` | High | Partly fixed (`f3338ca`): a staff role is now required on every staff route. Role-*specific* server checks (for example doctor-only prescribing) exist on one route only. Open |
| G-4 | No MFA and no idle timeout for staff | §1.1 | Medium-High | Open |
| G-5 | **PHI persisted in the browser** (localStorage and IndexedDB) and not cleared on sign-out | `dashboard/src/context/AppContext.tsx:829-850, 1006, 1033-1035`; `lib/sync-outbox.ts`; `AuthContext.tsx:170-174` | Medium (shared workstations) | Open (`signOut()` unchanged at `cc83845`) |
| G-6 | **Web and API Sentry have no PHI scrubbing** | `dashboard/src/main.tsx:14-17`; `api-server/src/index.ts:11-15` | Medium | Open (S-6) |
| G-7 | Logs contain patient phone numbers and message previews | `api-server/src/lib/sms.ts:58, 71-97` | Low-Medium | Open. The new dry-run log line in `lib/outbound.ts` also logs the recipient |
| G-8 | ~~**The `DISABLE_AI` kill switch is partial**~~ **Fixed.** `DISABLE_AI=true` now covers every Anthropic and Whisper call site in the API and the front-desk intake, through one gate per deployment (`lib/ai-gate.ts`), and is CI-tested | `artifacts/api-server/src/lib/ai-gate.ts`; `artifacts/front-desk/lib/ai-gate.ts`; `src/test/ai-gate.test.ts`; coverage table in `data-inventory.md` §6 | Closed (was Medium, governance) | Fixed in code (`113b1d9`) |
| G-9 | iOS WebDAV backups are plaintext JSON with Basic auth over a user-supplied URL, with no retention | `NASBackupService+WebDAV.swift:26-57`; `NASBackupService.swift:226-229`; `NASBackupService+Restore.swift:45` | Medium | Open |
| G-10 | Server backup mirrors only `patient-documents`, not `call-recordings`, `patient-photos` or `clinical-attachments`. Storage is mirrored unencrypted, relying on NAS volume encryption | `.github/workflows/backup.yml`; `scripts/backup/backup-storage.sh:4-6` | Medium | Open |
| G-11 | PHI on the iOS lock screen and in the device calendar | `NotificationService.swift:49, 71`; `CalendarService.swift:81, 110, 139` | Low-Medium | Open |
| G-12 | Server-based Apple speech recognition | `SpeechService.swift:158` | Low-Medium (a subprocessor without an agreement) | Partly fixed (`16435f3`): on-device whenever the recogniser supports it |
| G-13 | `/api/calls/recording-upload` is **unauthenticated if `RECORDING_UPLOAD_KEY` is unset** | `api-server/src/app.ts:96-104`; `routes/call-recording.ts` has no other auth check | Medium, **to verify** the production env | Open (code unchanged) |
| G-14 | Webhook signature validation happens "when env vars set" | `routes/whatsapp.ts` header comment | Medium, **to verify** | Open |
| G-15 | Two parallel audit helpers, and legacy `audit_logs` and `clinical_audit_log` tables. The iOS consent copy is inaccurate | `docs/AUDIT-TRAIL-COVERAGE.md`; `ios/.../AIConsentGate.swift` | Low | Open. New audit events: `soft_delete()` (Migration 87), iOS billing and document deletes (`48ac9f7`), bowel-prep exports (`abda6b2`), questionnaire hand-over open and exit (`23904fd`) |
| G-16 | GitHub secret scanning not enabled. Secrets never rotated | `docs/SECRETS-HYGIENE.md` | Medium | Open. `STAFF_MACHINE_TOKEN` is a new secret to add to the rotation list |
| G-17 | **Front-desk outbound checks do not fail closed.** `lib/email.ts` sends unless `MODE` is exactly `dry_run`; `lib/twilio.ts` sends on a misspelt value | `artifacts/front-desk/lib/email.ts:232`; `lib/twilio.ts:41, 62, 86` | Medium, **to verify** the front-desk Vercel `MODE` | Open (found in this refresh). Fix: reuse the api-server semantics (unknown → `dry_run`) |
| G-18 | **Migrations 87–90 not applied to production.** The fixes for S-2 (89), soft delete (87) and NEWS2 Scale 2 cloud sync (88) depend on them. The runner has never completed on production | `migrations/README.md` ("Later additions", "Before the next production run") | **High** (S-2 stays exploitable until 89 runs) | Pending migration. Needs the pre-flight queries, a backup and a planned window |
| G-19 | `STAFF_MACHINE_TOKEN` not yet set, so `CRON_SECRET` still opens staff routes through `x-staff-token` | `api-server/src/lib/supabase.ts` (`staffMachineToken()`); `/api/healthz/env` reports `staffMachine.token` | Medium | Pending env (Render and front-desk Vercel, same value, same time) |

## 3. Priority findings (fix before any sale, and ideally before continued production use)

These are **potential vulnerabilities identified by reading the code**. Each needs verification by an authorised tester. This document deliberately does not include exploitation steps.

**S-1: The front-desk staff API trusts a cookie's presence, not its validity. (Critical.) Fixed in code.**

- `artifacts/front-desk/middleware.ts:6-12` returns true if a cookie named `amise-staff-session` exists, or any cookie matching `sb-*-auth-token` exists. That covers patient-portal sessions and arbitrary values.
- `/api/staff/*` routes run with the **service-role** client and do no further auth. For example, `app/api/staff/patients/route.ts:14-35` returns patient name, phone, email and DOB for a search term. The `q` parameter is interpolated into a PostgREST `.or()` filter string (line 26), which also needs review.
- **Fix:** validate the session server-side (`supabase.auth.getUser()`) and check the staff role in each route. Parameterise the filters.
- **Status: fixed in code** (`19a7479`). `artifacts/front-desk/lib/staff-auth.ts` (`requireStaff()`) runs first in every `/api/staff/*` handler. It takes the Bearer header or the `amise-staff-session` cookie, rejects non-JWT values, validates the token with `auth.getUser()` and requires a staff `user_profiles` role. The staff client now mirrors its access token into that cookie (`SameSite=Strict`), so the server has something real to verify. `q` is stripped of PostgREST filter syntax. Tests: `artifacts/front-desk/test/staff-auth.test.ts`. A live retest is in the pen-test scope (§4).

**S-2: Portal patients may be able to read all patient rows. (Critical; confirmed in a local emulator.) Pending Migration 89.**

- Patient-portal users are created as Supabase Auth users in the same project (`api-server/src/routes/portal.ts:65`).
- The staff policies `staff_select_patients` and `staff_select_documents` allow any row when `auth.uid() is not null`.
- Postgres combines permissive policies with OR, so the "own record" policies (`supabase-patient-portal-migration.sql:41-87`) do **not** restrict patients.
- **Fix:** change the staff policies to `auth_role() in (...)`, as `clinical_notes` does. Add a live RLS test that runs as a patient user. Today no such test exists (`CLAUDE.md`).
- **Status: pending migration** (Migration 89, `supabase-staff-only-rls-migration.sql`; `946bdbe`, `1a01b5d`, `aaa53c0`).
  - Rewrites the open staff policies on about 55 PHI tables and the four storage buckets to `(select auth_role()) in ('front_desk','nurse','doctor','admin')`.
  - A second cause was found and fixed: `handle_new_user()` gave every new auth user, including every invited portal patient, a `front_desk` profile. It now creates a profile only when `app_metadata.staff_role` names a staff role, and moves the auto-created patient profiles to the admin-only `user_profiles_revoked`.
  - Adds `patients` UPDATE column guards: front desk may change admin and intake columns only; a portal patient only their own contact and profile fields.
  - Verified in a local PGlite emulator: before, a portal patient saw every patient, document and bucket object; after, only their own. Staff access unchanged.
  - CI: `lint:rls-policies` fails if a required policy's effective definition is open again (`dd49997`); `check:migrations-fresh` fails if a re-run would re-open access before step 89.
  - **Not yet done:** applying it to production (run the pre-flight queries in `migrations/README.md` first), and a live test as a real portal-patient JWT against a staging project.

**S-3: `requireStaffAuth()` accepts any Supabase user JWT, and accepts `CRON_SECRET` as a staff token. (High.) Fixed in code; pending env.**

- `api-server/src/lib/supabase.ts:28-50`. Combined with S-2, a portal patient's token may pass staff-only API routes, which use `service_role` and bypass RLS.
- **Fix:** require a `user_profiles` row with a staff role. Give machine callers a separate secret. Use constant-time comparison.
- **Status: fixed in code; pending env.** The staff-role check (`f3338ca`) and the constant-time comparison are in the code, with tests in `api-server/src/test/staff-auth.test.ts`. The separate secret is `STAFF_MACHINE_TOKEN` (`e6cbf09`, §1.1). It takes effect only once it is set in each environment; until then `x-staff-token` still accepts `CRON_SECRET` (G-19). The role check reads `user_profiles`, so until Migration 89 revokes the auto-created profiles, patients invited earlier still pass it as `front_desk`: deploy and migrate together (`migrations/README.md`, "Deploy order").

**S-4: A patient session token is sent to a third-party QR service. (High.) Fixed.**

- `dashboard/src/pages/tabs/QuestionnaireManagerTab.tsx` put the questionnaire URL, which contains the session token, in a request to `api.qrserver.com`.
- **Fixed:** the QR code is now generated in the browser (`dashboard/src/components/LocalQrCode.tsx`, `qrcode` npm package, MIT). No request leaves the page. `pnpm --filter @workspace/scripts run lint:no-external-qr` (CI) fails the build if any web source references a third-party QR or chart-image service. No other web call sites existed. iOS has no QR generation today; if one is added, use CoreImage `CIQRCodeGenerator`.
- **Residual:** tokens already sent before the fix may be in the vendor's logs. Questionnaire tokens expire (`supabase-questionnaire-token-expiry-migration.sql`), which limits that exposure.

**S-5: iOS peer-sync peer authentication is weak. (High.) Fixed in code.**

- Was: the only admission check was a **djb2 hash of the signed-in email**, **broadcast in Bonjour discovery info**; invitations with no context were accepted; the session had no `securityIdentity`. A nearby device that learned or guessed the hash could request all local records. (Transport encryption was already `.required`.)
- **Fixed in code** (branch `peer-pairing`):
  - Discovery info holds only a random per-install device id and a pairing-mode flag. The email hash is no longer broadcast or checked.
  - One-time pairing (Settings → Nearby devices → Pair a device): a 6-digit code, valid 2 minutes, one confirmation attempt. It authenticates an ephemeral Curve25519 key agreement (HKDF-SHA256 over the shared secret and the code, salted with a transcript of both device ids and keys; HMAC confirmations). The resulting 32-byte secret is stored in the Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) per peer device id.
  - Every session: mutual HMAC-SHA256 challenge-response over fresh nonces, then the same-account check, inside the encrypted session and before any manifest or record is sent or read. One `MCSession` per peer, so a failed peer is disconnected alone.
  - Paired devices are listed in Settings with "Forget". Pair, forget and failed authentication are written to `audit_log` (device id and a fixed reason; no PHI).
  - Tests: `ios/AmiseMedFlowTests/PeerPairingTests.swift`.
- **Residual risk (for CSO/PO acceptance, A-8):** the pairing step is not a full PAKE (CryptoKit has no SPAKE2/CPace). A passive listener learns nothing, but an **active** attacker in radio range during the 2-minute window, advertising pairing mode and chosen by the typing device, could brute-force the 6-digit code offline from that device's confirmation. Mitigated by: the typing device refuses when more than one device advertises pairing mode, one pairing session and one attempt per code, 2-minute expiry, audit events, and the paired-device list with "Forget". Older builds (email hash) can no longer connect to an updated device, but two older builds still use the old scheme between themselves until updated. Needs verification on devices.
- **Migration:** users pair their devices once after updating. Until then the sync status shows "Pair your iPad to resume nearby sync" (or iPhone).

**S-6: Web and API error telemetry may carry PHI. (Medium.) Open.**

- **Fix:** add `beforeSend` and `beforeBreadcrumb` scrubbing that mirrors `ios/.../CrashReporting.swift`. Set `sendDefaultPii: false` explicitly. Drop request bodies and URLs containing ids.
- **Status: open.** `dashboard/src/main.tsx` and `api-server/src/index.ts` are unchanged.

## 4. Penetration-test readiness checklist

- [ ] Written scope and rules of engagement, signed by the practice owner. Use a **staging** Supabase project with synthetic data (none exists today; create one)
- [ ] Test accounts for each role (`front_desk`, `nurse`, `doctor`, `admin`) and one **portal patient** account
- [ ] Targets:
  - [ ] Dashboard (Vercel)
  - [ ] Front-desk and portal (Vercel, including `/api/staff/*` and `/api/patient/*`)
  - [ ] API server (Render: `/api/*`, cron, webhooks, the `recording-upload` route)
  - [ ] Supabase REST and Storage directly with the anon key plus each role's JWT (RLS enforcement)
  - [ ] iOS app (local storage, backups, peer sync, WebDAV)
- [ ] Specific test cases:
  - [ ] S-1 to S-5. Apply Migration 89 to staging first, then attempt S-2 with a real portal-patient JWT against every PHI table and bucket (the only enforcement evidence today is a local emulator)
  - [ ] `patients` column guards: front desk and portal patient changing blocked columns (expect `42501`)
  - [ ] `soft_delete()` RPC called by each role, including front desk (expect a refusal)
  - [ ] `x-staff-token` with `CRON_SECRET` once `STAFF_MACHINE_TOKEN` is set (expect 401)
  - [ ] Horizontal access between patients in the portal
  - [ ] Vertical escalation (front desk calling doctor-only APIs)
  - [ ] PostgREST filter injection
  - [ ] Webhook signature bypass (Twilio, Meta, Telnyx)
  - [ ] Rate-limit bypass behind `trust proxy`
  - [ ] Signed and public URL exposure for storage objects
  - [ ] CORS preview-origin regex
  - [ ] Prompt injection through patient messages and uploaded documents into AI routes
  - [ ] Outbound-message abuse (triggering SMS or email floods)
- [ ] Dependency and SCA scan (`pnpm audit`, Swift packages). Container and image scan if Docker is used
- [ ] Secrets scan (enable GitHub secret scanning and push protection, per `docs/SECRETS-HYGIENE.md`)
- [ ] A retest window after fixes, and a report delivered to the practice owner

## 5. SOC 2 (Trust Services Criteria) readiness checklist

**Status key: ☐ not started · ◐ partial (evidence exists in repo) · ☑ done.**

| Area | Item | Status | Evidence / gap |
|---|---|---|---|
| Governance | Named security owner. Information-security policy set (access, change, incident, vendor, data retention, acceptable use) | ☐ | None in repo |
| Governance | Risk assessment, reviewed annually | ◐ | This pack and `hazard-log.md`. Not yet signed |
| Access (CC6) | Unique accounts, role-based access, **least privilege enforced server-side** | ◐ | Roles exist. Staff role required on every staff API route (S-1, S-3 fixed in code). Staff-only RLS pending Migration 89. See G-2, G-3 |
| Access | MFA for all staff and admin consoles (Supabase, Render, Vercel, GitHub, Google, Twilio) | ☐ | Unknown for consoles. None in-app |
| Access | Joiner, mover and leaver process. Quarterly access reviews | ☐ | After Migration 89, joining is explicit (admin-created `user_profiles` row or `app_metadata.staff_role`; `migrations/README.md`). No written process yet |
| Change mgmt (CC8) | PR review, CI checks, protected main branch, deploy traceability | ◐ | CI lints and e2e (`CLAUDE.md`), now including `check:migrations-fresh`, `lint:interaction-parity`, `lint:patient-instructions`, `lint:no-external-qr`, the stricter `lint:rls-policies`, and the `ai-gate` and `outbound-safety` tests. Render auto-deploys on push to main (`docs/INCIDENT-RUNBOOK.md`). Branch protection **to confirm**. Production migrations are still a manual run that has never completed |
| Change mgmt | Clinical content change control (CODEOWNERS) | ☐ | Proposed in `clinical-safety-case.md` §7 |
| Operations (CC7) | Centralised logging with retention. Alerting | ◐ | Render stdout only, no external sink. Sentry optional |
| Operations | Incident response plan and tabletop exercise | ◐ | `docs/INCIDENT-RUNBOOK.md` (technical). A breach-notification procedure is needed |
| Operations | Vulnerability management (dependency scanning, pen test annually) | ☐ | |
| Availability (A1) | Backups, tested restores, RPO/RTO defined | ◐ | Nightly DB backups plus iOS test restore. **PITR off.** Not all buckets are backed up |
| Confidentiality (C1) | Data classification, encryption in transit and at rest, retention and disposal | ◐ | TLS through vendors. No retention policy (see `data-inventory.md` §3) |
| Vendor mgmt (CC9) | Subprocessor register, DPAs/BAAs, annual vendor review | ◐ | `subprocessors.md`. **No agreements recorded** |
| Privacy (P) | Privacy notice, consent, data-subject requests, breach notification | ◐ | `privacy-policy-draft.md` (draft) |
| HR | Background checks, security training, confidentiality agreements | ☐ | |
| Endpoint | Managed devices, disk encryption, screen lock (iPad/iPhone MDM) | ☐ | The app has its own lock; MDM is unknown |
| Evidence | Tooling to collect control evidence continuously | ☐ | |

**Recommendation.** Start with a **SOC 2 Type I** readiness assessment after G-1 to G-4 and S-1 to S-6 are closed. For UK/EU customers, also consider **ISO 27001**, **Cyber Essentials (Plus)** and **DSPT** (for NHS supply). For US covered entities, a **HIPAA Security Rule risk analysis** is mandatory.

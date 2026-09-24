> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Security controls, known gaps, and pen-test and SOC 2 readiness

> Findings come from static code review at baseline `c9a7293`. Nothing was tested against production. Items marked **to verify** need a live test by an authorised person. This document contains no secrets.

## 1. Current controls

### 1.1 Identity and access

| Control | Evidence | Notes |
|---|---|---|
| Staff authentication: Supabase email/password | `artifacts/dashboard/src/context/AuthContext.tsx`, `AuthGuard` (`CLAUDE.md`) | **No MFA found** (a search for `mfa`, `totp` and `aal2` found nothing). No idle auto-logout found. `persistSession: true` (`dashboard/src/lib/supabase.ts:110`) |
| Role model `front_desk < nurse < doctor < admin` | `user_profiles.role`, `auth_role()` (`supabase-schema.sql:295-297`); UI gates in `dashboard/src/lib/roles.ts:36-47` | **The UI gates are client-side only.** The API checks role on just one route (`api-server/src/routes/visit-lifecycle.ts:266-271`) |
| Row-level security enabled on core tables; policy presence enforced in CI | `supabase-schema.sql:299-307`; `scripts/src/lint-rls-policies.ts` (`REQUIRED_POLICIES`) | This is a **presence** check, not an enforcement test (`CLAUDE.md`). It also fails if a required policy's last definition is "any authenticated user" |
| **Staff-only RLS on PHI tables** (Migration 89, fixes S-2) | `supabase-staff-only-rls-migration.sql`; `migrations/README.md` | Staff policies test `auth_role() in ('front_desk','nurse','doctor','admin')`, not "is authenticated", so a signed-in user without a staff profile (a portal patient) gets only the own-row portal policies. **Written and verified in a local emulator, not yet applied** (the runner is manual dispatch) |
| **Staff provisioning is explicit** (Migration 89) | `handle_new_user()` in the same file | New auth users, including invited portal patients, no longer get an automatic `front_desk` profile. Staff need an admin-created `user_profiles` row, or `app_metadata.staff_role` set with the admin API. Profiles the old trigger created for portal patients are moved to `user_profiles_revoked` |
| **Column guards on `patients` UPDATE** (Migration 89) | BEFORE UPDATE triggers `patients_front_desk_column_guard`, `patients_self_update_column_guard` | Front desk may change only identity, contact, next-of-kin, insurance, scheduling and patient-reported intake columns. A portal patient may change only their own contact, next-of-kin, emergency-contact and portal-profile fields. Anything else fails with `42501`. The service role (API server) is not restricted |
| `clinical_notes` narrowed by role and status (drafts visible to author and admin) | `supabase-clinical-records-migration.sql:296-306` | Uses `auth_role()`, so users without a profile (such as portal patients) get no access. **This is the correct pattern** |
| Explicit `service_role` grants, enforced in CI | `scripts/src/lint-migration-grants.ts`, `CLAUDE.md` New Table Checklist | Prevents 42501 failures. Not an access restriction |
| Patient-portal credentials: scrypt hashes, 72-hour temporary passwords, deny-all RLS on `patient_accounts` | `patient-auth-migration.sql` | |
| Private storage buckets | `supabase-*.sql` (`public = false` for all four buckets) | `getPublicUrl()` is used on `patient-photos` (`dashboard/src/lib/db.ts:181`), **to verify** |
| Cron endpoints authenticated by a header-only shared secret | `api-server/src/lib/supabase.ts:58-73` (`requireCronSecret`) | The comparison is not constant-time. The same secret doubles as a staff token (§3, S-3) |

### 1.2 Outbound-messaging safety (MODE gate)

- The api-server **refuses to boot with `MODE=auto` unless `CONFIRM_AUTO_MODE=true`**, and it logs a mode banner (`artifacts/api-server/src/index.ts:8, 33-40`).
- MODE is read at each send: `lib/sms.ts:45-59`, `lib/gmail.ts:196-205`, `front-desk/lib/twilio.ts:41-45, 62, 86`, `front-desk/lib/email.ts:232`.
- `FORBIDDEN_PATTERNS` content filter: `lib/triage-engine/src/rules.ts:174-196`, applied in `api-server/src/lib/claude.ts:166` and in the other places listed under H-09 in `hazard-log.md`.
- **Known bypasses.** Covered in `hazard-log.md` H-09:
  - `routes/cron.ts:85` forces `'auto'` towards patients.
  - The Meta and Telnyx sends in `routes/whatsapp.ts:241-286` have no MODE check.
  - Staff alert emails are forced to `'auto'`.

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
| **Peer-sync transport encryption** | `PeerSyncService.swift:85-86` (`encryptionPreference: .required`) | Weak peer **authentication**: see S-5 |

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

| # | Gap | Evidence | Severity |
|---|---|---|---|
| G-1 | **No multi-tenant isolation.** There is no tenant or practice column or policy. One Supabase project serves one practice | `CLAUDE.md` ("single-tenant, role-based"); policies in `supabase-schema.sql` | **Blocker for selling to other practices.** Each customer needs its own project or stack, or a tenant model must be built |
| G-2 | **Every authenticated user can read every patient and document** (`auth.uid() is not null`) | `supabase-schema.sql:319-320`; `supabase-clinical-records-migration.sql:312-313`; `appointment_requests` `using (true)` (`supabase-schema.sql:502`) | High. See S-2 for how this interacts with patient-portal users |
| G-3 | API authorisation is authentication-only. There is no server-side role check except one route | `api-server/src/lib/supabase.ts:28-50`; `visit-lifecycle.ts:266-271` | High |
| G-4 | No MFA and no idle timeout for staff | §1.1 | Medium-High |
| G-5 | **PHI persisted in the browser** (localStorage and IndexedDB) and not cleared on sign-out | `dashboard/src/context/AppContext.tsx:829-850, 1006, 1033-1035`; `lib/sync-outbox.ts`; `AuthContext.tsx:170-174` | Medium (shared workstations) |
| G-6 | **Web and API Sentry have no PHI scrubbing** | `dashboard/src/main.tsx:14-17`; `api-server/src/index.ts:11-15` | Medium |
| G-7 | Logs contain patient phone numbers and message previews | `api-server/src/lib/sms.ts:58, 71-97` | Low-Medium |
| G-8 | ~~**The `DISABLE_AI` kill switch is partial**~~ **Fixed.** `DISABLE_AI=true` now covers every Anthropic and Whisper call site in the API and the front-desk intake, through one gate per deployment (`lib/ai-gate.ts`), and is CI-tested | `artifacts/api-server/src/lib/ai-gate.ts`; `artifacts/front-desk/lib/ai-gate.ts`; `src/test/ai-gate.test.ts`; coverage table in `data-inventory.md` §6 | Closed (was Medium, governance) |
| G-9 | iOS WebDAV backups are plaintext JSON with Basic auth over a user-supplied URL, with no retention | `NASBackupService+WebDAV.swift:26-57`; `NASBackupService.swift:226-229`; `NASBackupService+Restore.swift:45` | Medium |
| G-10 | Server backup mirrors only `patient-documents`, not `call-recordings`, `patient-photos` or `clinical-attachments`. Storage is mirrored unencrypted, relying on NAS volume encryption | `.github/workflows/backup.yml`; `scripts/backup/backup-storage.sh:4-6` | Medium |
| G-11 | PHI on the iOS lock screen and in the device calendar | `NotificationService.swift:49, 71`; `CalendarService.swift:81, 110, 139` | Low-Medium |
| G-12 | Server-based Apple speech recognition | `SpeechService.swift:158` | Low-Medium (a subprocessor without an agreement) |
| G-13 | `/api/calls/recording-upload` is **unauthenticated if `RECORDING_UPLOAD_KEY` is unset** | `api-server/src/app.ts:96-104`; `routes/call-recording.ts` has no other auth check | Medium, **to verify** the production env |
| G-14 | Webhook signature validation happens "when env vars set" | `routes/whatsapp.ts` header comment | Medium, **to verify** |
| G-15 | Two parallel audit helpers, and legacy `audit_logs` and `clinical_audit_log` tables. The iOS consent copy is inaccurate | `docs/AUDIT-TRAIL-COVERAGE.md`; `ios/.../AIConsentGate.swift` | Low |
| G-16 | GitHub secret scanning not enabled. Secrets never rotated | `docs/SECRETS-HYGIENE.md` | Medium |

## 3. Priority findings (fix before any sale, and ideally before continued production use)

These are **potential vulnerabilities identified by reading the code**. Each needs verification by an authorised tester. This document deliberately does not include exploitation steps.

**S-1: The front-desk staff API trusts a cookie's presence, not its validity. (Critical, to verify.)**

- `artifacts/front-desk/middleware.ts:6-12` returns true if a cookie named `amise-staff-session` exists, or any cookie matching `sb-*-auth-token` exists. That covers patient-portal sessions and arbitrary values.
- `/api/staff/*` routes run with the **service-role** client and do no further auth. For example, `app/api/staff/patients/route.ts:14-35` returns patient name, phone, email and DOB for a search term. The `q` parameter is interpolated into a PostgREST `.or()` filter string (line 26), which also needs review.
- **Fix:** validate the session server-side (`supabase.auth.getUser()`) and check the staff role in each route. Parameterise the filters.

**S-2: Portal patients may be able to read all patient rows. (Critical, to verify.)**

- Patient-portal users are created as Supabase Auth users in the same project (`api-server/src/routes/portal.ts:65`).
- The staff policies `staff_select_patients` and `staff_select_documents` allow any row when `auth.uid() is not null`.
- Postgres combines permissive policies with OR, so the "own record" policies (`supabase-patient-portal-migration.sql:41-87`) do **not** restrict patients.
- **Fix:** change the staff policies to `auth_role() in (...)`, as `clinical_notes` does. Add a live RLS test that runs as a patient user. Today no such test exists (`CLAUDE.md`).

**S-3: `requireStaffAuth()` accepts any Supabase user JWT, and accepts `CRON_SECRET` as a staff token. (High.)**

- `api-server/src/lib/supabase.ts:28-50`. Combined with S-2, a portal patient's token may pass staff-only API routes, which use `service_role` and bypass RLS.
- **Fix:** require a `user_profiles` row with a staff role. Give machine callers a separate secret. Use constant-time comparison.

**S-4: A patient session token is sent to a third-party QR service. (High.)**

- `dashboard/src/pages/tabs/QuestionnaireManagerTab.tsx:720` puts the questionnaire URL, which contains the session token, in a request to `api.qrserver.com`.
- **Fix:** generate the QR code locally.

**S-5: iOS peer-sync peer authentication is weak. (High, to verify.)**

- The only admission check is a **djb2 hash of the signed-in email** (`PeerSyncService+ApplyRecords.swift:233-237`). That hash is **broadcast in Bonjour discovery info** (`PeerSyncService.swift:89-91`).
- Invitations with no context are accepted (`PeerSyncService+MCDelegates.swift:19`).
- The session has no `securityIdentity` (`PeerSyncService.swift:85`).
- A nearby device that learns the hash could request all local records.
- **Fix:** mutual authentication with a server-issued per-device credential, or a pairing code, or certificate identities. Stop advertising the hash. Consider disabling peer sync by default.

**S-6: Web and API error telemetry may carry PHI. (Medium.)**

- **Fix:** add `beforeSend` and `beforeBreadcrumb` scrubbing that mirrors `ios/.../CrashReporting.swift`. Set `sendDefaultPii: false` explicitly. Drop request bodies and URLs containing ids.

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
  - [ ] S-1 to S-5
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
| Access (CC6) | Unique accounts, role-based access, **least privilege enforced server-side** | ◐ | Roles exist; see G-2 and G-3 |
| Access | MFA for all staff and admin consoles (Supabase, Render, Vercel, GitHub, Google, Twilio) | ☐ | Unknown for consoles. None in-app |
| Access | Joiner, mover and leaver process. Quarterly access reviews | ☐ | |
| Change mgmt (CC8) | PR review, CI checks, protected main branch, deploy traceability | ◐ | CI lints and e2e (`CLAUDE.md`). Render auto-deploys on push to main (`docs/INCIDENT-RUNBOOK.md`). Branch protection **to confirm** |
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

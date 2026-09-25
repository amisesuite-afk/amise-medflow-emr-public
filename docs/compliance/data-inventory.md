> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Data inventory and data-flow map

| | |
|---|---|
| Status | Draft v0.2, 2026-09-25 (v0.1: 2026-09-24) |
| Scope | Dashboard (`artifacts/dashboard`), API server (`artifacts/api-server`), front-desk / patient portal (`artifacts/front-desk`), iOS app (`ios/`), Supabase schema (`supabase-*.sql`), backup and CI workflows (`.github/workflows/`) |
| Code baseline | v0.1: `c9a7293` (the tip of `claude/pr-37-gbg22z` when this was written). v0.2 refresh: `cc83845`, plus `23904fd` (questionnaire hand-over mode). Citations added in v0.2 carry a commit; older line numbers refer to `c9a7293` and may have drifted. |
| Out of scope | `artifacts/tax-planner*` and the finance auditor. They hold practice financial data, not patient data, and have not been reviewed. |
| Method | Static read of the code. Nothing here was checked against the live Supabase project, the Render or Vercel dashboards, or vendor contracts. Anything that can only be confirmed in a live system is marked **to confirm**. |

---

## 1. What personal and health data is collected

| Category | Examples | Where it enters | Code evidence |
|---|---|---|---|
| **Identity and contact** | Full name, date of birth, sex, phone, email, address, MRN, patient photo | Web intake, WhatsApp/SMS intake, email intake, staff registration (web and iOS), patient portal | `ios/AmiseMedFlow/Models/Patient.swift` (`fullName`, `dateOfBirth`, `phone`, `email`, `address`). `supabase-patients-full-fields-migration.sql` (the `patient-photos` bucket). `artifacts/dashboard/src/lib/db.ts:170-183` (ID photo upload) |
| **Clinical history** | Chief complaint, HPI, PMH, surgical history, family history, social history, allergies, medications | Questionnaires (APCQ), consultations, voice dictation, document scans | `Patient.swift` (`hpi`, `pmhNotes`, `allergiesJson`, `socialHistory`). Tables `questionnaire_sessions`, `questionnaire_responses`, `patient_intake`, `pmh_items`, `allergies`, `medications` |
| **Examination, vitals and scores** | Vital signs, NEWS2, more than 100 stored risk and severity scores | Clinician entry (web and iOS) | `ios/AmiseMedFlow/Models/VitalsEntry.swift`, `Patient.swift` (score fields). Tables `patient_vitals`, `vitals`, `scales_scores` |
| **Special-category and sensitive** | Mental-health screening (PHQ-9), alcohol use (AUDIT-C), breast-clinic and cancer-screening data, pregnancy status, wound and exam photos | Consultation pathways, screening | `Patient.swift` (`phq9Score`, `auditCScore`). `artifacts/dashboard/src/context/AppContext.tsx` (`pregnancyPossible`, `amise-exam-photos-v1`) |
| **Diagnoses, plans, procedures** | Working diagnosis and ICD-10, differential snapshots, operative plans, op notes, endoscopy reports, prescriptions, referrals, M&M cases | Clinician entry, AI-drafted documents | Tables `clinical_notes`, `operative_notes`, `patient_operative_plans`, `prescriptions`, `referrals`, `mm_cases`, `encounters` |
| **Documents and results** | Lab and imaging reports, referral letters, uploaded PDFs and images | Email inbox scanning, manual upload, patient-portal upload | `artifacts/api-server/src/lib/email-documents.ts`. `routes/investigations.ts`. Buckets `patient-documents` and `clinical-attachments` (`supabase-storage-buckets-migration.sql`) |
| **Communications** | Emails, WhatsApp/SMS threads, AI-drafted replies, voicemail, **recordings of mobile-phone calls**, transcripts | Gmail, Twilio, Meta/Telnyx webhooks, an Android recorder upload | `routes/intake.ts`, `routes/whatsapp.ts`, `routes/call-recording.ts`, `routes/voice.ts`. Table `call_logs`, bucket `call-recordings` (`supabase-call-recordings-storage.sql`) |
| **Scheduling** | Appointment requests, confirmed slots, theatre lists | Intake flows, staff, Google Calendar | Tables `appointment_requests`, `confirmed_appointments`, `theatre_sessions`, `theatre_cases`, `calendar_event_cache` |
| **Billing** | Fee codes, invoices, insurance details | Staff | Tables `patient_billing_items`, `billing_charges` |
| **Staff data** | Staff name, email, role, default site, login events | Supabase Auth | Table `user_profiles`. `audit_log` (user id and email, and IP and user-agent via `logAudit()`). After Migration 89, profiles revoked from portal patients are kept in the admin-only `user_profiles_revoked` (`supabase-staff-only-rls-migration.sql`) |
| **Patient-portal credentials** | Supabase Auth user for each portal patient, SMS login codes | Portal invite and login | `routes/portal.ts:57-80` (`auth.admin.inviteUserByEmail`). `patient-auth-migration.sql` (`patient_accounts`: scrypt hashes, 72-hour temporary passwords) |

---

## 2. Where it is stored

### 2.1 Supabase (primary system of record)

- **Postgres.** Production project `nornhfzfrlmfzaqmrzzp`, per `migrations/README.md` and `docs/INCIDENT-RUNBOOK.md`. The migrations define about 80 tables (`supabase-*.sql`). **Region: unknown / to confirm** in the Supabase dashboard.
- **Storage buckets.** All are created with `public = false`:
  - `patient-photos` and `patient-documents` (`supabase-patients-full-fields-migration.sql:42-83`)
  - `call-recordings` (`supabase-call-recordings-storage.sql:5-9`)
  - `clinical-attachments` (`supabase-storage-buckets-migration.sql:3-8`)

  Note: `artifacts/dashboard/src/lib/db.ts:181` calls `getPublicUrl()` on the private `patient-photos` bucket and stores that URL in `patients.photo_url`. Whether that URL resolves at all, or only behind a signed URL, is **to confirm**.
- **Encryption at rest.** This depends on Supabase platform defaults. The repo itself adds no column-level encryption. **To confirm** from Supabase's security documentation or contract.
- **Point-in-time recovery is disabled.** Verified 2026-08-16 per `docs/INCIDENT-RUNBOOK.md`. The recovery point is daily backups only.

### 2.2 iOS device (SwiftData)

- **The store.** `ios/AmiseMedFlow/AmiseMedFlowApp.swift:19-46` creates a local SwiftData store with `cloudKitDatabase: .none`, so there is no iCloud sync of the database. It holds these models: Patient, ClinicalNote, VitalsEntry, Prescription, PatientDocument, OperativePlan, BillingLineItem, Encounter and ScoreHistoryEntry.
- **File protection.** No explicit `FileProtectionType` is set on the store. `AmiseMedFlow.entitlements` is empty (no `com.apple.developer.default-data-protection`). The store therefore uses the iOS default class, which is expected to be *Complete Until First User Authentication* (**to confirm** on a device). Only the audit queue sets a class explicitly: `ios/AmiseMedFlow/Services/AuditLog.swift:134` (`.completeFileProtectionUntilFirstUserAuthentication`).
- **Device backups.** No `isExcludedFromBackup` is set anywhere. The store is therefore likely included in the clinician's **iCloud or Finder device backups** (**to confirm**).
- **Resetting the store.** If the schema fails to load, the store is copied to `medflow-backup-<timestamp>.store` and a fresh store is created (`AmiseMedFlowApp.swift:31-37`). Those copies accumulate, and nothing prunes them.
- **UserDefaults (not encrypted beyond the default data protection):**
  - the offline outbox (`SyncService+OfflineQueue.swift`, key `com.amise.medflow.sync-outbox`, holding payload values as strings)
  - sync tombstones (`SyncTombstones.swift`, record ids only)
  - the NAS server URL
  - the AI consent flag (`Views/AIConsentGate.swift`)
  - the practice profile (`amf.practiceProfile`: practice and clinician identity, sites, contact lines; `Services/PracticeProfile.swift`, `53d1e52`). Practice data, not patient data
  - sync refusals and appointment links (`SyncRefusals`, `AppointmentLinks`): local record ids only (`8e350a0`, `6d6782f`)
  - bowel-prep regimen sign-offs: a fingerprint of each regimen's wording (`abda6b2`)
- **Keychain.** Holds the NAS WebDAV username and password (`NASBackupService.swift:5-40, 95-112`). The Supabase session uses the SDK default store (**to confirm** that it is the Keychain).
- **Other on-device copies of PHI:**
  - **Local notifications** show the patient's name and appointment type on the lock screen (`Services/NotificationService.swift:49, 71`).
  - **Calendar events** created through EventKit carry the patient's name and procedure (`Services/CalendarService.swift:81-84, 110, 139`). They sync to whichever calendar account the device uses: iCloud, Google or Exchange.

- **Questionnaire hand-over (v0.2, `23904fd`).** While a patient holds the device, walk-in answers are kept **in memory only** and attached to a record, or discarded, after the staff exit. Nothing is written for a walk-in until then.

### 2.3 NAS backups

There are two separate mechanisms.

1. **Server-side nightly backup** (`.github/workflows/backup.yml`)
   - Runs on a **GitHub-hosted runner**. The database is pulled with `pg_dump`, encrypted with GPG AES-256 (`scripts/backup/backup-db.sh:45-51`), and pushed to a Synology NAS over SFTP.
   - Storage is mirrored **unencrypted**, relying on Synology volume encryption (`scripts/backup/backup-storage.sh:4-6`).
   - Only the `patient-documents` bucket is mirrored (`backup.yml`, `SUPABASE_STORAGE_BUCKET: patient-documents`). `call-recordings`, `patient-photos` and `clinical-attachments` are **not** backed up.
   - Retention is 30 daily, 12 monthly and 7 yearly copies (`backup.yml:6`, `scripts/backup/retain.sh`).
   - Whether this workflow's secrets are configured and it actually runs is **to confirm**. `docs/INCIDENT-RUNBOOK.md` does not mention it and describes manual `pg_dump` as the interim mitigation.
2. **iOS WebDAV backup** (`ios/AmiseMedFlow/Services/NASBackupService*.swift`)
   - Uploads summary files (`patients.json`, `notes.json`, `prescriptions.json`, `vitals.json`; `NASBackupService.swift:226-229`) and full chart records (`full-patients.json` and others; `NASBackupService+Restore.swift:45`) as **plaintext JSON**, using HTTP Basic auth, to a URL the user configures (`NASBackupService+WebDAV.swift:26-57`). The code mentions that Tailscale is supported.
   - There is read-back verification and a non-destructive test restore (Settings, "Verify latest backup"). Restore is additive and goes through the peer-sync merge rules (`NASBackupService+Restore.swift:1-8`), so a restore cannot roll a corrupted field back to its earlier value (see hazard H-12).
   - No application-level encryption was found. Transport security depends on the URL the user enters (`https` versus `http`); how App Transport Security treats LAN IPs is **to confirm**.
   - No pruning or retention was found.
3. **Manual `pg_dump`** (`scripts/export-db-backup.sh` / `.ps1`) writes to the operator's desktop, keeping the 14 most recent (`docs/INCIDENT-RUNBOOK.md`). Encryption at rest is left to the operator.

### 2.4 Browser (dashboard)

- **IndexedDB outbox.** Database `amise-sync-outbox` (`artifacts/dashboard/src/lib/sync-outbox.ts`) holds failed autosave payloads, which include clinical content, until they replay. Entries are dropped after 5 retries (`MAX_RETRIES`).
- **localStorage.** Holds the in-progress encounter (`amise-enc-v1`: vitals, symptoms, exam findings, free text), attachments, patient photo and exam photos (`artifacts/dashboard/src/context/AppContext.tsx:829-850, 1006, 1033-1035`), plus the check-in queue and follow-up lists (`CheckInTab.tsx:35`, `FollowUpQueueStrip.tsx:24`).
- **Sign-out does not clear any of this** (unchanged at `cc83845`). `signOut()` (`artifacts/dashboard/src/context/AuthContext.tsx:170-174`) only calls `supabase.auth.signOut()`. No idle auto-logout was found.
- **Supabase session.** `persistSession: true` (`artifacts/dashboard/src/lib/supabase.ts:110`).

### 2.5 Audit trail

- **`audit_log`** is written by the API through `logAudit()`/`audit()` (see `docs/AUDIT-TRAIL-COVERAGE.md`) and by iOS (`ios/AmiseMedFlow/Services/AuditLog.swift`, which queues on device and uploads on sync).
  - The grants are INSERT for `authenticated` and SELECT and INSERT for `service_role`. There is no UPDATE or DELETE grant, so the table is effectively append-only (`supabase-slice-d-audit-migration.sql:42-65`).
  - Only admins and doctors may SELECT.
  - Some payloads contain PHI, such as `patientName` and `diagnosis` (`routes/generate-letter.ts:138`, `routes/discharge-summary.ts:175`).
- **`phiAuditMiddleware`** (`artifacts/api-server/src/lib/phi-audit-middleware.ts`) logs authenticated GETs to PHI routes. **It does not see reads the dashboard makes directly against Supabase.** `artifacts/dashboard/src/lib/db.ts` makes about 65 direct `.from(...)` calls.
- **Legacy tables.** `audit_logs` (plural, from the base schema) and `clinical_audit_log` also exist.
- **New audit events since v0.1:**
  - `soft_delete()` writes `action = 'soft_delete'` in the same transaction as the delete (Migration 87, pending);
  - iOS billing-item and document deletes (`48ac9f7`);
  - iOS bowel-prep sheet exports (`abda6b2`);
  - questionnaire hand-over open, staff exit, and the note written from the answers, with fixed labels only and no answers (`23904fd`);
  - quarantined AI reminder drafts, with the matched rule names (`e094063`).

### 2.6 Logs and telemetry

- **API logs.** Pino JSON goes to Render stdout, and there is no external log sink (`docs/INCIDENT-RUNBOOK.md`). Only `authorization`, `cookie` and `set-cookie` are redacted (`artifacts/api-server/src/lib/logger.ts:13-17`). The SMS helper logs recipient phone numbers and, in dry-run mode, the first 60 characters of the message body (`artifacts/api-server/src/lib/sms.ts:58`). **Render log retention: to confirm.**
- **Sentry.** See `subprocessors.md`. Web and API initialise Sentry with default options and no `beforeSend` scrubbing:
  - `artifacts/dashboard/src/main.tsx:14-17`
  - `artifacts/api-server/src/index.ts:11-15`

  iOS has a PHI-minimised configuration (`ios/AmiseMedFlow/Services/CrashReporting.swift`: no screenshots, no view hierarchy, no network breadcrumbs, `sendDefaultPii = false`, and `beforeSend` strips user and request).

---

## 3. Retention

**No automated retention or deletion of clinical records exists anywhere in the codebase.** A search for purge, retention and time-based deletion found only the items below.

| Data | Retention found in code | Notes |
|---|---|---|
| Clinical records (Supabase) | Indefinite. No purge job | The legal minimum and maximum for Saint Lucia medical records is **unknown / to confirm with counsel** |
| `audit_log` | Indefinite. Append-only (no UPDATE or DELETE grant) | |
| Questionnaire links | 7 days (`supabase-questionnaire-token-expiry-migration.sql:10`) | |
| Soft-deleted rows (`clinical_notes`, `prescriptions`, `patient_vitals`, `patient_billing_items`, `patient_documents`) | Indefinite. Migration 87 sets `deleted_at`; nothing purges the row | Deletion hides a record; it does not erase it. The retention schedule (A-17) must say when, if ever, soft-deleted rows are purged |
| `user_profiles_revoked` | Indefinite (Migration 89) | Kept so an admin can restore a wrongly revoked staff profile |
| Portal temporary passwords | 72 hours (`patient-auth-migration.sql` header) | |
| Server NAS backups | 30 daily, 12 monthly, 7 yearly (`.github/workflows/backup.yml:6`) | Yearly backups outlive any deletion made in the live database |
| iOS WebDAV backups | Indefinite. No pruning found | |
| iOS store-reset copies | Indefinite (`AmiseMedFlowApp.swift:33-35`) | |
| iOS tombstones | Last 5,000 ids per table (`SyncTombstones.swift:28`) | |
| Dashboard IndexedDB and localStorage | Until replayed, or until the browser data is cleared. Not cleared on sign-out | |
| Render logs, Sentry events, and vendor-side copies (Twilio messages and recordings, Gmail, Anthropic, OpenAI) | Vendor defaults, **to confirm** | |

---

## 4. Who can access it (role model)

Source: `CLAUDE.md` ("Auth model is single-tenant, role-based"), `supabase-schema.sql:295-297` (`auth_role()`) and `artifacts/dashboard/src/lib/roles.ts`.

- **Staff roles.** `user_profiles.role` is one of `front_desk` < `nurse` < `doctor` < `admin`.
- **The UI gates sections by role.** For example, assessment, plan, prescriptions and the AI consultant need `doctor` (`roles.ts:36-47`). This gate exists **only in the browser**.
- **Database, via row-level security. As applied in production today** (Migrations 87–90 not yet applied):
  - `patients` and `documents`: SELECT for any row where `auth.uid() is not null` (`supabase-schema.sql:319-320`, `supabase-clinical-records-migration.sql:312-313`).
  - `appointment_requests`: `staff_all ... using (true)` (`supabase-schema.sql:502`).
  - `clinical_notes`: narrowed by `auth_role()` and status. Drafts are visible to the author and admins only (`supabase-clinical-records-migration.sql:296-306`).
- **Once Migration 89 is applied** (`supabase-staff-only-rls-migration.sql`, pending):
  - staff policies on about 55 PHI tables and the four storage buckets require `auth_role() in ('front_desk','nurse','doctor','admin')`;
  - a new auth user gets a staff profile only when an admin creates one, or sets `app_metadata.staff_role` through the admin API. Portal patients no longer get an automatic `front_desk` profile;
  - `patients` UPDATE: front desk may change identity, contact, next-of-kin, insurance, scheduling and patient-reported intake columns only; a portal patient only their own contact and profile fields. Anything else fails with `42501`;
  - soft deletes go through `soft_delete()` (Migration 87), which checks the role per table and refuses front desk.
- **There is no per-patient or per-tenant isolation**, before or after Migration 89. Every staff user can read every patient. See `docs/MULTI-TENANCY-PLAN.md`.
- **API server.** It connects as `service_role` and bypasses RLS (and the Migration 89 column guards). Its route gate, `requireStaffAuth()` (`artifacts/api-server/src/lib/supabase.ts`), accepts a Supabase user JWT whose user has a staff `user_profiles` role (`f3338ca`), or `x-staff-token` equal to `STAFF_MACHINE_TOKEN` (or to `CRON_SECRET` while `STAFF_MACHINE_TOKEN` is unset; `e6cbf09`). Only one route checks for a *specific* role on the server: `routes/visit-lifecycle.ts`, which requires `doctor`.
- **Patient-portal users are Supabase Auth users in the same project** (`routes/portal.ts:65`). They have "own record" policies (`supabase-patient-portal-migration.sql:41-87`). Postgres combines permissive policies with OR, so until Migration 89 is applied the staff policy `auth.uid() is not null` **does** give portal patients read access to all patient, document and booking rows and bucket objects. This was confirmed in a local emulator, not in production. See `security-controls.md` S-2.
- **iOS.** Signs in with the same Supabase Auth, so RLS applies. A front-desk device sends only the allow-listed patient columns (`FrontDeskPatientColumns`). Peer-to-peer sync shares the full local dataset with nearby devices that present the same email hash (see `security-controls.md` S-5, open).
- **Front-desk staff API.** `/api/staff/*` runs with the service-role key. Each handler now validates the session and requires a staff role (`artifacts/front-desk/lib/staff-auth.ts`, `19a7479`). See `security-controls.md` S-1.

---

## 5. Data flows to each subprocessor

✅ = flow confirmed in code. ⚙️ = conditional on configuration (an env var or a user setting). ⛔ = not implemented.

| # | Recipient | Direction and data | Trigger | Code |
|---|---|---|---|---|
| 1 | **Supabase** ✅ | Everything: all tables, storage objects, auth (staff and patients) | All apps | `artifacts/*/src/lib/supabase.ts`, `ios/AmiseMedFlow/Services/SupabaseConfig.swift`, `SyncService*.swift` |
| 2 | **Google Gmail** ✅ | Reads the practice inbox: patient emails and lab-result attachments. Sends or drafts replies, reminders and prep instructions | Intake cron, reminders, document intake | `artifacts/api-server/src/lib/gmail.ts`, `lib/email-documents.ts`, `routes/intake.ts`, `routes/cron.ts`, `artifacts/front-desk/lib/email.ts` |
| 3 | **Google Calendar** ✅ | Writes appointment events (patient name, appointment type, location). Reads busy slots | Booking and scheduling. Writes blocked under `MODE=dry_run` (`e094063`) | `artifacts/api-server/src/lib/calendar.ts`, `routes/scheduling.ts` |
| 4 | **Twilio** ✅⚙️ | Patient phone numbers and message bodies (SMS and WhatsApp). Inbound messages. Voice calls, voicemail recordings and optional Twilio transcription | `SMS_PROVIDER=twilio` and `MODE` not `dry_run` (api-server: one gate, `lib/outbound.ts`; front-desk: its own check, see `security-controls.md` G-17). Transcription off with `DISABLE_TRANSCRIPTION` or `DISABLE_AI` | `artifacts/api-server/src/lib/sms.ts:61-100`, `artifacts/front-desk/lib/twilio.ts`, `routes/calls.ts`, `routes/whatsapp.ts` |
| 5 | **Meta (WhatsApp Cloud API)** ⚙️ | Patient phone numbers and reply text. Inbound messages via webhook | `WHATSAPP_ACCESS_TOKEN` set, and `MODE` not `dry_run` (gated since `e094063`) | `lib/whatsapp-send.ts`, `routes/whatsapp.ts` |
| 6 | **Telnyx** ⚙️ | Patient phone numbers and reply text | `TELNYX_API_KEY` set, and `MODE` not `dry_run` (gated since `e094063`) | `lib/whatsapp-send.ts` |
| 7 | **Digicel SMS** ⛔ | **No data flows today.** `SMS_PROVIDER=digicel` throws "not implemented" | n/a | `artifacts/api-server/src/lib/sms.ts:103-105` |
| 8 | **Anthropic (Claude)** ✅⚙️ | **Web and API: identifiable PHI is sent.** See §6 | `ANTHROPIC_API_KEY` set and `DISABLE_AI` not `true`. `DISABLE_AI=true` now covers every call site in the API and the front-desk intake (see §6) | See §6 |
| 9 | **OpenAI Whisper** ⚙️ | Audio of uploaded mobile-phone call recordings, sent for transcription | `OPENAI_API_KEY` set, and neither `DISABLE_AI=true` nor `DISABLE_TRANSCRIPTION=true` | `routes/call-recording.ts` (`transcribeWithWhisper`) |
| 10 | **Sentry** ⚙️ | Error events: stack traces, and potentially error messages, URLs and breadcrumbs from web and API. PHI-minimised crash data from iOS | `SENTRY_DSN` / `VITE_SENTRY_DSN` / iOS `SENTRY_DSN` set | `artifacts/dashboard/src/main.tsx:14-17`, `artifacts/api-server/src/index.ts:11-15`, `ios/.../CrashReporting.swift` |
| 11 | **Vercel** ✅ | Hosts the dashboard, front-desk and finance-auditor apps. **All `/api/*` traffic from those apps is rewritten through Vercel to Render** (see each app's `vercel.json`), so PHI is in transit through Vercel. The front-desk Next.js API routes run on Vercel with the Supabase service-role key (`artifacts/front-desk/app/api/staff/*`) | Always | `.github/workflows/deploy-*.yml`, `docs/INCIDENT-RUNBOOK.md` |
| 12 | **Render** ✅ | Hosts the API server. Processes all PHI handled by the API. Holds all secrets and stdout logs | Always | `render.yaml`, `docs/INCIDENT-RUNBOOK.md` |
| 13 | **GitHub (Actions)** ✅ | The nightly backup runner handles a full DB dump (encrypted before upload, but plaintext in runner memory and disk during the job). Cron triggers and migrations run here too | Nightly and manual | `.github/workflows/backup.yml`, `cron.yml`, `run-migrations.yml` |
| 14 | **Synology NAS (practice-owned)** ⚙️ | Full DB dumps (GPG), the `patient-documents` mirror (unencrypted, relying on volume encryption), and iOS JSON exports (plaintext) | Nightly, or user-initiated on iOS | See §2.3 |
| 15 | **Apple** ✅ | **Speech recognition is on-device whenever the recogniser supports it** (`16435f3`, `ios/.../SpeechService.swift`); otherwise dictated clinical speech goes to Apple's servers. Device backups (iCloud) may include the SwiftData store. EventKit calendar events may sync to iCloud. Push and local notifications | iOS use | See §2.2 |
| 16 | **api.qrserver.com (goQR.me)** ⛔ | **No data flows today (fixed).** The dashboard used to send the patient's questionnaire URL, including its session token, to this third party to render a QR code. It now generates the QR code in the browser | n/a | `artifacts/dashboard/src/components/LocalQrCode.tsx`; CI lint `scripts/src/lint-no-external-qr.ts` |
| 17 | **jsDelivr CDN** ✅ | The browser downloads the ONNX/WASM runtime for in-browser Whisper.js transcription. No PHI is sent; audio is processed locally (**to confirm**) | Dictation in non-Chrome browsers | `artifacts/dashboard/src/workers/asr-worker.ts:23` |
| 18 | **Google Fonts** ✅ | Browser IP and user-agent only | Page load | Font links in the web apps |
| 19 | **Ollama (self-hosted, optional)** ⚙️ | Clinical narrative text, sent to a user-configured LAN or loopback model | The user selects "ollama" in Settings. The default is `cloud` | `artifacts/dashboard/src/lib/ai-provider.ts:24-43` |
| 20 | **Railway** ❓ | `railway.json` exists. Whether it is used in production is **unknown / to confirm** | n/a | `railway.json` |

---

## 6. Anthropic: accurate statement of current use

- **iOS: disabled.** Every generation method in `ios/AmiseMedFlow/Services/AIService.swift` throws `AIError.disabled` ("intentionally disabled pending HIPAA compliance review ... once a BAA is in place"). The Bayesian, scoring and management engines on iOS are deterministic and make no network calls.
  - Two iOS screens still describe AI data transmission: the consent sheet (`Views/AIConsentGate.swift`, which says "de-contextualised patient data is sent") and Settings (`Views/SettingsView.swift:277`). Their wording is inconsistent with the stubbed service.
  - `AIService.clinicalContext()` would include the **patient's full name** if re-enabled (`AIService.swift:23`), so the "de-contextualised" claim is not accurate as written.
- **Web and API: enabled whenever `ANTHROPIC_API_KEY` is set.**
  - **`DISABLE_AI=true` is a complete off switch** for the API and the front-desk intake (fixed; previously it covered only 3 of 18 API files). See "Kill switch coverage" below. Removing `ANTHROPIC_API_KEY` still also works.
  - **Identifiable PHI is sent.** Examples:
    - name, age, sex and DOB (`routes/ai-consult.ts:109`)
    - DOB (`routes/generate-letter.ts:77`)
    - name and MRN (`routes/discharge-summary.ts:71-89`)
    - full patient emails (`lib/claude.ts`, `classifyMessage`, truncated to 4,000 characters)
    - clinical narratives, voice transcripts, scanned documents and referral letters (`routes/narrative.ts`, `voice.ts`, `document-scan.ts`, `investigations.ts`)
  - No de-identification step exists (a search for `deidentif`/`anonymi` found nothing).
- **Patient-facing conversational intake (front-desk).** `artifacts/front-desk/lib/claude.ts` sends the whole WhatsApp/SMS conversation, including the name, DOB, symptoms, PMH, medications and allergies it collects, to `claude-haiku-4-5-20251001`.
- **API routes calling Anthropic:** `ai-consult`, `discharge-summary`, `document-scan`, `generate-endoscopy-report`, `generate-letter`, `generate-operative-note`, `investigations`, `mm-cases`, `narrative`, `portal`, `previsit`, `procedure-report`, `questionnaire`, `suggest-codes`, `summary`, `voice` and `whatsapp`, plus `lib/claude.ts`.

### Kill switch coverage (`DISABLE_AI`)

- **One gate per deployment.** `artifacts/api-server/src/lib/ai-gate.ts` (replaces `lib/ai-guard.ts`) and `artifacts/front-desk/lib/ai-gate.ts`. Same variable and semantics as before: AI is off only when `DISABLE_AI` is exactly `true`. It is now read on every call, not once at import.
- **Two layers.**
  - Every Anthropic client is built by `createAnthropicClient()`. Its `messages.create` / `stream` / `countTokens` / `parse` refuse to run while AI is disabled, so a route that forgets its own check still sends nothing.
  - Each route checks first and degrades gracefully (below).
- **CI enforcement.** `api-server/src/test/ai-gate.test.ts` and `front-desk/test/ai-gate.test.ts` fail if `new Anthropic(` appears outside `ai-gate.ts`. They mock the SDK and assert that no client method is called with `DISABLE_AI=true` across the routes below.
- **Set it in both places.** Render (API) and the front-desk Vercel project each read their own environment. See `docs/INCIDENT-RUNBOOK.md`.
- **Transcription decision.** `DISABLE_AI=true` also stops Whisper, because OpenAI is an AI vendor receiving PHI (call audio). A separate `DISABLE_TRANSCRIPTION=true` stops only transcription (Whisper and Twilio voicemail transcription) and leaves Claude on. Recordings are still stored, with `transcription_status = 'skipped'`.

| Call site | With `DISABLE_AI=true` |
|---|---|
| `lib/claude.ts` `classifyMessage` / `draftReply` (email intake, reminders) | Existing fallback: `unknown` classification for manual review, and a placeholder draft for staff to replace |
| `ai-consult.ts`: `/api/ai-consult`, `/api/ai/edit-note`, `/api/ai/fill-document`, `/api/ai/drug-interactions` | 503 `{ error, disabled: true }` |
| `mm-cases.ts` `/api/mm-cases/:id/analysis` | 503. M&M case CRUD is unaffected |
| `narrative.ts`, `voice.ts`, `suggest-codes.ts`, `previsit.ts` `/ai-format` | 503 |
| `discharge-summary.ts`, `procedure-report.ts`, `generate-letter.ts`, `generate-operative-note.ts`, `generate-endoscopy-report.ts` | 503, before any stream is opened |
| `summary.ts` `/api/summary/generate`, `/api/soap/polish` | Existing deterministic template fallback (as when no API key is set) |
| `summary.ts` `/api/ai/refine` | 503 |
| `document-scan.ts` | Local markitdown and native parser only. A low-confidence parse is returned with a "review against the original" flag. An image or scan with no text layer gets 503 |
| `investigations.ts` `/extract-results`, `/scan-referral` | 503 |
| `investigations.ts` `/api/documents/:id/extract` (folder watcher) | 200 `{ ok: true, skipped: 'ai_disabled' }`, so the watcher does not retry |
| `portal.ts` `generateSummary` / `extractDocumentInsights` (background) | Skipped. `ai_summary` stays null, and `ai_extraction_status` stays `pending` for manual review or a later re-run. The staff re-trigger endpoints return 503 |
| `questionnaire.ts` intake summary (background) | Deterministic row: chief complaint from the patient's answer, no narrative, urgency from the questionnaire red flags (the urgency floor still applies), `model_used = 'none (DISABLE_AI=true)'` |
| `questionnaire.ts` vitals photo (patient-facing) | 503 with patient-worded text ("skip this optional step") |
| `whatsapp.ts` `generateDraft` | No draft (null). The message is stored and staff reply manually |
| `call-recording.ts` Whisper | Not called. Audio stored, `transcription_status = 'skipped'` |
| `calls.ts` Twilio voicemail transcription | `transcribe="false"` |
| front-desk `lib/claude.ts` `runIntakeTurn` (WhatsApp/SMS/web intake) | Deterministic PANE triage only. An emergency gets the fixed ER/911 redirect and escalates. Everything else gets a holding reply for staff. No fields are extracted and no slots are offered |
| front-desk `lib/claude.ts` `draftProcedurePrepAdjustment` | No draft. The standard prep message is unaffected |

The dashboard has no server-side AI calls. Its in-browser Whisper.js dictation runs locally, and its AI features go through the API routes above.
- **The default model is inconsistent with `CLAUDE.md`.** `CLAUDE.md` states the default is `claude-haiku-4-5-20251001`, but the code defaults vary by route:
  - `claude-opus-4-5`: `lib/claude.ts:7`, `questionnaire.ts:30`, `investigations.ts:14`
  - `claude-sonnet-4-6`: most document routes
  - Haiku: `voice`, `narrative`, `portal`, `whatsapp`

  This matters for data-processing terms only if they differ by model (**to confirm**).
- **Contract status.** Whether a BAA, DPA or zero-data-retention arrangement with Anthropic is in place is **unknown / to confirm**. The iOS code comments imply none is signed yet.

---

## 7. Open questions

1. Supabase, Render and Vercel regions, and whether data leaves the Caribbean or the US. Any cross-border transfer rules under the Saint Lucia Data Protection Act.
2. Whether the Gmail account is Google Workspace, which can carry a DPA or BAA, or consumer Gmail, which cannot.
3. Whether the nightly `backup.yml` workflow is live, and whether a restore has ever been tested.
4. Legal basis and consent for recording staff mobile-phone calls with patients (`routes/call-recording.ts`).
5. Statutory retention period for medical records in Saint Lucia, and for any future market.
6. Whether `photo_url` public URLs from a private bucket are reachable without authentication.
7. (v0.2) The `MODE` value on the front-desk Vercel project. Its email sender sends unless `MODE` is exactly `dry_run` (`security-controls.md` G-17).
8. (v0.2) When Migrations 87–90 will be applied to production. Until Migration 89 runs, the portal-patient exposure in §4 stands.

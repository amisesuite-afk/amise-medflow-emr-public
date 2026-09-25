> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Compliance document pack

This is the legal, regulatory and clinical-safety groundwork for AMISE MedFlow EMR before it is sold to other practices.

| | |
|---|---|
| Prepared | 2026-09-24. Refreshed 2026-09-25 (see [Changes since first draft](#changes-since-first-draft-2026-09-25)) |
| Code baseline | First draft: `c9a7293`. Refresh: `cc83845` (tip of `claude/pr-37-gbg22z`) plus `23904fd` (questionnaire hand-over mode, merged on that branch after `cc83845`). New citations carry a commit; older line numbers refer to `c9a7293` and may have drifted |
| How this was produced | Static reading of the code, migrations, workflows and commit history. **Nothing was verified against production** (Supabase, Render, Vercel, vendor contracts). Anything that needs a live check is marked **to confirm** or **to verify** |
| What it is not | Legal advice or a regulatory determination. It frames the decisions and evidence for a lawyer, a Clinical Safety Officer (CSO) and regulatory counsel. **No item in this pack has been reviewed or approved by a CSO** |

## Index

| Document | Purpose | Audience |
|---|---|---|
| [`data-inventory.md`](data-inventory.md) | What personal and health data is collected. Where it is stored (Supabase, iOS SwiftData, NAS, IndexedDB, audit_log). Retention. Who can access it. Data flows to each subprocessor. An accurate statement of AI use | Counsel, owner, engineering |
| [`subprocessors.md`](subprocessors.md) | Vendor register: purpose, data, region, DPA/BAA need, status | Counsel, owner |
| [`privacy-policy-draft.md`](privacy-policy-draft.md) | Patient-facing privacy notice (Saint Lucia DPA 2011 framing, with GDPR and HIPAA annex) | Patients (after legal review) |
| [`terms-of-use-draft.md`](terms-of-use-draft.md) | Clinician terms: decision support only, clinician retains responsibility | Staff and clinician users |
| [`clinical-safety-case.md`](clinical-safety-case.md) | DCB0129-style safety argument, evidence, gaps and sign-off | CSO, owner |
| [`hazard-log.md`](hazard-log.md) | 20 hazards with causes, effects, cited controls, initial and residual risk (5×5), and actions. v0.2 adds a status and a proposed re-rating for each | CSO, engineering |
| [`medical-device-positioning.md`](medical-device-positioning.md) | SaMD assessment (MHRA, EU MDR Rule 11, FDA CDS four criteria), recommended positioning, and where labels would go in the UI | Owner, regulatory counsel |
| [`security-controls.md`](security-controls.md) | Current controls, known gaps, priority findings S-1 to S-6, pen-test and SOC 2 readiness checklists | Owner, engineering, auditors |

Related documents: `docs/MULTI-TENANCY-PLAN.md` (new: how to sell to other practices), `docs/SECRETS-HYGIENE.md`, `docs/AUDIT-TRAIL-COVERAGE.md`, `docs/INCIDENT-RUNBOOK.md`, `migrations/README.md`, `CLAUDE.md`.

`privacy-policy-draft.md`, `terms-of-use-draft.md` and `medical-device-positioning.md` were not changed in the refresh. `clinical-safety-case.md` has only a refresh note pointing to the hazard log. Their framing still holds; read the hazard statuses from `hazard-log.md`.

## Headline findings (as of 2026-09-25)

**Status terms.** *Fixed in code*: merged, with commit and file cited, not verified in production. *Pending migration*: needs Migrations 87–90, wired into `run-migrations.yml` but **not yet applied to production**. *Pending env*: needs a variable set on Render or Vercel. *Pending surgeon decision*: waiting for the practice owner's clinical decision. *Open*: no fix yet.

1. **Access control.**
   - Front-desk `/api/staff/*` cookie check (S-1): **fixed in code** (`19a7479`).
   - `requireStaffAuth()` accepting any Supabase JWT (S-3): **fixed in code** (`f3338ca`). The separate machine secret `STAFF_MACHINE_TOKEN` (`e6cbf09`) is **pending env**.
   - Portal patients reading all patients through open RLS policies (S-2): **pending migration**. Migration 89 is written and verified in a local emulator. **Until it is applied, a portal patient's own JWT can read every patient, document and booking directly from Supabase.** This is the most urgent open item.
2. **No multi-tenant isolation.** Unchanged. Every staff user sees every patient. This blocks multi-practice sale until each customer has an isolated stack or a tenant model is built. Plan: `docs/MULTI-TENANCY-PLAN.md`.
3. **NEWS2:** **fixed in code** on iOS (`485f85d`) and web (`e682e87`). One RCP-2017 engine per platform, tested with the same boundary vectors (copied between the Swift and TypeScript suites; no CI step compares the two engines). Scale 2 is a clinician opt-in; its cloud sync is pending Migration 88. H-04 proposed residual falls from 4 to 2. CSO sign-off outstanding.
4. **Outbound messaging:** **fixed in code** in the api-server (`e094063`). One MODE gate for every send; AI reminders are screened; no medication-hold advice in any patient text, enforced by `lint:patient-instructions` and tests (H-09, H-10 proposed residual 2). **Open:** the front-desk app's own MODE checks do not fail closed (G-17).
5. **AI.** Anthropic still receives **identifiable PHI** from the web and API when enabled, with no de-identification. `DISABLE_AI=true` is a complete, CI-tested kill switch (`113b1d9`). iOS AI is disabled. **No BAA or DPA is recorded** with any vendor.
6. **Sync and data integrity.** Deletes propagate once Migration 87 is applied. iOS no longer loses offline edits to a pull, keeps syncing past a refused record, and sends offline work over peer sync. **Open:** peer sync still keeps the longer copy of allergies and history regardless of time (H-12).
7. **Regulatory.** Unchanged. Patient-facing triage, NEWS2 escalation, the Bayesian differential and the AI consult are **likely medical-device functions** in the UK, the EU and the US.

## Status of open actions and owners

**Owner key**

- **PO**: practice owner (Dr Kabiye, or the legal entity)
- **CSO**: Clinical Safety Officer (not yet appointed)
- **ENG**: engineering
- **LAW**: Saint Lucia counsel
- **REG**: regulatory counsel
- **PHARM**: clinical pharmacist

"Signs" names who must formally approve or sign. A status of "fixed in code" never means signed off.

| # | Action | Owner | Signs | Priority | Status (2026-09-25) | Ref |
|---|---|---|---|---|---|---|
| A-1 | Verify and fix S-1 (front-desk cookie check), S-2 (RLS vs portal users) and S-3 (`requireStaffAuth`). Add a live RLS test as a patient user | ENG | PO (authorises the emergency change) | **P0** | S-1 and S-3 **fixed in code** (`19a7479`, `f3338ca`). S-2 **pending migration** (89). Live RLS test as a patient user: **open** (local emulator only) | `security-controls.md` §3 |
| A-2 | Collect or sign DPAs (and BAAs if in HIPAA scope) with Supabase, Render, Vercel, Google Workspace and Twilio. Confirm that the Gmail account is Workspace | PO | **PO signs** each agreement | **P0** | Open. Not yet signed / unknown | `subprocessors.md` |
| A-3 | Anthropic and OpenAI: sign a BAA/DPA with zero retention, **or** switch them off in production | PO | **PO signs** the agreement or approves the switch-off | **P0** | Open. The switch is ready: `DISABLE_AI=true` on Render and the front-desk Vercel project (A-20). Whether it is set is **to confirm** | `subprocessors.md` #9-10 |
| A-4 | Hide or label the dashboard NEWS2 panel now. Replace the three implementations with one tested implementation | ENG | **CSO** signs the fix | **P0** | **Fixed in code** (`485f85d`, `2abb3cc`, `e682e87`). Scale 2 cloud sync **pending migration** (88). **CSO sign-off open** | H-04 |
| A-5 | Rewrite the prep-instruction medication wording. Remove or justify the forced `'auto'` in `cron.ts:85`. Check `draft.safe` | PO (clinical content), ENG | **PO** approves the wording | **P0** | **Fixed in code** (`e094063`, `38a7891`, `996fe1b`, `b9ae85b`, `ba47093`). Wording follows the surgeon's recorded decisions; PO to record formal approval in the safety case | H-09, H-10 |
| A-6 | Appoint a CSO. Write a Clinical Risk Management Plan. Review and accept the hazard log | PO | **PO** appoints. **CSO** signs the safety case | P1 | Open | `clinical-safety-case.md` |
| A-7 | Remove the api.qrserver.com call (session token leak) | ENG | — | P1 | **Done**: local QR generation (`LocalQrCode.tsx`) and a CI lint (`lint:no-external-qr`) (`f430146`) | S-4 |
| A-8 | iOS peer-sync authentication hardening, or disable peer sync by default | ENG | CSO/PO accepts the residual risk | P1 | Open | S-5 |
| A-9 | Add PHI scrubbing to web and API Sentry | ENG | — | P1 | Open | S-6 |
| A-10 | Clinical-field merge with timestamps or conflict prompts. Server-side soft delete | ENG | CSO | P1 | Soft delete **pending migration** (87; `cad8d9c`, `48ac9f7`, `8f8a467`). Clinical-field merge **open** (longer copy still wins) | H-12, H-14 |
| A-11 | Map drug-interaction classes to drugs, or license a database. Add the "absence of alert" label. Pharmacist review of formulary and dosing content | ENG, PHARM | **CSO** | P1 | Mapping and label **fixed in code** on both platforms, with a parity lint (`2f111c3`, `31521d3`, `19406ae`, `8e32180`). Opioid + benzodiazepine grade **pending surgeon decision**. Pharmacist review **open** | H-07, H-08 |
| A-12 | Clear browser PHI caches on sign-out. Idle timeout. Staff MFA | ENG | — | P1 | Open | G-4, G-5, H-16 |
| A-13 | Obtain Saint Lucia legal advice: DPA 2011 commencement and registration, lawful bases, medical-records retention period, cross-border transfers, **consent for call recording**, liability wording | LAW | **LAW** advises. **PO** approves the published notice and terms | P1 | Open | `privacy-policy-draft.md`, `terms-of-use-draft.md` |
| A-14 | Regulatory positioning decision (records-only abroad versus a UKCA/CE programme). Answer the counsel questions | REG, PO | **PO** decides | P1 (before any non-Saint Lucia sale) | Open | `medical-device-positioning.md` §6 |
| A-15 | Implement the UI labelling changes L1-L16 | ENG | CSO reviews the wording | P2 | Open. The interaction "absence of an alert" label (part of A-11) and the NEWS2 "incomplete" marker are done | `medical-device-positioning.md` §5 |
| A-16 | Terms-of-use acceptance on sign-in, versioned and logged | ENG | LAW approves the text | P2 | Open | `terms-of-use-draft.md` |
| A-17 | Retention schedule and a deletion or anonymisation process (including backups and devices) | PO, LAW, ENG | **PO** approves the schedule | P2 | Open. Must now also cover soft-deleted rows, which are never purged | `data-inventory.md` §3 |
| A-18 | Enable PITR, or document acceptance of the ~24-hour RPO. Back up all storage buckets. Hold a restore drill | PO (budget), ENG | **PO** | P2 | Open | H-13, G-10 |
| A-19 | iOS: explicit file protection, exclude the store from backups, on-device dictation, minimise PHI in notifications and calendar events | ENG | — | P2 | On-device dictation **fixed in code** where supported (`16435f3`). The rest open | G-11, G-12 |
| A-20 | Make `DISABLE_AI` cover all AI routes, including the front-desk intake | ENG | — | P2 | **Done**: `lib/ai-gate.ts` in api-server and front-desk, CI-tested. Also covers Whisper; `DISABLE_TRANSCRIPTION` added (`113b1d9`) | G-8 |
| A-21 | Multi-tenant architecture (or a per-customer isolated stack) before multi-practice sale | ENG, PO | PO | P1 (sale blocker) | Open. Plan written (`docs/MULTI-TENANCY-PLAN.md`). iOS practice identity is configurable (`53d1e52`, `6e15238`, `1572c87`) | G-1 |
| A-22 | Enable GitHub secret scanning and push protection. First rotation of secrets | PO (repo admin), ENG | — | P2 | Open. Add `STAFF_MACHINE_TOKEN` to the rotation list | `docs/SECRETS-HYGIENE.md` |
| A-23 | Pen test (staging environment with synthetic data), then SOC 2 Type I readiness | PO (commissions), ENG | PO | P2 | Open | `security-controls.md` §4-5 |
| A-24 | Confirm the facts marked "to confirm": vendor regions, Render and Sentry configuration, whether `backup.yml` is live, whether Railway, Meta or Telnyx are in use | ENG, PO | — | P2 | Open | `data-inventory.md` §7 |
| A-25 | **Apply Migrations 87–90 to production.** Run the Migration 89 pre-flight queries, take a backup, then run `run-migrations.yml` (its first complete run on production) | ENG | **PO** authorises the run | **P0** | New. Pending | `migrations/README.md`, G-18 |
| A-26 | Set `STAFF_MACHINE_TOKEN` on Render and the front-desk Vercel project together, then remove `CRON_SECRET` from front-desk | ENG | — | P1 | New. Pending env | S-3, G-19 |
| A-27 | Make the front-desk MODE checks fail closed like the api-server's, and confirm the front-desk `MODE` value | ENG | — | P1 | New. Open | G-17, H-09 |
| A-28 | Surgeon decisions: opioid + benzodiazepine grade (web contraindicated, iOS major); whether a front-desk device may write `hpi` and create the pre-visit note after Migration 89; sign-off of each iOS bowel-prep regimen on the production devices; whether to enable `REMINDER_EMAIL_AUTO_SEND` (off by default) | PO | **PO** decides | P1 | New. Pending surgeon decision | H-07, H-13, H-08, H-09 |

## Changes since first draft (2026-09-25)

Refreshed against `cc83845` (41 commits after the first draft `7dff890`, plus 17 commits between the draft's stated baseline `c9a7293` and `7dff890` that it did not yet reflect) and `23904fd`. Documents updated: this README, `hazard-log.md`, `security-controls.md`, `data-inventory.md` and `subprocessors.md`, plus a refresh note in `clinical-safety-case.md`. New: `docs/MULTI-TENANCY-PLAN.md`.

**Fixed in code**

| Area | What changed | Commits | Refs |
|---|---|---|---|
| NEWS2 | One RCP-2017 chart on iOS (`NEWS2Chart.swift`) and a TypeScript twin on the web (`lib/triage-engine/src/news2.ts`) for every panel. Consciousness and oxygen scored; Scale 2 only by clinician opt-in; single-parameter red flag regardless of missing values; incomplete scores marked. The web tests port every iOS boundary vector | `485f85d`, `2abb3cc`, `e682e87` | H-04, A-4 |
| Other scores | qSOFA without the infection tick; Glasgow-Imrie criteria; saved-score lookup; boundary tests | `13166b8`, `61780fa`, `0e62bf8`, `4370325` | H-05 |
| Drug interactions | Class-to-drug mapping with brands and sources on both platforms; false "arb" and "5-ASA" alerts removed; each platform given the other's rules; `lint:interaction-parity` in CI; "absence of an alert" label | `2f111c3`, `31521d3`, `19406ae`, `8e32180` | H-07, A-11 |
| Outbound MODE gate | `lib/outbound.ts` gates every api-server send (email, SMS, WhatsApp via Twilio, Meta and Telnyx, calendar). Unknown MODE fails closed; no override lifts `dry_run`. The 24-hour reminder follows MODE and its AI body is screened | `e094063` | H-09, A-5 |
| Medication-hold advice | Removed from every patient text (api-server templates, front-desk booking emails and public pages, staff prep text). Standard fasting rules. Booking types mapped to instructions explicitly. `lint:patient-instructions` and `outbound-safety.test.ts` enforce it | `e094063`, `ba47093`, `38a7891`, `b9ae85b`, `996fe1b` | H-10, A-5 |
| Staff auth | Front-desk `/api/staff/*` validates the session and role; api-server staff routes require a staff role; separate `STAFF_MACHINE_TOKEN` | `19a7479`, `f3338ca`, `e6cbf09` | S-1, S-3, A-1 |
| AI kill switch | `DISABLE_AI=true` covers every Anthropic and Whisper call in the api-server and front-desk, with graceful fallbacks, CI-tested. `DISABLE_TRANSCRIPTION` added | `113b1d9` | G-8, A-20 |
| QR codes | Generated in the browser; `lint:no-external-qr` | `f430146` | S-4, A-7 |
| iOS sync | Pull never overwrites unsent edits; later edits to prescriptions, vitals and billing are pushed and pulled; peer sync keeps unsent changes pending and sends offline work; refused records are kept and the rest of the sync continues; 0-row RLS updates recognised as refusals; booking placeholder ids never sent; prescription route and dose values accepted by the server | `e51e40c`, `a672137`, `70ade9d`, `6d6782f`, `dac2823`, `8e350a0`, `9565db7`, `717a03e`, `746d289`, `6a1e96c`, `cc83845` | H-12, H-13, H-14 |
| Duplicates and allergies | A duplicate holding any clinical data is never hidden; an empty allergy list reads "not recorded", never NKDA | `79eaa1e`, `cd35bdf` | H-15 |
| Migration runner | Applies to a fresh database and re-runs cleanly; `check:migrations-fresh` in CI; stricter `lint:rls-policies` | `8824214`, `bf6f602`, `dd49997` | G-18 |
| iOS privacy | On-device dictation when supported; questionnaire hand-over mode with staff-only exit; practice identity configurable (NAS host removed from example text) | `16435f3`, `23904fd`, `53d1e52`, `6e15238`, `1572c87` | G-12, H-19, G-1 |
| iOS bowel prep | Clinician-selected regimens with a split-dose timetable, surgeon sign-off per regimen, audit-logged exports | `abda6b2`, `1f6e2fc`, `7c6ed89` | H-08 |

**Pending migration** (wired, not applied to production)

| Migration | What it does | Commits |
|---|---|---|
| 87 `supabase-soft-delete-migration.sql` | `deleted_at`/`deleted_by` on the five iOS-synced tables and the audited, role-checked `soft_delete()` RPC | `cad8d9c` |
| 88 `supabase-news2-scale2-migration.sql` | `patients.news2_spo2_scale2`, so the Scale 2 opt-in syncs through the cloud | `48ef141` |
| 89 `supabase-staff-only-rls-migration.sql` | Staff-only RLS on PHI tables and buckets; explicit staff provisioning; `patients` column guards (S-2) | `946bdbe`, `1a01b5d`, `aaa53c0` |
| 90 `supabase-deferred-forward-refs-migration.sql` | Creates a policy that Migration 2 referenced before its table existed; a no-op on production | `8824214` |

**Newly identified** in the refresh: the front-desk app's own MODE checks do not fail closed (G-17, A-27); Migrations 87–90 are unapplied and the runner has never completed on production (G-18, A-25); after Migration 89 a front-desk device cannot upload the patient-reported HPI or pre-visit note (H-13, A-28).

**Re-rated (proposed, not CSO-accepted):** H-04 4 → 2; H-09 3 → 2; H-10 3 → 2; H-07 stays 3 with likelihood Medium → Low; H-19 stays 3 until Migration 89 is applied, then 2.

**Unchanged and still open:** S-5 (peer-sync authentication), S-6 (Sentry PHI), G-4 and G-5 (MFA, idle timeout, browser PHI on sign-out), PITR and bucket backups, the peer-sync longer-copy merge, all vendor agreements, CSO appointment, and the regulatory decision.

## Maintaining this pack

- Update `subprocessors.md` whenever a new outbound host or SDK is added.
- Update `hazard-log.md` whenever a feature that produces scores, alerts, advice, AI output or patient messages changes.
- Re-baseline the code references (the commit SHA at the top of each file) at each review, and add a dated entry under "Changes since first draft".
- Only the CSO may accept a residual rating. Record acceptance in `clinical-safety-case.md`, not by editing a status here.

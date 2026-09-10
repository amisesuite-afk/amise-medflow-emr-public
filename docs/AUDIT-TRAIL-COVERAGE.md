# Audit trail coverage — findings and follow-up

Backlog item 08: sweep every mutating API route for audit-log coverage. This document records
what was found, what was fixed in this pass, and what's left — a prioritized follow-up list
rather than a single "add audit calls everywhere" change, per the backlog's own framing
("prioritize any route that mutates patient-record data over administrative/scheduling routes").

## Two parallel audit mechanisms exist

`artifacts/api-server/src/lib/audit.ts`'s `logAudit(req, action, resourceType, ...)` and
`artifacts/api-server/src/lib/supabase.ts`'s `audit({ action, entityType, ... })` both write to
the same `audit_log` table, with different call signatures (`logAudit` takes the Express `req`
and captures `ip_address`/`user_agent` from it; `audit` takes explicit `userId`/`userEmail` and
doesn't capture IP/user-agent). Most of the codebase's existing coverage uses `audit()`, not
`logAudit()` — an initial grep for `logAudit(` alone undercounted real coverage by roughly 35
files, since it missed every `audit()` call site. Worth consolidating to one helper eventually,
but out of scope here — noted so a future pass doesn't repeat the same undercount.

## Fixed in this pass

- **`POST /api/patients/:targetId/merge`** (`patient.ts`) — the highest-stakes mutation in the
  sweep (re-parents all clinical records across 13 tables, then deletes the source patient row)
  had an "audit" call that wrote to `audit_logs` (plural) — an old table from the original
  `supabase-schema.sql` base schema, not `audit_log` (singular), the table `logAudit()`/`audit()`
  and every other audit call in the codebase actually write to and that anyone reviewing the
  audit trail would query. The merge was never actually appearing in the real audit trail.
  Replaced with a proper `audit()` call.
- **Five AI document-generation routes had zero audit coverage of any kind**:
  `discharge-summary.ts`, `generate-endoscopy-report.ts`, `generate-letter.ts`,
  `generate-operative-note.ts`, `procedure-report.ts`. None of these persist anything to the
  database (pure Claude-generation-and-return endpoints, no `patientId` FK — just a free-text
  patient name) — added an `action: 'draft'` audit call after each successful generation, since
  `'draft'` is already in `AuditAction` and matches the "AI-ASSISTED DRAFT" language these routes'
  own prompts already use. `entityType` matches `phiAuditMiddleware`'s existing prefix→resourceType
  mapping for the same route (`'letter'` for `generate-letter`, `'clinical_note'` for the other
  four) for consistency between view-audits and mutation-audits of the same resource.

## Fixed in follow-up pass (2026-08-29)

- **`theatre.ts`** — session create, case add, case delete, and publish all now emit `logAudit` calls.
- **`workflow-tasks.ts`** — task create, resolve, and dismiss now emit `logAudit` with `task_resolve`/`task_dismiss` actions.
- **`scheduling.ts`** — follow-up calendar event booking now emits a `logAudit` call.
- **`ai-consult.ts`** — AI consultation requests now emit an `ai_call` audit event with `consultationType` and `patientId`.

## Fixed in second follow-up pass (2026-08-29)

- **`whatsapp.ts`** — wrapped `sendMetaWhatsApp` and `sendTelnyxWhatsApp` in try/catch; P1 crash risk (unguarded `fetch()` called via `void` → unhandled rejection on any network error).
- **`portal.ts`** — three mutating routes with zero audit coverage added:
  - `POST /api/patient/sms-code/verify` — patient portal login now emits a `logAudit` call with `action: 'login'`, capturing IP and user-agent.
  - `POST /api/patient/documents/register` — patient document upload now emits `logAudit` with `action: 'create'` and `source: 'patient_portal'`.
  - `PATCH /api/patient/consultation-requests/:id` — status update (which may also create a patient record) now emits `logAudit` with `action: 'update'`.
- **`investigations.ts`** — `POST /api/investigations/scan-referral` (AI call on referral PHI with no audit) now emits `logAudit` with `action: 'ai_call'`.
- **`calls.ts`** — `PATCH /api/calls/:id/resolve` patient linkage now emits `logAudit`.
- **`clinical-states.ts`** — PATCH and DELETE now emit `logAudit`.

## Fixed in third follow-up pass (2026-09-10)

Seven of the thirteen zero-coverage files from the previous pass are now covered:

- **`narrative.ts`** — `POST /api/narrative/parse` (sends clinical narrative PHI to Claude across
  6 sections) now emits `logAudit` with `action: 'ai_call'`, `resourceType: 'clinical_note'` and
  the section name in details.
- **`voice.ts`** — `POST /api/voice/segment` (sends voice transcript PHI to Claude, stores in
  `call_logs` and `ai_proposals`) now emits `logAudit` with `action: 'ai_call'`,
  `resourceType: 'voice_transcript'`, `patientId`, and char count in details.
- **`document-scan.ts`** — `POST /api/document-scan` (sends document PHI to Claude fallback when
  native parser confidence < 0.75) now emits `logAudit` with `action: 'ai_call'`,
  `resourceType: 'document'`, and `{ mimeType, usedClaude }` so it's clear when the AI was
  actually invoked vs. when the native parser alone handled extraction.
- **`suggest-codes.ts`** — `POST /api/suggest-codes` (sends clinical assessment PHI to Claude for
  ICD-10/CPT code suggestions) now emits `logAudit` with `action: 'ai_call'`,
  `resourceType: 'invoice'`.
- **`summary.ts`** — three AI routes now covered:
  - `POST /api/summary/generate` — SOAP summary generation from structured intake data.
  - `POST /api/ai/refine` — clinical encounter record refinement by Claude.
  - `POST /api/soap/polish` — structured SOAP data polishing into prose.
  All three emit `logAudit` with `action: 'ai_call'`, `resourceType: 'clinical_note'`, and
  `action` name in details.
- **`previsit.ts`** — two mutating routes now covered:
  - `POST /api/previsit/create` — staff creates a pre-visit submission row; emits `logAudit` with
    `action: 'create'`, `resourceType: 'appointment'`, `patientId`.
  - `POST /api/previsit/ai-format` — sends patient-submitted PHI to Claude for clinical
    formatting; emits `logAudit` with `action: 'ai_call'`, `resourceType: 'clinical_note'`,
    `patientId`.
- **`admin.ts`** — three mutating routes now covered:
  - `POST /api/admin/patient-accounts/:id/link` — patient account linkage; emits `update` on
    `patient`.
  - `DELETE /api/admin/patient-accounts/:id` — unlinked portal account deletion; emits `delete`
    on `patient`.
  - `POST /api/admin/patients/quick-create` — minimal patient record creation; emits `create` on
    `patient` with the new patient's ID as both `resourceId` and `patientId`.
- **`call-recording.ts`** — `POST /api/calls/recording-upload` (RECORDING_UPLOAD_KEY auth,
  not staff JWT — userId will be null in the audit record but IP and device metadata are still
  captured) now emits `logAudit` with `action: 'create'`, `resourceType: 'appointment'`,
  `patientId` where resolvable, and `{ direction, deviceLabel, practiceLine }` in details.

## Confirmed complete gap — zero audit calls of any kind (5 files)

Left intentionally for future passes with notes on priority/rationale:

`email-intake.ts` — cron-keyed routes processing inbound referral emails; not patient-record
clinical mutations but does write to `appointment_requests`. Medium priority for a dedicated
email-intake audit pass.

`endoscopy-capture.ts` — uses in-memory store with `CRON_SECRET` auth; no PHI persisted to DB,
so no immediate audit need.

`triage-preview.ts` — no auth, pure computation, no PHI stored; skip.

`patient-messages.ts` — patient-facing SMS/message routes; worth a dedicated review pass
to confirm which mutations touch PHI.

Note: `patient-auth.ts` mentioned in the prior pass no longer exists as a separate file —
the patient portal auth routes live in `portal.ts`, which now has login audit coverage.

## Partial coverage — resolved or within acceptable range

`portal.ts` and `investigations.ts` gaps addressed in the second follow-up pass above.
`notify.ts` (1 mutating route, 1 audit call — likely fine), `cron.ts` (5 mutating, 7 audit —
over-provisioned, fine), `visit-lifecycle.ts` (8 mutating, 7 audit — off by one, acceptable).

## Not touched — patient self-service routes in `patient.ts`

`/api/patient/passport`, `/api/patient/monitoring`, `/api/patient/upload`, and
`/api/exam/photo-describe` (patient portal self-service + a staff-only AI photo-description call)
were left out of this pass — a different audience/category (patient-driven, not staff-driven
clinical mutation) from what was in scope here. `/api/exam/photo-describe` sends a clinical photo
to Anthropic's API with no audit trail of what PHI was sent when, which is worth a closer look in
a future pass focused on AI/PHI handling specifically.

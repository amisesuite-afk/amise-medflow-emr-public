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

## Confirmed complete gap — zero audit calls of any kind (15 files)

Administrative/scheduling routes, not patient-record clinical data — lower priority per the
backlog's own prioritization, left for a follow-up pass:

`admin.ts`, `call-recording.ts`, `calls.ts`, `clinical-states.ts`,
`email-intake.ts`, `endoscopy-capture.ts`, `narrative.ts`, `patient-auth.ts`,
`patient-messages.ts`, `previsit.ts`, `suggest-codes.ts`, `summary.ts`,
`triage-preview.ts`, `voice.ts`, `document-scan.ts`

One worth flagging specifically: `patient-auth.ts` mutates login/logout
state (the `action` taxonomy in `lib/audit.ts` already documents `login`/`logout`/`access_denied`
for exactly this).

## Partial coverage — has some audit calls, but fewer than mutating routes (needs a route-by-route check, not a file-level count)

`notify.ts` (1 mutating route, 1 audit call — likely fine, not verified route-by-route),
`portal.ts` (12 mutating, 5 audit), `cron.ts` (5 mutating, 7 audit — likely fine, over-provisioned),
`investigations.ts` (11 mutating, 8 audit), `visit-lifecycle.ts` (8 mutating, 7 audit — likely
fine, off by one). `portal.ts` and `investigations.ts` are the two with a real numeric gap worth
checking which specific routes are missing coverage.

## Not touched — patient self-service routes in `patient.ts`

`/api/patient/passport`, `/api/patient/monitoring`, `/api/patient/upload`, and
`/api/exam/photo-describe` (patient portal self-service + a staff-only AI photo-description call)
were left out of this pass — a different audience/category (patient-driven, not staff-driven
clinical mutation) from what was in scope here. `/api/exam/photo-describe` sends a clinical photo
to Anthropic's API with no audit trail of what PHI was sent when, which is worth a closer look in
a future pass focused on AI/PHI handling specifically.

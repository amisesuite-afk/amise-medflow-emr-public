# Change log — `signoff-tool` (in-app clinical sign-off: catalogue, register, apply)

2026-09-26. Branch `signoff-tool` (from `claude/pr-37-gbg22z`). Owner-approved item. Storage:
**Migration 95** (`supabase-clinical-signoffs-migration.sql`), wired in `run-migrations.yml`,
**not yet applied** to production.

Every clinical change log lists what the surgeon must approve under "Needs sign-off", and
SURGEON-DECISIONS.md holds the register (A–G) and the decisions made (I). Until now the only way
to approve was a message ("fix-web-triage 1–6 approved"). This change turns the lists into a
review screen: the surgeon (or another named reviewer) approves, amends, rejects or defers each
item with name, role and date, and a developer then writes the approvals into the registry. It is
the step that unlocks going live: a rule set's `lastReviewed` in `clinical-content/registry.json`
can now be set from a recorded, attributable review instead of by hand.

**No clinical content, engine, rule, weight, iOS file or version stamp changed.** The app never
edits the repository; nothing is sent anywhere but the practice's own Supabase.

## What the owner sees

1. **Insights → Clinical sign-off** (doctor and admin; the tab is not shown to nurses or front
   desk). At the top: "0/399 items approved · 0/33 rule sets complete", and **Progress by rule
   set** — one line per registry rule set, e.g. `treatment-decision-support 0/12 approved`, with a
   bar. Clicking a rule set narrows the list to its items.
2. **The list**, grouped by change log (or, with *By rule set*, by registry rule set). Filters:
   All, Pending, Approved, Changed since approval, Rejected, Deferred, each with its count; a
   search box. Each row: the item number, its first line and its status.
3. **The item** on the right: the full text as written in the change log, a link to the change
   log (GitHub, at the right heading), the rule sets it belongs to, its wording hash, and its
   decision history (every decision, newest first; "earlier wording" when a decision was made on
   text that has since changed).
4. **The decision form:** Approve / Approve with amendment / Reject / Defer; the amendment
   (required for an amended approval), an optional comment (the reason, for a rejection or a
   deferral), the reviewer's name (filled from the profile; as it should appear in the
   registry), and the attestation **"I have reviewed this item against the cited source."**
   Nothing can be recorded without the tick. After recording, the next item opens.
5. **Keyboard:** `j`/`k` next / previous, `a` approve, `m` amend, `r` reject, `d` defer,
   `Ctrl+Enter` (⌘+Enter) record, `/` search, `1`–`6` filters, `g` grouping, `e` export. The
   hints are listed under the page.
6. **Export approved decisions** downloads two files: `clinical-signoff-<date>.json` (the bundle:
   every decision row, so the apply script can see what is still open) and `.md` (progress by
   rule set and each decision, readable).
7. **Before Migration 95 is applied** the page shows the whole catalogue read-only with
   "Recording decisions becomes available after the database update (Migration 95)". Nothing
   returns an error page.

## How it works

- **Catalogue** (`pnpm --filter @workspace/scripts run signoff:catalogue`,
  `scripts/src/signoff/catalogue.ts`): parses every `docs/clinical-validation/changes/*.md`
  "Needs sign-off" section (numbered items, `- C1.` bullets, table rows labelled `A1`, a trailing
  paragraph such as "Please confirm" → `note-1`) and SURGEON-DECISIONS sections A–G and I (table
  rows, F bullets, G3, I1 and the numbered I2 defaults; H, the register, is skipped). Item id =
  `<changelog-slug>#<n>` (`surgeon-decisions#A1`, `followups-prep-h10#B12`). Each item carries the
  first 16 hex digits of the SHA-256 of its whitespace-normalised text: editing the wording makes
  an earlier decision read "changed since approval"; renumbering changes the id.
  Output: `artifacts/dashboard/src/data/clinical-signoff-catalogue.json` (399 items from 20
  sources at the time of writing), loaded by the page on demand.
- **Rule-set links:** a change log belongs to every registry entry that cites `<slug>.md`, plus
  a short curated list (`EXTRA_LINKS`: `fix-web-differential` → `pane-engine-disease-model`,
  `web-symptom-inference`; `diagnostic-reasoning` → `diagnostic-reasoning-rules`,
  `diagnostic-reasoning-web`; `fix-web-screening` → `cancer-screening`; `ios-screening-parity` →
  `ios-suspected-cancer-screening`). A SURGEON-DECISIONS item belongs to every registry entry whose
  text cites it ("SURGEON-DECISIONS A1–A25, B1–B16, G2 …"). Over-linking is deliberate: a rule set
  counts as reviewed only when every item linked to it is approved. `outcomes-calibration` and
  most D/E/F items link to no rule set; they are grouped by their change log.
- **CI:** `lint:signoff-catalogue` (in the typecheck-and-build job, after the registry lint) fails
  when the committed JSON differs from a fresh build, and names the new, changed or removed items.
  Fix: run `signoff:catalogue` and commit the JSON with the doc edit.
- **Storage (Migration 95):** `public.clinical_signoffs`, one row per decision: item id, item
  hash, catalogue hash, decision, amendment, comment, `attested` (must be true), reviewer user id,
  name and role, rule-set ids, a unique `client_ref` (a double submit records one row) and
  `decided_at` (server clock, stamped by a trigger). **Append-only**: UPDATE, DELETE and TRUNCATE
  are refused for everyone, the service role included (`42501`); a correction is a new row and the
  latest row is the current decision. RLS: doctor and admin insert, only as themselves
  (`reviewer_user_id = auth.uid()`, `reviewer_role = auth_role()`); doctor, admin and nurse read;
  front desk and portal patients see nothing.
- **Audit:** each recorded decision also writes an `audit_log` row (action `clinical_signoff`,
  resource `clinical_signoffs`; item, hash, decision, rule sets, reviewer) through the dashboard's
  audit helper (`db.ts` → `logClinicalSignoff`, the same `audit_log` table as the API server's
  `logAudit()`). If that row cannot be written the decision stays recorded and the page says so.
- **From approval to repository** (`pnpm --filter @workspace/scripts run signoff:apply <bundle.json>`,
  run by a developer; details in `docs/CLINICAL-CONTENT-UPGRADES.md` §3.4): re-reads the docs,
  takes each item's latest decision for its **current** wording and, for each rule set whose
  items are all approved (or approved with an amendment), sets `lastReviewed` (date of the last
  decision, St Lucia), `reviewer` (every reviewer, "Name (role)"), `reviewEvidence` and
  `nextReviewDue` (+12 months, the registry's default) in `registry.json`, in place, and appends a
  dated record to SURGEON-DECISIONS section I (marked `<!-- signoff:applied -->` so it is never
  catalogued as a new item). It keeps the bundle under `clinical-content/signoffs/` and rebuilds
  the catalogue. It **refuses and writes nothing** when a named rule set has a pending, rejected,
  deferred or changed item, when nothing is complete, or when the bundle was applied before.

## Files

- `supabase-clinical-signoffs-migration.sql` (Migration 95), `.github/workflows/run-migrations.yml`,
  `migrations/README.md`, `scripts/src/lint-rls-policies.ts` (two required policies).
- `scripts/src/signoff/catalogue.ts`, `scripts/src/signoff-catalogue.ts` (`signoff:catalogue`,
  `lint:signoff-catalogue`), `scripts/src/signoff/apply.ts`, `scripts/src/signoff-apply.ts`
  (`signoff:apply`), `.github/workflows/ci.yml`.
- `artifacts/dashboard/src/data/clinical-signoff-catalogue.json` (generated).
- `artifacts/dashboard/src/lib/clinical-signoff/` — `types.ts`, `status.ts` (shared with the
  scripts), `db.ts`, `view-model.ts`, `keyboard.ts`; `components/clinical-signoff/SignoffViews.tsx`;
  `pages/tabs/ClinicalSignoffTab.tsx`; `pages/tabs/InsightsHubTab.tsx` (the tab);
  `lib/db.ts` (`logClinicalSignoff`, and `writeAuditLog` now reports success).
- `artifacts/dashboard/vitest.config.mts`: JSX compiled in tests so components can be rendered to
  static markup.

## Tests

- `scripts/src/signoff-catalogue.test.ts` — stable ids, continuation lines, groups and anchors,
  duplicate numbers fail, hash ignores reflowed whitespace and changes with the wording (only for
  the edited item), SURGEON-DECISIONS parsing (skips H and applied records), registry reference
  expansion, repository catalogue ids fit the database CHECK, numbered items are 1…n, links exist.
- `scripts/src/signoff-apply.test.ts` — refuses a pending, rejected, deferred or changed item; a
  later approval supersedes a rejection; default mode applies only complete rule sets; refuses a
  malformed or already-applied bundle; writes exactly the four registry fields (St Lucia date,
  reviewers, evidence, next review) and keeps the file layout; the section-I record is not
  re-catalogued.
- `scripts/src/signoff-migration.test.ts` (PGlite) — doctor/admin insert as themselves, nurse
  reads only, front desk and portal nothing, no impersonation or role claim, append-only for
  clients and the service role, server-stamped time, CHECKs (attestation, decision, id, hash,
  amendment only for amended).
- `artifacts/dashboard/src/lib/__tests__/clinical-signoff-db.test.ts` — table absent: load says
  unavailable, save says unavailable, no audit row, nothing in browser storage; refused /
  duplicate / CHECK errors; audited save; audit failure reported.
- `artifacts/dashboard/src/lib/__tests__/clinical-signoff-ui.test.ts` — statuses, progress, list
  model, keyboard map, and the components rendered to markup (progress lines, selection, item
  link and history, attestation-gated form).
- `e2e/emr-walkthrough.mjs` — opens Insights → Clinical sign-off as a doctor, checks the items
  and rule-set progress render, and that `j` moves the selection. It records nothing.

## Needs sign-off

1. **Who may sign.** Doctor and admin accounts may record decisions (the database refuses
   everyone else); nurses may read them. An admin account is not necessarily a clinician: should
   admins be able to approve clinical content, or doctors only? (Relates to D6: who signs off
   clinical content.)
2. **What counts as reviewed.** A rule set is written into the registry only when every item
   linked to it is approved or approved with an amendment; pending, rejected, **deferred** and
   changed items all hold it back. Confirm that a deferral should block, and that an amended
   approval counts as approved (the amendment is recorded in section I and still needs a content
   change to implement it).
3. **Links between items and rule sets** as listed above, including the whole of SURGEON-DECISIONS
   A counting towards `ios-diagnosis-radiation-engine` (its registry entry cites "SURGEON-DECISIONS
   A"), so that rule set needs 87 approvals.
4. **Review interval.** `nextReviewDue` is set to 12 months after the last decision (the
   registry's default), for every rule set.
5. **Attestation wording:** "I have reviewed this item against the cited source."

## Owner actions

- **Any time:** apply Migration 95 (`docs/OWNER-STEPS-MIGRATIONS.md`, Part 1, row 6). It is
  additive and independent of 87–94. Until then the page is read-only.
- Then open Insights → Clinical sign-off and start with the P1 rule sets. When a rule set shows
  complete, press **Export approved decisions** and send the `.json` file to the developer, who
  runs `signoff:apply` and commits the result.

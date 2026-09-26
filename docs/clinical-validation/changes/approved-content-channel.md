# Change log — `approved-content-channel` (signed-off rule files without an app update)

2026-09-26. Branch `approved-content-channel` (from `claude/pr-37-gbg22z`). Storage:
**Migration 98** (`supabase-approved-content-migration.sql`), wired in `run-migrations.yml`,
**not yet applied** to production. Design and safety properties: `docs/APPROVED-CONTENT-CHANNEL.md`.

**No clinical content, rule, weight, threshold, wording or version stamp changed, and nothing is
published.** Until a release is published (which today the publish script refuses, because no rule
set has a recorded clinical review), every screen uses exactly the bundled files it used before.

## What changed

- **A place to publish a signed-off rule file**: `public.clinical_content_releases` (Migration 98).
  One row per version of a shared rule file, with the whole file, its hash, the publisher, the
  time and a required sign-off reference. Append-only; a version can only be withdrawn (revoked),
  never edited or deleted. Every staff role reads; doctor and admin publish and revoke, in their
  own name.
- **Both platforms check every version themselves** before using it — not revoked, strictly newer
  than the built-in file, the content hash matches, it is the right file, it passes the file's
  schema in this build, and it changes only what the channel allows — and otherwise keep the
  built-in file. Shared rules and test vectors on web and iOS.
- **Enabled for two files, in part**: the zebra rules (`rules`) and the supplement catalogue
  (`items`). The supplement wording — including the approved patient paragraph (I1) — the prompt
  texts and the trigger words stay built in; changing them still needs an app update, so the
  patient-instruction lint always runs on them.
- **Where to see it**: dashboard Settings → Clinical rule files (every staff role), and iPhone /
  iPad Settings → Diagnostics → Shared clinical rules: "Bundled 1.0.0" or "Approved release 1.0.1 ·
  sha 1a2b3c4d", and any version that was refused, with the reason.
- **Publishing** (`pnpm --filter @workspace/scripts run content:publish`): prints the SQL for an
  admin to run; refuses without a sign-off reference and a named doctor / admin publisher, for a
  file the channel is not enabled for, for a file that fails its schema or its registry version,
  and while the registry records no clinical review of the rule set. It never sets `lastReviewed`
  and is never run automatically.

## Tests

- `scripts/src/approved-content.test.ts` — the shared vectors (canonical JSON, SHA-256 against
  node:crypto, schema checker against ajv, 20 selection cases), the checker against ajv on every
  repository rule file and mutated copies, a release of each enabled file selected and a pinned
  change refused (the patient paragraph included), a non-enabled file never overridden, and the
  Swift twin's policy, keyword list and check order read from source.
- `scripts/src/approved-content-migration.test.ts` (PGlite) — who reads, publishes and revokes;
  no impersonation; append-only (no edit, un-revoke, DELETE or TRUNCATE, service role included);
  server clock; CHECKs; a row written by the publish SQL is selected by the web verification.
- `scripts/src/content-publish.test.ts` — the refusals above; the SQL and hash with a reviewed
  registry entry; the repository registry is never written.
- `artifacts/dashboard/src/lib/__tests__/approved-content.test.ts` — table missing / read error →
  bundled, no throw; a verified release replaces the zebra rules and the supplement items at call
  time; a stored supplement id is never dropped by a release; revoked, tampered and older releases
  refused; nothing written to browser storage.
- `ios/AmiseMedFlowTests/ApprovedContentTests.swift` — the same shared vectors on iOS; every
  bundled rule file validates against its bundled schema; a stored release is used by the loader
  and shown in Settings, a tampered stored copy is ignored, a revocation removes it.

## Needs sign-off

1. **Who may publish and withdraw a version.** Doctor and admin accounts (the database refuses
   everyone else), in their own name. An admin account is not necessarily a clinician: should
   publishing be limited to doctors? (Same question as signoff-tool 1 and D6.)
2. **Two-person rule.** Today one person can publish, provided a sign-off reference is given and
   the rule set's review is recorded. Should publishing require a second named person (for
   example: the reviewer who approved the items may not be the publisher, or a second doctor /
   admin confirms before devices use it)? Not enforced yet.
3. **When a version may be published.** The publish script refuses until the rule set's registry
   entry records a clinical review (`lastReviewed` and `reviewer`, written by `signoff:apply` only
   when every item linked to the rule set is approved). Confirm this is the bar, rather than
   allowing a single approved change to go out while other items of the rule set are still pending.
4. **Scope of what can change without an app update.** Zebra rules: the rules (conditions, terms,
   citations). Supplement catalogue: the items (names, concerns, clinician-facing stop times,
   harms, evidence, sources). Patient wording, prompt texts and trigger words stay built in.
   Confirm, or narrow (for example, keep supplement stop times built in).
5. **How fast a change and a withdrawal take effect.** Web: at the next sign-in / page load (or
   Settings → Check again). iPhone / iPad: checked at most every 6 hours (and at sign-in / launch),
   used from the next app launch. A withdrawn version stays in use on a device until then. Is
   this acceptable, including for a withdrawal made for a safety reason?
6. **Offline devices.** A device that cannot reach the server keeps the last version it verified
   (even if it has since been withdrawn) until it can check again. Alternative: fall back to the
   built-in file after a set number of days without a successful check.
7. **Audit.** The releases table is the record (who published or withdrew which version, when and
   under which sign-off reference; it cannot be edited or deleted). No separate `audit_log` row is
   written. Confirm this is sufficient.

## Owner actions

- **Any time:** apply Migration 98 (`docs/OWNER-STEPS-MIGRATIONS.md`, Part 1, row 9). It is
  additive, independent of 87–97, and changes nothing until a version is published.
- Decide items 1–7. Nothing will be published before a rule set's review is recorded.

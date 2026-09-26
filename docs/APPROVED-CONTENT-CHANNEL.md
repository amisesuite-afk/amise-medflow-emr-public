# Approved-content channel: signed-off rule files without an app update

| | |
|---|---|
| Status | Built 2026-09-26 (branch `approved-content-channel`). Storage: **Migration 98** (`supabase-approved-content-migration.sql`), wired, **not yet applied**. Nothing is published |
| Enabled for | `diagnostic-reasoning-zebras` (`clinical-content/rules/zebra-rules.json`, the `rules`) and `supplement-catalogue` (the `items`) |
| Shared logic | `lib/triage-engine/src/approved-content/` (`@workspace/triage-engine/approved-content`); Swift twin `ios/AmiseMedFlow/Services/ApprovedContent.swift`; shared vectors `ios/AmiseMedFlowTests/Resources/ApprovedContentVectors.json` |
| Change log / sign-off | `docs/clinical-validation/changes/approved-content-channel.md` |
| Related | `docs/SHARED-CONTENT-PLAN.md`, `docs/clinical-validation/changes/signoff-tool.md`, `docs/CLINICAL-CONTENT-UPGRADES.md` |

## 1. Why

The shared clinical rule files (`clinical-content/rules/*.json`) are built into the dashboard and
the iOS app. Once the surgeon signs off a new version, the web picks it up at the next deploy, but
the iPhone / iPad only with the next App Store release — weeks later. The channel lets a
signed-off version be **published once** in Supabase and used by both platforms at their next
check, while the **bundled file stays the always-available fallback**.

## 2. How it works

```
repo: clinical-content/rules/<file>.json (merged, CI-checked, version bumped, signed off)
   │  pnpm --filter @workspace/scripts run content:publish -- <content-id> --signoff-ref … --publisher-email …
   ▼  (prints the SQL; an admin runs it in the Supabase SQL editor)
public.clinical_content_releases  (Migration 98: append-only, staff read, doctor/admin publish)
   │                                         │
   ▼ dashboard, once per session             ▼ iOS, sync step, at most every 6 h
lib/approved-content.ts                     SyncService+ApprovedContent.swift
   │ selectForChannel (verify)                 │ ApprovedContentStore.apply (verify, keep one file)
   ▼                                           ▼ Application Support/ApprovedContent/<id>.release.json
approved-content-store.ts (memory)          SharedClinicalContent.decode → verify again → engine
   ▼                                           ▼ (used from the next launch)
matchZebras(activeZebraRules()), activeSupplementItems()
```

- **Content id** = the registry id = the file's own `id` (`diagnostic-reasoning-zebras` for
  `zebra-rules.json`; `supplement-catalogue`).
- **One row per version.** The whole file is stored as `body` (jsonb) with its `version`, the
  SHA-256 of its canonical JSON, the publisher, the time (server clock) and a required
  `signoff_ref` saying what approved it.
- **Every client verifies every release itself** (rules in §4) and otherwise uses its bundled
  file. The database only checks shapes (it cannot rebuild the canonical JSON).

## 3. Canonical JSON and the hash

`jsonb` keeps neither key order nor whitespace, so the hash is taken over a canonical text both
platforms rebuild from the parsed value (definition: `canonical-json.ts` header, twin
`ApprovedContent.canonicalJSON`):

- no whitespace; object keys sorted by **UTF-16 code units**; arrays in order;
- strings: only `"`, `\`, and U+0000–U+001F escaped (`\b \f \n \r \t`, else `\u00xx` lowercase);
  everything else, `/` and non-ASCII included, written as itself; a lone surrogate is an error;
- numbers: finite; integers within ±(2^53 − 1) as plain digits (−0 → `0`; larger integers are an
  error); other numbers with the **shortest round-trip digits** (ECMAScript `Number::toString`,
  Swift `Double.description`) rewritten in **plain decimal**, never an exponent (1e-7 → `0.0000001`);
- SHA-256 over the UTF-8 bytes, 64 lowercase hex digits.

The web computes SHA-256 with a small synchronous implementation (`sha256.ts`, pinned to
`node:crypto`); iOS uses CryptoKit. The shared vectors cover key order (including a key where
UTF-16 and code-point order differ), escapes, number forms and the refused integers.

## 4. Selection rules (`selectApprovedContent`, `ApprovedContent.select`)

Releases of the file are tried from the **highest version down**; the first that passes every
check is used, else the bundled file. Checks, in order (the first failure is the reason shown):

| # | Check | Reason code |
|---|---|---|
| 1 | `content_id` is this file | `wrong-content` |
| 2 | not revoked | `revoked` |
| 3 | version is exactly MAJOR.MINOR.PATCH | `bad-version` |
| 4 | version **strictly greater** than the bundled file's (numeric) | `not-newer` |
| 5 | body is a JSON object that canonicalises | `malformed` |
| 6 | SHA-256 of the canonical body equals the stored hash | `hash-mismatch` |
| 7 | body `id` equals the content id | `id-mismatch` |
| 8 | body `version` equals the release version | `version-mismatch` |
| 9 | body validates against **this build's** schema (`clinical-content/schemas/<file>.schema.json`) | `schema-invalid` |
| 10 | every top-level key outside the file's `mayChange` list (plus `version`, `$comment`) is identical to the bundled file | `pinned-field-changed` |

**Policy (`APPROVED_CONTENT_POLICY`, Swift `ApprovedContent.policy`, pinned to each other by
`scripts/src/approved-content.test.ts`):**

| Content id | File | May change | Stays bundled (needs an app update) |
|---|---|---|---|
| `diagnostic-reasoning-zebras` | `zebra-rules.json` | `rules` | `$schema`, `id` |
| `supplement-catalogue` | `supplement-catalogue.json` | `items` | `text` (clinician heading, patient question, rationale and the **surgeon-approved patient paragraph**, which `lint:patient-instructions` pins), `prompts` and `triggerTerms` (ids and words the code looks up) |

A file not in the policy is never overridden, whatever is published.

**Schema check.** The clients use a small interpreted JSON Schema checker (`schema-check.ts`,
twin `ApprovedContent.schemaProblems`) that implements exactly the keywords our schemas use.
ajv (what `lint:shared-content` uses) is not used in the browser because it compiles schemas with
`new Function` (refused by a strict Content-Security-Policy) and has no iOS equivalent. The
checker is **fail-closed** (an unknown keyword is a problem, so every release of that file is
refused until the checker learns it) and is pinned to ajv on every repository rule file, on
mutated copies of them and on the shared vectors. iOS additionally decodes the release with the
engine's own Codable structs; a release that does not decode is skipped for the bundled file.

## 5. Safety properties

1. **Never below the bundled file.** Only a strictly newer version can replace it (rule 4); an app
   update that ships a newer bundled file wins automatically (iOS re-verifies the stored release
   at every load).
2. **Fail-closed to bundled.** Table missing (Migration 98 not applied), no Supabase, a read
   error, a malformed row, a hash mismatch, a schema failure, a pinned-field change, an iOS decode
   failure, a damaged stored file → the bundled file. Nothing throws, no error page, no 500.
3. **Integrity.** The hash is recomputed on the device from the body actually received; a body
   edited after publishing (or by anyone with database access) is refused.
4. **Scope.** Only the files and top-level keys in the policy can change. Patient-facing wording
   and the keys code depends on cannot change without a build, so the CI lints
   (`lint:patient-instructions`, `lint:shared-content`, `lint:interaction-parity`) always run on them.
5. **Revocation.** A doctor / admin sets `revoked_at` (+ reason) on a release; clients then fall
   back to the next-highest valid release, else the bundled file. The web applies it at the next
   session (or Settings → Check again); iOS at its next check (at most 6 h, or at sign-in / launch)
   and from the next launch. An offline iPhone keeps the last verified release until it can check.
6. **Append-only record.** Releases cannot be edited or deleted by anyone (service role
   included); a revocation is recorded once and cannot be undone; publisher and time are server
   facts. The table is its own audit trail (who published what, when, under which sign-off).
7. **Human gate.** Nothing is published automatically: `content:publish` prints SQL by default,
   refuses without `--signoff-ref` and a named doctor / admin publisher, and refuses while the
   registry records no clinical review of the rule set (`lastReviewed` must be a date, set only by
   `signoff:apply` from recorded decisions). The script never writes the registry.
8. **Not patient data.** Nothing here is PHI; the web keeps it in memory only (no browser
   storage key), iOS in Application Support (protected until first unlock).

## 6. Publishing and revoking (owner / developer)

1. Change the rule file in the repository as usual (schema, Swift and TS types, registry version
   and changelog, CI green), and get its sign-off items recorded (Insights → Clinical sign-off) and
   applied (`signoff:apply`, which sets `lastReviewed` / `reviewer`). Merge.
2. Print the SQL:
   ```bash
   pnpm --filter @workspace/scripts run content:publish -- diagnostic-reasoning-zebras \
     --signoff-ref "diagnostic-reasoning#9–#12 approved 2026-10-02 (bundle clinical-signoff-2026-10-02.json)" \
     --publisher-email surgeon@example.com
   ```
   Review it, then run it once in Supabase → SQL Editor. One row comes back; none means the
   publisher is not a doctor / admin. (With `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `--published-by <user id>` and `--confirm` the script inserts through the REST API instead.)
3. Check: dashboard Settings → Clinical rule files shows "Approved release x.y.z · sha …";
   iPhone Settings → Diagnostics → Shared clinical rules shows the same after the next check and
   relaunch.
4. Revoke (SQL editor, as the doctor / admin, or as postgres naming them):
   ```sql
   update clinical_content_releases
      set revoked_at = now(), revoked_by = '<your user id>', revoked_reason = '<why>'
    where content_id = 'diagnostic-reasoning-zebras' and version = '1.0.1';
   ```

## 7. Wiring another file

1. Decide which top-level keys may change without a build (never patient-facing wording, never
   keys other code looks up by id) — a clinical-governance decision; record it in the change log.
2. Add the content id to `APPROVED_CONTENT_POLICY` (select.ts) **and** `ApprovedContent.policy`
   (Swift); the parity test fails otherwise.
3. Web: add the file (bundled JSON + schema) to `CHANNEL_FILES` in
   `artifacts/dashboard/src/lib/approved-content.ts`, and make its consumer read
   `activeBody(contentId)` at call time (keep the bundled export as the fallback), adding
   `useApprovedContentRevision()` to any memo that reads it. Consumers that copy the content into
   module-level constants at import time must be changed to read at call time first.
4. iOS: nothing per file — `SharedClinicalContent.decode` applies the stored release for any
   policy file, provided its engine loads through `SharedClinicalContent.load`. Check that the
   engine does not also compile values from the file in (as `DiagnosticReasoningCore` does with the
   thresholds, or `DiagnosticDatabase.json` with the exam evidence) — such files must not be enabled.
5. Tests: a web test like `approved-content.test.ts` for the consumer; the shared vectors need no
   change.

Not suitable today: `diagnostic-reasoning-rules` (iOS compiles the thresholds in), `exam-signs` and
`decision-rules` (generated into `DiagnosticDatabase.json`), `lifestyle-practices` (its patterns
and patient-facing prompt text are pinned by lints and hand-ported vectors).

## 8. Files

- `supabase-approved-content-migration.sql` (Migration 98), `.github/workflows/run-migrations.yml`,
  `migrations/README.md`, `docs/OWNER-STEPS-MIGRATIONS.md`, `scripts/src/lint-rls-policies.ts`.
- `lib/triage-engine/src/approved-content/` (`canonical-json.ts`, `sha256.ts`, `schema-check.ts`,
  `select.ts`, `index.ts`); `lib/triage-engine/package.json` (subpath export).
- `scripts/src/gen-approved-content-vectors.ts` (`gen:approved-content-vectors`),
  `scripts/src/approved-content.test.ts`, `scripts/src/approved-content-migration.test.ts`,
  `scripts/src/content-publish.ts` (`content:publish`), `scripts/src/content-publish.test.ts`.
- Dashboard: `src/lib/approved-content.ts`, `src/lib/approved-content-store.ts`,
  `src/hooks/useApprovedContent.ts`, `src/components/ClinicalContentSettings.tsx` (Settings),
  `src/App.tsx` (load after sign-in), `src/lib/diagnostic-reasoning.ts` (`activeZebraRules`),
  `src/components/DiagnosticReasoningPanel.tsx`, `src/lib/supplement-catalogue.ts`
  (`activeSupplementItems`), `src/lib/__tests__/approved-content.test.ts`.
- iOS: `Services/ApprovedContent.swift`, `Services/ApprovedContentStore.swift`,
  `Services/SyncService+ApprovedContent.swift`, `Services/SharedClinicalContent.swift`,
  `Services/SyncService.swift`, `Views/ClinicalContentDiagnosticsRows.swift`, `project.yml`
  (schemas folder), `AmiseMedFlowTests/ApprovedContentTests.swift`,
  `AmiseMedFlowTests/Resources/ApprovedContentVectors.json`; iOS workflows trigger on
  `clinical-content/schemas/**`.

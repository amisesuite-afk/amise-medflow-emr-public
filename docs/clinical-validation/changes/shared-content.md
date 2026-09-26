# Change log — `shared-content` (one shared rule and content library for web and iOS, phases 1 and 2)

2026-09-26. Branch `shared-content` (from `claude/pr-37-gbg22z` at `f0e2c63`). Owner-approved item.
Engineering change only: **no clinical value, wording, threshold or rule changed**, and no rule
set's content version was bumped. Plan and survey: `docs/SHARED-CONTENT-PLAN.md`.

## What changed

Three rule sets that existed as a TypeScript copy and a Swift copy now live once, as data, in
`clinical-content/rules/`, and both platforms read the same file:

| Rule set (registry id) | Shared file | Web reader | iOS reader | Duplicate removed |
|---|---|---|---|---|
| `diagnostic-reasoning-zebras` 1.0.0 | `zebra-rules.json` (16 rules) | `lib/triage-engine/src/diagnostic-reasoning/zebra-rules.ts` | `ZebraCheck.swift` (`RuleFile`) | the TS rule array; `ios/AmiseMedFlow/Resources/ZebraRules.json` (deleted) |
| `supplement-catalogue` 1.0.0 | `supplement-catalogue.json` (17 items, shared wording incl. the approved herbal patient paragraph, 8 prompt texts, 11 trigger-word lists) | `artifacts/dashboard/src/lib/supplement-catalogue.ts` | `SupplementCatalogue.swift` (`Content`) | the TS item / wording / prompt / trigger literals; the Swift ones |
| `lifestyle-practices` 0.1.0 (content) | `lifestyle-practices.json` (labels, 3 thresholds, 4 regex lists, 13 term lists, 4 prompt texts, 3 prompt sources, 8 sources, 10 plan lines, 9 suggestion names + evidence grades, 11 reasons) | `lib/triage-engine/src/lifestyle-practices.ts` | `LifestylePractices.swift` (`Content`) | every TS and Swift constant and inline wording string; the rule logic stays twinned |

Each JSON file was generated from the current TypeScript source, so its content is today's
content byte for byte (the iOS zebra copy was checked equal first). Every web export keeps its
name and value (`ZEBRA_RULES`, `SUPPLEMENT_ITEMS`, `HERBAL_PREOP_PATIENT_TEXT`, `PLAN_LINES`,
`FASTING_LABELS`, …), so no caller changed; the Swift static members keep their names too
(`SupplementCatalogue.items`, `LifestylePractices.PlanLines.yoga`, `LifestyleHistory.Fasting.label`, …).

## Mechanism

- **Schemas.** `clinical-content/schemas/<name>.schema.json` (JSON Schema 2020-12).
- **Web.** The modules import the JSON (`resolveJsonModule`). `lib/triage-engine/tsconfig.json`
  includes `../../clinical-content/rules/*.json` (its `rootDir` is now the repository root).
- **iOS.** `ios/project.yml` bundles `../clinical-content/rules` into the app as the folder
  reference `rules` (like the Vignettes folder in the test target). New
  `Services/SharedClinicalContent.swift` decodes a file with the engine's Codable struct; a missing
  or undecodable file gives nil (logged), and the engine shows nothing:
  - zebra check: no zebra (as before when `ZebraRules.json` did not decode);
  - supplements: no catalogue match, and the risk snapshot shows one "Supplement rules not loaded"
    notice instead of prompts without their wording;
  - lifestyle: no prompt or suggestion; the fasting / therapy labels read as their stored values.
  Settings → Diagnostics shows "Shared clinical rules: N of 3 loaded" and one row per file (version,
  or the decode error), next to the `DiagnosticDatabase.json` rows.
- **Lint.** `pnpm --filter @workspace/scripts run lint:shared-content` (CI, next to the other
  lints): schema validation (ajv, strict), registry id / json-key version stamp, regex lists
  compile, Swift Codable structs and TypeScript interfaces checked against the schema (field names
  both ways, optional vs required, `String`/`Int`/`Double`/`Bool`, arrays, maps, nullability,
  string-enum values), `SharedClinicalContent.File` and `project.yml` include every file, retired
  copies stay deleted. Unit tests with drift fixtures: `scripts/src/shared-content.test.ts`.
- **Parity checks replaced.** `diagnostic-reasoning-parity.test.ts` no longer compares
  `ZebraRules.json` with the TS array (one file now). `lint:interaction-parity` no longer parses the
  two supplement catalogues; it reads the shared file and still checks that every item's interaction
  term exists on both platforms and that every supplement–drug rule has the same effect and action.
- **Registry** (additive): the three entries list the JSON and schema files, their `versionStamp`
  is now `json-key` `version` on the JSON file, and `lint:shared-content` is in `ciChecks`.
  `lint:guideline-registry`'s known-file list has `clinical-content/rules/*.json` instead of
  `ZebraRules.json`.
- **CI.** `ci.yml` runs `lint:shared-content`; the iOS workflows (`ios-build-check.yml`, `ios.yml`,
  `ios-ui-walkthrough.yml`) also trigger on `clinical-content/rules/**`.

## Behaviour is unchanged — evidence

| Check | Before | After |
|---|---|---|
| Every exported constant of the three web modules (JSON snapshot of all non-function exports) | — | identical (`diff` of the two snapshots is empty) |
| `pnpm -r run test` | pane-engine 236, scripts 56, front-desk 109, api-server 607, dashboard 913 — all pass | pane-engine 236, scripts 65 (−1 zebra copy test, +10 `shared-content.test.ts`), front-desk 109, api-server 607, dashboard 913 — all pass |
| `clinval:web` (433 vignettes) | results JSON / Markdown / console summary | identical apart from `generatedAt` (results files restored, not committed) |
| `pnpm run typecheck`, dashboard build, both e2e scripts (walkthrough 28 pass; encounter switch 11 pass), every scripts lint | pass | pass |

The lifestyle, supplement and zebra behaviour tests (dashboard `lifestyle-practices.test.ts`,
`supplements.test.ts`, `diagnostic-reasoning-core.test.ts` with the shared
`DiagnosticReasoningVectors.json`; iOS `LifestylePracticesTests`, `SupplementTests`,
`DiagnosticReasoningTests`) are unchanged and still pin the output wording, so they now test the
shared file on both platforms.

## For the iOS CI to confirm (Swift cannot be compiled here)

1. `xcodegen generate` accepts the new folder reference (`path: ../clinical-content/rules`, outside
   `ios/`) and the app bundle contains `rules/zebra-rules.json`, `rules/supplement-catalogue.json`,
   `rules/lifestyle-practices.json`.
2. The app target compiles: new `SharedClinicalContent.swift`; `ZebraCheck.swift`,
   `SupplementCatalogue.swift` (`Content`, `Wording`, `SupplementItem`/`SupplementPromptText` now
   `Codable`, statics now computed `static var`), `SupplementAlerts.swift` (not-loaded guard),
   `LifestylePractices.swift` (`Content` and nested structs, `EvidenceGrade: Codable`, labels from
   the file), `ClinicalContentDiagnosticsRows.swift` (`SharedRulesDiagnosticsRows`).
3. Unit tests: new `SharedClinicalContentTests` (every file bundled in `rules/` and decodes; engines
   loaded; lifestyle label keys = enum raw values; missing file reported, not guessed) and the
   unchanged `LifestylePracticesTests`, `SupplementTests`, `DiagnosticReasoningTests` (shared
   vectors) and the iOS clinical-validation run (`ios.reasoning` zebra output).
4. On a device: Settings → Diagnostics → "Shared clinical rules: 3 of 3 loaded".

## Not changed

Drug interactions and classes (including the supplement–drug rules, which stay in the interaction
tables and under `lint:interaction-parity` — phase 2 with their own lint), the lab analyte catalogue
and reference ranges (another agent), `DiagnosticDatabase.json`, pane-engine disease weights, the
treatment-decision table and what's-missing rules (already byte-identical JSON; relocation is phase
2), the lifestyle questionnaire questions, and all rule logic.

## Needs sign-off

Nothing clinical: no content changed. The existing sign-off lists still apply
(`supplements-interactions.md`, `lifestyle-practices.md`, `diagnostic-reasoning.md`).

1. Governance only (behaviour-neutral move, identical outputs before and after). Confirm — clinical rules in
   `clinical-content/rules/*.json` are now the single source for both platforms, and edits there go
   through the same registry versioning and sign-off as before.

## Phase 2 — relocations (branch `shared-content-p2`)

2026-09-26. Branch `shared-content-p2` (from `claude/pr-37-gbg22z` at `d2f4694`). Same mechanism as
phase 1. Engineering change only: **no clinical value, wording, grade or threshold changed**, and
no rule set's content version was bumped. Where a JSON file moved, only its header changed
(`$schema`, `id`, and the `$comment` that named the old copies); every other key and value is
identical to the file it replaces (checked by a structural comparison before and after).

### What changed (phase 2)

| Rule set (registry id) | Shared file | Web reader | iOS reader | Duplicate removed |
|---|---|---|---|---|
| `treatment-decision-support` 1.0.0 | `treatment-decisions.json` (moved from `lib/pane-engine/src/decision/`) + `treatment-decisions.schema.json` | `lib/pane-engine/src/decision/index.ts` (`DECISION_CONTENT`, types in `types.ts`) | `TreatmentDecisionContent.swift` (`TreatmentDecisions.Content`, `SharedClinicalContent.File.treatmentDecisions`) | `ios/AmiseMedFlow/Resources/TreatmentDecisions.json` (byte-identical copy, deleted) |

Lint additions (`scripts/src/shared-content.ts`, unit-tested in `shared-content.test.ts`): a
TypeScript fixed-length tuple (`Triple = [number, number, number]`) is checked as an array whose
schema fixes `minItems` / `maxItems`; a single string literal (`requires?: 'redParameter'`) is
checked as a one-value enum; and a Swift type decoded by hand (`TreatmentDecisions.Triple`, whose
`init(from:)` reads a `[low, point, high]` array) is declared in the mapping's `customDecoded` and
checked as that JSON type. The TypeScript `defaults.uln` type is written as an object literal
(`{ lipase; amylase; troponin }`) instead of the equivalent `Record<'lipase' | …, number>`.

`decision-content-parity.test.ts` no longer compares two copies: it checks that the web engine's
`DECISION_CONTENT` is the shared file, that neither old copy exists (both are also in
`RETIRED_COPIES`), that iOS loads it through `SharedClinicalContent`, and that the shared vectors
(`decision-vectors.json`) are current. The "Swift structs name every key" test is replaced by the
typed schema check.

### For the iOS CI to confirm (phase 2; Swift cannot be compiled here)

1. The app bundle has `rules/treatment-decisions.json` and no `TreatmentDecisions.json` at the
   root; `TreatmentDecisionContent.swift` (`load(from:)` now calls `SharedClinicalContent.load`)
   and `SharedClinicalContent.swift` (new `File` case and `status(of:)` decode) compile.
2. `TreatmentDecisionTests` (shared `decision-vectors.json`), `WhatsMissingTests` (reads
   `TreatmentDecisions.content`), `SharedClinicalContentTests` (every file bundled and decodes;
   `TreatmentDecisions.content` loaded) and the iOS clinical-validation run (`ios.decisions`) pass
   unchanged.
3. On a device: Settings → Diagnostics → "Shared clinical rules" lists "Treatment decisions 1.0.0".

### Needs sign-off (phase 2)

Nothing clinical: no content changed. The existing sign-off lists still apply
(`bayes-treatment.md`).

2. Governance only (behaviour-neutral move). Confirm — the treatment-decision table is now one
   shared file (`clinical-content/rules/treatment-decisions.json`) instead of two byte-identical
   copies.

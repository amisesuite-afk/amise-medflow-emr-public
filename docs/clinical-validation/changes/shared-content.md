# Change log — `shared-content` (one shared rule and content library for web and iOS, phase 1)

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

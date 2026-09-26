# One shared rule and content library for web and iOS

| | |
|---|---|
| Status | Phase 1 done (2026-09-26, branch `shared-content`). Owner-approved item |
| Mechanism | `clinical-content/rules/*.json` + `clinical-content/schemas/*.schema.json`, checked by `pnpm --filter @workspace/scripts run lint:shared-content` |
| Related | `docs/CLINICAL-CONTENT-INVENTORY.md`, `clinical-content/registry.json`, `docs/CLINICAL-CONTENT-UPGRADES.md` §10, change log `docs/clinical-validation/changes/shared-content.md` |

## Why

Many clinical rule sets exist twice: a TypeScript copy for the web dashboard and a Swift copy for
the iOS app, kept in step by parity lints, byte-identity tests or test vectors ported by hand.
Every change is made twice, and each parity mechanism covers only part of the content (the
lifestyle rules had none at all). The goal: a clinical rule lives once, as data, and both
platforms read the same file. That removes drift and halves the maintenance.

What moves is **content** (term lists, thresholds, wording, citations, grades, tables). What stays
in code is **logic** (which finding raises which prompt, how a score is combined): it is small,
changes rarely, and is still pinned by behaviour tests on both platforms.

## 1. Survey: every twinned rule set

"Size" is lines of source today (web / iOS). Risk is the clinical priority in the registry (P1 can
change a diagnosis, dose, escalation or patient instruction). "Drift" is how likely the copies are to
disagree today, judged from the parity mechanism.

| Rule set (registry id) | Web copy | iOS copy | Parity mechanism before this change | Shared JSON already? | Size (web / iOS) | Risk | Drift | Phase |
|---|---|---|---|---|---|---|---|---|
| Zebra rules (`diagnostic-reasoning-zebras`) | `triage-engine/src/diagnostic-reasoning/zebra-rules.ts` (TS array) | `Resources/ZebraRules.json` + `ZebraCheck.swift` | `diagnostic-reasoning-parity.test.ts`: JSON deep-equals the TS array | Half: iOS had a JSON copy of a TS source | 218 / 598 (JSON) | P2 | Medium (two files, hand-kept) | **1 — done** |
| Supplement catalogue, shared wording, prompt texts, trigger words (`supplement-catalogue`) | `dashboard/src/lib/supplement-catalogue.ts` | `Services/SupplementCatalogue.swift` | `lint:interaction-parity` parsed both sources and compared every field | No | 427 / 297 | P2 (one P1 string: the approved herbal patient paragraph) | Medium (long strings typed twice) | **1 — done** |
| Lifestyle practices: labels, thresholds, terms, regex patterns, prompt / plan-line / source / grade / reason text (`lifestyle-practices`) | `triage-engine/src/lifestyle-practices.ts` | `Services/LifestylePractices.swift` | **None** for the content; only test vectors ported by hand ("DRIFT NOTE") | No | 548 / 510 | P2 | **High** (no automated check) | **1 — done** |
| Treatment-decision table: score / result actions, effects, harms, modifiers (`treatment-decision-support`) | `pane-engine/src/decision/treatment-decisions.json` | `Resources/TreatmentDecisions.json` | `decision-content-parity.test.ts`: byte-identical copies, generated vectors, Swift key presence | **Yes** (two byte-identical copies) | 3,069 (JSON) | P1 | Low (byte-identity enforced) | 2 (relocate, add schema, delete copy) |
| What's-missing rules (`whats-missing`) | `pane-engine/src/whats-missing/whats-missing-rules.json` | `Resources/WhatsMissingRules.json` | `whats-missing-parity.test.ts`: byte-identical copies, generated vectors, Swift key presence | **Yes** (two byte-identical copies) | 161 (JSON) | P1 | Low | 2 (relocate, add schema, delete copy) |
| Visit continuity: stop words, body-region map, suffix rules (no registry id; `visit-continuity.ts`) | `triage-engine/src/visit-continuity.ts` | `Services/VisitContinuity.swift` | Vectors ported by hand (DRIFT NOTE) | No | 270 / 120 | P2 | **High** | 2 (first) |
| Lifestyle questionnaire questions (`lifestyle-practices`) | `triage-engine/src/lifestyle-questions.ts` | `Services/LifestyleQuestions.swift` | `lifestyle-questions-ios-parity.test.ts` parses the Swift source | No | 115 / 204 | P2 (patient-facing wording) | Low | 2 |
| Diagnostic-reasoning thresholds, probe-cost terms, time-out checklist, longitudinal thresholds, other-specimen terms, adapter rules (`diagnostic-reasoning-rules`) | `diagnostic-reasoning/core.ts`, `longitudinal.ts`, `families.ts`, `adapter-rules.ts` | `DiagnosticReasoningCore.swift`, `DiagnosticReasoningRules.swift`, `LongitudinalPatterns.swift`, `ZebraCheck.swift` | **`clinical-content/rules/diagnostic-reasoning-rules.json`** (thresholds, families vocabulary, label matching, contradiction threshold, coexisting states; iOS compiles the thresholds in, pinned by `diagnostic-reasoning-parity.test.ts`) + shared vectors `DiagnosticReasoningVectors.json` | Half: rules data shared, logic twinned with vectors | 707 / 676 (mostly logic) | P1 | Low-medium | **2 — rules file done (2026-09-26)** |
| Negation cues and scope rules | `triage-engine/src/negation.ts` | `Services/NegationMatcher.swift` | `negation-parity.test.ts` compares the two test-vector lists, not the cue lists | No | 460 / 585 | P1 (used by every matcher) | Medium | 2 (cue lists only; logic stays) |
| Drug interactions and classes, incl. the 41 herbal / supplement–drug rules (`drug-interactions`) | `dashboard/src/lib/drug-interactions.ts`, `drug-classes.ts` | `DrugInteractionService.swift`, `DrugClasses.swift` | `lint:interaction-parity` (pairs, members, grades; one allow-listed grade difference) | No | 1,070 / 1,933 | P1 | Low (strong lint) but large | 2 (own lint; out of scope for phase 1) |
| NG12 suspected cancer (`cancer-screening` / `ios-suspected-cancer-screening`) | `triage-engine/src/cancer-screening.ts` | `SuspectedCancerScreening.swift`, `+Prompt.swift` | Ported tests (`SuspectedCancerScreeningTests`, 22); version stamps 1.1.0 on both, not compared | No | 514 / 459 | P2 | Medium-high | 3 |
| Preventive screening (`preventive-screening` / `ios-screening-engine`) | `triage-engine/src/screening/preventive.ts` | `ScreeningEngine` in `Views/Consultation/PathwayData.swift` | None; known differences listed in `fix-web-screening.md` | No | 892 / ~285 | P2 | High (known to differ) | 3 (needs a clinical decision on the differences first) |
| NEWS2 bands (`news2`) | `triage-engine/src/news2.ts` | `Services/NEWS2Chart.swift` | Same RCP boundary vectors in `news2.test.ts` and `NEWS2Tests.swift` (27), not compared automatically | No | 325 / 264 | P1 | Low | 3 (bands are small and code-shaped; move with a shared vector file) |
| Emergency recognition (`emergency-recognition` / `ios-clinical-acuity-engine`) | `triage-engine/src/emergency-recognition.ts` | `ClinicalAcuityEngine+Recognition.swift` (+ `ClinicalAcuityEngine.swift`) | None; different scope per platform | No | 1,977 / 437+ | P1 | High (not a one-to-one twin) | 3 (reconcile content clinically first) |
| Plan safety filters (`plan-safety-filters` / `ios-plan-safety-filter`) | `pane-engine/src/management/planSafety.ts` | `PlanSafetyFilter*.swift` | Ported vectors (`WebLastGapsParityTests`) | No | 1,186 / 1,381 | P1 | Medium | 3 |
| Lab analyte catalogue / reference ranges (`lab-report-import-catalog`) | `triage-engine/src/report-import/catalog.ts` | `LabAnalyteCatalog.swift` | `lint:report-import-parity` | No | 449 / 448 | P3 | Low | Not now (another agent is editing it) |
| Clinical scores (C-10: `web-clinical-scales` / `ios-clinical-scoring-engine`) | `clinical-scales.ts`, `clinical-scores.ts` | `ClinicalScoringEngine*.swift` | None | No | large | P2 | High | 4 (formulas are logic; share the reference vectors first) |

Not twins, so not in scope: `DiagnosticDatabase.json` (iOS only), the pane-engine disease model
(web only), the management protocols (web) vs `ManagementEngine` / radiation cards (iOS, different
content). Already shared and not rule content: the clinical-validation vignettes (one folder both
harnesses read) and the shared test-vector files (`DiagnosticReasoningVectors.json`,
`decision-vectors.json`, `whats-missing-vectors.json`).

## 2. Mechanism (built in phase 1)

- **Files.** `clinical-content/rules/<name>.json`, each with a JSON Schema (draft 2020-12)
  `clinical-content/schemas/<name>.schema.json`. Every rules file starts with `$schema`,
  `$comment`, `id` (its registry id) and `version` (its content version, the registry's
  json-key version stamp).
- **Web.** The TypeScript module imports the JSON (`resolveJsonModule`) and exports typed
  constants under the same names as before, so no caller changed. The types are hand-written
  interfaces; `lint:shared-content` checks them against the schema. `lib/triage-engine/tsconfig.json`
  includes `../../clinical-content/rules/*.json` (its `rootDir` is now the repository root; the
  package is still consumed from `src/`). Vite and vitest load the files from the workspace root
  (allowed by `server.fs`); the front-desk app does not import these modules.
- **iOS.** `ios/project.yml` bundles `../clinical-content/rules` as a **folder reference** in the
  app target (like the Vignettes folder in the test target): the files arrive as `rules/<name>.json`
  and a new file needs no per-file registration. `Services/SharedClinicalContent.swift` decodes a
  file with the engine's own Codable structs (`load(_:_:)`). A missing file or a decode failure
  never crashes and never guesses: the engine gets nil and shows nothing, the failure goes to the
  unified log, and **Settings → Diagnostics** lists every shared file with its version or the
  reason ("Shared clinical rules: N of 3 loaded"), like `DiagnosticDatabaseInfo`.
  `SharedClinicalContentTests.swift` asserts on the simulator that every file is in the bundle's
  `rules` folder and decodes.
- **Lint.** `lint:shared-content` (`scripts/src/lint-shared-content.ts`, checks in
  `scripts/src/shared-content.ts`, unit tests in `shared-content.test.ts`) fails when a file has no
  schema or does not validate (ajv, strict); when its `id` is not a registry entry listing it with a
  json-key version stamp; when a regex list does not compile; when a Swift Codable struct or a
  TypeScript interface that reads it disagrees with the schema (every field is a schema property,
  every schema property is read or explicitly ignored, non-optional means required, basic types,
  nullability and string-enum values match — read from source, in the spirit of
  `diagnostic-database-schema.ts`); when `SharedClinicalContent.File` or `project.yml` does not
  include it; or when a retired platform copy (e.g. `Resources/ZebraRules.json`) comes back. It runs
  in CI next to the other lints. The iOS workflows also trigger on `clinical-content/rules/**`.

## 3. Phased migration order

Lowest risk and highest drift first. Each move keeps behaviour identical: the JSON is generated
from the current source, the exported values are compared before and after, and the unit tests
and `clinval:web` must give identical results.

**Phase 1 (done).** Zebra rules; supplement catalogue (items, shared wording, prompt texts,
trigger words); lifestyle-practices content. The treatment-decision table was already shared
JSON, so it waits for the phase-2 relocation.

**Phase 2 (low risk, mechanical).**
1. Visit continuity word rules (high drift, no check today).
2. Treatment-decision table and what's-missing rules: move the web JSON to `clinical-content/rules/`,
   delete the iOS copy, write the schema (replacing the "Swift key presence" test with the typed
   check), keep the generated vectors.
3. Lifestyle questionnaire questions (patient-facing wording; keep `lint:patient-instructions`).
4. Diagnostic-reasoning thresholds and term lists; negation cue lists.
5. Drug interactions and classes, with the supplement–drug rules, under their own lint: rules as
   `{a, b, severity, effect, action}` data, class member lists as data; `lint:interaction-parity`
   becomes a data check (the grade allow-list moves into the file as an explicit, reviewed field).

**Phase 3 (clinical reconciliation first).** NG12 suspected cancer, preventive screening, NEWS2
bands, plan safety filters, emergency recognition. These differ today, or are P1 with rule logic
mixed into the data; each needs a surgeon decision on the differences before one file can serve
both platforms.

**Phase 4.** Share the reference vectors of the clinical scores (C-10) as data, then decide whether
the formulas move.

**Not moved (by decision).** Lab analyte catalogue / reference ranges (another agent is editing
them), `DiagnosticDatabase.json`, pane-engine disease weights.

### Vademecum (2026-09-26, shadow)

The disease-centred vademecum (`clinical-content/vademecum/*.json`) is born shared in a second
folder: `SharedClinicalContent.File` has `vademecumFindings`, `vademecumAbdominalPain` and
`vademecumCoughBreathlessness` (folder `vademecum`), `lint:shared-content` checks both folders and
the per-folder `project.yml` reference. In phase 4 of `docs/VADEMECUM-PLAN.md` it becomes the source
the iOS `DiagnosticDatabase.json` pools and the PANE disease modules are generated from, which
retires those twins for the migrated areas.

## 4. Rules for a shared file

- Change the JSON, not a platform copy. Bump its `version` with the registry entry (and a
  changelog line) for any content change; the lint fails when they disagree.
- A new field: add it to the schema, the Swift Codable struct and the TypeScript interface in the
  same PR (the lint fails otherwise). A field only one platform reads goes in that mapping's
  `ignore` list in `shared-content.ts`, with a reason.
- A new file: add the schema, a `SharedClinicalContent.File` case (and its `status(of:)` decode), a
  `SHARED_CONTENT` entry in `shared-content.ts`, and the registry entry; `project.yml` needs nothing.
- Regex strings must be valid in both ICU (`NSRegularExpression`) and JavaScript.
- Patient-facing text stays under `lint:patient-instructions`, which reads the web export.

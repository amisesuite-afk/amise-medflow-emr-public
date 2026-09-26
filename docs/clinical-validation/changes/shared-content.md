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
| `whats-missing` 1.0.0 | `whats-missing-rules.json` (moved from `lib/pane-engine/src/whats-missing/`) + `whats-missing-rules.schema.json` | `lib/pane-engine/src/whats-missing/rules.ts` (`WHATS_MISSING_RULES`) | `WhatsMissingRules.swift` (`WhatsMissing.Rules`, `SharedClinicalContent.File.whatsMissingRules`) | `ios/AmiseMedFlow/Resources/WhatsMissingRules.json` (byte-identical copy, deleted) |
| `lifestyle-practices` 0.1.0 (questionnaire wording) | `lifestyle-questions.json` (a companion file of `lifestyle-practices.json`: same registry id and version; 3 questions with their text, help text, option values, labels and `triggersKeys`, and the 3 "(patient-reported)" line labels) + `lifestyle-questions.schema.json` | `lib/triage-engine/src/lifestyle-questions.ts` (`LIFESTYLE_QUESTIONS`, line labels; new `LIFESTYLE_QUESTIONS_VERSION`) | `LifestyleQuestions.swift` (`LifestyleQuestions.Content`, `SharedClinicalContent.File.lifestyleQuestions`) | the TS question literals and line labels; the Swift text, option and prefix literals. The queue rule (`placeLifestyleQuestions`, templates) and the iOS answer logic stay in code |
| `negation-cues` 1.0.0 (new registry entry; `negation.ts` was under `excluded`) | `negation-cues.json` (15 pre-negation cues with windows, 10 negating contractions, pseudo-negations after 4 cues, 25 double-negative verbs and 6 fillers, 41 scope terminators, 2 continuers, 6 post-cues, 14 "not X" followers, 10 copulas, 12 fused negatives, "-free", window 6) + `negation-cues.schema.json` | `lib/triage-engine/src/negation.ts` (new `NEGATION_CUES_VERSION`) | `NegationMatcher.swift` (`NegationMatcher.CueFile`, `SharedClinicalContent.File.negationCues`) | the TS and Swift cue literals; the rule stays twinned |
| `visit-continuity` 1.0.0 (new registry entry; was under `excluded`) | `visit-continuity.json` (58 stop words, 6 body regions / 46 words, suffixes `ing` / `ed` / `s` unless ending `ss` with at least 4 letters left, minimum word length 4) + `visit-continuity.schema.json` | `lib/triage-engine/src/visit-continuity.ts` (`VISIT_CONTINUITY_WORD_RULES`, new `VISIT_CONTINUITY_RULES_VERSION`) | `VisitContinuity.swift` (`VisitContinuity.WordRules`, `SharedClinicalContent.File.visitContinuity`) | the TS and Swift stop-word lists, region maps and suffix literals; the matching logic stays twinned |

Lint additions (`scripts/src/shared-content.ts`, unit-tested in `shared-content.test.ts`): a
TypeScript fixed-length tuple (`Triple = [number, number, number]`) is checked as an array whose
schema fixes `minItems` / `maxItems`; a single string literal (`requires?: 'redParameter'`) is
checked as a one-value enum; and a Swift type decoded by hand (`TreatmentDecisions.Triple`, whose
`init(from:)` reads a `[low, point, high]` array) is declared in the mapping's `customDecoded` and
checked as that JSON type (also `WhatsMissing.ProbeValue`, a number or a word); a TypeScript union
of scalars (`probe: number | string`) is checked against the schema's JSON types. Two TypeScript
types were rewritten in an equivalent form the lint can read (type-only, no runtime effect):
`defaults.uln` as an object literal (`{ lipase; amylase; troponin }`) instead of
`Record<'lipase' | …, number>`, and the what's-missing `text` as an explicit `MissingText`
interface (the 20 wording keys and `bandLabels`, the same keys Swift `TextRules` names) instead of
`Record<string, string> & { bandLabels }`.

`decision-content-parity.test.ts` no longer compares two copies: it checks that the web engine's
`DECISION_CONTENT` is the shared file, that neither old copy exists (both are also in
`RETIRED_COPIES`), that iOS loads it through `SharedClinicalContent`, and that the shared vectors
(`decision-vectors.json`) are current. The "Swift structs name every key" test is replaced by the
typed schema check. `whats-missing-parity.test.ts` is changed the same way (the web core reads the
shared file, the copies are gone, the vectors are current); it keeps its check that the Swift rule
structs and core name every key and text, and `gen-whats-missing-vectors.ts` reads the rules through
the web core as before (only its comment names the new path).

**Visit continuity.** The word rules were generated from the web module and compared with the Swift
source first: the region lists are identical word for word, and the stop words are identical as a
set (the Swift literal listed "again" twice). The web module's word-rule export and
`meaningfulWords` output for 23 probe texts were dumped before and after the change and are
identical. New shared vectors `ios/AmiseMedFlowTests/Resources/VisitContinuityVectors.json`
(38 `meaningfulWords` and 16 `isSameProblem` cases, expected values from the web) are run by the
dashboard `visit-continuity.test.ts` and by `VisitContinuityTests.swift`. On iOS a missing or
undecodable file now means no word is meaningful and `VisitContinuity.isAvailable` is false: the
consultation pathway then skips the returning-patient branch (the booked visit type decides, as for
a first visit), the history tab shows the last visit without the "same problem / looks new"
caption, and the diagnostic-reasoning adapter counts no earlier visit as the same problem (the
longitudinal patterns already show nothing without meaningful words). With the file present,
behaviour is unchanged.

**Lifestyle questionnaire questions.** Patient-facing wording, moved verbatim: the JSON was
generated from the web export, and a JSON snapshot of `LIFESTYLE_QUESTIONS`,
`LIFESTYLE_QUESTION_KEYS` (also as re-exported by APCQ) and `lifestyleQuestionnaireLine` for every
key is byte-identical before and after (same key order, so the questions the api-server serves are
unchanged). The Swift literals were already identical (pinned by the parity test that parsed them).
The file carries the `lifestyle-practices` id and version: `lint:shared-content` now accepts a
companion file of a rule set (`COMPANION_FILES`: the registry stamp stays on
`lifestyle-practices.json`, and every file of the rule set must carry the registry version).
`lint:patient-instructions` now also checks this wording (it was not checked before; it passes).
`lifestyle-questions-ios-parity.test.ts` now checks that the web export is the shared file, that
Swift loads it and uses the same question keys and line-prefix rule, and that no wording is typed in
Swift. The front-desk (Next.js) and api-server (esbuild) builds pass with the JSON imported from the
repository root. On iOS a missing or undecodable file means `LifestyleQuestions.isAvailable` is
false: the iPad questionnaire asks no lifestyle question (`asksLifestyleQuestions`), no
"(patient-reported)" line is written, and none is read back from `pmhNotes`.

**Negation cues.** The web and iOS lists were compared first, list by list (a script parsed both
sources): every list is identical, in the same order, and so are the windows (5 / 1 / 0) and the
pre-window limit (6). The one difference is form, not content: the web wrote the double-negative
fillers inline (`next === 'yet' || …`), iOS as a set; both now read `verbNegationFillers`. The JSON
was generated from the web source and cross-checked against the Swift source. Behaviour evidence:
the negation vectors (`negation.test.ts`, the same vectors as `NegationMatcherTests.swift` by
`negation-parity.test.ts`), every negation-aware engine test and `clinval:web` (0 blocking) pass
unchanged. On iOS a missing or undecodable file gives empty cue lists: nothing is negated, so every
match is kept (the matcher's documented safety bias: over-triage, never a hidden finding).

**Not moved.** Drug interactions and classes (out of scope for this phase by decision: they need
their own data lint and the opioid + benzodiazepine grade decision). The record-clauses list
vocabulary (`record-clauses.ts` / `RecordClauses.swift`) stays twinned with its shared vectors.

### For the iOS CI to confirm (phase 2; Swift cannot be compiled here)

1. The app bundle has `rules/treatment-decisions.json` and no `TreatmentDecisions.json` at the
   root; `TreatmentDecisionContent.swift` (`load(from:)` now calls `SharedClinicalContent.load`)
   and `SharedClinicalContent.swift` (new `File` case and `status(of:)` decode) compile.
2. `TreatmentDecisionTests` (shared `decision-vectors.json`), `WhatsMissingTests` (reads
   `TreatmentDecisions.content`), `SharedClinicalContentTests` (every file bundled and decodes;
   `TreatmentDecisions.content` loaded) and the iOS clinical-validation run (`ios.decisions`) pass
   unchanged.
3. On a device: Settings → Diagnostics → "Shared clinical rules" lists "Treatment decisions 1.0.0".
4. The app bundle has `rules/whats-missing-rules.json` and no `WhatsMissingRules.json` at the root;
   `WhatsMissingRules.swift` (`loadRules(from:)` now calls `SharedClinicalContent.load`) compiles.
   `WhatsMissingTests` (shared `whats-missing-vectors.json`), `SharedClinicalContentTests`
   (`WhatsMissing.rules` loaded) and the iOS clinical-validation run (`ios.missing`) pass unchanged;
   Settings → Diagnostics lists "What's missing rules 1.0.0".
5. The app bundle has `rules/visit-continuity.json`; `VisitContinuity.swift` (new `WordRules` /
   `SuffixRules` Codable structs, `wordRules`, `isAvailable`; `stem` now takes the suffix rules),
   `ConsultPathway.swift`, `ConsultationView+HistoryTab.swift` (caption inside `if
   VisitContinuity.isAvailable`) and `DiagnosticReasoningAdapter.swift` (guard in the `same` filter)
   compile. `VisitContinuityTests` (new `testSharedWordRulesLoaded`, `testSharedVectors` over
   `Resources/VisitContinuityVectors.json`, which must be in the test bundle) and
   `SharedClinicalContentTests` pass; Settings → Diagnostics lists "Visit continuity words 1.0.0".
6. The app bundle has `rules/lifestyle-questions.json`; `LifestyleQuestions.swift` (new `Content` /
   `QuestionContent` / `OptionContent` Codable types and `QuestionType` enum; the text, option and
   prefix members are now computed `static var`s; prefixes are `String?`, and `line(prefix:display:)`
   / `value(of:in:)` take an optional) and `AdaptiveQuestionnaireSheet+Lifestyle.swift`
   (`asksLifestyleQuestions` guard) compile. `LifestyleQuestionsTests` (new
   `testSharedQuestionsLoaded`; the existing line and read-back tests pin the wording end to end)
   and `SharedClinicalContentTests` pass; Settings → Diagnostics lists "Lifestyle questionnaire
   questions 0.1.0".
7. The app bundle has `rules/negation-cues.json`; `NegationMatcher.swift` (new `CueFile` Codable
   struct, `cueFile`, `isAvailable`; the cue statics now read the file) compiles.
   `NegationMatcherTests` (the shared vectors), `RecordClauseTests`, every engine test that reads
   text through `NegationMatcher`, `SharedClinicalContentTests` and the iOS clinical-validation run
   pass unchanged; Settings → Diagnostics lists "Negation cues 1.0.0".
8. On a device after phase 2: Settings → Diagnostics → "Shared clinical rules: 11 of 11 loaded", and
   no `Resources/TreatmentDecisions.json` / `Resources/WhatsMissingRules.json` in the app bundle
   (`lint:shared-content` fails if either comes back into the repository).

### Needs sign-off (phase 2)

Nothing clinical: no content changed. The existing sign-off lists still apply
(`bayes-treatment.md`, `whats-missing.md`).

2. Governance only (behaviour-neutral move). Confirm — the treatment-decision table is now one
   shared file (`clinical-content/rules/treatment-decisions.json`) instead of two byte-identical
   copies.
3. Governance only (behaviour-neutral move). Confirm — the what's-missing rules are now one shared
   file (`clinical-content/rules/whats-missing-rules.json`) instead of two byte-identical copies.
4. Workflow. Confirm — the visit-continuity word lists (which words decide "same problem as the
   last visit": stop words such as "pain", "lump", "swelling", and the six body regions) are now a
   registered rule set, `visit-continuity` 1.0.0, in one shared file; the words themselves are
   unchanged. Also confirm the iOS fallback: if the file cannot be read, iOS makes no
   follow-up / new-problem suggestion and the booked visit type decides.
5. Patient-facing wording, governance only (verbatim move). Confirm — the lifestyle questionnaire
   wording is now one shared file (`clinical-content/rules/lifestyle-questions.json`, part of the
   `lifestyle-practices` rule set) and is now also held to `lint:patient-instructions`. Also confirm
   the iOS fallback: if the file cannot be read, the iPad questionnaire does not ask the lifestyle
   questions.
6. P1 matching, governance only (verbatim move). Confirm — the negation cue lists used by every
   free-text matcher on both platforms are now a registered rule set, `negation-cues` 1.0.0, in one
   shared file; no cue or window changed. Also confirm the iOS fallback: if the file cannot be read,
   nothing is negated and every mention counts (over-triage rather than a hidden finding).

# Clinical validation — consultation vignettes

Measures what the consultation engines produce for written clinical presentations and compares
it with current guidelines. One vignette file runs on both platforms:

- **iOS**: XCTest `ClinicalValidationTests` (`ios/AmiseMedFlowTests/ClinicalValidation/`), in the
  unit-test job of `ios-build-check.yml`.
- **Web**: `scripts/src/clinval/` (Node), which calls the same shared engines as the dashboard.

This is measurement only. The harnesses never change an engine, a threshold or clinical data,
and never call AI (`AIService`, Anthropic): every engine they run is deterministic.

| File | What it is |
|---|---|
| `ENGINE-MAP.md` | Which function the consultation calls at each step, on each platform, and which output is authoritative |
| `vignette.schema.json` | JSON Schema for a vignette (draft 2020-12) |
| `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/*.json` | The vignettes (one folder, bundled into the iOS test target and read by the web harness) |
| `results/web-latest.json`, `results/web-latest.md` | Last local web run (committed so changes show in review) |
| `results/ios-latest.jsonl` | iOS results downloaded from CI (optional, see below) |
| `REPORT.md` | Merged iOS + web report, per condition and permutation, grouped by severity |

## Commands

```bash
pnpm --filter @workspace/scripts run clinval:web      # run the web harness, write results/web-latest.*
pnpm --filter @workspace/scripts run clinval:report   # merge iOS jsonl + web results into REPORT.md
pnpm --filter @workspace/scripts run test             # vitest: schema checks, grading vectors, web suite, iOS mirror drift
```

`clinval:web` exits 1 when a critical expectation fails without a `knownGap`/`unverified` flag,
and 2 when a vignette is malformed.

iOS results: the unit-test job prints one `CLINVAL|{json}` line per vignette plus a
`CLINVAL-SUMMARY|` line. The workflow extracts them into `clinval-ios.jsonl`, uploads them as the
`clinval-ios` artifact (30 days) and, on a push to a `claude/**` branch, commits them to that branch
as `results/ios-latest.jsonl` (a bot commit "clinval: iOS results from run …"; pull before pushing).
`clinval:report` reads that file first, so after a green iOS run just pull and run the report.
Manual alternative:

```bash
gh run download <run-id> -n clinval-ios -D /tmp/clinval
cp /tmp/clinval/clinval-ios.jsonl docs/clinical-validation/results/ios-latest.jsonl
pnpm --filter @workspace/scripts run clinval:report   # or: … clinval:report -- --ios <path> --web <path>
```

When run in Xcode, the test also writes `ios/clinval-ios-direct.jsonl` (git-ignored), which
`clinval:report` picks up if there is no `ios-latest.jsonl`.

## Vignette format

See `vignette.schema.json` for every field. The top level:

| Field | Meaning |
|---|---|
| `id` | Kebab-case, equal to the file name without `.json` |
| `condition`, `category` | The true diagnosis and a grouping (`hpb`, `colorectal`, `upper-gi`, `vascular`, …) |
| `permutationOf`, `permutationLabel` | The base vignette id this one varies (absent on a base case) and what changed |
| `summary` | One-line presentation, shown in the report |
| `inputs` | The patient record: demographics (with `pregnancy`), encounter, CC, HPI, iOS SOCRATES chip labels, symptoms and negatives, exam text, vitals, labs, imaging, comorbidities, surgical history, medications, allergies (`nkda`), social history, score form ticks (`scoreForms`), the diagnosis the surgeon confirms (`confirmedDiagnosis`), and per-platform inputs (`platform.web`: CC template, SmartSymptomPicker chips and details, exam chips, PANE answers; `platform.ios`) |
| `expected` | What a guideline-concordant consultation should produce (below) |
| `guideline` | Citations: `id`, `name`, `year`, `section`, `citation`, `verified` (true only after a clinician has checked the source) |
| `rationale` | Why the expectations are what they are |
| `authoring` | Author, date, `reviewedBy` (the surgeon's sign-off) |

Times are relative (`minutesAgo`), so a vignette never goes stale.

### Expectations

Every expectation has an `id` (unique within the vignette) and a `severity`:

- **`critical`**: getting it wrong could harm the patient (missed diagnosis, missed emergency,
  wrong grade that changes management, contraindicated plan). A critical failure fails the test.
- **`quality`**: guideline concordance and noise. Reported, never fails the test.

If you cannot tie a number to a guideline, make it `quality`.

| Group | Fields | Passes when |
|---|---|---|
| `differential.mustRankTopK` | `match`, `unless`, `k` (default 3), `source` | A diagnosis matching `match` (and not `unless`) is ranked ≤ k in the primary differential (`ios.bayes`, `web.pane`) or the given `source` |
| `differential.mustNotMiss` | same (default k = whole list) | The diagnosis appears anywhere in the list |
| `safety.emergencyLevel` | `atLeast`, `atMost` | The level (routine < priority < urgent < emergency) is within bounds. iOS: `ClinicalPathwayEngine` acuity. Web: `adaptiveTriage` `recommendedAction` |
| `safety.mustAlarm` / `mustNotAlarm` | `match`, `unless`, `sources` | An alarm (iOS text-parser banner, pipeline alert; web triage emergency reasons) matches / none does |
| `safety.redFlags` | same | A red flag or alarm matches |
| `scores.recommended` | `score` | The score is among the suggested scores (iOS `DiagnosisScoreMapper`, web `getCdsSuggestions`) |
| `scores.values` | `score`, `mode` (`calculator` \| `autofill`), `equals` / `min` / `max` | **Every** implementation of that score and mode on the platform returns a value in range (web has two TG18 cholangitis calculators; both are held to the guideline) |
| `investigations.mustInclude` / `mustExclude` | `match`, `unless`, `sources` | An investigation output matches / none does |
| `management.mustInclude` / `mustExclude` | same | A management output (plans, templates, prompts, recommendations) matches / none does |
| `pathway` | `equals` | iOS `ConsultPathway` (iOS only by default) |
| `dxVariant` | `equals` | Web `detectDxVariants` id (web only by default) |
| `reasoning.mustInclude` / `mustExclude` | `match`, `unless`, `sources` | A diagnostic-reasoning line matches / none does. Sources `<platform>.reasoning.<part>` with part `alert` ("Doesn't fit the working diagnosis"), `zebra`, `discriminator` (best next question / test), `timeout`, `for`, `against`, `missing`, `doesntfit`, `longitudinal`. n/a when a results file has no reasoning output |

Common optional fields: `platforms` (limit to `ios` or `web`), `guidelineRefs` (ids from
`guideline`), `note`, `knownGap`, `knownGapNote`, `unverified`, `proposedFix`.

**Matching.** Text is normalised first: lower case, curly quotes to straight, en/em dashes to `-`,
whitespace collapsed. Each `match` entry is one alternative:

- a plain string is a substring (`"blood culture"`);
- `re:` is a case-insensitive regular expression (`"re:\\bct\\b[^.;\\n]{0,40}(abdo|pelvi)"`);
- `icd:` is an ICD-10 prefix, for differential items (`"icd:K81"`).

An output that also matches an `unless` alternative does not count (`"cholecystostomy"` unless
`"high surgical risk"`). Write stems that survive both platforms' naming ("cholecyst", "append").

**Sources.** Every output item carries a source id such as `ios.bayes`, `ios.textParser`,
`ios.triage`, `ios.pipeline.decisions`, `ios.radiation.plan`, `ios.autofill.<score>`,
`ios.scoreCalculator.<score>`, `ios.soap.plan`, `web.pane`, `web.symptomInference`,
`web.triage.reasons`, `web.cds`, `web.plan`, `web.managementPanel`, `web.clinicalPrompts.<kind>`,
`web.scoreCalculator.<score>`, `web.scaleCalculator.<score>`, and the Plan-step decision support
`web.decisions` / `ios.decisions` (management: score and result actions, one line per treatment
option — `rank N: <option> — TREAT: …`, `— TEST FURTHER: …`, `OBSERVE rather than <option>: …`),
`web.decisions.notForPatient` / `ios.decisions.notForPatient` (red flags: an option excluded by a
contraindication or withheld by the plan-safety filter) and `web.decisions.shift` /
`ios.decisions.shift` (how the resulted investigations moved the differential). `sources` restricts a
text expectation to these prefixes; an expectation whose sources are all on the other platform is
`n/a` there.

**Scores** use canonical keys: `alvarado`, `air`, `tg18-cholecystitis`, `tg18-cholangitis`, `qsofa`,
`sirs`, `news2`, `bisap`, `ranson`, `glasgow-blatchford`, `rockall`, `asa`, `rcri`, `asge-cbd`.
TG18 values are the grade (1–3; 0 = criteria not met); the others are points. `inputs.scoreForms`
holds the clinician's ticks for the calculator run, with these fields:

| Score | Form fields |
|---|---|
| `alvarado` | `migration`, `anorexia`, `nauseaVomiting`, `rifTenderness`, `rebound`, `temperatureRaised`, `wbcAbove10`, `neutrophilia` |
| `air` | `vomiting`, `rifPain`, `rebound` (0–3), `tempAtLeast38_5`, `pmnBand`, `wbcBand`, `crpBand` |
| `tg18-cholecystitis` | `localSigns`, `systemicSigns`, `imagingCharacteristic`, `wbcAbove18`, `palpableTenderRUQMass`, `durationOver72h`, `markedLocalInflammation`, `organDysfunction[]` |
| `tg18-cholangitis` | `systemicInflammation`, `cholestasis`, `imaging`, `wbcAbnormal`, `feverAtLeast39`, `ageAtLeast75`, `bilirubinAtLeast5mgdl`, `albuminBelow07LLN`, `organDysfunction[]` |
| `qsofa` | `alteredMentation`, `rrAtLeast22`, `sbpAtMost100`, `suspectedInfection` |
| `sirs` | `tempAbove38OrBelow36`, `hrAbove90`, `rrAbove20`, `wbcAbnormal`, `suspectedInfection` |

`organDysfunction` entries: `cardiovascular`, `neurological`, `respiratory`, `renal`, `hepatic`,
`haematological`.

Any score form may instead give a numeric **`total`** (for example `"caprini": { "total": 6 }`,
`"cfs": { "total": 7 }`, `"asa": { "total": 4 }`, `"wells-pe": { "total": 3 }`): the value the
clinician calculated and recorded for decision support ("Use in decision support" on the web Scales
step; the stored score on iOS). Both harnesses pass it to the decision layer as a calculator score;
it does not run a calculator. Each harness maps the form onto its platform's input struct
(`ClinValIOSRunner.calculatorScores`, `web-runner.ts`); `autofill` mode ignores the form and uses
what the app would pre-fill from the record.

### knownGap and unverified

- **`knownGap`** (`true`, or a list of platforms): the engine is known to miss this today.
  A failing known gap is reported but does not fail the run. Always add `knownGapNote` saying what
  the engine does instead. When it starts passing, the report lists it under "flags to remove".
- **`unverified`** (platform list): the expected outcome on that platform has not been observed yet
  (e.g. iOS outcomes that depend on the pipeline and could not be run when the vignette was
  written). Reported, never blocking. Triage it after the first CI run: remove the flag if it
  passes, turn it into a `knownGap` with a note if it fails.

Never flag a new critical expectation just to keep CI green without a note explaining the gap.

**Displayed probabilities.** Until the fix-ios-differential branch the iOS Diagnosis tab's
displayed percentage overstated confidence (stored ×5 ln(LR) units were read as full ln units);
`topResults` now divides by 5. Keep expectations about a displayed percentage `quality`, never
`critical`; rank-based expectations are preferred.

**iOS engine mode.** `DiagnosticDatabase.json` 2.0.0 decodes (1.0.0 did not, so earlier iOS runs
used the built-in fallback lists). Every iOS result records `engineInfo.bayesDatabase`
(`fallback` | `database`), and differential expectations are graded in that mode: results from
the two modes are not comparable, so re-triage every iOS differential flag on the first
`database` run.

## Adding a vignette

1. Copy the closest vignette in `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/` to
   `<condition>-<variant>.json` and set `id` to the file name. For a permutation, set
   `permutationOf` to the base id and change only what the permutation is about.
2. Write the inputs as a clinician would record them. Rules:
   - The CC is the patient's complaint ("Right lower abdominal pain"), never the diagnosis. The
     same applies to `platform.web.ccTemplate`: pick a symptom template (e.g. "Acute abdominal
     pain"), not a diagnosis-named one, or you are testing string matching, not inference.
   - iOS SOCRATES values must be real chip labels from `ConsultationView`'s SOCRATES options,
     web symptom details must be real SmartSymptomPicker option labels; otherwise they are ignored.
   - Put findings in the HPI/exam text as well as in chips: the iOS text parser and web
     prompts read text.
   - Record negatives carefully. Neither platform handles negation well; that is worth testing.
3. Write expectations from the guideline, with a `guideline` entry for each source
   (`verified: false` until a clinician has checked the section). Prefer `quality` when unsure.
4. Run `pnpm --filter @workspace/scripts run clinval:web`. For each failure decide: wrong
   expectation (fix it), or real gap (add `knownGap` + `knownGapNote`, and `proposedFix` if known).
   Web-side results are exact. iOS-side expectations you cannot observe locally get
   `unverified: ["ios"]` until the next CI run.
5. Run `pnpm --filter @workspace/scripts run test` (validates every vignette against the schema
   rules and checks the harness mirrors) and `clinval:report`, and commit the vignette, the
   refreshed `results/web-latest.*` and `REPORT.md` together.

No project change is needed for a new vignette: the Vignettes folder is a folder reference in
`ios/project.yml`, and both harnesses load every `*.json` in it.

## Keeping the two harnesses aligned

- Grading rules exist twice: `scripts/src/clinval/grade.ts` and `ClinValGrader.swift`. The same
  vectors are in `clinval.test.ts` and `ClinValGraderTests.swift`; change both together.
- `ClinValIOSRunner.swift` calls the iOS engines in the order `ConsultationView` does. The vitest
  drift check compares the argument labels of every `BayesianDiagnosisEngine.infer(` call in
  `ConsultationView.swift` / `ConsultationView+DiagnosisTab.swift` with the runner's; if the view
  changes, update the runner.
- `web-runner.ts` mirrors the dashboard call sites listed in `ENGINE-MAP.md`.

## Limits

- The web dashboard has no consultation-pathway concept (`pathway` is iOS only), and iOS has no
  dx-variant engine (`dxVariant` is web only).
- iOS has no pregnancy field; pregnancy is visible to iOS engines only through free text.
- iOS `SurgicalRiskEngine`, web `cc-matrices.ts`, `safety-engine.ts` and `clinical-pathways.ts`
  are not run yet (see `ENGINE-MAP.md`).
- Citations are recorded as `verified: false`: they were written from the guideline texts but
  need a clinician's check against the source before they are treated as authoritative.

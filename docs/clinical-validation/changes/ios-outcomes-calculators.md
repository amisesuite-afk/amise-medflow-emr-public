# Change log — `ios-outcomes-calculators` (iOS outcomes sync, iOS decision-rule calculators, iOS validation runner)

2026-09-26. Branch `ios-outcomes-calculators` (from `claude/pr-37-gbg22z`). Rule sets: `decision-rules`
1.0.0 → 1.1.0, `ios-bayesian-diagnostic-database` 2.2.0 → 2.3.0 (`clinical-content/registry.json`). Status
**needs sign-off**. No `lastReviewed` date was set.

Three follow-ups the evidence-exam and outcomes-calibration work left open:

1. iOS predictions and final diagnoses now reach Supabase (Migration 94), following every iOS sync rule.
2. iOS has the calculators the Exam step pointed to the web for (Ottawa ankle / knee, Canadian CT head,
   NEXUS, Canadian C-spine, San Francisco syncope rule, Canadian syncope risk score) and the real STONE
   score. Each one's result feeds the engines through its `decision-rules.json` band, like the other rules.
3. The iOS clinical-validation runner stores the recorded scores on the patient before the differential
   runs, as the app does.

Everything is deterministic (no AI). **No existing score formula was changed.** The old iOS "STONE"
calculator is only renamed. **The web calculators already existed; the web is unchanged** apart from new
tests.

## 1. iOS outcomes: push and pull

Details: [outcomes-calibration.md](outcomes-calibration.md) ("iOS: push and pull").

- `SyncService+Outcomes.swift` runs after the main sync steps, in its own requests, and never throws.
  Rules are in `OutcomeSync.swift`.
- **Values.** Everything is checked by `OutcomeSanitiser.swift`, the Swift twin of the web sanitisers in
  `lib/triage-engine/src/outcomes/codes.ts`. Shared vectors
  (`ios/AmiseMedFlowTests/Resources/OutcomeSanitiserVectors.json`, 23 cases) run on both platforms.
- **Snapshots.** Inserted once; a `23505` adopts the existing row, so the first completion wins.
- **Final diagnoses.** A correction is sent as "retract the old row, then confirm the new one". Pending
  retractions go first.
- **Who.** Only a confirmed nurse, doctor or admin role. Front desk sends and reads nothing.
- **Sync rules followed:**
  - pendingSync is cleared only when the server returns the row;
  - a 0-row retraction is read back by id;
  - a `42501` is marked refused and the loop carries on;
  - patient ids go through `SyncRemoteId.serverId`;
  - the pull skips any encounter with pending changes.
- **Migration 94 not applied yet.** A missing table stops the step quietly (no error, no pending count).
  It is tried again six hours later, or at the next sign-in or launch.

## 2. Decision-rule calculators on iOS

`Services/ClinicalScoringEngine+DecisionRules.swift` and `+DecisionRules2.swift` hold the calculators. The
forms are in `Views/Scores/ClinicalScoresView+DecisionRuleForms.swift` and the pre-fill in
`Services/PatientScoreAutoPopulator+DecisionRules.swift`.

Each calculator mirrors the web calculator (`artifacts/dashboard/src/lib/decision-rule-scores.ts`,
`RULE_SPECS`): the same items, points and recorded value. The shared vectors
(`ios/AmiseMedFlowTests/Resources/DecisionRuleCalculatorVectors.json`, 37 cases, published examples
included) run against the web calculators (`decision-rule-vectors.test.ts`, passing) and the Swift ones
(`DecisionRuleCalculatorTests.swift`).

| Calculator (ActiveScore) | Items (points) | Recorded value → decision-rules.json band | iOS candidates the band moves | Source |
|---|---|---|---|---|
| STONE score, ureteric stone (`stoneUreteric`, new) | Male 2; pain < 6 h 3 / 6–24 h 1 / > 24 h 0; non-black origin 3; nausea 1 / vomiting 2; haematuria 3 | 0–13 → low 0–5 (LR 0.10), moderate 6–9 (1.0), high 10–13 (7.8) | The six renal / ureteric colic candidates (low −12, high +10 log units) | Moore CL et al. BMJ 2014;348:g2191 |
| Ottawa ankle and foot rules (`ottawaAnkle`) | Lateral malleolus, medial malleolus, base of 5th metatarsal, navicular tenderness; unable to bear weight (4 steps) | Criteria present → negative 0 (LR 0.08), positive 1+ (1.5) | None: no fracture candidate in the iOS database | Stiell JAMA 1993; Bachmann BMJ 2003 |
| Ottawa knee rule (`ottawaKnee`) | Age ≥ 55; isolated patellar tenderness; fibular head tenderness; cannot flex to 90°; unable to bear weight | Criteria present → negative 0 (0.05), positive 1+ (1.9) | None | Stiell JAMA 1996; Bachmann Ann Intern Med 2004 |
| Canadian CT head rule (`canadianCTHead`) | High risk: GCS < 15 at 2 h, open / depressed fracture, basal skull fracture sign, vomiting ≥ 2, age ≥ 65. Medium risk: amnesia ≥ 30 min, dangerous mechanism | 0 none (LR 0.03), 1 medium only (1.5), 2 high (3.2) | Subdural, extradural, cerebral contusion (5 candidates; none −18, medium +2, high +6) | Stiell Lancet 2001; NICE NG232 |
| NEXUS (`nexus`) | Midline cervical tenderness, focal deficit, altered alertness, intoxication, distracting injury | Criteria not met → negative 0 (0.03), positive 1+ (1.14) | None | Hoffman NEJM 2000 |
| Canadian C-spine rule (`canadianCSpine`) | High risk: age ≥ 65, dangerous mechanism, paraesthesia. Needed for no imaging: a low-risk factor and active rotation 45° | 0 no imaging (LR 0.01), 1 imaging (1.8) | None | Stiell JAMA 2001; NEJM 2003 |
| San Francisco syncope rule (`sfSyncope`) | CHF history, haematocrit < 30 %, abnormal ECG, breathlessness, SBP < 90 | CHESS criteria present → negative / positive | Prognostic: display only | Quinn Ann Emerg Med 2004; Saccone 2010 |
| Canadian syncope risk score (`canadianSyncope`) | Vasovagal predisposition −1; heart disease +1; SBP < 90 or > 180 +2; troponin > 99th centile +2; QRS axis +1; QRS > 130 ms +1; QTc > 480 ms +2; ED diagnosis vasovagal −2 / cardiac +2 | −3 to 11 → very low / low / medium / high / very high (risks from the JSON) | Prognostic: display only | Thiruganasambandamoorthy CMAJ 2016 |

- **Linked to the engines.** Each rule's `decision-rules.json` entry now has an `ios` entry (`param`,
  `activeScore`), like Alvarado, AIR, Wells, PERC, HEART, Centor and LRINEC.
  - Saving stores the value on the patient (new optional fields `stoneUretericScore`, `ottawaAnkleScore`,
    `ottawaKneeScore`, `canadianCTHeadScore`, `nexusScore`, `canadianCSpineScore`, `sfSyncopeScore`,
    `canadianSyncopeScore`; a lightweight SwiftData migration).
  - New `BayesianDiagnosisEngine.infer` parameters of the same names are passed by the Diagnosis step, the
    clinical pipeline (`SequentialDiagnosisEngine.seed`) and the validation runner.
  - `DecisionRuleEvidence.observedBands` turns a stored value into its band. Prognostic rules are left out,
    so they never change the differential.
  - The Exam step shows the stored band and opens the calculator. Its "not yet on iOS" line no longer
    appears for these rules.
  - `scripts/src/decision-rules-ios-links.test.ts` (CI) checks every link against the Swift source: the
    case, the field, the infer parameter, the rule value, the saving code and the Exam step.
- **`DiagnosticDatabase.json` 2.3.0**, regenerated by `gen-exam-evidence-db.ts`, adds 27 `rule` features:
  - 12 STONE features on the renal / ureteric colic candidates;
  - 15 Canadian CT head features on the subdural, extradural and cerebral contusion candidates.

  No other value changed. The STONE target now has iOS name fragments (`ureteric colic`, `renal colic`,
  `ureteric calculus`).

  The Canadian CT head fragments were `subdural`, `head injury`, `traumatic brain`. They are now
  `subdural`, `extradural`, `cerebral contusion`: the old `traumatic brain` matched
  "Concussion / Mild Traumatic Brain Injury". A negative rule (LR 0.03, −18 log units) would have pushed
  down the likeliest diagnosis after a minor head injury, and it missed both extradural candidates.
- **Result card.** Every calculator's recommendations end with its `decision-rules.json` band line, e.g.
  "Decision-rule evidence — Ottawa ankle and foot rules: No criterion: X-ray not needed — LR 0.08
  (0.03–0.18) for Ankle or midfoot fracture (value not yet verified against the source)". Prognostic lines
  say they do not change the differential.
- **Pre-fill ("from record").** Each pre-fill uses the web's regular expressions, read negation-aware
  through `NegationMatcher`. It reads the history, examination and resulted-investigation text, the age
  (only when a date of birth is recorded), sex and the latest systolic BP.
  - Every pre-filled item shows a **from record** badge.
  - Nothing is assumed normal. STONE origin and pain timing are never pre-filled.
- **Scores suggested for the working diagnosis** (`DiagnosisScoreMapper`):
  - kidney stone → STONE first, the local CT features score third;
  - ankle or knee sprain / fracture / injury → Ottawa;
  - head injury or concussion → Canadian CT head rule;
  - neck injury or whiplash → Canadian C-spine rule and NEXUS;
  - syncope or faint → both syncope rules.

### The old iOS "STONE" calculator is relabelled

- **What it was.** `ClinicalScoringEngine.stone` was shown as "STONE Score" and cited Moore et al. 2014.
  It actually scores stone size on CT, UVJ narrowing, obstruction, nausea and haematuria (0–6).
- **New name.** "Stone CT Features (local 0–6, not STONE)", saved as "Stone CT Features Score (not
  STONE)". Its note now says it is a local composite and not the STONE score, and its maximum is shown as
  6.
- **Unchanged.** The formula and the legacy engine boost (score ≥ 4 raises the colic candidates) are the
  same. Only the boost's evidence label changed, from "STONE n/5" to "Stone CT features n/6".
- **Old records.** Entries saved as "STONE Score" still open this calculator.
- **Not evidence.** It is not linked to the `stone` decision rule.

## 3. iOS validation runner

`ClinValIOSRunner` computed the vignette calculators (`scoreForms`) after the differential and never
stored them, so a recorded rule (PERC, STONE, AIR, Ottawa, Wells PE …) could not reach the iOS differential,
although in the app the saved calculator result does.

The runner now:

- computes the calculators first;
- saves each result, or the form's `total`, with `ScorePersistence.store`. This is
  `ClinicalScoresView.persistScoreToPatient` moved out of the view unchanged, so the runner uses the app's
  own code;
- runs the differential with the same `infer` arguments as the Diagnosis step, the new rule parameters
  included.

The graded calculator outputs are the same. Canonical keys: `stone` is now the published STONE score (the
local score is `ios:stone`), and the new calculators use their `decision-rules.json` ids. Expect iOS
differential changes in vignettes with `scoreForms` (e.g. `exam-stone-score-high-renal-colic`,
`exam-perc-negative-low-wells`, the appendicitis vignettes with Alvarado / AIR forms) at the next iOS run.

## Files

| Area | Files |
|---|---|
| Outcomes | `Services/{OutcomeSanitiser,OutcomeSync,SyncService+Outcomes}.swift` (new); edits in `OutcomeSnapshot.swift`, `SyncService.swift`, `SyncService+Refusals.swift`, `SyncService+OfflineQueue.swift`, `FinalDiagnosisSection.swift`, `ConsultationView+OutcomeSnapshot.swift` |
| Calculators | `Services/{ClinicalScoringEngine+DecisionRules,ClinicalScoringEngine+DecisionRules2,PatientScoreAutoPopulator+DecisionRules,ScorePersistence}.swift`, `Views/Scores/ClinicalScoresView+DecisionRuleForms.swift` (new); edits in `ClinicalScoreCategories.swift`, `ActiveScore+StoredName.swift`, `ClinicalScoresView{,+AutoPopulate,+Recalculate,Forms}.swift`, `ClinicalScoringEngine+Screening2.swift`, `Patient.swift`, `BayesianDiagnosisEngine.swift`, `SequentialDiagnosisEngine.swift`, `ClinicalPipelineOrchestrator.swift`, `ConsultationView+DiagnosisTab.swift`, `ExamSignsSection.swift`, `DecisionRuleEvidence.swift`, `DiagnosisScoreMapper{,+Mappings}.swift` |
| Content | `clinical-content/rules/decision-rules.json` 1.1.0, `ios/AmiseMedFlow/Resources/DiagnosticDatabase.json` 2.3.0, `scripts/src/gen-exam-evidence-db.ts`, `clinical-content/registry.json` |
| Runner | `ios/AmiseMedFlowTests/ClinicalValidation/ClinValIOSRunner.swift`, `docs/clinical-validation/README.md` |
| Tests | `ios/AmiseMedFlowTests/{OutcomeSyncTests,DecisionRuleCalculatorTests}.swift`, `Resources/{OutcomeSanitiserVectors,DecisionRuleCalculatorVectors}.json`; `artifacts/dashboard/src/lib/__tests__/{outcomes-sanitiser-vectors,decision-rule-vectors}.test.ts`; `scripts/src/decision-rules-ios-links.test.ts` |

## Checks

| Check | Result |
|---|---|
| `pnpm run typecheck` | pass |
| `pnpm -r run test` | pass (dashboard 1101, api-server 653, front-desk 112, pane-engine 259, scripts 149) |
| Scripts lints (`lint:grants`, `lint:rls-policies`, `check:migrations-fresh`, `lint:dx-phases`, `lint:patient-instructions`, `lint:no-external-qr`, `lint:interaction-parity`, `lint:report-import-parity`, `lint:reference-range-parity`, `lint:guideline-registry`, `lint:history-frames`, `lint:shared-content`, `lint:signoff-catalogue`) | pass |
| Dashboard build | pass |
| `clinval:web` (454 vignettes) | 3190 expectations: 3018 pass, 78 fail, 94 n/a; **0 blocking**, 0 critical failures (the same as before this change; the web is unchanged). Results files restored, not committed |
| Swift | **Not compiled here.** Types were grepped before being declared, calls checked against their declarations, argument labels kept in declaration order, and the `Color.opacity` patterns avoided. Run the Xcode build, `OutcomeSyncTests`, `DecisionRuleCalculatorTests`, `ScoresFollowupTests` and the iOS clinical-validation run |

## Findings (not changed here)

- The legacy Stone CT features boost in `BayesianDiagnosisEngine.infer` gives +9 log units for a score of 5
  and +7 for 4 or 6 (written when the maximum was thought to be 5). Unchanged: engine weights are for the
  surgeon.
- Glasgow-Blatchford, TG18 cholecystitis / cholangitis, qSOFA, NEWS2, Caprini and RCRI have iOS
  calculators, but their `decision-rules.json` entries have no `ios` link. The Exam step still says
  "Calculator on the web Scales step (not yet on iOS)" for them.
  - Linking TG18 cholecystitis (diagnostic) would replace its legacy fixed adjustment with its band, as
    for the other rules.
  - The rest are prognostic.
- The iOS database has no ankle, midfoot or knee fracture or cervical-spine injury candidate. The Ottawa,
  NEXUS and Canadian C-spine bands are recorded and shown, but move nothing on iOS (the web has no
  target diagnosis for them either).
- The Canadian syncope risk percentages in `decision-rules.json` (0.4 / 0.9 / 8 / 20 / 36 %) were
  written from memory and should be checked against the CMAJ 2016 derivation paper.
- The `exam-*` vignettes' iOS expectations are still `unverified: ['ios']` until an iOS run with this
  runner.

## Needs sign-off

1. **The eight iOS calculators as mirrored from the web**: items, points and recorded values. Three are
   simplified:
   - Ottawa ankle counts any criterion, without the pain-in-the-zone precondition;
   - the Canadian CT head rule is recorded as 0 / 1 / 2;
   - the Canadian C-spine rule is recorded as 0 / 1.
2. **STONE "origin: non-black" item** in a Caribbean population. It is kept as derived, never pre-filled,
   and flagged "not validated in Caribbean populations": keep, drop, or mark the result unreliable?
3. **STONE as iOS evidence.** Its bands apply to the six renal / ureteric colic candidates: low 0–5
   (LR 0.10, −12 log units) and high 10–13 (LR 7.8, +10). The moderate band (LR 1.0) has no effect.
4. **Canadian CT head iOS targets narrowed** to subdural, extradural and cerebral contusion; concussion /
   mild traumatic brain injury is excluded. A negative rule applies LR 0.03 (−18 log units) to those five
   candidates.
5. **Rules with no iOS target** (Ottawa ankle / knee, NEXUS, Canadian C-spine) are recorded and shown
   only. Should fracture and cervical-spine injury candidates be added to the iOS database?
6. **Syncope rules are display only** (prognostic), and the Canadian syncope risk percentages come from
   `decision-rules.json` (written from memory).
7. **The old iOS "STONE" calculator:**
   - it is relabelled "Stone CT features (local 0–6, not STONE)" rather than removed;
   - its legacy engine boost (score ≥ 4: +7, or +9 at 5) is unchanged;
   - decide whether to keep it, retire it, or remove its boost.
8. **Pre-fill.** The web's regular expressions are used on iOS, negation-aware. The age comes only from a
   recorded date of birth. Every pre-filled item is labelled "from record", and nothing is assumed normal.
9. **Recommendation wording** in each calculator. For example:
   - NICE NG232 CT within 1 h (high risk) or 8 h (medium risk);
   - a high STONE score: "consider limiting imaging to ultrasound or low-dose CT KUB";
   - syncope: "senior review; consider cardiac monitoring and admission".
10. **Scores suggested for the working diagnosis:** STONE before the local score for kidney stones; Ottawa
    for ankle / knee injuries; the Canadian CT head rule for head injury or concussion; the Canadian C-spine
    rule and NEXUS for neck injury or whiplash; both syncope rules for syncope or faint.
11. **iOS outcomes push:**
    - `confirmed_at` is the device's time of confirmation, not the server's;
    - a diagnosis confirmed and retracted before it was sent is stored on the server as retracted;
    - a final diagnosis recorded on the web for an iOS visit is pulled onto the device;
    - the six-hour back-off while Migration 94 is missing;
    - front desk excluded.
12. **Validation runner.** Recorded scores are now stored before the differential, as in the app. Review
    the iOS differential changes in the vignettes with calculator forms at the next iOS run.

## Owner actions

- Build in Xcode and run the iOS unit tests and the iOS clinical-validation run.
- After Migration 94 is applied, complete one visit on an iPad (nurse or doctor account). Check that
  `prediction_snapshots` has an `ios:` row, then record, retract and re-record a final diagnosis and check
  `diagnosis_outcomes`.

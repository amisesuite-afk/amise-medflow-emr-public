# Change log: `diagnostic-reasoning` (deterministic diagnostic-reasoning layer, web + iOS)

Branch `diagnostic-reasoning` from `claude/pr-37-gbg22z` at `b9f5a7c`, 2026-09-25. Owner's brief: a
diagnostic partner that reasons like a sharp diagnostician, is open about why, fights premature
closure and never hides uncertainty; the clinician always decides.

Everything here is **deterministic** (no AI calls on either platform) and **unreviewed**. It reads the
engines' own evidence (PANE feature likelihoods and background rates on the web; DiagnosticDatabase
candidate features, logLR and citations on iOS). **No differential weight, prior or DiagnosticDatabase
entry was changed.** Nothing is written to the record unless the clinician taps "Add to differential"
or "Add test to plan" / "Add test".

## What the clinician sees

A **"Diagnostic reasoning"** card: on the web under the PANE differential on the Assessment step
(collapsible, Alt+R), on iOS under "Suggested Differentials" on the Diagnosis step (collapsible
section; alerts stay visible).

1. **Doesn't fit the working diagnosis** (only once a diagnosis is confirmed; dismissible for the
   visit), e.g. "Doesn't fit the working diagnosis: the record favours Acute Pancreatitis (>99%) over
   Biliary Colic (<1%) — mainly Elevated amylase / lipase (LR 90 vs 1.0)", "…no raised lipase,
   expected in Acute pancreatitis (LR 0.10)", "NEWS2 rising (0 → 9): is Renal Colic / Urolithiasis still the whole
   story? Consider …".
2. **Diagnostic time-out suggested** (collapsed): the reason ("4 recorded findings are not explained
   by the leading diagnoses (…)", "Visit 3 for the same complaint with changing diagnoses (…)") and a
   six-question checklist (Croskerry 2003; Ely, Graber & Croskerry 2011; Graber 2012). Not recorded.
3. **Why these diagnoses**: for each of the top 3 (and the working diagnosis when it is outside
   them): engine probability with a range (web: lowest–highest posterior leaving out any one recorded
   finding), a "low evidence" tag when no finding supports it with LR ≥ 2, and four lists — **For**
   (finding + LR), **Against** (present findings with LR ≤ 0.67 and documented negatives), **Expected,
   missing** (cardinal findings documented absent or not recorded), **Doesn't fit** (recorded findings
   it does not explain, with the diagnosis each favours). Each finding's source is shown on hover
   (web: the PANE module's guidelines; iOS: the database citation).
4. **Best next discriminator**: up to three questions, signs or tests with a cost tag (Ask /
   Bedside / Lab / Imaging / Advanced) and the effect, e.g. "If positive: Acute Pancreatitis 87% →
   >99%, Acute / Chronic Gastritis 6% → <1%. If negative: Acute Pancreatitis → 22%." Tests get "Add
   test to plan" (web: a "Consider …" line in the plan text) / "Add test" (iOS: a Suggested
   investigation). Nothing is ordered.
5. **Zebra check**: rare but real conditions whose combination is recorded, with the matched terms,
   ICD-10 and citation; "Add to differential"; the herb-induced liver injury rule links to the
   supplements history.
6. **Across visits** (read-only): recurring presentations (3+ visits), creatinine rising, haemoglobin
   falling, weight loss, and earlier diagnoses that were later revised.

The card says, every time, that findings are what the record says and LRs and percentages are
engine estimates; percentages are never shown as 0 % or 100 % ("<1%", ">99%").

## Design

| Part | Web | iOS |
|---|---|---|
| Core rules (explain, information gain, post-test, cost tiers, ranking, closure, time-out) | `lib/triage-engine/src/diagnostic-reasoning/core.ts` | `Services/DiagnosticReasoningCore.swift` |
| Zebra rules + matching + lab-derived terms | `zebra-rules.ts`, `zebras.ts` | `Resources/ZebraRules.json`, `Services/ZebraCheck.swift` |
| Longitudinal patterns | `longitudinal.ts` (reuses `visit-continuity.ts` `meaningfulWords`) | `Services/LongitudinalPatterns.swift` (reuses `VisitContinuity.meaningfulWords`) |
| Engine adapter | `artifacts/dashboard/src/lib/diagnostic-reasoning.ts` (PANE) | `Services/DiagnosticReasoningAdapter.swift` (Bayesian engine) |
| UI | `components/DiagnosticReasoningPanel.tsx` in `AssessmentTab` | `Views/Consultation/DiagnosticReasoningCard.swift` in the Diagnosis tab |
| Harness | `web.reasoning` (clinval web runner) | `ios.reasoning` (`ClinValIOSRunner`) |

- **Twins with shared vectors.** `ios/AmiseMedFlowTests/Resources/DiagnosticReasoningVectors.json`
  (explain, information gain, post-test, cost classification, ranking, explanation text, LR and
  percentage formatting, closure alerts, time-out, 21 zebra texts, derived lab terms, longitudinal)
  is read by `artifacts/dashboard/src/lib/__tests__/diagnostic-reasoning-core.test.ts` and
  `ios/AmiseMedFlowTests/DiagnosticReasoningTests.swift`. `scripts/src/diagnostic-reasoning-parity.test.ts`
  fails when `ZebraRules.json` differs from `zebra-rules.ts` or when the Swift thresholds, cost terms,
  checklist, longitudinal thresholds or other-specimen terms drift from the TypeScript.
- **Web evidence.** LR of a present finding = P(finding | disease) / background rate
  (`featureLikelihood` / `baseRate`); absent = (1 − P) / (1 − background). Cardinal = the disease lists
  the feature with P ≥ 0.6 and LR ≥ 2. Discriminators: `informationGain` (now exported from
  pane-engine; unchanged) over a state holding only the top 3 (a test checks the core gain equals it),
  post-test probabilities from `updatePosterior` on the full state.
- **iOS evidence.** `score()` now records every fired feature (`FiredFeature`: key, value, applied and
  stored logLR, label, source, citation, documented-absent flag) and `topResults` passes it and the
  candidate's feature list on `DiagnosisResult` (`firedFeatures`, `candidateFeatures`, both defaulted,
  so every existing call compiles unchanged). `Candidate.Feature` gained an optional `citation` that
  the database loader fills. LR = exp(logLR / 5). `notFinding` → a cardinal finding missing
  (documented absent or not recorded); `findingAbsent` → a documented negative arguing against.
- **Negation.** Zebra terms are matched at word starts through `containsAffirmed` /
  `NegationMatcher.Source.contains(_, wordStart: true)`, so "no gallstones", "denies alcohol excess",
  "no urticaria" are read correctly.

## Results

Checks on the final tree: `pnpm run typecheck` ✓; `pnpm -r run test` ✓ (dashboard 801, api-server
600, front-desk 109, pane-engine 126, scripts 41); all scripts lints ✓ (`scan:nav-lockout` prints its
two existing Home.tsx warnings, not from this branch); dashboard build ✓; `e2e/emr-walkthrough.mjs`
26/26 (one new check: the panel renders) and `e2e/encounter-switch.mjs` 11/11 ✓. Swift could not be
compiled or run here.

`clinval:web` (409 vignettes, 3101 expectations): pass 2933, fail 76 (all quality; 74 known gaps),
**0 critical fails, 0 blocking**. Against the base (397 vignettes, 3087 expectations: 2919 / 76 / 0):
**no expectation changed status**; the 14 new expectations all pass. Results files were restored,
not committed.

Alert and time-out rates on the 397 original vignettes, whose confirmed diagnoses are correct, were
used to tune the thresholds against alert fatigue:

| | First rules | Final |
|---|---|---|
| Vignettes with a "doesn't fit" alert | 260 | 77 |
| Vignettes with a time-out suggestion | 254 | 103 |

Many of the remaining alerts come from PANE modelling a diagnosis at a different granularity
(inguinal hernia vs incarcerated hernia, choledocholithiasis vs cholangitis) or from feature-mapper
artefacts (below). They are dismissible and name their reason; the rate is a sign-off item.

### New vignettes (12; `expected.reasoning`; iOS `unverified`)

| Vignette | Exercises | Web |
|---|---|---|
| `reasoning-closure-biliary-colic-lipase` | Confirmed biliary colic, lipase 1850 → alert names lipase and pancreatitis (critical + quality) | pass |
| `reasoning-closure-gastritis-troponin` | Confirmed gastritis, hs-troponin 480 → alert favours ACS (critical) | pass |
| `reasoning-closure-gastroenteritis-dka` | Confirmed gastroenteritis, ketones 5.4 / HCO₃ 9 → alert favours DKA (critical) | pass |
| `reasoning-closure-renal-colic-news2-rising` | Confirmed renal colic, NEWS2 0 → 9 → NEWS2 alert (critical) | pass |
| `reasoning-zebra-eoe-food-bolus` | EoE | pass |
| `reasoning-zebra-conn-hypokalaemia` | Conn's (K 2.9 derived to hypokalaemia) | pass |
| `reasoning-zebra-phaeo-episodes` | Phaeochromocytoma | pass |
| `reasoning-zebra-aortoenteric-fistula` | Aorto-enteric fistula (critical) | pass |
| `reasoning-zebra-herbal-liver-injury` | Herb-induced liver injury | pass |
| `reasoning-zebra-recurrent-pancreatitis` | Recurrent pancreatitis without gallstones / alcohol → hypertriglyceridaemia | pass |
| `reasoning-next-test-epigastric-lipase` | Lipase first, no advanced test | pass |
| `reasoning-next-test-rif-pain-woman` | Pregnancy test first in RIF pain | pass |

Harness: `EngineOutputs.reasoning` (`<platform>.reasoning.<part>`), expectation kinds
`reasoningInclude` / `reasoningExclude` in `grade.ts` and `ClinValGrader.swift` (n/a when a result
file has no reasoning output, e.g. the current `ios-latest.jsonl`), schema and README updated.

## Findings surfaced while building this (not changed here)

- **PANE feature-mapper artefacts** are now visible in "Doesn't fit": e.g. hernia features in an
  acute heart-failure vignette, "Burn wound present" in a hypertensive emergency, and "fever" read as
  present in `biliary-colic-asymptomatic-incidental-gallstones` ("has never had abdominal pain,
  indigestion after food, jaundice or fever": the negation window is 5 words and the comma list ends
  the scope). The reasoning panel shows them honestly; the mapper should be fixed separately.
- The time-out's "unexplained findings" count is inflated by the same artefacts.

## Registry

`clinical-content/registry.json`: `diagnostic-reasoning-rules` (P1) and
`diagnostic-reasoning-zebras` (P2), both 1.0.0 with version stamps (`DIAGNOSTIC_REASONING_VERSION`,
`ZEBRA_RULES_VERSION`), changelog, `lastReviewed: "unknown"`; `BayesianDiagnosisEngine+Reasoning.swift`
added to `ios-bayesian-engine`. `lint:guideline-registry` knows the new files. Inventory,
`ENGINE-MAP.md`, the ios-arch skill and CLAUDE.md are updated.

## Needs sign-off

1. **Evidence thresholds**: "for" LR ≥ 1.5, "against" LR ≤ 0.67, "favours" LR ≥ 2, "low evidence" =
   no finding with LR ≥ 2; cardinal = P ≥ 0.6 and LR ≥ 2 (web) / stored logLR ≥ 8, LR ≈ 5 (iOS).
2. **Premature-closure triggers**: a finding the working diagnosis models with LR ≤ 0.33 (present,
   or a cardinal finding documented absent); "the record favours X" when X ≥ 50 %, ≥ 5 × the working
   diagnosis and a named present finding has an LR ratio ≥ 10; NEWS2 rising by ≥ 2 to ≥ 5 (RCP
   urgent-response threshold). Alert rate 77 / 397 vignettes with correct diagnoses — acceptable?
3. **Coexisting states** never offered as the alternative: sepsis, AKI, hyperkalaemia,
   hypercalcaemia, hyponatraemia, hypoglycaemia (web ids; iOS by name).
4. **Can't-miss list (web)** that alone permits CT / MRI / endoscopy as the next discriminator (50
   PANE diseases in `CANT_MISS_DISEASE_IDS`); iOS uses the database urgency ≥ 2.
5. **Cost tiers and weights**: ask / bedside 1.0, lab 0.85, imaging 0.6, advanced 0.35; the term
   lists that classify a test (e.g. ECG, urine dipstick, pregnancy test, capillary glucose and
   ketones as bedside); minimum gain 0.01 nats.
6. **iOS background rate**: P(finding | diagnosis) = min(0.95, 0.05 × LR) for the information gain
   and the post-test probabilities (the database stores LRs, not sensitivities); 5 % matches the
   web's default background rate.
7. **Time-out triggers**: ≥ 3 unexplained specific findings (web: symptoms, signs and results with a
   background rate ≤ 5 %; iOS: non-history findings) or a repeat visit for the same complaint with no
   diagnosis or changing diagnoses; the six checklist questions.
8. **Zebra rule set** (16 rules): each rule's term groups, exclusions and citation — EoE; lead;
   primary hyperparathyroidism (hypercalcaemia + 2 of stones / bones / groans / moans); Conn's
   (hypertension + hypokalaemia, including on a diuretic); phaeochromocytoma (3 of headache, sweating,
   palpitations, hypertension); hypertriglyceridaemia / autoimmune pancreatitis / IPMN (recurrent
   pancreatitis with no affirmed gallstones or alcohol excess); aorto-enteric fistula; herb- or
   supplement-induced liver injury; acute intermittent porphyria; Addison's; hereditary angioedema
   (no urticaria); carcinoid; Zollinger-Ellison; Budd-Chiari.
9. **Lab-derived terms**: Hb < 11 g/dL (g/L above 25), adjusted calcium > 2.6 mmol/L (mg/dL above 5),
   K < 3.5 / ≥ 6.0, Na < 130, eosinophils > 0.5 × 10⁹/L (cells/µL above 30), ALT/AST > 40 U/L,
   bilirubin > 21 µmol/L (mg/dL below 5), triglycerides ≥ 11.3 mmol/L (mg/dL above 50).
10. **Longitudinal thresholds**: 3+ visits for a recurring presentation; creatinine rise ≥ 26.5 µmol/L
    or ≥ 1.5 × the lowest earlier value (KDIGO 2012); Hb fall ≥ 20 g/L from the highest earlier value;
    weight loss ≥ 5 % from the highest weight in the previous 183 days (NICE NG12 / MUST); an earlier
    diagnosis is "revised" when a later one for the same problem shares no meaningful word.
11. **"Add to differential" on iOS** appends "Differential (considered): X" to the assessment text
    (iOS has no separate differential field); **"Add test to plan" on the web** appends a "Consider …"
    line to the plan text rather than ordering.
12. **PANE module sources** shown as the evidence source for web LRs are the module-header guidelines
    (`PANE_MODULE_SOURCES`); PANE has no per-feature citation.

## Not done / follow-ups

- Swift was not compiled here; the iOS card, adapter, engine evidence record, vectors test and
  harness changes need the next iOS CI run (grep-checked for duplicate types; argument labels in
  declaration order; no `Color.opacity` on `Color` passed to `.background`/`.foregroundStyle`).
- iOS reasoning expectations are `unverified: ["ios"]` until an `ios-latest.jsonl` with
  `outputs.reasoning` exists.
- The web longitudinal view reads earlier encounters and imported lab results; weight only from this
  encounter's vital records (the dashboard has no patient-wide vitals query yet).
- The premature-closure guard compares the working diagnosis with the current posterior; it does not
  yet store an earlier posterior to show "less likely than at confirmation".

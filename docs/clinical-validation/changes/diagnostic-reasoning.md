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

## Precision pass (branch `reasoning-precision`, 2026-09-26)

The first version raised "Doesn't fit the working diagnosis" in 77 and a diagnostic time-out in 103
of the 397 original vignettes, whose confirmed diagnoses are correct: alert fatigue. Most of it came
from false features in the PANE feature mapper and from PANE modelling one condition at more than
one granularity. **No PANE disease, prior or likelihood, no shared-core threshold, no
DiagnosticDatabase entry and no iOS file was changed.**

### What changed

**1. Feature mapper** (`socrates-to-features.ts`, `transcript-dx-mapper.ts`; new
`record-text-match.ts`; PANE model 1.0.0 → 1.0.1). Every regex / keyword rule now goes through
`record-text-match.ts`, which runs the shared negation matcher (`negation.ts`, unchanged, iOS twin)
and then:

- **Negated lists**: each item of "no A, B or C" gets its own 5-word window, so "has never had
  abdominal pain, indigestion after food, jaundice or fever" records none of them (negation.ts
  counted all 6 words before "fever"). After "denies" / "never" a list may also end with "and". A
  bare "no A, B" without "or" keeps negation.ts's safety bias ("No vomiting, rigid abdomen" keeps
  rigid).
- **Family history**: "mother had …", "father died of …", "family history of …", "FH" are never
  the patient; a relative who reports ("Mother says he has vomited") is not family history.
- **Findings that mean "now"** (PANE symptoms and signs, and the injury mechanism) are not read
  from a sentence dated years back without an "ongoing" word ("Splenectomy 6 years ago … after a
  motorbike accident"), from a condition already repaired or awaiting / planned for repair ("after
  an umbilical hernia repair", "awaiting elective repair of a femoral hernia", "plan surgery for a
  large incisional hernia"; "referred for repair of …" still counts), or from a lay guess ("Mother
  thought it was a hernia"). History features (previous surgery, a known stone) still are.
- A `[^.]{0,N}` gap in a rule cannot cross a negation cue ("DRE: no mass" is no rectal mass), and
  rule context (`requires`) must be affirmed ("No wound" is no wound context).
- Pattern fixes at the source: "flame haemorrhages" (fundoscopy) → burn; "restless, disorientated"
  → writhing with pain; rheumatoid arthritis → joint pain; "after abscess drainage" → fluctuant
  swelling; "during micturition / defaecation" (syncope) → pain on defaecation; "pale stools" →
  pallor; "calf pain" on walking → calf tenderness; "weak pulse-oximetry trace" → absent pulses;
  a fistula "cord towards the anal canal" → thrombophlebitis; flatus incontinence → urinary
  incontinence; faecal urgency → urinary urgency (a bare "urgency" / "frequency" now needs a
  urinary word in the sentence); "rash on both legs" → bilateral leg symptoms; breast site
  "Central / areola" → periumbilical pain; "Diffuse neck" → diffuse abdominal pain; "right iliac
  fossa scar" → RIF pain; "distended neck veins" → abdominal distension; "not passed urine" →
  oliguria (was urinary retention); "neuropathic pain" → loss of protective sensation. One false
  negative fixed: an adrenal mass in an imaging report was not read.
- The ambient transcript mapper and the pathognomonic-sign check use the same rules.
- The hernia in the acute heart-failure vignette is real ("Large incisional hernia, soft" on
  examination), so it is still recorded (only the "plan surgery for …" mention no longer counts)
  and still adds to that vignette's time-out; hiding a real finding is not the mapper's job.
- Tests: `artifacts/dashboard/src/lib/__tests__/pane-mapper-false-positives.test.ts` (one per
  false positive, each with the affirmed form).

**2. Reasoning layer, web adapter** (`diagnostic-reasoning.ts`, new `diagnosis-families.ts`;
registered as the new web-only rule set `diagnostic-reasoning-web` 1.1.0; the shared core stays
1.0.0 because its version and thresholds are pinned to the iOS twin by the parity test):

- **Diagnosis families** (derived from PANE ids, labels and ICD-10 codes; no vignette text): same
  ICD-10 category **and** a shared label head noun (appendicitis / appendix mass, peptic ulcer /
  perforated peptic ulcer, bowel obstruction / adhesional obstruction, upper / lower GI
  haemorrhage, the thyroid carcinomas; not achalasia / Boerhaave in K22, not AAA / dissection in
  I71); injuries of one body region (S2x thorax, S3x abdomen: blunt abdominal trauma / splenic
  laceration, rib fractures / traumatic pneumothorax); a complication or grade modifier
  (incarcerated, strangulated, perforated, gangrene, necrotising, infected, obstructed, toxic,
  major, minor, late, early) with a shared head noun in the same ICD-10 chapter (incarcerated
  hernia and every "… Hernia"; major / minor burn), or naming the other in its parenthesis (toxic
  megacolon "(Acute Severe Colitis)" and ulcerative / C. difficile colitis; Fournier's gangrene
  "(Perineal Necrotising Fasciitis)" and necrotising fasciitis). A family member is never the
  leader of "the record favours X", and a finding that favours one does not alert. The NEWS2 alert
  is unchanged.
- **Working diagnosis by label** when its ICD-10 code is unspecific: the node whose label matches
  the diagnosis text (words found − words missing; acute / chronic contradict) is used when it
  beats the ICD-10 match by 2 — K92.2 "acute lower GI bleed" → lower GI haemorrhage, not upper;
  E11.1 "euglycaemic DKA" → DKA, not HHS; K60.3 fistula-in-ano → perianal abscess / fistula, not
  anal fissure; "cyclical mastalgia" → fibrocystic change, not fat necrosis. A one-word label
  match needs an ICD-10 match to overrule; without one it needs two words.
- **Two conditions**: "the record favours X" needs X to compete for the working diagnosis's
  evidence — a present finding with LR ≥ 1.5 for both — whenever the working diagnosis has support
  of its own (a finding with LR ≥ 2). New AF with a reducible inguinal hernia on examination, an
  adrenal incidentaloma with an incidental ureteric stone, a pre-operative colorectal cancer in a
  patient with heart-failure symptoms, an umbilical hernia with cirrhotic ascites: two conditions,
  no alert (the other diagnosis stays in the differential and in "doesn't fit"). This implements
  the core's stated intent ("a finding that merely belongs to a second condition does not alert on
  its own"). All 4 premature-closure vignettes share evidence (epigastric pain, nausea, onset) and
  still alert.
- **Already named**: no "the record favours X" when the working diagnosis text names X ("Blunt
  abdominal trauma in pregnancy — suspected placental abruption"; "… — suspected
  phaeochromocytoma"; "biliary pancreatitis with acute cholangitis"; "sigmoid volvulus" confirmed
  as bowel obstruction).
- **Contradicting finding** alerts on the web only at LR ≤ 0.2 (moderate or strong evidence
  against; Jaeschke, Guyatt & Sackett, JAMA 1994), not at the core's 0.33: a single
  documented-absent cardinal finding at LR 0.26–0.32 ("no jaundice" in choledocholithiasis, "no
  guarding" in a stable stab wound, "no surrounding erythema" in an uninfected diabetic ulcer) no
  longer alerts.
- **Time-out**: a finding that a coexisting state explains (sepsis, AKI, hyperkalaemia,
  hypercalcaemia, hyponatraemia, hypoglycaemia; LR ≥ 1.5) is not "unexplained" — raised
  creatinine, lactate and rigors in septic peritonitis.
- Tests: `artifacts/dashboard/src/lib/__tests__/diagnostic-reasoning-web-rules.test.ts`.

### Before / after (clinval `web.reasoning`, 397 original vignettes with correct confirmed diagnoses)

| Step | "Doesn't fit" alerts | Time-out suggested |
|---|---|---|
| Base (`claude/pr-37-gbg22z` at `6e95863`) | 77 (19.4 %) | 103 (25.9 %) |
| Mapper: negated lists, family history, not-current, first pattern fixes | 72 (18.1 %) | 87 (21.9 %) |
| + families, label-matched working node, two conditions, coexisting states | 40 (10.1 %) | 51 (12.8 %) |
| + web contradiction LR ≤ 0.2, already named, adrenal mass from imaging | 30 (7.6 %) | 51 (12.8 %) |
| + remaining mapper fixes (neck veins, "not passed urine", neuropathic pain): **final** | **30 (7.6 %)** | **49 (12.3 %)** |

No vignette gained an alert or a time-out. Four alert texts changed because the working node is
now the one the diagnosis names (lower GI haemorrhage instead of upper; rectal carcinoma instead
of rectal prolapse).

The 12 reasoning vignettes are unchanged: the 4 premature-closure vignettes (biliary colic with
lipase 1850, gastritis with troponin 480, gastroenteritis with ketones / bicarbonate, renal colic
with NEWS2 0 → 9) still alert with the same text and all their expectations pass; the 8 zebra /
next-test vignettes raise no alert, as before.

`clinval:web` (409 vignettes, 3101 expectations): 2933 pass, 76 fail (all quality; 74 known gaps),
92 n/a, **0 critical fails, 0 blocking — identical to the base; no expectation changed status** in
either direction (no pass → fail; no fail → pass, so no `web` knownGap flag became removable).
Results files were restored, not committed.

The remaining 30: 28 "the record favours X" (one vignette also "no LIF pain", LR 0.15) and 2 NEWS2
rising (3 → 7, 2 → 5: real deterioration). Many are the alert doing its job on a mimic the
vignette was written for (AAA vs renal colic, pseudoachalasia, early Fournier's in a perianal
abscess, anal cancer in an atypical fissure, colorectal cancer in iron-deficiency anaemia,
necrotising fasciitis in wet gangrene, appendicitis in a strangulated adhesional obstruction).
Others come from a vignette's `paneDiseaseId` naming a sibling node rather than the diagnosis
(variceal bleeds mapped to "Upper GI Haemorrhage (… Non-variceal)", a diverticular haemorrhage
mapped to diverticulitis, post-polypectomy bleeding resolved to anastomotic leak) and from cause /
complication pairs that PANE's registry does not link (colorectal cancer and large-bowel
obstruction, perforated diverticulitis and "perforated viscus", choledocholithiasis and
cholangitis, peptic ulcer and gastritis in H. pylori).

### Needs sign-off (additions to the list above)

13. **Mapper clause rules** (`record-text-match.ts`): per-item negation windows in "no A, B or C"
    lists and "denies / never … and" lists; family-history markers; "not current" = a sentence
    dated years back without an ongoing word, a repaired or awaiting / planned repair, a lay guess
    — applied to PANE symptoms and signs and the injury mechanism.
14. **Mapper pattern changes** listed above (each narrows a pattern; "not passed urine" now means
    oliguria, not retention).
15. **Diagnosis families**: the three derivation rules and the modifier list.
16. **Two-conditions rule** (shared evidence LR ≥ 1.5 in both; the working diagnosis's own support
    LR ≥ 2) and the **already-named** rule.
17. **Web contradiction threshold LR ≤ 0.2** (core and iOS: 0.33).
18. **Working-diagnosis label matching** (margin 2; one word with an ICD-10 match, else two).
19. **Time-out**: coexisting states count as explaining a finding.
20. Remaining rates: alerts 30 / 397 (7.6 %), time-outs 49 / 397 (12.3 %). Acceptable?

### Not done / follow-ups (precision pass)

- **iOS**: none of the web adapter rules (families, two conditions, already named, LR ≤ 0.2,
  label matching, coexisting-state time-out) is ported to `DiagnosticReasoningAdapter.swift`; iOS
  still uses the core rules. The shared core, its vectors and `negation.ts` are unchanged.
- Vignette `paneDiseaseId` values that name a sibling node (the variceal bleeds, the diverticular
  haemorrhage, the adrenal "suspected phaeochromocytoma" → incidentaloma) were left as they are;
  changing them would only hide alerts.
- The mapper still records only present findings: a documented negative test ("pregnancy test
  negative") does not lower a diagnosis (e.g. ectopic pregnancy in the ruptured corpus luteum
  cyst vignette).

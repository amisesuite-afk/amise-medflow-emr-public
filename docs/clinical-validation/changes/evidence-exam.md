# Change log — `evidence-exam` (evidence-based examination signs and decision rules as Bayesian evidence, web and iOS)

2026-09-26. Branch `evidence-exam` (from `claude/pr-37-gbg22z`). New rule sets `exam-signs` 1.0.0 and
`decision-rules` 1.0.0; `pane-engine-disease-model` 1.0.1 → 1.1.0; `ios-bayesian-diagnostic-database`
2.1.0 → 2.2.0 (`clinical-content/registry.json`). Status **needs sign-off**. Owner request: "Use the latest
standard of semiology and physical diagnosis, with additional best diagnostic tools to increase accuracy
using algorithms, and weave the Bayesian engine into it."

Reference standard: McGee S, *Evidence-Based Physical Diagnosis* (5th ed., Elsevier 2022) and the JAMA
*Rational Clinical Examination* series, with each decision rule's own derivation / validation study or
meta-analysis.

**Every likelihood ratio, range, band and risk in this change was written from memory** (`fromMemory: true`
on every sign and rule) and has not been checked against the source. They are all listed under
[Needs sign-off](#needs-sign-off). No `lastReviewed` date was set.

Everything is **deterministic** (no AI, no network). **Nothing is pre-filled as normal:** an unmarked sign
was not examined and never counts as absent. The chips and calculators record only what the clinician
marks; the differential moves only from recorded evidence. No score formula was changed.

## What the clinician sees

**Web — Examination step** (`ExamSignsPanel`, above the hidden-systems summary):

- "High-yield signs" for the complaint and the current PANE differential, ranked by how much each sign
  would separate the top five diagnoses (expected information gain), those for the leading diagnoses first.
- Each sign has three states: **Present / Absent / Not examined** (default). Tapping the name shows how to
  elicit it, LR+ and LR− with their ranges, the target diagnosis, whether absence is used, the source,
  quality and "value not yet verified against the source".
- The relevant decision rules are chips; a tap opens the existing calculator (Scales step component) in a
  modal, pre-filled from the record ("from record"). "Use in decision support" records the result.
- A recorded sign is written into the examination record as `Murphy's sign: present` /
  `No Murphy's sign (examined)` (the `signs` key of the examination findings) and PANE is re-seeded.

**Web — Assessment step, Diagnostic reasoning panel:** each recorded sign or rule in the for / against
lists shows its LR and how far it moved that diagnosis, e.g. `Murphy's sign (LR 2.8) · 22% → 41%`
(leave-one-out replay through PANE). A new "Examination evidence" list shows every recorded sign and rule
with its effect: applied with its LR, recorded as a red-flag finding, documentation only, or not applied
(and why: superseded by AIR, PERC not valid with Wells PE above 4, LRINEC low band not used, prognostic).

**iOS — Exam step** (`ExamSignsSection`, under Physical Examination): the same ranked signs with a
Present / Absent / Not examined segmented control; the name expands to how to elicit, LRs, source and the
"not verified" note. Choices are written as `[sign] Murphy's sign: present.` lines in "Other / additional
findings" (so they sync, back up and print with the examination). Decision rules with an iOS calculator
open `ClinicalScoresView` at that score (pre-filled by the existing populators); the stored result and its
band and LR are shown. Rules without an iOS calculator say so.

**iOS — Diagnosis step, Diagnostic reasoning card:** sign and rule findings show
`(LR 2.8) · 22% → 41%` in the for / against lines.

### The Exam step follows the history frame

The history step classifies each chief complaint into a symptom type and history frame
(`lib/triage-engine/src/history-frames` `classifyComplaint`, iOS twin `HistoryFrameClassifier`,
including the clinician's frame switch). The Exam step reuses that classification instead of a
second one: `exam-signs.json` `frames` maps every frame to

- the **iOS examination region** (`ExamRegion.swift`): its label, one-tap chips and the record field
  they belong to — a cough or breathlessness puts chest chips in Respiratory, chest pain,
  palpitations and collapse cardiac chips in Cardiovascular, a neurological complaint neurological
  chips in Neurological, a limb or the back in Musculoskeletal, skin, wounds and soft-tissue lumps
  in Skin / Wound (these three fields then show in the short examination too). Groin, perianal,
  urological, scrotal, neck, breast and swallowing regions keep the primary field as before. An
  unrecognised complaint gets the general examination; **nothing defaults to the abdomen** any
  more (before, every complaint the keyword list did not know — including cough — showed
  abdominal chips in the primary field);
- the **web examination systems** shown besides the core ones (`ExaminationTab`, `lib/exam-frames.ts`);
- the **presentation tags** whose high-yield signs and decision rules are offered.

Presentation keywords still add a tag when the complaint names a site, mechanism or condition the
frame does not distinguish (right upper quadrant, an ankle or head injury, a sore throat).
`scripts/src/exam-evidence-content.test.ts` fails when a history frame has no entry or a region has
no iOS definition.

## How the evidence enters the engines

### Web (PANE)

- Every sign with its own likelihood ratios (engine mode `lr`, 48 signs) is a PANE feature
  `sign_<id>`; every diagnostic rule band is `rule_<rule>_<band>`. Registered from the catalogue
  (`lib/pane-engine/src/evidence/register.ts`); the likelihoods are looked up in a registry
  (`engine/evidenceLikelihood.ts`) after the disease's own value, so no disease node was edited for them.
- Sensitivity and specificity come from the LRs: spec = (LR+ − 1)/(LR+ − LR−), sens = LR+ × (1 − spec).
  Target diseases get P(sign | D) = sens; every other disease gets 1 − spec. A secondary target group
  (`alsoTargets`) gets sens = LR+ × (1 − spec), capped at 0.95.
- A finding-level sign (e.g. shifting dullness → ascites) marginalises over its finding:
  P(sign | D) = sens·P(F | D) + (1 − spec)(1 − P(F | D)).
- A rule band b has base rate min(0.3, 0.9 / LR) and, for the rule's target, min(0.99, LR·b).
- Evidence features are never asked (`askable: false`: not in next-best-question or discriminators).
- `updatePosterior` applies an evidence feature once (a repeated identical answer is skipped).
- Twin mode (9 red-flag / severity signs): "present" sets the engine's existing features (e.g. neck
  stiffness → `neck_stiffness`), so the safety-tuned weighting is unchanged; absence is never used.
- Documentation-only mode (10 low-value signs, e.g. Homans', Kernig's, Brudzinski's, obturator,
  pleural rub, adult capillary refill): recorded and shown, never applied.
- An **absent** sign updates the engine only when `negativeMeaningful` is true and the chip was set to
  Absent.
- A recorded chip supersedes its free-text twin features (e.g. `murphys_sign` from the typed exam), so a
  sign counts once. A finding-level sign is skipped when its finding is already in the record.

### Rule / component policy ("a recorded rule supersedes its components")

A decision rule already contains some of the examination signs and history findings (AIR contains rebound
and guarding; Alvarado contains McBurney tenderness and rebound; Wells DVT contains calf swelling; TG18
contains Murphy's sign). Counting both would double-count. Policy (`engine/evidenceGroups.ts`,
order-independent; iOS `DecisionRuleEvidence` + the scorer):

1. While a rule band is recorded, the rule's **component signs are neutral** for the rule's target
   diagnoses (they still count for other diagnoses).
2. A **positive band** (LR > 1) is combined with the rule's component findings as
   max(P_components, LR_band): it adds only what the recorded findings have not already given.
3. A band below 1 is applied in full (the rule's negative band is the evidence that the components are
   absent), but only when the rule's absence is meaningful.
4. Between rules: **AIR supersedes Alvarado** when both are recorded; **PERC applies only when Wells PE is 4
   or less**; **LRINEC's low band is never applied** (its sensitivity is too low to rule out: Fernando
   2019); prognostic rules (CURB-65, Glasgow-Blatchford, qSOFA, NEWS2, TG18 cholangitis severity,
   syncope rules, Caprini, RCRI) are **display only** and never change the differential.
5. A rule counts only when the clinician recorded it ("Use in decision support" on web, the stored
   calculator result on iOS). Values derived automatically from vitals are not used.

### iOS (DiagnosticDatabase.json 2.2.0)

- Generated from the same catalogues by `scripts/src/gen-exam-evidence-db.ts`
  (`scripts/src/exam-evidence-db.test.ts` fails if the committed database differs from its output):
  699 `sign` features (`value "<id>:present|absent"`) and 104 `rule` features (`value "<rule>:<band>"`),
  each with `logLR = round(5 × ln LR)`, `likelihoodRatio` and `citation`. Candidates are matched by the
  target group's iOS name fragments at word starts ("thyroid carcinoma" does not match "parathyroid
  carcinoma"); LR = 1 features are omitted.
- New curated candidate **Abdominal Wall Pain (Anterior Cutaneous Nerve Entrapment)** (G58.8) in
  `coreConditions` and the abdominal-pain presentation, the target of Carnett's sign.
- The scorer reads the chips (`ExamSignRecord.states`) and scores the free text without the chip lines of
  `lr` signs (red-flag lines stay in the text, which is how the engine weighs them). The stored rule
  results for Alvarado, AIR, Wells PE, PERC, Wells DVT, HEART, Centor/McIsaac and LRINEC become `rule`
  features; with the 2.2.0 database these **replace** the earlier fixed score adjustments for the same
  rules (`legacyRules`); with an older database or no catalogue the old adjustments still run.
- The Diagnosis step now passes those eight stored scores to `BayesianDiagnosisEngine.infer` (it did not
  before, so the old adjustments never ran from the consultation view).

## Files

| Area | Files |
|---|---|
| Content | Shared rule files `clinical-content/rules/{exam-signs,decision-rules}.json` with schemas `clinical-content/schemas/{exam-signs,decision-rules}.schema.json`, read by both platforms (web imports the JSON; iOS through `SharedClinicalContent`, `File.examSigns` / `.decisionRules`, shown in Settings → Diagnostics); registered in `SHARED_CONTENT` (`scripts/src/shared-content.ts`), checked by `lint:shared-content` |
| PANE | `lib/pane-engine/src/evidence/{types,catalogue,register,features,relevance,index}.ts`, `engine/{evidenceLikelihood,evidenceGroups}.ts`; edits in `engine/{likelihood,bayes,infoGain}.ts`, `types.ts` (`askable`), `vademecum/index.ts`; new nodes `cirrhosis` (hepatobiliary), `abdominal_wall_pain` (general surgery); `constants.ts` `PANE_MODEL_VERSION = '1.1.0'` |
| Web | `artifacts/dashboard/src/lib/{exam-evidence-features,exam-frames,decision-rule-scores,pane-reseed}.ts`, `socrates-to-features.ts` (evidence context), `diagnostic-reasoning.ts` (evidence moves); components `ExamSignsPanel.tsx`, `DecisionRuleCard.tsx`, `RecordScoreButton.tsx` (re-seed), `ScalesTab.tsx` (new rule cards), `ExaminationTab.tsx`, `DiagnosticReasoningPanel.tsx` |
| iOS | `Services/{ExamEvidenceCatalogue,ExamSignRecord,ExamRegion,DecisionRuleEvidence,DiagnosticReasoningAdapter+Evidence}.swift`, `Views/Consultation/ExamSignsSection.swift`; edits in `BayesianDiagnosisEngine.swift`, `+Scoring.swift`, `BayesianDecisionEngine+Scoring.swift`, `ConsultationView+{DiagnosisTab,ExamTab,HPITab}.swift` (the keyword region chain replaced by `ExamRegion`), `DiagnosticReasoningCard.swift`; `Resources/DiagnosticDatabase.json` 2.2.0 |
| Generator | `scripts/src/gen-exam-evidence-db.ts`, `scripts/src/diagnostic-database-schema.ts` (`sign`, `rule` keys) |
| Tests | `lib/pane-engine/src/__tests__/evidence.test.ts`, `artifacts/dashboard/src/lib/__tests__/{exam-evidence-features,decision-rule-scores}.test.ts`, `scripts/src/{exam-evidence-content,exam-evidence-db}.test.ts`, `ios/AmiseMedFlowTests/ExamEvidenceTests.swift` (not compiled here) |
| Validation | 13 vignettes `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/exam-*.json` (`inputs.examSigns`, `inputs.scoreForms`); web runner and iOS runner read `examSigns` |

New web calculators (Scales step, from each rule's published criteria; formulas are the published ones):
AIR, PERC, Ottawa ankle, Ottawa knee, Canadian CT head, NEXUS, Canadian C-spine, Centor/McIsaac, STONE,
LRINEC, San Francisco syncope rule, Canadian syncope risk score. Existing calculators (Alvarado, Wells PE,
Wells DVT, HEART, CURB-65, Glasgow-Blatchford, TG18, qSOFA, NEWS2, Caprini, RCRI) are unchanged; HEART now
records under the key `heart`.

## Checks

| Check | Result |
|---|---|
| Web clinval, 433 existing vignettes | 3149 expectations: 2981 pass, 76 fail before and after; **0 pass → fail, 0 blocking**; no known-gap flag resolved, so none removed |
| Web clinval, all 446 vignettes | 3175 expectations: 3007 pass, 76 fail, 0 blocking |
| New `exam-*` vignettes (web) | 26 / 26 pass with the recorded signs / rules; **11 / 26 without them** (same vignettes, `examSigns` and `scoreForms` removed) |
| iOS simulator (TypeScript port of the scorer, 2.1.0 → 2.2.0 database) | only the `exam-*` vignettes' lists change; every existing iOS expectation keeps its status; the 10 new iOS differential expectations pass (flagged `unverified: ['ios']` until the Xcode run) |

Web differential, the same vignette without → with the recorded evidence (top three, PANE):

| Vignette | Recorded | Without | With |
|---|---|---|---|
| exam-carnett-abdominal-wall-pain | Carnett's present, rebound absent | GORD 8 %, biliary colic 6 %, gastritis 5 % (abdominal-wall pain not in top 3) | **Abdominal-wall pain 18 %**, GORD 7 %, biliary colic 5 % |
| exam-cld-stigmata-jaundice | spider naevi, palmar erythema, fluid wave | Cirrhosis 29 %, cholangiocarcinoma 20 %, acute hepatitis 14 % | **Cirrhosis 95 %** |
| exam-hernia-femoral-below-tubercle | below / lateral to the tubercle, not above / medial | Femoral hernia 24 %, inguinal nodes 8 % | **Femoral hernia 72 %** |
| exam-hernia-inguinal-cough-impulse | cough impulse, reducible, above / medial | Inguinal hernia 95 % | 100 % |
| exam-murphy-positive-cholecystitis | Murphy's present, rebound absent | Cholecystitis 96 % | 98 % |
| exam-murphy-negative-elderly-cholecystitis | Murphy's absent | Cholecystitis 70 %, cholangitis 26 % | Cholecystitis 54 %, cholangitis 40 % (still first: an absent Murphy's sign does not exclude it in the elderly) |
| exam-paeds-dehydration-crt | prolonged CRT, reduced turgor (child) | Intussusception 65 %, sepsis 17 %, malrotation 7 % | Intussusception 77 %, sepsis 9 %, **gastroenteritis 8 %** (top 3) |
| exam-perc-negative-low-wells | Wells PE 1.5, PERC 0 | Pneumonia 38 %, **PE 28 %** | Pneumonia 51 %, ACS 10 % (PE out of top 3) |
| exam-supraclavicular-node-gastric | hard, fixed left supraclavicular node | Gastric carcinoma 97 % | 99 % |
| exam-air-high-appendicitis, -stone-score-high-renal-colic, -hernia-irreducible-incarcerated | AIR 10; STONE 11; irreducible, no cough impulse | already 100 % | 100 % (the reasoning panel now shows the rule's LR and move) |
| exam-ottawa-ankle-negative | Ottawa ankle negative | no fracture diagnosis in the PANE model | post-test probability of fracture shown in the reasoning panel |

## Findings (not changed here)

- The iOS "STONE" calculator is a different score (0–6), so the STONE rule is not mapped on iOS.
- The web HEART card defaults History to 1 (not 0), so an untouched card already scores 1.
- `HpiTab` re-applies the context features for each chief-complaint entry.
- PANE ranks intussusception above gastroenteritis in a toddler with vomiting and diarrhoea (the
  dehydration vignette's gastroenteritis expectation is top 3, not top 1).
- iOS has no calculator for Ottawa ankle / knee, Canadian CT head, NEXUS, Canadian C-spine or the syncope
  rules; the Exam step says "Calculator on the web Scales step (not yet on iOS)".
- CLAUDE.md and the `ios-arch` skill still describe `DiagnosticDatabase.json` as 2.1.0.
- iOS: the neck, breast, swallowing, groin, perianal, scrotal and urological regions are still
  recorded in `Patient.examAbdo` (as before this change), which the PDFs and SOAP draft print under
  "Abdomen". The chest, neurological, limb, back, skin, wound and lump regions now use their own
  fields.
- The iOS clinical-validation runner grades the scores of `scoreForms` after the differential and
  does not store them on the patient first, so on iOS the `exam-*` vignettes with a recorded rule
  (PERC, STONE, AIR, Ottawa) do not feed the rule band to the differential in the harness (the app
  does, from the stored calculator result).
- CLAUDE.md's shared-content gotcha lists the shared files as zebra rules, supplement catalogue and
  lifestyle practices; `exam-signs` and `decision-rules` are now shared too.

## Needs sign-off

Every value below is `fromMemory: true`: please check each against its source (McGee 5th ed. chapter or
the cited RCE article / meta-analysis) and correct it in the shared file `clinical-content/rules/*.json` (both platforms read it), then run
`gen-exam-evidence-db.ts` to regenerate the iOS database features.

Policy and new content:

- P1. **Rule supersedes components**: while a decision rule is recorded, its component signs are neutral for its target diagnoses; a positive band adds only what the component findings have not already given (max rule); a band below 1 is applied in full.
- P2. **AIR supersedes Alvarado** when both are recorded.
- P3. **PERC is applied only when Wells PE is 4 or less** (PERC is validated only in low pre-test probability).
- P4. **LRINEC's low band is never applied** (LRINEC cannot rule out necrotising infection); its high band (6 or more) is applied with LR 4.5.
- P5. **Prognostic rules are display only** (CURB-65, Glasgow-Blatchford, TG18 cholangitis severity, qSOFA, NEWS2, San Francisco syncope, Canadian syncope, Caprini, RCRI): they never change the differential.
- P6. **Absence counts only when examined and meaningful**: an Absent chip updates the engine only for signs marked "absence used" below; unmarked signs are "not examined".
- P7. **Red-flag signs keep the engine's own weighting** (twin mode: calf swelling, neck stiffness, focal deficit, papilloedema, mottling, new confusion, rigors, melaena on DRE, reduced anal tone): present sets the existing finding; the LR is shown but not applied; absence is never used.
- P8. **Low-value signs are documentation only** (Homans', Kernig's, Brudzinski's, obturator, pleural rub, adult capillary refill, Pemberton's, lower border of goitre, postural pulse, rectal tenderness).
- P9. **Only clinician-recorded rule results count** ("Use in decision support" on web; the stored calculator result on iOS); values derived from vitals are not used.
- P10. **Secondary targets**: a sign's `alsoTargets` group gets sensitivity LR+ × (1 − specificity), capped at 0.95; rule-band base rate min(0.3, 0.9 / LR) and target probability min(0.99, LR × base rate) (web).
- C1. **New PANE node `cirrhosis`** "Cirrhosis / Chronic Liver Disease (Decompensated)", ICD-10 K74.60, prior tier uncommon, course chronic; P(finding | cirrhosis): known liver disease 0.80, alcohol 0.55, jaundice 0.45, ascites 0.50, abdominal distension 0.50, bilateral leg oedema 0.35, spider naevi 0.45, fatigue 0.55, anorexia 0.40, weight loss 0.25, confusion 0.15, thrombocytopenia 0.60, pruritus 0.20, dark urine 0.30, haematemesis 0.05, melaena 0.05, fever 0.10, progressive course 0.40 (Udell 2012; EASL 2018; Baveno VII).
- C2. **New PANE node `abdominal_wall_pain`** "Abdominal Wall Pain (e.g. Anterior Cutaneous Nerve Entrapment)", ICD-10 G58.8 (other specified mononeuropathy; please choose the code), prior tier uncommon, course chronic; localised pain 0.85, abdominal tenderness 0.95, RIF pain 0.30, RUQ 0.15, LIF 0.15, periumbilical 0.20, epigastric 0.10, worse on movement 0.50, episodic 0.40, previous surgery 0.30, nausea / vomiting 0.05, fever 0.02, raised WCC 0.02, anorexia 0.05 (Takada 2011; Scheltinga and Roumen 2018).
- C3. **New iOS candidate "Abdominal Wall Pain (Anterior Cutaneous Nerve Entrapment)"** (G58.8), logPrior −5 (uncommon), urgency 0, in `coreConditions` and the abdominal-pain presentation; features: abdominal complaint logLR +1 (LR 1.3, expert estimate), pain at one fingertip-sized spot +5 (LR 3), fever −6 (LR 0.3) (no duration feature: the history step's duration chips are record-only on iOS).
- C4. **Target groups** (which diagnoses a sign's LR applies to, web PANE ids and iOS name fragments) as listed in `clinical-content/rules/exam-signs.json` `targetGroups` — e.g. peritonism → appendicitis, perforated ulcer, diverticulitis, anastomotic leak, post-operative collection, toxic megacolon, abdominal trauma; nodal malignancy → gastric, oesophageal, pancreatic, thyroid, breast, melanoma, anal and skin SCC (and lymphoma on iOS).
- C5. **Presentation keywords** (which complaint shows which signs and rules) in `exam-signs.json` `presentations`.
- C6. **History frame → examination** (`exam-signs.json` `frames`): for each of the 41 history frames, the iOS examination region and its chips (`ExamRegion.swift`), the web systems shown and the presentation tags offered (e.g. cough → chest / respiratory, CURB-65 and the pneumonia signs; groin lump → groin / hernia signs; lump elsewhere → local lump chips and lymph nodes; unrecognised complaint → general examination).

Examination signs (S1–S67; "Absence used" = the Absent chip changes the engines):

| Item | Sign (system / region) | Target | LR+ (range) | LR− (range) | Absence used | Engine | Source, quality |
|---|---|---|---|---|---|---|---|
| S1 | Murphy's sign (abdomen / Right upper quadrant) | Acute cholecystitis | 2.8 (0.80–8.6) | 0.50 (0.20–1.0) | yes | own LR | Trowbridge RL et al. Does this patient have acute cholecystitis? JAMA 2003;289:80-86 (Rational Clinical Examination); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Abdominal pain and tenderness; pooled meta-analysis. |
| S2 | McBurney's point tenderness (abdomen / Right iliac fossa) | Acute appendicitis | 3.4 (1.6–7.2) | 0.40 (0.30–0.60) | yes | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Abdominal pain and tenderness (appendicitis); pooled meta-analysis. |
| S3 | Rovsing's sign (abdomen / Right iliac fossa) | Acute appendicitis | 2.3 (1.2–4.2) | 0.80 (0.70–0.90) | no | own LR | Wagner JM et al. Does this patient have appendicitis? JAMA 1996;276:1589-94 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022); pooled meta-analysis. |
| S4 | Psoas sign (abdomen / Right iliac fossa / retrocaecal) | Acute appendicitis | 2.4 (1.2–4.7) | 0.90 (0.80–1.0) | no | own LR | Wagner JM et al. JAMA 1996;276:1589-94 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022); pooled meta-analysis. |
| S5 | Obturator sign (abdomen / Pelvis / right iliac fossa) | Acute appendicitis | — | — | no | documentation only | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Abdominal pain and tenderness; single study. |
| S6 | Rebound tenderness (abdomen / Any quadrant) | Peritonitis (localised or generalised) | 2.0 (1.7–2.4) | 0.40 (0.30–0.60) | yes | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Abdominal pain and tenderness (peritonitis); pooled meta-analysis. |
| S7 | Percussion tenderness (abdomen / Any quadrant) | Peritonitis (localised or generalised) | 2.4 (1.5–3.7) | 0.50 (0.40–0.70) | yes | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Abdominal pain and tenderness (peritonitis); pooled meta-analysis. |
| S8 | Guarding (abdomen / Any quadrant) | Peritonitis (localised or generalised) | 2.2 (1.6–3.1) | 0.60 (0.50–0.80) | yes | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Abdominal pain and tenderness (peritonitis); pooled meta-analysis. |
| S9 | Rigidity (board-like abdomen) (abdomen / Generalised) | Peritonitis (localised or generalised) | 3.7 (2.1–6.4) | 0.70 (0.60–0.90) | no | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Abdominal pain and tenderness (peritonitis); pooled meta-analysis. |
| S10 | Carnett's sign (abdominal-wall tenderness test) (abdomen / Any quadrant) | Abdominal-wall pain (e.g. anterior cutaneous nerve entrapment) | 6.5 (3.2–13) | 0.25 (0.10–0.50) | yes | own LR | Takada T et al. Carnett's sign in chronic abdominal pain, J Gen Intern Med 2011; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022) (positive test argues against peritonitis, LR 0.1); single study. |
| S11 | Shifting dullness (abdomen / Flanks) | Ascites | 2.7 (1.9–3.9) | 0.30 (0.20–0.60) | yes | own LR | Williams JW Jr, Simel DL. Does this patient have ascites? JAMA 1992;267:2645-8 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022); pooled meta-analysis. |
| S12 | Fluid wave (fluid thrill) (abdomen / Flanks) | Ascites | 6.0 (3.3–11) | 0.40 (0.30–0.60) | yes | own LR | Williams JW Jr, Simel DL. JAMA 1992;267:2645-8 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022); pooled meta-analysis. |
| S13 | Palpable non-tender gallbladder in a jaundiced patient (Courvoisier) (abdomen / Right upper quadrant) | Malignant distal biliary obstruction | 26 (4.0–170) | 0.70 (0.50–0.90) | no | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The liver and gallbladder (palpable gallbladder: extrahepatic obstruction in jaundice); single study. |
| S14 | Obstructive (high-pitched, tinkling) bowel sounds (abdomen / Whole abdomen) | Bowel obstruction | 1.8 (1.0–3.3) | 0.80 (0.60–1.0) | no | own LR | Böhner H et al. Simple data from history and physical examination help to exclude bowel obstruction, Eur J Surg 1998; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022) (abnormal bowel sounds: likelihood ratio not significant for peritonitis); single study. |
| S15 | Widened expansile aortic pulsation (abdomen / Epigastrium / umbilicus) | Abdominal aortic aneurysm | 12 (7.4–20) | 0.72 (0.65–0.81) | no | own LR | Lederle FA, Simel DL. Does this patient have abdominal aortic aneurysm? JAMA 1999;281:77-82 (RCE, AAA 4 cm or more); pooled meta-analysis. |
| S16 | Cough impulse (hernia / Groin / abdominal wall) | Uncomplicated abdominal-wall hernia | 4.0 (2.0–8.0) | 0.30 (0.20–0.50) | no | own LR | van den Berg JC et al. Detection of groin hernia with physical examination, ultrasound and MRI compared with laparoscopic findings, Invest Radiol 1999; HerniaSurge Group, Hernia 2018; single study. |
| S17 | Swelling reduces completely (hernia / Groin / abdominal wall) | Uncomplicated abdominal-wall hernia | 5.0 (2.0–12) | 0.20 (0.10–0.50) | no | own LR | WSES guidelines for emergency repair of complicated abdominal wall hernias (Birindelli et al. World J Emerg Surg 2017); HerniaSurge Group, Hernia 2018; expert consensus. |
| S18 | Groin lump above and medial to the pubic tubercle (hernia / Groin) | Inguinal hernia | 3.0 (1.5–6.0) | 0.30 (0.15–0.60) | no | own LR | HerniaSurge Group. International guidelines for groin hernia management, Hernia 2018; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022); expert consensus. |
| S19 | Groin lump below and lateral to the pubic tubercle (hernia / Groin) | Femoral hernia | 8.0 (3.0–20) | 0.40 (0.20–0.70) | no | own LR | HerniaSurge Group, Hernia 2018 (femoral hernia: women, older age, emergency presentation); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022); expert consensus. |
| S20 | Dullness to percussion (chest / Lung bases / zones) | Pneumonia | 3.0 (2.2–4.3) | 0.90 (0.80–1.0) | no | own LR | Metlay JP et al. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Pneumonia; Wong CL et al. Does this patient have a pleural effusion? JAMA 2009;301:309-17 (RCE); pooled meta-analysis. |
| S21 | Crackles (crepitations) (chest / Lung bases / zones) | Pneumonia | 2.0 (1.6–2.7) | 0.80 (0.60–0.90) | no | own LR | Metlay JP et al. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Pneumonia; Wang CS et al. Does this dyspneic patient in the emergency department have congestive heart failure? JAMA 2005;294:1944-56 (RCE); pooled meta-analysis. |
| S22 | Reduced breath sounds (chest / Lung zones) | Pneumonia | 2.3 (2.2–2.5) | 0.80 (0.60–0.80) | no | own LR | Metlay JP et al. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Pneumonia; ATLS 10th ed. (American College of Surgeons 2018) for chest trauma; pooled meta-analysis. |
| S23 | Egophony (chest / Lung zones) | Pneumonia | 4.1 (2.0–8.6) | 0.90 (0.80–1.0) | no | own LR | Metlay JP et al. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Pneumonia; pooled meta-analysis. |
| S24 | Bronchial breath sounds (chest / Lung zones) | Pneumonia | 3.3 (2.0–5.6) | 0.90 (0.80–1.0) | no | own LR | Metlay JP et al. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Pneumonia; pooled meta-analysis. |
| S25 | Pleural rub (chest / Lung zones) | Pneumonia | — | — | no | documentation only | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Pneumonia; Metlay JP et al. JAMA 1997 (not among the discriminating signs); single study. |
| S26 | Raised jugular venous pressure (cardiac / Neck) | Heart failure (raised filling pressure or low ejection fraction) | 5.1 (3.2–7.9) | 0.66 (0.57–0.77) | no | own LR | Wang CS et al. JAMA 2005;294:1944-56 (RCE, heart failure in the dyspnoeic ED patient); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The heart; pooled meta-analysis. |
| S27 | Third heart sound (S3 gallop) (cardiac / Apex) | Heart failure (raised filling pressure or low ejection fraction) | 11 (4.9–25) | 0.88 (0.83–0.94) | no | own LR | Wang CS et al. JAMA 2005;294:1944-56 (RCE, heart failure in the dyspnoeic ED patient); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The heart; pooled meta-analysis. |
| S28 | Displaced apex beat (cardiac / Left chest) | Heart failure (raised filling pressure or low ejection fraction) | 5.0 (2.0–13) | 0.60 (0.50–0.80) | no | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The heart (low ejection fraction); single study. |
| S29 | Hepatojugular (abdominojugular) reflux (cardiac / Neck / abdomen) | Heart failure (raised filling pressure or low ejection fraction) | 6.4 (0.80–51) | 0.79 (0.62–1.0) | no | own LR | Wang CS et al. JAMA 2005;294:1944-56 (RCE, heart failure in the dyspnoeic ED patient); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The heart; pooled meta-analysis. |
| S30 | Calf swelling 3 cm or more (10 cm below the tibial tuberosity) (vascular / Leg) | Deep vein thrombosis | 2.1 (1.5–3.0) | 0.60 (0.50–0.80) | no | red flag → text finding | Anand SS et al. Does this patient have deep vein thrombosis? JAMA 1998;279:1094-9 (RCE); Wells PS et al. NEJM 2003; pooled meta-analysis. |
| S31 | Homans' sign (vascular / Calf) | Deep vein thrombosis | 1.4 (1.0–2.0) | 0.90 (0.80–1.0) | no | documentation only | Anand SS et al. JAMA 1998;279:1094-9 (RCE); pooled meta-analysis. |
| S32 | Absent or reduced foot pulses (vascular / Foot) | Peripheral arterial disease | 4.7 (2.2–9.9) | 0.38 (0.23–0.64) | yes | own LR | Khan NA et al. Does the clinical examination predict lower extremity peripheral arterial disease? JAMA 2006;295:536-46 (RCE); pooled meta-analysis. |
| S33 | Ankle-brachial pressure index below 0.9 (vascular / Ankle) | Peripheral arterial disease | 5.4 (3.5–8.2) | 0.29 (0.20–0.40) | yes | own LR | Xu D et al. Sensitivity and specificity of the ankle-brachial index to diagnose peripheral artery disease, Vasc Med 2010; ESC/ESVS 2017 PAD guidelines; pooled meta-analysis. |
| S34 | Capillary refill longer than 3 seconds (adult) (sepsis / Finger pulp / sternum) | Tissue hypoperfusion / shock | — | — | no | documentation only | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Hypovolaemia; McGee S et al. Is this patient hypovolemic? JAMA 1999;281:1022-9 (RCE); single study. |
| S35 | Hard, fixed or irregular breast lump (breast / Breast) | Breast cancer | 5.0 (2.5–10) | 0.30 (0.20–0.50) | no | own LR | NICE NG12 (2015, updated 2023) suspected cancer; Association of Breast Surgery triple assessment guidance; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The breast; single study. |
| S36 | Skin tethering or dimpling over a breast lump (breast / Breast) | Breast cancer | 8.0 (3.0–20) | 0.80 (0.70–0.95) | no | own LR | NICE NG12 (2015, updated 2023) suspected cancer; Association of Breast Surgery triple assessment guidance; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The breast; expert consensus. |
| S37 | Peau d'orange (breast / Breast skin) | Breast cancer | 15 (5.0–40) | 0.90 (0.80–0.98) | no | own LR | NICE NG12 (2015, updated 2023) suspected cancer; Association of Breast Surgery triple assessment guidance; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The breast; expert consensus. |
| S38 | New nipple retraction (breast / Nipple) | Breast cancer | 4.0 (2.0–8.0) | 0.80 (0.70–0.95) | no | own LR | NICE NG12 (2015, updated 2023) suspected cancer; Association of Breast Surgery triple assessment guidance; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The breast; expert consensus. |
| S39 | Hard or fixed thyroid nodule (thyroid / Neck) | Thyroid cancer | 4.0 (1.5–10) | 0.80 (0.60–0.95) | no | own LR | British Thyroid Association guidelines 2014; ATA 2015 thyroid nodule guidelines; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The thyroid and its disorders; single study. |
| S40 | Cervical lymphadenopathy with a thyroid nodule (thyroid / Neck) | Thyroid cancer | 5.0 (2.0–12) | 0.80 (0.60–0.95) | no | own LR | British Thyroid Association guidelines 2014; ATA 2015 thyroid nodule guidelines; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The thyroid and its disorders; single study. |
| S41 | Pemberton's sign (thyroid / Face / neck) | Retrosternal extension of a goitre | — | — | no | documentation only | British Thyroid Association guidelines 2014; ATA 2015 thyroid nodule guidelines; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The thyroid and its disorders; Pemberton HS, Lancet 1946; expert consensus. |
| S42 | Lower border of the goitre not palpable (thyroid / Neck) | Retrosternal extension of a goitre | — | — | no | documentation only | British Thyroid Association guidelines 2014; ATA 2015 thyroid nodule guidelines; McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The thyroid and its disorders; expert consensus. |
| S43 | Neck stiffness (nuchal rigidity) (neuro / Neck) | Bacterial meningitis | 0.94 (0.60–1.5) | 1.0 (0.80–1.3) | no | red flag → text finding | Thomas KE et al. The diagnostic accuracy of Kernig's sign, Brudzinski's sign, and nuchal rigidity in adults with suspected meningitis, Clin Infect Dis 2002;35:46-52; Attia J et al. Does this adult patient have acute meningitis? JAMA 1999;282:175-81 (RCE); single study. |
| S44 | Kernig's sign (neuro / Legs) | Bacterial meningitis | 1.0 (0.40–2.3) | 1.0 (0.90–1.1) | no | documentation only | Thomas KE et al. The diagnostic accuracy of Kernig's sign, Brudzinski's sign, and nuchal rigidity in adults with suspected meningitis, Clin Infect Dis 2002;35:46-52; Attia J et al. Does this adult patient have acute meningitis? JAMA 1999;282:175-81 (RCE); single study. |
| S45 | Brudzinski's sign (neuro / Neck / legs) | Bacterial meningitis | 1.0 (0.40–2.3) | 1.0 (0.90–1.1) | no | documentation only | Thomas KE et al. The diagnostic accuracy of Kernig's sign, Brudzinski's sign, and nuchal rigidity in adults with suspected meningitis, Clin Infect Dis 2002;35:46-52; Attia J et al. Does this adult patient have acute meningitis? JAMA 1999;282:175-81 (RCE); single study. |
| S46 | New focal deficit: facial droop, arm drift or speech disturbance (neuro / Face / arms / speech) | Stroke | 5.1 (3.1–8.4) | 0.39 (0.25–0.60) | no | red flag → text finding | Kothari RU et al. Cincinnati Prehospital Stroke Scale, Ann Emerg Med 1999;33:373-8; Goldstein LB, Simel DL. Is this patient having a stroke? JAMA 2005;293:2391-402 (RCE); single study. |
| S47 | Papilloedema (neuro / Fundi) | Raised intracranial pressure | — | — | no | red flag → text finding | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), The eye (optic disc); NICE NG228 (2023) headache red flags; single study. |
| S48 | Spider naevi (liver / Face, neck, upper chest, arms) | Cirrhosis | 4.3 (2.4–6.2) | 0.64 (0.51–0.77) | no | own LR | Udell JA et al. Does this patient with liver disease have cirrhosis? JAMA 2012;307:832-42 (RCE); pooled meta-analysis. |
| S49 | Palmar erythema (liver / Hands) | Cirrhosis | 3.7 (2.1–6.5) | 0.64 (0.50–0.80) | no | own LR | Udell JA et al. Does this patient with liver disease have cirrhosis? JAMA 2012;307:832-42 (RCE); pooled meta-analysis. |
| S50 | Caput medusae (liver / Abdominal wall) | Cirrhosis | 9.5 (2.0–40) | 0.80 (0.70–0.95) | no | own LR | Udell JA et al. Does this patient with liver disease have cirrhosis? JAMA 2012;307:832-42 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022); single study. |
| S51 | Prolonged capillary refill (child) (dehydration / Finger pulp) | Dehydration of 5 % or more (child) | 4.1 (1.7–9.8) | 0.57 (0.39–0.82) | yes | own LR | Steiner MJ et al. Is this child dehydrated? JAMA 2004;291:2746-54 (RCE); pooled meta-analysis. Ages –5. |
| S52 | Reduced skin turgor (child) (dehydration / Abdominal skin) | Dehydration of 5 % or more (child) | 2.5 (1.5–4.2) | 0.66 (0.57–0.75) | no | own LR | Steiner MJ et al. Is this child dehydrated? JAMA 2004;291:2746-54 (RCE); pooled meta-analysis. Ages –5. |
| S53 | Abnormal (deep, acidotic) breathing (child) (dehydration / Chest) | Dehydration of 5 % or more (child) | 2.0 (1.5–2.7) | 0.76 (0.62–0.88) | no | own LR | Steiner MJ et al. Is this child dehydrated? JAMA 2004;291:2746-54 (RCE); pooled meta-analysis. Ages –5. |
| S54 | Dry axilla (adult) (dehydration / Axilla) | Hypovolaemia | 2.8 (1.4–5.4) | 0.60 (0.40–1.0) | no | own LR | McGee S et al. Is this patient hypovolemic? JAMA 1999;281:1022-9 (RCE); McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Hypovolaemia; single study. Ages 16–. |
| S55 | Postural pulse rise of 30/min or more (or unable to stand) (dehydration / Pulse, lying then standing) | Large blood loss (hypovolaemia) | 48 (3.0–750) | 0.03 (0.01–0.10) | no | documentation only | McGee S et al. Is this patient hypovolemic? JAMA 1999;281:1022-9 (RCE); single study. |
| S56 | Skin mottling (knees) (sepsis / Knees / thighs) | Tissue hypoperfusion / shock | — | — | no | red flag → text finding | Ait-Oufella H et al. Mottling score predicts survival in septic shock, Intensive Care Med 2011;37:801-7; single study. |
| S57 | New confusion (sepsis / Mental state) | Tissue hypoperfusion / shock | — | — | no | red flag → text finding | Singer M et al. Sepsis-3, JAMA 2016;315:801-10; RCP NEWS2 (2017); pooled meta-analysis. |
| S58 | Shaking chills (rigors) (sepsis / Whole body) | Bacteraemia | 4.7 (3.0–7.2) | 0.60 (0.50–0.80) | no | red flag → text finding | Coburn B et al. Does this adult patient with suspected bacteremia require blood cultures? JAMA 2012;308:502-11 (RCE); pooled meta-analysis. |
| S59 | Palpable rectal mass on digital rectal examination (rectal / Rectum) | Rectal or anal cancer | 10 (4.0–30) | 0.60 (0.40–0.80) | no | own LR | NICE NG12 (2015, updated 2023) suspected cancer: rectal mass; ACPGBI colorectal cancer guidance 2017; single study. |
| S60 | Melaena on the glove (rectal / Rectum) | Upper gastrointestinal source of bleeding | 25 (4.0–174) | 0.80 (0.70–0.90) | no | red flag → text finding | Srygley FD et al. Does this patient have a severe upper gastrointestinal bleed? JAMA 2012;307:1072-9 (RCE); pooled meta-analysis. |
| S61 | Hard, nodular or asymmetric prostate (rectal / Prostate) | Prostate cancer | 5.0 (2.0–10) | 0.60 (0.50–0.80) | no | own LR | Hoogendam A et al. Accuracy of digital rectal examination for prostate cancer, Fam Pract 1999; NICE NG12; pooled meta-analysis. |
| S62 | Reduced anal tone or saddle anaesthesia (rectal / Anus / perineum) | Cauda equina syndrome | — | — | no | red flag → text finding | GIRFT national cauda equina syndrome pathway (2023); NICE CKS back pain; expert consensus. |
| S63 | Right-sided rectal tenderness (rectal / Rectum) | Acute appendicitis | 1.0 (0.70–1.4) | 1.0 (0.80–1.2) | no | documentation only | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Abdominal pain and tenderness (appendicitis); Wagner JM et al. JAMA 1996; pooled meta-analysis. |
| S64 | Lymph node larger than 2 cm (lymph-nodes / Any nodal area) | Malignant (or granulomatous) cause of lymphadenopathy | 3.0 (1.6–8.4) | 0.40 (0.30–0.60) | yes | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Peripheral lymphadenopathy (Vassilakopoulos TP et al., Oncologist 2000; Fijten GH, Blijham GH, J Fam Pract 1988); single study. |
| S65 | Hard lymph node (lymph-nodes / Any nodal area) | Malignant (or granulomatous) cause of lymphadenopathy | 3.2 (2.2–4.8) | 0.60 (0.50–0.80) | no | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Peripheral lymphadenopathy (Vassilakopoulos TP et al., Oncologist 2000; Fijten GH, Blijham GH, J Fam Pract 1988); single study. |
| S66 | Fixed (matted) lymph node (lymph-nodes / Any nodal area) | Malignant (or granulomatous) cause of lymphadenopathy | 11 (2.3–52) | 0.80 (0.70–0.90) | no | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Peripheral lymphadenopathy (Vassilakopoulos TP et al., Oncologist 2000; Fijten GH, Blijham GH, J Fam Pract 1988); single study. |
| S67 | Supraclavicular lymph node (lymph-nodes / Supraclavicular fossa) | Malignancy draining to the supraclavicular fossa (upper GI, breast, thyroid, lymphoma) | 3.2 (2.1–4.8) | 0.80 (0.70–0.90) | no | own LR | McGee S. Evidence-Based Physical Diagnosis, 5th ed. (Elsevier 2022), Peripheral lymphadenopathy (Vassilakopoulos TP et al., Oncologist 2000; Fijten GH, Blijham GH, J Fam Pract 1988); single study. |

Decision rules (R1–R24; "Absence / low band used" = a band below 1 lowers the diagnosis):

| Item | Decision rule (kind) | Target finding | Bands (score range: LR or risk) | Absence / low band used | Policy | Source, quality |
|---|---|---|---|---|---|---|
| R1 | Alvarado score (diagnostic) | Acute appendicitis | 1-4: appendicitis unlikely (0–4): LR 0.20 (0.10–0.40); 5-6: equivocal (5–6): LR 1.0 (0.70–1.5); 7-10: appendicitis likely (7–10): LR 3.3 (2.4–4.4) | yes | superseded by air; groups signs mcburney, rebound; groups findings pain_migration, anorexia, nausea_vomiting, fever, elevated_wbc; iOS calculator | Alvarado A, Ann Emerg Med 1986; Ohle R et al. The Alvarado score for predicting acute appendicitis: a systematic review, BMC Med 2011; McGee, Evidence-Based Physical Diagnosis 5th ed.; pooled meta-analysis. |
| R2 | Appendicitis Inflammatory Response (AIR) score (diagnostic) | Acute appendicitis | 0-4: low probability (0–4): LR 0.20 (0.10–0.35); 5-8: indeterminate (5–8): LR 1.3 (1.0–1.7); 9-12: high probability (9–12): LR 8.0 (4.0–25) | yes | groups signs rebound, guarding; groups findings nausea_vomiting, fever, elevated_wbc, raised_crp; iOS calculator | Andersson M, Andersson RE. The appendicitis inflammatory response score, World J Surg 2008; Kollár D et al. World J Surg 2015; WSES Jerusalem guidelines 2020; pooled meta-analysis. |
| R3 | Wells score for pulmonary embolism (two-level) (diagnostic) | Pulmonary embolism | 4 or less: PE unlikely (≤ 4): LR 0.45 (0.35–0.55); more than 4: PE likely (≥ 4.5): LR 2.5 (2.0–3.2) | yes | groups findings tachycardia, haemoptysis, recent_surgery, recent_immobility, known_malignancy, unilateral_leg_swelling, calf_tenderness; iOS calculator | Wells PS et al. Thromb Haemost 2000; Ceriani E et al. Clinical prediction rules for pulmonary embolism: a systematic review and meta-analysis, J Thromb Haemost 2010; NICE NG158 (2020); pooled meta-analysis. |
| R4 | PERC rule (diagnostic) | Pulmonary embolism | 0 criteria: PERC negative (0): LR 0.17 (0.11–0.25); 1 or more criteria: PERC positive (not ruled out) (1–8): LR 1.2 (1.1–1.3) | yes | only when wells-pe ≤ 4; iOS calculator | Kline JA et al. J Thromb Haemost 2004 and 2008; Singh B et al. Pulmonary embolism rule-out criteria (PERC) in pulmonary embolism, Ann Emerg Med 2012 (meta-analysis); pooled meta-analysis. |
| R5 | Wells score for DVT (two-level) (diagnostic) | Deep vein thrombosis | 1 or less: DVT unlikely (≤ 1): LR 0.31 (0.20–0.45); 2 or more: DVT likely (≥ 2): LR 2.0 (1.6–2.5) | yes | groups signs calf_swelling; groups findings unilateral_leg_swelling, calf_tenderness, recent_surgery, recent_immobility, known_malignancy; iOS calculator | Wells PS et al. Evaluation of D-dimer in the diagnosis of suspected deep-vein thrombosis, NEJM 2003;349:1227-35; NICE NG158 (2020); single study. |
| R6 | HEART score (diagnostic) | Acute coronary syndrome (6-week major adverse cardiac events) | 0-3: low risk (MACE about 2 %) (0–3): LR 0.10 (0.07–0.16); 4-6: moderate risk (MACE 12-17 %) (4–6): LR 1.0 (0.80–1.3); 7-10: high risk (MACE 50-65 %) (7–10): LR 6.9 (4.0–12) | yes | iOS calculator | Six AJ et al. Neth Heart J 2008; Backus BE et al. Int J Cardiol 2013; Fernando SM et al. Acad Emerg Med 2019 (systematic review); pooled meta-analysis. |
| R7 | Ottawa ankle and foot rules (diagnostic) | Ankle or midfoot fracture | No criterion: X-ray not needed (0): LR 0.08 (0.03–0.18); Any criterion: X-ray (1–8): LR 1.5 (1.3–1.8) | yes | no iOS calculator | Stiell IG et al. JAMA 1993; Bachmann LM et al. Accuracy of Ottawa ankle rules to exclude fractures of the ankle and mid-foot: systematic review, BMJ 2003;326:417; pooled meta-analysis. |
| R8 | Ottawa knee rule (diagnostic) | Knee fracture | No criterion: X-ray not needed (0): LR 0.05 (0.02–0.23); Any criterion: X-ray (1–5): LR 1.9 (1.6–2.2) | yes | no iOS calculator | Stiell IG et al. JAMA 1996; Bachmann LM et al. The accuracy of the Ottawa knee rule to rule out knee fractures: a systematic review, Ann Intern Med 2004;140:121-4; pooled meta-analysis. |
| R9 | Canadian CT head rule (minor head injury, GCS 13-15) (diagnostic) | Clinically important brain injury | No criterion: CT not required (0): LR 0.03 (0.01–0.12); Medium-risk criterion only (1): LR 1.5 (1.2–1.9); High-risk criterion (2): LR 3.2 (2.8–3.6) | yes | no iOS calculator | Stiell IG et al. The Canadian CT Head Rule for patients with minor head injury, Lancet 2001;357:1391-6; NICE NG232 (2023) head injury; single study. |
| R10 | NEXUS low-risk criteria (cervical spine) (diagnostic) | Cervical spine injury | All five low-risk criteria met: imaging not required (0): LR 0.03 (0.01–0.10); Any criterion not met: image (1–5): LR 1.1 (1.1–1.2) | yes | no iOS calculator | Hoffman JR et al. Validity of a set of clinical criteria to rule out injury to the cervical spine (NEXUS), NEJM 2000;343:94-9; single study. |
| R11 | Canadian C-spine rule (diagnostic) | Clinically important cervical spine injury | No high-risk factor, a low-risk factor present and able to rotate 45 degrees: imaging not required (0): LR 0.01 (0.00–0.06); Imaging indicated (1): LR 1.8 (1.7–1.9) | yes | no iOS calculator | Stiell IG et al. The Canadian C-spine rule versus the NEXUS low-risk criteria, NEJM 2003;349:2510-8; NICE NG232 (2023); single study. |
| R12 | CURB-65 (prognostic) | 30-day mortality in community-acquired pneumonia | 0-1: low severity (0–1): risk 30-day mortality about 1.5 %; 2: moderate severity (2): risk 30-day mortality about 9 %; 3-5: high severity (3–5): risk 30-day mortality about 22 % | yes | display only; iOS calculator | Lim WS et al. Defining community acquired pneumonia severity on presentation to hospital, Thorax 2003;58:377-82; NICE NG138 / BTS 2009; single study. |
| R13 | Centor / McIsaac score (diagnostic) | Group A streptococcal pharyngitis | 1 or less (≤ 1): LR 0.30 (0.20–0.50); 2 (2): LR 0.70 (0.50–0.90); 3 (3): LR 1.6 (1.3–2.0); 4-5 (≥ 4): LR 2.9 (2.1–4.0) | yes | iOS calculator | McIsaac WJ et al. CMAJ 1998; Aalbers J et al. Predicting streptococcal pharyngitis in adults in primary care: a systematic review, BMC Med 2011; NICE NG84 (FeverPAIN / Centor); pooled meta-analysis. |
| R14 | STONE score (ureteric stone) (diagnostic) | Uncomplicated ureteric stone | 0-5: low probability (about 10 %) (0–5): LR 0.10 (0.06–0.16); 6-9: moderate probability (about 51 %) (6–9): LR 1.0 (0.80–1.2); 10-13: high probability (about 89 %) (10–13): LR 7.8 (5.0–12) | yes | groups findings nausea_vomiting, haematuria, sudden_onset; no iOS calculator | Moore CL et al. Derivation and validation of a clinical prediction rule for uncomplicated ureteral stone: the STONE score, BMJ 2014;348:g2191; single study. |
| R15 | Glasgow-Blatchford score (prognostic) | Need for transfusion, endoscopic therapy or surgery (upper GI bleed) | 0-1: very low risk (0–1): risk Intervention or death under 1 % (outpatient management may be considered); 2-7 (2–7): risk Intermediate risk: inpatient endoscopy; 8 or more (≥ 8): risk High risk: early endoscopy | yes | display only; no iOS calculator | Blatchford O et al. Lancet 2000; Stanley AJ et al. BMJ 2017 (international multicentre study); NICE CG141; ESGE 2021; pooled meta-analysis. |
| R16 | Tokyo Guidelines 2018: acute cholecystitis diagnostic criteria (diagnostic) | Acute cholecystitis | Criteria not met (0): LR 0.09 (0.05–0.15); Definite diagnosis (Grade I-III) (1–3): LR 10 (5.0–30) | yes | groups signs murphy; groups findings us_gallstones, fever, elevated_wbc, raised_crp; no iOS calculator | Yokoe M et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholecystitis, J Hepatobiliary Pancreat Sci 2018;25:41-54; single study. |
| R17 | Tokyo Guidelines 2018: acute cholangitis severity (prognostic) | Severity of acute cholangitis | Grade I (mild) (1): risk Antibiotics; drainage if no response; Grade II (moderate) (2): risk Early biliary drainage; Grade III (severe) (3): risk Organ support and urgent drainage | yes | display only; no iOS calculator | Kiriyama S et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholangitis, J Hepatobiliary Pancreat Sci 2018;25:17-30; expert consensus. |
| R18 | LRINEC score (diagnostic) | Necrotising soft-tissue infection | Below 6 (≤ 5): LR 0.38 (0.30–0.50); 6 or more (≥ 6): LR 4.5 (3.0–6.8) | no | iOS calculator | Wong CH et al. The LRINEC score, Crit Care Med 2004;32:1535-41; Fernando SM et al. Necrotizing soft tissue infection: diagnostic accuracy of physical examination, imaging, and LRINEC score, Ann Surg 2019;269:58-65; pooled meta-analysis. |
| R19 | qSOFA (prognostic) | In-hospital death or prolonged ICU stay in suspected infection | 0-1 (0–1): risk Lower risk; qSOFA is insensitive, so keep screening with NEWS2; 2-3 (2–3): risk In-hospital mortality roughly 3 to 14 times higher: assess for organ dysfunction | yes | display only; no iOS calculator | Seymour CW et al. JAMA 2016;315:762-74; Singer M et al. Sepsis-3, JAMA 2016; NICE NG51; pooled meta-analysis. |
| R20 | NEWS2 (prognostic) | Clinical deterioration (death, ICU admission, cardiac arrest within 24 h) | 0-4 (0–4): risk Low: ward-based response; 5-6 (or a single parameter scoring 3) (5–6): risk Medium: urgent response; 7 or more (≥ 7): risk High: emergency response | yes | display only; no iOS calculator | Royal College of Physicians. National Early Warning Score (NEWS) 2, 2017; pooled meta-analysis. |
| R21 | San Francisco syncope rule (prognostic) | Serious outcome within 7 days of syncope | No criterion (CHESS) (0): LR 0.25 (0.12–0.50); Any criterion (CHESS) (1–5): LR 1.8 (1.4–2.3) | yes | display only; no iOS calculator | Quinn JV et al. Ann Emerg Med 2004; Saccone NS et al. Accuracy of the San Francisco syncope rule: a meta-analysis, Ann Emerg Med 2010; pooled meta-analysis. |
| R22 | Canadian syncope risk score (prognostic) | Serious adverse event within 30 days of syncope | -3 to -2: very low (-3–-2): risk About 0.4 %; -1 to 0: low (-1–0): risk About 0.9 %; 1 to 3: medium (1–3): risk About 8 %; 4 to 5: high (4–5): risk About 20 %; 6 or more: very high (≥ 6): risk About 36 % | yes | display only; no iOS calculator | Thiruganasambandamoorthy V et al. Development of the Canadian Syncope Risk Score, CMAJ 2016;188:E289-98; external validation JAMA Intern Med 2020; single study. |
| R23 | Caprini VTE risk score (prognostic) | Post-operative venous thromboembolism | 0 (0): risk About 0.5 % without prophylaxis; 1-2 (1–2): risk About 1.5 %; 3-4 (3–4): risk About 3 %; 5 or more (≥ 5): risk About 6 % | yes | display only; no iOS calculator | Gould MK et al. Prevention of VTE in nonorthopedic surgical patients, Chest 2012;141(2 Suppl):e227S (ACCP 9th ed.); NICE NG89; single study. |
| R24 | Revised Cardiac Risk Index (RCRI) (prognostic) | Major adverse cardiac events within 30 days of non-cardiac surgery | 0 (0): risk About 3.9 %; 1 (1): risk About 6.0 %; 2 (2): risk About 10.1 %; 3 or more (≥ 3): risk About 15 % | yes | display only; no iOS calculator | Lee TH et al. Circulation 1999;100:1043-9; Duceppe E et al. Canadian Cardiovascular Society guidelines on perioperative cardiac risk, Can J Cardiol 2017;33:17-32; pooled meta-analysis. |

## Not done / follow-ups

- The Swift code has not been compiled here: run the Xcode build, `ExamEvidenceTests`, and the iOS clinical-validation run, then remove `unverified: ['ios']` from the `exam-*` vignettes whose iOS expectations pass.
- iOS calculators for Ottawa ankle / knee, Canadian CT head, NEXUS, Canadian C-spine, STONE and the syncope rules.
- After sign-off: correct any value, bump `exam-signs` / `decision-rules`, regenerate `DiagnosticDatabase.json` and rerun clinval on both platforms.

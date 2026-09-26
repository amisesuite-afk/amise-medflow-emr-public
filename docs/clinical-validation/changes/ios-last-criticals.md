# Change log — `ios-last-criticals` (the last 21 iOS critical failures)

Owner-authorised "fix all gaps found" programme, 2026-09-25. Branch `ios-last-criticals` (from
`claude/pr-37-gbg22z` at `aad528f`). Area: iOS only — the triage level (`ClinicalAcuityEngine*`), the
Bayesian differential engine (`BayesianDiagnosisEngine*`, with the `BayesianDecisionEngine` scoring and
database copies kept in step), `DiagnosticDatabase.json` 2.0.0 → 2.1.0, the schema check that
`lint:guideline-registry` runs, the vignette `knownGap` flags, the registry and this log. Not touched:
web code, `lib/**`, `artifacts/**`.

Everything is **deterministic** (no AI, no network) and **unreviewed**: every likelihood ratio,
threshold, masking rule and citation below needs the surgeon's check before release (list at the end).
The differential stays a suggestion list and the triage card suggests; nothing is ordered or recorded
without the clinician.

## Results

Baseline: `docs/clinical-validation/results/ios-latest.jsonl` (iOS CI run 36182660885, database
mode) — 21 critical failures: 18 differential (`mustRankTopK` 11, `mustNotMiss` 7), 2 triage level,
1 red flag.

Swift cannot be compiled or run here. The differential was measured with the TypeScript port of the
engine used for `fix-ios-differential` (routing translated from the Swift source, scoring, feature
network, chips, applicability, top results), extended with every engine change below. On the
baseline code and database the port reproduces the CI run exactly for 392 of 397 lists and for the
status of all 353 graded iOS differential expectations (the 5 list differences are pregnancy-status
edge cases in ranks 2–5). The triage level and the red flag are not in the port; they were checked by
reading the code paths the runner calls (below) and by new unit tests. The real numbers come from the
next iOS CI run.

| iOS differential expectations (397 vignettes) | Critical fail | Critical pass | Quality fail | Quality pass |
|---|---|---|---|---|
| Before (CI run 36182660885; the port gives the same) | 18 (mustNotMiss 7, mustRankTopK 11) | 227 | 54 | 54 |
| After (simulated) | **0** | 245 | 51 | 57 |

- 21 expectations go from fail to pass: all 18 criticals and 3 quality ones
  (`appendicitis-score-low-band/mnm-gynaecological`, `cholangitis-tg18-charcot-sepsis/dx-cholangitis-top1`,
  `cholecystitis-tg18-grade3-organ-dysfunction/mnm-cholangitis`). **None goes from pass to fail**
  (critical or quality).
- 187 of 397 iOS differential lists change (50 change their first diagnosis), mostly because NEWS2 now
  lifts the critical diagnoses of a shocked patient instead of pneumonia, ACS and sepsis: the source
  (perforation, leak, pancreatitis, NSTI, cholangitis, AAA, mesenteric ischaemia, upper GI bleed)
  now leads where sepsis or pneumonia did. Side effect for review (sign-off 1): in shocked patients
  critical diagnoses with little specific evidence (DKA in a diabetic, AAA in an older man,
  incarcerated hernia) take "do not miss" places 4–5 more often.
- Report evidence (engine change 3) added a diagnosis to 10 lists (acute pancreatitis from a CT,
  hyponatraemia, hyperkalaemia, hypercalcaemia and hypoglycaemia from the result, cholecystitis and
  choledocholithiasis from an ultrasound, a ureteric calculus on a CT, heart failure from a chest
  X-ray).

Triage level and red flag (not simulated; expected on the next CI run):

| Vignette / expectation | Before (CI) | After (by the code path) |
|---|---|---|
| `crc-fit-positive-abdominal-pain` / level-at-least-priority | routine: nothing read the FIT result | priority: the NG12 card (FIT 42 µg Hb/g ≥ 10) is now a triage input (engine change A) |
| `periop-preop-suxamethonium-apnoea` / level-at-least-urgent | routine: "history of suxamethonium apnoea" in the confirmed diagnosis made the whole diagnosis non-acute | urgent: "Acute appendicitis — emergency laparoscopic appendicectomy" still sets the level (B) |
| `obs-abruption-concealed-partner-assault` / flag-domestic-abuse | no red flag: "pushed by her partner" matched none of the iOS phrases | alert and triage red flag "Domestic abuse disclosed in pregnancy" (C) |

Other effects of the triage changes, checked against every vignette's text: the NG12 card raises one
more vignette from routine to priority (`haemorrhoids-grade3-over-50`, rectal bleeding at 56, no level
expectation); the acute-clause rule changes the level of no other vignette (all other diagnoses with a
non-acute word stay non-acute); the partner-violence pattern fires on no other vignette.

Web (`pnpm --filter @workspace/scripts run clinval:web`): unchanged — 397 vignettes, 3,087
expectations, 2,871 pass, 124 fail, 92 n/a, **0 blocking** before and after. Results files were
restored, not committed.

### The 18 differential criticals, before → after

Margin = log units (round(5 × ln)) the target is ahead of the candidate that would push it out
(5 units ≈ a likelihood ratio of 2.7). `knownGap: ["ios"]` was removed where the margin is 5 or more
and kept (with a note) where it is 2–3; CI confirms those.

| Vignette / expectation | Before (iOS CI run 36182660885, top 5) | After (simulated, top 5 with log-posterior) | Margin | `knownGap: ios` |
|---|---|---|---|---|
| `acutemed-acs-atypical-diabetic-woman` / mnm-acs | 1. Acute Kidney Injury · 2. Atrial Fibrillation · 3. COPD Exacerbation · 4. Diabetic Ketoacidosis · 5. Asthma (Acute Exacerbation) | 1. Acute Kidney Injury (13) · 2. Atrial Fibrillation (12) · 3. Acute Coronary Syndrome (10) · 4. COPD Exacerbation (5) · 5. Diabetic Ketoacidosis (5) | 6 | removed |
| `acutemed-pe-high-risk-shock` / dx-pe-top3 | 1. Acute Coronary Syndrome · 2. Sepsis · 3. Acute Heart Failure / Pulmonary Oedema · 4. Community-Acquired Pneumonia · 5. Pulmonary Embolism | 1. Pulmonary Embolism (28) · 2. Acute Coronary Syndrome (21) · 3. Sepsis (20) · 4. Symptomatic / Ruptured Abdominal Aortic Aneurysm (20) · 5. Atrial Fibrillation (17) | 8 | removed |
| `aortoenteric-fistula-herald-bleed` / mnm-aortoenteric-fistula | 1. Upper GI Bleeding (Peptic Ulcer) · 2. Acute Appendicitis · 3. Acute Pancreatitis · 4. Small Bowel Obstruction · 5. Acute Kidney Injury | 1. Upper GI Bleeding (Peptic Ulcer) (19) · 2. Acute Appendicitis (12) · 3. Aorto-Enteric Fistula (10) · 4. Acute Pancreatitis (6) · 5. Small Bowel Obstruction (5) | 5 | removed |
| `appendicitis-elderly-atypical` / mnm-mesenteric-ischaemia | 1. Acute Appendicitis · 2. Small Bowel Obstruction · 3. Acute Diverticulitis · 4. Perforated Peptic Ulcer · 5. Clostridioides difficile Colitis | 1. Acute Appendicitis (18) · 2. Small Bowel Obstruction (7) · 3. Acute Diverticulitis (5) · 4. Acute Mesenteric Ischaemia (3) · 5. Obturator Hernia (2) | 2 | kept |
| `boerhaave-classic-mackler` / dx-perforation-top3 | 1. Community-Acquired Pneumonia · 2. Acute Coronary Syndrome · 3. Sepsis · 4. Acute Appendicitis · 5. Oesophageal Perforation (Boerhaave) | 1. Oesophageal Perforation (Boerhaave) (28) · 2. Acute Coronary Syndrome (23) · 3. Acute Appendicitis (23) · 4. Sepsis (20) · 5. Community-Acquired Pneumonia (18) | 8 | removed |
| `boerhaave-presenting-as-chest-pain` / mnm-perforation | 1. Acute Coronary Syndrome · 2. Stable Angina · 3. Community-Acquired Pneumonia · 4. Acute Pancreatitis · 5. Pulmonary Embolism | 1. Oesophageal Perforation (Boerhaave) (22) · 2. Acute Coronary Syndrome (13) · 3. Stable Angina (13) · 4. Acute Pancreatitis (11) · 5. Pulmonary Embolism (10) | 15 | removed |
| `cellulitis-sepsis-elderly-diabetic` / dx-cellulitis-top3 | 1. Sepsis · 2. Acute Heart Failure / Pulmonary Oedema · 3. Community-Acquired Pneumonia · 4. Acute Kidney Injury · 5. Delirium (Acute Confusional State) | 1. Sepsis (27) · 2. Cellulitis (22) · 3. Necrotising Soft Tissue Infection (Necrotising Fasciitis) (20) · 4. Acute Kidney Injury (19) · 5. Delirium (Acute Confusional State) (17) | 3 | kept |
| `cellulitis-sepsis-elderly-diabetic` / mnm-nsti | 1. Sepsis · 2. Acute Heart Failure / Pulmonary Oedema · 3. Community-Acquired Pneumonia · 4. Acute Kidney Injury · 5. Delirium (Acute Confusional State) | 1. Sepsis (27) · 2. Cellulitis (22) · 3. Necrotising Soft Tissue Infection (Necrotising Fasciitis) (20) · 4. Acute Kidney Injury (19) · 5. Delirium (Acute Confusional State) (17) | 3 | kept |
| `cholecystitis-acalculous-icu` / dx-cholecystitis-top3 | 1. Sepsis · 2. Community-Acquired Pneumonia · 3. Ascending Cholangitis · 4. Bacterial Meningitis / Meningococcal Sepsis · 5. Infective Endocarditis | 1. Acalculous Cholecystitis (27) · 2. Ascending Cholangitis (26) · 3. Sepsis (21) · 4. Infective Endocarditis (14) · 5. Community-Acquired Pneumonia (11) | 12 | removed |
| `gastric-outlet-obstruction-elderly` / dx-goo-top3 | 1. Small Bowel Obstruction · 2. Acute Gastroenteritis · 3. Acute Pancreatitis · 4. Acute Appendicitis · 5. Acute Kidney Injury | 1. Gastric Outlet Obstruction (18) · 2. Small Bowel Obstruction (7) · 3. Acute Gastroenteritis (6) · 4. Acute Pancreatitis (6) · 5. Acute Appendicitis (5) | 12 | removed |
| `gyn-pid-tubo-ovarian-abscess-sepsis` / dx-pid-top3 | 1. Ectopic Pregnancy · 2. Acute Appendicitis · 3. Sepsis · 4. Community-Acquired Pneumonia · 5. Liver Abscess (Pyogenic / Amoebic) | 1. Acute Appendicitis (23) · 2. Pelvic Inflammatory Disease (22) · 3. Sepsis (17) · 4. Ovarian Torsion (16) · 5. Infective Endocarditis (14) | 6 | removed |
| `mi-presenting-as-epigastric-pain` / mnm-acs | 1. Gastro-oesophageal Reflux Disease · 2. Peptic ulcer disease · 3. Functional dyspepsia · 4. Acute Pancreatitis · 5. Diabetic Ketoacidosis | 1. Gastro-oesophageal Reflux Disease (10) · 2. Peptic ulcer disease (7) · 3. Functional dyspepsia (7) · 4. Acute Coronary Syndrome (5) · 5. Acute Pancreatitis (4) | 3 | kept |
| `nsti-early-low-lrinec` / mnm-nsti | 1. Cellulitis · 2. Skin Abscess · 3. Femoral Hernia · 4. Acute Kidney Injury · 5. Diabetic Foot Infection / Osteomyelitis | 1. Cellulitis (13) · 2. Necrotising Soft Tissue Infection (Necrotising Fasciitis) (5) · 3. Skin Abscess (2) · 4. Femoral Hernia (0) · 5. Acute Kidney Injury (0) | 6 | removed |
| `pancreatitis-severe-organ-failure` / dx-pancreatitis-top3 | 1. Sepsis · 2. Community-Acquired Pneumonia · 3. Acute Coronary Syndrome · 4. Acute Kidney Injury · 5. Pulmonary Embolism | 1. Acute Pancreatitis (26) · 2. Sepsis (25) · 3. Acute Kidney Injury (22) · 4. Diabetic Ketoacidosis (17) · 5. Acute Coronary Syndrome (16) | 9 | removed |
| `periop-postop-anastomotic-leak-day5` / dx-leak-top3 | 1. Community-Acquired Pneumonia · 2. Sepsis · 3. Acute Appendicitis · 4. Pulmonary Embolism · 5. Anastomotic Leak | 1. Anastomotic Leak (25) · 2. Acute Appendicitis (22) · 3. Community-Acquired Pneumonia (17) · 4. Sepsis (17) · 5. Pulmonary Embolism (15) | 8 | removed |
| `periop-postop-pe-high-risk-shock` / dx-pe-top3 | 1. Sepsis · 2. Acute Heart Failure / Pulmonary Oedema · 3. Acute Coronary Syndrome · 4. Community-Acquired Pneumonia · 5. Pulmonary Embolism | 1. Pulmonary Embolism (34) · 2. Sepsis (27) · 3. Symptomatic / Ruptured Abdominal Aortic Aneurysm (22) · 4. Acute Coronary Syndrome (19) · 5. Atrial Fibrillation (18) | 15 | removed |
| `ppu-elderly-steroids-masked` / dx-perforation-top3 | 1. Sepsis · 2. Acute Kidney Injury · 3. Acute Coronary Syndrome · 4. Obturator Hernia · 5. Perforated Peptic Ulcer | 1. Sepsis (25) · 2. Perforated Peptic Ulcer (24) · 3. Acute Kidney Injury (22) · 4. Delirium (Acute Confusional State) (17) · 5. Acute Mesenteric Ischaemia (15) | 7 | removed |
| `thyroid-post-op-neck-haematoma` / dx-haematoma-top3 | 1. Community-Acquired Pneumonia · 2. Pulmonary Embolism · 3. Acute Coronary Syndrome · 4. Atrial Fibrillation · 5. Sepsis | 1. Neck Haematoma after Neck Surgery (Airway Threat) (25) · 2. Atrial Fibrillation (17) · 3. Pulmonary Embolism (15) · 4. Anaplastic Thyroid Carcinoma / Thyroid Lymphoma (15) · 5. Anaphylaxis (13) | 10 | removed |

Also flagged as passing with a wide margin: `cholangitis-tg18-charcot-sepsis/dx-cholangitis-top1` (quality,
margin 8) — flag removed. `appendicitis-score-low-band/mnm-gynaecological` (margin 0) and
`cholecystitis-tg18-grade3-organ-dysfunction/mnm-cholangitis` (margin 2) keep theirs.

## Triage level changes (`ClinicalAcuityEngine`, rulesVersion 1.0.0 → 1.1.0)

A. **NICE NG12 suspected-cancer criteria are a triage input.** `AcuityInputs.suspectedCancer` holds the
   Diagnosis tab card for the same record (`SuspectedCancerScreening.prompt(for:)`: FIT ≥ 10 µg Hb/g,
   iron-deficiency anaemia, rectal bleeding ≥ 50, weight loss with abdominal pain ≥ 40, nipple change
   ≥ 50, visible haematuria ≥ 45, not shown for a known cancer at that site). A suspected-cancer card
   raises the level to **priority** (expedited outpatient review, never an emergency — CLAUDE.md "red
   flags ≠ emergencies") and adds a triage red flag; the ferritin-check card changes nothing.
B. **A non-acute word removes only its own clause of the confirmed diagnosis.** Before: any of
   "history of", "previous", "elective", "screening", "surveillance", "incidental", "asymptomatic",
   "pre-operative assessment/planning" anywhere made the whole diagnosis set no level. Now, when such a
   word is present, the diagnosis is split at "—", "–", ";", "," and brackets, and only clauses that
   say **acute / emergency / urgent** and carry no non-acute word are read. Every elective,
   pre-operative, screening and history diagnosis in the vignettes stays non-acute (unit tests).
C. **Domestic abuse.** The recognition rule now also uses the web `RX.partnerViolence` pattern
   (`lib/triage-engine/src/emergency-recognition.ts`: "pushed / hit / punched / kicked / slapped /
   strangled / assaulted / beaten / attacked / choked by (her/his/my) partner / husband / boyfriend /
   ex / wife / girlfriend", "partner … hit …", "domestic violence / abuse", "intimate partner violence /
   abuse"), negation-aware. Title and action follow the web safeguarding flag: **"Domestic abuse
   disclosed" (+ " in pregnancy")**, "Injury attributed to a partner / domestic abuse (NICE PH50 2014;
   NICE CG110)", action "follow the practice's safeguarding procedure — speak with the patient alone,
   assess immediate safety, document, and offer referral to specialist domestic-abuse support (NICE
   PH50); inform the safeguarding lead". It changes no level (as on the web) but is now listed among the
   triage card's red flags ("<title>: <detail> — follow the practice's safeguarding procedure", the
   web adaptive-triage reason).

Tests: `AmiseMedFlowTests/ClinicalAcuityEngineTests.swift` (NG12 → priority, ferritin card no change,
acute clause vs elective / pre-operative / history diagnoses, partner violence in pregnancy and its
negation). Registry `ios-clinical-acuity-engine` 1.1.0 with a changelog entry.

## Differential engine changes (`BayesianDiagnosisEngine*`; `BayesianDecisionEngine+Scoring/+Database` in step)

1. **NEWS2 by urgency tier (shock / sepsis context).** NEWS2 ≥ 5 / ≥ 7 still adds 6 / 12 log units,
   but to the candidate's urgency tier instead of a fixed name list (sepsis, PE, pneumonia, ACS, heart
   failure …): critical (urgency 3) the whole adjustment, emergency (2) half, others none
   (`news2FullShareUrgency = 3`). NEWS2 measures how ill the patient is, not the cause (RCP 2017;
   Smith GB et al. Resuscitation 2013;84:465-70). Before, a shocked patient with a perforation, severe
   pancreatitis, an anastomotic leak or a neck haematoma was listed behind pneumonia and ACS.
   (A "critical only" variant was also simulated: same criticals fixed, no regressions, but it
   narrows pneumonia and pancreatitis margins; a "critical-first do-not-miss places" variant was
   rejected — 3 regressions.)
2. **Patient context** (`BayesianDiagnosisEngine+Context.swift`, new), computed once per differential:
   - **Post-operative day** from the complaint, HPI, PSHx and PMH: "day 5 after …", "(day 6)",
     "POD 3", "5 days after …", "this morning / today / hours ago" = 0, "yesterday" = 1, in a sentence
     that names an operation and is not about an earlier episode (a year, "… ago", "as a child",
     "previous", "history of"); the smallest day wins. New curated feature key **`postOpDay`** with
     value `"a-b"`. The structured `Patient.operationDate` is not passed to the differential (follow-up).
   - **Masking contexts** for the new optional feature field **`maskedBy`**: `elderly` (≥ 65),
     `immunosuppressed` (steroids, immunosuppressants, chemotherapy, transplant, HIV, neutropenia in
     the record), `diabetes`, `female`. A **negative** feature (logLR < 0) that lists a context that
     applies does not count: a missing or documented-absent cardinal feature is not evidence where it
     is often absent (peritonism on steroids or in the elderly; chest pain in ACS in women, older
     people and diabetes). Positive evidence is never masked.
3. **Report evidence adds a curated diagnosis.** A curated candidate the complaint's route did not
   bring in joins the list when one of its `finding` / `inv` features with logLR ≥ 12 (LR ≈ 10) is in
   a resulted report or an evidence chip ("CT: acute necrotising pancreatitis" with a breathlessness
   complaint). The history alone (PMH, HPI) never adds one. Applicability still applies; the candidate
   cap does not. This exposed LR-10 features that matched unrelated reports; they were tightened in
   the database (below).
4. **Lab chips:** `"glucose not low"` (glucose ≥ 4.0 mmol/L, JBDS 2023 definition of hypoglycaemia)
   and `"lrinec 6 or more"` — LRINEC from the results on file, scored by the Scores screen's
   calculator (`ClinicalScoringEngine.lrinec`); needs a CRP; a missing item scores 0 (can only be
   under-read); a low score is never used against necrotising infection.

Tests: `BayesianDifferentialDatabaseTests.swift` (post-operative day parsing, masking, report evidence
vs history, the new chips, GOO, post-thyroidectomy haematoma, normal glucose vs hypoglycaemia).
Registry `ios-bayesian-engine`: new file listed, changelog entry.

## Database changes (DiagnosticDatabase.json 2.0.0 → 2.1.0)

Built by a reproducible script from the 2.0.0 file (not committed; every change below). 162 pools,
1,354 candidates (+1), 15,182 features (+36); curated pool 122 candidates, 833 features. Schema check
(`scripts/src/diagnostic-database-schema.ts`, run by `lint:guideline-registry`): `maskedBy` must be an
array of strings (decode), `postOpDay` is a curated key whose value is `"a-b"`, `maskedBy` names known
contexts and sits on negative features only; tests in `diagnostic-database-schema.test.ts`. Registry
`ios-bayesian-diagnostic-database` 2.1.0 with a changelog entry; `lastReviewed` stays "unknown".

Every new or changed feature (logLR = round(5 × ln LR); "Expert estimate" = no published likelihood
ratio, pending the surgeon's review):

| Candidate | Change | Feature and likelihood ratio | Why | Citation |
|---|---|---|---|---|
| Pulmonary Embolism | value | finding: "calf swell\|leg swell\|swollen calf\|swollen leg\|calf tender\|calf fuller\|dvt\|deep vein" -> "calf swell\|leg swell\|swollen calf\|swollen leg\|calf tender\|calf fuller\|dvt\|deep vein\|calf&swollen\|calf&tender\|leg&swollen" | Signs written as "right calf swollen and tender" were missed (the words were not adjacent); "&" terms must share a sentence. | Wells PS et al. Excluding pulmonary embolism at the bedside without diagnostic imaging. Ann Intern Med 2001;135:98-107 |
| Pulmonary Embolism | add | finding "collaps\|syncope\|syncopal\|faint\|passed out\|blacked out" LR 2 | Collapse is a presenting feature of high-risk PE; the curated PE had no syncope feature (collapse only counted as a complaint). | Expert estimate pending the surgeon's review. Konstantinides SV et al. 2019 ESC Guidelines for acute pulmonary embolism. Eur Heart J 2020;41:543-603 (syncope is a presenting feature, associated with haemodynamic instability and RV dysfunction); Prandoni P et al. N Engl J Med 2016;375:1524-31 |
| Pulmonary Embolism | add | finding "rv dilat\|rv dysfunction\|rv strain\|rv:lv\|rv/lv\|dilated&right ventric\|right ventric&dilat\|right ventricular dysfunction\|right heart strain\|septal flattening\|mcconnell" LR 3 | Bedside echo RV dilatation in shock is the ESC 2019 criterion for treating suspected high-risk PE. | Fields JM et al. Transthoracic echocardiography for diagnosing pulmonary embolism: a systematic review and meta-analysis. J Am Soc Echocardiogr 2017;30:714-23 (sensitivity 53%, specificity 83%); ESC 2019 PE guideline |
| Pulmonary Embolism | add | finding "loud p2\|jvp&raised&bp\|jvp&raised&hypotens\|raised jvp&hypotens\|jvp&raised&shock\|jvp&raised&clear" LR 2 | Obstructive shock signs; heart failure keeps its own raised-JVP feature (Wang JAMA 2005). | Expert estimate pending the surgeon's review. ESC 2019 PE guideline (obstructive shock: hypotension with signs of right ventricular failure) |
| Acute Coronary Syndrome | value | finding: "radiat&arm\|radiat&jaw\|left arm\|both arms\|jaw pain\|arm pain" -> "radiat&arm\|radiat&jaw\|left arm\|both arms\|jaw pain\|arm pain\|jaw ache\|ache in the jaw\|ache in her jaw\|ache in his jaw\|pain in the jaw\|pain in her jaw\|pain in his jaw\|jaw discomfort\|arm ache\|ache in the arm\|ache in her arm\|ache in his arm" | Jaw or arm ache written as "an ache in the jaw" was missed. | Swap CJ, Nagurney JT. Value and limitations of chest pain history in the evaluation of patients with suspected acute coronary syndromes. JAMA 2005;294:2623-9 |
| Acute Coronary Syndrome | value | finding: "exertion\|on exercise\|walking uphill" -> "exertion\|on exercise\|walking uphill\|exertional\|jaw&walk\|arm&walk\|chest&walk\|jaw&exert\|arm&exert\|chest&exert\|jaw&stairs\|arm&stairs\|chest&stairs\|relieved by rest\|eases with rest\|settles with rest" | Anginal symptoms brought on by walking and relieved by rest ("an ache in the jaw when she walks, easing when she stops") were missed; exertional pain elsewhere (abdomen, legs) is not counted. | Swap CJ, Nagurney JT. Value and limitations of chest pain history in the evaluation of patients with suspected acute coronary syndromes. JAMA 2005;294:2623-9 |
| Acute Coronary Syndrome | value | finding: "pressure\|tightness\|heaviness\|crushing\|squeezing" -> "pressure\|tightness\|heaviness\|heavy\|crushing\|squeezing" | "Heavy" discomfort was missed (only "heaviness"). | Swap CJ, Nagurney JT. Value and limitations of chest pain history in the evaluation of patients with suspected acute coronary syndromes. JAMA 2005;294:2623-9 |
| Acute Coronary Syndrome | add | finding "epigastr&sweat\|epigastr&clammy\|epigastr&diaphores\|indigestion&sweat\|indigestion&clammy\|indigestion&diaphores\|upper abdominal&sweat\|upper abdominal&clammy" LR 2 | Atypical ACS in diabetes, women and older people; the web emergency recognition has the same epigastric equivalent. | Expert estimate pending the surgeon's review. Canto JG et al. Prevalence, clinical characteristics, and mortality among patients with myocardial infarction presenting without chest pain. JAMA 2000;283:3223-9; NICE CG95 (2010, updated 2016) |
| Acute Coronary Syndrome | add | findingAbsent "chest pain" LR 0.5 | A documented absence of chest pain lowers ACS only where chest pain is usually present: masked in women, older people and diabetes (Canto 2000, 2012), where MI without chest pain is common. | Expert estimate pending the surgeon's review. Canto JG et al. JAMA 2000;283:3223-9 (a third of MI without chest pain); Canto JG et al. Association of age and sex with myocardial infarction symptom presentation and in-hospital mortality. JAMA 2012;307:813-22 |
| Oesophageal Perforation (Boerhaave) | value | finding: "after vomiting\|forceful vomiting\|retching\|following vomiting\|vomiting&severe pain\|vomited&pain" -> "after vomiting\|forceful vomiting\|retching\|following vomiting\|vomiting&severe pain\|vomited&pain\|after he vomited\|after she vomited\|after being sick\|after he was sick\|after she was sick\|after retching\|after a bout of vomiting" | "It started straight after he vomited" was missed. | Søreide JA, Viste A. Esophageal perforation: diagnostic work-up and clinical decision-making in the first 24 hours. Scand J Trauma Resusc Emerg Med 2011;19:66 |
| Oesophageal Perforation (Boerhaave) | value | finding: "surgical emphysema\|subcutaneous emphysema\|neck crepitus\|crepitus in the neck\|pneumomediastinum\|mediastinal air\|mediastinal gas" -> "surgical emphysema\|subcutaneous emphysema\|neck crepitus\|crepitus in the neck\|pneumomediastinum\|mediastinal air\|mediastinal gas\|crepitus&neck\|crepitus&clavic\|supraclavicular crepitus\|crepitus&chest wall" | "Crepitus above the left clavicle" was missed. | Søreide JA, Viste A. Esophageal perforation: diagnostic work-up and clinical decision-making in the first 24 hours. Scand J Trauma Resusc Emerg Med 2011;19:66 |
| Oesophageal Perforation (Boerhaave) | add | finding "odynophag\|pain on swallowing\|painful to swallow\|painful swallowing\|worse on swallowing\|hurts to swallow" LR 2 | Odynophagia after vomiting points to the oesophagus. | Expert estimate pending the surgeon's review. Søreide JA, Viste A. Esophageal perforation: diagnostic work-up and clinical decision-making in the first 24 hours. Scand J Trauma Resusc Emerg Med 2011;19:66 |
| Aorto-Enteric Fistula | value | finding: "herald\|small bleed\|self-limiting" -> "herald\|small bleed\|self-limiting\|no further bleeding\|bleeding stopped\|stopped bleeding\|single episode\|blood once" | A herald bleed written as "vomited blood once … no further bleeding since" was missed. | Chenu C et al. Aortoenteric fistula (review); ESVS 2020 Clinical Practice Guidelines on the management of vascular graft and endograft infections (Chakfé N et al. Eur J Vasc Endovasc Surg 2020;59:339-84) |
| Aorto-Enteric Fistula | add | finding "fever\|febrile\|pyrexia\|rigor\|elevated crp\|raised crp\|crp&raised\|raised wbc" LR 2 | Secondary aorto-enteric fistula is a graft infection. | Chakfé N et al. European Society for Vascular Surgery (ESVS) 2020 clinical practice guidelines on the management of vascular graft and endograft infections. Eur J Vasc Endovasc Surg 2020;59:339-84 (MAGIC criteria) |
| Aorto-Enteric Fistula | add | notFinding "haematemesis\|hematemesis\|vomited blood\|vomiting blood\|blood in vomit\|coffee ground\|melaena\|melena\|black stool\|tarry\|rectal bleed\|blood per rectum\|haematochezia\|gi bleed\|bleed" LR 0.2 | Keeps the fistula off lists of patients with an aortic graft and no bleeding (the graft feature is LR 12). | Expert estimate pending the surgeon's review. ESVS 2020 graft infection guideline: aorto-enteric fistula presents with gastrointestinal bleeding (often a herald bleed) |
| Clostridioides difficile Colitis | add | notFinding "diarrhoea\|diarrhea\|loose stool\|watery\|difficile\|c diff\|c. diff\|cdiff\|toxin positive\|pseudomembran\|megacolon\|colitis" LR 0.2 | C. difficile colitis was listed for abdominal pain without diarrhoea. | McDonald LC et al. Clinical practice guidelines for Clostridium difficile infection in adults and children: 2017 update by IDSA and SHEA. Clin Infect Dis 2018;66:e1-e48 (test only with ≥3 unformed stools in 24 h; ileus without diarrhoea is rare) |
| Hypoglycaemia | add | finding "glucose not low" LR 0.05 | Hypoglycaemia ranked second in a patient with a measured glucose of 17.8 mmol/L. | Joint British Diabetes Societies for Inpatient Care. The hospital management of hypoglycaemia in adults with diabetes mellitus (2023): hypoglycaemia is a glucose below 4.0 mmol/L |
| Cellulitis | add | finding "erythema&warm&tender\|erythema&hot&tender\|redness&warm&tender\|redness&hot&tender\|erythema&tender&swollen\|red&hot&swollen" LR 3 | The clinical diagnosis of cellulitis (the individual signs were weighted as if unrelated). | Expert estimate pending the surgeon's review. Stevens DL et al. Practice guidelines for the diagnosis and management of skin and soft tissue infections: 2014 update by the IDSA. Clin Infect Dis 2014;59:e10-52 (diagnosis rests on these signs) |
| Cellulitis | add | complaint "red&swollen\|red&hot\|hot&swollen\|redness&swelling\|red&swelling\|redness&swollen" LR 1.5 | The whole complaint ("red swollen left leg"), not only one of its words. | Presentation-match weight: Expert estimate pending the surgeon's review (no published likelihood ratio) |
| Cellulitis | add | finding "raised wbc\|elevated crp" LR 2 | Systemic inflammation with the local signs. | Expert estimate pending the surgeon's review. IDSA 2014 SSTI guideline (systemic inflammation with local signs; separates cellulitis from stasis dermatitis and other mimics) |
| Necrotising Soft Tissue Infection (Necrotising Fasciitis) | add | finding "woody\|induration beyond\|beyond the erythema\|beyond the redness\|beyond the skin changes\|beyond the margin\|tender beyond\|tenderness beyond\|oedema beyond\|swelling beyond\|hard induration\|tense oedema" LR 4 | The early sign of NSTI before bullae, necrosis or crepitus (LRINEC is too insensitive to exclude it). | Wong CH et al. Necrotizing fasciitis: clinical presentation, microbiology, and determinants of mortality. J Bone Joint Surg Am 2003;85:1454-60; Stevens DL, Bryant AE. Necrotizing soft-tissue infections. N Engl J Med 2017;377:2253-65 |
| Necrotising Soft Tissue Infection (Necrotising Fasciitis) | remove | finding "lrinec" LR 1.5 | Replaced by the LRINEC >= 6 feature below: the word "lrinec" alone scored whatever the value. |  |
| Necrotising Soft Tissue Infection (Necrotising Fasciitis) | add | finding "lrinec 6 or more\|lrinec&high risk\|lrinec&intermediate risk" LR 4.5 | The engine now scores LRINEC from the results on file ("lrinec 6 or more" chip). | Wong CH et al. The LRINEC (Laboratory Risk Indicator for Necrotizing Fasciitis) score. Crit Care Med 2004;32:1535-41; Fernando SM et al. Necrotizing soft tissue infection: diagnostic accuracy of physical examination, imaging, and LRINEC score: a systematic review and meta-analysis. Ann Surg 2019;269:58-65 (LRINEC >= 6: sensitivity 68.2%, specificity 84.8%). A low score is not used against the diagnosis. |
| Necrotising Soft Tissue Infection (Necrotising Fasciitis) | value | notFinding: "pain\|swell\|swollen\|red \|redness\|erythema\|skin\|wound\|necro\|crepitus\|bullae" -> "cellulitis\|erythema\|red \|redness\|skin\|soft tissue\|swell\|swollen\|wound infection\|infected wound\|wound&red\|wound&discharg\|necro\|crepitus\|bullae\|blister\|induration\|woody\|fasciitis\|gas in\|subcutaneous gas\|perine\|scrot\|fournier" | "Pain" or any "wound" (a clean laparotomy wound) cancelled the no-soft-tissue-sign feature, so necrotising infection could join lists without any skin or soft-tissue finding. | Fernando SM et al. Necrotizing soft tissue infection: diagnostic accuracy of physical examination, imaging, and LRINEC score: a systematic review and meta-analysis. Ann Surg 2019;269:58-65 |
| Acute Mesenteric Ischaemia | supersedes | Non-Occlusive Mesenteric Ischaemia (NOMI) | NOMI is a form of acute mesenteric ischaemia (ESVS 2017); the legacy entry scored on raised lactate, WBC and CRP alone (+15 from chips) with no abdominal feature and joined lists for sepsis from other sources. |  |
| Acute Mesenteric Ischaemia | add | age_over "75" LR 2 | Incidence rises steeply after 75; adds to the age-over-60 feature. | Kärkkäinen JM et al. Acute mesenteric ischemia is a more common cause than expected of acute abdomen in the elderly. J Gastrointest Surg 2015;19:1407-14 (over 75, more common than appendicitis or ruptured AAA) |
| Ischaemic Colitis | add | notFinding "bloody\|blood in stool\|blood in the stool\|rectal bleed\|passing blood\|bright red\|blood mixed\|maroon\|haematochezia\|blood per rectum\|diarrhoea\|diarrhea\|thumbprint\|colitis\|colonic ischaemia" LR 0.3 | Colon ischaemia without bleeding or diarrhoea filled a "do not miss" place. | Brandt LJ et al. ACG clinical guideline: epidemiology, risk factors, patterns of presentation, diagnosis, and management of colon ischemia (CI). Am J Gastroenterol 2015;110:18-44 (abdominal pain with rectal bleeding or bloody diarrhoea within 24 h in most) |
| Obturator Hernia | value | finding: "howship\|romberg\|inner thigh\|medial thigh\|knee pain" -> "howship\|romberg\|inner thigh\|medial thigh\|inside of her&thigh\|inside of his&thigh\|inside of the&thigh\|thigh&internal rotation\|knee&internal rotation" | "Knee pain" alone (naproxen for knee pain) scored as the Howship-Romberg sign (LR 8). | Petrie A et al. Obturator hernia: anatomy, embryology, diagnosis, and treatment. Clin Anat 2011;24:562-9 |
| Obturator Hernia | value | notFinding: "thigh\|knee\|obturator\|hernia\|groin" -> "thigh\|obturator\|hernia\|groin\|howship\|romberg" | Any mention of a knee cancelled the no-thigh-pain / no-hernia feature. | Petrie A et al. Obturator hernia: anatomy, embryology, diagnosis, and treatment. Clin Anat 2011;24:562-9 |
| Perforated Peptic Ulcer | value | finding: "rigid\|board-like\|boardlike\|peritonism\|generalised tenderness\|guarding" -> "rigid\|board-like\|boardlike\|peritonism\|peritonitis\|generalised tenderness\|generalised guarding\|guarding&generalised\|guarding&epigastr\|epigastr&guarding\|guarding&throughout\|diffuse guarding" | Localised guarding elsewhere (voluntary guarding in the right iliac fossa) counted as perforation; generalised or epigastric guarding still does. | Tarasconi A et al. Perforated and bleeding peptic ulcer: WSES guidelines. World J Emerg Surg 2020;15:3 |
| presentation fever | add | Acute Cholecystitis, Acalculous Cholecystitis | Fever with a right upper quadrant source (Tokyo Guidelines 2018 systemic sign); acalculous cholecystitis is a cause of fever in the critically ill. Both carry notFinding features for a missing gallbladder / RUQ sign. |  |
| Acalculous Cholecystitis | add | findingAbsent "gallstone\|calculi\|stones" LR 3 | Gallbladder inflammation without stones is the definition. | Yokoe M et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholecystitis. J Hepatobiliary Pancreat Sci 2018;25:41-54; Barie PS, Eachempati SR. Acute acalculous cholecystitis. Gastroenterol Clin North Am 2010;39:343-57 |
| Acalculous Cholecystitis | add | notFinding "gallbladder\|ruq\|right upper\|murphy\|cholecyst\|pericholecystic" LR 0.2 | Added to the fever presentation; without a gallbladder sign it stays low. | Tokyo Guidelines 2018 (Yokoe M et al. J Hepatobiliary Pancreat Sci 2018;25:41-54; Kiriyama S et al. 2018;25:17-30) |
| Acalculous Cholecystitis | add | notFinding "icu\|intensive care\|itu\|ventilat\|critically ill\|critical care\|sepsis\|septic\|shock\|burns\|trauma\|parenteral\|tpn\|post-operative\|postoperative\|noradrenaline\|vasopressor\|diabet\|vasculitis" LR 0.3 | Risk context for acalculous cholecystitis. | Expert estimate pending the surgeon's review. Barie PS, Eachempati SR. Gastroenterol Clin North Am 2010;39:343-57 (acalculous cholecystitis mostly in the critically ill; also older people with vascular disease or diabetes) |
| Ascending Cholangitis | add | findingAbsent "duct dilat\|dilated cbd\|cbd dilated\|dilated bile duct\|biliary dilat\|dilated common bile duct\|dilated duct" LR 0.5 | Imaging without duct dilatation is evidence against cholangitis. | Expert estimate pending the surgeon's review. Kiriyama S et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholangitis. J Hepatobiliary Pancreat Sci 2018;25:17-30 (imaging criterion: biliary dilatation or the cause) |
| Gastric Outlet Obstruction | new | curated candidate (uncommon, urgency 2), 8 features | The legacy entries scored only on weight loss (capped 1.0.0 content). | Prior tier uncommon. Koop AH, Palmer WC, Stancampiano FF. Gastric outlet obstruction: a red flag, potentially manageable. Cleve Clin J Med 2019;86:345-53 (causes: peptic ulcer disease, gastric and pancreatic cancer). Replaces the legacy entries of the same name. |
| presentation vomiting | add | Gastric Outlet Obstruction | Vomiting after meals. |  |
| presentation upperGI | add | Gastric Outlet Obstruction | Fullness, early satiety, dyspepsia with vomiting. |  |
| Pelvic Inflammatory Disease | value | finding: "cervical motion\|cervical excitation\|adnexal tender" -> "cervical motion\|cervical excitation\|adnexal tender\|tender&adnexal" | "Tender left adnexal mass" was missed. | CDC Sexually Transmitted Infections Treatment Guidelines 2021 (pelvic inflammatory disease); BASHH UK PID guideline 2019 |
| Pelvic Inflammatory Disease | add | finding "tubo-ovarian\|tuboovarian\|pyosalpinx\|adnexal abscess" LR 10 | Imaging of the complication of PID; the curated candidate had no imaging feature. | Expert estimate pending the surgeon's review. Lareau SM, Beigi RH. Pelvic inflammatory disease and tubo-ovarian abscess. Infect Dis Clin North Am 2008;22:693-708; BASHH PID guideline 2019 |
| Liver Abscess (Pyogenic / Amoebic) | value | finding: "liver abscess\|hepatic abscess\|collection&liver\|liver&collection\|lesion&segment\|hypoechoic&lobe\|segment vii\|segment viii\|multiloculated" -> "liver abscess\|hepatic abscess\|amoebic abscess\|abscess&liver\|abscess&right lobe\|abscess&left lobe\|collection&liver\|liver&collection\|lesion&segment\|hypoechoic&liver\|hypoechoic&hepatic\|segment vii\|segment viii\|multiloculated&liver\|multiloculated&hepatic" | "Multiloculated" and "hypoechoic … lobe" alone matched an adnexal (tubo-ovarian) abscess and thyroid nodules. | Lardière-Deguelte S et al. Hepatic abscess: diagnosis and management. J Visc Surg 2015;152:231-43 |
| Anaphylaxis | add | notFinding "urticaria\|hives\|rash\|flush\|itch\|angioedema\|swell\|swollen\|lip\|tongue\|wheez\|stridor\|throat\|allerg\|anaphyla" LR 0.2 | Hypotension after contrast without any skin, mucosal or airway feature was listed as anaphylaxis. | Campbell RL et al. Evaluation of National Institute of Allergy and Infectious Diseases/Food Allergy and Anaphylaxis Network criteria for the diagnosis of anaphylaxis in emergency department patients. J Allergy Clin Immunol 2012;129:748-52; Cardona V et al. World Allergy Organization anaphylaxis guidance 2020 |
| Hypercalcaemia | value | finding: "cancer\|malignan\|myeloma\|metasta\|parathyroid" -> "cancer\|malignan\|myeloma\|metasta\|parathyroid\|pth\|hyperparathyroid" | A raised PTH written as "PTH" was missed. | Society for Endocrinology Endocrine Emergency Guidance: acute hypercalcaemia (Walsh J et al. Endocr Connect 2016;5:G9-11) |
| Incarcerated / Strangulated Hernia | add | notFinding "hernia\|groin\|bulge\|irreducible\|incarcerat\|strangulat\|obturator\|femoral\|inguinal\|umbilic\|incisional\|scar\|abdominal wall\|lump&abdom\|lump&tummy\|lump&belly" LR 0.2 | An incarcerated hernia was listed for patients in whom no hernia was mentioned. | HerniaSurge Group. International guidelines for groin hernia management. Hernia 2018;22:1-165 |
| Neck Haematoma after Neck Surgery (Airway Threat) | add | postOpDay "0-1" LR 3 | Timing of post-thyroidectomy haematoma. | Iliff HA et al. Management of haematoma after thyroid surgery: systematic review and multidisciplinary consensus guidelines from the Difficult Airway Society, the British Association of Endocrine and Thyroid Surgeons and the British Association of Otorhinolaryngology, Head and Neck Surgery. Anaesthesia 2022;77:82-95 (most haematomas present within 6 h, nearly all within 24 h) |
| Neck Haematoma after Neck Surgery (Airway Threat) | add | postOpDay "7-999" LR 0.2 | A remote neck operation is not the current airway haematoma. | Expert estimate pending the surgeon's review. Iliff HA et al. Anaesthesia 2022;77:82-95 |
| Anastomotic Leak | remove | finding "day 3\|day 4\|day 5\|day 6\|day 7\|day 8\|day 9" LR 2 | Replaced by the postOpDay feature below (any wording of the day, not only "day 3" … "day 9"). |  |
| Anastomotic Leak | add | postOpDay "3-30" LR 2 | Same likelihood ratio as the text feature it replaces (2). | Hyman N et al. Anastomotic leaks after intestinal anastomosis: it's later than you think. Ann Surg 2007;245:254-8 (mean day of diagnosis 12.7; 42% after discharge) |
| Perforated Peptic Ulcer | add | findingAbsent "guarding\|rigid\|peritonism\|peritonitic\|board-like\|rebound" LR 0.4 | A soft abdomen is evidence against perforation, except in older and immunosuppressed (steroid) patients, in whom peritonism is often absent. | Expert estimate pending the surgeon's review. Tarasconi A et al. Perforated and bleeding peptic ulcer: WSES guidelines. World J Emerg Surg 2020;15:3; ReMine SG, McIlrath DC. Bowel perforation in steroid-treated patients. Ann Surg 1980;192:581-6 |
| Oesophageal / Gastric Carcinoma | value | finding: "stricture&malignant\|carcinoma\|adenocarcinoma\|tumour\|malignant stricture\|irregular stricture\|shouldering" -> "malignant stricture\|irregular stricture\|shouldered stricture\|stricture&malignant\|stricture&shoulder\|oesophag&carcinoma\|oesophag&adenocarcinoma\|oesophag&tumour\|oesophag&mass\|gastric&carcinoma\|gastric&adenocarcinoma\|gastric&tumour\|gastric&mass\|stomach&carcinoma\|stomach&tumour\|stomach&mass\|cardia&tumour\|linitis" | Any "carcinoma", "tumour" or "shouldered" (a sigmoid tumour, papillary thyroid carcinoma) counted as oesophago-gastric cancer (LR 10). | NICE NG12 (2015, updated 2023) Suspected cancer: recognition and referral |
| Deep Vein Thrombosis | value | finding: "non-compressible\|noncompressible\|thrombus in the\|occlusive thrombus\|femoral vein thromb\|popliteal vein thromb" -> "non-compressible&vein\|noncompressible&vein\|non-compressible&femoral\|non-compressible&popliteal\|thrombus&femoral\|thrombus&popliteal\|thrombus&iliac\|thrombus&tibial\|thrombus&calf vein\|thrombus&deep vein\|occlusive thrombus&deep\|femoral vein thromb\|popliteal vein thromb" | "Non-compressible appendix", a superior mesenteric vein thrombus and a great saphenous vein thrombus counted as DVT (LR 30). | Goodacre S et al. Systematic review and meta-analysis of the diagnostic accuracy of ultrasonography for deep vein thrombosis. BMC Med Imaging 2005;5:6 |
| Diabetic Ketoacidosis | value | finding: "ketones&raised\|ketones 3\|ketones 4\|ketones 5\|ketones 6\|ketones 7\|ketonaemia\|ketonuria\|ketones +\|beta-hydroxybutyrate\|metabolic acidosis\|ph 7.0\|ph 7.1\|ph 7.2\|bicarbonate 1\|bicarbonate 9\|bicarbonate 8" -> "ketones&raised\|ketones 3\|ketones 4\|ketones 5\|ketones 6\|ketones 7\|ketonaemia\|ketonuria\|ketones +\|beta-hydroxybutyrate\|ketoacidosis" | Metabolic acidosis without ketones (renal failure, lactic acidosis) counted as DKA (LR 10); moved to its own weaker feature. | JBDS-IP. The management of diabetic ketoacidosis in adults (2023 update) |
| Diabetic Ketoacidosis | value | finding: "kussmaul\|deep sighing\|deep breathing\|ketotic\|pear drop\|acetone" -> "kussmaul\|deep sighing\|ketotic\|pear drop\|acetone" | "Deep breathing" matched pleuritic pain ("worse on deep breathing") as Kussmaul breathing (LR 6). | Kitabchi AE et al. Hyperglycemic crises in adult patients with diabetes. Diabetes Care 2009;32:1335-43 |
| Diabetic Ketoacidosis | value | notFinding: "diabet\|glucose\|ketone\|ketotic\|insulin\|sugar\|thirst\|polyuria\|kussmaul\|gliflozin\|sglt2\|acidosis" -> "diabet\|ketone\|ketotic\|ketoacid\|insulin\|elevated glucose\|severe hyperglycaemia\|hyperglycaem\|high sugar\|thirst\|polyuria\|kussmaul\|gliflozin\|sglt2\|acidosis" | Any measured glucose (a normal result line) cancelled the no-diabetes-feature: now a raised glucose, diabetes, ketones, acidosis or an SGLT2 inhibitor must be written (JBDS 2023; euglycaemic DKA is covered by the SGLT2 terms). | JBDS-IP. The management of diabetic ketoacidosis in adults (2023 update) |
| Diabetic Ketoacidosis | add | finding "metabolic acidosis\|ph 7.0\|ph 7.1\|ph 7.2\|bicarbonate 1\|bicarbonate 9\|bicarbonate 8" LR 2 | Acidosis supports DKA only with ketones. | Joint British Diabetes Societies Inpatient Care Group. The management of diabetic ketoacidosis in adults (2023): DKA needs ketonaemia ≥3.0 mmol/L or ketonuria ≥2+ as well as acidosis; acidosis alone has other causes |
| Anastomotic Leak | value | finding: "leak\|extraluminal\|free fluid\|collection\|free air\|free gas\|faeculent drain\|feculent drain" -> "anastomotic leak\|leak&anastomo\|extraluminal\|contrast leak\|collection&anastomo\|fluid&anastomo\|gas&anastomo\|faeculent drain\|feculent drain\|faeculent&drain\|feculent&drain" | "Free fluid" or "collection" in any report (trauma, a breast abscess) counted as an anastomotic leak (LR 10); the unspecific findings are a separate feature. | Hyman N et al. Anastomotic leaks after intestinal anastomosis: it's later than you think. Ann Surg 2007;245:254-8; den Dulk M et al. Improved diagnosis and treatment of anastomotic leakage after colorectal surgery (DULK). Eur J Surg Oncol 2009;35:420-6 |
| Anastomotic Leak | add | finding "free fluid\|collection\|free air\|free gas\|pneumoperitoneum" LR 3 | Unspecific after an anastomosis (free gas and fluid are expected early after surgery). | Expert estimate pending the surgeon's review. den Dulk M et al. Improved diagnosis and treatment of anastomotic leakage after colorectal surgery. Eur J Surg Oncol 2009;35:420-6 |
| Acute Cholecystitis | value | finding: "wall thicken\|pericholecystic\|sonographic murphy\|distended gallbladder\|cholecystitis" -> "gallbladder wall thicken\|gallbladder&wall thicken\|wall thickened&pericholecystic\|pericholecystic\|sonographic murphy\|distended gallbladder\|cholecystitis" | "Wall thickening" of the sigmoid colon, caecum or jejunum counted as cholecystitis (LR 10). | Trowbridge RL, Rutkowski NK, Shojania KG. Does this patient have acute cholecystitis? JAMA 2003;289:80-6 |
| Charcot Neuro-osteoarthropathy | value | finding: "fragmentation\|charcot\|midfoot collapse\|rocker\|bone marrow oedema" -> "fragmentation&foot\|fragmentation&midfoot\|fragmentation&tars\|charcot foot\|charcot neuro\|charcot arthropathy\|charcot joint\|midfoot collapse\|rocker-bottom\|rocker bottom\|bone marrow oedema&foot\|bone marrow oedema&midfoot\|bone marrow oedema&tars" | "Charcot" alone matched Charcot's triad (cholangitis); "fragmentation" matched any fracture. | Rogers LC et al. The Charcot foot in diabetes. Diabetes Care 2011;34:2123-9; IWGDF 2023 guidelines |
| Acute Pericarditis | value | finding: "pericardial rub\|friction rub" -> "pericardial rub\|pericardial friction rub" | A pleural friction rub counted as pericarditis (LR 10). | ESC 2015 Guidelines for the diagnosis and management of pericardial diseases (Adler Y et al. Eur Heart J 2015;36:2921-64) |
| Acute Ischaemic Stroke | value | finding: "infarct\|occlusion\|restricted diffusion\|acute ischaem" -> "cerebral infarct\|infarct&brain\|infarct&cerebr\|infarct&ct head\|infarct&mri\|infarct&territory\|lacunar\|mca territory\|restricted diffusion\|acute ischaemic stroke\|acute ischemic stroke\|large vessel occlusion\|m1 occlusion\|mca occlusion\|basilar occlusion\|carotid occlusion" | "Infarct", "occlusion" or "acute ischaem" in any report (myocardial infarction, SMA occlusion, acute limb ischaemia) counted as stroke (LR 20). | NICE NG128 (2019, updated 2022) Stroke and transient ischaemic attack in over 16s |

Presentation changes: `fever` + Acute Cholecystitis, Acalculous Cholecystitis; `vomiting` and `upperGI` +
Gastric Outlet Obstruction. Supersedes: Acute Mesenteric Ischaemia now also replaces the legacy
"Non-Occlusive Mesenteric Ischaemia (NOMI)" (it scored +15 from three laboratory chips with no
abdominal feature and joined sepsis lists from other sources).

## Needs sign-off

Surgeon (physician colleagues where marked) before release. Nothing here is approved until listed as
approved in `SURGEON-DECISIONS.md` section H.

1. **NEWS2 by urgency tier** (engine 1): critical diagnoses take +12 (NEWS2 ≥ 7) / +6 (5–6), emergency
   ones half, others none. Accept that in shocked patients critical diagnoses with little specific
   evidence (DKA in a diabetic, AAA in an older man, incarcerated hernia) take "do not miss" places
   more often? Alternative simulated: critical only (no share for urgency 2).
2. **Report evidence** (engine 3): a curated diagnosis with a feature of LR ≥ 10 in a resulted report
   or laboratory chip is added whatever the complaint. Threshold (logLR 12) and the rule that the
   history never adds one.
3. **Post-operative day from the text** (engine 2): the patterns, the "earlier episode" exclusions and
   "smallest day wins". Neck haematoma day 0–1 LR 3 and day ≥ 7 LR 0.2 (Iliff 2022); anastomotic leak
   day 3–30 LR 2 (Hyman 2007; replaces "day 3" … "day 9", same LR).
4. **Masking contexts** (engine 2): definitions (elderly ≥ 65; the immunosuppression and diabetes word
   lists; female) and the two uses — perforated ulcer "no guarding / rigidity / peritonism" LR 0.4
   masked in the elderly and immunosuppressed; ACS "chest pain documented absent" LR 0.5 masked in
   women, older people and diabetes (physician).
5. **Lab chips**: "glucose not low" at ≥ 4.0 mmol/L with hypoglycaemia LR 0.05 (the glucose must be
   from the time of the symptoms); LRINEC ≥ 6 from the results on file, LR 4.5 (Fernando 2019), missing
   items scored 0. Note for review: the app's LRINEC calculator scores creatinine > 177 µmol/L as +4
   (Wong 2004 has a single > 141 µmol/L band of +2); not changed here.
6. **Triage A — NG12 card sets priority** (also raises `haemorrhoids-grade3-over-50`, rectal bleeding
   at 56, from routine to priority).
7. **Triage B — acute-clause rule** for the confirmed diagnosis (markers: acute, emergency, urgent).
8. **Triage C — domestic abuse**: the web pattern, wording and "no level change"; the red-flag line on
   the triage card; the safeguarding lead's local contacts are still to be supplied by the practice.
9. **New curated Gastric Outlet Obstruction** (tier uncommon, urgency 2; 8 features, all LRs expert
   estimates citing Koop 2019; presentations vomiting and upper GI; replaces the legacy entries).
10. **PE**: syncope / collapse LR 2 (expert; ESC 2019, Prandoni 2016); RV dilatation or dysfunction on
    echo / CT LR 3 (Fields 2017); loud P2 or raised JVP with hypotension / clear lungs LR 2 (expert);
    DVT-sign wording (physician).
11. **ACS atypical presentation**: epigastric pain or "indigestion" with sweating LR 2 (expert; Canto
    2000, NICE CG95); jaw / arm ache and exertional-symptom wording widened (Swap & Nagurney LRs
    unchanged); "heavy" added to pressure-type pain (physician).
12. **Boerhaave**: pain on swallowing LR 2 (expert); vomiting-onset and neck-crepitus wording.
13. **Aorto-enteric fistula**: fever or raised inflammatory markers LR 2 (ESVS 2020); no GI bleeding
    LR 0.2 (expert); herald-bleed wording.
14. **NSTI**: tenderness / induration / oedema beyond the erythema, woody induration LR 4 (Wong 2003;
    Stevens & Bryant 2017); LRINEC ≥ 6 LR 4.5 (replaces the word "lrinec" LR 1.5); "no soft-tissue
    sign" no longer cancelled by "pain" or a clean wound.
15. **Cellulitis**: erythema with warmth and tenderness LR 3, raised WBC or CRP LR 2, red swollen /
    hot limb complaint LR 1.5 (all expert, IDSA 2014). These are what put cellulitis in the top 3 of
    `cellulitis-sepsis-elderly-diabetic` (margin 3).
16. **Cholecystitis in fever**: acute and acalculous cholecystitis added to the fever presentation;
    acalculous: no gallstones on imaging LR 3 (TG18, Barie 2010), no gallbladder / RUQ sign LR 0.2,
    no critical-illness context LR 0.3 (expert); cholangitis: no duct dilatation LR 0.5 (expert, TG18).
17. **PID**: tubo-ovarian abscess / pyosalpinx on imaging LR 10 (expert; Lareau 2008); "tender adnexal"
    wording.
18. **Mesenteric ischaemia**: age ≥ 75 LR 2 (Kärkkäinen 2015) on top of age ≥ 60 LR 2; supersedes
    legacy NOMI. Not modelled on purpose: anticoagulation lowering the risk (the vignette asks for AMI
    to stay listed in an anticoagulated 78-year-old with AF).
19. **New negatives**: C. difficile no diarrhoea LR 0.2 (IDSA/SHEA 2017); anaphylaxis no skin, mucosal
    or airway feature LR 0.2 (Campbell 2012; WAO 2020) (physician); incarcerated hernia no hernia /
    groin / abdominal-wall sign LR 0.2 (expert, HerniaSurge 2018); ischaemic colitis no bleeding or
    diarrhoea LR 0.3 (ACG 2015); DKA acidosis without ketones LR 2 (was part of the LR-10 ketone
    feature) and the DKA "no feature" negative now needs a raised glucose, diabetes, ketones, acidosis
    or an SGLT2 inhibitor (a normal glucose result no longer cancels it) (physician); hypercalcaemia
    cause wording ("PTH").
20. **Tightened LR ≥ 10 features** (report evidence exposed them): oesophago-gastric carcinoma (now
    needs the oesophagus / stomach), DVT (a deep vein), DKA (ketones), anastomotic leak (the
    anastomosis; free fluid / gas / collection alone LR 3), liver abscess (the liver), stroke (brain
    imaging wording), obturator hernia ("knee pain" alone no longer the Howship-Romberg sign), Charcot
    foot, pericardial rub, acute cholecystitis (the gallbladder). Check that no true presentation is
    now missed.
21. **Citations**: written from the literature without a check against the source; each must be
    verified before `lastReviewed` is set.

## Not done / follow-ups

- The iOS app was not built or run here. New Swift names were checked against the whole repository
  (no clashes); every new type or function is nested in `BayesianDiagnosisEngine` or
  `ClinicalAcuityEngine`, and the scoring extension is byte-identical in both engines apart from its
  header. The next iOS CI run is the real result; the 7 flags kept above should be removed when it
  passes them.
- `CLAUDE.md` and the `ios-arch` skill still describe DiagnosticDatabase 2.0.0 (1,353 candidates);
  left for the owner (agents may not edit CLAUDE.md or skills).
- The structured operation date (`Patient.operationDate` / `postOpDays`) could feed `postOpDay`
  directly; that needs a new `infer` argument at the ConsultationView and runner call sites.
- Thin but passing expectations outside this work (margin 1, unchanged): `breast-lump-over-35-suspicious/
  dx-carcinoma-top3`, `crc-rectal-bleeding-weight-loss-52/dx-crc-top3`.

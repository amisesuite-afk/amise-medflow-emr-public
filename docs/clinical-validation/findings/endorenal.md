# Endocrine, renal, urology and neurology cluster — clinical validation findings

This cluster covers the medical and urological emergencies that reach a general and endoscopic
surgery practice: through the booking queue, on the ward after an operation, or as mimics of a
surgical abdomen. It adds 40 vignettes. Before this cluster, the suite had one DKA mimic, two
testicular torsion mimics, a hypercalcaemic crisis and an AAA-as-renal-colic mimic.

- **Base:** `claude/pr-37-gbg22z` at 3290530 (after the negation-aware and whole-word matching
  fixes), branch `clinval-endorenal`. No engine code or clinical data was changed.
- **Web:** `pnpm --filter @workspace/scripts run clinval:web`, run on 2026-09-25 after rebasing
  onto the matching fixes. These results are exact.
  - The vignettes were first written against b63c935.
  - The matching fixes resolved 10 of this cluster's known gaps: the "no peritonism" /
    "no distension" operative plans, the cholecystectomy panel in pregnant pyelonephritis, and
    diclofenac in pregnant renal colic.
  - The fixes also exposed 5 new failures, which had previously passed for the wrong reason. All
    are flagged. See "What changed after the matching fixes" below.
- **iOS:** not run. This machine is Linux, so XCTest cannot run here. Every expectation that
  applies to iOS carries `unverified: ["ios"]` (326 of the 334). The iOS section below is a
  **prediction from reading the code**, not an observation. Triage it after the next CI run.
- **Citations:** every citation is `verified: false`. The surgeon must check the statement,
  edition and year against the source. The JBDS DKA and hypoglycaemia editions in particular are
  marked "to be confirmed" in the citation text.
- **Thresholds:** no threshold was invented. Numbers appear only where the guideline states them:
  UKKA calcium doses, European hyponatraemia bolus volume and correction limit, JBDS fixed-rate
  insulin rates, NICE NG12 age 45. Any expectation that depends on a number the guideline does not
  give is `quality`.

## Summary (web, the 40 vignettes in this cluster)

| | Count |
|---|---|
| Vignettes | 40: 17 bases and 23 permutations (2 are permutations of the seeded `mimic-testicular-torsion`; the hypoglycaemia stroke mimic is a permutation of the stroke base) |
| Expectations | 334 (227 critical, 107 quality): **181 pass, 153 fail**, 0 n/a |
| Critical expectations graded | 227: 118 pass, **109 fail** |
| Quality failures | 44 |
| Blocking failures | **0**. Every web failure has `knownGap: ["web"]`, a `knownGapNote` saying what the engine does instead, and a `proposedFix` (except where the note names the fix already proposed for the same gap) |
| Suite total after this cluster | 357 vignettes, 2822 expectations, 0 blocking; `pnpm --filter @workspace/scripts run test` passes |

What works on web: the **lab-driven prompts**. Hyperkalaemia, AKI (creatinine), hyponatraemia and
glucose above 15 each raise a prompt, with ECG, calcium, insulin–glucose, salbutamol, withholding
of ACE inhibitors, NSAIDs and metformin, and a limit of 10 mmol/L per 24 h on sodium correction.
The **urology protocols** also work once a protocol is active: retention, haematuria (2WW,
cystoscopy, CT urogram), torsion, epididymo-orchitis and typical renal colic (now 9/9). So does
the sepsis bundle.

What fails is anything that needs **recognition**. PANE has no medical diseases. The triage rules
have no neurological, electrolyte, scrotal or haematuria red flags. The prompts do not read
ketones, calcium, pH, imaging for hydronephrosis, pregnancy, SGLT2 inhibitors or steroids.

Results per vignette (web): pass / fail, critical graded / critical failed, triage level, PANE top 3.

| Vignette | Pass | Fail | Crit | Crit fail | Web level | PANE top 3 |
|---|---|---|---|---|---|---|
| dka-type1-young-typical | 10 | 4 | 10 | 2 | emergency | cholecystitis, appendicitis, peptic ulcer |
| dka-euglycaemic-sglt2-postop | 4 | 7 | 9 | 6 | emergency | inguinal hernia, cholecystitis, GORD |
| dka-pregnant-28wk | 8 | 3 | 9 | 2 | emergency | cholecystitis, appendicitis, peptic ulcer |
| hhs-elderly-type2 | 5 | 6 | 6 | 4 | emergency | cholecystitis, diverticulitis, GORD |
| hypoglycaemia-sulfonylurea-ckd-elderly | 3 | 4 | 5 | 3 | emergency | inguinal hernia, GORD, cholecystitis |
| hypoglycaemia-stroke-mimic | 3 | 2 | 5 | 2 | emergency | inguinal hernia, cholecystitis, GORD |
| hyperkalaemia-severe-ckd-acei | 8 | 3 | 7 | 2 | **urgent** | inguinal hernia, GORD, cholecystitis |
| hyperkalaemia-postop-aki-oliguric | 9 | 1 | 8 | 1 | **urgent** | cholecystitis, GORD, diverticulitis |
| hyponatraemia-severe-postop-seizure | 4 | 4 | 6 | 2 | emergency | cholecystitis, appendicitis, GORD |
| hyponatraemia-elderly-thiazide-ssri | 6 | 2 | 4 | 1 | urgent | cholecystitis, diverticulitis, GORD |
| hyponatraemia-hypovolaemic-ileostomy | 4 | 1 | 4 | 1 | emergency | inguinal hernia, cholecystitis, GORD |
| hypercalcaemia-malignancy-bone-mets | 3 | 7 | 7 | 4 | emergency | cholecystitis, bowel obstruction, ileus |
| hypercalcaemia-myeloma-aki-elderly | 3 | 3 | 6 | 3 | urgent | inguinal hernia, GORD, cholecystitis |
| aki-prerenal-diarrhoea-acei-nsaid | 7 | 3 | 6 | 1 | urgent | cholecystitis, GORD, peptic ulcer |
| aki-obstructive-chronic-retention-elderly | 4 | 5 | 5 | 3 | urgent | inguinal hernia, GORD, diverticulitis |
| pyelonephritis-adult-female | 6 | 3 | 6 | 2 | emergency | cholecystitis, appendicitis, cholangitis |
| pyelonephritis-pregnant-24wk | 8 | 4 | 10 | 3 | emergency | cholecystitis, appendicitis, cholangitis |
| urosepsis-elderly-immunosuppressed-catheter | 8 | 4 | 8 | 2 | emergency | inguinal hernia, GORD, cholecystitis |
| renal-colic-typical | 9 | 0 | 3 | 0 | emergency | **renal colic**, cholecystitis, inguinal hernia |
| renal-colic-infected-obstructed | 7 | 3 | 9 | 2 | emergency | cholecystitis, **renal colic**, cholangitis |
| renal-colic-pregnant | 4 | 4 | 6 | 2 | emergency | **renal colic**, cholecystitis, appendicitis |
| renal-colic-solitary-kidney-anticoagulated | 4 | 3 | 4 | 2 | emergency | **renal colic**, inguinal hernia, cholecystitis |
| urinary-retention-acute-bph | 8 | 1 | 5 | 1 | urgent | inguinal hernia, GORD, cholecystitis |
| haematuria-visible-smoker-2ww | 5 | 2 | 4 | 2 | **routine** | inguinal hernia, cholecystitis, GORD |
| haematuria-anticoagulated-clot-retention | 5 | 2 | 3 | 1 | emergency | inguinal hernia, GORD, cholecystitis |
| torsion-adult-mimicking-epididymitis | 5 | 3 | 5 | 2 | **urgent** | appendicitis, inguinal hernia, cholecystitis |
| epididymo-orchitis-sti-young | 7 | 3 | 1 | 0 | emergency | **epididymo-orchitis**, appendicitis, inguinal hernia |
| stroke-acute-fast-positive | 2 | 7 | 6 | 5 | **priority** | inguinal hernia, cholecystitis, GORD |
| stroke-anticoagulated-apixaban-elderly | 3 | 3 | 4 | 2 | emergency | cholecystitis, diverticulitis, GORD |
| tia-transient-weakness-dysarthria | 1 | 5 | 4 | 3 | emergency | inguinal hernia, cholecystitis, GORD |
| sah-thunderclap-headache | 2 | 7 | 6 | 5 | **urgent** | cholecystitis, GORD, peptic ulcer |
| sah-late-presentation-day5 | 1 | 4 | 4 | 4 | **priority** | inguinal hernia, cholecystitis, GORD |
| meningitis-meningococcal-young | 4 | 5 | 5 | 3 | emergency | inguinal hernia, appendicitis, GORD |
| meningitis-elderly-immunosuppressed-listeria | 2 | 5 | 6 | 4 | emergency | cholecystitis, GORD, diverticulitis |
| seizure-first-unprovoked-adult | 3 | 4 | 4 | 4 | urgent | cholecystitis, appendicitis, GORD |
| seizure-pregnant-eclampsia | 2 | 5 | 6 | 5 | emergency | cholecystitis, appendicitis, GORD |
| cauda-equina-syndrome-disc | 1 | 6 | 5 | 5 | **priority** | inguinal hernia, cholecystitis, GORD |
| cauda-equina-retention-presentation | 1 | 6 | 6 | 5 | **routine** | cholecystitis, GORD, peptic ulcer |
| mscc-prostate-cancer-weakness | 1 | 5 | 6 | 5 | emergency | inguinal hernia, GORD, cholecystitis |
| mscc-pain-only-breast-cancer | 1 | 4 | 4 | 3 | emergency | cholecystitis, GORD, peptic ulcer |

Bold levels are under-triage. Bold PANE entries are the only correct diagnoses in any PANE top 3
across the 40 vignettes.

## What changed after the matching fixes

**Resolved (flags removed).** The negation fix removed the "Emergency laparotomy consent" /
"BOWEL OBSTRUCTION — OPERATIVE PLAN" cascades that "no peritonism" and "no distension" triggered.
They had appeared in 8 vignettes:

- the three DKA vignettes;
- hypercalcaemia of malignancy;
- pyelonephritis and urosepsis;
- typical and infected obstructed renal colic.

The management panel now follows the confirmed diagnosis, which removed two more wrong outputs:

- early cholecystectomy in pregnant pyelonephritis;
- diclofenac in pregnant renal colic.

**Newly failing, now flagged.** These had passed for the wrong reason: negated history had been
scoring as red flags.

- **Hyperkalaemia (both vignettes): emergency level.** K 7.2 with ECG changes and HR 46 is now
  `same_day_call` (score 30); K 6.7 in post-operative oliguric AKI is 44, one point under the
  threshold. The earlier `emergency_now` came from "No chest pain" scoring as a cardiac flag.
- **Adult torsion: emergency level.** Now `same_day_call` (score 35). The earlier emergency came
  from "no fever".
- **Pregnant renal colic: analgesia.** With the panel following O26.83, which has no protocol,
  the patient now gets **no analgesia and no colic plan** at all.
- **Pregnant pyelonephritis: NG111 antibiotic.** The only antibiotic is now pip-tazo from the SIRS
  prompt. The broad "pregnancy-compatible antibiotic" check accepts it, as the base vignette does.
  A new quality check for the NG111 choice (cefalexin/cefuroxime) fails.

## Top 10 safety gaps (ranked, after the matching fixes)

| # | Gap | Evidence (vignettes) | Guideline | Proposed fix (proposal only) |
|---|---|---|---|---|
| 1 | **Web has no neurological emergency logic.** `rules.ts` has no neurological red flag. A FAST-positive stroke 75 minutes after onset is triaged `priority_24_48h`. A thunderclap headache is `same_day_call`. Cauda equina with retention is `routine_booking` (score 0), and CES-I is `priority_24_48h`. The back-pain picker collects "Saddle anaesthesia" and "Bladder / bowel dysfunction", but nothing reads them. No output suggests CT head, thrombolysis/thrombectomy, aspirin for TIA, LP, neurosurgery, ceftriaxone, dexamethasone, MRI spine, an MSCC coordinator, magnesium sulfate, a first-seizure clinic or driving advice. The left-sided stroke and the TIA still reach `emergency_now` only because "left arm" matches the *cardiac* red flag (the right-sided stroke does not). The CDS suggests ABCD2 for the strokes, the TIA and both hypoglycaemia vignettes; NICE NG128 says not to use it. | All 13 neuro vignettes: 53 of the cluster's 109 critical failures | NICE NG128, NG228, NG240, NG217, NG133, NG234; SBNS/BASS 2018 | Neurological triage rules (focal deficit, thunderclap, meningism/purpura, saddle anaesthesia, cancer + back pain/weakness → emergency). Neurological safety prompts in `clinical-inference.ts` with the first actions. Remove ABCD2 from `clinical-cds.ts`. |
| 2 | **Euglycaemic DKA is invisible, and HHS gets DKA treatment.** Every DKA trigger keys on glucose (vital >20, prompt BGL >15, lab >11). Nothing reads ketones, pH or bicarbonate. With glucose 10.2, ketones 5.1 and pH 7.19 on empagliflozin after cholecystectomy there is no alarm, no ketones, no insulin and no SGLT2 advice. When the DKA prompt fires it offers insulin without 10% glucose and without potassium replacement. The same prompt gives HHS "DKA fixed-rate 0.1 units/kg/h", with no osmolality, no saline-first plan and no VTE prophylaxis. | `dka-euglycaemic-sglt2-postop` (6 critical); `hhs-elderly-type2` (4) | JBDS DKA; JBDS HHS 2022; ADA 2024; CPOC 2022 | A DKA prompt on ketones ≥3 or pH <7.3 at any glucose. Recognise SGLT2 inhibitors. Split DKA from HHS (osmolality, fluids first, 0.05 u/kg/h only if glucose plateaus). Add glucose and potassium to the insulin plan. |
| 3 | **Hypoglycaemia has no treatment prompt.** The triage vital flag fires (glucose 2.2 and 1.9), but `clinical-inference.ts` has no low-glucose rule. No output suggests glucose, glucagon, rechecking, prolonged monitoring for gliclazide with CKD 4, or reviewing the drug. The stroke-mimic case gets only preventative prompts (PSA, colonoscopy). | Both hypoglycaemia vignettes | JBDS-IP hypoglycaemia; NICE NG128 | A hypoglycaemia prompt (below 4.0) with treatment, recheck, a sulfonylurea observation period and drug review. |
| 4 | **Triage ignores critical labs, scrotal pain and haematuria.** Now that negated history no longer scores, the real triage inputs show. K 7.2 with peaked T waves, QRS 140 ms and HR 46 is `same_day_call`, and so is K 6.7 in oliguric post-operative AKI. No triage rule reads potassium, sodium, calcium or ECG changes, and bradycardia is not a vital red flag. Adult torsion at 4 hours is `same_day_call` (no scrotal rule). Painless visible haematuria at 66 in a smoker is `routine_booking` (no haematuria red flag, no NG12 urology rule), although the protocol itself says 2WW. The prompts for hyperkalaemia and torsion are correct; only the level is wrong. | `hyperkalaemia-*` ×2, `torsion-adult-*`, `haematuria-visible-*` | UKKA 2023; EAU 2024; NICE NG12 | Feed critical labs and ECG changes into `adaptiveTriage`, add bradycardia <50, a sudden-scrotal-pain rule, and haematuria in the malignancy red flag / an NG12 urology rule in the cancer screen. |
| 5 | **Calcium is never read, and myeloma is steered elsewhere.** No rule reads calcium, and E83.5 has no protocol. Adjusted calcium 3.62 with suppressed PTH produces no flag, saline, bisphosphonate or oncology referral; the calcium and vitamin D supplements continue. In the myeloma case (calcium 3.21, creatinine 298, globulin 58, lytic lesions) the outputs are a pancreatic 2WW trigger, an occult-malignancy CT, OGD and colonoscopy, but no protein electrophoresis. | `hypercalcaemia-malignancy-bone-mets` (4 critical); `hypercalcaemia-myeloma-aki-elderly` (3) | SfE 2016; Endocrine Society 2023; NICE NG35 | A hypercalcaemia prompt (adjusted Ca >3.0 or symptomatic), a myeloma-screen prompt, and an E83.5 protocol mapping. Suppress calcium/vitamin D prompts when calcium is high. |
| 6 | **Obstruction is not decompressed.** Obstructed infected kidney (fever 39.2, BP 94/56, CT stone with hydronephrosis): the protocol red flag is hidden because N13.6 is unmapped; no nephrostomy or stent. Anuric obstructed solitary kidney on apixaban: the standard colic plan, with **diclofenac first-line**, 4 weeks of MET and ESWL/URS, and no decompression. High-pressure chronic retention (creatinine 486, 1.6 L bladder, bilateral hydronephrosis): treated as pre-renal AKI (fluid challenge, nephrology), with no catheter and no post-obstructive diuresis warning. The ultrasound report is not read. | `renal-colic-infected-obstructed`, `renal-colic-solitary-kidney-anticoagulated`, `aki-obstructive-chronic-retention-elderly` | EAU Urolithiasis 2024; NICE NG148; NICE CG97 | Read hydronephrosis / bladder volume from imaging. Add a decompression branch to the renal colic protocol (infection, anuria, solitary kidney, bilateral). Suppress NSAIDs on low eGFR, rising creatinine or an anticoagulant. Map N13.x. |
| 7 | **Pregnancy safety.** Four pregnant vignettes (DKA at 28 weeks, pyelonephritis at 24, renal colic at 26, eclampsia at 34) get **no obstetric or fetal-monitoring action**. Instead the β-hCG prompt says "If urine β-HCG positive … exclude ectopic". Renal colic at 26 weeks now gets **no analgesia and no colic plan** (O26.83 unmapped), while CT KUB and contrast CT are still seeded as urgent orders. Eclampsia (BP 172/114, proteinuria 3+, platelets 92, seizure) raises no hypertension prompt, because it needs SBP ≥180, and there is no magnesium sulfate. The UTI protocol gives ciprofloxacin as first-line oral treatment for pyelonephritis with no pregnancy exception. It is not shown here only because O23.0/N10 are unmapped. | `*-pregnant-*`, `seizure-pregnant-eclampsia` | NICE NG3, NG111, NG133; EAU 2024; FDA 2020 | When pregnant: an obstetric action on every emergency prompt, no NSAIDs, no seeded ionising imaging, no ectopic prompt beyond early gestation. A pregnancy BP/proteinuria/seizure rule → eclampsia prompt. Map pregnancy-coded colic/pyelonephritis to protocols with pregnancy branches. |
| 8 | **Hyponatraemia ignores volume status and the cause.** At sodium 126 in a hypovolaemic high-output ileostomy (urine sodium 8, AKI) the prompt offers "Fluid restriction 1L/day — euvolaemic SIADH". Severe symptoms (post-operative seizure, sodium 116) get a 3% *infusion* at 1–2 mL/kg/h, not the 150 mL/20-minute bolus. The 5% glucose that caused it is not stopped. The thiazide in the older woman is not stopped ("review medications for SIADH causes"). Hypokalaemia (3.1) is not flagged. The 10 mmol/L/24 h correction limit is present (pass). | The three hyponatraemia vignettes | European guideline 2014 | Branch on volume status. Use a bolus regimen for severe symptoms. Add "stop hypotonic IV fluids" and "stop thiazide" lines, and a hypokalaemia flag. |
| 9 | **Urology recognition: PANE mis-ranks and codes are unmapped.** With loin pain, dysuria, fever and rigors applied, PANE ranks cholecystitis first (UTI is not in the top 3 and there is no pyelonephritis node). Torsion with testicular pain, scrotal swelling, vomiting and absent cremasteric reflex ranks appendicitis first. The retention chip never reaches PANE (`urinary_retention_symptoms` is never set). N10, O23.0 and N13.6 have no protocol, so pyelonephritis gets no urine culture. | `pyelonephritis-*`, `torsion-adult-*`, `urinary-retention-*`, `renal-colic-infected-*` | NICE NG111; EAU/IUSTI | Calibrate the PANE urology likelihoods and map the urinary chips to features. Map N10/N12/O23/N13 to protocols. |
| 10 | **Wrong-procedure prompts that survive the matching fixes, and iOS card coverage.** "Dilated proximal ureter" still matches the dilated-CBD rule, which requires only "dilated": a pregnant woman with hydronephrosis is offered MRCP, "ERCP — therapeutic" and "HPB surgical review — Whipple / Hartmann's". "Right inguinal hernia repair wound healed" still produces "Hernia — elective repair indicated" and a full TAPP operative plan for a repaired hernia. iOS (predicted from code, with the new whole-word lookup): 22 of 40 working diagnoses have **no radiation card** (DKA, HHS, hypoglycaemia, hyperkalaemia, hyponatraemia, hypercalcaemia, meningitis, seizure, eclampsia, CES, MSCC, torsion, retention, haematuria). The hypoglycaemic stroke mimic gets the stroke card (thrombolysis window). | `renal-colic-pregnant/mgmt-no-ercp`, `sah-late-presentation-day5` | EAU 2024; condition guidelines | The dilated-CBD rule should require "CBD"/"bile duct". Do not fire the hernia-repair prompt on "repair … healed". Add iOS radiation cards for the missing emergencies. |

Lower-impact but systematic:

- **Hyperkalaemia calcium dose.** The web prompt, and the iOS AKI card by code reading, give
  "calcium gluconate 10 mL 10%". UKKA 2023 gives calcium gluconate 10% 30 mL (or calcium chloride
  10% 10 mL). This is `quality` because only the dose differs, but it is a surgeon/pharmacy
  decision (below).
- **Steroid dependence is not recognised.** Prednisolone 7.5–10 mg in septic shock and in
  meningitis gets no hydrocortisone or steroid cover, and methotrexate is not held.
- **Meningitis antibiotics.** The only antibiotic is pip-tazo from the sepsis prompt, which does
  not treat meningitis. There is no ceftriaxone, no amoxicillin for Listeria in the older
  immunosuppressed patient, and no dexamethasone.
- **Over-triage.** 25 of 40 vignettes are `emergency_now`. This includes suspected spinal
  metastases with pain only (outpatient MRI within a week: malignancy + comorbidity + pain score
  add up to exactly 45), and gradual-onset epididymo-orchitis with normal Doppler (fever in text
  and vitals + pain score = 48).
- **Wrong-context prompts.** In known metastatic prostate cancer, "PSA 48" offers mpMRI prostate
  and biopsy. In anticoagulated stroke, the anticoagulation prompt offers peri-operative DOAC
  bridging.

## Per condition

### DKA (3: typical type 1, euglycaemic on SGLT2 after cholecystectomy, pregnancy at 28 weeks)

- **Right.**
  - Emergency level in all three.
  - The glucose-driven prompt: ketones, ABG, fixed-rate insulin 0.1 units/kg/h, fluids.
  - Symptom inference ranks DKA #1 in the typical case.
  - No operative plan any more (fixed).
- **Wrong.**
  - Gap 2: euglycaemic DKA missed entirely.
  - No potassium replacement, no continuation of basal insulin, no glucose as the level falls.
  - Gap 7: no obstetric input at 28 weeks.
  - PANE has no DKA node.
- **iOS (predicted).** No text-parser DKA alarm, level routine, no radiation card.

### HHS (1: elderly type 2, UTI-precipitated)

- **Right.** Emergency level, the hyperglycaemia alarm, and metformin held (via the AKI prompt).
- **Wrong.** Gap 2: no osmolality, no saline-first plan, a DKA-rate insulin infusion, and no VTE
  prophylaxis or foot protection.

### Hypoglycaemia (2: sulfonylurea with CKD 4, stroke mimic)

- **Right.**
  - Triage vital flag and emergency level.
  - No thrombolysis suggested for the mimic.
  - Symptom inference ranks hypoglycaemia #1 and #2.
- **Wrong.** Gap 3: no treatment or monitoring at all.
- **iOS (predicted).**
  - `AutoFunctionEngine` raises "Glucose … — Hypoglycaemia" below 3.0 with "IV dextrose 50 mL 50%",
    so the alarm should pass.
  - The FAST alarm also fires for the mimic.
  - The radiation card for the mimic is Stroke/TIA (the thrombolysis window).

### Hyperkalaemia (2: CKD 4 on ACE inhibitor + spironolactone + trimethoprim; post-operative oliguric AKI)

- **Right.** The prompt:
  - urgent ECG, IV calcium, insulin–dextrose with a glucose-monitoring note, salbutamol;
  - holding ACE inhibitor/ARB/spironolactone, nephrology for creatinine >300;
  - in the post-operative case, nephrotoxins held and no NSAID suggestion.
- **Wrong.**
  - The emergency level (gap 4).
  - The calcium gluconate dose (see decisions).
  - Trimethoprim is not recognised as a cause.
  - PANE has no node.

### Hyponatraemia (3: acute post-operative with seizure, chronic thiazide + SSRI, hypovolaemic ileostomy)

- **Right.**
  - The prompt fires at <130 and is urgent below 125.
  - 3% saline for severe cases, with a 10 mmol/L/24 h limit and an osmotic demyelination warning.
  - Urine sodium and osmolality.
- **Wrong.** Gap 8.

### Hypercalcaemia outside parathyroid surgery (2: malignancy with bone metastases, undiagnosed myeloma)

- **Wrong.** Gap 5: nothing reads calcium.
- **Note.** The seeded `parathyroid-hypercalcaemic-crisis` passes its treatment checks only
  because E21.0 maps to the parathyroid protocol. A malignancy code gets nothing.
- **iOS (predicted).** `AutoFunctionEngine` raises "Ca … — Hypercalcaemia Crisis" above 3.0 with
  "IV fluid … IV bisphosphonate if malignancy-related", so iOS should pass the flag.

### AKI (2: pre-renal on ACE inhibitor + NSAID + diuretic; obstructive from chronic retention)

- **Right.** The creatinine >130 prompt: urinalysis, hold NSAIDs/ACE inhibitor/ARB/metformin,
  fluid challenge, repeat U&E, nephrology.
- **Wrong.**
  - Diuretics are not held.
  - Obstruction is not considered (gap 6).
  - Stage is not calculated against the baseline (KDIGO).
- **iOS (predicted).** The AKI card includes "POSTRENAL (obstruction): urgent renal USS →
  nephrostomy/stent" and the same 10 mL calcium gluconate dose.

### Pyelonephritis / urosepsis (3: young woman, pregnancy at 24 weeks, older immunosuppressed with a catheter)

- **Right.**
  - Urosepsis: septic-shock bundle (cultures, 30 mL/kg, vasopressors, HDU), UTI protocol from
    N39.0 with blood cultures, NEWS2.
  - Pip-tazo sepsis cover for both pyelonephritis cases.
  - No nitrofurantoin or quinolone, but only because no UTI protocol is active (gap 7).
- **Wrong.**
  - Gap 9: PANE ranking, N10/O23 unmapped, no urine culture, no NG111 antibiotic choice.
  - An MSU requested from a catheterised man.
  - No steroid cover.

### Renal colic (4: typical, infected obstructed, pregnancy, anuric solitary kidney on apixaban)

- **Right.** Typical case: PANE renal colic #1 (0.49), CT KUB, urinalysis, NSAID analgesia, MET.
  It now passes all 9 expectations.
- **Wrong.**
  - Gap 6: decompression, and NSAIDs in AKI/anticoagulation.
  - Gap 7: no analgesia and seeded CT in pregnancy.
  - Gap 10: ERCP/Whipple from "dilated ureter".
- **iOS (predicted).**
  - The renal colic card has "JJ stent / nephrostomy if obstructed + infected", so decompression
    should pass for the infected and solitary cases.
  - It also has "Diclofenac … first line", so the NSAID exclusion should fail.
  - The pregnant case has no card.

### Acute urinary retention (1) and cauda equina presenting as retention (1)

- **Right.** Typical AUR from the R33 protocol: catheterise, tamsulosin, TWOC at 48–72 h, U&E/PSA
  once catheterised, precipitating drugs.
- **Wrong.**
  - Retention is never on the PANE list.
  - In CES-R the retention chip reaches nothing at all: routine triage, no catheter, no MRI.

### Visible haematuria (2: smoker, suspected cancer; clot retention on apixaban)

- **Right.** The R31 protocol: 2WW urology, flexible cystoscopy, CT urogram, cytology, smoking
  cessation.
- **Wrong.**
  - Routine triage (gap 4).
  - With clot retention coded R33.8, the retention protocol replaces the haematuria one, so there
    is no cystoscopy, no CT urogram and no 3-way catheter/irrigation.

### Testicular torsion vs epididymo-orchitis (2 permutations of the seeded torsion mimic)

- **Right.**
  - Torsion: scrotal-chip safety prompt, and the N44.0 protocol (exploration without imaging
    delay, bilateral fixation, Doppler only if uncertain). No epididymitis plan.
  - Epididymo-orchitis: PANE #1, NAAT, ceftriaxone + doxycycline, partner notification.
- **Wrong.**
  - Torsion is triaged `same_day_call` (gap 4) and is not in the PANE top 3 (gap 9).
  - The scrotal chip always adds "Emergency scrotal exploration", even with gradual onset,
    urethritis and normal Doppler flow (quality: over-treatment, see decisions).
- **iOS (predicted).** The text parser raises "Exclude Testicular Torsion" (sudden + testicular
  pain) for the torsion case, and correctly not for the gradual case.

### Stroke / TIA (3: FAST-positive at 75 minutes, on apixaban, resolved TIA at a pre-op visit)

- **Right.**
  - Symptom inference ranks stroke/TIA #1 in all three.
  - No aspirin before imaging, and no thrombolysis on a DOAC — both by absence of any plan.
- **Wrong.**
  - Gap 1.
  - The hypertensive-urgency prompt offers oral amlodipine in acute stroke.
  - The DOAC-bridging prompt fires.
- **iOS (predicted).**
  - FAST alarm for both stroke vignettes; no alarm for the TIA (no facial droop).
  - Level routine.
  - With whole-word matching, all three now get the Stroke/TIA card. Its red flags still use ABCD2.

### Subarachnoid haemorrhage (2: 4 hours, day 5 at a surgical clinic)

- **Wrong.** Gap 1; the day-5 presentation is `priority_24_48h`, with a hernia-repair plan (gap 10).
- **iOS (predicted).**
  - The thunderclap alarm fires for both ("worst headache", "sudden severe headache").
  - Both now get the SAH card. It prescribes "IV nimodipine 60 mg 4-hourly"; 60 mg 4-hourly is the
    oral regimen, so the route needs checking.

### Meningitis (2: meningococcal with a non-blanching rash; older immunosuppressed, Listeria risk)

- **Right.** Emergency level, sepsis bundle with blood cultures.
- **Wrong.** Gap 1: no ceftriaxone, amoxicillin or dexamethasone; pip-tazo only.
- **iOS (predicted).** The meningism alarm fires for both (neck stiffness + fever). No card.

### Seizure (2: first unprovoked seizure; eclampsia at 34 weeks)

- **Wrong.**
  - No ECG, first-seizure referral or driving advice.
  - Eclampsia: no hypertension prompt (below 180), no magnesium, no obstetric action (gaps 1
    and 7).

### Cauda equina syndrome (2) and metastatic spinal cord compression (2)

- **Wrong.** Gap 1 in all four. The back-pain red-flag answers are collected by the picker but
  unused.
- **MSCC with deficit.** Emergency only through the malignancy score, with no MRI, dexamethasone or
  coordinator.
- **Spinal metastases with pain only.** Over-triaged to `emergency_now`, with no MRI and no
  safety-netting.

## Incidental passes (right answer, wrong reason)

- `dka-type1-young-typical/inv-potassium` passes on "U&E" seeded by the *appendicitis* protocol.
- Two tests pass on blood cultures and FBC seeded by the *cholecystitis* and *hernia* protocols:
  `renal-colic-infected-obstructed/inv-cultures` and `haematuria-anticoagulated-clot-retention/inv-fbc-group`.
- `tia-transient-weakness-dysarthria/level-urgent` and
  `stroke-anticoagulated-apixaban-elderly/level-emergency` pass only because "left arm" matches
  the cardiac red flag.
- `renal-colic-infected-obstructed/alarm-sepsis` passes on the leucocytosis prompt ("sepsis
  screen"), not on shock recognition.
- Several pregnancy exclusions pass only because no UTI protocol is active: no nitrofurantoin,
  quinolone, trimethoprim or NSAID in the pregnant pyelonephritis case. Mapping O23.0 to the
  current UTI protocol would expose ciprofloxacin.
- The exclusions in the neurological vignettes (no thrombolysis on a DOAC, no aspirin before
  imaging, no antithrombotic in SAH, no BPE plan in CES-R) pass on web because the engine
  suggests nothing.

## iOS (predicted from code, not observed; every iOS expectation is `unverified`)

- **Emergency level.**
  - `ClinicalPathwayEngine` reads CC keywords only, and none of the 40 chief complaints contains
    one ("acute", "severe pain", "jaundice" …).
  - All 40 are predicted `routine`, so all 40 level expectations fail (36 of them critical).
  - This includes FAST-positive stroke, meningococcal disease, the obstructed infected kidney and
    CES-R.
- **Alarms predicted to pass.**
  - Text parser: FAST (both strokes), thunderclap (both SAH), meningism (both meningitis),
    torsion, sepsis (urosepsis: fever + "confusion").
  - Pipeline alerts: hypoglycaemia <3.0 (both), calcium >3.0 (both hypercalcaemia), creatinine
    >300 (obstructive AKI, solitary kidney, hyperkalaemia CKD).
- **Alarms predicted to fail.** DKA (all three), HHS, hyperkalaemia (no potassium alert),
  hyponatraemia (no sodium alert), eclampsia, CES, MSCC, and sepsis in the obstructed infected
  kidney (no "tachycardia"/"hypotension" words).
- **Radiation** (whole-word lookup now in the code):
  - 14 of 40 get the right card: stroke ×2, TIA, SAH ×2, AKI ×3 (including post-operative
    hyperkalaemia), UTI ×3, renal colic ×3.
  - 2 get a partly relevant AKI card: the ileostomy and myeloma cases.
  - 2 get an unrelated card: the hypoglycaemia mimic gets Stroke, and spinal metastases get
    Breast Carcinoma.
  - 22 get none.
  - Before the fix, the substring lookup would have given 17 of these the ACS card and 5 the PE
    card (DOAC + alteplase for "suspected" SAH).
- **Differential.** Not predicted. Most chief complaints here have no built-in fallback pool. In
  fallback mode, expect empty or unrelated lists.

## Harness observations (no change made)

- Prompt actions with `addToPlan` are graded as management. Ketones, ECG, osmolality/urine sodium,
  urinalysis and blood cultures are added by the web prompts as plan lines, not investigation
  orders. Those expectations were written under `management` with a note saying so. HHS
  osmolality stays under investigations because no output suggests it at all.
- No neurological or urological CC template exists in `cc-matrices.ts`. The neuro, metabolic and
  most urological vignettes use "Other / general surgical", which gives PANE no features, so PANE
  shows its priors (inguinal hernia 0.15 for older men). A symptom-inference check
  (`source: web.symptomInference`, quality) runs next to each primary-differential expectation.
- `unless` applies to the whole output item. The renal colic panel line "diclofenac … (first-line);
  opioids if NSAIDs contraindicated" contains "contraindicated", so NSAID exclusions use
  phrase-level `unless` alternatives ("avoid nsaid", "contraindicated in pregnancy").
- There is no calculator here for any score used in this cluster (no `scoreForms`). The CDS
  suggestion of ABCD2 is recorded in the notes, not as an expectation, because the schema cannot
  express "must not recommend".
- The web harness passes only the latest vital-sign set, and has no field for a urine-output
  trend or a capillary ketone chart.

## Decisions for the surgeon

1. **Hyperkalaemia calcium dose.** Web prompt and iOS AKI card: calcium gluconate 10% **10 mL**.
   UKKA 2023: 10% **30 mL** (or calcium chloride 10% 10 mL). Change after pharmacy confirmation?
2. **How far the EMR should go for medical emergencies** in an outpatient surgical practice.
   CLAUDE.md requires an ER/911 redirect for emergency-severity symptoms. Should the neuro, DKA
   and electrolyte fixes be (a) triage recognition plus a redirect and the first safe action
   only, or (b) full prompts with drug doses? The proposed fixes in gaps 1–5 depend on this.
3. **Critical labs in triage.** Should potassium, sodium, glucose, calcium and ECG changes drive
   the triage level (gap 4)? The matching fix showed that the hyperkalaemia emergencies were
   reaching `emergency_now` only through negated history.
4. **High-pressure chronic retention.** Is TWOC at 48–72 h (current R33 protocol) acceptable, or
   should it be indwelling catheter until urology review (the `quality` expectation here)?
5. **Scrotal chip.** Should "Emergency scrotal exploration" stay unconditional for any scrotal
   presentation (safe over-caution), or be worded "if torsion cannot be excluded"?
6. **UTI protocol in pregnancy.** Ciprofloxacin is first-line for pyelonephritis with no pregnancy
   exception (web protocol and iOS card). Add the NICE NG111 pregnancy branch (cefalexin /
   cefuroxime) before mapping N10/O23?
7. **Steroid cover rule.** Flag long-term prednisolone (≥5 mg) with hydrocortisone cover for
   sepsis and surgery, as in the SfE/AAGBI/RCP 2020 guidance?
8. **ABCD2.** Remove it from the web CDS suggestions and the iOS stroke card red flags (NICE NG128
   says not to use scoring for TIA)?
9. **iOS SAH card nimodipine.** "IV nimodipine 60 mg 4-hourly" mixes the oral dose with the IV
   route. Correct it to the oral regimen (or the IV infusion regimen)?
10. **Citations.** Confirm the JBDS DKA and hypoglycaemia editions, NICE NG51 (2024 update), NG240
    (2024) and the UK meningitis guideline section on immunocompromise before any expectation is
    marked `verified: true`.

## Vignettes

| Condition | Files (`ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/`) |
|---|---|
| DKA | `dka-type1-young-typical` (base), `dka-euglycaemic-sglt2-postop`, `dka-pregnant-28wk` |
| HHS | `hhs-elderly-type2` (base) |
| Hypoglycaemia | `hypoglycaemia-sulfonylurea-ckd-elderly` (base), `hypoglycaemia-stroke-mimic` (permutation of the stroke base) |
| Hyperkalaemia | `hyperkalaemia-severe-ckd-acei` (base), `hyperkalaemia-postop-aki-oliguric` |
| Hyponatraemia | `hyponatraemia-severe-postop-seizure` (base), `hyponatraemia-elderly-thiazide-ssri`, `hyponatraemia-hypovolaemic-ileostomy` |
| Hypercalcaemia (non-parathyroid) | `hypercalcaemia-malignancy-bone-mets` (base), `hypercalcaemia-myeloma-aki-elderly` |
| AKI | `aki-prerenal-diarrhoea-acei-nsaid` (base), `aki-obstructive-chronic-retention-elderly` |
| Pyelonephritis / urosepsis | `pyelonephritis-adult-female` (base), `pyelonephritis-pregnant-24wk`, `urosepsis-elderly-immunosuppressed-catheter` |
| Renal colic | `renal-colic-typical` (base), `renal-colic-infected-obstructed`, `renal-colic-pregnant`, `renal-colic-solitary-kidney-anticoagulated` |
| Acute urinary retention | `urinary-retention-acute-bph` (base) |
| Visible haematuria | `haematuria-visible-smoker-2ww` (base), `haematuria-anticoagulated-clot-retention` |
| Torsion vs epididymo-orchitis | `torsion-adult-mimicking-epididymitis`, `epididymo-orchitis-sti-young` (both permutations of `mimic-testicular-torsion`) |
| Stroke / TIA | `stroke-acute-fast-positive` (base), `stroke-anticoagulated-apixaban-elderly`, `tia-transient-weakness-dysarthria` |
| SAH | `sah-thunderclap-headache` (base), `sah-late-presentation-day5` |
| Meningitis | `meningitis-meningococcal-young` (base), `meningitis-elderly-immunosuppressed-listeria` |
| Seizure | `seizure-first-unprovoked-adult` (base), `seizure-pregnant-eclampsia` |
| Cauda equina | `cauda-equina-syndrome-disc` (base), `cauda-equina-retention-presentation` |
| MSCC | `mscc-prostate-cancer-weakness` (base), `mscc-pain-only-breast-cancer` |

Permutations covered: elderly, 70 or over (13), pregnant (4), diabetic on an SGLT2 inhibitor (1),
CKD (4), anticoagulated (3), immunosuppressed (2), post-operative (4) and mimics (hypoglycaemia as
stroke, myeloma as constipation, CES as retention, epididymo-orchitis/torsion, eclampsia as
seizure).

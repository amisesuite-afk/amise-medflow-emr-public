# Clinical validation — web engines (latest local run)

Generated 2026-09-25T14:19:15.282Z.

- Harness clinval-web/1; 88 vignettes from ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/.

Status legend: PASS; FAIL — BLOCKING (critical, not flagged: fails the test run); FAIL (known gap) and
FAIL (unverified) are reported only; "PASS (gap resolved)" means the flag can be removed from the vignette;
n/a = the expectation does not apply to that platform or the engine has no such output.

## Summary

| Platform | Vignettes | Expectations | Pass | Fail | n/a | Critical fail | Blocking | Known-gap fail | Unverified fail | Gap resolved |
|---|---|---|---|---|---|---|---|---|---|---|
| web | 88 | 718 | 453 | 247 | 18 | 110 | 0 | 247 | 0 | 0 |

## Blocking failures

None.

## All critical failures (including known gaps and unverified)

- `achalasia-pseudoachalasia-elderly` / **mnm-malignancy** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3: inguinal hernia, GORD, peptic ulcer (male prior modifier; no dysphagia feature). Symptom inference ranks occult malignancy and oesophageal/gastric carcinoma #1–2.]
- `adrenal-suspected-phaeochromocytoma` / **mnm-phaeochromocytoma** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE has no phaeochromocytoma disease (only adrenal_incidentaloma) and applied no feature; the symptom engine ranks phaeochromocytoma #1 from the chips.]
- `aortic-dissection-epigastric-back-pain` / **mnm-dissection** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Inguinal / Femoral Hernia \| 3. Acute Cholecystitis [known gap: PANE top 3: pancreatitis, inguinal hernia, cholecystitis (epigastric pain + radiation to back = pancreatitis pattern); no dissection node. Symptom inference ranks ruptured AAA #1 and does not list dissection in the top 5.]
- `aortic-dissection-epigastric-back-pain` / **inv-ct-angiography** (web, FAIL (known gap)): no investigation matched among 28 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol (I71.0) and no prompt suggests CT angiography.]
- `aortoenteric-fistula-herald-bleed` / **mnm-aortoenteric-fistula** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Inguinal / Femoral Hernia \| 3. Acute Cholecystitis; also in web.passive#1 [known gap: PANE top 3: pancreatitis, inguinal hernia, cholecystitis; no aorto-enteric fistula node anywhere. The passive ranking lists "ruptured abdominal aortic aneurysm" #1 from exam text.]
- `aortoenteric-fistula-herald-bleed` / **flag-aortic-graft** (web, FAIL (known gap)): no red flag matched among 14 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: Surgical history (aortic graft) is not read by any red-flag rule; triage only scores the bleed.]
- `aortoenteric-fistula-herald-bleed` / **inv-ct-angiography** (web, FAIL (known gap)): no investigation matched among 26 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol (no ICD/PANE match) and the GI-bleed prompt only offers OGD/colonoscopy.]
- `aortoenteric-fistula-herald-bleed` / **mgmt-vascular-surgery** (web, FAIL (known gap)): no management item matched among 9 (web.clinicalPrompts) [known gap: No output mentions vascular surgery.]
- `appendicitis-elderly-atypical` / **mnm-mesenteric-ischaemia** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis; also in web.symptomInference#3, web.passive#4 [known gap: PANE top 3 (cholecystitis, appendicitis, appendix mass) omits it; symptom inference ranks it #3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- `appendicitis-pregnant-t2` / **inv-mri-after-inconclusive-us** (web, FAIL (known gap)): no investigation matched among 42 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: Neither the iOS radiation card nor the web appendicitis protocol mentions MRI; CT with contrast is the only second-line imaging offered.]
- `appendicitis-pregnant-t2` / **mgmt-no-nsaid-after-20-weeks** (web, FAIL (known gap)): forbidden management item present in web.clinicalPrompts: "... convert to oral when tolerating po. • paracetamol 1g qds + ibuprofen 400mg tds (regular). • morphine 5mg prn if pain > 5/10. • regular diet as toler..." [known gap: Web appendicectomy operative-plan prompt orders 'Paracetamol 1g QDS + Ibuprofen 400mg TDS (regular)' for a 22-week pregnant patient.]
- `boerhaave-classic-mackler` / **dx-perforation-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Inguinal / Femoral Hernia \| 3. Acute Cholecystitis [known gap: PANE top 3: pancreatitis, inguinal hernia, cholecystitis. Subcutaneous emphysema, chest_pain_oesophageal and vomiting_effortless never reach PANE (no SOCRATES rules; radiation "Back" gives radiation_to_back → pancreatitis). Symptom inference ranks STEMI/ACS first.]
- `boerhaave-presenting-as-chest-pain` / **mnm-perforation** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. Acute Pancreatitis [known gap: PANE top 3: inguinal hernia, cholecystitis, pancreatitis; no oesophageal features reach PANE. Symptom inference ranks STEMI/ACS first and has no perforation entry.]
- `boerhaave-presenting-as-chest-pain` / **inv-ecg** (web, FAIL (known gap)): no investigation matched among 31 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: No investigation output mentions an ECG: the triage chest_pain pathway checklist ("ECG within 10 minutes") is not surfaced, and the oesophageal_perforation protocol omits it.]
- `boerhaave-presenting-as-pancreatitis` / **mnm-perforation** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis [known gap: PANE top 3: pancreatitis, cholecystitis, GORD; symptom inference: alcoholic/gallstone pancreatitis, peptic ulcer, perforated ulcer. Oesophageal perforation is absent from every list.]
- `breast-inflammatory-cancer` / **mgmt-no-bcs-or-slnb** (web, FAIL (known gap)): forbidden management item present in web.plan: "[surgical] wide local excision (breast-conserving) + slnb or axillary clearance." (+2 more) [known gap: The C50 plan comes from the generic invasive_ductal_carcinoma protocol, which offers "Wide local excision (breast-conserving) + SLNB" first; the protocol lists inflammatory breast cancer as a red flag but has no IBC branch.]
- `breast-lump-age-30-35` / **flag-2ww** (web, FAIL (known gap)): no red flag matched among 6 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: The suspected-cancer referral is triggered (age ≥30 + breast lump) but labelled "Cancer screening triggered (colorectal)". cancer-screening.ts labels every triggered screen "colorectal": the colorectal block tests `c.met && c.rule.includes('colorectal') \|\| c.rule.includes('bowel') \|\| …` (operator precedence), which is true whenever any colorectal rule exists, and the breast block keeps the first label (cancerType ?? "breast").]
- `breast-lump-age-30-35` / **inv-uss** (web, FAIL (known gap)): no investigation matched among 11 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]
- `breast-lump-age-30-35` / **inv-core-biopsy** (web, FAIL (known gap)): no investigation matched among 11 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]
- `breast-lump-over-35-suspicious` / **flag-2ww** (web, FAIL (known gap)): no red flag matched among 9 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: Triggered but labelled colorectal. cancer-screening.ts labels every triggered screen "colorectal": the colorectal block tests `c.met && c.rule.includes('colorectal') \|\| c.rule.includes('bowel') \|\| …` (operator precedence), which is true whenever any colorectal rule exists, and the breast block keeps the first label (cancerType ?? "breast").]
- `breast-lump-pregnant` / **flag-2ww** (web, FAIL (known gap)): no red flag matched among 11 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: Triggered but labelled colorectal. cancer-screening.ts labels every triggered screen "colorectal": the colorectal block tests `c.met && c.rule.includes('colorectal') \|\| c.rule.includes('bowel') \|\| …` (operator precedence), which is true whenever any colorectal rule exists, and the breast block keeps the first label (cancerType ?? "breast").]
- `breast-lump-pregnant` / **inv-uss** (web, FAIL (known gap)): no investigation matched among 12 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]
- `breast-lump-pregnant` / **inv-core-biopsy** (web, FAIL (known gap)): no investigation matched among 12 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]
- `breast-lump-under-30` / **inv-uss** (web, FAIL (known gap)): no investigation matched among 11 (web.pane.seeded, web.clinicalPrompts) [known gap: No breast ultrasound in any output. The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]
- `breast-male-cancer` / **mnm-carcinoma** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Gynaecomastia \| 3. Acute Cholecystitis; also in web.symptomInference#1, web.passive#2, web.triageSurgical#3 [known gap: PANE top 3 = inguinal hernia (male x5 prior), gynaecomastia, cholecystitis: every breast disease except gynaecomastia is multiplied by 0.05 in men, so male breast cancer cannot rank.]
- `breast-male-cancer` / **flag-2ww** (web, FAIL (known gap)): no red flag matched among 10 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: Triggered but labelled colorectal. cancer-screening.ts labels every triggered screen "colorectal": the colorectal block tests `c.met && c.rule.includes('colorectal') \|\| c.rule.includes('bowel') \|\| …` (operator precedence), which is true whenever any colorectal rule exists, and the breast block keeps the first label (cancerType ?? "breast").]
- `breast-nipple-discharge-bloody-single-duct` / **mnm-malignancy** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE applied no feature: the "Nipple discharge" template has no CC hint and ASSOC_RULES has no nipple-discharge pattern, so the priors alone give cholecystitis, GORD, PUD.]
- `breast-nipple-discharge-bloody-single-duct` / **flag-2ww** (web, FAIL (known gap)): no red flag matched among 7 (web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: screenForCancer only counts nipple discharge together with a lump; NICE NG12 (≥50, unilateral nipple discharge) is not implemented. Triage score 0, routine.]
- `breast-nipple-discharge-bloody-single-duct` / **inv-mammogram** (web, FAIL (known gap)): no investigation matched among 19 (web.pane.seeded, web.clinicalPrompts) [known gap: N64.52 maps to no protocol and PANE did not reach duct_ectasia, so no imaging is proposed.]
- `breast-nipple-discharge-bloody-single-duct` / **inv-uss** (web, FAIL (known gap)): no investigation matched among 19 (web.pane.seeded, web.clinicalPrompts) [known gap: As above: no retroareolar ultrasound proposed.]
- `cholangitis-tg18-charcot-sepsis` / **score-tg18-calculator** (web, FAIL (known gap)): expected = 2; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: Web clinical-scores.ts (ClinicalScoresPanel) omits the WBC criterion from the Grade II count and returns Grade I; clinical-scales.ts is correct here.]
- `cholangitis-tg18-grade3-reynolds` / **score-tg18-autofill** (web, FAIL (known gap)): expected = 3; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill never sets organ-dysfunction fields (returns Grade II from age/temperature/WBC/bilirubin); web returns "criteria not met".]
- `cholecystitis-tg18-grade2` / **score-tg18-calculator** (web, FAIL (known gap)): expected = 2; got web.scoreCalculator.tg18-cholecystitis=1 (Mild cholecystitis — elective laparoscopic cholecystectomy) [known gap: Neither calculator has a "palpable tender RUQ mass" Grade II criterion (iOS folds it into Grade I local signs; web grades II only on WBC >18).]
- `cholecystitis-tg18-grade3-organ-dysfunction` / **score-tg18-autofill** (web, FAIL (known gap)): expected = 3; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill ignores the organ-dysfunction data in the record (SBP 82 on noradrenaline, AVPU C, creatinine 238, platelets 88) and returns Grade II from WBC alone; web returns "criteria not met".]
- `cholecystitis-tg18-grade3-organ-dysfunction` / **mgmt-no-penicillin-in-anaphylaxis** (web, FAIL (known gap)): forbidden management item present in web.plan: "[immediate] iv antibiotics: co-amoxiclav 1.2 g tds or piperacillin-tazobactam for severe." (+5 more) [known gap: Plan templates suggest co-amoxiclav / piperacillin-tazobactam regardless of the recorded penicillin anaphylaxis.]
- `dysphagia-progressive-over55` / **dx-oesophageal-cancer-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Inguinal / Femoral Hernia \| 3. Hiatus Hernia; also in web.symptomInference#1, web.passive#2 [known gap: PANE top 3: GORD, inguinal hernia, hiatus hernia. PANE never gets dysphagia_progressive: the "Dysphagia" CC template has no CC hint and the iOS dysphagia chip set has no "Dysphagia" association to scan, so only weight_loss/regurgitation/heartburn reach it; the male hernia prior modifier does the rest. Symptom inference ranks oesophageal/gastric carcinoma #1.]
- `eoe-young-atopic-recurrent-bolus` / **inv-oesophageal-biopsies** (web, FAIL (known gap)): no investigation matched among 10 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for K20.0 and nothing else asks for biopsies.]
- `food-bolus-complete-obstruction` / **level-emergency** (web, FAIL (known gap)): web.triage: urgent (acuity=priority, action=same_day_call, score=63); expected ≥ emergency [known gap: Same-day call (urgent), not emergency: triage has no rule for "cannot swallow saliva"/drooling (APCQ grades saliva-only dysphagia as emergency, adaptiveTriage does not).]
- `food-bolus-complete-obstruction` / **mgmt-endoscopic-removal** (web, FAIL (known gap)): no management item matched among 1 (web.clinicalPrompts) [known gap: No protocol for T18.1 (food bolus); the matchPathways registry has a "Foreign Body Ingestion / Food Bolus" pathway but it is not surfaced in management.]
- `gastric-outlet-obstruction-elderly` / **dx-goo-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#5, web.passive#2 [known gap: PANE top 3: inguinal hernia, cholecystitis, GORD. The vomiting_effortless feature (GOO 0.90) is never set: no SOCRATES rule maps projectile vomiting or vomiting of undigested food.]
- `gord-alarm-weight-loss-over55` / **mnm-malignancy** (web, FAIL (known gap)): not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Hiatus Hernia \| 3. Peptic Ulcer Disease; also in web.symptomInference#2, web.passive#2 [known gap: PANE top 3: GORD, hiatus hernia, peptic ulcer (the "GORD / heartburn" template hint pushes GORD; weight loss does not lift a carcinoma into the top 3). Symptom inference lists gastric carcinoma #3.]
- `groin-mimic-femoral-artery-aneurysm` / **mnm-aneurysm** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Acute Cholecystitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = inguinal hernia, GORD, cholecystitis. PANE has only "Aortic Aneurysm" and no pulsatile-mass feature; the symptom engine ranks AAA #1 from the "pulsatile mass" chip. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `groin-mimic-femoral-artery-aneurysm` / **flag-pulsatile** (web, FAIL (known gap)): no red flag matched among 12 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative) [known gap: No red flag or alarm for a pulsatile groin mass: triage has no pulsatile/aneurysm rule and the prompts have none.]
- `groin-mimic-femoral-artery-aneurysm` / **inv-duplex-or-cta** (web, FAIL (known gap)): no investigation matched among 22 (web.pane.seeded, web.clinicalPrompts) [known gap: No duplex/CT angiography proposed; I72.4 has no protocol.]
- `groin-mimic-femoral-artery-aneurysm` / **mgmt-no-hernia-repair** (web, FAIL (known gap)): forbidden management item present in web.managementPanel: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Assessment ManagementPanel follows the PANE top disease (≥0.20), which is the inguinal hernia because the only groin CC template is "Inguinal / groin hernia" and site "groin" maps to groin_swelling; the surgeon's confirmed diagnosis (ICD) is not used for the panel while PANE is ≥0.20. The panel shows the Lichtenstein/TEP/TAPP repair and the TAPP operative-plan prompt fires from the CC template name.]
- `groin-mimic-lymphadenopathy` / **mnm-lymphoma-or-nodes** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = inguinal hernia, cholecystitis, GORD. PANE has no lymphadenopathy feature from the groin site and its only node disease is "Cervical Lymphadenopathy"; the symptom engine ranks lymphoma #1. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `groin-mimic-lymphadenopathy` / **inv-uss-or-biopsy** (web, FAIL (known gap)): no investigation matched among 22 (web.pane.seeded, web.clinicalPrompts) [known gap: No groin ultrasound or node biopsy is proposed; the confirmed ICD R59.1 has no protocol (R59.9 → cervical lymphadenopathy only).]
- `groin-mimic-lymphadenopathy` / **mgmt-no-hernia-repair** (web, FAIL (known gap)): forbidden management item present in web.managementPanel: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Assessment ManagementPanel follows the PANE top disease (≥0.20), which is the inguinal hernia because the only groin CC template is "Inguinal / groin hernia" and site "groin" maps to groin_swelling; the surgeon's confirmed diagnosis (ICD) is not used for the panel while PANE is ≥0.20. The panel shows "Elective: Lichtenstein mesh herniorrhaphy … TEP/TAPP" and the TAPP prompt fires from the CC template name.]
- `groin-mimic-testicular-torsion` / **dx-torsion-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Appendicitis \| 3. Epididymo-orchitis; also in web.symptomInference#1, web.passive#1 [known gap: As above: torsion not in the PANE top 3; epididymo-orchitis ranks above it.]
- `groin-mimic-testicular-torsion` / **mnm-torsion** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Appendicitis \| 3. Epididymo-orchitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = inguinal hernia, appendicitis, epididymo-orchitis: testicular_torsion (prior 0.01) is outranked although testicular_pain/scrotal_swelling are applied; vomiting and "sudden" onset are not mapped to features. The safety prompt and the ICD plan (N44.00 → testicular_torsion) are correct.]
- `groin-mimic-testicular-torsion` / **mgmt-no-hernia-repair** (web, FAIL (known gap)): forbidden management item present in web.managementPanel: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Assessment ManagementPanel follows the PANE top disease (≥0.20), which is the inguinal hernia because the only groin CC template is "Inguinal / groin hernia" and site "groin" maps to groin_swelling; the surgeon's confirmed diagnosis (ICD) is not used for the panel while PANE is ≥0.20. The PANE top (inguinal hernia 0.22) drives the ManagementPanel, so an elective mesh repair is shown next to the emergency exploration plan.]
- `h-pylori-penicillin-anaphylaxis` / **mgmt-no-amoxicillin** (web, FAIL (known gap)): forbidden management item present in web.plan: "[conservative] h. pylori eradication: triple therapy (ppi + amoxicillin + clarithromycin × 7 days); confirm eradication with breath test at 4 weeks." (+1 more) [known gap: Gastritis protocol plan line and medications list amoxicillin despite a recorded penicillin anaphylaxis (the allergy shows only in the header).]
- `hernia-femoral-elderly-woman` / **dx-femoral-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Diverticulitis [known gap: PANE top 3 = cholecystitis, GORD, diverticulitis; femoral_hernia is not listed despite groin_swelling. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `hernia-femoral-richter-obstruction` / **mnm-hernia-cause** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Bowel Obstruction; also in web.triageSurgical#1 [known gap: PANE top 3 = cholecystitis, appendicitis, bowel obstruction (from the abdominal-pain template). No hernia: groin findings are only in exam text/chips, which PANE does not read. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `hernia-groin-incarcerated` / **variant-incarcerated** (web, FAIL (known gap)): detected hernia_reducible in group Hernia; expected hernia_incarcerated [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: "Irreducible inguinal hernia" contains the hernia_reducible keyword "reducible inguinal", so the plan gets the ELECTIVE prefix ("Day-case laparoscopic repair preferred") and loses the immediate/conservative phases.]
- `hernia-groin-strangulated` / **variant-strangulated** (web, FAIL (known gap)): detected hernia_incarcerated in group Hernia; expected hernia_strangulated [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: the assessment says "strangulated" and "irreducible"; hernia_incarcerated is checked before hernia_strangulated, so the plan says "Attempt gentle manual reduction" (contraindicated in strangulation).]
- `hernia-incisional-midline-elective` / **dx-incisional-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Diverticulitis; also in web.triageSurgical#1 [known gap: PANE applied no feature: the "Incisional / ventral hernia" template has no CC hint and the site chip "Incisional" matches no SITE_RULES pattern; the priors alone rank cholecystitis first.]
- `hernia-inguinal-female-occult-femoral` / **mnm-femoral-hernia** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease [known gap: PANE top 3 = cholecystitis, GORD, PUD. The female modifier cuts inguinal_hernia to x0.3 and cholecystitis is x2 in women; femoral_hernia (prior 0.02) never reaches the list. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `hernia-obturator-sbo-elderly-woman` / **mnm-obturator-hernia** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Bowel Obstruction [known gap: PANE top 3 = cholecystitis, appendicitis, bowel obstruction (periumbilical site maps to rlq_pain). obturator_hernia (prior 0.005) has no discriminating feature (no medial-thigh / Howship-Romberg feature, no "virgin abdomen" feature), and no web engine names it.]
- `hernia-paediatric-incarcerated-infant` / **dx-hernia-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1, web.triageSurgical#1 [known gap: PANE top 3 = cholecystitis, appendicitis, PUD for a 7-month-old girl (female inguinal x0.3; no age modifier removes adult biliary disease in infants). PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `hernia-paediatric-inguinal-infant` / **mgmt-no-watchful-waiting** (web, FAIL (known gap)): forbidden management item present in web.plan: "[conservative] truss may be offered for unfit patients declining surgery - monitor for strangulation..." (+1 more) [known gap: The inguinal_hernia protocol has no paediatric branch: the plan offers "Truss may be offered for unfit patients declining surgery".]
- `hernia-paediatric-inguinal-infant` / **mgmt-no-adult-mesh-repair** (web, FAIL (known gap)): forbidden management item present in web.plan: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+5 more) [known gap: Adult plan for a 4-month-old: "Lichtenstein mesh herniorrhaphy … TEP/TAPP" (protocol) and computeClinicalPrompts fires the hernia pathway for any CC/exam containing "hernia", "inguinal" or "umbilical", and always attaches the adult "LAPAROSCOPIC INGUINAL HERNIA REPAIR (TAPP)" operative plan.]
- `hernia-paraumbilical-incarcerated-obese` / **dx-umbilical-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = cholecystitis, GORD, PUD (female: inguinal x0.3, cholecystitis x2). PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `hernia-umbilical-adult-elective` / **dx-umbilical-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis [known gap: PANE top 3 = inguinal hernia (male x5), cholecystitis, GORD; umbilical_hernia (0.03, umbilical_swelling 0.90) is outranked. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `hernia-umbilical-cirrhosis-ascites` / **flag-rupture-risk** (web, FAIL (known gap)): no red flag matched among 18 (web.triage.reasons, web.protocol.redFlags, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative) [known gap: No web output mentions rupture/skin ulceration/leak for an umbilical hernia with ascites; the umbilical protocol red flag is only "Irreducible or tender".]
- `hernia-umbilical-cirrhosis-ascites` / **mgmt-ascites-control** (web, FAIL (known gap)): no management item matched among 33 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No ascites-control / hepatology step in the umbilical_hernia protocol, the dx variant or the prompts.]
- `iron-deficiency-anaemia-over60` / **flag-ida** (web, FAIL (known gap)): no red flag matched among 9 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: Nothing reads the anaemia indices: severe_anaemia prompt needs Hb <8; the NG12 IDA criterion in cancer-screening needs the words "anaemia/pale/unusually tired" in the symptom chips. Hb 9.1 / MCV 72 / ferritin 6 raise nothing.]
- `iron-deficiency-anaemia-over60` / **inv-colonoscopy** (web, FAIL (known gap)): no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for D50.9 and no IDA prompt; colonoscopy never suggested.]
- `mi-presenting-as-epigastric-pain` / **mnm-acs** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Peptic Ulcer Disease \| 3. GORD / Reflux Oesophagitis [known gap: PANE has no cardiac disease; top 3 cholecystitis, peptic ulcer, GORD.]
- `mi-presenting-as-epigastric-pain` / **level-emergency** (web, FAIL (known gap)): web.triage: urgent (acuity=priority, action=same_day_call, score=33); expected ≥ emergency [known gap: Same-day call only (score 33): CHEST_PAIN_TERMS and the cardiac red flag need the words "chest pain/crushing/left arm/jaw"; epigastric pain with sweating in a diabetic scores age and comorbidity only.]
- `mi-presenting-as-epigastric-pain` / **alarm-cardiac** (web, FAIL (known gap)): no alarm matched among 3 (web.clinicalPrompts.safety) [known gap: Safety prompts fired are "Appendicitis — emergency surgical indication" (from "Acute abdominal pain" CC) and "Acute abdominal presentation"; nothing cardiac.]
- `mi-presenting-as-epigastric-pain` / **inv-ecg** (web, FAIL (known gap)): no investigation matched among 25 (web.pane.seeded, web.clinicalPrompts) [known gap: No ECG in any output.]
- `mi-presenting-as-epigastric-pain` / **inv-troponin** (web, FAIL (known gap)): no investigation matched among 25 (web.pane.seeded, web.clinicalPrompts) [known gap: No troponin in any output.]
- `parathyroid-hypercalcaemic-crisis` / **mnm-hypercalcaemia** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Diverticulitis; also in web.symptomInference#2, web.passive#3 [known gap: PANE applied no feature ("Nausea / vomiting" template, SOCRATES empty); calcium is a lab value. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `parathyroid-hypercalcaemic-crisis` / **mgmt-no-thyroidectomy-template** (web, FAIL (known gap)): forbidden management item present in web.plan: "total thyroidectomy" (+1 more) [known gap: Same dx-variant substring bug: the crisis plan opens with the elective Total Thyroidectomy template.]
- `parathyroid-primary-hpt-surgical-indications` / **mgmt-no-thyroidectomy-template** (web, FAIL (known gap)): forbidden management item present in web.plan: "total thyroidectomy" (+1 more) [known gap: detectDxVariants falls back to lower.includes("thyroid") for the Thyroid group: "parathyroidectomy"/"hyperparathyroidism" contain "thyroid", and "parathyroidectomy" contains the thyroid_total keyword "thyroidectomy", so the documented plan opens with "Total Thyroidectomy … levothyroxine replacement (lifelong)".]
- `thyroid-bethesda-1-nondiagnostic` / **mgmt-no-thyroidectomy-plan** (web, FAIL (known gap)): forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" fires on any radiology result containing "bethesda" (any category) and attaches the TOTAL THYROIDECTOMY operative plan. Here after a non-diagnostic FNA.]
- `thyroid-bethesda-2-benign` / **mgmt-no-thyroidectomy-plan** (web, FAIL (known gap)): forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" fires on any radiology result containing "bethesda" (any category) and attaches the TOTAL THYROIDECTOMY operative plan. Here for benign cytology (rationale text: "Bethesda class III–VI or clinical thyroid malignancy").]
- `thyroid-bethesda-6-papillary-cn1b` / **mgmt-no-hemithyroidectomy-prefix** (web, FAIL (known gap)): forbidden management item present in web.plan: "hemithyroidectomy (ipsilateral lobe + isthmus). intraoperative recurrent laryngeal nerve neuromonitoring." [known gap: Consequence of the variant bug: the plan opens with "Hemithyroidectomy (ipsilateral lobe + isthmus)" above the protocol's total-thyroidectomy steps.]
- `thyroid-bethesda-6-papillary-cn1b` / **variant-thyroid-total** (web, FAIL (known gap)): detected thyroid_hemithyroidectomy in group Thyroid; expected thyroid_total [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: "bethesda vi" contains the hemithyroidectomy keyword "bethesda v", so cN1b papillary carcinoma gets the hemithyroidectomy plan prefix.]
- `thyroid-nodule-euthyroid-tirads4` / **dx-thyroid-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#2, web.triageSurgical#2 [known gap: PANE top 3 = cholecystitis, GORD, PUD after neck_lump (thyroid_nodule_benign prior 0.03, thyroid_carcinoma 0.01). PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- `thyroid-post-op-hypocalcaemia` / **level-at-least-urgent** (web, FAIL (known gap)): web.triage: priority (acuity=review, action=priority_24_48h, score=25); expected ≥ urgent [known gap: Triage priority_24_48h (score 25, post-op only): no rule for tingling/tetany/hypocalcaemia and lab values are not read by adaptiveTriage.]
- `thyroid-post-op-hypocalcaemia` / **flag-hypocalcaemia** (web, FAIL (known gap)): no red flag matched among 6 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: No web engine reads the adjusted calcium 1.78 mmol/L or the symptoms; E89.2 maps to no protocol.]
- `thyroid-post-op-hypocalcaemia` / **mgmt-iv-calcium** (web, FAIL (known gap)): no management item matched among 5 (web.clinicalPrompts) [known gap: No IV calcium gluconate anywhere (only inside the elective thyroidectomy operative template, which does not fire here).]
- `thyroid-post-op-neck-haematoma` / **dx-haematoma-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Surgical Site Infection (SSI) \| 3. GORD / Reflux Oesophagitis [known gap: PANE top 3 = cholecystitis, surgical site infection, GORD: the "Post-op wound concern" template hints wound_erythema/wound_discharge (infection features), and no neck-swelling feature exists. The T81.0 plan itself is correct (bedside wound opening).]
- `thyroid-rapid-enlargement-stridor` / **mnm-anaplastic-or-lymphoma** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Colorectal Cancer \| 3. GORD / Reflux Oesophagitis [known gap: PANE has no anaplastic thyroid carcinoma or thyroid lymphoma disease; top 3 = cholecystitis, colorectal cancer, GORD. The thyroid_carcinoma protocol is papillary-oriented.]
- `thyroid-rapid-enlargement-stridor` / **inv-core-biopsy** (web, FAIL (known gap)): no investigation matched among 35 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: Only FNAC is proposed (protocol and prompt); no core/open biopsy to distinguish anaplastic carcinoma from lymphoma.]
- `thyroid-rapid-enlargement-stridor` / **mgmt-airway** (web, FAIL (known gap)): no management item matched among 48 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No airway step in any web output: triage has no stridor rule (the emergency comes from RR/SpO2), prompts have no airway rule, and the C73 protocol lists stridor only as a red flag.]
- `thyroid-retrosternal-goitre-compression` / **flag-compression** (web, FAIL (known gap)): no red flag matched among 16 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: No red flag names tracheal compression, stridor or retrosternal extension; triage escalates only because "breathless" matches the post-operative-concern rule. E04.2 maps to no protocol.]
- `ugib-cvd-dual-antiplatelet` / **dx-ugib-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#5, web.triageSurgical#1 [known gap: PANE top 3: inguinal hernia, cholecystitis, GORD. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1.]
- `ugib-cvd-dual-antiplatelet` / **mgmt-no-tranexamic-acid** (web, FAIL (known gap)): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]
- `ugib-elderly-doac-pre-endoscopy-rockall` / **mgmt-no-lmwh-bridging** (web, FAIL (known gap)): forbidden management item present in web.clinicalPrompts: "...dging: hold doac 48-72h pre-op (renal-adjusted); warfarin - bridge with lmwh per haematology protocol." [known gap: computeClinicalPrompts anticoag_check (any anticoagulant) adds the elective peri-operative plan line "hold DOAC 48–72h pre-op; warfarin — bridge with LMWH per haematology protocol" to an actively bleeding patient.]
- `ugib-elderly-doac-pre-endoscopy-rockall` / **mgmt-no-tranexamic-acid** (web, FAIL (known gap)): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]
- `ugib-melaena-only-woman` / **mgmt-no-tranexamic-acid** (web, FAIL (known gap)): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]
- `ugib-nonvariceal-gbs-high` / **dx-ugib-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Inguinal / Femoral Hernia \| 3. Acute / Chronic Gastritis; also in web.symptomInference#1, web.passive#2, web.triageSurgical#1 [known gap: PANE top 3: GORD, inguinal hernia, gastritis. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1.]
- `ugib-nonvariceal-gbs-high` / **mgmt-no-tranexamic-acid** (web, FAIL (known gap)): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]
- `ugib-nonvariceal-gbs-low-outpatient` / **mgmt-no-tranexamic-acid** (web, FAIL (known gap)): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]
- `ugib-nonvariceal-unstable-shock` / **dx-ugib-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#2, web.triageSurgical#1 [known gap: PANE top 3: inguinal hernia, cholecystitis, GORD. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1.]
- `ugib-nonvariceal-unstable-shock` / **mgmt-no-tranexamic-acid** (web, FAIL (known gap)): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]
- `ugib-on-warfarin-high-inr` / **mgmt-no-lmwh-bridging** (web, FAIL (known gap)): forbidden management item present in web.clinicalPrompts: "...dging: hold doac 48-72h pre-op (renal-adjusted); warfarin - bridge with lmwh per haematology protocol." [known gap: computeClinicalPrompts anticoag_check (any anticoagulant) adds the elective peri-operative plan line "hold DOAC 48–72h pre-op; warfarin — bridge with LMWH per haematology protocol" to an actively bleeding patient.]
- `ugib-on-warfarin-high-inr` / **mgmt-no-tranexamic-acid** (web, FAIL (known gap)): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]
- `upper-abdominal-pain-weight-loss-over55` / **dx-gastric-cancer-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Peptic Ulcer Disease \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#1, web.triageSurgical#1 [known gap: PANE top 3: cholecystitis, peptic ulcer, GORD — weight_loss/anorexia do not outweigh the cholecystitis prior (×2 female, ×1.6 age 30–70). Symptom inference, passive ranking and triageSurgical all rank gastric carcinoma #1.]
- `variceal-bleed-known-cirrhosis` / **dx-ugib-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#1, web.passive#4, web.triageSurgical#1 [known gap: PANE top 3: inguinal hernia, GORD, appendicitis. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1. PANE also has no variceal node.]
- `variceal-bleed-known-cirrhosis` / **mgmt-vasoactive** (web, FAIL (known gap)): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- `variceal-bleed-known-cirrhosis` / **mgmt-antibiotic-prophylaxis** (web, FAIL (known gap)): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- `variceal-bleed-known-cirrhosis` / **mgmt-endoscopy-12h** (web, FAIL (known gap)): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- `variceal-bleed-known-cirrhosis` / **mgmt-band-ligation** (web, FAIL (known gap)): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- `variceal-bleed-unrecognised-cirrhosis` / **dx-ugib-top3** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#2, web.triageSurgical#1 [known gap: PANE top 3: cholecystitis, GORD, appendicitis. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1.]
- `variceal-bleed-unrecognised-cirrhosis` / **mgmt-vasoactive** (web, FAIL (known gap)): no management item matched among 21 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- `variceal-bleed-unrecognised-cirrhosis` / **mgmt-antibiotic-prophylaxis** (web, FAIL (known gap)): no management item matched among 21 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]

## Results by condition and permutation

### Pseudoachalasia (gastric cardia carcinoma)

#### `achalasia-pseudoachalasia-elderly` — Age 71, short history, rapid weight loss — pseudoachalasia (cardia cancer)

71-year-old man with 4 months of dysphagia to solids and liquids, regurgitation and 10 kg weight loss. Short history + age + weight loss = pseudoachalasia from a cardia cancer until proven otherwise.

Permutation of `achalasia-young`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-malignancy | mustNotMiss | critical | FAIL (known gap) | European guidelines on achalasia 2020; NICE NG12 2015 | socrates-to-features.ts: CC hint /dysphag\|swallow/ → dysphagia_progressive. |
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| flag-dysphagia-cancer | redFlags | critical | PASS | NICE NG12 2015 |  |
| inv-ogd | investigationInclude | critical | PASS | European guidelines on achalasia 2020; NICE NG12 2015 |  |
| inv-ct | investigationInclude | quality | PASS | European guidelines on achalasia 2020 |  |
| mgmt-no-myotomy-before-malignancy-excluded | managementExclude | quality | PASS | European guidelines on achalasia 2020 |  |

Failure details:

- **mnm-malignancy** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3: inguinal hernia, GORD, peptic ulcer (male prior modifier; no dysphagia feature). Symptom inference ranks occult malignancy and oesophageal/gastric carcinoma #1–2.]

Guidelines:

- **achalasia-2020** — European guidelines on achalasia — UEG and ESNM recommendations (2020), Pseudoachalasia: suspect with older age, short symptom duration and marked weight loss; endoscopy (with retroflexion) and cross-sectional imaging/EUS before achalasia treatment. Oude Nijhuis RAB, Zaninotto G, Roman S, et al. United European Gastroenterol J. 2020;8:13–33. *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Dysphagia (any age) or age ≥55 with weight loss: urgent OGD. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Occult malignancy / systemic disease; 2. Oesophageal / gastric carcinoma; 3. Colorectal carcinoma; 4. Gastric carcinoma; 5. GORD / acid reflux / oesophagitis
- differential web.passive: 1. Oesophageal / gastric carcinoma; 2. Occult malignancy / systemic disease; 3. GORD / acid reflux / oesophagitis; 4. Gastric carcinoma; 5. Colorectal carcinoma
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 3. GORD with oesophagitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=92)
- alarms: Emergency now [web.triage.emergency]; Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, web:gerdq, cfs, ecog
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, weight_loss, regurgitation
- note: AssessmentTab ManagementPanel protocol: gastric_carcinoma (from ICD)
- note: PlanTab protocol: gastric_carcinoma (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (17), Foreign Body Ingestion / Food Bolus (7)

</details>

### Achalasia

#### `achalasia-young` — 

34-year-old woman with 2 years of dysphagia to both solids and liquids, regurgitation of undigested food, nocturnal cough and 5 kg weight loss. OGD first (exclude pseudoachalasia), then high-resolution manometry and timed barium swallow.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| flag-dysphagia | redFlags | critical | PASS | NICE NG12 2015 |  |
| inv-ogd | investigationInclude | critical | PASS | European guidelines on achalasia 2020; NICE NG12 2015 |  |
| dx-achalasia-top3 | mustRankTopK | quality | FAIL (known gap) | European guidelines on achalasia 2020 | socrates-to-features.ts: CC hint /dysphag\|swallow/ → dysphagia_progressive. |
| inv-manometry | investigationInclude | quality | PASS | European guidelines on achalasia 2020 |  |
| inv-barium-swallow | investigationInclude | quality | PASS | European guidelines on achalasia 2020 |  |
| mgmt-definitive-options | managementInclude | quality | PASS | European guidelines on achalasia 2020 |  |

Failure details:

- **dx-achalasia-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Hiatus Hernia [known gap: PANE top 3: cholecystitis, appendicitis, hiatus hernia — only weight_loss and regurgitation reach PANE (no dysphagia feature, see dysphagia gap).]

Guidelines:

- **achalasia-2020** — European guidelines on achalasia — UEG and ESNM recommendations (2020), Endoscopy to exclude malignancy/pseudoachalasia; high-resolution manometry for diagnosis (Chicago classification); timed barium oesophagogram; treatment by pneumatic dilation, laparoscopic Heller myotomy or POEM. Oude Nijhuis RAB, Zaninotto G, Roman S, et al. United European Gastroenterol J. 2020;8:13–33. *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Dysphagia at any age: urgent direct-access OGD. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Appendicitis; 3. Hiatus Hernia
- differential web.symptomInference: 1. Oesophageal / gastric carcinoma; 2. Occult malignancy / systemic disease; 3. Gastric carcinoma; 4. GORD / acid reflux / oesophagitis; 5. Colorectal carcinoma
- differential web.passive: 1. Oesophageal / gastric carcinoma; 2. GORD / acid reflux / oesophagitis; 3. Occult malignancy / systemic disease; 4. Gastric carcinoma; 5. Colorectal carcinoma
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Unexplained weight loss / GI alarm symptoms — endoscopy workup
- emergency level: emergency (acuity=urgent, action=emergency_now, score=120)
- alarms: Emergency now [web.triage.emergency]; Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, web:gerdq, curb65
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: weight_loss, regurgitation
- note: AssessmentTab ManagementPanel protocol: achalasia (from ICD)
- note: PlanTab protocol: achalasia (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (12), Foreign Body Ingestion / Food Bolus (7), Chest Pain — Emergency Redirect (5)

</details>

### Adrenal incidentaloma (indeterminate, hypertensive)

#### `adrenal-incidentaloma-indeterminate` — 

52-year-old man with a 3.2 cm left adrenal mass found on CT for renal colic; unenhanced attenuation 28 HU (indeterminate); hypertension on two drugs and K 3.3. ESE 2023: 1 mg dexamethasone suppression test, metanephrines (HU >10), aldosterone/renin (hypertension + hypokalaemia); further imaging; no biopsy.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| inv-metanephrines | investigationInclude | critical | PASS | ESE/ENSAT guidelines 2023; Endocrine Society guideline 2014 |  |
| inv-no-adrenal-biopsy | investigationExclude | critical | PASS | ESE/ENSAT guidelines 2023 |  |
| level-not-emergency | emergencyLevel | quality | PASS |  |  |
| inv-dst | investigationInclude | quality | PASS | ESE/ENSAT guidelines 2023 |  |
| inv-arr | investigationInclude | quality | PASS | ESE/ENSAT guidelines 2023 |  |
| inv-further-imaging | investigationInclude | quality | PASS | ESE/ENSAT guidelines 2023 |  |

Guidelines:

- **ese-adrenal-2023** — ESE/ENSAT guidelines — adrenal incidentalomas (2023 update) (2023), Imaging (unenhanced CT HU ≤10 benign; indeterminate masses); hormonal work-up (1 mg dexamethasone suppression test in all; plasma/urine metanephrines unless HU ≤10; aldosterone/renin in hypertension or hypokalaemia); no adrenal biopsy before phaeochromocytoma is excluded; surgery for indeterminate or functioning masses. Fassnacht M, Tsagarakis S, Terzolo M, et al. European Society of Endocrinology clinical practice guidelines on the management of adrenal incidentalomas, in collaboration with the European Network for the Study of Adrenal Tumors. Eur J Endocrinol. 2023;189:G1–G42. *(statement wording/numbering not yet verified against the source)*
- **es-phaeo-2014** — Endocrine Society guideline — phaeochromocytoma and paraganglioma (2014), Biochemical testing (plasma free or urinary fractionated metanephrines); pre-operative alpha-adrenoceptor blockade for 7–14 days; beta-blockade only after alpha-blockade. Lenders JWM, Duh QY, Eisenhofer G, et al. Pheochromocytoma and paraganglioma: an Endocrine Society clinical practice guideline. J Clin Endocrinol Metab. 2014;99:1915–1942. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Hypertensive emergency / hypertensive encephalopathy; 2. Migraine; 3. Meningitis / encephalitis; 4. Dengue fever; 5. Bacterial meningitis (paediatric)
- differential web.passive: 1. Hypertensive emergency / hypertensive encephalopathy; 2. Migraine; 3. Meningitis / encephalitis; 4. Dengue fever; 5. Bacterial meningitis (paediatric)
- differential web.triageSurgical: (empty)
- emergency level: routine (acuity=routine, action=routine_booking, score=0)
- alarms: Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, caprini, asa, rcri
- score values: (none)
- dx variant: (none) (Thyroid)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: adrenal_incidentaloma (from ICD)
- note: PlanTab protocol: adrenal_incidentaloma (from ICD)

</details>

### Adrenal mass with suspected phaeochromocytoma before surgery

#### `adrenal-suspected-phaeochromocytoma` — Suspected phaeochromocytoma, on a beta-blocker

44-year-old woman with a 4.6 cm heterogeneous right adrenal mass (38 HU) and paroxysms of headache, palpitations and sweating, BP 182/104; referred "for laparoscopic adrenalectomy". Phaeochromocytoma must be biochemically confirmed or excluded first; if confirmed, alpha-blockade for 7–14 days before surgery (beta-blocker only after alpha); never biopsy.

Permutation of `adrenal-incidentaloma-indeterminate`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-phaeochromocytoma | mustNotMiss | critical | FAIL (known gap) | Endocrine Society guideline 2014; ESE/ENSAT guidelines 2023 | Add phaeochromocytoma to PANE with paroxysmal headache/palpitations/sweating features (the existing hypertension_symptom feature). |
| flag-phaeo | redFlags | critical | PASS | Endocrine Society guideline 2014 |  |
| inv-metanephrines | investigationInclude | critical | PASS | Endocrine Society guideline 2014; ESE/ENSAT guidelines 2023 |  |
| inv-no-adrenal-biopsy | investigationExclude | critical | PASS | ESE/ENSAT guidelines 2023; Endocrine Society guideline 2014 |  |
| mgmt-alpha-blockade | managementInclude | critical | PASS | Endocrine Society guideline 2014 |  |
| mgmt-no-beta-blocker-first | managementExclude | critical | PASS | Endocrine Society guideline 2014 |  |

Failure details:

- **mnm-phaeochromocytoma** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE has no phaeochromocytoma disease (only adrenal_incidentaloma) and applied no feature; the symptom engine ranks phaeochromocytoma #1 from the chips.]

Guidelines:

- **es-phaeo-2014** — Endocrine Society guideline — phaeochromocytoma and paraganglioma (2014), Biochemical testing (plasma free or urinary fractionated metanephrines); pre-operative alpha-adrenoceptor blockade for 7–14 days; beta-blockade only after alpha-blockade. Lenders JWM, Duh QY, Eisenhofer G, et al. Pheochromocytoma and paraganglioma: an Endocrine Society clinical practice guideline. J Clin Endocrinol Metab. 2014;99:1915–1942. *(statement wording/numbering not yet verified against the source)*
- **ese-adrenal-2023** — ESE/ENSAT guidelines — adrenal incidentalomas (2023 update) (2023), Imaging (unenhanced CT HU ≤10 benign; indeterminate masses); hormonal work-up (1 mg dexamethasone suppression test in all; plasma/urine metanephrines unless HU ≤10; aldosterone/renin in hypertension or hypokalaemia); no adrenal biopsy before phaeochromocytoma is excluded; surgery for indeterminate or functioning masses. Fassnacht M, Tsagarakis S, Terzolo M, et al. European Society of Endocrinology clinical practice guidelines on the management of adrenal incidentalomas, in collaboration with the European Network for the Study of Adrenal Tumors. Eur J Endocrinol. 2023;189:G1–G42. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Phaeochromocytoma; 2. Hyperthyroidism / thyrotoxicosis; 3. Generalised anxiety disorder; 4. Occult malignancy / systemic disease; 5. Lymphoma (Hodgkin / non-Hodgkin)
- differential web.passive: 1. Phaeochromocytoma; 2. Hyperthyroidism / thyrotoxicosis; 3. Generalised anxiety disorder; 4. Panic disorder; 5. Pulmonary tuberculosis
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Reproductive-age female with abdominal complaint [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; SBP 182 mmHg — hypertensive urgency [web.clinicalPrompts.safety]
- recommended scores: cha2ds2-vasc, news2, caprini, asa, rcri, web:gad7
- score values: (none)
- dx variant: (none) (Thyroid)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: adrenal_incidentaloma (from ICD)
- note: PlanTab protocol: adrenal_incidentaloma (from ICD)

</details>

### Acute aortic dissection

#### `aortic-dissection-epigastric-back-pain` — 

64-year-old hypertensive man with sudden tearing epigastric pain radiating between the shoulder blades; BP 188/104 right arm vs 152/90 left; amylase normal. Must not be labelled pancreatitis or ulcer: CT angiography; no antiplatelets/anticoagulation.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-dissection | mustNotMiss | critical | FAIL (known gap) | 2014 ESC Guidelines on the diagnosis and treatment of aortic diseases 2014 | Add a dissection rule/prompt: abrupt/tearing pain to back + BP/pulse differential or hypertension → "Acute aortic syndrome: CT angiography; avoid antithrombotics" (ESC 2014). |
| level-emergency | emergencyLevel | critical | PASS | 2014 ESC Guidelines on the diagnosis and treatment of aortic diseases 2014 |  |
| alarm-dissection | mustAlarm | critical | PASS | 2014 ESC Guidelines on the diagnosis and treatment of aortic diseases 2014 |  |
| inv-ct-angiography | investigationInclude | critical | FAIL (known gap) | 2014 ESC Guidelines on the diagnosis and treatment of aortic diseases 2014 | As mnm-dissection. |
| mgmt-no-antithrombotic | managementExclude | critical | PASS | 2014 ESC Guidelines on the diagnosis and treatment of aortic diseases 2014 |  |
| mnm-dissection-symptom-inference | mustNotMiss | quality | FAIL (known gap) | 2014 ESC Guidelines on the diagnosis and treatment of aortic diseases 2014 |  |
| mgmt-bp-heart-rate-control | managementInclude | quality | FAIL (known gap) | 2014 ESC Guidelines on the diagnosis and treatment of aortic diseases 2014 |  |

Failure details:

- **mnm-dissection** (web): not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Inguinal / Femoral Hernia \| 3. Acute Cholecystitis [known gap: PANE top 3: pancreatitis, inguinal hernia, cholecystitis (epigastric pain + radiation to back = pancreatitis pattern); no dissection node. Symptom inference ranks ruptured AAA #1 and does not list dissection in the top 5.]
- **mnm-dissection-symptom-inference** (web): not in top 5 of web.symptomInference: 1. Symptomatic / ruptured abdominal aortic aneurysm \| 2. Peptic ulcer disease \| 3. Acute alcoholic pancreatitis \| 4. Perforated peptic ulcer \| 5. Gallstone pancreatitis [known gap: Symptom inference has an "Aortic dissection" entry but it needs chest-pain chips ("Tearing / ripping"); with abdominal chips it is outside the top 5.]
- **inv-ct-angiography** (web): no investigation matched among 28 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol (I71.0) and no prompt suggests CT angiography.]
- **mgmt-bp-heart-rate-control** (web): no management item matched among 15 (web.clinicalPrompts) [known gap: No output.]

Guidelines:

- **esc-aortic-2014** — 2014 ESC Guidelines on the diagnosis and treatment of aortic diseases (2014), Acute aortic syndrome: high-risk features (abrupt tearing pain, pulse/BP differential, aortic regurgitation murmur); CT angiography first-line when stable; heart-rate and blood-pressure control (IV beta-blocker); urgent cardiothoracic/vascular referral. Erbel R, Aboyans V, Boileau C, et al. Eur Heart J. 2014;35:2873–2926. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Pancreatitis; 2. Inguinal / Femoral Hernia; 3. Acute Cholecystitis
- differential web.symptomInference: 1. Symptomatic / ruptured abdominal aortic aneurysm; 2. Peptic ulcer disease; 3. Acute alcoholic pancreatitis; 4. Perforated peptic ulcer; 5. Gallstone pancreatitis
- differential web.passive: 1. Symptomatic / ruptured abdominal aortic aneurysm; 2. Perforated peptic ulcer; 3. Acute alcoholic pancreatitis; 4. Chronic pancreatitis; 5. Vasovagal / reflex syncope
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=67)
- alarms: Emergency now [web.triage.emergency]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; SBP 188 mmHg — hypertensive urgency [web.clinicalPrompts.safety]
- recommended scores: ranson, news2, caprini, web:gerdq, asa, rcri
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, radiation_to_back, nausea_vomiting
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Chest Pain — Emergency Redirect (5), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (5)

</details>

### Secondary aorto-enteric fistula

#### `aortoenteric-fistula-herald-bleed` — 

71-year-old man 6 years after open AAA repair with a Dacron graft: small haematemesis and melaena (herald bleed) that stopped, low-grade fever; HR 102, SBP 118, Hb 10.9. Must not be managed as a routine ulcer bleed: CT angiography and vascular surgery.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-aortoenteric-fistula | mustNotMiss | critical | FAIL (known gap) | ESVS 2020 Clinical Practice Guidelines 2020 | Add a rule/prompt: GI bleeding + aortic graft/AAA repair in surgical history → "Aorto-enteric fistula until proven otherwise: CT angiography, vascular surgery" (ESVS 2020). |
| level-emergency | emergencyLevel | critical | PASS | ESVS 2020 Clinical Practice Guidelines 2020 |  |
| flag-aortic-graft | redFlags | critical | FAIL (known gap) | ESVS 2020 Clinical Practice Guidelines 2020 | Same rule as mnm-aortoenteric-fistula, surfaced as a safety prompt. |
| inv-ct-angiography | investigationInclude | critical | FAIL (known gap) | ESVS 2020 Clinical Practice Guidelines 2020 | Same rule; add "CT angiography" as the first investigation. |
| mgmt-vascular-surgery | managementInclude | critical | FAIL (known gap) | ESVS 2020 Clinical Practice Guidelines 2020 | Same rule. |
| inv-blood-cultures | investigationInclude | quality | PASS | ESVS 2020 Clinical Practice Guidelines 2020 |  |
| mgmt-no-tranexamic-acid | managementExclude | quality | PASS | HALT-IT randomised trial 2020 |  |

Failure details:

- **mnm-aortoenteric-fistula** (web): not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Inguinal / Femoral Hernia \| 3. Acute Cholecystitis; also in web.passive#1 [known gap: PANE top 3: pancreatitis, inguinal hernia, cholecystitis; no aorto-enteric fistula node anywhere. The passive ranking lists "ruptured abdominal aortic aneurysm" #1 from exam text.]
- **flag-aortic-graft** (web): no red flag matched among 14 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: Surgical history (aortic graft) is not read by any red-flag rule; triage only scores the bleed.]
- **inv-ct-angiography** (web): no investigation matched among 26 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol (no ICD/PANE match) and the GI-bleed prompt only offers OGD/colonoscopy.]
- **mgmt-vascular-surgery** (web): no management item matched among 9 (web.clinicalPrompts) [known gap: No output mentions vascular surgery.]

Guidelines:

- **esvs-graft-2020** — ESVS 2020 Clinical Practice Guidelines — management of vascular graft and endograft infections (aorto-enteric fistula) (2020), Aorto-enteric fistula: suspect in any GI bleeding after aortic reconstruction; CT angiography first-line; endoscopy to exclude other sources without delaying treatment; urgent vascular surgical management. Chakfé N, Diener H, Lejay A, et al. Eur J Vasc Endovasc Surg. 2020;59:339–384. *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Pancreatitis; 2. Inguinal / Femoral Hernia; 3. Acute Cholecystitis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Portal hypertension / oesophageal varices; 3. Fournier's gangrene; 4. Meckel's diverticulum; 5. Gastric carcinoma
- differential web.passive: 1. Symptomatic / ruptured abdominal aortic aneurysm; 2. Portal hypertension / oesophageal varices; 3. Upper GI haemorrhage; 4. Meckel's diverticulum; 5. Febrile convulsion
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=114)
- alarms: Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, cha2ds2-vasc, qsofa, forrest, news2, rockall, caprini, has-bled, asa, rcri, cfs
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting, epigastric_pain, radiation_to_back, fever
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (15)

</details>

### Acute appendicitis

#### `appendicitis-adult-typical` — Typical adult (base case)

24-year-old man, 24 h migratory RIF pain, anorexia, vomiting, low-grade fever, localised peritonism, WBC 14.8, CRP 48. Clinically uncomplicated appendicitis.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-appendicitis-top3 | mustRankTopK | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| score-alvarado-calculator | scoreValue | critical | PASS | Alvarado score (MANTRELS) 1986 |  |
| score-air-calculator | scoreValue | critical | n/a | Appendicitis Inflammatory Response (AIR) score 2008 |  |
| mgmt-lap-appendicectomy | managementInclude | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| dx-appendicitis-top1 | mustRankTopK | quality | PASS |  |  |
| score-rec-alvarado | scoreRecommended | quality | PASS | Alvarado score (MANTRELS) 1986 |  |
| score-rec-air | scoreRecommended | quality | FAIL (known gap) | WSES Jerusalem guidelines 2020; Appendicitis Inflammatory Response (AIR) score 2008 |  |
| score-alvarado-autofill | scoreValue | quality | n/a |  |  |
| inv-fbc | investigationInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| inv-crp | investigationInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| inv-imaging-us-or-ct | investigationInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| inv-urinalysis | investigationInclude | quality | PASS |  |  |
| mgmt-antibiotics | managementInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| mgmt-analgesia | managementInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| mgmt-no-routine-postop-antibiotics | managementExclude | quality | FAIL (known gap) | WSES Jerusalem guidelines 2020 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-uncomplicated | dxVariant | quality | PASS | WSES Jerusalem guidelines 2020 |  |

Failure details:

- **score-rec-air** (web): air not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, news2 [known gap: Web CDS has no AIR rule (and no AIR calculator); Alvarado only.]
- **mgmt-no-routine-postop-antibiotics** (web): forbidden management item present in web.clinicalPrompts: "...l: [x] ml. swab count correct × 2. post-operative orders: • simple appendicitis: iv amoxiclav 1.2g tds × 24h → oral co-amoxiclav × 5 days. • perforated appendicitis: iv pip-tazo 4.5g tds + metronidazole 500mg tds × 5 ..." [known gap: Web appendicectomy operative-plan prompt prescribes 5 days of co-amoxiclav after simple appendicitis.]

Guidelines:

- **wses-2020** — WSES Jerusalem guidelines — diagnosis and treatment of acute appendicitis (2020 update) (2020), Diagnosis (clinical scores; imaging), operative treatment (laparoscopic appendicectomy), antibiotic prophylaxis. Di Saverio S, Podda M, De Simone B, et al. Diagnosis and treatment of acute appendicitis: 2020 update of the WSES Jerusalem guidelines. World J Emerg Surg. 2020;15:27. *(statement wording/numbering not yet verified against the source)*
- **alvarado-1986** — Alvarado score (MANTRELS) (1986), Score items and weights; ≤4 unlikely, 5–6 possible, 7–8 probable, 9–10 very probable. Alvarado A. A practical score for the early diagnosis of acute appendicitis. Ann Emerg Med. 1986;15:557–64. *(statement wording/numbering not yet verified against the source)*
- **air-2008** — Appendicitis Inflammatory Response (AIR) score (2008), Score items and weights; 0–4 low, 5–8 intermediate, 9–12 high. Andersson M, Andersson RE. The appendicitis inflammatory response score: a tool for the diagnosis of acute appendicitis that outperforms the Alvarado score. World J Surg. 2008;32:1843–9. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Appendicitis; 2. Acute Cholecystitis; 3. Appendix Mass / Late Appendicitis
- differential web.symptomInference: 1. Acute appendicitis (paediatric); 2. Acute appendicitis; 3. Acute gastroenteritis; 4. Acute alcoholic pancreatitis; 5. Adhesive small bowel obstruction
- differential web.passive: 1. Acute appendicitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Acute alcoholic pancreatitis; 5. Adhesive small bowel obstruction
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=63)
- alarms: Emergency now [web.triage.emergency]; Peritoneal signs (McBurney's / Rebound / Rovsing) [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Fever 38.1°C + HR 102 bpm [web.clinicalPrompts.safety]
- recommended scores: alvarado, tg18-cholangitis, ranson, qsofa, news2
- score values: alvarado/calculator@web.scaleCalculator.alvarado=9
- dx variant: appendicitis_uncomplicated (Acute Appendicitis)
- note: PANE features applied: rlq_pain, nausea_vomiting, fever, anorexia
- note: AssessmentTab ManagementPanel protocol: appendicitis (from PANE top)
- note: PlanTab protocol: appendicitis (from ICD)
- note: no web calculator for score form 'air'
- note: matchPathways: Acute Appendicitis (12), Acute Abdomen (7), Anorectal (Haemorrhoids / Fissure / Fistula / Abscess) (7)

</details>

#### `appendicitis-elderly-atypical` — Elderly, atypical (AF on apixaban)

78-year-old woman with 3 days of vague lower abdominal pain settling in the RIF, anorexia, no fever, WBC 9.8 but CRP 145. Scores are equivocal/low although appendicitis is present; AF raises mesenteric ischaemia as a must-not-miss.

Permutation of `appendicitis-adult-typical`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-appendicitis-top5 | mustRankTopK | critical | PASS | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| mnm-mesenteric-ischaemia | mustNotMiss | critical | FAIL (known gap) | ESVS clinical practice guidelines 2017 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| score-alvarado-calculator | scoreValue | critical | PASS | Alvarado score (MANTRELS) 1986 |  |
| score-air-calculator | scoreValue | critical | n/a | Appendicitis Inflammatory Response (AIR) score 2008 |  |
| inv-ct-abdomen-pelvis | investigationInclude | critical | PASS | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| mnm-caecal-neoplasm | mustNotMiss | quality | FAIL (known gap) | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| mnm-diverticulitis | mustNotMiss | quality | FAIL (known gap) |  |  |
| flag-anticoagulant | redFlags | quality | PASS |  |  |
| flag-elderly-atypical | redFlags | quality | PASS |  |  |
| score-rec-alvarado | scoreRecommended | quality | PASS |  |  |
| inv-renal-function | investigationInclude | quality | PASS |  |  |
| inv-lactate-or-cta | investigationInclude | quality | PASS | ESVS clinical practice guidelines 2017 |  |
| mgmt-anticoagulant-plan | managementInclude | quality | PASS |  |  |
| mgmt-lap-appendicectomy | managementInclude | quality | PASS | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| mgmt-no-discharge-on-low-score | managementExclude | quality | PASS |  |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-uncomplicated | dxVariant | quality | PASS |  |  |

Failure details:

- **mnm-mesenteric-ischaemia** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis; also in web.symptomInference#3, web.passive#4 [known gap: PANE top 3 (cholecystitis, appendicitis, appendix mass) omits it; symptom inference ranks it #3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- **mnm-caecal-neoplasm** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- **mnm-diverticulitis** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3.]

Guidelines:

- **wses-elderly-2019** — SIFIPAC/WSES/SICG/SIMEU guidelines — acute appendicitis in the elderly (2019 edition) (2020), Diagnosis (scores and CT imaging in the elderly); treatment (appendicectomy vs non-operative; laparoscopy). Fugazzola P, Ceresoli M, Agnoletti V, et al. The SIFIPAC/WSES/SICG/SIMEU guidelines for diagnosis and treatment of acute appendicitis in the elderly (2019 edition). World J Emerg Surg. 2020;15:19. *(statement wording/numbering not yet verified against the source)*
- **esvs-2017** — ESVS clinical practice guidelines — diseases of the mesenteric arteries and veins (2017), Acute mesenteric arterial ischaemia — clinical suspicion (AF, embolic source) and CT angiography. Björck M, Koelemay M, Acosta S, et al. Management of the diseases of mesenteric arteries and veins: clinical practice guidelines of the European Society of Vascular Surgery (ESVS). Eur J Vasc Endovasc Surg. 2017;53:460–510. *(statement wording/numbering not yet verified against the source)*
- **alvarado-1986** — Alvarado score (MANTRELS) (1986), Score items and weights. Alvarado A. A practical score for the early diagnosis of acute appendicitis. Ann Emerg Med. 1986;15:557–64. *(statement wording/numbering not yet verified against the source)*
- **air-2008** — Appendicitis Inflammatory Response (AIR) score (2008), Score items and weights. Andersson M, Andersson RE. World J Surg. 2008;32:1843–9. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Appendicitis; 3. Appendix Mass / Late Appendicitis
- differential web.symptomInference: 1. Acute appendicitis (paediatric); 2. Acute appendicitis; 3. Acute mesenteric ischaemia; 4. Acute alcoholic pancreatitis; 5. Acute gastroenteritis
- differential web.passive: 1. Acute appendicitis (paediatric); 2. Acute alcoholic pancreatitis; 3. Acute gastroenteritis; 4. Acute mesenteric ischaemia; 5. Adhesive small bowel obstruction
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup
- emergency level: emergency (acuity=urgent, action=emergency_now, score=149)
- alarms: Emergency now [web.triage.emergency]; Peritoneal signs (McBurney's / Rebound / Rovsing) [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Bowel obstruction — clinical or imaging evidence [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Anticoagulation therapy [web.clinicalPrompts.safety]
- recommended scores: alvarado, ranson, cha2ds2-vasc, news2, caprini, has-bled, asa, rcri, cfs
- score values: alvarado/calculator@web.scaleCalculator.alvarado=5
- dx variant: appendicitis_uncomplicated (Acute Appendicitis)
- note: PANE features applied: rlq_pain, suprapubic_pain, nausea_vomiting, anorexia
- note: AssessmentTab ManagementPanel protocol: appendicitis (from ICD)
- note: PlanTab protocol: appendicitis (from ICD)
- note: no web calculator for score form 'air'
- note: matchPathways: IBD — Surgical Complications (Crohn's / UC) (21), Anorectal (Haemorrhoids / Fissure / Fistula / Abscess) (19), Colonoscopy Diagnostic (Rectal Bleeding / Bowel Habit Change / Iron Deficiency) (19)

</details>

#### `appendicitis-pregnant-t2` — Pregnant, second trimester (22 weeks)

29-year-old G2P1 at 22 weeks with 18 h periumbilical pain now right-sided and higher than the RIF, nausea, one vomit, low-grade fever, right flank tenderness. Ultrasound non-diagnostic.

Permutation of `appendicitis-adult-typical`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-appendicitis-top3 | mustRankTopK | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| flag-pregnancy | redFlags | critical | PASS | ACOG Committee Opinion No. 723 2017 |  |
| inv-mri-after-inconclusive-us | investigationInclude | critical | FAIL (known gap) | WSES Jerusalem guidelines 2020; ACOG Committee Opinion No. 723 2017 |  |
| mgmt-no-nsaid-after-20-weeks | managementExclude | critical | FAIL (known gap) | US FDA Drug Safety Communication 2020 |  |
| mnm-obstetric-cause | mustNotMiss | quality | FAIL (known gap) |  |  |
| mnm-pyelonephritis | mustNotMiss | quality | FAIL (known gap) |  |  |
| inv-ultrasound-first | investigationInclude | quality | PASS | WSES Jerusalem guidelines 2020; ACOG Committee Opinion No. 723 2017 |  |
| inv-no-unqualified-ct | investigationExclude | quality | FAIL (known gap) |  |  |
| inv-no-gadolinium | investigationExclude | quality | PASS | ACOG Committee Opinion No. 723 2017 |  |
| mgmt-lap-appendicectomy | managementInclude | quality | PASS | WSES Jerusalem guidelines 2020; SAGES guidelines for the use of laparoscopy during pregnancy 2017 |  |
| mgmt-obstetric-involvement | managementInclude | quality | FAIL (known gap) | SAGES guidelines for the use of laparoscopy during pregnancy 2017 |  |
| mgmt-no-bhcg-negative-assumption | managementExclude | quality | FAIL (known gap) |  |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-uncomplicated | dxVariant | quality | PASS |  |  |

Failure details:

- **mnm-obstetric-cause** (web): not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Acute Cholecystitis \| 3. Appendix Mass / Late Appendicitis [known gap: PANE has no obstetric disease nodes in the top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- **mnm-pyelonephritis** (web): not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Acute Cholecystitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- **inv-mri-after-inconclusive-us** (web): no investigation matched among 42 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: Neither the iOS radiation card nor the web appendicitis protocol mentions MRI; CT with contrast is the only second-line imaging offered.]
- **inv-no-unqualified-ct** (web): forbidden investigation present in web.plan.investigations: "ct abdomen/pelvis with iv contrast - if uss inconclusive or high clinical suspicio..." (+3 more) [known gap: CT with IV contrast is suggested without a pregnancy qualifier.]
- **mgmt-obstetric-involvement** (web): no management item matched among 55 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No obstetric review or fetal monitoring in the web plan or prompts.]
- **mgmt-no-nsaid-after-20-weeks** (web): forbidden management item present in web.clinicalPrompts: "... convert to oral when tolerating po. • paracetamol 1g qds + ibuprofen 400mg tds (regular). • morphine 5mg prn if pain > 5/10. • regular diet as toler..." [known gap: Web appendicectomy operative-plan prompt orders 'Paracetamol 1g QDS + Ibuprofen 400mg TDS (regular)' for a 22-week pregnant patient.]
- **mgmt-no-bhcg-negative-assumption** (web): forbidden management item present in web.clinicalPrompts: "...ak (< 1%), hartmann's pouch if appendix not identifiable. • β-hcg confirmed negative (female of reproductive age). • group & screen available; cross-match if perfor..." [known gap: Web operative-plan prompt states 'β-HCG confirmed negative' for a patient recorded as pregnant.]

Guidelines:

- **wses-2020** — WSES Jerusalem guidelines — acute appendicitis (2020 update) (2020), Diagnosis in pregnancy (US first, MRI if US inconclusive); laparoscopic appendicectomy in pregnancy. Di Saverio S, Podda M, De Simone B, et al. World J Emerg Surg. 2020;15:27. *(statement wording/numbering not yet verified against the source)*
- **acog-co723-2017** — ACOG Committee Opinion No. 723 — Guidelines for diagnostic imaging during pregnancy and lactation (2017), US and MRI preferred; CT not contraindicated when needed; gadolinium only if it clearly improves diagnosis. ACOG Committee Opinion No. 723. Obstet Gynecol. 2017;130:e210–e216. *(statement wording/numbering not yet verified against the source)*
- **sages-2017** — SAGES guidelines for the use of laparoscopy during pregnancy (2017), Laparoscopic appendicectomy in any trimester; obstetric consultation; fetal heart monitoring. Pearl JP, Price RR, Tonkin AE, Richardson WS, Stefanidis D. Surg Endosc. 2017;31:3767–82. *(statement wording/numbering not yet verified against the source)*
- **fda-2020-nsaid** — US FDA Drug Safety Communication — NSAIDs in pregnancy at 20 weeks or later (2020), Avoid NSAIDs from about 20 weeks' gestation (fetal renal dysfunction, oligohydramnios). US Food and Drug Administration. Drug Safety Communication, 15 October 2020. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Appendicitis; 2. Acute Cholecystitis; 3. Appendix Mass / Late Appendicitis
- differential web.symptomInference: 1. Acute appendicitis (paediatric); 2. Acute gastroenteritis; 3. Acute alcoholic pancreatitis; 4. Adhesive small bowel obstruction; 5. Acute appendicitis
- differential web.passive: 1. Acute appendicitis (paediatric); 2. Acute gastroenteritis; 3. Acute alcoholic pancreatitis; 4. Adhesive small bowel obstruction; 5. Acute mesenteric ischaemia
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=87)
- alarms: Emergency now [web.triage.emergency]; Peritoneal signs (McBurney's / Rebound / Rovsing) [web.clinicalPrompts.safety]; Reproductive-age female with abdominal complaint [web.clinicalPrompts.safety]; Appendix > 6mm / inflamed on imaging [web.clinicalPrompts.safety]; Pelvic free fluid on imaging — female patient [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 16.2 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]
- recommended scores: alvarado, ranson, news2
- score values: (none)
- dx variant: appendicitis_uncomplicated (Acute Appendicitis)
- note: PANE features applied: rlq_pain, nausea_vomiting, anorexia
- note: AssessmentTab ManagementPanel protocol: appendicitis (from PANE top)
- note: PlanTab protocol: appendicitis (from ICD)
- note: matchPathways: Acute Appendicitis (12), Acute Abdomen (7), Anorectal (Haemorrhoids / Fissure / Fistula / Abscess) (7)

</details>

### Spontaneous oesophageal perforation (Boerhaave's syndrome)

#### `boerhaave-classic-mackler` — 

52-year-old man after an alcohol binge: forceful vomiting then sudden severe retrosternal/epigastric pain, breathlessness and surgical emphysema in the neck (Mackler's triad); HR 124, SBP 96, T 38.2, SpO₂ 92; CXR pneumomediastinum. Surgical emergency.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-perforation-top3 | mustRankTopK | critical | FAIL (known gap) | WSES guidelines 2019 | socrates-to-features.ts: site "Retrosternal"/"Chest" → chest_pain_oesophageal; "surgical emphysema\|crepitus" (exam chip) → subcutaneous_emphysema; seed PANE from exam chips. |
| level-emergency | emergencyLevel | critical | PASS | WSES guidelines 2019 |  |
| alarm-perforation-or-sepsis | mustAlarm | critical | PASS | WSES guidelines 2019 |  |
| inv-ct-oral-contrast | investigationInclude | critical | PASS | WSES guidelines 2019 |  |
| mgmt-nil-by-mouth | managementInclude | critical | PASS | WSES guidelines 2019 |  |
| mgmt-broad-spectrum-antibiotics | managementInclude | critical | PASS | WSES guidelines 2019 |  |
| mgmt-surgical-referral | managementInclude | critical | PASS | WSES guidelines 2019 |  |
| mnm-acs | mustNotMiss | quality | PASS | 2023 ESC Guidelines for the management of acute coronary syndromes 2023 |  |
| inv-blood-cultures | investigationInclude | quality | PASS | WSES guidelines 2019 |  |
| mgmt-antifungal | managementInclude | quality | FAIL (known gap) | WSES guidelines 2019 |  |

Failure details:

- **dx-perforation-top3** (web): not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Inguinal / Femoral Hernia \| 3. Acute Cholecystitis [known gap: PANE top 3: pancreatitis, inguinal hernia, cholecystitis. Subcutaneous emphysema, chest_pain_oesophageal and vomiting_effortless never reach PANE (no SOCRATES rules; radiation "Back" gives radiation_to_back → pancreatitis). Symptom inference ranks STEMI/ACS first.]
- **mgmt-antifungal** (web): no management item matched among 50 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: oesophageal_perforation protocol has no antifungal.]

Guidelines:

- **wses-2019** — WSES guidelines — esophageal emergencies (perforation, caustic ingestion, foreign bodies) (2019), Oesophageal perforation: CT with oral water-soluble contrast is the investigation of choice; nil by mouth, broad-spectrum antibiotics and antifungals, drainage; primary repair when early and feasible, or endoscopic/stent therapy in selected cases; treatment within 24 h lowers mortality. Chirica M, Kelly MD, Siboni S, et al. World J Emerg Surg. 2019;14:26. *(statement wording/numbering not yet verified against the source)*
- **esc-acs-2023** — 2023 ESC Guidelines for the management of acute coronary syndromes (2023), Chest pain: 12-lead ECG within 10 minutes; high-sensitivity troponin. Byrne RA, Rossello X, Coughlan JJ, et al. Eur Heart J. 2023;44:3720–3826. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Pancreatitis; 2. Inguinal / Femoral Hernia; 3. Acute Cholecystitis
- differential web.symptomInference: 1. ST-elevation myocardial infarction (STEMI); 2. Acute coronary syndrome (ACS / NSTEMI / STEMI); 3. Tension pneumothorax; 4. Cardiac tamponade; 5. Epiglottitis
- differential web.passive: 1. ST-elevation myocardial infarction (STEMI); 2. Tension pneumothorax; 3. Acute coronary syndrome (ACS / NSTEMI / STEMI); 4. Cardiac tamponade; 5. Epiglottitis
- differential web.triageSurgical: 1. Thyroid nodule
- emergency level: emergency (acuity=urgent, action=emergency_now, score=310)
- alarms: Tachycardia [web.triage.vitalRedFlags]; Tachypnoea [web.triage.vitalRedFlags]; Low SpO₂ [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; Pneumoperitoneum on imaging [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 18.6 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; Fever 38.2°C + HR 124 bpm [web.clinicalPrompts.safety]; SpO₂ 92% — hypoxia [web.clinicalPrompts.safety]
- recommended scores: heart, wells-pe, qsofa, curb65, news2
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, radiation_to_back, nausea_vomiting, dyspnoea_pe
- note: AssessmentTab ManagementPanel protocol: oesophageal_perforation (from ICD)
- note: PlanTab protocol: oesophageal_perforation (from ICD)
- note: matchPathways: Chest Pain — Emergency Redirect (5), Thyroid / Neck Mass (5), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (5)

</details>

#### `boerhaave-presenting-as-chest-pain` — Presents as cardiac chest pain; emphysema subtle, no imaging yet

61-year-old diabetic man with central chest pain radiating to the back and sweating after an episode of vomiting; ECG normal, troponin normal, subtle neck crepitus. Looks like ACS; perforation must stay on the list and CT must be requested.

Permutation of `boerhaave-classic-mackler`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-perforation | mustNotMiss | critical | FAIL (known gap) | WSES guidelines 2019 | As boerhaave-classic-mackler dx gap; add an oesophageal-perforation entry to symptom inference (vomiting then chest pain, odynophagia, crepitus). |
| level-emergency | emergencyLevel | critical | PASS | WSES guidelines 2019; 2023 ESC Guidelines for the management of acute coronary syndromes 2023 |  |
| inv-ecg | investigationInclude | critical | FAIL (known gap) | 2023 ESC Guidelines for the management of acute coronary syndromes 2023 | computeClinicalPrompts: chest pain (chip or CC/HPI text) → safety prompt "12-lead ECG within 10 min + hs-troponin" (ESC 2023). |
| inv-ct-oral-contrast | investigationInclude | critical | PASS | WSES guidelines 2019 |  |
| mgmt-no-anticoagulation-before-ct | managementExclude | quality | PASS | 2023 ESC Guidelines for the management of acute coronary syndromes 2023; WSES guidelines 2019 |  |

Failure details:

- **mnm-perforation** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. Acute Pancreatitis [known gap: PANE top 3: inguinal hernia, cholecystitis, pancreatitis; no oesophageal features reach PANE. Symptom inference ranks STEMI/ACS first and has no perforation entry.]
- **inv-ecg** (web): no investigation matched among 31 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: No investigation output mentions an ECG: the triage chest_pain pathway checklist ("ECG within 10 minutes") is not surfaced, and the oesophageal_perforation protocol omits it.]

Guidelines:

- **wses-2019** — WSES guidelines — esophageal emergencies (perforation, caustic ingestion, foreign bodies) (2019), Suspect oesophageal perforation with chest pain after vomiting; CT with oral contrast. Chirica M, Kelly MD, Siboni S, et al. World J Emerg Surg. 2019;14:26. *(statement wording/numbering not yet verified against the source)*
- **esc-acs-2023** — 2023 ESC Guidelines for the management of acute coronary syndromes (2023), Chest pain: ECG within 10 minutes, hs-troponin; consider alternative diagnoses (aortic dissection, oesophageal rupture) when ECG/troponin do not support ACS. Byrne RA, Rossello X, Coughlan JJ, et al. Eur Heart J. 2023;44:3720–3826. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. Acute Pancreatitis
- differential web.symptomInference: 1. ST-elevation myocardial infarction (STEMI); 2. Acute coronary syndrome (ACS / NSTEMI / STEMI); 3. Tension pneumothorax; 4. Cardiac tamponade; 5. Epiglottitis
- differential web.passive: 1. ST-elevation myocardial infarction (STEMI); 2. Tension pneumothorax; 3. Acute coronary syndrome (ACS / NSTEMI / STEMI); 4. Cardiac tamponade; 5. Epiglottitis
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=134)
- alarms: Emergency now [web.triage.emergency]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; HR 112 bpm — unexplained tachycardia [web.clinicalPrompts.safety]
- recommended scores: heart, wells-pe, qsofa, web:wagner, news2, caprini, asa, curb65, rcri
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: radiation_to_back, nausea_vomiting, dyspnoea_pe
- note: AssessmentTab ManagementPanel protocol: oesophageal_perforation (from ICD)
- note: PlanTab protocol: oesophageal_perforation (from ICD)
- note: matchPathways: Chest Pain — Emergency Redirect (5), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (5)

</details>

#### `boerhaave-presenting-as-pancreatitis` — Presents as epigastric pain after alcohol with raised amylase

45-year-old man after binge drinking and vomiting: epigastric pain to the back, amylase 240 (below 3× ULN), no surgical emphysema yet, left pleural effusion on CXR. Pancreatitis-like; perforation must stay on the list.

Permutation of `boerhaave-classic-mackler`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-perforation | mustNotMiss | critical | FAIL (known gap) | WSES guidelines 2019 | As boerhaave-classic-mackler dx gap. |
| level-emergency | emergencyLevel | critical | PASS | WSES guidelines 2019 |  |
| inv-ct-oral-contrast | investigationInclude | critical | PASS | WSES guidelines 2019 |  |
| mgmt-nil-by-mouth | managementInclude | quality | PASS | WSES guidelines 2019 |  |

Failure details:

- **mnm-perforation** (web): not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis [known gap: PANE top 3: pancreatitis, cholecystitis, GORD; symptom inference: alcoholic/gallstone pancreatitis, peptic ulcer, perforated ulcer. Oesophageal perforation is absent from every list.]

Guidelines:

- **wses-2019** — WSES guidelines — esophageal emergencies (perforation, caustic ingestion, foreign bodies) (2019), Oesophageal perforation mimics pancreatitis, MI and perforated ulcer; CT with oral contrast; early treatment. Chirica M, Kelly MD, Siboni S, et al. World J Emerg Surg. 2019;14:26. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Pancreatitis; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Acute alcoholic pancreatitis; 2. Gallstone pancreatitis; 3. Peptic ulcer disease; 4. Perforated peptic ulcer; 5. Acute gastroenteritis
- differential web.passive: 1. Acute alcoholic pancreatitis; 2. Perforated peptic ulcer; 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute appendicitis (paediatric)
- differential web.triageSurgical: 1. Acute biliary pancreatitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=125)
- alarms: Emergency now [web.triage.emergency]; Pneumoperitoneum on imaging [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 16.8 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; HR 116 bpm — unexplained tachycardia [web.clinicalPrompts.safety]
- recommended scores: alvarado, heart, wells-pe, ranson, qsofa, news2, web:gerdq
- score values: (none)
- dx variant: (none) (Pancreatitis)
- note: PANE features applied: epigastric_pain, radiation_to_back, chest_pain_oesophageal, nausea_vomiting
- note: AssessmentTab ManagementPanel protocol: oesophageal_perforation (from ICD)
- note: PlanTab protocol: oesophageal_perforation (from ICD)
- note: matchPathways: Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (12), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (12), Acute Abdomen (7)

</details>

### Lactational breast abscess

#### `breast-abscess-lactational` — 

28-year-old breastfeeding mother, 4 weeks post-partum, with a 4 cm tender fluctuant mass after 5 days of mastitis on flucloxacillin, fever 38.4. Ultrasound confirms a collection: ultrasound-guided needle aspiration (repeated as needed), antibiotics, continue breastfeeding/expressing.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-abscess-top3 | mustRankTopK | critical | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| inv-uss | investigationInclude | critical | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| mgmt-aspiration | managementInclude | critical | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| level-at-least-urgent | emergencyLevel | quality | PASS |  |  |
| inv-pus-culture | investigationInclude | quality | PASS |  |  |
| mgmt-continue-breastfeeding | managementInclude | quality | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| mgmt-no-stop-breastfeeding | managementExclude | quality | PASS |  |  |

Guidelines:

- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Breast Abscess; 2. Mastitis; 3. Acute Cholecystitis
- differential web.symptomInference: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Pyelonephritis; 4. Pelvic inflammatory disease (PID); 5. Systemic lupus erythematosus
- differential web.passive: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Febrile convulsion; 4. Sepsis / systemic infection; 5. Infective endocarditis
- differential web.triageSurgical: 1. Breast lump / mass
- emergency level: emergency (acuity=urgent, action=emergency_now, score=73)
- alarms: Emergency now [web.triage.emergency]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 15.6 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; Fever 38.4°C + HR 102 bpm [web.clinicalPrompts.safety]
- recommended scores: qsofa, news2
- score values: (none)
- dx variant: (none) (Breast)
- note: PANE features applied: breast_lump, fever
- note: AssessmentTab ManagementPanel protocol: breast_abscess (from ICD)
- note: PlanTab protocol: breast_abscess (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (10), IBD — Surgical Complications (Crohn's / UC) (5)

</details>

### Non-lactational (periductal) breast abscess

#### `breast-abscess-non-lactational-smoker` — Non-lactational, smoker, recurrent

41-year-old smoker, not lactating, with a third episode of a painful periareolar abscess. Periductal mastitis: ultrasound + aspiration, antibiotics covering anaerobes, smoking cessation, and imaging to exclude an underlying carcinoma once settled; recurrent disease may need duct excision.

Permutation of `breast-abscess-lactational`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| inv-uss | investigationInclude | critical | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| mgmt-aspiration | managementInclude | critical | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| dx-abscess-top3 | mustRankTopK | quality | FAIL (known gap) |  |  |
| mgmt-anaerobic-cover | managementInclude | quality | PASS |  |  |
| mgmt-smoking-cessation | managementInclude | quality | FAIL (known gap) |  |  |
| mgmt-exclude-malignancy | managementInclude | quality | PASS |  |  |
| mgmt-no-breastfeeding-advice | managementExclude | quality | PASS |  |  |

Failure details:

- **dx-abscess-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Fibroadenoma \| 3. Fibrocystic Breast Disease; also in web.triageSurgical#3 [known gap: PANE top 3 = cholecystitis, fibroadenoma, fibrocystic change: only breast_lump was extracted (no redness/pain/discharge feature from chips). PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **mgmt-smoking-cessation** (web): no management item matched among 27 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: The breast_abscess protocol has no non-lactational (periductal mastitis) branch: no smoking cessation or duct excision.]

Guidelines:

- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Fibroadenoma; 3. Fibrocystic Breast Disease
- differential web.symptomInference: 1. Breast carcinoma; 2. Fibroadenoma / benign breast lump; 3. Uterine fibroids; 4. Acute cholecystitis; 5. Systemic lupus erythematosus
- differential web.passive: 1. Breast carcinoma; 2. Fibroadenoma / benign breast lump; 3. Acute cholecystitis; 4. CBD stone / obstructive jaundice; 5. Peptic ulcer disease
- differential web.triageSurgical: 1. Breast lump / mass; 2. Nipple discharge; 3. Skin / soft tissue abscess
- emergency level: emergency (acuity=urgent, action=emergency_now, score=78)
- alarms: Emergency now [web.triage.emergency]; Pre-operative assessment [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: (none) (Breast)
- note: PANE features applied: breast_lump
- note: AssessmentTab ManagementPanel protocol: breast_abscess (from ICD)
- note: PlanTab protocol: breast_abscess (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (15), Post-operative Follow-up (General) (5)

</details>

### Family history of breast cancer (possible BRCA)

#### `breast-family-history-brca` — 

35-year-old asymptomatic woman whose mother had breast cancer at 38 and maternal aunt ovarian cancer at 52. NICE CG164: meets referral criteria for specialist/genetics assessment; risk-based surveillance (MRI in high risk); no biopsy or urgent pathway without a symptom.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-routine | emergencyLevel | quality | FAIL (known gap) | NICE CG164 2013 |  |
| mgmt-genetics-referral | managementInclude | quality | FAIL (known gap) | NICE CG164 2013 | Add a familyHistory field to the vignette schema and web-runner.ts; map Z80.3 to a familial-risk protocol (NICE CG164 referral criteria). |
| mgmt-no-biopsy | managementExclude | quality | PASS |  |  |

Failure details:

- **level-routine** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=37); expected ≤ priority [known gap: Triage same_day_call: the word "cancer" in the complaint ("Worried about breast cancer") matches the "Possible malignancy" red flag.]
- **mgmt-genetics-referral** (web): no management item matched among 2 (web.clinicalPrompts) [known gap: The family-history prompt exists (computeClinicalPrompts: "Family history of breast / ovarian cancer" → genetics) but reads InferenceInput.familyHistory, which the harness passes as [] (no vignette field); Z80.3 maps to no protocol.]

Guidelines:

- **nice-cg164** — NICE CG164 — Familial breast cancer (2013), Family history assessment in primary/secondary care; referral criteria (e.g. one first-degree relative diagnosed <40); genetic testing; surveillance by risk category. National Institute for Health and Care Excellence. Familial breast cancer: classification, care and managing breast cancer and related risks in people with a family history of breast cancer. Clinical guideline CG164. London: NICE; 2013 (updated). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Appendicitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Uterine fibroids; 2. Systemic lupus erythematosus; 3. Breast carcinoma; 4. Acute cholecystitis; 5. Endometriosis
- differential web.passive: 1. Acute cholecystitis; 2. CBD stone / obstructive jaundice; 3. Peptic ulcer disease; 4. Reducible groin / abdominal hernia; 5. GORD / acid reflux / oesophagitis
- differential web.triageSurgical: 1. Breast cancer
- emergency level: urgent (acuity=priority, action=same_day_call, score=37)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: wells-dvt, news2, caprini, must, ecog
- score values: (none)
- dx variant: (none) (Breast)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (5)

</details>

### Inflammatory breast cancer

#### `breast-inflammatory-cancer` — 

47-year-old woman, not lactating, with 4 weeks of a red, warm, swollen right breast involving more than a third of the skin, peau d'orange, no fever, not improved after two courses of antibiotics. Inflammatory breast cancer until proven otherwise: urgent core biopsy of breast and skin, staging, neoadjuvant systemic therapy; no primary breast-conserving surgery.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-carcinoma | mustNotMiss | critical | PASS | NCCN Guidelines 2025; NICE NG12 2015 |  |
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| flag-inflammatory | redFlags | critical | PASS | NCCN Guidelines 2025 |  |
| inv-core-biopsy | investigationInclude | critical | PASS | NCCN Guidelines 2025 |  |
| mgmt-no-bcs-or-slnb | managementExclude | critical | FAIL (known gap) | NCCN Guidelines 2025 | Add an inflammatory-breast-cancer variant (C50 + "inflammatory"/"peau d'orange"): neoadjuvant systemic therapy then modified radical mastectomy; exclude BCS and SLNB. |
| inv-staging | investigationInclude | quality | PASS | NCCN Guidelines 2025 |  |
| mgmt-neoadjuvant | managementInclude | quality | PASS | NCCN Guidelines 2025 |  |
| mgmt-no-further-antibiotics-only | managementExclude | quality | PASS |  |  |

Failure details:

- **mgmt-no-bcs-or-slnb** (web): forbidden management item present in web.plan: "[surgical] wide local excision (breast-conserving) + slnb or axillary clearance." (+2 more) [known gap: The C50 plan comes from the generic invasive_ductal_carcinoma protocol, which offers "Wide local excision (breast-conserving) + SLNB" first; the protocol lists inflammatory breast cancer as a red flag but has no IBC branch.]

Guidelines:

- **nccn-breast-2025** — NCCN Guidelines — Breast Cancer (inflammatory breast cancer; breast cancer during pregnancy) (2025), Inflammatory breast cancer: core biopsy of breast and skin, staging, neoadjuvant systemic therapy before modified radical mastectomy (breast conservation and sentinel node biopsy not recommended); breast cancer during pregnancy (no tamoxifen, no radiotherapy during pregnancy). National Comprehensive Cancer Network. NCCN Clinical Practice Guidelines in Oncology: Breast Cancer (current version at authoring). *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*
- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Invasive Ductal Carcinoma; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Testicular germ cell tumour; 2. Breast carcinoma; 3. Uterine fibroids; 4. Acute cholecystitis; 5. Systemic lupus erythematosus
- differential web.passive: 1. Testicular germ cell tumour; 2. Acute cholecystitis; 3. CBD stone / obstructive jaundice; 4. Peptic ulcer disease; 5. Reducible groin / abdominal hernia
- differential web.triageSurgical: (empty)
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, ecog
- score values: (none)
- dx variant: (none) (Breast)
- note: PANE features applied: breast_lump
- note: AssessmentTab ManagementPanel protocol: invasive_ductal_carcinoma (from ICD)
- note: PlanTab protocol: invasive_ductal_carcinoma (from ICD)
- note: matchPathways: IBD — Surgical Complications (Crohn's / UC) (5)

</details>

### Breast lump, age 30–35

#### `breast-lump-age-30-35` — Age 32 (NG12 threshold)

32-year-old woman with a discrete lump persisting through a cycle. NICE NG12: age ≥30 with an unexplained breast lump → suspected cancer pathway referral. Triple assessment with ultrasound and core biopsy; mammography is added by age and imaging findings.

Permutation of `breast-lump-under-30`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| flag-2ww | redFlags | critical | FAIL (known gap) | NICE NG12 2015 | Parenthesise the colorectal condition (c.met && (… \|\| … )) in screenForCancer, and assign cancerType per met rule; add a vitest vector for a breast-lump-only screen. |
| inv-uss | investigationInclude | critical | FAIL (known gap) | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010; NCCN Guidelines 2025 | Map N63 (unspecified breast lump) to a "breast lump — triple assessment" protocol with age-banded imaging; add exam.breast to the vignette schema and pass it as examBreast in web-runner.ts. |
| inv-core-biopsy | investigationInclude | critical | FAIL (known gap) | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 | Map N63 (unspecified breast lump) to a "breast lump — triple assessment" protocol with age-banded imaging; add exam.breast to the vignette schema and pass it as examBreast in web-runner.ts. |
| level-at-least-priority | emergencyLevel | quality | PASS | NICE NG12 2015 |  |
| variant-triple-assessment | dxVariant | quality | PASS |  |  |

Failure details:

- **flag-2ww** (web): no red flag matched among 6 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: The suspected-cancer referral is triggered (age ≥30 + breast lump) but labelled "Cancer screening triggered (colorectal)". cancer-screening.ts labels every triggered screen "colorectal": the colorectal block tests `c.met && c.rule.includes('colorectal') \|\| c.rule.includes('bowel') \|\| …` (operator precedence), which is true whenever any colorectal rule exists, and the breast block keeps the first label (cancerType ?? "breast").]
- **inv-uss** (web): no investigation matched among 11 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]
- **inv-core-biopsy** (web): no investigation matched among 11 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*
- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*
- **nccn-breast-dx-2025** — NCCN Guidelines — Breast Cancer Screening and Diagnosis (2025), Palpable mass: age <30 ultrasound first; age ≥30 diagnostic mammography + ultrasound; tissue sampling of suspicious findings; nipple discharge (spontaneous, unilateral, single duct, bloody); skin changes. National Comprehensive Cancer Network. NCCN Clinical Practice Guidelines in Oncology: Breast Cancer Screening and Diagnosis (current version at authoring). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Fibroadenoma; 3. Fibrocystic Breast Disease
- differential web.symptomInference: 1. Breast carcinoma; 2. Fibroadenoma / benign breast lump; 3. Uterine fibroids; 4. Systemic lupus erythematosus; 5. Acute cholecystitis
- differential web.passive: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Acute cholecystitis; 4. CBD stone / obstructive jaundice; 5. Peptic ulcer disease
- differential web.triageSurgical: 1. Breast lump / mass; 2. Breast cancer; 3. Nipple discharge
- emergency level: urgent (acuity=priority, action=same_day_call, score=55)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, ecog
- score values: (none)
- dx variant: breast_triple_assessment (Breast)
- note: PANE features applied: breast_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (15)

</details>

### Suspicious breast lump, age over 35

#### `breast-lump-over-35-suspicious` — Age 58, suspicious features

58-year-old postmenopausal woman: hard irregular lump with skin tethering, nipple retraction and an axillary node. Urgent triple assessment: bilateral mammography, ultrasound (breast and axilla), core biopsy; suspected cancer pathway.

Permutation of `breast-lump-under-30`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-carcinoma-top3 | mustRankTopK | critical | PASS | NICE NG12 2015 |  |
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| flag-2ww | redFlags | critical | FAIL (known gap) | NICE NG12 2015 | Parenthesise the colorectal condition (c.met && (… \|\| … )) in screenForCancer, and assign cancerType per met rule; add a vitest vector for a breast-lump-only screen. |
| inv-mammogram | investigationInclude | critical | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010; NCCN Guidelines 2025 |  |
| inv-uss | investigationInclude | critical | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| inv-core-biopsy | investigationInclude | critical | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| flag-suspicious | redFlags | quality | PASS |  |  |
| inv-axilla | investigationInclude | quality | PASS | NCCN Guidelines 2025 |  |
| mgmt-mdt | managementInclude | quality | FAIL (known gap) |  |  |
| mgmt-no-surgery-before-histology | managementExclude | quality | PASS |  |  |
| variant-triple-assessment | dxVariant | quality | PASS |  |  |

Failure details:

- **flag-2ww** (web): no red flag matched among 9 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: Triggered but labelled colorectal. cancer-screening.ts labels every triggered screen "colorectal": the colorectal block tests `c.met && c.rule.includes('colorectal') \|\| c.rule.includes('bowel') \|\| …` (operator precedence), which is true whenever any colorectal rule exists, and the breast block keeps the first label (cancerType ?? "breast").]
- **mgmt-mdt** (web): no management item matched among 7 (web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*
- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*
- **nccn-breast-dx-2025** — NCCN Guidelines — Breast Cancer Screening and Diagnosis (2025), Palpable mass: age <30 ultrasound first; age ≥30 diagnostic mammography + ultrasound; tissue sampling of suspicious findings; nipple discharge (spontaneous, unilateral, single duct, bloody); skin changes. National Comprehensive Cancer Network. NCCN Clinical Practice Guidelines in Oncology: Breast Cancer Screening and Diagnosis (current version at authoring). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Invasive Ductal Carcinoma; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Breast carcinoma; 2. Fibroadenoma / benign breast lump; 3. Uterine fibroids; 4. Acute cholecystitis; 5. Colorectal carcinoma
- differential web.passive: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Acute cholecystitis; 4. CBD stone / obstructive jaundice; 5. Peptic ulcer disease
- differential web.triageSurgical: 1. Breast lump / mass
- emergency level: urgent (acuity=priority, action=same_day_call, score=55)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, ecog
- score values: (none)
- dx variant: breast_triple_assessment (Breast)
- note: PANE features applied: breast_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (10), IBD — Surgical Complications (Crohn's / UC) (5)

</details>

### Breast lump in pregnancy

#### `breast-lump-pregnant` — Pregnant, 22 weeks

33-year-old at 22 weeks of pregnancy with a persistent firm lump and an axillary node, told it is "pregnancy changes". Pregnancy-associated breast cancer is diagnosed late: ultrasound and core biopsy are safe in pregnancy and must not be deferred; tamoxifen is contraindicated in pregnancy.

Permutation of `breast-lump-under-30`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| flag-2ww | redFlags | critical | FAIL (known gap) | NICE NG12 2015 | Parenthesise the colorectal condition (c.met && (… \|\| … )) in screenForCancer, and assign cancerType per met rule; add a vitest vector for a breast-lump-only screen. |
| inv-uss | investigationInclude | critical | FAIL (known gap) | RCOG Green-top Guideline No. 12 2011; NCCN Guidelines 2025 | Map N63 (unspecified breast lump) to a "breast lump — triple assessment" protocol with age-banded imaging; add exam.breast to the vignette schema and pass it as examBreast in web-runner.ts. |
| inv-core-biopsy | investigationInclude | critical | FAIL (known gap) | RCOG Green-top Guideline No. 12 2011 | Map N63 (unspecified breast lump) to a "breast lump — triple assessment" protocol with age-banded imaging; add exam.breast to the vignette schema and pass it as examBreast in web-runner.ts. |
| mgmt-no-tamoxifen | managementExclude | critical | PASS | RCOG Green-top Guideline No. 12 2011; NCCN Guidelines 2025 |  |
| mgmt-no-deferral | managementExclude | critical | PASS | RCOG Green-top Guideline No. 12 2011 |  |
| flag-pregnancy | redFlags | quality | PASS |  |  |

Failure details:

- **flag-2ww** (web): no red flag matched among 11 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: Triggered but labelled colorectal. cancer-screening.ts labels every triggered screen "colorectal": the colorectal block tests `c.met && c.rule.includes('colorectal') \|\| c.rule.includes('bowel') \|\| …` (operator precedence), which is true whenever any colorectal rule exists, and the breast block keeps the first label (cancerType ?? "breast").]
- **inv-uss** (web): no investigation matched among 12 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]
- **inv-core-biopsy** (web): no investigation matched among 12 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]

Guidelines:

- **rcog-gtg12-2011** — RCOG Green-top Guideline No. 12 — Pregnancy and breast cancer (2011), Diagnosis of a breast lump in pregnancy (ultrasound, core biopsy; delay in diagnosis); treatment during pregnancy (tamoxifen contraindicated). Royal College of Obstetricians and Gynaecologists. Pregnancy and Breast Cancer. Green-top Guideline No. 12. London: RCOG; 2011. *(statement wording/numbering not yet verified against the source)*
- **nccn-breast-2025** — NCCN Guidelines — Breast Cancer (inflammatory breast cancer; breast cancer during pregnancy) (2025), Inflammatory breast cancer: core biopsy of breast and skin, staging, neoadjuvant systemic therapy before modified radical mastectomy (breast conservation and sentinel node biopsy not recommended); breast cancer during pregnancy (no tamoxifen, no radiotherapy during pregnancy). National Comprehensive Cancer Network. NCCN Clinical Practice Guidelines in Oncology: Breast Cancer (current version at authoring). *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Fibroadenoma; 3. Fibrocystic Breast Disease
- differential web.symptomInference: 1. Breast carcinoma; 2. Fibroadenoma / benign breast lump; 3. Uterine fibroids; 4. Systemic lupus erythematosus; 5. Acute cholecystitis
- differential web.passive: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Acute cholecystitis; 4. CBD stone / obstructive jaundice; 5. Peptic ulcer disease
- differential web.triageSurgical: 1. Breast lump / mass; 2. Breast cancer
- emergency level: emergency (acuity=urgent, action=emergency_now, score=79)
- alarms: Emergency now [web.triage.emergency]; Reproductive-age female with abdominal complaint [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, ecog
- score values: (none)
- dx variant: breast_triple_assessment (Breast)
- note: PANE features applied: breast_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (10)

</details>

### Breast lump, age under 30 (probable fibroadenoma)

#### `breast-lump-under-30` — 

24-year-old woman with a 2 cm smooth, mobile, non-tender breast lump. Triple assessment with ultrasound as the imaging modality (mammography is not first-line under 30), core biopsy per imaging; NICE NG12 does not require a suspected-cancer referral under 30.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| inv-uss | investigationInclude | critical | FAIL (known gap) | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010; NCCN Guidelines 2025 | Map N63 (unspecified breast lump) to a "breast lump — triple assessment" protocol with age-banded imaging; add exam.breast to the vignette schema and pass it as examBreast in web-runner.ts. |
| dx-fibroadenoma-top3 | mustRankTopK | quality | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| level-not-urgent | emergencyLevel | quality | FAIL (known gap) | NICE NG12 2015 |  |
| inv-no-first-line-mammogram | investigationExclude | quality | PASS | NCCN Guidelines 2025; Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| inv-no-unrelated-seeded-orders | investigationExclude | quality | FAIL (known gap) |  | Model P(feature \| not disease) or use a low default sensitivity (e.g. <=0.05) for features outside a disease's system; restrict the candidate set by the presenting system (breast / neck / groin). |
| mgmt-triple-assessment | managementInclude | quality | FAIL (known gap) | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 | Map N63 (unspecified breast lump) to a "breast lump — triple assessment" protocol with age-banded imaging; add exam.breast to the vignette schema and pass it as examBreast in web-runner.ts. |
| variant-triple-assessment | dxVariant | quality | PASS |  |  |

Failure details:

- **level-not-urgent** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: "breast lump" RED_FLAG is priority ("Possible malignancy") regardless of age, and the adaptive action maps priority to a same-day call.]
- **inv-uss** (web): no investigation matched among 11 (web.pane.seeded, web.clinicalPrompts) [known gap: No breast ultrasound in any output. The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]
- **inv-no-unrelated-seeded-orders** (web): forbidden investigation present in web.pane.seeded: "amylase / lipase (exclude pancreatitis) (cholecystitis)" (+3 more) [known gap: PANE top 3 starts with cholecystitis, so amylase/lipase, blood cultures and MRCP are seeded into orders for a breast lump.]
- **mgmt-triple-assessment** (web): no management item matched among 2 (web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vignette schema has no breast exam field), so the dashboard prompt "Breast Mass → Triple Assessment" (USS, mammogram ≥35, core biopsy) is not exercised.]

Guidelines:

- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*
- **nccn-breast-dx-2025** — NCCN Guidelines — Breast Cancer Screening and Diagnosis (2025), Palpable mass: age <30 ultrasound first; age ≥30 diagnostic mammography + ultrasound; tissue sampling of suspicious findings; nipple discharge (spontaneous, unilateral, single duct, bloody); skin changes. National Comprehensive Cancer Network. NCCN Clinical Practice Guidelines in Oncology: Breast Cancer Screening and Diagnosis (current version at authoring). *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Fibroadenoma; 3. Fibrocystic Breast Disease
- differential web.symptomInference: 1. Breast carcinoma; 2. Fibroadenoma / benign breast lump; 3. Systemic lupus erythematosus; 4. Acute cholecystitis; 5. Uterine fibroids
- differential web.passive: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Acute cholecystitis; 4. CBD stone / obstructive jaundice; 5. Peptic ulcer disease
- differential web.triageSurgical: 1. Breast lump / mass; 2. Nipple discharge
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: breast_triple_assessment (Breast)
- note: PANE features applied: breast_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (10)

</details>

### Male breast cancer

#### `breast-male-cancer` — Unilateral hard eccentric mass

68-year-old man with a hard, painless, eccentric left subareolar lump with nipple retraction for 2 months; sister had breast cancer. NICE NG12: men ≥50 with a unilateral firm subareolar mass → suspected cancer pathway; mammography/ultrasound and core biopsy.

Permutation of `breast-male-gynaecomastia`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-carcinoma | mustNotMiss | critical | FAIL (known gap) | NICE NG12 2015 | Keep a male-appropriate prior for invasive carcinoma (rare but not x0.05 below a hernia) and add "unilateral, hard, eccentric, nipple retraction" features that favour carcinoma over gynaecomastia. |
| flag-2ww | redFlags | critical | FAIL (known gap) | NICE NG12 2015 | Parenthesise the colorectal condition (c.met && (… \|\| … )) in screenForCancer, and assign cancerType per met rule; add a vitest vector for a breast-lump-only screen. |
| inv-imaging | investigationInclude | critical | PASS | NICE NG12 2015; Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| inv-core-biopsy | investigationInclude | critical | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| mgmt-no-gynaecomastia-treatment | managementExclude | critical | PASS |  |  |
| mgmt-genetics | managementInclude | quality | FAIL (known gap) |  |  |

Failure details:

- **mnm-carcinoma** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Gynaecomastia \| 3. Acute Cholecystitis; also in web.symptomInference#1, web.passive#2, web.triageSurgical#3 [known gap: PANE top 3 = inguinal hernia (male x5 prior), gynaecomastia, cholecystitis: every breast disease except gynaecomastia is multiplied by 0.05 in men, so male breast cancer cannot rank.]
- **flag-2ww** (web): no red flag matched among 10 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: Triggered but labelled colorectal. cancer-screening.ts labels every triggered screen "colorectal": the colorectal block tests `c.met && c.rule.includes('colorectal') \|\| c.rule.includes('bowel') \|\| …` (operator precedence), which is true whenever any colorectal rule exists, and the breast block keeps the first label (cancerType ?? "breast").]
- **mgmt-genetics** (web): no management item matched among 4 (web.clinicalPrompts) [known gap: No BRCA / genetics step for male breast cancer with a family history.]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*
- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Gynaecomastia; 3. Acute Cholecystitis
- differential web.symptomInference: 1. Breast carcinoma; 2. Fibroadenoma / benign breast lump; 3. Benign prostatic hyperplasia (BPH); 4. Prostate adenocarcinoma; 5. Colorectal carcinoma
- differential web.passive: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Acute cholecystitis; 4. CBD stone / obstructive jaundice; 5. Peptic ulcer disease
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 2. Breast lump / mass; 3. Breast cancer
- emergency level: urgent (acuity=priority, action=same_day_call, score=74)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: wells-dvt, news2, caprini, must, cfs, ecog
- score values: (none)
- dx variant: breast_triple_assessment (Breast)
- note: PANE features applied: breast_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (15), Cancer Screening (Age/Sex Appropriate) (7), Colonoscopy Diagnostic (Rectal Bleeding / Bowel Habit Change / Iron Deficiency) (7)

</details>

### Gynaecomastia (drug-induced)

#### `breast-male-gynaecomastia` — 

63-year-old man with heart failure on spironolactone and 3 months of bilateral tender, rubbery, concentric subareolar discs. Gynaecomastia: medication review, examine the testes, endocrine bloods if no cause; no core biopsy for typical bilateral disease.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-gynaecomastia-top3 | mustRankTopK | quality | PASS |  |  |
| level-routine | emergencyLevel | quality | FAIL (known gap) |  |  |
| inv-testes | investigationInclude | quality | PASS |  |  |
| mgmt-medication-review | managementInclude | quality | PASS |  |  |

Failure details:

- **level-routine** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=74); expected ≤ priority [known gap: Triage same_day_call: "breast lump" → Possible malignancy (priority) and the cancer screen triggers (age ≥30 + breast lump, applied to men).]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*
- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Gynaecomastia; 3. Acute Cholecystitis
- differential web.symptomInference: 1. Breast carcinoma; 2. Fibroadenoma / benign breast lump; 3. Benign prostatic hyperplasia (BPH); 4. Prostate adenocarcinoma; 5. Colorectal carcinoma
- differential web.passive: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Acute cholecystitis; 4. CBD stone / obstructive jaundice; 5. Peptic ulcer disease
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 2. Breast lump / mass; 3. Nipple discharge
- emergency level: urgent (acuity=priority, action=same_day_call, score=74)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, asa, rcri
- score values: (none)
- dx variant: (none) (Breast)
- note: PANE features applied: breast_lump
- note: AssessmentTab ManagementPanel protocol: gynaecomastia (from ICD)
- note: PlanTab protocol: gynaecomastia (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (15), Cancer Screening (Age/Sex Appropriate) (7), Colonoscopy Diagnostic (Rectal Bleeding / Bowel Habit Change / Iron Deficiency) (7)

</details>

### Bloody single-duct nipple discharge

#### `breast-nipple-discharge-bloody-single-duct` — 

52-year-old woman with spontaneous blood-stained discharge from a single duct of the left nipple for 5 weeks, no palpable lump. NICE NG12: ≥50 with unilateral nipple discharge → suspected cancer pathway; mammography + ultrasound; duct excision (microdochectomy) for diagnosis.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-malignancy | mustNotMiss | critical | FAIL (known gap) | NCCN Guidelines 2025 | Add a CC hint for "Nipple discharge" (nipple_discharge) and an ASSOC_RULES/SITE_RULES pattern for nipple discharge / bloody discharge. |
| flag-2ww | redFlags | critical | FAIL (known gap) | NICE NG12 2015 | Add the NG12 criterion "aged ≥50 with nipple discharge, retraction or other changes of concern in one breast only" to screenForCancer. |
| inv-mammogram | investigationInclude | critical | FAIL (known gap) | NCCN Guidelines 2025; Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 | Map N64.5x (nipple discharge) to the duct_ectasia / nipple-discharge protocol. |
| inv-uss | investigationInclude | critical | FAIL (known gap) | NCCN Guidelines 2025 |  |
| mgmt-no-reassurance-only | managementExclude | critical | PASS |  |  |
| level-at-least-priority | emergencyLevel | quality | FAIL (known gap) |  |  |
| mgmt-duct-excision | managementInclude | quality | FAIL (known gap) | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |

Failure details:

- **mnm-malignancy** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE applied no feature: the "Nipple discharge" template has no CC hint and ASSOC_RULES has no nipple-discharge pattern, so the priors alone give cholecystitis, GORD, PUD.]
- **level-at-least-priority** (web): web.triage: routine (acuity=routine, action=routine_booking, score=0); expected ≥ priority [known gap: Triage routine (score 0): no rule for blood-stained nipple discharge.]
- **flag-2ww** (web): no red flag matched among 7 (web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: screenForCancer only counts nipple discharge together with a lump; NICE NG12 (≥50, unilateral nipple discharge) is not implemented. Triage score 0, routine.]
- **inv-mammogram** (web): no investigation matched among 19 (web.pane.seeded, web.clinicalPrompts) [known gap: N64.52 maps to no protocol and PANE did not reach duct_ectasia, so no imaging is proposed.]
- **inv-uss** (web): no investigation matched among 19 (web.pane.seeded, web.clinicalPrompts) [known gap: As above: no retroareolar ultrasound proposed.]
- **mgmt-duct-excision** (web): no management item matched among 7 (web.clinicalPrompts) [known gap: No plan (no protocol for N64.52).]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*
- **nccn-breast-dx-2025** — NCCN Guidelines — Breast Cancer Screening and Diagnosis (2025), Palpable mass: age <30 ultrasound first; age ≥30 diagnostic mammography + ultrasound; tissue sampling of suspicious findings; nipple discharge (spontaneous, unilateral, single duct, bloody); skin changes. National Comprehensive Cancer Network. NCCN Clinical Practice Guidelines in Oncology: Breast Cancer Screening and Diagnosis (current version at authoring). *(statement wording/numbering not yet verified against the source)*
- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Breast carcinoma; 2. Uterine fibroids; 3. Acute cholecystitis; 4. Colorectal carcinoma; 5. Lower GI bleed / colorectal
- differential web.passive: 1. Breast carcinoma; 2. Acute cholecystitis; 3. CBD stone / obstructive jaundice; 4. Peptic ulcer disease; 5. Reducible groin / abdominal hernia
- differential web.triageSurgical: 1. Nipple discharge
- emergency level: routine (acuity=routine, action=routine_booking, score=0)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, ecog
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (5)

</details>

### Cyclical breast pain (mastalgia) without a lump

#### `breast-pain-cyclical-alone` — 

38-year-old woman with bilateral premenstrual breast pain for 6 months and a normal examination. Reassurance, well-fitting bra, simple analgesia/topical NSAID; no imaging unless focal signs or a lump.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-benign-top3 | mustRankTopK | quality | FAIL (known gap) |  |  |
| level-routine | emergencyLevel | quality | FAIL (known gap) | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010; NICE NG12 2015 |  |
| no-cancer-alarm | mustNotAlarm | quality | PASS |  |  |
| inv-no-imaging-or-biopsy | investigationExclude | quality | PASS | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |
| mgmt-reassurance | managementInclude | quality | FAIL (known gap) | Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) 2010 |  |

Failure details:

- **dx-benign-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE applied no feature (template "Other / general surgical"); priors give cholecystitis, GORD, PUD. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **level-routine** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: "friend had breast cancer" matches the "Possible malignancy" red flag.]
- **mgmt-reassurance** (web): no management item matched among 2 (web.clinicalPrompts) [known gap: N64.4 (mastodynia) maps to no protocol; no mastalgia guidance.]

Guidelines:

- **abs-best-practice-2010** — Best practice diagnostic guidelines for patients presenting with breast symptoms (ABS / RCR, Department of Health) (2010), Triple assessment (clinical examination, age-appropriate imaging, needle biopsy); imaging by age; nipple discharge; breast infection; breast pain. Willett AM, Michell MJ, Lee MJR (eds). Best practice diagnostic guidelines for patients presenting with breast symptoms. London: Department of Health / Association of Breast Surgery; 2010. *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Uterine fibroids; 4. Acute cholecystitis; 5. Systemic lupus erythematosus
- differential web.passive: 1. Fibroadenoma / benign breast lump; 2. Breast carcinoma; 3. Acute cholecystitis; 4. CBD stone / obstructive jaundice; 5. Peptic ulcer disease
- differential web.triageSurgical: 1. Breast cancer; 2. Nipple discharge
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Breast Lump / Breast Disease (15)

</details>

### Caustic (alkali) ingestion

#### `caustic-ingestion-alkali` — 

29-year-old woman 2 hours after deliberately drinking drain cleaner (sodium hydroxide): drooling, odynophagia, oral burns, hoarse voice. Airway assessment, no induced vomiting or neutralisation, nil by mouth, CT/endoscopy to grade injury, psychiatric assessment.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-emergency | emergencyLevel | critical | PASS | WSES guidelines 2019 |  |
| alarm-caustic-airway | mustAlarm | critical | PASS | WSES guidelines 2019 |  |
| flag-self-harm | redFlags | critical | PASS | WSES guidelines 2019 |  |
| mgmt-no-emesis-or-neutralisation | managementExclude | critical | PASS | WSES guidelines 2019 |  |
| inv-ct-or-endoscopy | investigationInclude | quality | PASS | WSES guidelines 2019 |  |
| inv-airway-assessment | investigationInclude | quality | FAIL (known gap) | WSES guidelines 2019 | Add a caustic-ingestion protocol/prompt (WSES 2019: airway first, no emesis/neutralisation/blind NG tube, CT ± endoscopy, psychiatry). |
| mgmt-psychiatric-assessment | managementInclude | quality | FAIL (known gap) | WSES guidelines 2019 | As inv-airway-assessment. |
| mgmt-nil-by-mouth | managementInclude | quality | FAIL (known gap) | WSES guidelines 2019 | As inv-airway-assessment. |
| mgmt-no-blind-ng-tube | managementExclude | quality | PASS | WSES guidelines 2019 |  |

Failure details:

- **inv-airway-assessment** (web): no investigation matched among 25 (web.pane.seeded, web.clinicalPrompts) [known gap: No caustic-ingestion protocol or prompt; nothing mentions airway assessment.]
- **mgmt-psychiatric-assessment** (web): no management item matched among 10 (web.clinicalPrompts) [known gap: Only the triage reason "Mental health crisis"; no plan line.]
- **mgmt-nil-by-mouth** (web): no management item matched among 10 (web.clinicalPrompts) [known gap: No plan output at all for T54.3.]

Guidelines:

- **wses-2019** — WSES guidelines — esophageal emergencies (perforation, caustic ingestion, foreign bodies) (2019), Caustic ingestion: airway assessment first; no induced emesis, neutralisation or blind NG tube; CT to assess transmural necrosis and need for emergency resection; endoscopy for grading in stable patients; psychiatric evaluation after intentional ingestion. Chirica M, Kelly MD, Siboni S, et al. World J Emerg Surg. 2019;14:26. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Acute Appendicitis
- differential web.symptomInference: 1. Epiglottitis; 2. ST-elevation myocardial infarction (STEMI); 3. Oesophageal / gastric carcinoma; 4. Thyroid carcinoma; 5. Acute coronary syndrome (ACS / NSTEMI / STEMI)
- differential web.passive: 1. Epiglottitis; 2. ST-elevation myocardial infarction (STEMI); 3. Oesophageal / gastric carcinoma; 4. Thyroid carcinoma; 5. Acute coronary syndrome (ACS / NSTEMI / STEMI)
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture
- emergency level: emergency (acuity=urgent, action=emergency_now, score=197)
- alarms: Emergency now [web.triage.emergency]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Reproductive-age female with abdominal complaint [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: heart, news2, web:phq9, web:gad7
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: heartburn, nausea_vomiting
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10), Chest Pain — Emergency Redirect (5), Foreign Body Ingestion / Food Bolus (5)

</details>

### Acute cholangitis

#### `cholangitis-tg18-charcot-sepsis` — Charcot's triad with sepsis — TG18 Grade II (base case)

68-year-old woman with RUQ pain, rigors (39.4 °C) and jaundice; WBC 17.8, bilirubin 72 µmol/L, CBD 11 mm with a distal stone. qSOFA 2 (RR 22, SBP 100) without TG18 organ dysfunction: Grade II.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholangitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| alarm-sepsis | mustAlarm | critical | PASS | Surviving Sepsis Campaign guidelines 2021 2021; Tokyo Guidelines 2018 2018 |  |
| score-tg18-calculator | scoreValue | critical | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-blood-cultures | investigationInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| mgmt-biliary-drainage | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Tokyo Guidelines 2018 2018 |  |
| mgmt-antibiotics | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| dx-cholangitis-top1 | mustRankTopK | quality | PASS |  |  |
| mnm-choledocholithiasis | mustNotMiss | quality | PASS |  |  |
| flag-charcot | redFlags | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| score-rec-tg18-cholangitis | scoreRecommended | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-qsofa-calculator | scoreValue | quality | n/a | Sepsis-3 consensus definitions 2016 |  |
| score-qsofa-autofill | scoreValue | quality | n/a | Sepsis-3 consensus definitions 2016 |  |
| inv-lfts | investigationInclude | quality | PASS |  |  |
| inv-coagulation | investigationInclude | quality | PASS |  |  |
| inv-mrcp-or-eus | investigationInclude | quality | PASS |  |  |
| mgmt-drainage-in-generated-plan | managementInclude | quality | FAIL (known gap) |  |  |
| mgmt-iv-fluids | managementInclude | quality | PASS |  |  |
| mgmt-interval-cholecystectomy | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade2 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **score-tg18-calculator** (web): expected = 2; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: Web clinical-scores.ts (ClinicalScoresPanel) omits the WBC criterion from the Grade II count and returns Grade I; clinical-scales.ts is correct here.]
- **score-tg18-autofill** (web): expected = 2; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: Web clinical-scores needs manual imaging ticks before it will diagnose, so auto-fill reads "criteria not met".]
- **mgmt-drainage-in-generated-plan** (web): no management item matched among 13 (web.plan) [known gap: dx-variants: 'ascending cholangitis' is a Grade I keyword, Grade I is checked first, and Grade I phases exclude 'surgical', so ERCP disappears from the generated plan.]
- **variant-grade2** (web): detected cholangitis_grade1 in group Cholangitis; expected cholangitis_grade2 [known gap: dx-variants selects Grade I from 'ascending cholangitis'.]

Guidelines:

- **tg18-dx-cholangitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholangitis (2018), Diagnosis A (fever/chills; inflammatory response) + B (jaundice T-Bil ≥2 mg/dL; abnormal LFTs) + C (biliary dilatation; aetiology on imaging). Grade II: any TWO of WBC >12,000 or <4,000/mm³, fever ≥39 °C, age ≥75, T-Bil ≥5 mg/dL, albumin <0.7 × lower limit of normal. Grade III: organ dysfunction.. Kiriyama S, Kozaka K, Takada T, et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholangitis. J Hepatobiliary Pancreat Sci. 2018;25:17–30. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholangitis** — Tokyo Guidelines 2018 — initial management of acute biliary infection and flowchart for acute cholangitis (2018), Grade I: antibiotics, drainage if no response; Grade II: early biliary drainage + antibiotics; Grade III: organ support then urgent drainage; treat the aetiology (e.g. cholecystectomy) after recovery. Miura F, Okamoto K, Takada T, et al. Tokyo Guidelines 2018: initial management of acute biliary infection and flowchart for acute cholangitis. J Hepatobiliary Pancreat Sci. 2018;25:31–40. *(statement wording/numbering not yet verified against the source)*
- **tg18-drainage** — Tokyo Guidelines 2018 — indications and techniques of biliary drainage for acute cholangitis (2018), Endoscopic transpapillary drainage is first line; percutaneous transhepatic drainage when endoscopy fails or is unavailable. Mukai S, Itoi T, Baron TH, et al. J Hepatobiliary Pancreat Sci. 2017;24:537–49 (TG18 update). *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy (2018), Blood cultures in Grade II/III; antimicrobial choice by severity. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*
- **ssc-2021** — Surviving Sepsis Campaign guidelines 2021 (2021), Blood cultures before antimicrobials; timely antimicrobials; source control. Evans L, Rhodes A, Alhazzani W, et al. Crit Care Med. 2021;49:e1063–e1143. *(statement wording/numbering not yet verified against the source)*
- **sepsis-3** — Sepsis-3 consensus definitions (2016), qSOFA: RR ≥22/min, altered mentation, SBP ≤100 mmHg. Singer M, Deutschman CS, Seymour CW, et al. JAMA. 2016;315:801–10. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholangitis; 2. Acute Cholecystitis; 3. Choledocholithiasis
- differential web.symptomInference: 1. Acute cholangitis; 2. CBD stone / obstructive jaundice; 3. Biliary atresia; 4. Cholangiocarcinoma; 5. Liver disease / hepatitis / cirrhosis
- differential web.passive: 1. Acute cholecystitis; 2. CBD stone / obstructive jaundice; 3. Biliary atresia; 4. Liver disease / hepatitis / cirrhosis; 5. Cholangiocarcinoma
- differential web.triageSurgical: 1. Acute cholangitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=195)
- alarms: Emergency now [web.triage.emergency]; Charcot's triad (RUQ pain + fever + jaundice) [web.clinicalPrompts.safety]; Courvoisier's sign (palpable non-tender gallbladder + jaundice) [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Murphy's sign positive [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 17.8 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; Fever 39.4°C + HR 112 bpm [web.clinicalPrompts.safety]
- recommended scores: tg18-cholangitis, qsofa, asge-cbd, news2, caprini, asa, rcri, cfs
- score values: tg18-cholangitis/calculator@web.scaleCalculator.tg18-cholangitis=2; tg18-cholangitis/calculator@web.scoreCalculator.tg18-cholangitis=1; tg18-cholangitis/autofill@web.scoreCalculator.tg18-cholangitis=0
- dx variant: cholangitis_grade1 (Cholangitis)
- note: PANE features applied: ruq_pain, nausea_vomiting, fever, jaundice, rigors
- note: AssessmentTab ManagementPanel protocol: cholangitis (from PANE top)
- note: PlanTab protocol: cholangitis (from ICD)
- note: no web calculator for score form 'qsofa'
- note: matchPathways: Jaundice Workup (30), Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (20), ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct) (10)

</details>

#### `cholangitis-tg18-grade1-single-criterion` — TG18 Grade I (mild) — only one Grade II criterion (age ≥75)

78-year-old man with 3 days of intermittent RUQ pain, fever 38.4 °C and jaundice; WBC 11.2, bilirubin 58 µmol/L, albumin 36, CBD 9 mm. One Grade II criterion (age) only, no organ dysfunction: TG18 Grade I.

Permutation of `cholangitis-tg18-charcot-sepsis`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholangitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-antibiotics | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Tokyo Guidelines 2018 2018 |  |
| mnm-malignant-obstruction | mustNotMiss | quality | FAIL (known gap) |  |  |
| no-sepsis-alarm-mild | mustNotAlarm | quality | PASS |  |  |
| score-rec-tg18-cholangitis | scoreRecommended | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-calculator | scoreValue | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-lfts | investigationInclude | quality | PASS |  |  |
| inv-mrcp-or-eus | investigationInclude | quality | PASS |  |  |
| inv-blood-cultures | investigationInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-drainage-plan | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade1 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **mnm-malignant-obstruction** (web): not in top 3 of web.pane: 1. Acute Cholangitis \| 2. Inguinal / Femoral Hernia \| 3. Choledocholithiasis; also in web.symptomInference#4, web.passive#3 [known gap: PANE top 3 includes Inguinal / Femoral Hernia (male/age prior modifiers) instead.]
- **score-tg18-calculator** (web): expected = 1; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: iOS TokyoCholangitis and web clinical-scales count ONE Grade II criterion as Grade II (TG18 requires two).]
- **score-tg18-autofill** (web): expected = 1; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill: age >75 alone → Grade II; web clinical-scores: criteria not met without manual imaging ticks.]
- **variant-grade1** (web): detected (none) in group Cholangitis; expected cholangitis_grade1 [known gap: dx-variants keywords need 'mild cholangitis' word order; 'Mild acute cholangitis' selects no variant.]

Guidelines:

- **tg18-dx-cholangitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholangitis (2018), Grade II: any two of WBC >12,000 or <4,000/mm³, fever ≥39 °C, age ≥75, T-Bil ≥5 mg/dL, hypoalbuminaemia (<0.7 × LLN). Kiriyama S, Kozaka K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:17–30. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholangitis** — Tokyo Guidelines 2018 — flowchart for acute cholangitis (2018), Grade I: antibiotics; biliary drainage if no response within 24 h; treat the aetiology (ERCP for CBD stones). Miura F, Okamoto K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:31–40. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy (2018), Antimicrobial choice by severity. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholangitis; 2. Inguinal / Femoral Hernia; 3. Choledocholithiasis
- differential web.symptomInference: 1. Acute cholangitis; 2. CBD stone / obstructive jaundice; 3. Liver disease / hepatitis / cirrhosis; 4. Cholangiocarcinoma; 5. Pancreatic adenocarcinoma
- differential web.passive: 1. CBD stone / obstructive jaundice; 2. Liver disease / hepatitis / cirrhosis; 3. Cholangiocarcinoma; 4. Biliary atresia; 5. Neonatal jaundice
- differential web.triageSurgical: 1. Acute cholangitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=192)
- alarms: Emergency now [web.triage.emergency]; Charcot's triad (RUQ pain + fever + jaundice) [web.clinicalPrompts.safety]; Courvoisier's sign (palpable non-tender gallbladder + jaundice) [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; Hepatic lesion on imaging [web.clinicalPrompts.safety]
- recommended scores: tg18-cholangitis, qsofa, asge-cbd, news2, caprini, asa, rcri, cfs
- score values: tg18-cholangitis/calculator@web.scaleCalculator.tg18-cholangitis=2; tg18-cholangitis/calculator@web.scoreCalculator.tg18-cholangitis=1; tg18-cholangitis/autofill@web.scoreCalculator.tg18-cholangitis=0
- dx variant: (none) (Cholangitis)
- note: PANE features applied: ruq_pain, colicky_pain, fever, jaundice
- note: AssessmentTab ManagementPanel protocol: cholangitis (from ICD)
- note: PlanTab protocol: cholangitis (from ICD)
- note: matchPathways: Jaundice Workup (25), Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (15), ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct) (10)

</details>

#### `cholangitis-tg18-grade3-reynolds` — TG18 Grade III (severe) — Reynolds' pentad, septic shock, on apixaban

82-year-old woman found confused: fever 39.6 °C, jaundice, BP 78/44 needing noradrenaline, oliguria, creatinine 212, INR 1.8, platelets 74, lactate 5.2; CBD 14 mm with stones. On apixaban for AF.

Permutation of `cholangitis-tg18-charcot-sepsis`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholangitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-emergency | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| alarm-sepsis | mustAlarm | critical | PASS | Surviving Sepsis Campaign guidelines 2021 2021 |  |
| alarm-haemodynamic | mustAlarm | critical | PASS | Surviving Sepsis Campaign guidelines 2021 2021 |  |
| score-tg18-calculator | scoreValue | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | critical | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-blood-cultures | investigationInclude | critical | PASS | Surviving Sepsis Campaign guidelines 2021 2021; Tokyo Guidelines 2018 2018 |  |
| mgmt-urgent-biliary-drainage | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Tokyo Guidelines 2018 2018 |  |
| mgmt-organ-support | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| mgmt-broad-spectrum-antibiotics | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| mnm-septic-shock | mustNotMiss | quality | FAIL (known gap) |  |  |
| flag-anticoagulant | redFlags | quality | PASS |  |  |
| flag-reynolds | redFlags | quality | PASS |  |  |
| score-rec-tg18-cholangitis | scoreRecommended | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| score-qsofa-autofill | scoreValue | quality | n/a | Sepsis-3 consensus definitions 2016 |  |
| inv-lactate | investigationInclude | quality | PASS | Surviving Sepsis Campaign guidelines 2021 2021 |  |
| inv-coagulation | investigationInclude | quality | PASS |  |  |
| mgmt-vasopressor-fluids | managementInclude | quality | PASS | Surviving Sepsis Campaign guidelines 2021 2021 |  |
| mgmt-anticoagulant-plan | managementInclude | quality | PASS |  |  |
| mgmt-no-surgery-first | managementExclude | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade3 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **mnm-septic-shock** (web): not in top 3 of web.pane: 1. Acute Cholangitis \| 2. Acute Cholecystitis \| 3. Acute Diverticulitis; also in web.symptomInference#2, web.passive#2 [known gap: PANE has no sepsis node; symptom inference ranks sepsis #2. iOS: fallback mode: the built-in jaundice list (5 candidates) does not contain this diagnosis.]
- **score-tg18-autofill** (web): expected = 3; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill never sets organ-dysfunction fields (returns Grade II from age/temperature/WBC/bilirubin); web returns "criteria not met".]
- **mgmt-no-surgery-first** (web): forbidden management item present in web.clinicalPrompts: "• emergency laparotomy consent - source control; icu post-operatively." [known gap: Web clinical prompt: 'Emergency laparotomy consent — source control' for Grade III cholangitis, instead of drainage first.]
- **variant-grade3** (web): detected (none) in group Cholangitis; expected cholangitis_grade3 [known gap: dx-variants needs 'severe cholangitis' word order; 'Severe acute cholangitis' selects no variant.]

Guidelines:

- **tg18-dx-cholangitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholangitis (2018), Grade III: cardiovascular (dopamine ≥5 µg/kg/min or any noradrenaline), neurological (disturbance of consciousness), respiratory (PaO₂/FiO₂ <300), renal (oliguria, creatinine >2.0 mg/dL), hepatic (PT-INR >1.5), haematological (platelets <100,000/mm³). Kiriyama S, Kozaka K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:17–30. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholangitis** — Tokyo Guidelines 2018 — flowchart for acute cholangitis (2018), Grade III: appropriate organ support and antibiotics, then urgent biliary drainage. Miura F, Okamoto K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:31–40. *(statement wording/numbering not yet verified against the source)*
- **tg18-drainage** — Tokyo Guidelines 2018 — biliary drainage for acute cholangitis (2018), Endoscopic transpapillary drainage first line; percutaneous when not possible; surgery only when both fail. Mukai S, Itoi T, Baron TH, et al. Indications and techniques of biliary drainage for acute cholangitis in updated Tokyo Guidelines 2018. J Hepatobiliary Pancreat Sci. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy (2018), Grade III regimens; blood cultures. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*
- **ssc-2021** — Surviving Sepsis Campaign guidelines 2021 (2021), Septic shock: antimicrobials within 1 h, blood cultures first, fluids, noradrenaline first-line vasopressor, source control. Evans L, Rhodes A, Alhazzani W, et al. Crit Care Med. 2021;49:e1063–e1143. *(statement wording/numbering not yet verified against the source)*
- **sepsis-3** — Sepsis-3 consensus definitions (2016), qSOFA and septic shock definitions. Singer M, Deutschman CS, Seymour CW, et al. JAMA. 2016;315:801–10. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholangitis; 2. Acute Cholecystitis; 3. Acute Diverticulitis
- differential web.symptomInference: 1. Acute cholangitis; 2. Sepsis / systemic infection; 3. CBD stone / obstructive jaundice; 4. Liver disease / hepatitis / cirrhosis; 5. Malaria
- differential web.passive: 1. Acute cholangitis; 2. Sepsis / systemic infection; 3. Malaria; 4. Leptospirosis; 5. Liver disease / hepatitis / cirrhosis
- differential web.triageSurgical: 1. Acute cholangitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=374)
- alarms: Hypotension [web.triage.vitalRedFlags]; Tachycardia [web.triage.vitalRedFlags]; Tachypnoea [web.triage.vitalRedFlags]; High fever [web.triage.vitalRedFlags]; Low SpO₂ [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; Charcot's triad (RUQ pain + fever + jaundice) [web.clinicalPrompts.safety]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Fever 39.6°C + HR 128 bpm + SBP 78 mmHg — septic shock [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Anticoagulation therapy [web.clinicalPrompts.safety]; WBC 24.8 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; INR 1.8 — coagulopathy [web.clinicalPrompts.safety]; Creatinine 212 μmol/L — elevated [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; SpO₂ 91% — hypoxia [web.clinicalPrompts.safety]; Albumin 24 g/L — hypoalbuminaemia [web.clinicalPrompts.safety]
- recommended scores: tg18-cholangitis, cha2ds2-vasc, qsofa, gcs, asge-cbd, web:wagner, news2, caprini, has-bled, asa, rcri, cfs
- score values: tg18-cholangitis/calculator@web.scaleCalculator.tg18-cholangitis=3; tg18-cholangitis/calculator@web.scoreCalculator.tg18-cholangitis=3; tg18-cholangitis/autofill@web.scoreCalculator.tg18-cholangitis=0
- dx variant: (none) (Cholangitis)
- note: PANE features applied: ruq_pain, fever, jaundice, rigors
- note: AssessmentTab ManagementPanel protocol: cholangitis (from PANE top)
- note: PlanTab protocol: cholangitis (from ICD)
- note: no web calculator for score form 'qsofa'
- note: matchPathways: Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (22), Jaundice Workup (20), Pancreatic Mass / Cyst (17)

</details>

### Acute calculous cholecystitis

#### `cholecystitis-tg18-grade1` — TG18 Grade I (mild) — base case

48-year-old woman, 30 h of constant RUQ pain after a fatty meal, fever 38.2 °C, Murphy's sign, WBC 13.1, CRP 86, ultrasound shows gallstones with wall thickening and pericholecystic fluid. No Grade II/III criteria.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholecystitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-calculator | scoreValue | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-lap-cholecystectomy | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| mnm-cbd-stone-or-cholangitis | mustNotMiss | quality | PASS |  |  |
| no-sepsis-alarm-grade1 | mustNotAlarm | quality | PASS |  |  |
| score-rec-tg18-cholecystitis | scoreRecommended | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | quality | FAIL (known gap) |  |  |
| inv-ultrasound | investigationInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| inv-lfts | investigationInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| inv-fbc-crp | investigationInclude | quality | PASS |  |  |
| mgmt-early-timing | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-antibiotics | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-analgesia | managementInclude | quality | PASS |  |  |
| mgmt-no-drainage-first-line-grade1 | managementExclude | quality | PASS |  |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade1 | dxVariant | quality | PASS | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **score-rec-tg18-cholecystitis** (web): tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, news2, asa, stop-bang [known gap: Web CDS has a TG18 cholangitis rule but none for cholecystitis.]
- **score-tg18-autofill** (web): expected = 1; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill sets only WBC >18 (Grade II criterion) and never the local-signs field, so it reads "criteria not met"; web clinical-scores needs manual Murphy/imaging ticks.]

Guidelines:

- **tg18-dx-cholecystitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholecystitis (2018), TG18 diagnostic criteria (A local, B systemic, C imaging) and severity grading (Grade III organ dysfunction; Grade II: WBC >18,000/mm³, palpable tender RUQ mass, duration >72 h, marked local inflammation; Grade I otherwise). Yokoe M, Hata J, Takada T, et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholecystitis. J Hepatobiliary Pancreat Sci. 2018;25:41–54. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholecystitis** — Tokyo Guidelines 2018 — flowchart for the management of acute cholecystitis (2018), Grade I: early laparoscopic cholecystectomy if CCI ≤5 and ASA ≤2. Okamoto K, Suzuki K, Takada T, et al. Tokyo Guidelines 2018: flowchart for the management of acute cholecystitis. J Hepatobiliary Pancreat Sci. 2018;25:55–72. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy for acute cholangitis and cholecystitis (2018), Antimicrobial selection by severity; blood cultures for Grade II/III. Gomi H, Solomkin JS, Schlossberg D, et al. Tokyo Guidelines 2018: antimicrobial therapy for acute cholangitis and cholecystitis. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Cholangitis; 3. Acute Appendicitis
- differential web.symptomInference: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute alcoholic pancreatitis
- differential web.passive: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute alcoholic pancreatitis
- differential web.triageSurgical: 1. Acute cholangitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=213)
- alarms: Emergency now [web.triage.emergency]; Charcot's triad (RUQ pain + fever + jaundice) [web.clinicalPrompts.safety]; Courvoisier's sign (palpable non-tender gallbladder + jaundice) [web.clinicalPrompts.safety]; Reproductive-age female with abdominal complaint [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Murphy's sign positive [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]
- recommended scores: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, news2, asa, stop-bang
- score values: tg18-cholecystitis/calculator@web.scoreCalculator.tg18-cholecystitis=1; tg18-cholecystitis/autofill@web.scoreCalculator.tg18-cholecystitis=0
- dx variant: cholecystitis_grade1 (Acute Cholecystitis)
- note: PANE features applied: ruq_pain, nausea_vomiting, fever, fatty_food_trigger
- note: AssessmentTab ManagementPanel protocol: cholecystitis (from PANE top)
- note: PlanTab protocol: cholecystitis (from ICD)
- note: matchPathways: Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (17), Jaundice Workup (15), ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct) (7)

</details>

#### `cholecystitis-tg18-grade2` — TG18 Grade II (moderate) — palpable tender RUQ mass is the only Grade II criterion

57-year-old diabetic man, 60 h of RUQ pain, fever 38.6 °C, tender palpable RUQ mass, WBC 15.6, CRP 188; ultrasound shows a distended, thick-walled gallbladder with pericholecystic inflammation. No organ dysfunction.

Permutation of `cholecystitis-tg18-grade1`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholecystitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-calculator | scoreValue | critical | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| mgmt-lap-cholecystectomy | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| flag-diabetes | redFlags | quality | PASS |  |  |
| score-rec-tg18-cholecystitis | scoreRecommended | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-blood-cultures | investigationInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| inv-glucose | investigationInclude | quality | PASS |  |  |
| mgmt-gb-drainage-option | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-antibiotics | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-diabetes-plan | managementInclude | quality | PASS |  |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade2 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **score-rec-tg18-cholecystitis** (web): tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, web:wagner, news2, caprini, asa, rcri [known gap: No TG18 cholecystitis CDS rule on web.]
- **score-tg18-calculator** (web): expected = 2; got web.scoreCalculator.tg18-cholecystitis=1 (Mild cholecystitis — elective laparoscopic cholecystectomy) [known gap: Neither calculator has a "palpable tender RUQ mass" Grade II criterion (iOS folds it into Grade I local signs; web grades II only on WBC >18).]
- **variant-grade2** (web): detected cholecystitis_grade1 in group Acute Cholecystitis; expected cholecystitis_grade2 [known gap: dx-variants: the Grade I variant lists the bare keyword 'cholecystitis' and is checked first, so any cholecystitis assessment selects Grade I.]

Guidelines:

- **tg18-dx-cholecystitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholecystitis (2018), Grade II criteria: WBC >18,000/mm³; palpable tender mass in the RUQ; duration >72 h; marked local inflammation (any one). Yokoe M, Hata J, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:41–54. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholecystitis** — Tokyo Guidelines 2018 — flowchart for the management of acute cholecystitis (2018), Grade II: early laparoscopic cholecystectomy in an advanced centre if CCI ≤5 and ASA ≤2; otherwise antibiotics and urgent/early gallbladder drainage if not responding. Okamoto K, Suzuki K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:55–72. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy for acute cholangitis and cholecystitis (2018), Blood cultures in Grade II/III; antimicrobial choice by severity. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Inguinal / Femoral Hernia; 3. Acute Appendicitis
- differential web.symptomInference: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute alcoholic pancreatitis
- differential web.passive: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute mesenteric ischaemia
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=197)
- alarms: Emergency now [web.triage.emergency]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Murphy's sign positive [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 15.6 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; Fever 38.6°C + HR 104 bpm [web.clinicalPrompts.safety]
- recommended scores: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, web:wagner, news2, caprini, asa, rcri
- score values: tg18-cholecystitis/calculator@web.scoreCalculator.tg18-cholecystitis=1; tg18-cholecystitis/autofill@web.scoreCalculator.tg18-cholecystitis=0
- dx variant: cholecystitis_grade1 (Acute Cholecystitis)
- note: PANE features applied: ruq_pain, nausea_vomiting, fever
- note: AssessmentTab ManagementPanel protocol: cholecystitis (from PANE top)
- note: PlanTab protocol: cholecystitis (from ICD)
- note: matchPathways: Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (17), ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct) (7), Pancreatic Mass / Cyst (7)

</details>

#### `cholecystitis-tg18-grade3-organ-dysfunction` — TG18 Grade III (severe) — septic shock, confusion, AKI, thrombocytopenia; penicillin anaphylaxis

71-year-old man, 4 days of RUQ pain and fever, new confusion, oliguria, BP 82/48 on noradrenaline, creatinine 238, platelets 88, lactate 4.6. Ultrasound: acute calculous cholecystitis, CBD not dilated. Penicillin anaphylaxis.

Permutation of `cholecystitis-tg18-grade1`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholecystitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-emergency | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign 2021 |  |
| alarm-sepsis | mustAlarm | critical | PASS | Surviving Sepsis Campaign 2021; Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3) 2016 |  |
| alarm-haemodynamic | mustAlarm | critical | PASS | Surviving Sepsis Campaign 2021 |  |
| flag-penicillin-allergy | redFlags | critical | PASS |  |  |
| score-tg18-calculator | scoreValue | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | critical | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-blood-cultures | investigationInclude | critical | PASS | Surviving Sepsis Campaign 2021; Tokyo Guidelines 2018 2018 |  |
| mgmt-gb-drainage | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-organ-support | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign 2021 |  |
| mgmt-no-penicillin-in-anaphylaxis | managementExclude | critical | FAIL (known gap) |  |  |
| mnm-cholangitis | mustNotMiss | quality | PASS |  |  |
| flag-organ-support | redFlags | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-rec-tg18-cholecystitis | scoreRecommended | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-rec-news2 | scoreRecommended | quality | PASS | Surviving Sepsis Campaign 2021; Royal College of Physicians 2017 |  |
| score-qsofa-autofill | scoreValue | quality | n/a | Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3) 2016 |  |
| inv-lactate | investigationInclude | quality | PASS | Surviving Sepsis Campaign 2021 |  |
| inv-coagulation | investigationInclude | quality | PASS |  |  |
| mgmt-gb-drainage-in-generated-plan | managementInclude | quality | FAIL (known gap) |  |  |
| mgmt-non-penicillin-antibiotic | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-no-early-cholecystectomy-in-shock | managementExclude | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade3 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **flag-organ-support** (web): no red flag matched among 47 (web.triage.reasons, web.header.allergies, web.protocol.redFlags, web.dxVariant.urgencyNote, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.vitalRedFlags, web.triage.emergency) [known gap: No ICU/organ-support flag among web red flags.]
- **score-rec-tg18-cholecystitis** (web): tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, gcs, asge-cbd, news2, caprini, asa, rcri, cfs [known gap: No TG18 cholecystitis CDS rule on web.]
- **score-tg18-autofill** (web): expected = 3; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill ignores the organ-dysfunction data in the record (SBP 82 on noradrenaline, AVPU C, creatinine 238, platelets 88) and returns Grade II from WBC alone; web returns "criteria not met".]
- **mgmt-gb-drainage-in-generated-plan** (web): no management item matched among 13 (web.plan) [known gap: iOS radiation plan text has no drainage step (only an IR referral chip); web PlanTab selects the Grade I variant, which filters out the conservative-phase cholecystostomy line.]
- **mgmt-no-penicillin-in-anaphylaxis** (web): forbidden management item present in web.plan: "[immediate] iv antibiotics: co-amoxiclav 1.2 g tds or piperacillin-tazobactam for severe." (+5 more) [known gap: Plan templates suggest co-amoxiclav / piperacillin-tazobactam regardless of the recorded penicillin anaphylaxis.]
- **mgmt-no-early-cholecystectomy-in-shock** (web): forbidden management item present in web.managementPanel.keyPoints: "early laparoscopic cholecystectomy (within 72 h) reduces complications vs interval surgery." [known gap: iOS TG18 Grade III recommendation offers 'emergency cholecystectomy' as an equal alternative; web key points recommend early cholecystectomy without grade qualification.]
- **variant-grade3** (web): detected cholecystitis_grade1 in group Acute Cholecystitis; expected cholecystitis_grade3 [known gap: dx-variants selects Grade I ('cholecystitis' keyword checked first).]

Guidelines:

- **tg18-dx-cholecystitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholecystitis (2018), Grade III: dysfunction of any one organ/system — cardiovascular (hypotension needing dopamine ≥5 µg/kg/min or any noradrenaline), neurological (decreased consciousness), respiratory (PaO₂/FiO₂ <300), renal (oliguria, creatinine >2.0 mg/dL), hepatic (PT-INR >1.5), haematological (platelets <100,000/mm³). Yokoe M, Hata J, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:41–54. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholecystitis** — Tokyo Guidelines 2018 — flowchart for the management of acute cholecystitis (2018), Grade III: organ support and antibiotics; early laparoscopic cholecystectomy only with FOSF, no negative predictive factors (jaundice, neurological or respiratory dysfunction), CCI ≤3, ASA ≤2 in an advanced centre; otherwise urgent/early gallbladder drainage. Okamoto K, Suzuki K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:55–72. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy (2018), Grade III regimens; blood cultures in Grade II/III. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*
- **ssc-2021** — Surviving Sepsis Campaign — international guidelines for management of sepsis and septic shock 2021 (2021), Screening (against qSOFA alone); blood cultures before antimicrobials; antimicrobials within 1 h for probable septic shock; source control. Evans L, Rhodes A, Alhazzani W, et al. Crit Care Med. 2021;49:e1063–e1143. *(statement wording/numbering not yet verified against the source)*
- **sepsis-3** — Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3) (2016), qSOFA criteria: RR ≥22, altered mentation, SBP ≤100. Singer M, Deutschman CS, Seymour CW, et al. JAMA. 2016;315:801–10. *(statement wording/numbering not yet verified against the source)*
- **rcp-news2-2017** — Royal College of Physicians — National Early Warning Score (NEWS) 2 (2017), Aggregate score and clinical response thresholds. Royal College of Physicians. National Early Warning Score (NEWS) 2. London: RCP; 2017. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Cholangitis; 3. Inguinal / Femoral Hernia
- differential web.symptomInference: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Sepsis / systemic infection; 4. Hepatocellular carcinoma (HCC); 5. Meningitis / encephalitis
- differential web.passive: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Sepsis / systemic infection; 4. Meningitis / encephalitis; 5. UTI (paediatric)
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=274)
- alarms: Hypotension [web.triage.vitalRedFlags]; Tachycardia [web.triage.vitalRedFlags]; Tachypnoea [web.triage.vitalRedFlags]; Low SpO₂ [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; Fever 39.1°C + HR 124 bpm + SBP 82 mmHg — septic shock [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Murphy's sign positive [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 22.4 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; Creatinine 238 μmol/L — elevated [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; SpO₂ 93% — hypoxia [web.clinicalPrompts.safety]; Albumin 26 g/L — hypoalbuminaemia [web.clinicalPrompts.safety]
- recommended scores: alvarado, tg18-cholangitis, ranson, qsofa, gcs, asge-cbd, news2, caprini, asa, rcri, cfs
- score values: tg18-cholecystitis/calculator@web.scoreCalculator.tg18-cholecystitis=3; tg18-cholecystitis/autofill@web.scoreCalculator.tg18-cholecystitis=0
- dx variant: cholecystitis_grade1 (Acute Cholecystitis)
- note: PANE features applied: ruq_pain, nausea_vomiting, fever
- note: AssessmentTab ManagementPanel protocol: cholecystitis (from ICD)
- note: PlanTab protocol: cholecystitis (from ICD)
- note: no web calculator for score form 'qsofa'
- note: matchPathways: Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (10), Wound Management (Acute / Chronic / SSI) (5)

</details>

### Uninvestigated dyspepsia (no alarm features)

#### `dyspepsia-young-no-alarm-test-and-treat` — 

32-year-old woman with 3 months of epigastric burning after meals, no alarm features, no NSAIDs. NICE CG184 / Maastricht VI: H. pylori test-and-treat (or 4 weeks of full-dose PPI); no endoscopy.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-dyspepsia-causes-top3 | mustRankTopK | quality | PASS | NICE CG184 2014 |  |
| level-routine | emergencyLevel | quality | FAIL (known gap) | NICE CG184 2014 | adaptive-triage: negation handling (see gord-no-alarm-empirical-ppi). |
| no-cancer-alarm | mustNotAlarm | quality | PASS | NICE NG12 2015 |  |
| inv-hpylori-non-invasive | investigationInclude | quality | FAIL (known gap) | NICE CG184 2014; Maastricht VI/Florence consensus report 2022 | Add a dyspepsia (K30/R10.13) protocol: CG184 test-and-treat or 4-week PPI; NG12 alarm check. |
| inv-no-urgent-ogd | investigationExclude | quality | PASS | NICE CG184 2014; NICE NG12 2015 |  |
| mgmt-test-and-treat-or-ppi | managementInclude | quality | PASS | NICE CG184 2014; Maastricht VI/Florence consensus report 2022 |  |
| mgmt-lifestyle | managementInclude | quality | PASS | NICE CG184 2014 |  |

Failure details:

- **level-routine** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=40); expected ≤ priority [known gap: Same-day call: adaptiveTriage reads CC+HPI free text without negation — "No family history of stomach cancer" gives "Possible malignancy" (the word "cancer") and "No vomiting" gives "Vomiting or possible dehydration".]
- **inv-hpylori-non-invasive** (web): no investigation matched among 16 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for K30 (uninvestigated/functional dyspepsia); the GORD management panel (PANE top) lists H. pylori only as a routine investigation, which is not seeded.]

Guidelines:

- **nice-cg184** — NICE CG184 — Gastro-oesophageal reflux disease and dyspepsia in adults: investigation and management (2014), Uninvestigated dyspepsia without alarm features: lifestyle advice; offer either H. pylori test-and-treat or full-dose PPI for 4 weeks (either first); endoscopy only per NG12 criteria. National Institute for Health and Care Excellence. Clinical guideline CG184. London: NICE; 2014 (last updated 2019). *(statement wording/numbering not yet verified against the source)*
- **maastricht-6** — Maastricht VI/Florence consensus report — management of Helicobacter pylori infection (2022), Test-and-treat strategy for uninvestigated dyspepsia in young patients without alarm features; urea breath test or monoclonal stool antigen; stop PPI 2 weeks before testing. Malfertheiner P, Megraud F, Rokkas T, et al. Gut. 2022;71:1724–1762. *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), No NG12 criterion met (age <55, no weight loss, no dysphagia). National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Acute Cholecystitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Irritable bowel syndrome (IBS); 3. Chronic pancreatitis; 4. Perforated peptic ulcer; 5. Acute alcoholic pancreatitis
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Irritable bowel syndrome (IBS); 3. Chronic pancreatitis; 4. Perforated peptic ulcer; 5. Acute alcoholic pancreatitis
- differential web.triageSurgical: 1. Gastric cancer
- emergency level: urgent (acuity=priority, action=same_day_call, score=40)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: ranson, news2, web:gerdq
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, heartburn, nausea_vomiting, antacid_relief
- note: AssessmentTab ManagementPanel protocol: gord (from PANE top)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10)

</details>

### Oesophageal carcinoma (progressive dysphagia)

#### `dysphagia-progressive-over55` — 

67-year-old man, smoker and drinker: 3 months of progressive dysphagia (solids, now soft food) and 8 kg weight loss. NICE NG12: urgent direct-access OGD within 2 weeks.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-oesophageal-cancer-top3 | mustRankTopK | critical | FAIL (known gap) | NICE NG12 2015 | socrates-to-features.ts: CC hint /dysphag\|swallow/ → dysphagia_progressive; pane-engine: age ≥55 modifier for oesophageal/gastric carcinoma. |
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| flag-dysphagia-cancer | redFlags | critical | PASS | NICE NG12 2015 |  |
| inv-ogd | investigationInclude | critical | PASS | NICE NG12 2015 |  |
| flag-weight-loss | redFlags | quality | PASS | NICE NG12 2015 |  |
| inv-staging-ct | investigationInclude | quality | PASS | NICE NG12 2015 |  |
| mgmt-urgent-two-week-ogd | managementInclude | quality | PASS | NICE NG12 2015 |  |
| mgmt-no-empirical-ppi-only | managementExclude | quality | PASS | NICE CG184 2014 |  |

Failure details:

- **dx-oesophageal-cancer-top3** (web): not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Inguinal / Femoral Hernia \| 3. Hiatus Hernia; also in web.symptomInference#1, web.passive#2 [known gap: PANE top 3: GORD, inguinal hernia, hiatus hernia. PANE never gets dysphagia_progressive: the "Dysphagia" CC template has no CC hint and the iOS dysphagia chip set has no "Dysphagia" association to scan, so only weight_loss/regurgitation/heartburn reach it; the male hernia prior modifier does the rest. Symptom inference ranks oesophageal/gastric carcinoma #1.]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Offer urgent direct access upper GI endoscopy (within 2 weeks) to assess for oesophageal or stomach cancer in people with dysphagia (any age), or aged ≥55 with weight loss and any of upper abdominal pain, reflux or dyspepsia. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*
- **nice-cg184** — NICE CG184 — Gastro-oesophageal reflux disease and dyspepsia in adults: investigation and management (2014), People with alarm features are referred under NG12 rather than managed with empirical PPI. National Institute for Health and Care Excellence. Clinical guideline CG184. London: NICE; 2014 (last updated 2019). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Inguinal / Femoral Hernia; 3. Hiatus Hernia
- differential web.symptomInference: 1. Oesophageal / gastric carcinoma; 2. Occult malignancy / systemic disease; 3. GORD / acid reflux / oesophagitis; 4. Gastric carcinoma; 5. Colorectal carcinoma
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Oesophageal / gastric carcinoma; 3. Occult malignancy / systemic disease; 4. Gastric carcinoma; 5. Colorectal carcinoma
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 3. GORD with oesophagitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=87)
- alarms: Emergency now [web.triage.emergency]; Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, web:gerdq, asa, cfs, ecog
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, weight_loss, heartburn, regurgitation
- note: AssessmentTab ManagementPanel protocol: oesophageal_carcinoma (from ICD)
- note: PlanTab protocol: oesophageal_carcinoma (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (22), Foreign Body Ingestion / Food Bolus (7)

</details>

### Benign peptic oesophageal stricture (progressive dysphagia)

#### `dysphagia-progressive-under55` — Age 38, no weight loss (NG12 applies at any age)

38-year-old woman with long-standing heartburn and 2 months of progressive dysphagia to solids, no weight loss. NG12: dysphagia at any age → urgent OGD. (Final diagnosis: peptic stricture.)

Permutation of `dysphagia-progressive-over55`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| flag-dysphagia | redFlags | critical | PASS | NICE NG12 2015 |  |
| inv-ogd | investigationInclude | critical | PASS | NICE NG12 2015 |  |
| dx-stricture-or-gord-top3 | mustRankTopK | quality | PASS | NICE CG184 2014 |  |
| mnm-malignancy | mustNotMiss | quality | FAIL (known gap) | NICE NG12 2015 | socrates-to-features.ts: CC hint /dysphag\|swallow/ → dysphagia_progressive (and dysphagia). |
| mgmt-no-age-gated-ogd | managementExclude | quality | PASS | NICE NG12 2015 |  |

Failure details:

- **mnm-malignancy** (web): not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Acute Cholecystitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#2, web.passive#2 [known gap: PANE top 3: GORD, cholecystitis, peptic ulcer — PANE never gets dysphagia_progressive (no CC hint for "Dysphagia", and the dysphagia chip set has no "Dysphagia" association to scan). Symptom inference ranks oesophageal/gastric carcinoma #2.]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Offer urgent direct access upper GI endoscopy (within 2 weeks) to assess for oesophageal or stomach cancer in people with dysphagia (any age), or aged ≥55 with weight loss and any of upper abdominal pain, reflux or dyspepsia. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*
- **nice-cg184** — NICE CG184 — Gastro-oesophageal reflux disease and dyspepsia in adults: investigation and management (2014), Refer people with dysphagia under NG12; peptic stricture managed with PPI and dilatation after OGD. National Institute for Health and Care Excellence. Clinical guideline CG184. London: NICE; 2014 (last updated 2019). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Acute Cholecystitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Oesophageal / gastric carcinoma; 3. Gastric carcinoma; 4. Thyroid carcinoma; 5. Epiglottitis
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Oesophageal / gastric carcinoma; 3. Epiglottitis; 4. Thyroid carcinoma; 5. Occult malignancy / systemic disease
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. GORD with oesophagitis
- emergency level: urgent (acuity=priority, action=same_day_call, score=55)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, web:gerdq, asa, stop-bang, ecog
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, heartburn
- note: AssessmentTab ManagementPanel protocol: oesophageal_stricture (from ICD)
- note: PlanTab protocol: oesophageal_stricture (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (22), Foreign Body Ingestion / Food Bolus (7)

</details>

### Eosinophilic oesophagitis

#### `eoe-young-atopic-recurrent-bolus` — Young atopic man, recurrent impaction (resolved) — eosinophilic oesophagitis

23-year-old man with asthma and eczema: years of intermittent solid-food sticking and three self-resolving bolus episodes; eating slowly. BSG 2022: OGD with ≥6 biopsies from at least two levels; EoE must be on the differential.

Permutation of `food-bolus-complete-obstruction`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| flag-dysphagia | redFlags | critical | PASS | NICE NG12 2015 |  |
| inv-ogd | investigationInclude | critical | PASS | BSG/BSPGHAN joint consensus guidelines 2022; NICE NG12 2015 |  |
| inv-oesophageal-biopsies | investigationInclude | critical | FAIL (known gap) | BSG/BSPGHAN joint consensus guidelines 2022 | Add a K20 (EoE) protocol; add "biopsies (≥6, two levels)" to every dysphagia OGD line. |
| mnm-eoe | mustNotMiss | quality | FAIL (known gap) | BSG/BSPGHAN joint consensus guidelines 2022 | Add an EoE node (young, atopy, intermittent solid dysphagia, bolus episodes) and a K20.0 protocol (≥6 biopsies from ≥2 levels; PPI / budesonide / diet; dilatation). |
| level-priority-not-emergency | emergencyLevel | quality | FAIL (known gap) | NICE NG12 2015 | cancer-screening.ts: parenthesise the colorectal cancerType condition (c.met && (… \|\| … )); dysphagia should give priority, not emergency_now, when the patient is swallowing. |
| inv-six-biopsies-two-levels | investigationInclude | quality | FAIL (known gap) | BSG/BSPGHAN joint consensus guidelines 2022 |  |
| mgmt-eoe-treatment-options | managementInclude | quality | FAIL (known gap) | BSG/BSPGHAN joint consensus guidelines 2022 |  |

Failure details:

- **mnm-eoe** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease [known gap: No eosinophilic oesophagitis disease in PANE or symptom inference (only a key point in the oesophageal_stricture protocol).]
- **level-priority-not-emergency** (web): web.triage: emergency (acuity=urgent, action=emergency_now, score=80); expected ≥ priority, ≤ urgent [known gap: Emergency now: "Systemic red flag symptom" and "Dysphagia" red flags plus a 2-week-wait cancer screen labelled "colorectal" (cancer-screening.ts operator-precedence bug; see findings).]
- **inv-oesophageal-biopsies** (web): no investigation matched among 10 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for K20.0 and nothing else asks for biopsies.]
- **inv-six-biopsies-two-levels** (web): no investigation matched among 10 (web.pane.seeded, web.clinicalPrompts) [known gap: As inv-oesophageal-biopsies.]
- **mgmt-eoe-treatment-options** (web): no management item output on web [known gap: No management output at all for K20.0.]

Guidelines:

- **bsg-eoe-2022** — BSG/BSPGHAN joint consensus guidelines — diagnosis and management of eosinophilic oesophagitis in children and adults (2022), Suspect EoE in dysphagia or food bolus obstruction, especially young atopic men; OGD with at least 6 biopsies from at least two oesophageal levels; first-line PPI, topical steroid (orodispersible budesonide) or dietary therapy; dilatation for strictures. Dhar A, Haboubi HN, Attwood SE, et al. Gut. 2022;71:1459–1487. *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Dysphagia at any age: urgent direct-access OGD. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Oesophageal / gastric carcinoma; 2. Epiglottitis; 3. Thyroid carcinoma; 4. Occult malignancy / systemic disease; 5. Gastric carcinoma
- differential web.passive: 1. Oesophageal / gastric carcinoma; 2. Epiglottitis; 3. Thyroid carcinoma; 4. Occult malignancy / systemic disease; 5. Gastric carcinoma
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. GORD with oesophagitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=80)
- alarms: Emergency now [web.triage.emergency]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, cfs
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (15), IBD — Surgical Complications (Crohn's / UC) (5)

</details>

### Oesophageal food bolus obstruction

#### `food-bolus-complete-obstruction` — 

44-year-old man with a piece of steak stuck for 6 hours, unable to swallow saliva, drooling. ESGE: complete oesophageal obstruction → emergency endoscopy, preferably within 6 h; no barium swallow.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-emergency | emergencyLevel | critical | FAIL (known gap) | ESGE Clinical Guideline 2016 | rules.ts RED_FLAGS: add /(can.?t\|unable to\|cannot) swallow (saliva\|spit\|anything)\|drooling\|food (stuck\|bolus)/ → urgent (emergency_now). |
| inv-emergency-ogd | investigationInclude | critical | PASS | ESGE Clinical Guideline 2016; WSES guidelines 2019 |  |
| mgmt-endoscopic-removal | managementInclude | critical | FAIL (known gap) | ESGE Clinical Guideline 2016 | Add a food-bolus protocol (ESGE 2016: emergent OGD ≤6 h if complete obstruction; push/retrieve; biopsies; no barium). |
| flag-complete-obstruction | redFlags | quality | FAIL (known gap) | ESGE Clinical Guideline 2016 |  |
| mgmt-biopsies-underlying-cause | managementInclude | quality | FAIL (known gap) | ESGE Clinical Guideline 2016; BSG/BSPGHAN joint consensus guidelines 2022 |  |
| mgmt-no-barium | managementExclude | quality | PASS | ESGE Clinical Guideline 2016 |  |

Failure details:

- **level-emergency** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=63); expected ≥ emergency [known gap: Same-day call (urgent), not emergency: triage has no rule for "cannot swallow saliva"/drooling (APCQ grades saliva-only dysphagia as emergency, adaptiveTriage does not).]
- **flag-complete-obstruction** (web): no red flag matched among 6 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: No red flag names the complete obstruction; only "Dysphagia — red flag symptom".]
- **mgmt-endoscopic-removal** (web): no management item matched among 1 (web.clinicalPrompts) [known gap: No protocol for T18.1 (food bolus); the matchPathways registry has a "Foreign Body Ingestion / Food Bolus" pathway but it is not surfaced in management.]
- **mgmt-biopsies-underlying-cause** (web): no management item matched among 1 (web.clinicalPrompts) [known gap: As mgmt-endoscopic-removal.]

Guidelines:

- **esge-fb-2016** — ESGE Clinical Guideline — removal of foreign bodies in the upper gastrointestinal tract in adults (2016), Complete oesophageal obstruction (unable to manage saliva): emergent endoscopy, preferably within 6 h (at the latest within 24 h); push or retrieval technique; biopsies to find the underlying cause; barium swallow not recommended. Birk M, Bauerfeind P, Deprez PH, et al. Endoscopy. 2016;48:489–496. *(statement wording/numbering not yet verified against the source)*
- **wses-2019** — WSES guidelines — esophageal emergencies (perforation, caustic ingestion, foreign bodies) (2019), Food bolus impaction with complete obstruction requires emergency flexible endoscopy. Chirica M, Kelly MD, Siboni S, et al. World J Emerg Surg. 2019;14:26. *(statement wording/numbering not yet verified against the source)*
- **bsg-eoe-2022** — BSG/BSPGHAN joint consensus guidelines — diagnosis and management of eosinophilic oesophagitis in children and adults (2022), Food bolus obstruction in young adults: biopsy for eosinophilic oesophagitis. Dhar A, Haboubi HN, Attwood SE, et al. Gut. 2022;71:1459–1487. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Oesophageal / gastric carcinoma; 3. Epiglottitis; 4. Thyroid carcinoma; 5. Occult malignancy / systemic disease
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Oesophageal / gastric carcinoma; 3. Epiglottitis; 4. Thyroid carcinoma; 5. Occult malignancy / systemic disease
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture
- emergency level: urgent (acuity=priority, action=same_day_call, score=63)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, web:gerdq
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, regurgitation
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Foreign Body Ingestion / Food Bolus (5), IBD — Surgical Complications (Crohn's / UC) (5), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (5)

</details>

### Gastric outlet obstruction

#### `gastric-outlet-obstruction-elderly` — 

69-year-old man with 3 weeks of large-volume vomiting of undigested food, succussion splash, 7 kg weight loss; K 2.9, Cl 86, bicarbonate 36 (hypochloraemic hypokalaemic alkalosis). NG decompression, IV saline with potassium, then OGD (malignancy vs peptic stricture).

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-goo-top3 | mustRankTopK | critical | FAIL (known gap) | NICE NG12 2015 | socrates-to-features.ts: map "projectile\|undigested\|succussion" → vomiting_effortless; feed symptomDetails (vomiting: Projectile) to PANE. |
| level-at-least-urgent | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| inv-ogd | investigationInclude | critical | PASS | NICE NG12 2015 |  |
| mgmt-ng-decompression | managementInclude | critical | PASS | NICE NG12 2015 |  |
| mgmt-iv-saline-potassium | managementInclude | critical | PASS | NICE NG12 2015 |  |
| mnm-malignancy | mustNotMiss | quality | FAIL (known gap) | NICE NG12 2015 |  |
| flag-electrolytes | redFlags | quality | PASS | NICE NG12 2015 |  |
| inv-ct | investigationInclude | quality | PASS | NICE NG12 2015 |  |

Failure details:

- **dx-goo-top3** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#5, web.passive#2 [known gap: PANE top 3: inguinal hernia, cholecystitis, GORD. The vomiting_effortless feature (GOO 0.90) is never set: no SOCRATES rule maps projectile vomiting or vomiting of undigested food.]
- **mnm-malignancy** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE has no malignancy in the top 3; symptom inference ranks gastric carcinoma #1.]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Consider urgent direct-access OGD in people aged ≥55 with nausea or vomiting and weight loss, reflux, dyspepsia or upper abdominal pain. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Gastric carcinoma; 2. Occult malignancy / systemic disease; 3. Oesophageal / gastric carcinoma; 4. Colorectal carcinoma; 5. Hypertrophic pyloric stenosis
- differential web.passive: 1. Gastric carcinoma; 2. Hypertrophic pyloric stenosis; 3. Chronic pancreatitis; 4. Acute alcoholic pancreatitis; 5. Pancreatic adenocarcinoma
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup
- emergency level: emergency (acuity=urgent, action=emergency_now, score=77)
- alarms: Emergency now [web.triage.emergency]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: ranson, news2, caprini, web:gerdq, cfs, ecog
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, nausea_vomiting, anorexia, weight_loss
- note: AssessmentTab ManagementPanel protocol: gastric_outlet_obstruction (from ICD)
- note: PlanTab protocol: gastric_outlet_obstruction (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10), Wound Management (Acute / Chronic / SSI) (5)

</details>

### Gastro-oesophageal reflux disease (no alarm features)

#### `gord-no-alarm-empirical-ppi` — 

36-year-old man with 4 months of heartburn and acid regurgitation, worse lying down, relieved by antacids; no alarm features. NICE CG184: lifestyle advice and full-dose PPI for 4 (–8) weeks; no endoscopy.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-gord-top3 | mustRankTopK | quality | PASS | NICE CG184 2014 |  |
| level-routine | emergencyLevel | quality | FAIL (known gap) | NICE CG184 2014 | adaptive-triage: strip negated clauses ("no/denies/without X") before RED_FLAGS, GI_BLEED_TERMS and vomiting rules. |
| no-cancer-alarm | mustNotAlarm | quality | PASS | NICE NG12 2015 |  |
| inv-no-urgent-ogd | investigationExclude | quality | PASS | NICE CG184 2014 |  |
| mgmt-empirical-ppi | managementInclude | quality | PASS | NICE CG184 2014 |  |
| mgmt-lifestyle | managementInclude | quality | PASS | NICE CG184 2014 |  |

Failure details:

- **level-routine** (web): web.triage: emergency (acuity=urgent, action=emergency_now, score=65); expected ≤ priority [known gap: Emergency now (score 65): adaptiveTriage reads CC+HPI free text without negation — "no weight loss" → Possible malignancy, "no vomiting" → vomiting, "no black stools" → Possible GI bleeding.]

Guidelines:

- **nice-cg184** — NICE CG184 — Gastro-oesophageal reflux disease and dyspepsia in adults: investigation and management (2014), GORD without alarm features: lifestyle advice; full-dose PPI for 4 (or 8) weeks; refer for endoscopy only per NG12 or if symptoms persist. National Institute for Health and Care Excellence. Clinical guideline CG184. London: NICE; 2014 (last updated 2019). *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), No NG12 criterion met. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Peptic Ulcer Disease; 3. Hiatus Hernia
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Benign prostatic hyperplasia (BPH); 3. Testicular germ cell tumour; 4. Varicocele; 5. Reducible groin / abdominal hernia
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Acute cholecystitis; 3. CBD stone / obstructive jaundice; 4. Peptic ulcer disease; 5. Reducible groin / abdominal hernia
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 3. GORD with oesophagitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=65)
- alarms: Emergency now [web.triage.emergency]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, web:gerdq, asa, stop-bang
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: heartburn, epigastric_pain, antacid_relief, regurgitation, chest_pain_oesophageal, nocturnal_pain, alcohol_use
- note: AssessmentTab ManagementPanel protocol: gord (from PANE top)
- note: PlanTab protocol: gord (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (12), Cancer Screening (Age/Sex Appropriate) (7), Colonoscopy Diagnostic (Rectal Bleeding / Bowel Habit Change / Iron Deficiency) (7)

</details>

#### `gord-alarm-weight-loss-over55` — Age 63 with new weight loss (alarm feature)

63-year-old woman with a year of reflux, now 6 kg unintentional weight loss. NG12: aged ≥55 with weight loss and reflux → urgent OGD within 2 weeks, not an empirical PPI trial.

Permutation of `gord-no-alarm-empirical-ppi`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-malignancy | mustNotMiss | critical | FAIL (known gap) | NICE NG12 2015 | pane-engine modifiers: age ≥55 multiplier for oesophageal/gastric carcinoma; weight_loss + age ≥55 should surface a malignancy. |
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| flag-weight-loss-cancer | redFlags | critical | PASS | NICE NG12 2015 |  |
| inv-ogd | investigationInclude | critical | PASS | NICE NG12 2015 |  |
| mgmt-urgent-two-week-ogd | managementInclude | quality | FAIL (known gap) | NICE NG12 2015 |  |

Failure details:

- **mnm-malignancy** (web): not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Hiatus Hernia \| 3. Peptic Ulcer Disease; also in web.symptomInference#2, web.passive#2 [known gap: PANE top 3: GORD, hiatus hernia, peptic ulcer (the "GORD / heartburn" template hint pushes GORD; weight loss does not lift a carcinoma into the top 3). Symptom inference lists gastric carcinoma #3.]
- **mgmt-urgent-two-week-ogd** (web): no management item matched among 33 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: GORD protocol OGD line is conditional ("Alarm features, age >55, or 4-week PPI trial failed") and not urgent; no 2-week-wait wording. The triage reason "Cancer screening triggered" is present but labelled "colorectal".]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Urgent direct-access OGD within 2 weeks for people aged ≥55 with weight loss and any of upper abdominal pain, reflux or dyspepsia. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*
- **nice-cg184** — NICE CG184 — Gastro-oesophageal reflux disease and dyspepsia in adults: investigation and management (2014), Alarm features: refer under NG12 rather than empirical PPI. National Institute for Health and Care Excellence. Clinical guideline CG184. London: NICE; 2014 (last updated 2019). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Hiatus Hernia; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Occult malignancy / systemic disease; 3. Gastric carcinoma; 4. Colorectal carcinoma; 5. Oesophageal / gastric carcinoma
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Gastric carcinoma; 3. HIV / AIDS presentation; 4. Occult malignancy / systemic disease; 5. Pancreatic adenocarcinoma
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 2. GORD with oesophagitis
- emergency level: urgent (acuity=priority, action=same_day_call, score=62)
- alarms: Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, web:gerdq, ecog
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: heartburn, epigastric_pain, antacid_relief, regurgitation, chest_pain_oesophageal, anorexia, weight_loss
- note: AssessmentTab ManagementPanel protocol: gord (from PANE top)
- note: PlanTab protocol: gord (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (5)

</details>

### Common femoral artery aneurysm mimicking a groin hernia

#### `groin-mimic-femoral-artery-aneurysm` — 

74-year-old male ex-smoker with a known 4.6 cm AAA under surveillance and a pulsatile, expansile right groin swelling below the inguinal ligament. Needs duplex/CT angiography before anyone puts a needle or a knife in it; no hernia repair.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-aneurysm | mustNotMiss | critical | FAIL (known gap) | ESVS 2024 clinical practice guidelines 2024 | Add a femoral/peripheral aneurysm disease and a "pulsatile / expansile mass" feature to PANE, mapped from the SOCRATES "Pulsatile" character chip. |
| flag-pulsatile | redFlags | critical | FAIL (known gap) | ESVS 2024 clinical practice guidelines 2024 | Add a triage/prompt safety rule: pulsatile or expansile groin mass → do not needle or explore; duplex/CTA and vascular referral. |
| inv-duplex-or-cta | investigationInclude | critical | FAIL (known gap) | ESVS 2024 clinical practice guidelines 2024; HerniaSurge 2018 |  |
| mgmt-no-hernia-repair | managementExclude | critical | FAIL (known gap) | HerniaSurge 2018 | Let the confirmed working diagnosis (ICD / paneDiseaseId) override the PANE top for the ManagementPanel, and add a neutral "Groin lump" CC template. |
| mgmt-vascular-referral | managementInclude | quality | FAIL (known gap) | ESVS 2024 clinical practice guidelines 2024 |  |

Failure details:

- **mnm-aneurysm** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Acute Cholecystitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = inguinal hernia, GORD, cholecystitis. PANE has only "Aortic Aneurysm" and no pulsatile-mass feature; the symptom engine ranks AAA #1 from the "pulsatile mass" chip. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **flag-pulsatile** (web): no red flag matched among 12 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative) [known gap: No red flag or alarm for a pulsatile groin mass: triage has no pulsatile/aneurysm rule and the prompts have none.]
- **inv-duplex-or-cta** (web): no investigation matched among 22 (web.pane.seeded, web.clinicalPrompts) [known gap: No duplex/CT angiography proposed; I72.4 has no protocol.]
- **mgmt-vascular-referral** (web): no management item matched among 17 (web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No vascular referral in any output (the inguinal_hernia panel is shown instead).]
- **mgmt-no-hernia-repair** (web): forbidden management item present in web.managementPanel: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Assessment ManagementPanel follows the PANE top disease (≥0.20), which is the inguinal hernia because the only groin CC template is "Inguinal / groin hernia" and site "groin" maps to groin_swelling; the surgeon's confirmed diagnosis (ICD) is not used for the panel while PANE is ≥0.20. The panel shows the Lichtenstein/TEP/TAPP repair and the TAPP operative-plan prompt fires from the CC template name.]

Guidelines:

- **esvs-aaa-2024** — ESVS 2024 clinical practice guidelines — abdominal aorto-iliac artery aneurysms (2024), Associated peripheral (femoral / popliteal) aneurysms in patients with AAA; duplex ultrasound assessment. Wanhainen A, Van Herzeele I, Bastos Goncalves F, et al. European Society for Vascular Surgery (ESVS) 2024 Clinical Practice Guidelines on the Management of Abdominal Aorto-Iliac Artery Aneurysms. Eur J Vasc Endovasc Surg. 2024;67:192–331. *(statement wording/numbering not yet verified against the source)*
- **herniasurge-2018** — HerniaSurge — International guidelines for groin hernia management (2018), Diagnosis (clinical examination, ultrasound for uncertain swellings); watchful waiting in minimally symptomatic men; mesh repair (Lichtenstein, TEP/TAPP); groin hernia in women; femoral hernia; emergency repair. HerniaSurge Group. International guidelines for groin hernia management. Hernia. 2018;22:1–165. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. GORD / Reflux Oesophagitis; 3. Acute Cholecystitis
- differential web.symptomInference: 1. Symptomatic / ruptured abdominal aortic aneurysm; 2. Peripheral arterial disease / limb ischaemia; 3. Inguinal hernia (paediatric); 4. Varicocele; 5. Benign prostatic hyperplasia (BPH)
- differential web.passive: 1. Symptomatic / ruptured abdominal aortic aneurysm; 2. Peripheral arterial disease / limb ischaemia; 3. Inguinal hernia (paediatric); 4. Varicocele; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Peripheral arterial / vascular disease; 2. Inguinal hernia
- emergency level: priority (acuity=review, action=priority_24_48h, score=24)
- alarms: Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Hernia — elective repair indicated [web.clinicalPrompts.safety]
- recommended scores: news2, caprini, asa, rcri, cfs
- score values: (none)
- dx variant: (none) (Hernia)
- note: PANE features applied: groin_swelling
- note: AssessmentTab ManagementPanel protocol: inguinal_hernia (from PANE top)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (10), Peripheral Vascular Disease (5)

</details>

### Inguinal lymphadenopathy (suspected lymphoma) mimicking a hernia

#### `groin-mimic-lymphadenopathy` — 

46-year-old man referred as a "right inguinal hernia": firm, rubbery, non-reducible lumps with no cough impulse, night sweats and 6 kg weight loss. A lymph-node mass, not a hernia: ultrasound and biopsy, NICE NG12 suspected-lymphoma pathway; no hernia repair.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-lymphoma-or-nodes | mustNotMiss | critical | FAIL (known gap) | NICE NG12 2015 | Model P(feature \| not disease) or use a low default sensitivity (e.g. <=0.05) for features outside a disease's system; restrict the candidate set by the presenting system (breast / neck / groin). |
| flag-malignancy | redFlags | critical | PASS | NICE NG12 2015 |  |
| inv-uss-or-biopsy | investigationInclude | critical | FAIL (known gap) | NICE NG12 2015; HerniaSurge 2018 | Map R59.x to a generic lymphadenopathy protocol (USS, FBC/LDH, core/excision biopsy, NG12 referral) regardless of site. |
| mgmt-no-hernia-repair | managementExclude | critical | FAIL (known gap) | HerniaSurge 2018 | Let the confirmed working diagnosis (ICD / paneDiseaseId) override the PANE top for the ManagementPanel, and add a neutral "Groin lump" CC template. |
| level-at-least-priority | emergencyLevel | quality | PASS | NICE NG12 2015 |  |
| inv-ldh | investigationInclude | quality | FAIL (known gap) | NICE NG12 2015 |  |

Failure details:

- **mnm-lymphoma-or-nodes** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = inguinal hernia, cholecystitis, GORD. PANE has no lymphadenopathy feature from the groin site and its only node disease is "Cervical Lymphadenopathy"; the symptom engine ranks lymphoma #1. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **inv-uss-or-biopsy** (web): no investigation matched among 22 (web.pane.seeded, web.clinicalPrompts) [known gap: No groin ultrasound or node biopsy is proposed; the confirmed ICD R59.1 has no protocol (R59.9 → cervical lymphadenopathy only).]
- **inv-ldh** (web): no investigation matched among 22 (web.pane.seeded, web.clinicalPrompts) [known gap: No LDH (same cause as above).]
- **mgmt-no-hernia-repair** (web): forbidden management item present in web.managementPanel: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Assessment ManagementPanel follows the PANE top disease (≥0.20), which is the inguinal hernia because the only groin CC template is "Inguinal / groin hernia" and site "groin" maps to groin_swelling; the surgeon's confirmed diagnosis (ICD) is not used for the panel while PANE is ≥0.20. The panel shows "Elective: Lichtenstein mesh herniorrhaphy … TEP/TAPP" and the TAPP prompt fires from the CC template name.]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (2015), Site-specific recommendations: breast cancer (age ≥30 unexplained lump; ≥50 unilateral nipple discharge/retraction; skin changes; men ≥50 subareolar mass), haematological cancers (unexplained lymphadenopathy), head and neck (unexplained thyroid lump). National Institute for Health and Care Excellence. Suspected cancer: recognition and referral. NICE guideline NG12. London: NICE; 2015 (updated). *(statement wording/numbering not yet verified against the source)*
- **herniasurge-2018** — HerniaSurge — International guidelines for groin hernia management (2018), Diagnosis (clinical examination, ultrasound for uncertain swellings); watchful waiting in minimally symptomatic men; mesh repair (Lichtenstein, TEP/TAPP); groin hernia in women; femoral hernia; emergency repair. HerniaSurge Group. International guidelines for groin hernia management. Hernia. 2018;22:1–165. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Lymphoma (Hodgkin / non-Hodgkin); 2. HIV / AIDS presentation; 3. Occult malignancy / systemic disease; 4. Pulmonary tuberculosis; 5. Colorectal carcinoma
- differential web.passive: 1. Lymphoma (Hodgkin / non-Hodgkin); 2. HIV / AIDS presentation; 3. Pulmonary tuberculosis; 4. Cholangiocarcinoma; 5. Occult malignancy / systemic disease
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 2. Inguinal hernia
- emergency level: urgent (acuity=priority, action=same_day_call, score=40)
- alarms: Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: child-pugh, news2, ecog
- score values: (none)
- dx variant: hernia_reducible (Hernia)
- note: PANE features applied: groin_swelling
- note: AssessmentTab ManagementPanel protocol: inguinal_hernia (from PANE top)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (15), Thyroid / Neck Mass (5), Wound Management (Acute / Chronic / SSI) (5)

</details>

### Testicular torsion presenting as groin pain

#### `groin-mimic-testicular-torsion` — 

14-year-old boy with 3 hours of sudden severe right groin and scrotal pain and vomiting, high-riding tender testis, absent cremasteric reflex. Torsion until proven otherwise: emergency scrotal exploration; ultrasound must not delay theatre.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-torsion-top3 | mustRankTopK | critical | FAIL (known gap) | EAU/ESPU Guidelines on Paediatric Urology 2024 |  |
| mnm-torsion | mustNotMiss | critical | FAIL (known gap) | EAU/ESPU Guidelines on Paediatric Urology 2024 | Model P(feature \| not disease) or use a low default sensitivity (e.g. <=0.05) for features outside a disease's system; restrict the candidate set by the presenting system (breast / neck / groin). |
| level-emergency | emergencyLevel | critical | PASS | EAU/ESPU Guidelines on Paediatric Urology 2024 |  |
| alarm-torsion | mustAlarm | critical | PASS | EAU/ESPU Guidelines on Paediatric Urology 2024 |  |
| mgmt-exploration | managementInclude | critical | PASS | EAU/ESPU Guidelines on Paediatric Urology 2024 |  |
| mgmt-no-hernia-repair | managementExclude | critical | FAIL (known gap) |  | Let the confirmed working diagnosis (ICD / paneDiseaseId) override the PANE top for the ManagementPanel, and add a neutral "Groin lump" CC template. |

Failure details:

- **dx-torsion-top3** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Appendicitis \| 3. Epididymo-orchitis; also in web.symptomInference#1, web.passive#1 [known gap: As above: torsion not in the PANE top 3; epididymo-orchitis ranks above it.]
- **mnm-torsion** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Appendicitis \| 3. Epididymo-orchitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = inguinal hernia, appendicitis, epididymo-orchitis: testicular_torsion (prior 0.01) is outranked although testicular_pain/scrotal_swelling are applied; vomiting and "sudden" onset are not mapped to features. The safety prompt and the ICD plan (N44.00 → testicular_torsion) are correct.]
- **mgmt-no-hernia-repair** (web): forbidden management item present in web.managementPanel: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Assessment ManagementPanel follows the PANE top disease (≥0.20), which is the inguinal hernia because the only groin CC template is "Inguinal / groin hernia" and site "groin" maps to groin_swelling; the surgeon's confirmed diagnosis (ICD) is not used for the panel while PANE is ≥0.20. The PANE top (inguinal hernia 0.22) drives the ManagementPanel, so an elective mesh repair is shown next to the emergency exploration plan.]

Guidelines:

- **eau-paed-2024** — EAU/ESPU Guidelines on Paediatric Urology — acute scrotum (2024), Testicular torsion: clinical diagnosis, Doppler ultrasound must not delay surgery, urgent scrotal exploration. Radmayr C, Bogaert G, Burgu B, et al. EAU Guidelines on Paediatric Urology. EAU Guidelines Office, Arnhem; 2024 edition. Section: Acute scrotum in children. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Appendicitis; 3. Epididymo-orchitis
- differential web.symptomInference: 1. Testicular torsion / epididymo-orchitis; 2. Inguinal hernia (paediatric); 3. Varicocele; 4. Acute appendicitis (paediatric); 5. Testicular germ cell tumour
- differential web.passive: 1. Testicular torsion / epididymo-orchitis; 2. Varicocele; 3. Inguinal hernia (paediatric); 4. Acute gastroenteritis; 5. Hypertrophic pyloric stenosis
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=75)
- alarms: Emergency now [web.triage.emergency]; Testicular / scrotal signs [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: groin_swelling, testicular_pain, scrotal_swelling
- note: AssessmentTab ManagementPanel protocol: inguinal_hernia (from PANE top)
- note: PlanTab protocol: testicular_torsion (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (5)

</details>

### Helicobacter pylori infection (dyspepsia)

#### `h-pylori-penicillin-anaphylaxis` — Penicillin anaphylaxis recorded

Same H. pylori-positive patient with a recorded penicillin anaphylaxis. Any regimen with amoxicillin is contraindicated; Maastricht VI: bismuth quadruple (PPI, bismuth, tetracycline, metronidazole).

Permutation of `h-pylori-positive-eradication`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| flag-penicillin-allergy | redFlags | critical | PASS | Maastricht VI/Florence consensus report 2022 |  |
| mgmt-no-amoxicillin | managementExclude | critical | FAIL (known gap) | Maastricht VI/Florence consensus report 2022 | buildPlanText / protocol medications: filter or flag drugs that match a recorded allergy class (penicillins); same finding as the seed appendicitis/cholangitis vignettes. |
| mgmt-bismuth-quadruple | managementInclude | quality | FAIL (known gap) | Maastricht VI/Florence consensus report 2022 | As h-pylori-positive-eradication; add the bismuth quadruple (tetracycline + metronidazole) regimen. |

Failure details:

- **mgmt-bismuth-quadruple** (web): no management item matched among 26 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No penicillin-free regimen in any H. pylori protocol.]
- **mgmt-no-amoxicillin** (web): forbidden management item present in web.plan: "[conservative] h. pylori eradication: triple therapy (ppi + amoxicillin + clarithromycin × 7 days); confirm eradication with breath test at 4 weeks." (+1 more) [known gap: Gastritis protocol plan line and medications list amoxicillin despite a recorded penicillin anaphylaxis (the allergy shows only in the header).]

Guidelines:

- **maastricht-6** — Maastricht VI/Florence consensus report — management of Helicobacter pylori infection (2022), Penicillin allergy: bismuth quadruple therapy (PPI + bismuth + tetracycline + metronidazole) for 14 days. Malfertheiner P, Megraud F, Rokkas T, et al. Gut. 2022;71:1724–1762. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Acute Cholecystitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Irritable bowel syndrome (IBS); 3. Chronic pancreatitis; 4. Perforated peptic ulcer; 5. Acute alcoholic pancreatitis
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Irritable bowel syndrome (IBS); 3. Chronic pancreatitis; 4. Perforated peptic ulcer; 5. Acute alcoholic pancreatitis
- differential web.triageSurgical: (empty)
- emergency level: priority (acuity=review, action=priority_24_48h, score=12)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: ranson, news2, web:gerdq
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, heartburn, nausea_vomiting, antacid_relief
- note: AssessmentTab ManagementPanel protocol: gord (from PANE top)
- note: PlanTab protocol: gastritis (from ICD)
- note: matchPathways: Post-operative Follow-up (General) (10), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10)

</details>

#### `h-pylori-positive-eradication` — Stool antigen positive — eradication regimen and test of cure

Same patient: H. pylori stool antigen positive. Maastricht VI: 14-day regimen (bismuth quadruple first-line where clarithromycin resistance is high or unknown; clarithromycin triple only if susceptibility is known) and a test of cure ≥4 weeks after treatment.

Permutation of `dyspepsia-young-no-alarm-test-and-treat`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mgmt-eradication | managementInclude | quality | PASS | Maastricht VI/Florence consensus report 2022 |  |
| mgmt-14-day-or-bismuth | managementInclude | quality | FAIL (known gap) | Maastricht VI/Florence consensus report 2022 | Gastritis / peptic_ulcer / gastric_carcinoma protocols: align H. pylori regimens with Maastricht VI (14 days; bismuth quadruple first-line where clarithromycin resistance is high or unknown). The three protocols currently disagree (7, 7–14 and 14 days). |
| mgmt-test-of-cure | managementInclude | quality | PASS | Maastricht VI/Florence consensus report 2022 |  |
| mgmt-no-7-day-clarithromycin-triple | managementExclude | quality | FAIL (known gap) | Maastricht VI/Florence consensus report 2022 | As mgmt-14-day-or-bismuth. |

Failure details:

- **mgmt-14-day-or-bismuth** (web): no management item matched among 26 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: Gastritis protocol: "triple therapy (PPI + amoxicillin + clarithromycin × 7 days)"; no bismuth quadruple option, no 14-day course.]
- **mgmt-no-7-day-clarithromycin-triple** (web): forbidden management item present in web.plan: "... h. pylori eradication: triple therapy (ppi + amoxicillin + clarithromycin × 7 days); confirm eradication with breath test at 4 weeks." [known gap: Gastritis protocol plan line and medications prescribe clarithromycin triple therapy for 7 days (patient also had prior clarithromycin).]

Guidelines:

- **maastricht-6** — Maastricht VI/Florence consensus report — management of Helicobacter pylori infection (2022), First-line: bismuth quadruple therapy for 14 days where clarithromycin resistance is high (>15%) or unknown; PPI-clarithromycin triple therapy only with known susceptibility, 14 days; avoid clarithromycin after prior macrolide exposure; confirm eradication (UBT or stool antigen) at least 4 weeks after therapy. Malfertheiner P, Megraud F, Rokkas T, et al. Gut. 2022;71:1724–1762. *(statement wording/numbering not yet verified against the source)*
- **nice-cg184** — NICE CG184 — Gastro-oesophageal reflux disease and dyspepsia in adults: investigation and management (2014), Offer eradication therapy to H. pylori-positive dyspepsia; retest only if indicated. National Institute for Health and Care Excellence. Clinical guideline CG184. London: NICE; 2014 (last updated 2019). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Acute Cholecystitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Irritable bowel syndrome (IBS); 3. Chronic pancreatitis; 4. Perforated peptic ulcer; 5. Acute alcoholic pancreatitis
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Irritable bowel syndrome (IBS); 3. Chronic pancreatitis; 4. Perforated peptic ulcer; 5. Acute alcoholic pancreatitis
- differential web.triageSurgical: (empty)
- emergency level: priority (acuity=review, action=priority_24_48h, score=12)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: ranson, news2, web:gerdq
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, heartburn, nausea_vomiting, antacid_relief
- note: AssessmentTab ManagementPanel protocol: gord (from PANE top)
- note: PlanTab protocol: gastritis (from ICD)
- note: matchPathways: Post-operative Follow-up (General) (10), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10)

</details>

### Femoral hernia

#### `hernia-femoral-elderly-woman` — 

79-year-old thin woman with a small, firm, non-tender right groin lump below and lateral to the pubic tubercle for 6 weeks, not reducible, no obstructive symptoms. Femoral hernias carry the highest strangulation risk: early (urgent elective) repair, not watchful waiting or a truss.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-femoral-top3 | mustRankTopK | critical | FAIL (known gap) | HerniaSurge 2018 | Model P(feature \| not disease) or use a low default sensitivity (e.g. <=0.05) for features outside a disease's system; restrict the candidate set by the presenting system (breast / neck / groin). |
| mgmt-early-repair | managementInclude | critical | PASS | HerniaSurge 2018 |  |
| mgmt-no-watchful-waiting | managementExclude | critical | PASS | HerniaSurge 2018 |  |
| level-at-least-priority | emergencyLevel | quality | PASS | HerniaSurge 2018 |  |
| flag-strangulation-risk | redFlags | quality | PASS | HerniaSurge 2018 |  |
| variant-incarcerated | dxVariant | quality | PASS |  |  |

Failure details:

- **dx-femoral-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Diverticulitis [known gap: PANE top 3 = cholecystitis, GORD, diverticulitis; femoral_hernia is not listed despite groin_swelling. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]

Guidelines:

- **herniasurge-2018** — HerniaSurge — International guidelines for groin hernia management (2018), Diagnosis (clinical examination, ultrasound for uncertain swellings); watchful waiting in minimally symptomatic men; mesh repair (Lichtenstein, TEP/TAPP); groin hernia in women; femoral hernia; emergency repair. HerniaSurge Group. International guidelines for groin hernia management. Hernia. 2018;22:1–165. *(statement wording/numbering not yet verified against the source)*
- **wses-hernia-2017** — WSES guidelines — emergency repair of complicated abdominal wall hernias (2017 update) (2017), Diagnosis of strangulation (clinical signs, lactate, CPK, D-dimer, CT); timing of surgery; manual reduction only without strangulation; mesh in clean (CDC I) and clean-contaminated fields. Birindelli A, Sartelli M, Di Saverio S, et al. 2017 update of the WSES guidelines for emergency repair of complicated abdominal wall hernias. World J Emerg Surg. 2017;12:37. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Acute Diverticulitis
- differential web.symptomInference: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Obstructed / strangulated hernia; 4. Varicocele; 5. Breast carcinoma
- differential web.passive: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Obstructed / strangulated hernia; 4. Varicocele; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Inguinal hernia
- emergency level: priority (acuity=review, action=priority_24_48h, score=27)
- alarms: Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, caprini, asa, rcri, cfs
- score values: (none)
- dx variant: hernia_incarcerated (Hernia)
- note: PANE features applied: groin_swelling
- note: AssessmentTab ManagementPanel protocol: femoral_hernia (from ICD)
- note: PlanTab protocol: femoral_hernia (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (10), Wound Management (Acute / Chronic / SSI) (5)

</details>

### Strangulated femoral (Richter) hernia with small bowel obstruction

#### `hernia-femoral-richter-obstruction` — Presents as SBO (Richter), anticoagulated

82-year-old woman with 2 days of colicky pain, vomiting and distension, no previous abdominal surgery; a small tender lump below the right inguinal ligament is found only on careful examination. Must-not-miss cause of SBO in a "virgin" abdomen; emergency surgery.

Permutation of `hernia-femoral-elderly-woman`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-hernia-cause | mustNotMiss | critical | FAIL (known gap) | Bologna guidelines 2018; WSES guidelines 2017 | Feed exam chips ("Hernia present") and exam text into PANE features; in SBO with no previous surgery, surface external hernias (femoral/obturator) as must-not-miss. |
| level-emergency | emergencyLevel | critical | PASS | WSES guidelines 2017 |  |
| alarm-obstruction | mustAlarm | critical | PASS | Bologna guidelines 2018 |  |
| mgmt-emergency-surgery | managementInclude | critical | PASS | WSES guidelines 2017 |  |
| mgmt-no-conservative-sbo-trial | managementExclude | critical | PASS | Bologna guidelines 2018 |  |
| variant-strangulated | dxVariant | critical | PASS |  |  |
| mnm-bowel-obstruction | mustNotMiss | quality | PASS |  |  |
| flag-anticoagulant | redFlags | quality | PASS |  |  |
| inv-ct | investigationInclude | quality | PASS | Bologna guidelines 2018 |  |
| inv-lactate | investigationInclude | quality | PASS | WSES guidelines 2017 |  |
| mgmt-ng-decompression | managementInclude | quality | PASS |  |  |

Failure details:

- **mnm-hernia-cause** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Bowel Obstruction; also in web.triageSurgical#1 [known gap: PANE top 3 = cholecystitis, appendicitis, bowel obstruction (from the abdominal-pain template). No hernia: groin findings are only in exam text/chips, which PANE does not read. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]

Guidelines:

- **wses-hernia-2017** — WSES guidelines — emergency repair of complicated abdominal wall hernias (2017 update) (2017), Diagnosis of strangulation (clinical signs, lactate, CPK, D-dimer, CT); timing of surgery; manual reduction only without strangulation; mesh in clean (CDC I) and clean-contaminated fields. Birindelli A, Sartelli M, Di Saverio S, et al. 2017 update of the WSES guidelines for emergency repair of complicated abdominal wall hernias. World J Emerg Surg. 2017;12:37. *(statement wording/numbering not yet verified against the source)*
- **wses-asbo-2017** — Bologna guidelines — adhesive small bowel obstruction (WSES 2017 update) (2018), CT in suspected SBO; SBO in a patient without previous abdominal surgery (non-adhesive cause, e.g. hernia) needs a cause-specific diagnosis; signs of strangulation → surgery. ten Broek RPG, Krielen P, Di Saverio S, et al. Bologna guidelines for diagnosis and management of adhesive small bowel obstruction (ASBO): 2017 update of the evidence-based guidelines from the World Society of Emergency Surgery ASBO working group. World J Emerg Surg. 2018;13:24. *(statement wording/numbering not yet verified against the source)*
- **herniasurge-2018** — HerniaSurge — International guidelines for groin hernia management (2018), Diagnosis (clinical examination, ultrasound for uncertain swellings); watchful waiting in minimally symptomatic men; mesh repair (Lichtenstein, TEP/TAPP); groin hernia in women; femoral hernia; emergency repair. HerniaSurge Group. International guidelines for groin hernia management. Hernia. 2018;22:1–165. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Appendicitis; 3. Bowel Obstruction
- differential web.symptomInference: 1. Adhesive small bowel obstruction; 2. Sigmoid volvulus; 3. Large bowel obstruction; 4. Malrotation / midgut volvulus; 5. Gallstone pancreatitis
- differential web.passive: 1. Adhesive small bowel obstruction; 2. Malrotation / midgut volvulus; 3. Sigmoid volvulus; 4. Large bowel obstruction; 5. Intussusception
- differential web.triageSurgical: 1. Inguinal hernia
- emergency level: emergency (acuity=urgent, action=emergency_now, score=59)
- alarms: Emergency now [web.triage.emergency]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Bowel obstruction — clinical or imaging evidence [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Anticoagulation therapy [web.clinicalPrompts.safety]; Creatinine 131 μmol/L — elevated [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]
- recommended scores: alvarado, ranson, cha2ds2-vasc, news2, has-bled, cfs
- score values: (none)
- dx variant: hernia_strangulated (Hernia)
- note: PANE features applied: rlq_pain, colicky_pain, nausea_vomiting, anorexia
- note: AssessmentTab ManagementPanel protocol: femoral_hernia (from ICD)
- note: PlanTab protocol: femoral_hernia (from ICD)
- note: matchPathways: Bowel Obstruction (Small / Large) (12), Hernia (Inguinal / Umbilical / Incisional / Femoral) (12), Acute Abdomen (7)

</details>

### Incarcerated inguinal hernia (no strangulation)

#### `hernia-groin-incarcerated` — 

67-year-old man whose known right inguinal hernia became irreducible 5 hours ago; mildly tender, no skin change, no obstruction, normal vitals, lactate 1.3. WSES: no signs of strangulation, so gentle reduction may be tried, then repair; mesh in a clean field.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-hernia-top3 | mustRankTopK | critical | PASS | WSES guidelines 2017 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | WSES guidelines 2017 |  |
| flag-irreducible | redFlags | critical | PASS | WSES guidelines 2017 |  |
| mgmt-reduction-or-repair | managementInclude | critical | PASS | WSES guidelines 2017 |  |
| mgmt-no-watchful-waiting | managementExclude | critical | PASS | HerniaSurge 2018; WSES guidelines 2017 |  |
| variant-incarcerated | dxVariant | critical | FAIL (known gap) |  | Match detectKeywords on word boundaries, check the most severe variant first (strangulated → incarcerated → reducible), and add negative look-behind for 'ir'/'non-' ("irreducible" contains "reducible"); "bethesda vi" contains "bethesda v". |
| score-qsofa-calculator | scoreValue | quality | n/a |  |  |
| inv-lactate | investigationInclude | quality | FAIL (known gap) | WSES guidelines 2017 | Add lactate (± CPK, D-dimer) and CT when strangulation is uncertain to the hernia protocols for irreducible hernias. |
| mgmt-mesh-clean-field | managementInclude | quality | PASS | WSES guidelines 2017 |  |

Failure details:

- **inv-lactate** (web): no investigation matched among 25 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: The inguinal_hernia protocol lists FBC, U&E only; no lactate/CPK (WSES strangulation markers) anywhere in the web outputs.]
- **variant-incarcerated** (web): detected hernia_reducible in group Hernia; expected hernia_incarcerated [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: "Irreducible inguinal hernia" contains the hernia_reducible keyword "reducible inguinal", so the plan gets the ELECTIVE prefix ("Day-case laparoscopic repair preferred") and loses the immediate/conservative phases.]

Guidelines:

- **wses-hernia-2017** — WSES guidelines — emergency repair of complicated abdominal wall hernias (2017 update) (2017), Diagnosis of strangulation (clinical signs, lactate, CPK, D-dimer, CT); timing of surgery; manual reduction only without strangulation; mesh in clean (CDC I) and clean-contaminated fields. Birindelli A, Sartelli M, Di Saverio S, et al. 2017 update of the WSES guidelines for emergency repair of complicated abdominal wall hernias. World J Emerg Surg. 2017;12:37. *(statement wording/numbering not yet verified against the source)*
- **herniasurge-2018** — HerniaSurge — International guidelines for groin hernia management (2018), Diagnosis (clinical examination, ultrasound for uncertain swellings); watchful waiting in minimally symptomatic men; mesh repair (Lichtenstein, TEP/TAPP); groin hernia in women; femoral hernia; emergency repair. HerniaSurge Group. International guidelines for groin hernia management. Hernia. 2018;22:1–165. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Varicocele; 4. Testicular torsion / epididymo-orchitis; 5. Obstructed / strangulated hernia
- differential web.passive: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Obstructed / strangulated hernia; 4. Varicocele; 5. Testicular torsion / epididymo-orchitis
- differential web.triageSurgical: 1. Inguinal hernia
- emergency level: emergency (acuity=urgent, action=emergency_now, score=47)
- alarms: Emergency now [web.triage.emergency]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, caprini, asa, rcri, cfs
- score values: (none)
- dx variant: hernia_reducible (Hernia)
- note: PANE features applied: groin_swelling
- note: AssessmentTab ManagementPanel protocol: inguinal_hernia (from PANE top)
- note: PlanTab protocol: inguinal_hernia (from ICD)
- note: no web calculator for score form 'qsofa'
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (20), IBD — Surgical Complications (Crohn's / UC) (5), Wound Management (Acute / Chronic / SSI) (5)

</details>

### Strangulated inguinal hernia

#### `hernia-groin-strangulated` — Strangulated (SIRS, lactate 4.2, CT ischaemia)

74-year-old man, irreducible right inguinal hernia for 20 hours: tense, very tender, red overlying skin, bilious vomiting, HR 118, T 38.3, lactate 4.2, WCC 17.8; CT shows a closed small-bowel loop with reduced wall enhancement. WSES: signs of strangulation, no manual reduction, emergency surgery.

Permutation of `hernia-groin-incarcerated`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-hernia-top3 | mustRankTopK | critical | PASS | WSES guidelines 2017 |  |
| level-emergency | emergencyLevel | critical | PASS | WSES guidelines 2017 |  |
| alarm-strangulation-or-sepsis | mustAlarm | critical | PASS | WSES guidelines 2017 |  |
| score-qsofa-calculator | scoreValue | critical | n/a |  |  |
| mgmt-emergency-surgery | managementInclude | critical | PASS | WSES guidelines 2017 |  |
| mgmt-no-manual-reduction | managementExclude | critical | PASS | WSES guidelines 2017 |  |
| variant-strangulated | dxVariant | critical | FAIL (known gap) |  | Match detectKeywords on word boundaries, check the most severe variant first (strangulated → incarcerated → reducible), and add negative look-behind for 'ir'/'non-' ("irreducible" contains "reducible"); "bethesda vi" contains "bethesda v". |
| mnm-strangulation-or-obstruction | mustNotMiss | quality | PASS |  |  |
| score-rec-qsofa | scoreRecommended | quality | PASS |  |  |
| inv-lactate | investigationInclude | quality | PASS | WSES guidelines 2017 |  |
| mgmt-bowel-viability | managementInclude | quality | PASS | WSES guidelines 2017 |  |
| mgmt-resuscitation | managementInclude | quality | PASS |  |  |

Failure details:

- **variant-strangulated** (web): detected hernia_incarcerated in group Hernia; expected hernia_strangulated [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: the assessment says "strangulated" and "irreducible"; hernia_incarcerated is checked before hernia_strangulated, so the plan says "Attempt gentle manual reduction" (contraindicated in strangulation).]

Guidelines:

- **wses-hernia-2017** — WSES guidelines — emergency repair of complicated abdominal wall hernias (2017 update) (2017), Diagnosis of strangulation (clinical signs, lactate, CPK, D-dimer, CT); timing of surgery; manual reduction only without strangulation; mesh in clean (CDC I) and clean-contaminated fields. Birindelli A, Sartelli M, Di Saverio S, et al. 2017 update of the WSES guidelines for emergency repair of complicated abdominal wall hernias. World J Emerg Surg. 2017;12:37. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. GORD / Reflux Oesophagitis; 3. Acute Cholecystitis
- differential web.symptomInference: 1. Inguinal hernia (paediatric); 2. Obstructed / strangulated hernia; 3. Reducible groin / abdominal hernia; 4. Adhesive small bowel obstruction; 5. Sigmoid volvulus
- differential web.passive: 1. Inguinal hernia (paediatric); 2. Adhesive small bowel obstruction; 3. Obstructed / strangulated hernia; 4. Reducible groin / abdominal hernia; 5. Sigmoid volvulus
- differential web.triageSurgical: 1. Inguinal hernia
- emergency level: emergency (acuity=urgent, action=emergency_now, score=99)
- alarms: Emergency now [web.triage.emergency]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Pneumoperitoneum on imaging [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Bowel obstruction — clinical or imaging evidence [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 17.8 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; Creatinine 142 μmol/L — elevated [web.clinicalPrompts.safety]; Fever 38.3°C + HR 118 bpm [web.clinicalPrompts.safety]
- recommended scores: qsofa, web:wagner, news2, caprini, asa, rcri, cfs
- score values: (none)
- dx variant: hernia_incarcerated (Hernia)
- note: PANE features applied: groin_swelling
- note: AssessmentTab ManagementPanel protocol: inguinal_hernia (from PANE top)
- note: PlanTab protocol: inguinal_hernia (from ICD)
- note: no web calculator for score form 'qsofa'
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (15), Bowel Obstruction (Small / Large) (5), IBD — Surgical Complications (Crohn's / UC) (5)

</details>

### Midline incisional hernia

#### `hernia-incisional-midline-elective` — 

63-year-old woman, 2 years after a midline laparotomy for perforated diverticulitis, with a 7 cm-wide reducible midline incisional hernia, BMI 34, smoker, HbA1c 64. EHS 2023: CT for planning, pre-habilitation (smoking, weight, glycaemic control), mesh repair (retromuscular).

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-incisional-top3 | mustRankTopK | critical | FAIL (known gap) | EHS midline incisional hernia guidelines 2023 | Add CC hints for the ventral/incisional templates (umbilical_swelling / previous_surgery) and a SITE_RULES entry for "incisional"/"scar" → hernia features. |
| level-routine | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |
| inv-ct | investigationInclude | quality | PASS | EHS midline incisional hernia guidelines 2023 |  |
| mgmt-prehab | managementInclude | quality | PASS | EHS midline incisional hernia guidelines 2023 |  |
| mgmt-mesh | managementInclude | quality | PASS | EHS midline incisional hernia guidelines 2023 |  |

Failure details:

- **dx-incisional-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Diverticulitis; also in web.triageSurgical#1 [known gap: PANE applied no feature: the "Incisional / ventral hernia" template has no CC hint and the site chip "Incisional" matches no SITE_RULES pattern; the priors alone rank cholecystitis first.]
- **level-routine** (web): web.triage: emergency (acuity=urgent, action=emergency_now, score=49); expected ≤ priority [known gap: Triage emergency_now (score 49): adaptiveTriage RED_FLAGS regexes have no negation handling ("No vomiting" → +15); "Hartmann's … reversed" counted as post-operative concern.]

Guidelines:

- **ehs-incisional-2023** — EHS midline incisional hernia guidelines (2023), Pre-operative imaging (CT); pre-habilitation (smoking cessation, weight loss, glycaemic control); mesh reinforcement; retromuscular mesh position. Sanders DL, Pawlak MM, Simons MP, et al. Midline incisional hernia guidelines: the European Hernia Society. Br J Surg. 2023;110:1732–1768. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Acute Diverticulitis
- differential web.symptomInference: 1. Reducible groin / abdominal hernia; 2. Obstructed / strangulated hernia; 3. Inguinal hernia (paediatric); 4. Breast carcinoma; 5. Uterine fibroids
- differential web.passive: 1. Reducible groin / abdominal hernia; 2. Obstructed / strangulated hernia; 3. Inguinal hernia (paediatric); 4. Acute cholecystitis; 5. CBD stone / obstructive jaundice
- differential web.triageSurgical: 1. Incisional / ventral hernia
- emergency level: emergency (acuity=urgent, action=emergency_now, score=49)
- alarms: Emergency now [web.triage.emergency]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; HbA1c 64% — poorly controlled diabetes [web.clinicalPrompts.safety]; Hernia — elective repair indicated [web.clinicalPrompts.safety]
- recommended scores: web:wagner, news2, caprini, asa, rcri, stop-bang, cfs
- score values: (none)
- dx variant: (none) (Hernia)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: incisional_hernia (from ICD)
- note: PlanTab protocol: incisional_hernia (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (5)

</details>

### Inguinal hernia (elective, minimally symptomatic)

#### `hernia-inguinal-elective-minimal-symptoms` — 

58-year-old man with a 6-month reducible right groin bulge, a dragging ache after work, no episodes of irreducibility. Classic elective inguinal hernia: watchful waiting is a legitimate option for minimally symptomatic men; mesh repair (open Lichtenstein or laparoscopic TEP/TAPP) if repair is chosen.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-inguinal-hernia-top3 | mustRankTopK | critical | PASS | HerniaSurge 2018 |  |
| level-routine | emergencyLevel | quality | FAIL (known gap) | HerniaSurge 2018 | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |
| no-emergency-alarm | mustNotAlarm | quality | FAIL (known gap) |  |  |
| no-strangulation-prompt | mustNotAlarm | quality | FAIL (known gap) |  | Use word-boundary + negation-aware matching for "tender" in the hernia prompt (exclude "non-tender", "not tender"). |
| mgmt-mesh-repair | managementInclude | quality | PASS | HerniaSurge 2018 |  |
| mgmt-watchful-waiting-option | managementInclude | quality | FAIL (known gap) | HerniaSurge 2018 | Add the HerniaSurge watchful-waiting option for minimally symptomatic men to the inguinal_hernia protocol (conservative phase). |
| mgmt-no-emergency-repair | managementExclude | quality | FAIL (known gap) |  |  |
| variant-reducible | dxVariant | quality | PASS |  |  |

Failure details:

- **level-routine** (web): web.triage: emergency (acuity=urgent, action=emergency_now, score=80); expected ≤ priority [known gap: Triage emergency_now (score 80): adaptiveTriage RED_FLAGS regexes have no negation handling — "no episodes of severe pain" → "Acute abdominal pain" (urgent), "No weight loss" → "Possible malignancy", "No vomiting" → +15.]
- **no-emergency-alarm** (web): forbidden alarm present in web.triage.emergency: "emergency now - do not auto-book. advise urgent emergency assessment / tapion contact and ale..." (+1 more) [known gap: Same negation false positives raise the triage "Emergency now" alarm; the prompt engine also raises "Strangulated Hernia → Emergency Repair".]
- **no-strangulation-prompt** (web): forbidden alarm present in web.clinicalPrompts.safety: "incarcerated / strangulated hernia - strangulated hernia → emergency repair" [known gap: computeClinicalPrompts isIncarcerated tests exam text for "tender" — "non-tender" matches, so a reducible hernia gets the "Incarcerated / strangulated hernia" safety prompt.]
- **mgmt-watchful-waiting-option** (web): no management item matched among 27 (web.plan, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: Neither the inguinal_hernia protocol nor the prompts mention watchful waiting (only "truss for unfit patients declining surgery").]
- **mgmt-no-emergency-repair** (web): forbidden management item present in web.clinicalPrompts: "• emergency theatre: irreducible / strangulated hernia - bowel resection risk, consent accordingly." [known gap: The negation bug above ("non-tender") adds "Emergency Theatre: irreducible / strangulated hernia" to the plan actions.]

Guidelines:

- **herniasurge-2018** — HerniaSurge — International guidelines for groin hernia management (2018), Diagnosis (clinical examination, ultrasound for uncertain swellings); watchful waiting in minimally symptomatic men; mesh repair (Lichtenstein, TEP/TAPP); groin hernia in women; femoral hernia; emergency repair. HerniaSurge Group. International guidelines for groin hernia management. Hernia. 2018;22:1–165. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Obstructed / strangulated hernia; 4. Varicocele; 5. Benign prostatic hyperplasia (BPH)
- differential web.passive: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Obstructed / strangulated hernia; 4. Varicocele; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 2. Inguinal hernia
- emergency level: emergency (acuity=urgent, action=emergency_now, score=80)
- alarms: Emergency now [web.triage.emergency]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, caprini, asa, rcri
- score values: (none)
- dx variant: hernia_reducible (Hernia)
- note: PANE features applied: groin_swelling
- note: AssessmentTab ManagementPanel protocol: inguinal_hernia (from PANE top)
- note: PlanTab protocol: inguinal_hernia (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (15), IBD — Surgical Complications (Crohn's / UC) (12), Cancer Screening (Age/Sex Appropriate) (7)

</details>

### Groin hernia in a woman

#### `hernia-inguinal-female-occult-femoral` — Woman (femoral hernia risk)

46-year-old woman with an intermittent left groin bulge. In women HerniaSurge recommends considering a femoral hernia and suggests a laparoscopic repair (identifies occult femoral defects); watchful waiting is not advised because of the femoral-hernia risk.

Permutation of `hernia-inguinal-elective-minimal-symptoms`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-femoral-hernia | mustNotMiss | critical | FAIL (known gap) | HerniaSurge 2018 | Model P(feature \| not disease) or use a low default sensitivity (e.g. <=0.05) for features outside a disease's system; restrict the candidate set by the presenting system (breast / neck / groin). |
| mgmt-no-watchful-waiting | managementExclude | critical | PASS | HerniaSurge 2018 |  |
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |
| inv-no-unrelated-seeded-orders | investigationExclude | quality | FAIL (known gap) |  |  |
| mgmt-laparoscopic | managementInclude | quality | PASS | HerniaSurge 2018 |  |

Failure details:

- **mnm-femoral-hernia** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease [known gap: PANE top 3 = cholecystitis, GORD, PUD. The female modifier cuts inguinal_hernia to x0.3 and cholecystitis is x2 in women; femoral_hernia (prior 0.02) never reaches the list. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **level-not-emergency** (web): web.triage: emergency (acuity=urgent, action=emergency_now, score=52); expected ≤ priority [known gap: Triage emergency_now (score 52): adaptiveTriage RED_FLAGS regexes have no negation handling ("No vomiting" → +15; "change in bowel habit" in "No vomiting, no change in bowel habit" → lower-GI red flag).]
- **inv-no-unrelated-seeded-orders** (web): forbidden investigation present in web.pane.seeded: "blood cultures × 2 (before antibiotics) (cholecystitis)" (+5 more) [known gap: HpiTab.seedInvestigationsFromPane seeds the stat/urgent tests of the (wrong) PANE top 3: blood cultures, MRCP, erect CXR, OGD for a groin lump.]

Guidelines:

- **herniasurge-2018** — HerniaSurge — International guidelines for groin hernia management (2018), Diagnosis (clinical examination, ultrasound for uncertain swellings); watchful waiting in minimally symptomatic men; mesh repair (Lichtenstein, TEP/TAPP); groin hernia in women; femoral hernia; emergency repair. HerniaSurge Group. International guidelines for groin hernia management. Hernia. 2018;22:1–165. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Obstructed / strangulated hernia; 4. Varicocele; 5. Testicular torsion / epididymo-orchitis
- differential web.passive: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Obstructed / strangulated hernia; 4. Varicocele; 5. Testicular torsion / epididymo-orchitis
- differential web.triageSurgical: 1. Change in bowel habit / lower GI bleed — investigation; 2. Inguinal hernia
- emergency level: emergency (acuity=urgent, action=emergency_now, score=52)
- alarms: Emergency now [web.triage.emergency]; Reproductive-age female with abdominal complaint [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Hernia — elective repair indicated [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: (none) (Hernia)
- note: PANE features applied: groin_swelling
- note: AssessmentTab ManagementPanel protocol: inguinal_hernia (from ICD)
- note: PlanTab protocol: inguinal_hernia (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (15), Colonoscopy Diagnostic (Rectal Bleeding / Bowel Habit Change / Iron Deficiency) (12), Diverticular Disease / Diverticulitis (7)

</details>

### Obturator hernia with small bowel obstruction

#### `hernia-obturator-sbo-elderly-woman` — 

86-year-old very thin woman (BMI 16) with 3 days of vomiting, distension and colicky pain, no previous abdominal surgery, no groin lump, and pain down the inner left thigh on hip rotation (Howship-Romberg). Must-not-miss: CT shows an obturator hernia; emergency surgery.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-obturator-hernia | mustNotMiss | critical | FAIL (known gap) | Bologna guidelines 2018 | Add Howship-Romberg / medial thigh pain and "no previous abdominal surgery" features; list obturator/femoral hernia as must-not-miss for SBO in thin elderly women. |
| level-emergency | emergencyLevel | critical | PASS | Bologna guidelines 2018 |  |
| alarm-obstruction | mustAlarm | critical | PASS | Bologna guidelines 2018 |  |
| inv-ct | investigationInclude | critical | PASS | Bologna guidelines 2018 |  |
| mgmt-emergency-surgery | managementInclude | critical | PASS | Bologna guidelines 2018 |  |
| mgmt-no-gastrografin-trial | managementExclude | critical | PASS | Bologna guidelines 2018 |  |
| dx-obstruction-top3 | mustRankTopK | quality | PASS |  |  |
| mnm-hernia-any | mustNotMiss | quality | FAIL (known gap) |  |  |
| variant-strangulated-or-obstructed | dxVariant | quality | FAIL (known gap) |  |  |

Failure details:

- **mnm-obturator-hernia** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Bowel Obstruction [known gap: PANE top 3 = cholecystitis, appendicitis, bowel obstruction (periumbilical site maps to rlq_pain). obturator_hernia (prior 0.005) has no discriminating feature (no medial-thigh / Howship-Romberg feature, no "virgin abdomen" feature), and no web engine names it.]
- **mnm-hernia-any** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Bowel Obstruction [known gap: As above: no hernia of any type in the PANE top 3.]
- **variant-strangulated-or-obstructed** (web): detected (none) in group Hernia; expected hernia_incarcerated [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: the assessment ("Small bowel obstruction due to left obturator hernia") has no hernia keyword ("obstructed hernia", "irreducible", "incarcerated"), so no variant is chosen.]

Guidelines:

- **wses-asbo-2017** — Bologna guidelines — adhesive small bowel obstruction (WSES 2017 update) (2018), CT in suspected SBO; SBO in a patient without previous abdominal surgery (non-adhesive cause, e.g. hernia) needs a cause-specific diagnosis; signs of strangulation → surgery. ten Broek RPG, Krielen P, Di Saverio S, et al. Bologna guidelines for diagnosis and management of adhesive small bowel obstruction (ASBO): 2017 update of the evidence-based guidelines from the World Society of Emergency Surgery ASBO working group. World J Emerg Surg. 2018;13:24. *(statement wording/numbering not yet verified against the source)*
- **wses-hernia-2017** — WSES guidelines — emergency repair of complicated abdominal wall hernias (2017 update) (2017), Diagnosis of strangulation (clinical signs, lactate, CPK, D-dimer, CT); timing of surgery; manual reduction only without strangulation; mesh in clean (CDC I) and clean-contaminated fields. Birindelli A, Sartelli M, Di Saverio S, et al. 2017 update of the WSES guidelines for emergency repair of complicated abdominal wall hernias. World J Emerg Surg. 2017;12:37. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Appendicitis; 3. Bowel Obstruction
- differential web.symptomInference: 1. Adhesive small bowel obstruction; 2. Sigmoid volvulus; 3. Large bowel obstruction; 4. Hirschsprung's disease; 5. Malrotation / midgut volvulus
- differential web.passive: 1. Adhesive small bowel obstruction; 2. Large bowel obstruction; 3. Sigmoid volvulus; 4. Hirschsprung's disease; 5. Malrotation / midgut volvulus
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=47)
- alarms: Emergency now [web.triage.emergency]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Pneumoperitoneum on imaging [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Bowel obstruction — clinical or imaging evidence [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]
- recommended scores: alvarado, ranson, news2, cfs
- score values: (none)
- dx variant: (none) (Hernia)
- note: PANE features applied: rlq_pain, colicky_pain, nausea_vomiting, anorexia
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Bowel Obstruction (Small / Large) (12), Acute Abdomen (7), Acute Appendicitis (7)

</details>

### Incarcerated paediatric inguinal hernia

#### `hernia-paediatric-incarcerated-infant` — Incarcerated, 7-month-old girl

7-month-old girl with a hard, tender left groin swelling for 5 hours, inconsolable, vomited twice. Incarcerated inguinal hernia (may contain ovary): same-day paediatric surgical care; reduction under analgesia/sedation if no peritonitis, then early repair.

Permutation of `hernia-paediatric-inguinal-infant`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-hernia-top3 | mustRankTopK | critical | FAIL (known gap) | EUPSA guideline 2022 | Add age modifiers (infants/children) to PANE priors, e.g. suppress cholecystitis/GORD/PUD under 12 and boost paediatric inguinal hernia. |
| level-at-least-urgent | emergencyLevel | critical | PASS | EUPSA guideline 2022 |  |
| flag-incarcerated | redFlags | critical | PASS |  |  |
| mgmt-reduction-then-repair | managementInclude | critical | PASS | EUPSA guideline 2022 |  |
| mgmt-no-adult-plan | managementExclude | quality | FAIL (known gap) |  |  |

Failure details:

- **dx-hernia-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1, web.triageSurgical#1 [known gap: PANE top 3 = cholecystitis, appendicitis, PUD for a 7-month-old girl (female inguinal x0.3; no age modifier removes adult biliary disease in infants). PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **mgmt-no-adult-plan** (web): forbidden management item present in web.plan: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Adult inguinal protocol and TAPP template for an infant (see the base paediatric vignette).]

Guidelines:

- **eupsa-paed-hernia-2022** — EUPSA guideline — surgical management of paediatric inguinal hernia (2022), Timing of repair (infants: early repair; incarceration risk while waiting); open vs laparoscopic herniotomy; management of incarcerated hernia (reduction then repair). Morini F, Dreuning KMA, Janssen Lok MJH, et al. Surgical management of pediatric inguinal hernia: a systematic review and guideline from the European Pediatric Surgeons' Association Evidence and Guideline Committee. Eur J Pediatr Surg. 2022;32:219–232. *(statement wording/numbering not yet verified against the source)*
- **wses-hernia-2017** — WSES guidelines — emergency repair of complicated abdominal wall hernias (2017 update) (2017), Diagnosis of strangulation (clinical signs, lactate, CPK, D-dimer, CT); timing of surgery; manual reduction only without strangulation; mesh in clean (CDC I) and clean-contaminated fields. Birindelli A, Sartelli M, Di Saverio S, et al. 2017 update of the WSES guidelines for emergency repair of complicated abdominal wall hernias. World J Emerg Surg. 2017;12:37. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Appendicitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Inguinal hernia (paediatric); 2. Intussusception; 3. Malrotation / midgut volvulus; 4. Hypertrophic pyloric stenosis; 5. Bacterial meningitis (paediatric)
- differential web.passive: 1. Inguinal hernia (paediatric); 2. Intussusception; 3. Malrotation / midgut volvulus; 4. Obstructed / strangulated hernia; 5. Hypertrophic pyloric stenosis
- differential web.triageSurgical: 1. Inguinal hernia
- emergency level: emergency (acuity=urgent, action=emergency_now, score=75)
- alarms: Tachycardia [web.triage.vitalRedFlags]; Tachypnoea [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Bowel obstruction — clinical or imaging evidence [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; HR 168 bpm — unexplained tachycardia [web.clinicalPrompts.safety]
- recommended scores: qsofa, news2
- score values: (none)
- dx variant: hernia_incarcerated (Hernia)
- note: PANE features applied: groin_swelling, nausea_vomiting
- note: AssessmentTab ManagementPanel protocol: inguinal_hernia (from ICD)
- note: PlanTab protocol: inguinal_hernia (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (10)

</details>

### Paediatric inguinal hernia (infant)

#### `hernia-paediatric-inguinal-infant` — 

4-month-old boy (born at 34 weeks) with an intermittent right groin/scrotal swelling on crying that reduces spontaneously. Infant inguinal hernias need prompt repair (herniotomy, no mesh) because the incarceration risk is highest in the first year; watchful waiting is not appropriate.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-inguinal-top3 | mustRankTopK | critical | PASS | EUPSA guideline 2022 |  |
| mgmt-no-watchful-waiting | managementExclude | critical | FAIL (known gap) | EUPSA guideline 2022 | Add a paediatric inguinal hernia protocol (herniotomy, prompt repair, no mesh, no truss) selected when age < 16. |
| mgmt-no-adult-mesh-repair | managementExclude | critical | FAIL (known gap) | EUPSA guideline 2022 | Age-gate the hernia protocol and prompt (paediatric herniotomy template; suppress adult pre-op items such as PSA/ECG). |
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) |  | Use age-banded paediatric vital-sign ranges (e.g. APLS / PEWS) in computeVitalRedFlags. |
| mgmt-prompt-repair | managementInclude | quality | FAIL (known gap) | EUPSA guideline 2022 |  |

Failure details:

- **level-not-emergency** (web): web.triage: emergency (acuity=urgent, action=emergency_now, score=75); expected ≤ urgent [known gap: Triage emergency_now: computeVitalRedFlags uses adult thresholds — HR 140 and RR 36 (normal at 4 months) are flagged Tachycardia/Tachypnoea (urgent).]
- **mgmt-prompt-repair** (web): no management item matched among 26 (web.plan, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No output mentions herniotomy or paediatric surgical referral.]
- **mgmt-no-watchful-waiting** (web): forbidden management item present in web.plan: "[conservative] truss may be offered for unfit patients declining surgery - monitor for strangulation..." (+1 more) [known gap: The inguinal_hernia protocol has no paediatric branch: the plan offers "Truss may be offered for unfit patients declining surgery".]
- **mgmt-no-adult-mesh-repair** (web): forbidden management item present in web.plan: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+5 more) [known gap: Adult plan for a 4-month-old: "Lichtenstein mesh herniorrhaphy … TEP/TAPP" (protocol) and computeClinicalPrompts fires the hernia pathway for any CC/exam containing "hernia", "inguinal" or "umbilical", and always attaches the adult "LAPAROSCOPIC INGUINAL HERNIA REPAIR (TAPP)" operative plan.]

Guidelines:

- **eupsa-paed-hernia-2022** — EUPSA guideline — surgical management of paediatric inguinal hernia (2022), Timing of repair (infants: early repair; incarceration risk while waiting); open vs laparoscopic herniotomy; management of incarcerated hernia (reduction then repair). Morini F, Dreuning KMA, Janssen Lok MJH, et al. Surgical management of pediatric inguinal hernia: a systematic review and guideline from the European Pediatric Surgeons' Association Evidence and Guideline Committee. Eur J Pediatr Surg. 2022;32:219–232. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Epididymo-orchitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Testicular torsion / epididymo-orchitis; 4. Varicocele; 5. Testicular germ cell tumour
- differential web.passive: 1. Inguinal hernia (paediatric); 2. Reducible groin / abdominal hernia; 3. Testicular torsion / epididymo-orchitis; 4. Varicocele; 5. Obstructed / strangulated hernia
- differential web.triageSurgical: 1. Inguinal hernia
- emergency level: emergency (acuity=urgent, action=emergency_now, score=75)
- alarms: Tachycardia [web.triage.vitalRedFlags]; Tachypnoea [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; Testicular / scrotal signs [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; HR 140 bpm — unexplained tachycardia [web.clinicalPrompts.safety]; Hernia — elective repair indicated [web.clinicalPrompts.safety]
- recommended scores: qsofa, news2
- score values: (none)
- dx variant: (none) (Hernia)
- note: PANE features applied: groin_swelling, testicular_pain, scrotal_swelling
- note: AssessmentTab ManagementPanel protocol: inguinal_hernia (from PANE top)
- note: PlanTab protocol: inguinal_hernia (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (10)

</details>

### Parastomal hernia

#### `hernia-parastomal-symptomatic` — 

69-year-old man with an end colostomy (abdominoperineal resection 3 years ago) and a growing parastomal bulge causing appliance leaks and intermittent colicky pain. EHS 2018: CT when uncertain, mesh repair rather than suture repair, stoma nurse input; check for recurrence of rectal cancer.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-parastomal-top3 | mustRankTopK | quality | FAIL (known gap) | EHS guidelines 2018 |  |
| level-routine | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |
| inv-ct | investigationInclude | quality | PASS | EHS guidelines 2018 |  |
| mgmt-mesh-repair | managementInclude | quality | PASS | EHS guidelines 2018 |  |
| mgmt-stoma-nurse | managementInclude | quality | PASS | EHS guidelines 2018 |  |

Failure details:

- **dx-parastomal-top3** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis [known gap: PANE applied no feature ("Incisional / ventral hernia" template, no CC hint); inguinal hernia leads on the male prior. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **level-routine** (web): web.triage: emergency (acuity=urgent, action=emergency_now, score=59); expected ≤ priority [known gap: Triage emergency_now (score 59): adaptiveTriage RED_FLAGS regexes have no negation handling ("No vomiting"); "rectal cancer" history → "Possible malignancy".]

Guidelines:

- **ehs-parastomal-2018** — EHS guidelines — prevention and treatment of parastomal hernias (2018), Diagnosis (clinical ± CT); indication for repair; mesh repair rather than suture repair; stoma relocation. Antoniou SA, Agresta F, Garcia Alamino JM, et al. European Hernia Society guidelines on prevention and treatment of parastomal hernias. Hernia. 2018;22:183–198. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Reducible groin / abdominal hernia; 2. Inguinal hernia (paediatric); 3. Wilms tumour / nephroblastoma; 4. Hepatocellular carcinoma (HCC); 5. Obstructed / strangulated hernia
- differential web.passive: 1. Reducible groin / abdominal hernia; 2. Wilms tumour / nephroblastoma; 3. Obstructed / strangulated hernia; 4. Inguinal hernia (paediatric); 5. Gastrointestinal stromal tumour (GIST)
- differential web.triageSurgical: 1. Rectal cancer
- emergency level: emergency (acuity=urgent, action=emergency_now, score=59)
- alarms: Emergency now [web.triage.emergency]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: wells-dvt, news2, caprini, must, cfs, ecog
- score values: (none)
- dx variant: (none) (Hernia)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: parastomal_hernia (from ICD)
- note: PlanTab protocol: parastomal_hernia (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (5)

</details>

### Incarcerated paraumbilical hernia

#### `hernia-paraumbilical-incarcerated-obese` — Incarcerated, obese, penicillin-allergic

53-year-old woman, BMI 39, paraumbilical hernia irreducible and tender for 14 hours with vomiting; HR 106, lactate 2.9. Strangulation cannot be excluded: emergency surgery (CT helpful in obesity if it does not delay theatre).

Permutation of `hernia-umbilical-adult-elective`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-umbilical-top3 | mustRankTopK | critical | FAIL (known gap) |  | Model P(feature \| not disease) or use a low default sensitivity (e.g. <=0.05) for features outside a disease's system; restrict the candidate set by the presenting system (breast / neck / groin). |
| level-emergency | emergencyLevel | critical | PASS | WSES guidelines 2017 |  |
| alarm-complicated-hernia | mustAlarm | critical | PASS | WSES guidelines 2017 |  |
| mgmt-emergency-surgery | managementInclude | critical | PASS | WSES guidelines 2017 |  |
| flag-penicillin-allergy | redFlags | quality | PASS |  |  |
| inv-lactate | investigationInclude | quality | FAIL (known gap) | WSES guidelines 2017 |  |
| mgmt-no-penicillin | managementExclude | quality | FAIL (known gap) |  | Filter protocol medications and prompt templates against recorded allergies (drug-class aware) and show the alternative. |
| variant-incarcerated-or-worse | dxVariant | quality | PASS |  |  |

Failure details:

- **dx-umbilical-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = cholecystitis, GORD, PUD (female: inguinal x0.3, cholecystitis x2). PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **inv-lactate** (web): no investigation matched among 26 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: No lactate in the umbilical_hernia protocol or the hernia prompts.]
- **mgmt-no-penicillin** (web): forbidden management item present in web.clinicalPrompts: "• iv piperacillin-tazobactam 4.5g tds + metronidazole 500mg tds." (+1 more) [known gap: The recorded penicillin allergy is not cross-checked: prompts propose piperacillin-tazobactam and co-amoxiclav (as found for the seed vignettes).]

Guidelines:

- **wses-hernia-2017** — WSES guidelines — emergency repair of complicated abdominal wall hernias (2017 update) (2017), Diagnosis of strangulation (clinical signs, lactate, CPK, D-dimer, CT); timing of surgery; manual reduction only without strangulation; mesh in clean (CDC I) and clean-contaminated fields. Birindelli A, Sartelli M, Di Saverio S, et al. 2017 update of the WSES guidelines for emergency repair of complicated abdominal wall hernias. World J Emerg Surg. 2017;12:37. *(statement wording/numbering not yet verified against the source)*
- **ehs-ahs-umbilical-2020** — EHS/AHS guidelines — treatment of umbilical and epigastric hernias (2020), Indication for repair; mesh vs suture by defect size; open preperitoneal flat mesh; patients with liver cirrhosis and ascites. Henriksen NA, Montgomery A, Kaufmann R, et al. Guidelines for treatment of umbilical and epigastric hernias from the European Hernia Society and Americas Hernia Society. Br J Surg. 2020;107:171–190. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Obstructed / strangulated hernia; 2. Acute cholecystitis; 3. Reducible groin / abdominal hernia; 4. Acute gastroenteritis; 5. Adhesive small bowel obstruction
- differential web.passive: 1. Obstructed / strangulated hernia; 2. Reducible groin / abdominal hernia; 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute appendicitis (paediatric)
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=53)
- alarms: Emergency now [web.triage.emergency]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Reproductive-age female with abdominal complaint [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: alvarado, ranson, web:wagner, news2, caprini, asa, rcri, stop-bang, cfs
- score values: (none)
- dx variant: hernia_incarcerated (Hernia)
- note: PANE features applied: umbilical_swelling
- note: AssessmentTab ManagementPanel protocol: umbilical_hernia (from ICD)
- note: PlanTab protocol: umbilical_hernia (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (10), IBD — Surgical Complications (Crohn's / UC) (5), Wound Management (Acute / Chronic / SSI) (5)

</details>

### Umbilical hernia (adult, elective)

#### `hernia-umbilical-adult-elective` — 

44-year-old man with a symptomatic reducible umbilical hernia, 2 cm defect on examination. EHS/AHS 2020: mesh repair (open preperitoneal flat mesh suggested) for defects ≥1 cm.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-umbilical-top3 | mustRankTopK | critical | FAIL (known gap) | EHS/AHS guidelines 2020 | Model P(feature \| not disease) or use a low default sensitivity (e.g. <=0.05) for features outside a disease's system; restrict the candidate set by the presenting system (breast / neck / groin). |
| level-routine | emergencyLevel | quality | PASS |  |  |
| mgmt-mesh | managementInclude | quality | PASS | EHS/AHS guidelines 2020 |  |
| mgmt-smoking | managementInclude | quality | FAIL (known gap) | EHS/AHS guidelines 2020 |  |
| mgmt-no-inguinal-template | managementExclude | quality | FAIL (known gap) |  | Choose the operative template by hernia site (umbilical/ventral vs inguinal) and make the tender check negation-aware. |

Failure details:

- **dx-umbilical-top3** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis [known gap: PANE top 3 = inguinal hernia (male x5), cholecystitis, GORD; umbilical_hernia (0.03, umbilical_swelling 0.90) is outranked. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **mgmt-smoking** (web): no management item matched among 24 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: The umbilical_hernia protocol has no pre-operative optimisation (smoking) step.]
- **mgmt-no-inguinal-template** (web): forbidden management item present in web.clinicalPrompts: "emergency laparoscopic inguinal hernia repair (tapp) - operative plan ───────────────────────────────────────────────────────────── ..." [known gap: computeClinicalPrompts fires the hernia pathway for any CC/exam containing "hernia", "inguinal" or "umbilical", and always attaches the adult "LAPAROSCOPIC INGUINAL HERNIA REPAIR (TAPP)" operative plan. Here also "EMERGENCY" because "non-tender" matches "tender".]

Guidelines:

- **ehs-ahs-umbilical-2020** — EHS/AHS guidelines — treatment of umbilical and epigastric hernias (2020), Indication for repair; mesh vs suture by defect size; open preperitoneal flat mesh; patients with liver cirrhosis and ascites. Henriksen NA, Montgomery A, Kaufmann R, et al. Guidelines for treatment of umbilical and epigastric hernias from the European Hernia Society and Americas Hernia Society. Br J Surg. 2020;107:171–190. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Reducible groin / abdominal hernia; 2. Inguinal hernia (paediatric); 3. Obstructed / strangulated hernia; 4. Benign prostatic hyperplasia (BPH); 5. Testicular germ cell tumour
- differential web.passive: 1. Reducible groin / abdominal hernia; 2. Obstructed / strangulated hernia; 3. Inguinal hernia (paediatric); 4. Acute cholecystitis; 5. CBD stone / obstructive jaundice
- differential web.triageSurgical: (empty)
- emergency level: priority (acuity=review, action=priority_24_48h, score=15)
- alarms: Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: hernia_reducible (Hernia)
- note: PANE features applied: umbilical_swelling
- note: AssessmentTab ManagementPanel protocol: umbilical_hernia (from ICD)
- note: PlanTab protocol: umbilical_hernia (from ICD)
- note: matchPathways: Hernia (Inguinal / Umbilical / Incisional / Femoral) (5), Wound Management (Acute / Chronic / SSI) (5)

</details>

### Umbilical hernia in cirrhosis with ascites

#### `hernia-umbilical-cirrhosis-ascites` — Cirrhosis with tense ascites

57-year-old man with alcohol-related cirrhosis (Child-Pugh B), tense ascites and a large umbilical hernia with thin, shiny skin. Risk of rupture (Flood syndrome) and high peri-operative risk: ascites control and hepatology input before (or with) repair; Child-Pugh/MELD.

Permutation of `hernia-umbilical-adult-elective`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| flag-rupture-risk | redFlags | critical | FAIL (known gap) | EASL Clinical Practice Guidelines 2018; EHS/AHS guidelines 2020 | Add a cirrhosis/ascites branch to umbilical_hernia: red flags (thin/ulcerated skin, leak → urgent repair), hepatology co-management, ascites control, Child-Pugh/MELD. |
| flag-liver-disease | redFlags | critical | PASS |  |  |
| mgmt-ascites-control | managementInclude | critical | FAIL (known gap) | EASL Clinical Practice Guidelines 2018; EHS/AHS guidelines 2020 |  |
| level-at-least-priority | emergencyLevel | quality | PASS |  |  |
| score-rec-child-pugh | scoreRecommended | quality | PASS |  |  |
| score-rec-meld | scoreRecommended | quality | PASS |  |  |
| mgmt-no-standard-day-case-plan | managementExclude | quality | FAIL (known gap) |  |  |

Failure details:

- **flag-rupture-risk** (web): no red flag matched among 18 (web.triage.reasons, web.protocol.redFlags, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative) [known gap: No web output mentions rupture/skin ulceration/leak for an umbilical hernia with ascites; the umbilical protocol red flag is only "Irreducible or tender".]
- **mgmt-ascites-control** (web): no management item matched among 33 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No ascites-control / hepatology step in the umbilical_hernia protocol, the dx variant or the prompts.]
- **mgmt-no-standard-day-case-plan** (web): forbidden management item present in web.clinicalPrompts: "... male (reduces haematoma). • ice pack to groin prn × 24h. • day-case discharge: pain controlled on oral analgesia, tolerating oral fluids, voiding. ..." [known gap: computeClinicalPrompts fires the hernia pathway for any CC/exam containing "hernia", "inguinal" or "umbilical", and always attaches the adult "LAPAROSCOPIC INGUINAL HERNIA REPAIR (TAPP)" operative plan. Its post-operative orders include day-case discharge.]

Guidelines:

- **ehs-ahs-umbilical-2020** — EHS/AHS guidelines — treatment of umbilical and epigastric hernias (2020), Indication for repair; mesh vs suture by defect size; open preperitoneal flat mesh; patients with liver cirrhosis and ascites. Henriksen NA, Montgomery A, Kaufmann R, et al. Guidelines for treatment of umbilical and epigastric hernias from the European Hernia Society and Americas Hernia Society. Br J Surg. 2020;107:171–190. *(statement wording/numbering not yet verified against the source)*
- **easl-cirrhosis-2018** — EASL Clinical Practice Guidelines — decompensated cirrhosis (2018), Ascites management (diuretics, large-volume paracentesis); umbilical hernia in patients with ascites (ascites control before repair; risk of rupture). European Association for the Study of the Liver. EASL Clinical Practice Guidelines for the management of patients with decompensated cirrhosis. J Hepatol. 2018;69:406–460. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Reducible groin / abdominal hernia; 2. Inguinal hernia (paediatric); 3. Liver disease / hepatitis / cirrhosis; 4. Hirschsprung's disease; 5. Large bowel obstruction
- differential web.passive: 1. Reducible groin / abdominal hernia; 2. Obstructed / strangulated hernia; 3. Inguinal hernia (paediatric); 4. Liver disease / hepatitis / cirrhosis; 5. Hirschsprung's disease
- differential web.triageSurgical: (empty)
- emergency level: urgent (acuity=priority, action=same_day_call, score=37)
- alarms: Acute abdominal presentation [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Albumin 29 g/L — hypoalbuminaemia [web.clinicalPrompts.safety]; Hernia — elective repair indicated [web.clinicalPrompts.safety]
- recommended scores: child-pugh, meld, gcs, news2, caprini, asa, web:audit, rcri, cfs
- score values: (none)
- dx variant: (none) (Hernia)
- note: PANE features applied: umbilical_swelling
- note: AssessmentTab ManagementPanel protocol: umbilical_hernia (from ICD)
- note: PlanTab protocol: umbilical_hernia (from ICD)
- note: matchPathways: Bowel Obstruction (Small / Large) (5), Hernia (Inguinal / Umbilical / Incisional / Femoral) (5)

</details>

### Iron-deficiency anaemia (occult GI blood loss)

#### `iron-deficiency-anaemia-over60` — 

72-year-old man with tiredness and exertional breathlessness: Hb 9.1, MCV 72, ferritin 6, no GI symptoms. BSG 2021: bidirectional endoscopy (OGD + colonoscopy) and coeliac serology; NG12: urgent referral at ≥60 with IDA.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015; BSG guidelines 2021 |  |
| flag-ida | redFlags | critical | FAIL (known gap) | BSG guidelines 2021; NICE NG12 2015 | clinical-inference.ts: add an IDA prompt from labs (low Hb for sex + low ferritin or MCV) → "BSG 2021: bidirectional endoscopy, coeliac serology; NG12 ≥60 urgent referral". |
| inv-ogd | investigationInclude | critical | PASS | BSG guidelines 2021 |  |
| inv-colonoscopy | investigationInclude | critical | FAIL (known gap) | BSG guidelines 2021; NICE NG12 2015 | Same IDA prompt. |
| mnm-gi-malignancy | mustNotMiss | quality | PASS | BSG guidelines 2021 |  |
| inv-coeliac-serology | investigationInclude | quality | FAIL (known gap) | BSG guidelines 2021 |  |
| inv-urinalysis | investigationInclude | quality | FAIL (known gap) | BSG guidelines 2021 |  |
| mgmt-iron-replacement | managementInclude | quality | FAIL (known gap) | BSG guidelines 2021 |  |

Failure details:

- **flag-ida** (web): no red flag matched among 9 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: Nothing reads the anaemia indices: severe_anaemia prompt needs Hb <8; the NG12 IDA criterion in cancer-screening needs the words "anaemia/pale/unusually tired" in the symptom chips. Hb 9.1 / MCV 72 / ferritin 6 raise nothing.]
- **inv-colonoscopy** (web): no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for D50.9 and no IDA prompt; colonoscopy never suggested.]
- **inv-coeliac-serology** (web): no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: Same as inv-colonoscopy.]
- **inv-urinalysis** (web): no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: Same as inv-colonoscopy.]
- **mgmt-iron-replacement** (web): no management item matched among 6 (web.clinicalPrompts) [known gap: Same as inv-colonoscopy.]

Guidelines:

- **bsg-ida-2021** — BSG guidelines — management of iron deficiency anaemia in adults (2021), Men and post-menopausal women with IDA: bidirectional endoscopy (OGD + colonoscopy, CT colonography if unfit); coeliac serology; urinalysis; iron replacement. Snook J, Bhala N, Beales ILP, et al. Gut. 2021;70:2030–2051. *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Refer adults aged ≥60 with iron-deficiency anaemia using a suspected cancer pathway (colorectal). National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. GORD / Reflux Oesophagitis; 3. Acute Cholecystitis
- differential web.symptomInference: 1. Heart failure; 2. Anaemia; 3. Prostate adenocarcinoma; 4. COPD / chronic bronchitis exacerbation; 5. Acute respiratory distress syndrome (ARDS)
- differential web.passive: 1. Anaemia; 2. Heart failure; 3. Acute respiratory distress syndrome (ARDS); 4. Cardiac tamponade; 5. Hypothyroidism
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=52)
- alarms: Emergency now [web.triage.emergency]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, caprini, asa, rcri, stop-bang, cfs, ecog, web:phq9
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Colonoscopy Diagnostic (Rectal Bleeding / Bowel Habit Change / Iron Deficiency) (5)

</details>

### Mallory-Weiss tear

#### `mallory-weiss-young-binge` — 

24-year-old man after an alcohol binge: repeated retching, then a streak of fresh blood in the vomit; normal observations, Hb 14.8, urea 5.2 (GBS 0). Most tears stop spontaneously; outpatient management.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | PASS | ESGE Guideline 2021 |  |
| mgmt-no-tranexamic-acid | managementExclude | critical | PASS | ESGE Guideline 2021; HALT-IT randomised trial 2020 |  |
| dx-mallory-weiss-top3 | mustRankTopK | quality | FAIL (known gap) | ESGE Guideline 2021 | socrates-to-features.ts: add ASSOC/CC rules haematemesis\|vomiting blood\|coffee.?ground → haematemesis and melaena\|black\|tarry → melaena; also seed PANE from SmartSymptomPicker chips (HpiTab.reseedPane), not only the SOCRATES answers. |
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) | ESGE Guideline 2021; ACG Clinical Guideline 2021 | adaptive-triage: grade GI bleeding by haemodynamics/GBS instead of the word; add negation handling ("no …", "denies …") before RED_FLAGS matching. |
| score-rec-gbs | scoreRecommended | quality | PASS | ESGE Guideline 2021 |  |
| mgmt-outpatient | managementInclude | quality | PASS | ESGE Guideline 2021; ACG Clinical Guideline 2021 |  |

Failure details:

- **dx-mallory-weiss-top3** (web): not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Peptic Ulcer Disease \| 3. Acute Pancreatitis [known gap: PANE top 3: appendicitis, peptic ulcer, pancreatitis — no haematemesis/vomiting_effortless features reach PANE (see UGIB gap).]
- **level-not-emergency** (web): web.triage: emergency (acuity=urgent, action=emergency_now, score=120); expected ≤ urgent [known gap: Emergency now (score 120): any "blood"/"bleed" word is an urgent red flag regardless of volume or GBS, and "No chest pain" in the HPI fires "Possible cardiac event" (adaptiveTriage reads CC+HPI free text without negation).]

Guidelines:

- **esge-2021** — ESGE Guideline — endoscopic diagnosis and management of nonvariceal upper gastrointestinal haemorrhage (NVUGIH), update 2021 (2021), GBS ≤1: outpatient management without early endoscopy; endoscopic haemostasis only for actively bleeding Mallory-Weiss tears; tranexamic acid not recommended. Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopy. 2021;53:300–332. *(statement wording/numbering not yet verified against the source)*
- **acg-2021** — ACG Clinical Guideline — upper gastrointestinal and ulcer bleeding (2021), GBS 0–1: discharge with outpatient follow-up. Laine L, Barkun AN, Saltzman JR, Martel M, Leontiadis GI. Am J Gastroenterol. 2021;116:899–917. *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Appendicitis; 2. Peptic Ulcer Disease; 3. Acute Pancreatitis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Acute gastroenteritis; 3. Acute alcoholic pancreatitis; 4. Adhesive small bowel obstruction; 5. Acute appendicitis (paediatric)
- differential web.passive: 1. Acute gastroenteritis; 2. Adhesive small bowel obstruction; 3. Acute appendicitis (paediatric); 4. Acute alcoholic pancreatitis; 5. Migraine
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=120)
- alarms: Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, forrest, news2, rockall
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: alcohol_use, nausea_vomiting, epigastric_pain
- note: AssessmentTab ManagementPanel protocol: mallory_weiss (from ICD)
- note: PlanTab protocol: mallory_weiss (from ICD)
- note: matchPathways: Chest Pain — Emergency Redirect (5), GI Bleeding (Upper and Lower) (5)

</details>

### Acute myocardial infarction presenting as epigastric pain

#### `mi-presenting-as-epigastric-pain` — 

68-year-old diabetic woman with 3 hours of epigastric "indigestion", nausea and sweating; ex-smoker, hypertensive. No chest pain words. ESC 2023: ECG within 10 minutes and hs-troponin before any GI label.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-acs | mustNotMiss | critical | FAIL (known gap) | 2023 ESC Guidelines for the management of acute coronary syndromes 2023 | Add an ACS "must-not-miss" node or a cross-check prompt for epigastric pain + diaphoresis + cardiovascular risk (diabetes, age, smoking). |
| level-emergency | emergencyLevel | critical | FAIL (known gap) | 2023 ESC Guidelines for the management of acute coronary syndromes 2023 | rules.ts: add an atypical-ACS rule (epigastric pain/indigestion + sweating/diaphoresis, or + diabetes/age ≥50) → urgent with "ECG now". |
| alarm-cardiac | mustAlarm | critical | FAIL (known gap) | 2023 ESC Guidelines for the management of acute coronary syndromes 2023 | As level-emergency. |
| inv-ecg | investigationInclude | critical | FAIL (known gap) | 2023 ESC Guidelines for the management of acute coronary syndromes 2023 | As level-emergency; chest-pain/ACS prompt with ECG + troponin. |
| inv-troponin | investigationInclude | critical | FAIL (known gap) | 2023 ESC Guidelines for the management of acute coronary syndromes 2023 | As inv-ecg. |
| mnm-acs-symptom-inference | mustNotMiss | quality | FAIL (known gap) | 2023 ESC Guidelines for the management of acute coronary syndromes 2023 |  |
| mgmt-no-gi-only-plan | managementExclude | quality | PASS | 2023 ESC Guidelines for the management of acute coronary syndromes 2023 |  |

Failure details:

- **mnm-acs** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Peptic Ulcer Disease \| 3. GORD / Reflux Oesophagitis [known gap: PANE has no cardiac disease; top 3 cholecystitis, peptic ulcer, GORD.]
- **mnm-acs-symptom-inference** (web): not in top 5 of web.symptomInference: 1. GORD / acid reflux / oesophagitis \| 2. Gallstone pancreatitis \| 3. Acute alcoholic pancreatitis \| 4. Perforated peptic ulcer \| 5. Gastric carcinoma [known gap: Symptom inference needs the chip "chest pain"; with epigastric pain + nausea it ranks GORD, pancreatitis, perforated ulcer.]
- **level-emergency** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=33); expected ≥ emergency [known gap: Same-day call only (score 33): CHEST_PAIN_TERMS and the cardiac red flag need the words "chest pain/crushing/left arm/jaw"; epigastric pain with sweating in a diabetic scores age and comorbidity only.]
- **alarm-cardiac** (web): no alarm matched among 3 (web.clinicalPrompts.safety) [known gap: Safety prompts fired are "Appendicitis — emergency surgical indication" (from "Acute abdominal pain" CC) and "Acute abdominal presentation"; nothing cardiac.]
- **inv-ecg** (web): no investigation matched among 25 (web.pane.seeded, web.clinicalPrompts) [known gap: No ECG in any output.]
- **inv-troponin** (web): no investigation matched among 25 (web.pane.seeded, web.clinicalPrompts) [known gap: No troponin in any output.]

Guidelines:

- **esc-acs-2023** — 2023 ESC Guidelines for the management of acute coronary syndromes (2023), Suspected ACS: 12-lead ECG within 10 minutes of first medical contact; hs-troponin 0 h/1 h (or 0 h/2 h) algorithm; atypical presentations (epigastric pain, nausea, diaphoresis) are more common in women, older people and people with diabetes. Byrne RA, Rossello X, Coughlan JJ, et al. Eur Heart J. 2023;44:3720–3826. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Peptic Ulcer Disease; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Gallstone pancreatitis; 3. Acute alcoholic pancreatitis; 4. Perforated peptic ulcer; 5. Gastric carcinoma
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Acute alcoholic pancreatitis; 3. Perforated peptic ulcer; 4. Chronic pancreatitis; 5. Acute gastroenteritis
- differential web.triageSurgical: (empty)
- emergency level: urgent (acuity=priority, action=same_day_call, score=33)
- alarms: Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: web:wagner, news2, caprini, web:gerdq, asa, rcri, cfs
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, nausea_vomiting
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10)

</details>

### NSAID-associated gastric ulcer (uncomplicated)

#### `nsaid-associated-gastric-ulcer` — 

58-year-old man on diclofenac for osteoarthritis and aspirin 75 mg for secondary prevention: 6 weeks of epigastric pain; OGD shows a 1 cm benign-looking antral ulcer, CLO negative, biopsies taken. Stop the NSAID, full-dose PPI 8 weeks, repeat OGD for gastric ulcer; aspirin decision stays with the clinician.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| flag-nsaid | redFlags | critical | PASS | NICE CG184 2014 |  |
| mgmt-stop-nsaid | managementInclude | critical | PASS | NICE CG184 2014 |  |
| mgmt-no-blanket-stop-aspirin | managementExclude | critical | PASS | NICE CG184 2014 |  |
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) | NICE CG184 2014 | Negation handling in adaptive-triage and computeClinicalPrompts exam-text rules. |
| inv-hpylori | investigationInclude | quality | PASS | NICE CG184 2014; Maastricht VI/Florence consensus report 2022 |  |
| mgmt-ppi-8-weeks | managementInclude | quality | FAIL (known gap) | NICE CG184 2014 |  |
| mgmt-repeat-ogd-gastric-ulcer | managementInclude | quality | PASS | NICE CG184 2014 |  |
| mgmt-no-patient-hold-advice | managementExclude | quality | PASS | NICE CG184 2014 |  |

Failure details:

- **level-not-emergency** (web): web.triage: emergency (acuity=urgent, action=emergency_now, score=52); expected ≤ priority [known gap: Emergency now (score 52): adaptiveTriage reads CC+HPI free text without negation — "No bleeding" matches the "GI or other bleeding" urgent red flag; exam "no peritonism" also fires the "Generalised peritonism" safety prompt.]
- **mgmt-ppi-8-weeks** (web): no management item matched among 42 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: peptic_ulcer protocol gives omeprazole 20 mg OD "4–8 weeks" in medications (matched only in part) — the plan text has no 8-week full-dose course for an NSAID ulcer.]

Guidelines:

- **nice-cg184** — NICE CG184 — Gastro-oesophageal reflux disease and dyspepsia in adults: investigation and management (2014), NSAID-associated peptic ulcer: stop the NSAID where possible; full-dose PPI or H2RA for 8 weeks; test for H. pylori; repeat endoscopy 6–8 weeks after treatment for gastric ulcer; low-dose aspirin continued with gastroprotection when indicated. National Institute for Health and Care Excellence. Clinical guideline CG184. London: NICE; 2014 (last updated 2019). *(statement wording/numbering not yet verified against the source)*
- **maastricht-6** — Maastricht VI/Florence consensus report — management of Helicobacter pylori infection (2022), Test for H. pylori in peptic ulcer disease; rapid urease test sensitivity reduced by PPI. Malfertheiner P, Megraud F, Rokkas T, et al. Gut. 2022;71:1724–1762. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Peptic Ulcer Disease; 3. Inguinal / Femoral Hernia
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Acute alcoholic pancreatitis; 3. Gastric carcinoma; 4. Pancreatic adenocarcinoma; 5. Perforated peptic ulcer
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Perforated peptic ulcer; 3. Acute alcoholic pancreatitis; 4. Chronic pancreatitis; 5. Pancreatic adenocarcinoma
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=52)
- alarms: Emergency now [web.triage.emergency]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: ranson, news2, caprini, web:gerdq, asa, rcri, cfs
- score values: (none)
- dx variant: (none) (Upper GI Bleed)
- note: PANE features applied: epigastric_pain, nausea_vomiting, antacid_relief
- note: AssessmentTab ManagementPanel protocol: peptic_ulcer (from ICD)
- note: PlanTab protocol: peptic_ulcer (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (27), Acute Abdomen (7), Acute Appendicitis (7)

</details>

### Hypercalcaemic crisis (primary hyperparathyroidism)

#### `parathyroid-hypercalcaemic-crisis` — Hypercalcaemic crisis (Ca 3.84, AKI, drowsy)

71-year-old woman brought in drowsy and confused with 5 days of vomiting and abdominal pain: adjusted calcium 3.84 mmol/L, PTH 38 pmol/L, creatinine 196. Hypercalcaemic crisis: emergency IV 0.9% saline, IV bisphosphonate after rehydration, stop contributing drugs, cardiac monitoring; parathyroidectomy once stable.

Permutation of `parathyroid-primary-hpt-surgical-indications`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-hypercalcaemia | mustNotMiss | critical | FAIL (known gap) | Society for Endocrinology emergency guidance 2016 |  |
| level-emergency | emergencyLevel | critical | PASS | Society for Endocrinology emergency guidance 2016 |  |
| flag-severe-hypercalcaemia | redFlags | critical | PASS | Society for Endocrinology emergency guidance 2016 |  |
| mgmt-iv-saline | managementInclude | critical | PASS | Society for Endocrinology emergency guidance 2016 |  |
| mgmt-stop-calcium-thiazide | managementInclude | critical | PASS | Society for Endocrinology emergency guidance 2016 |  |
| mgmt-no-thyroidectomy-template | managementExclude | critical | FAIL (known gap) |  | Add a Parathyroid dx-variant group ahead of Thyroid; word-boundary matching. |
| mgmt-bisphosphonate | managementInclude | quality | PASS | Society for Endocrinology emergency guidance 2016 |  |
| mgmt-no-early-loop-diuretic | managementExclude | quality | PASS | Society for Endocrinology emergency guidance 2016 |  |

Failure details:

- **mnm-hypercalcaemia** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Diverticulitis; also in web.symptomInference#2, web.passive#3 [known gap: PANE applied no feature ("Nausea / vomiting" template, SOCRATES empty); calcium is a lab value. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **mgmt-no-thyroidectomy-template** (web): forbidden management item present in web.plan: "total thyroidectomy" (+1 more) [known gap: Same dx-variant substring bug: the crisis plan opens with the elective Total Thyroidectomy template.]

Guidelines:

- **sfe-hypercalcaemia-2016** — Society for Endocrinology emergency guidance — acute hypercalcaemia in adults (2016), Severe or symptomatic hypercalcaemia: IV 0.9% saline rehydration, IV bisphosphonate after rehydration, stop contributing drugs, monitor renal function. Walsh J, Gittoes N, Selby P; Society for Endocrinology Clinical Committee. Society for Endocrinology Endocrine Emergency Guidance: Emergency management of acute hypercalcaemia in adult patients. Endocr Connect. 2016;5:G9–G11. *(statement wording/numbering not yet verified against the source)*
- **phpt-workshop-2022** — Fifth International Workshop — evaluation and management of primary hyperparathyroidism (2022), Diagnosis (PTH, exclude FHH, vitamin D); surgical indications (serum calcium >0.25 mmol/L above ULN, osteoporosis T-score ≤−2.5 or vertebral fracture, eGFR <60 mL/min, nephrolithiasis/nephrocalcinosis, hypercalciuria, age <50); localisation only once surgery is decided. Bilezikian JP, Khan AA, Silverberg SJ, et al. Evaluation and management of primary hyperparathyroidism: summary statement and guidelines from the Fifth International Workshop. J Bone Miner Res. 2022;37:2293–2314. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Acute Diverticulitis
- differential web.symptomInference: 1. DKA / hyperglycaemic hyperosmolar state; 2. Primary hyperparathyroidism / hypercalcaemia; 3. Adhesive small bowel obstruction; 4. Large bowel obstruction; 5. Sigmoid volvulus
- differential web.passive: 1. DKA / hyperglycaemic hyperosmolar state; 2. Adhesive small bowel obstruction; 3. Primary hyperparathyroidism / hypercalcaemia; 4. Large bowel obstruction; 5. Sigmoid volvulus
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=52)
- alarms: Emergency now [web.triage.emergency]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Creatinine 196 μmol/L — elevated [web.clinicalPrompts.safety]
- recommended scores: alvarado, gcs, ranson, news2, caprini, asa, rcri, cfs, ecog
- score values: (none)
- dx variant: thyroid_total (Thyroid)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: primary_hyperparathyroidism (from ICD)
- note: PlanTab protocol: primary_hyperparathyroidism (from ICD)
- note: matchPathways: Acute Abdomen (7), Acute Appendicitis (7), Anorectal (Haemorrhoids / Fissure / Fistula / Abscess) (7)

</details>

### Primary hyperparathyroidism meeting surgical criteria

#### `parathyroid-primary-hpt-surgical-indications` — 

58-year-old woman: adjusted calcium 2.86 mmol/L with inappropriately high PTH, kidney stone, radius T-score −2.7, eGFR 55, on bendroflumethiazide. Fifth International Workshop 2022: several surgical indications → parathyroidectomy (localisation once surgery is decided); exclude FHH; review the thiazide.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mgmt-stop-thiazide | managementInclude | critical | PASS | Fifth International Workshop 2022; Society for Endocrinology emergency guidance 2016 |  |
| mgmt-no-thyroidectomy-template | managementExclude | critical | FAIL (known gap) |  | Add a Parathyroid dx-variant group (E21, primary_hyperparathyroidism, parathyroid_adenoma) ahead of Thyroid, and match baseDiagnosis/keywords on word boundaries. |
| dx-hyperparathyroid-top3 | mustRankTopK | quality | FAIL (known gap) |  |  |
| level-not-emergency | emergencyLevel | quality | PASS |  |  |
| inv-fhh-exclusion | investigationInclude | quality | PASS | Fifth International Workshop 2022 |  |
| inv-localisation | investigationInclude | quality | PASS | Fifth International Workshop 2022 |  |
| mgmt-parathyroidectomy | managementInclude | quality | PASS | Fifth International Workshop 2022 |  |

Failure details:

- **dx-hyperparathyroid-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#3, web.passive#3 [known gap: PANE applied no feature (template "Other / general surgical"); hypercalcaemia is a lab finding PANE does not read. PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **mgmt-no-thyroidectomy-template** (web): forbidden management item present in web.plan: "total thyroidectomy" (+1 more) [known gap: detectDxVariants falls back to lower.includes("thyroid") for the Thyroid group: "parathyroidectomy"/"hyperparathyroidism" contain "thyroid", and "parathyroidectomy" contains the thyroid_total keyword "thyroidectomy", so the documented plan opens with "Total Thyroidectomy … levothyroxine replacement (lifelong)".]

Guidelines:

- **phpt-workshop-2022** — Fifth International Workshop — evaluation and management of primary hyperparathyroidism (2022), Diagnosis (PTH, exclude FHH, vitamin D); surgical indications (serum calcium >0.25 mmol/L above ULN, osteoporosis T-score ≤−2.5 or vertebral fracture, eGFR <60 mL/min, nephrolithiasis/nephrocalcinosis, hypercalciuria, age <50); localisation only once surgery is decided. Bilezikian JP, Khan AA, Silverberg SJ, et al. Evaluation and management of primary hyperparathyroidism: summary statement and guidelines from the Fifth International Workshop. J Bone Miner Res. 2022;37:2293–2314. *(statement wording/numbering not yet verified against the source)*
- **sfe-hypercalcaemia-2016** — Society for Endocrinology emergency guidance — acute hypercalcaemia in adults (2016), Severe or symptomatic hypercalcaemia: IV 0.9% saline rehydration, IV bisphosphonate after rehydration, stop contributing drugs, monitor renal function. Walsh J, Gittoes N, Selby P; Society for Endocrinology Clinical Committee. Society for Endocrinology Endocrine Emergency Guidance: Emergency management of acute hypercalcaemia in adult patients. Endocr Connect. 2016;5:G9–G11. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. DKA / hyperglycaemic hyperosmolar state; 2. Major depressive disorder; 3. Primary hyperparathyroidism / hypercalcaemia; 4. Hypothyroidism; 5. Cushing's syndrome
- differential web.passive: 1. DKA / hyperglycaemic hyperosmolar state; 2. Major depressive disorder; 3. Primary hyperparathyroidism / hypercalcaemia; 4. Hypothyroidism; 5. Addisonian crisis / adrenal insufficiency
- differential web.triageSurgical: (empty)
- emergency level: routine (acuity=routine, action=routine_booking, score=0)
- alarms: Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, caprini, asa, rcri, stop-bang, cfs, web:phq9
- score values: (none)
- dx variant: thyroid_total (Thyroid)
- note: PANE features applied: (none)
- note: AssessmentTab ManagementPanel protocol: primary_hyperparathyroidism (from ICD)
- note: PlanTab protocol: primary_hyperparathyroidism (from ICD)
- note: matchPathways: Wound Management (Acute / Chronic / SSI) (5)

</details>

### Pharyngeal pouch (Zenker's diverticulum)

#### `pharyngeal-pouch-elderly` — 

76-year-old man with high dysphagia in the neck, gurgling, regurgitation of undigested food hours after eating, halitosis and nocturnal cough. Dysphagia is a red flag at any age; contrast (barium) swallow before endoscopy when a pouch is suspected.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| flag-dysphagia | redFlags | critical | PASS | NICE NG12 2015 |  |
| inv-imaging-or-endoscopy | investigationInclude | critical | PASS | NICE NG12 2015; ESGE Guideline 2020 |  |
| mnm-pouch | mustNotMiss | quality | FAIL (known gap) | ESGE Guideline 2020 | Add a pharyngeal pouch node (high dysphagia, regurgitation of undigested food, halitosis, gurgling, aspiration) and a K22.5 protocol. |
| inv-barium-first | investigationInclude | quality | FAIL (known gap) | ESGE Guideline 2020 |  |
| mgmt-pouch-treatment-options | managementInclude | quality | FAIL (known gap) | ESGE Guideline 2020 |  |

Failure details:

- **mnm-pouch** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Colorectal Cancer \| 3. GORD / Reflux Oesophagitis [known gap: No pharyngeal pouch / Zenker node in PANE or symptom inference; site "Upper neck" maps to neck_lump.]
- **inv-barium-first** (web): no investigation matched among 15 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for K22.5; no output mentions a contrast swallow.]
- **mgmt-pouch-treatment-options** (web): no management item matched among 6 (web.clinicalPrompts) [known gap: No protocol for K22.5.]

Guidelines:

- **esge-zenker-2020** — ESGE Guideline — endoscopic management of gastrointestinal motility disorders, part 2 (Zenker's diverticulum) (2020), Zenker's diverticulum: diagnosis by contrast swallow/endoscopy; treatment of symptomatic pouches by flexible endoscopic or rigid (stapled) septotomy / cricopharyngeal myotomy. Weusten BLAM, Barret M, Bredenoord AJ, et al. Endoscopy. 2020;52:600–614. *(statement wording/numbering not yet verified against the source)*
- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Dysphagia at any age: urgent assessment. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Colorectal Cancer; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. GORD / acid reflux / oesophagitis; 2. Oesophageal / gastric carcinoma; 3. Gastric carcinoma; 4. Occult malignancy / systemic disease; 5. COPD / chronic bronchitis exacerbation
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Oesophageal / gastric carcinoma; 3. Upper respiratory tract infection (URTI); 4. Epiglottitis; 5. Thyroid carcinoma
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture
- emergency level: urgent (acuity=priority, action=same_day_call, score=67)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, caprini, web:gerdq, asa, curb65, rcri, cfs
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: neck_lump, weight_loss, regurgitation
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10)

</details>

### Thyroid nodule — Bethesda I (non-diagnostic)

#### `thyroid-bethesda-1-nondiagnostic` — Bethesda I (non-diagnostic)

FNA non-diagnostic. Bethesda 2023: repeat FNA with ultrasound guidance; no surgery on a non-diagnostic result alone.

Permutation of `thyroid-nodule-euthyroid-tirads4`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mgmt-no-thyroidectomy-plan | managementExclude | critical | FAIL (known gap) | The 2023 Bethesda System for Reporting Thyroid Cytopathology 2023 | Parse the Bethesda category and branch: I repeat FNA; II surveillance; III–IV repeat FNA / molecular / diagnostic lobectomy; V–VI surgery by risk (total thyroidectomy for cN1, >4 cm, ETE). |
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |
| mgmt-repeat-fna | managementInclude | quality | FAIL (known gap) | The 2023 Bethesda System for Reporting Thyroid Cytopathology 2023 |  |

Failure details:

- **level-not-emergency** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malignancy").]
- **mgmt-repeat-fna** (web): no management item matched among 11 (web.clinicalPrompts) [known gap: No output proposes a repeat FNA; E04.1 has no protocol.]
- **mgmt-no-thyroidectomy-plan** (web): forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" fires on any radiology result containing "bethesda" (any category) and attaches the TOTAL THYROIDECTOMY operative plan. Here after a non-diagnostic FNA.]

Guidelines:

- **bethesda-2023** — The 2023 Bethesda System for Reporting Thyroid Cytopathology (2023), Diagnostic categories I–VI and usual management (I repeat FNA with US guidance; II clinical and US follow-up; III repeat FNA, molecular testing, diagnostic lobectomy or surveillance; IV molecular testing, diagnostic lobectomy; V molecular testing, lobectomy or near-total thyroidectomy; VI lobectomy or near-total thyroidectomy). Ali SZ, Baloch ZW, Cochand-Priollet B, Schmitt FC, Vielh P, VanderLaan PA. The 2023 Bethesda System for Reporting Thyroid Cytopathology. Thyroid. 2023;33:1039–1044. *(statement wording/numbering not yet verified against the source)*
- **ata-2015** — 2015 American Thyroid Association guidelines — thyroid nodules and differentiated thyroid cancer (2016), Nodule evaluation (TSH first; radionuclide scan when TSH is subnormal; hyperfunctioning nodules do not need FNA); cytology-directed management; extent of surgery (total thyroidectomy for cN1 disease). Haugen BR, Alexander EK, Bible KC, et al. 2015 American Thyroid Association management guidelines for adult patients with thyroid nodules and differentiated thyroid cancer. Thyroid. 2016;26:1–133. *(statement wording/numbering not yet verified against the source)*
- **acr-tirads-2017** — ACR TI-RADS — white paper of the ACR TI-RADS committee (2017), Point-based categories TR1–TR5 and size thresholds for FNA / follow-up (TR3 FNA ≥2.5 cm; TR4 FNA ≥1.5 cm; TR5 FNA ≥1.0 cm). Tessler FN, Middleton WD, Grant EG, et al. ACR Thyroid Imaging, Reporting and Data System (TI-RADS): white paper of the ACR TI-RADS committee. J Am Coll Radiol. 2017;14:587–595. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Thyroid carcinoma; 2. Lymphoma (Hodgkin / non-Hodgkin); 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Breast carcinoma
- differential web.passive: 1. Lymphoma (Hodgkin / non-Hodgkin); 2. Thyroid carcinoma; 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Thyroid carcinoma; 3. Thyroid nodule
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Thyroid malignancy / Bethesda suspicious cytology [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: (none) (Thyroid)
- note: PANE features applied: neck_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Thyroid / Neck Mass (15), Foreign Body Ingestion / Food Bolus (7), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (7)

</details>

### Thyroid nodule — Bethesda II (benign)

#### `thyroid-bethesda-2-benign` — Bethesda II (benign)

Benign cytology, no compressive symptoms. Bethesda 2023/ATA 2015: clinical and ultrasound follow-up; surgery only for growth, compressive symptoms or patient preference.

Permutation of `thyroid-nodule-euthyroid-tirads4`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mgmt-no-thyroidectomy-plan | managementExclude | critical | FAIL (known gap) | The 2023 Bethesda System for Reporting Thyroid Cytopathology 2023; 2015 American Thyroid Association guidelines 2016 | Parse the Bethesda category and branch: I repeat FNA; II surveillance; III–IV repeat FNA / molecular / diagnostic lobectomy; V–VI surgery by risk (total thyroidectomy for cN1, >4 cm, ETE). |
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |
| mgmt-surveillance | managementInclude | quality | FAIL (known gap) | The 2023 Bethesda System for Reporting Thyroid Cytopathology 2023; 2015 American Thyroid Association guidelines 2016 |  |

Failure details:

- **level-not-emergency** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malignancy").]
- **mgmt-surveillance** (web): no management item matched among 11 (web.clinicalPrompts) [known gap: No surveillance plan; E04.1 has no protocol.]
- **mgmt-no-thyroidectomy-plan** (web): forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" fires on any radiology result containing "bethesda" (any category) and attaches the TOTAL THYROIDECTOMY operative plan. Here for benign cytology (rationale text: "Bethesda class III–VI or clinical thyroid malignancy").]

Guidelines:

- **bethesda-2023** — The 2023 Bethesda System for Reporting Thyroid Cytopathology (2023), Diagnostic categories I–VI and usual management (I repeat FNA with US guidance; II clinical and US follow-up; III repeat FNA, molecular testing, diagnostic lobectomy or surveillance; IV molecular testing, diagnostic lobectomy; V molecular testing, lobectomy or near-total thyroidectomy; VI lobectomy or near-total thyroidectomy). Ali SZ, Baloch ZW, Cochand-Priollet B, Schmitt FC, Vielh P, VanderLaan PA. The 2023 Bethesda System for Reporting Thyroid Cytopathology. Thyroid. 2023;33:1039–1044. *(statement wording/numbering not yet verified against the source)*
- **ata-2015** — 2015 American Thyroid Association guidelines — thyroid nodules and differentiated thyroid cancer (2016), Nodule evaluation (TSH first; radionuclide scan when TSH is subnormal; hyperfunctioning nodules do not need FNA); cytology-directed management; extent of surgery (total thyroidectomy for cN1 disease). Haugen BR, Alexander EK, Bible KC, et al. 2015 American Thyroid Association management guidelines for adult patients with thyroid nodules and differentiated thyroid cancer. Thyroid. 2016;26:1–133. *(statement wording/numbering not yet verified against the source)*
- **acr-tirads-2017** — ACR TI-RADS — white paper of the ACR TI-RADS committee (2017), Point-based categories TR1–TR5 and size thresholds for FNA / follow-up (TR3 FNA ≥2.5 cm; TR4 FNA ≥1.5 cm; TR5 FNA ≥1.0 cm). Tessler FN, Middleton WD, Grant EG, et al. ACR Thyroid Imaging, Reporting and Data System (TI-RADS): white paper of the ACR TI-RADS committee. J Am Coll Radiol. 2017;14:587–595. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Thyroid carcinoma; 2. Lymphoma (Hodgkin / non-Hodgkin); 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Breast carcinoma
- differential web.passive: 1. Lymphoma (Hodgkin / non-Hodgkin); 2. Thyroid carcinoma; 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Thyroid carcinoma; 3. Thyroid nodule
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Thyroid malignancy / Bethesda suspicious cytology [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: (none) (Thyroid)
- note: PANE features applied: neck_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Thyroid / Neck Mass (15), Foreign Body Ingestion / Food Bolus (7), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (7)

</details>

### Thyroid nodule — Bethesda III (AUS)

#### `thyroid-bethesda-3-aus` — Bethesda III (AUS)

Atypia of undetermined significance. Bethesda 2023: repeat FNA, molecular testing, diagnostic lobectomy or surveillance; total thyroidectomy is not the default.

Permutation of `thyroid-nodule-euthyroid-tirads4`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |
| mgmt-options | managementInclude | quality | PASS | The 2023 Bethesda System for Reporting Thyroid Cytopathology 2023 |  |
| mgmt-no-thyroidectomy-plan | managementExclude | quality | FAIL (known gap) | The 2023 Bethesda System for Reporting Thyroid Cytopathology 2023 | Parse the Bethesda category and branch: I repeat FNA; II surveillance; III–IV repeat FNA / molecular / diagnostic lobectomy; V–VI surgery by risk (total thyroidectomy for cN1, >4 cm, ETE). |
| variant-thyroid-hemithyroidectomy | dxVariant | quality | PASS |  |  |

Failure details:

- **level-not-emergency** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malignancy").]
- **mgmt-no-thyroidectomy-plan** (web): forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" fires on any radiology result containing "bethesda" (any category) and attaches the TOTAL THYROIDECTOMY operative plan.]

Guidelines:

- **bethesda-2023** — The 2023 Bethesda System for Reporting Thyroid Cytopathology (2023), Diagnostic categories I–VI and usual management (I repeat FNA with US guidance; II clinical and US follow-up; III repeat FNA, molecular testing, diagnostic lobectomy or surveillance; IV molecular testing, diagnostic lobectomy; V molecular testing, lobectomy or near-total thyroidectomy; VI lobectomy or near-total thyroidectomy). Ali SZ, Baloch ZW, Cochand-Priollet B, Schmitt FC, Vielh P, VanderLaan PA. The 2023 Bethesda System for Reporting Thyroid Cytopathology. Thyroid. 2023;33:1039–1044. *(statement wording/numbering not yet verified against the source)*
- **ata-2015** — 2015 American Thyroid Association guidelines — thyroid nodules and differentiated thyroid cancer (2016), Nodule evaluation (TSH first; radionuclide scan when TSH is subnormal; hyperfunctioning nodules do not need FNA); cytology-directed management; extent of surgery (total thyroidectomy for cN1 disease). Haugen BR, Alexander EK, Bible KC, et al. 2015 American Thyroid Association management guidelines for adult patients with thyroid nodules and differentiated thyroid cancer. Thyroid. 2016;26:1–133. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Thyroid carcinoma; 2. Lymphoma (Hodgkin / non-Hodgkin); 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Breast carcinoma
- differential web.passive: 1. Lymphoma (Hodgkin / non-Hodgkin); 2. Thyroid carcinoma; 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Thyroid carcinoma; 3. Thyroid nodule
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Thyroid malignancy / Bethesda suspicious cytology [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: thyroid_hemithyroidectomy (Thyroid)
- note: PANE features applied: neck_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Thyroid / Neck Mass (15), Foreign Body Ingestion / Food Bolus (7), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (7)

</details>

### Thyroid nodule — Bethesda IV (follicular neoplasm)

#### `thyroid-bethesda-4-follicular-neoplasm` — Bethesda IV (follicular neoplasm)

Follicular neoplasm. Bethesda 2023: molecular testing and/or diagnostic lobectomy; completion thyroidectomy only if histology shows cancer that warrants it.

Permutation of `thyroid-nodule-euthyroid-tirads4`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |
| mgmt-lobectomy | managementInclude | quality | PASS | The 2023 Bethesda System for Reporting Thyroid Cytopathology 2023 |  |
| mgmt-no-thyroidectomy-plan | managementExclude | quality | FAIL (known gap) | The 2023 Bethesda System for Reporting Thyroid Cytopathology 2023 | Parse the Bethesda category and branch: I repeat FNA; II surveillance; III–IV repeat FNA / molecular / diagnostic lobectomy; V–VI surgery by risk (total thyroidectomy for cN1, >4 cm, ETE). |
| variant-thyroid-hemithyroidectomy | dxVariant | quality | PASS |  |  |

Failure details:

- **level-not-emergency** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malignancy").]
- **mgmt-no-thyroidectomy-plan** (web): forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" fires on any radiology result containing "bethesda" (any category) and attaches the TOTAL THYROIDECTOMY operative plan.]

Guidelines:

- **bethesda-2023** — The 2023 Bethesda System for Reporting Thyroid Cytopathology (2023), Diagnostic categories I–VI and usual management (I repeat FNA with US guidance; II clinical and US follow-up; III repeat FNA, molecular testing, diagnostic lobectomy or surveillance; IV molecular testing, diagnostic lobectomy; V molecular testing, lobectomy or near-total thyroidectomy; VI lobectomy or near-total thyroidectomy). Ali SZ, Baloch ZW, Cochand-Priollet B, Schmitt FC, Vielh P, VanderLaan PA. The 2023 Bethesda System for Reporting Thyroid Cytopathology. Thyroid. 2023;33:1039–1044. *(statement wording/numbering not yet verified against the source)*
- **ata-2015** — 2015 American Thyroid Association guidelines — thyroid nodules and differentiated thyroid cancer (2016), Nodule evaluation (TSH first; radionuclide scan when TSH is subnormal; hyperfunctioning nodules do not need FNA); cytology-directed management; extent of surgery (total thyroidectomy for cN1 disease). Haugen BR, Alexander EK, Bible KC, et al. 2015 American Thyroid Association management guidelines for adult patients with thyroid nodules and differentiated thyroid cancer. Thyroid. 2016;26:1–133. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Thyroid carcinoma; 2. Lymphoma (Hodgkin / non-Hodgkin); 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Breast carcinoma
- differential web.passive: 1. Lymphoma (Hodgkin / non-Hodgkin); 2. Thyroid carcinoma; 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Thyroid carcinoma; 3. Thyroid nodule
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Thyroid malignancy / Bethesda suspicious cytology [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: thyroid_hemithyroidectomy (Thyroid)
- note: PANE features applied: neck_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Thyroid / Neck Mass (15), Foreign Body Ingestion / Food Bolus (7), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (7)

</details>

### Thyroid nodule — Bethesda V (suspicious for malignancy)

#### `thyroid-bethesda-5-suspicious` — Bethesda V (suspicious for malignancy)

Suspicious for malignancy. Bethesda 2023: molecular testing, lobectomy or near-total thyroidectomy; surgery is indicated.

Permutation of `thyroid-nodule-euthyroid-tirads4`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mgmt-surgery | managementInclude | critical | PASS | The 2023 Bethesda System for Reporting Thyroid Cytopathology 2023; 2015 American Thyroid Association guidelines 2016 |  |
| mgmt-no-surveillance-only | managementExclude | critical | PASS |  |  |
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |

Failure details:

- **level-not-emergency** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malignancy").]

Guidelines:

- **bethesda-2023** — The 2023 Bethesda System for Reporting Thyroid Cytopathology (2023), Diagnostic categories I–VI and usual management (I repeat FNA with US guidance; II clinical and US follow-up; III repeat FNA, molecular testing, diagnostic lobectomy or surveillance; IV molecular testing, diagnostic lobectomy; V molecular testing, lobectomy or near-total thyroidectomy; VI lobectomy or near-total thyroidectomy). Ali SZ, Baloch ZW, Cochand-Priollet B, Schmitt FC, Vielh P, VanderLaan PA. The 2023 Bethesda System for Reporting Thyroid Cytopathology. Thyroid. 2023;33:1039–1044. *(statement wording/numbering not yet verified against the source)*
- **ata-2015** — 2015 American Thyroid Association guidelines — thyroid nodules and differentiated thyroid cancer (2016), Nodule evaluation (TSH first; radionuclide scan when TSH is subnormal; hyperfunctioning nodules do not need FNA); cytology-directed management; extent of surgery (total thyroidectomy for cN1 disease). Haugen BR, Alexander EK, Bible KC, et al. 2015 American Thyroid Association management guidelines for adult patients with thyroid nodules and differentiated thyroid cancer. Thyroid. 2016;26:1–133. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Thyroid carcinoma; 2. Lymphoma (Hodgkin / non-Hodgkin); 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Breast carcinoma
- differential web.passive: 1. Lymphoma (Hodgkin / non-Hodgkin); 2. Thyroid carcinoma; 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Thyroid carcinoma; 3. Thyroid nodule
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Thyroid malignancy / Bethesda suspicious cytology [web.clinicalPrompts.safety]
- recommended scores: news2, ecog
- score values: (none)
- dx variant: thyroid_hemithyroidectomy (Thyroid)
- note: PANE features applied: neck_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Thyroid / Neck Mass (15), Foreign Body Ingestion / Food Bolus (7), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (7)

</details>

### Thyroid nodule — Bethesda VI with lateral neck nodes (cN1b)

#### `thyroid-bethesda-6-papillary-cn1b` — Bethesda VI with lateral neck nodes (cN1b)

Papillary carcinoma with biopsy-proven lateral neck nodes. ATA 2015: cN1 disease needs total thyroidectomy with therapeutic neck dissection; lobectomy is inadequate.

Permutation of `thyroid-nodule-euthyroid-tirads4`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mgmt-total-thyroidectomy | managementInclude | critical | PASS | 2015 American Thyroid Association guidelines 2016 |  |
| mgmt-lateral-neck-dissection | managementInclude | critical | PASS | 2015 American Thyroid Association guidelines 2016 |  |
| mgmt-no-hemithyroidectomy-prefix | managementExclude | critical | FAIL (known gap) |  | Match detectKeywords on word boundaries, check the most severe variant first (strangulated → incarcerated → reducible), and add negative look-behind for 'ir'/'non-' ("irreducible" contains "reducible"); "bethesda vi" contains "bethesda v". |
| variant-thyroid-total | dxVariant | critical | FAIL (known gap) |  | Match detectKeywords on word boundaries, check the most severe variant first (strangulated → incarcerated → reducible), and add negative look-behind for 'ir'/'non-' ("irreducible" contains "reducible"); "bethesda vi" contains "bethesda v". |
| level-not-emergency | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |

Failure details:

- **level-not-emergency** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malignancy").]
- **mgmt-no-hemithyroidectomy-prefix** (web): forbidden management item present in web.plan: "hemithyroidectomy (ipsilateral lobe + isthmus). intraoperative recurrent laryngeal nerve neuromonitoring." [known gap: Consequence of the variant bug: the plan opens with "Hemithyroidectomy (ipsilateral lobe + isthmus)" above the protocol's total-thyroidectomy steps.]
- **variant-thyroid-total** (web): detected thyroid_hemithyroidectomy in group Thyroid; expected thyroid_total [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: "bethesda vi" contains the hemithyroidectomy keyword "bethesda v", so cN1b papillary carcinoma gets the hemithyroidectomy plan prefix.]

Guidelines:

- **bethesda-2023** — The 2023 Bethesda System for Reporting Thyroid Cytopathology (2023), Diagnostic categories I–VI and usual management (I repeat FNA with US guidance; II clinical and US follow-up; III repeat FNA, molecular testing, diagnostic lobectomy or surveillance; IV molecular testing, diagnostic lobectomy; V molecular testing, lobectomy or near-total thyroidectomy; VI lobectomy or near-total thyroidectomy). Ali SZ, Baloch ZW, Cochand-Priollet B, Schmitt FC, Vielh P, VanderLaan PA. The 2023 Bethesda System for Reporting Thyroid Cytopathology. Thyroid. 2023;33:1039–1044. *(statement wording/numbering not yet verified against the source)*
- **ata-2015** — 2015 American Thyroid Association guidelines — thyroid nodules and differentiated thyroid cancer (2016), Nodule evaluation (TSH first; radionuclide scan when TSH is subnormal; hyperfunctioning nodules do not need FNA); cytology-directed management; extent of surgery (total thyroidectomy for cN1 disease). Haugen BR, Alexander EK, Bible KC, et al. 2015 American Thyroid Association management guidelines for adult patients with thyroid nodules and differentiated thyroid cancer. Thyroid. 2016;26:1–133. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Thyroid carcinoma; 2. Lymphoma (Hodgkin / non-Hodgkin); 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Breast carcinoma
- differential web.passive: 1. Lymphoma (Hodgkin / non-Hodgkin); 2. Thyroid carcinoma; 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Thyroid carcinoma; 3. Thyroid nodule
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Sodium 1.8 mmol/L — hyponatraemia [web.clinicalPrompts.safety]; Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Thyroid malignancy / Bethesda suspicious cytology [web.clinicalPrompts.safety]; Breast malignancy — imaging or examination features [web.clinicalPrompts.safety]
- recommended scores: news2, ecog
- score values: (none)
- dx variant: thyroid_hemithyroidectomy (Thyroid)
- note: PANE features applied: neck_lump
- note: AssessmentTab ManagementPanel protocol: thyroid_carcinoma (from ICD)
- note: PlanTab protocol: thyroid_carcinoma (from ICD)
- note: matchPathways: Thyroid / Neck Mass (15), Foreign Body Ingestion / Food Bolus (7), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (7)

</details>

### Thyroid nodule (euthyroid, TI-RADS TR4)

#### `thyroid-nodule-euthyroid-tirads4` — 

46-year-old woman with a 2.2 cm solid hypoechoic right thyroid nodule (ACR TI-RADS TR4), TSH normal. TSH first; ultrasound risk stratification; TR4 ≥1.5 cm → ultrasound-guided FNA. No radionuclide scan when TSH is normal.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-thyroid-top3 | mustRankTopK | critical | FAIL (known gap) | British Thyroid Association guidelines 2014 | Model P(feature \| not disease) or use a low default sensitivity (e.g. <=0.05) for features outside a disease's system; restrict the candidate set by the presenting system (breast / neck / groin). |
| inv-tsh | investigationInclude | critical | PASS | 2015 American Thyroid Association guidelines 2016; British Thyroid Association guidelines 2014 |  |
| mgmt-us-fna-recommended | managementInclude | critical | PASS | ACR TI-RADS 2017; British Thyroid Association guidelines 2014 |  |
| level-not-urgent | emergencyLevel | quality | FAIL (known gap) |  | Add a negation window ("no", "denies", "never", "non-") before RED_FLAGS / symptom regex matches in adaptive-triage. |
| inv-us | investigationInclude | quality | FAIL (known gap) | ACR TI-RADS 2017; British Thyroid Association guidelines 2014 | Add E04.1/E04.2 to the thyroid_nodule_benign protocol prefixes and make the prompt add US/FNA as investigations. |
| inv-fna | investigationInclude | quality | FAIL (known gap) | ACR TI-RADS 2017 |  |
| inv-no-isotope-scan | investigationExclude | quality | PASS | 2015 American Thyroid Association guidelines 2016 |  |
| inv-no-unrelated-seeded-orders | investigationExclude | quality | FAIL (known gap) |  | Model P(feature \| not disease) or use a low default sensitivity (e.g. <=0.05) for features outside a disease's system; restrict the candidate set by the presenting system (breast / neck / groin). |

Failure details:

- **dx-thyroid-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#2, web.triageSurgical#2 [known gap: PANE top 3 = cholecystitis, GORD, PUD after neck_lump (thyroid_nodule_benign prior 0.03, thyroid_carcinoma 0.01). PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]
- **level-not-urgent** (web): web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malignancy").]
- **inv-us** (web): no investigation matched among 21 (web.pane.seeded, web.clinicalPrompts) [known gap: US and FNA appear only as plan text of the "Thyroid Nodule → USS + FNAC" prompt (addToPlan), not as investigation orders; E04.1 (the correct code for a single non-toxic nodule) maps to no protocol (the benign-nodule protocol is keyed on D34).]
- **inv-fna** (web): no investigation matched among 21 (web.pane.seeded, web.clinicalPrompts) [known gap: As above (plan text only).]
- **inv-no-unrelated-seeded-orders** (web): forbidden investigation present in web.pane.seeded: "blood cultures × 2 (before antibiotics) (cholecystitis)" (+6 more) [known gap: The wrong PANE top 3 seeds blood cultures, MRCP, erect CXR, OGD and group & save for a thyroid nodule.]

Guidelines:

- **ata-2015** — 2015 American Thyroid Association guidelines — thyroid nodules and differentiated thyroid cancer (2016), Nodule evaluation (TSH first; radionuclide scan when TSH is subnormal; hyperfunctioning nodules do not need FNA); cytology-directed management; extent of surgery (total thyroidectomy for cN1 disease). Haugen BR, Alexander EK, Bible KC, et al. 2015 American Thyroid Association management guidelines for adult patients with thyroid nodules and differentiated thyroid cancer. Thyroid. 2016;26:1–133. *(statement wording/numbering not yet verified against the source)*
- **acr-tirads-2017** — ACR TI-RADS — white paper of the ACR TI-RADS committee (2017), Point-based categories TR1–TR5 and size thresholds for FNA / follow-up (TR3 FNA ≥2.5 cm; TR4 FNA ≥1.5 cm; TR5 FNA ≥1.0 cm). Tessler FN, Middleton WD, Grant EG, et al. ACR Thyroid Imaging, Reporting and Data System (TI-RADS): white paper of the ACR TI-RADS committee. J Am Coll Radiol. 2017;14:587–595. *(statement wording/numbering not yet verified against the source)*
- **bta-2014** — British Thyroid Association guidelines — management of thyroid cancer (2014), Investigation of thyroid nodules (TFTs, ultrasound, FNAC); urgent referral features (stridor, rapidly enlarging mass, voice change); anaplastic carcinoma and lymphoma. Perros P, Boelaert K, Colley S, et al. Guidelines for the management of thyroid cancer. Clin Endocrinol (Oxf). 2014;81(Suppl 1):1–122. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Thyroid carcinoma; 2. Lymphoma (Hodgkin / non-Hodgkin); 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Breast carcinoma
- differential web.passive: 1. Lymphoma (Hodgkin / non-Hodgkin); 2. Thyroid carcinoma; 3. Kawasaki disease; 4. Pharyngitis / tonsillitis; 5. Acute cholecystitis
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Thyroid carcinoma; 3. Thyroid nodule
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2
- score values: (none)
- dx variant: (none) (Thyroid)
- note: PANE features applied: neck_lump
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Thyroid / Neck Mass (15), Foreign Body Ingestion / Food Bolus (7), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (7)

</details>

### Hyperfunctioning thyroid nodule (toxic adenoma)

#### `thyroid-nodule-hyperthyroid-hot` — Suppressed TSH (toxic adenoma)

39-year-old woman with a 2.8 cm nodule and suppressed TSH. ATA 2015/2016: subnormal TSH → radionuclide scan; a hyperfunctioning ("hot") nodule does not need FNA; symptomatic beta-blockade; definitive radioiodine or surgery.

Permutation of `thyroid-nodule-euthyroid-tirads4`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-hyperthyroid-top3 | mustRankTopK | quality | FAIL (known gap) |  |  |
| inv-radionuclide-scan | investigationInclude | quality | PASS | 2015 American Thyroid Association guidelines 2016; 2016 ATA guidelines 2016 |  |
| inv-no-fna-first | investigationExclude | quality | PASS | 2015 American Thyroid Association guidelines 2016 |  |
| mgmt-beta-blocker | managementInclude | quality | PASS | 2016 ATA guidelines 2016 |  |
| mgmt-definitive | managementInclude | quality | PASS | 2016 ATA guidelines 2016 |  |

Failure details:

- **dx-hyperthyroid-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = cholecystitis, GORD, PUD: SOCRATES answers carry no thyrotoxic features (heat intolerance/palpitations are chips, not SOCRATES text). PANE: unlisted features count at DEFAULT_SENSITIVITY 0.30 for every disease and there is no false-positive term, so high-prior abdominal diseases (cholecystitis 0.15, GORD 0.12, PUD 0.10; male inguinal hernia x5) outrank the organ-specific disease after a single non-abdominal feature.]

Guidelines:

- **ata-2015** — 2015 American Thyroid Association guidelines — thyroid nodules and differentiated thyroid cancer (2016), Nodule evaluation (TSH first; radionuclide scan when TSH is subnormal; hyperfunctioning nodules do not need FNA); cytology-directed management; extent of surgery (total thyroidectomy for cN1 disease). Haugen BR, Alexander EK, Bible KC, et al. 2015 American Thyroid Association management guidelines for adult patients with thyroid nodules and differentiated thyroid cancer. Thyroid. 2016;26:1–133. *(statement wording/numbering not yet verified against the source)*
- **ata-hyper-2016** — 2016 ATA guidelines — hyperthyroidism and other causes of thyrotoxicosis (2016), Toxic adenoma: radionuclide uptake scan, beta-blockade, definitive treatment (radioactive iodine or surgery). Ross DS, Burch HB, Cooper DS, et al. 2016 American Thyroid Association guidelines for diagnosis and management of hyperthyroidism and other causes of thyrotoxicosis. Thyroid. 2016;26:1343–1421. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Hyperthyroidism / thyrotoxicosis; 2. Lymphoma (Hodgkin / non-Hodgkin); 3. Phaeochromocytoma; 4. Thyroid carcinoma; 5. Pulmonary tuberculosis
- differential web.passive: 1. Hyperthyroidism / thyrotoxicosis; 2. Lymphoma (Hodgkin / non-Hodgkin); 3. Phaeochromocytoma; 4. Pulmonary tuberculosis; 5. Atrial fibrillation / flutter
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 2. Thyroid nodule
- emergency level: urgent (acuity=priority, action=same_day_call, score=25)
- alarms: Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: news2, web:gad7
- score values: (none)
- dx variant: thyroid_hemithyroidectomy (Thyroid)
- note: PANE features applied: neck_lump
- note: AssessmentTab ManagementPanel protocol: hyperthyroidism (from ICD)
- note: PlanTab protocol: hyperthyroidism (from ICD)
- note: matchPathways: Thyroid / Neck Mass (10), Cancer Screening (Age/Sex Appropriate) (7), Colonoscopy Diagnostic (Rectal Bleeding / Bowel Habit Change / Iron Deficiency) (7)

</details>

### Symptomatic hypocalcaemia after total thyroidectomy

#### `thyroid-post-op-hypocalcaemia` — 

44-year-old woman on day 1 after total thyroidectomy with perioral tingling, carpopedal spasm, positive Chvostek sign, adjusted calcium 1.78 mmol/L, PTH undetectable, QTc 490 ms. Symptomatic hypocalcaemia: IV calcium gluconate with cardiac monitoring, check/correct magnesium, oral calcium + alfacalcidol.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| level-at-least-urgent | emergencyLevel | critical | FAIL (known gap) | Society for Endocrinology emergency guidance 2016 | Add post-thyroidectomy hypocalcaemia rules: symptoms (perioral tingling, carpopedal spasm) and adjusted calcium below range → urgent; IV calcium gluconate + ECG prompt. |
| flag-hypocalcaemia | redFlags | critical | FAIL (known gap) | Society for Endocrinology emergency guidance 2016 |  |
| mgmt-iv-calcium | managementInclude | critical | FAIL (known gap) | Society for Endocrinology emergency guidance 2016 |  |
| inv-ecg | investigationInclude | quality | FAIL (known gap) | Society for Endocrinology emergency guidance 2016 |  |
| inv-magnesium | investigationInclude | quality | FAIL (known gap) | Society for Endocrinology emergency guidance 2016 |  |
| mgmt-oral-calcium-vitd | managementInclude | quality | FAIL (known gap) | Society for Endocrinology emergency guidance 2016 |  |

Failure details:

- **level-at-least-urgent** (web): web.triage: priority (acuity=review, action=priority_24_48h, score=25); expected ≥ urgent [known gap: Triage priority_24_48h (score 25, post-op only): no rule for tingling/tetany/hypocalcaemia and lab values are not read by adaptiveTriage.]
- **flag-hypocalcaemia** (web): no red flag matched among 6 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: No web engine reads the adjusted calcium 1.78 mmol/L or the symptoms; E89.2 maps to no protocol.]
- **inv-ecg** (web): no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: No ECG/cardiac monitoring proposed.]
- **inv-magnesium** (web): no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: No magnesium proposed.]
- **mgmt-iv-calcium** (web): no management item matched among 5 (web.clinicalPrompts) [known gap: No IV calcium gluconate anywhere (only inside the elective thyroidectomy operative template, which does not fire here).]
- **mgmt-oral-calcium-vitd** (web): no management item matched among 5 (web.clinicalPrompts) [known gap: No oral calcium / alfacalcidol plan.]

Guidelines:

- **sfe-hypocalcaemia-2016** — Society for Endocrinology emergency guidance — acute hypocalcaemia in adults (2016), Symptomatic or severe hypocalcaemia: IV calcium gluconate with cardiac monitoring; check and correct magnesium; oral calcium and active vitamin D for post-surgical hypoparathyroidism. Turner J, Gittoes N, Selby P; Society for Endocrinology Clinical Committee. Society for Endocrinology Endocrine Emergency Guidance: Emergency management of acute hypocalcaemia in adult patients. Endocr Connect. 2016;5:G7–G8. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Surgical Site Infection (SSI); 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Carpal tunnel syndrome; 2. Peripheral neuropathy; 3. Acute compartment syndrome; 4. Sciatica / lumbar radiculopathy; 5. Lumbar disc disease / sciatica
- differential web.passive: 1. Peripheral neuropathy; 2. Acute compartment syndrome; 3. Carpal tunnel syndrome; 4. Sciatica / lumbar radiculopathy; 5. Lumbar disc disease / sciatica
- differential web.triageSurgical: 1. Thyroid carcinoma
- emergency level: priority (acuity=review, action=priority_24_48h, score=25)
- alarms: Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: wells-pe, wells-dvt, news2, clavien-dindo, ecog
- score values: (none)
- dx variant: thyroid_total (Thyroid)
- note: PANE features applied: wound_erythema, wound_discharge
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Thyroid / Neck Mass (5), Wound Management (Acute / Chronic / SSI) (5)

</details>

### Neck haematoma after thyroidectomy with airway compromise

#### `thyroid-post-op-neck-haematoma` — 

51-year-old woman 5 hours after total thyroidectomy: rapidly enlarging tense neck swelling, stridor, SpO2 90%. DAS/BAETS 2022: call for help and decompress at the bedside immediately (SCOOP: skin exposure, cut sutures, open skin, open muscles, pack), then theatre; do not wait for imaging.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-haematoma-top3 | mustRankTopK | critical | FAIL (known gap) | DAS / BAETS / ENT UK consensus 2022 | Map "wound swelling"/"neck swelling" after surgery to wound_seroma (haematoma) rather than infection features. |
| level-emergency | emergencyLevel | critical | PASS | DAS / BAETS / ENT UK consensus 2022 |  |
| alarm-emergency | mustAlarm | critical | PASS | DAS / BAETS / ENT UK consensus 2022 |  |
| mgmt-bedside-decompression | managementInclude | critical | PASS | DAS / BAETS / ENT UK consensus 2022 |  |
| mgmt-no-conservative-first | managementExclude | critical | PASS | DAS / BAETS / ENT UK consensus 2022 |  |
| alarm-airway-specific | mustAlarm | quality | FAIL (known gap) | DAS / BAETS / ENT UK consensus 2022 |  |
| inv-no-imaging-before-decompression | investigationExclude | quality | FAIL (known gap) | DAS / BAETS / ENT UK consensus 2022 |  |
| mgmt-return-to-theatre | managementInclude | quality | PASS | DAS / BAETS / ENT UK consensus 2022 |  |
| mgmt-no-thyroidectomy-prefix | managementExclude | quality | FAIL (known gap) |  | Match detectKeywords on word boundaries, check the most severe variant first (strangulated → incarcerated → reducible), and add negative look-behind for 'ir'/'non-' ("irreducible" contains "reducible"); "bethesda vi" contains "bethesda v". |

Failure details:

- **dx-haematoma-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Surgical Site Infection (SSI) \| 3. GORD / Reflux Oesophagitis [known gap: PANE top 3 = cholecystitis, surgical site infection, GORD: the "Post-op wound concern" template hints wound_erythema/wound_discharge (infection features), and no neck-swelling feature exists. The T81.0 plan itself is correct (bedside wound opening).]
- **alarm-airway-specific** (web): no alarm matched among 8 (web.triage.vitalRedFlags, web.triage.emergency, web.clinicalPrompts.safety) [known gap: The alarm is the generic triage "Emergency now" (RR, SpO2, HR); no alarm names the neck haematoma or airway.]
- **inv-no-imaging-before-decompression** (web): forbidden investigation present in web.plan.investigations: "uss wound (confirm haematoma, guide aspiration of liquefied collections)" (+3 more) [known gap: The generic postop_haematoma investigations include "USS wound (confirm haematoma …)" with no exception for a neck haematoma with airway compromise.]
- **mgmt-no-thyroidectomy-prefix** (web): forbidden management item present in web.plan: "total thyroidectomy" (+1 more) [known gap: The assessment mentions "thyroidectomy", so detectDxVariants selects thyroid_total and prepends the elective Total Thyroidectomy template to the haematoma plan.]

Guidelines:

- **das-baets-haematoma-2022** — DAS / BAETS / ENT UK consensus — management of haematoma after thyroid surgery (2022), Recognition (neck swelling, stridor, respiratory distress); SCOOP (Skin exposure, Cut sutures, Open skin, Open muscles, Pack) bedside decompression; call for help; airway management and return to theatre. Iliff HA, El-Boghdadly K, Ahmad I, et al. Management of haematoma after thyroid surgery: systematic review and multidisciplinary consensus guidelines from the Difficult Airway Society, the British Association of Endocrine and Thyroid Surgeons and the British Association of Otorhinolaryngology, Head and Neck Surgery. Anaesthesia. 2022;77:82–95. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Surgical Site Infection (SSI); 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Epiglottitis; 2. Croup / laryngotracheobronchitis; 3. Thyroid carcinoma; 4. COPD / chronic bronchitis exacerbation; 5. Tension pneumothorax
- differential web.passive: 1. Epiglottitis; 2. Croup / laryngotracheobronchitis; 3. Thyroid carcinoma; 4. Tension pneumothorax; 5. Acute respiratory distress syndrome (ARDS)
- differential web.triageSurgical: 1. Thyroid nodule
- emergency level: emergency (acuity=urgent, action=emergency_now, score=175)
- alarms: Tachycardia [web.triage.vitalRedFlags]; Tachypnoea [web.triage.vitalRedFlags]; Low SpO₂ [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; Pre-operative assessment [web.clinicalPrompts.safety]; Anticoagulation therapy [web.clinicalPrompts.safety]; SpO₂ 90% — hypoxia [web.clinicalPrompts.safety]; HR 122 bpm — unexplained tachycardia [web.clinicalPrompts.safety]
- recommended scores: wells-pe, wells-dvt, qsofa, web:wagner, news2, clavien-dindo, curb65
- score values: (none)
- dx variant: thyroid_total (Thyroid)
- note: PANE features applied: wound_erythema, wound_discharge, dysphagia_progressive, dyspnoea_pe
- note: AssessmentTab ManagementPanel protocol: postop_haematoma (from ICD)
- note: PlanTab protocol: postop_haematoma (from ICD)
- note: matchPathways: Thyroid / Neck Mass (10), Post-operative Follow-up (General) (5), Wound Management (Acute / Chronic / SSI) (5)

</details>

### Rapidly enlarging thyroid mass with stridor (anaplastic carcinoma / lymphoma)

#### `thyroid-rapid-enlargement-stridor` — 

76-year-old woman with Hashimoto's thyroiditis and a hard neck mass that has doubled in 3 weeks, now with stridor, hoarseness and dysphagia. Anaplastic carcinoma or thyroid lymphoma: airway first (senior anaesthesia/ENT), urgent core biopsy (FNA may miss lymphoma), rapid staging; not an elective thyroidectomy pathway.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mnm-anaplastic-or-lymphoma | mustNotMiss | critical | FAIL (known gap) | 2021 ATA guidelines 2021; British Thyroid Association guidelines 2014 | Add anaplastic carcinoma and primary thyroid lymphoma to PANE and a rapid-growth feature; add an ATC/lymphoma branch to the thyroid carcinoma protocol. |
| level-emergency | emergencyLevel | critical | PASS | 2021 ATA guidelines 2021; British Thyroid Association guidelines 2014 |  |
| alarm-emergency | mustAlarm | critical | PASS | 2021 ATA guidelines 2021 |  |
| inv-core-biopsy | investigationInclude | critical | FAIL (known gap) | 2021 ATA guidelines 2021 |  |
| mgmt-airway | managementInclude | critical | FAIL (known gap) | 2021 ATA guidelines 2021 | Add a stridor/airway safety rule (triage + prompts): senior anaesthetic/ENT airway review, oxygen, steroids, no elective pathway. |
| mnm-thyroid-malignancy | mustNotMiss | quality | FAIL (known gap) |  |  |
| alarm-airway-specific | mustAlarm | quality | FAIL (known gap) | 2021 ATA guidelines 2021 |  |
| inv-ct-neck-chest | investigationInclude | quality | PASS | 2021 ATA guidelines 2021 |  |
| mgmt-no-elective-thyroidectomy-plan | managementExclude | quality | PASS | 2021 ATA guidelines 2021 |  |

Failure details:

- **mnm-anaplastic-or-lymphoma** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Colorectal Cancer \| 3. GORD / Reflux Oesophagitis [known gap: PANE has no anaplastic thyroid carcinoma or thyroid lymphoma disease; top 3 = cholecystitis, colorectal cancer, GORD. The thyroid_carcinoma protocol is papillary-oriented.]
- **mnm-thyroid-malignancy** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Colorectal Cancer \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#3, web.passive#2 [known gap: Thyroid carcinoma not in the PANE top 3 (see above).]
- **alarm-airway-specific** (web): no alarm matched among 7 (web.triage.vitalRedFlags, web.triage.emergency, web.clinicalPrompts.safety) [known gap: The only alarm is the generic triage "Emergency now" (vital signs); nothing names stridor or the airway.]
- **inv-core-biopsy** (web): no investigation matched among 35 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: Only FNAC is proposed (protocol and prompt); no core/open biopsy to distinguish anaplastic carcinoma from lymphoma.]
- **mgmt-airway** (web): no management item matched among 48 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No airway step in any web output: triage has no stridor rule (the emergency comes from RR/SpO2), prompts have no airway rule, and the C73 protocol lists stridor only as a red flag.]

Guidelines:

- **ata-atc-2021** — 2021 ATA guidelines — anaplastic thyroid cancer (2021), Rapid diagnosis (core or open biopsy when FNA is non-diagnostic; exclude lymphoma), airway assessment and management, rapid staging, BRAF testing, multidisciplinary decision on resection. Bible KC, Kebebew E, Brierley J, et al. 2021 American Thyroid Association guidelines for management of patients with anaplastic thyroid cancer. Thyroid. 2021;31:337–386. *(statement wording/numbering not yet verified against the source)*
- **bta-2014** — British Thyroid Association guidelines — management of thyroid cancer (2014), Investigation of thyroid nodules (TFTs, ultrasound, FNAC); urgent referral features (stridor, rapidly enlarging mass, voice change); anaplastic carcinoma and lymphoma. Perros P, Boelaert K, Colley S, et al. Guidelines for the management of thyroid cancer. Clin Endocrinol (Oxf). 2014;81(Suppl 1):1–122. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Colorectal Cancer; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Epiglottitis; 2. Oesophageal / gastric carcinoma; 3. Thyroid carcinoma; 4. Occult malignancy / systemic disease; 5. Gastric carcinoma
- differential web.passive: 1. Epiglottitis; 2. Thyroid carcinoma; 3. Croup / laryngotracheobronchitis; 4. Oesophageal / gastric carcinoma; 5. Lung carcinoma
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Unexplained weight loss / GI alarm symptoms — endoscopy workup; 3. Thyroid nodule
- emergency level: emergency (acuity=urgent, action=emergency_now, score=192)
- alarms: Tachypnoea [web.triage.vitalRedFlags]; Low SpO₂ [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; SpO₂ 93% — hypoxia [web.clinicalPrompts.safety]
- recommended scores: wells-pe, qsofa, news2, caprini, asa, curb65, rcri, cfs, ecog
- score values: (none)
- dx variant: (none) (Thyroid)
- note: PANE features applied: neck_lump, weight_loss, dysphagia_progressive, hoarseness, dyspnoea_pe
- note: AssessmentTab ManagementPanel protocol: thyroid_carcinoma (from ICD)
- note: PlanTab protocol: thyroid_carcinoma (from ICD)
- note: matchPathways: Thyroid / Neck Mass (15), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10)

</details>

### Retrosternal multinodular goitre with tracheal compression

#### `thyroid-retrosternal-goitre-compression` — 

68-year-old woman with a long-standing multinodular goitre, now breathless lying flat, positive Pemberton sign; CT: retrosternal extension 5 cm below the thoracic inlet, trachea narrowed to 8 mm. Compressive goitre: TFTs, CT (done), airway planning, total thyroidectomy (possible sternotomy) — urgent, not routine.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| flag-compression | redFlags | critical | FAIL (known gap) | NICE NG145 2019 | Add compressive-goitre red flags (orthopnoea, Pemberton, tracheal narrowing on CT) and map E04.2 to a goitre protocol. |
| mgmt-thyroidectomy | managementInclude | critical | PASS | NICE NG145 2019 |  |
| level-at-least-priority | emergencyLevel | quality | PASS | NICE NG145 2019 |  |
| inv-tfts | investigationInclude | quality | PASS |  |  |
| inv-ct | investigationInclude | quality | FAIL (known gap) | NICE NG145 2019 |  |
| mgmt-airway-planning | managementInclude | quality | PASS |  |  |

Failure details:

- **flag-compression** (web): no red flag matched among 16 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: No red flag names tracheal compression, stridor or retrosternal extension; triage escalates only because "breathless" matches the post-operative-concern rule. E04.2 maps to no protocol.]
- **inv-ct** (web): no investigation matched among 24 (web.pane.seeded, web.clinicalPrompts) [known gap: CT neck/thorax appears only inside the thyroidectomy prompt plan text, not as an investigation.]

Guidelines:

- **nice-ng145-2019** — NICE NG145 — Thyroid disease: assessment and management (2019), Non-malignant thyroid enlargement: investigation and referral (compressive symptoms, stridor); surgery for compressive goitre. National Institute for Health and Care Excellence. Thyroid disease: assessment and management. NICE guideline NG145. London: NICE; 2019. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Acute Diverticulitis
- differential web.symptomInference: 1. Heart failure; 2. Thyroid carcinoma; 3. Epiglottitis; 4. Oesophageal / gastric carcinoma; 5. Cardiac tamponade
- differential web.passive: 1. Heart failure; 2. Epiglottitis; 3. Cardiac tamponade; 4. Thyroid carcinoma; 5. Tension pneumothorax
- differential web.triageSurgical: 1. Dysphagia / oesophageal stricture; 2. Thyroid nodule; 3. Multinodular goitre
- emergency level: emergency (acuity=urgent, action=emergency_now, score=102)
- alarms: Emergency now [web.triage.emergency]; Thyroid nodule / neck mass [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Thyroid malignancy / Bethesda suspicious cytology [web.clinicalPrompts.safety]
- recommended scores: wells-pe, news2, caprini, asa, curb65, rcri, cfs
- score values: (none)
- dx variant: thyroid_total (Thyroid)
- note: PANE features applied: neck_lump, dysphagia_progressive, dyspnoea_pe
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: Thyroid / Neck Mass (10), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10)

</details>

### Acute upper GI bleeding (non-variceal)

#### `ugib-nonvariceal-gbs-high` — 

62-year-old man on ibuprofen with 2 days of melaena and one coffee-ground vomit; HR 104, SBP 112, Hb 9.8 g/dL, urea 14 mmol/L. Glasgow-Blatchford 12: admit, resuscitate, endoscopy within 24 h.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | FAIL (known gap) | ESGE Guideline 2021 | socrates-to-features.ts: add ASSOC/CC rules haematemesis\|vomiting blood\|coffee.?ground → haematemesis and melaena\|black\|tarry → melaena; also seed PANE from SmartSymptomPicker chips (HpiTab.reseedPane), not only the SOCRATES answers. |
| level-at-least-urgent | emergencyLevel | critical | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |
| alarm-gi-bleed | mustAlarm | critical | PASS | ESGE Guideline 2021 |  |
| inv-group-save | investigationInclude | critical | PASS | BSG-led multisociety consensus care bundle 2020 |  |
| inv-ogd | investigationInclude | critical | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |
| mgmt-ogd-within-24h | managementInclude | critical | PASS | ESGE Guideline 2021; NICE CG141 2012; ACG Clinical Guideline 2021 |  |
| mgmt-no-tranexamic-acid | managementExclude | critical | FAIL (known gap) | ESGE Guideline 2021; HALT-IT randomised trial 2020 | Remove tranexamic acid from the upper_gi_bleed protocol medications (ESGE 2021 recommends against it; HALT-IT). Surgeon sign-off needed. |
| flag-nsaid | redFlags | quality | PASS | ESGE Guideline 2021 |  |
| score-rec-gbs | scoreRecommended | quality | PASS | ESGE Guideline 2021; Glasgow-Blatchford score 2000 |  |
| inv-fbc-urea | investigationInclude | quality | PASS | NICE CG141 2012 |  |
| mgmt-restrictive-transfusion | managementInclude | quality | PASS | ESGE Guideline 2021; BSG-led multisociety consensus care bundle 2020 |  |
| mgmt-ppi | managementInclude | quality | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |
| mgmt-stop-nsaid | managementInclude | quality | FAIL (known gap) | ESGE Guideline 2021; NICE CG184 2014 |  |
| mgmt-hpylori | managementInclude | quality | PASS | ESGE Guideline 2021; Maastricht VI/Florence consensus report 2022 |  |
| variant-nonvariceal | dxVariant | quality | PASS | ESGE Guideline 2021 |  |

Failure details:

- **dx-ugib-top3** (web): not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Inguinal / Femoral Hernia \| 3. Acute / Chronic Gastritis; also in web.symptomInference#1, web.passive#2, web.triageSurgical#1 [known gap: PANE top 3: GORD, inguinal hernia, gastritis. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1.]
- **mgmt-stop-nsaid** (web): no management item matched among 46 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: The upper_gi_bleed protocol only says "PPI long-term if NSAID cannot be stopped"; no line tells the clinician to stop the NSAID.]
- **mgmt-no-tranexamic-acid** (web): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]

Guidelines:

- **esge-2021** — ESGE Guideline — endoscopic diagnosis and management of nonvariceal upper gastrointestinal haemorrhage (NVUGIH), update 2021 (2021), GBS for pre-endoscopy risk stratification; restrictive transfusion (Hb ≤7 g/dL, target 7–9; ≤8 and target ≥10 with cardiovascular disease); early endoscopy ≤24 h after resuscitation; high-dose PPI; tranexamic acid not recommended; H. pylori testing. Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopy. 2021;53:300–332. *(statement wording/numbering not yet verified against the source)*
- **nice-cg141** — NICE CG141 — Acute upper gastrointestinal bleeding in over 16s: management (2012), Blatchford at first assessment; endoscopy within 24 h of admission; no PPI before endoscopy for suspected non-variceal bleeding. National Institute for Health and Care Excellence. Clinical guideline CG141. London: NICE; 2012 (last updated 2016). *(statement wording/numbering not yet verified against the source)*
- **acg-2021** — ACG Clinical Guideline — upper gastrointestinal and ulcer bleeding (2021), Endoscopy within 24 h of presentation for hospitalised patients with UGIB. Laine L, Barkun AN, Saltzman JR, Martel M, Leontiadis GI. Am J Gastroenterol. 2021;116:899–917. *(statement wording/numbering not yet verified against the source)*
- **bsg-2020** — BSG-led multisociety consensus care bundle — early clinical management of acute upper gastrointestinal bleeding (2020), Care bundle: risk assess with GBS; group and save / crossmatch; restrictive transfusion; OGD within 24 h. Siau K, Hearnshaw S, Stanley AJ, et al. Frontline Gastroenterol. 2020;11:311–323. *(statement wording/numbering not yet verified against the source)*
- **blatchford-2000** — Glasgow-Blatchford score — derivation (2000), Score components: urea, Hb (sex-specific), SBP, HR, melaena, syncope, hepatic disease, cardiac failure. Blatchford O, Murray WR, Blatchford M. A risk score to predict need for treatment for upper-gastrointestinal haemorrhage. Lancet. 2000;356:1318–1321. *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid did not reduce death from GI bleeding and increased venous thromboembolic events. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*
- **nice-cg184** — NICE CG184 — Gastro-oesophageal reflux disease and dyspepsia in adults: investigation and management (2014), Stop NSAIDs in peptic ulcer disease where possible. National Institute for Health and Care Excellence. Clinical guideline CG184. London: NICE; 2014 (last updated 2019). *(statement wording/numbering not yet verified against the source)*
- **maastricht-6** — Maastricht VI/Florence consensus report — management of Helicobacter pylori infection (2022), Test for H. pylori in peptic ulcer bleeding; re-test if negative in the acute setting. Malfertheiner P, Megraud F, Rokkas T, et al. Gut. 2022;71:1724–1762. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Inguinal / Femoral Hernia; 3. Acute / Chronic Gastritis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Portal hypertension / oesophageal varices; 3. Gastric carcinoma; 4. Meckel's diverticulum; 5. Acute alcoholic pancreatitis
- differential web.passive: 1. Portal hypertension / oesophageal varices; 2. Upper GI haemorrhage; 3. Meckel's diverticulum; 4. Gastric carcinoma; 5. GORD / acid reflux / oesophagitis
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=87)
- alarms: Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, ranson, forrest, news2, rockall, caprini, web:gerdq, asa, rcri
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting, epigastric_pain, heartburn
- note: AssessmentTab ManagementPanel protocol: upper_gi_bleed (from ICD)
- note: PlanTab protocol: upper_gi_bleed (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (10), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (5)

</details>

#### `ugib-cvd-dual-antiplatelet` — Cardiovascular disease on dual antiplatelets (coronary stent 2 months ago)

69-year-old man with a drug-eluting coronary stent 2 months ago on aspirin and clopidogrel; melaena, HR 98, SBP 118, Hb 7.6, urea 13.1. Transfusion threshold is 8 g/dL with cardiovascular disease; antiplatelet management is a clinician/cardiology decision.

Permutation of `ugib-nonvariceal-gbs-high`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | FAIL (known gap) | ESGE Guideline 2021 | socrates-to-features.ts: add ASSOC/CC rules haematemesis\|vomiting blood\|coffee.?ground → haematemesis and melaena\|black\|tarry → melaena; also seed PANE from SmartSymptomPicker chips (HpiTab.reseedPane), not only the SOCRATES answers. |
| level-at-least-urgent | emergencyLevel | critical | PASS | ESGE Guideline 2021 |  |
| flag-antiplatelet | redFlags | critical | PASS | ESGE Guideline 2021 |  |
| inv-group-save | investigationInclude | critical | PASS | BSG-led multisociety consensus care bundle 2020 |  |
| mgmt-ogd-within-24h | managementInclude | critical | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |
| mgmt-no-blanket-stop-aspirin | managementExclude | critical | PASS | ESGE Guideline 2021 |  |
| mgmt-no-tranexamic-acid | managementExclude | critical | FAIL (known gap) | ESGE Guideline 2021; HALT-IT randomised trial 2020 | Remove tranexamic acid from the upper_gi_bleed protocol medications (ESGE 2021 recommends against it; HALT-IT). Surgeon sign-off needed. |
| score-rec-gbs | scoreRecommended | quality | PASS | ESGE Guideline 2021 |  |
| mgmt-transfusion-threshold-8 | managementInclude | quality | PASS | ESGE Guideline 2021; BSG-led multisociety consensus care bundle 2020 |  |
| mgmt-cardiology-antiplatelet-decision | managementInclude | quality | FAIL (known gap) | ESGE Guideline 2021 | Add an antiplatelet-in-GI-bleed prompt (aspirin/clopidogrel/ticagrelor/prasugrel): "Clinician/cardiology decision — ESGE: do not interrupt low-dose aspirin for secondary prevention; P2Y12 with cardiology". |
| mgmt-no-patient-hold-advice | managementExclude | quality | PASS | ESGE Guideline 2021 |  |

Failure details:

- **dx-ugib-top3** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#5, web.triageSurgical#1 [known gap: PANE top 3: inguinal hernia, cholecystitis, GORD. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1.]
- **mgmt-cardiology-antiplatelet-decision** (web): no management item matched among 42 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: Antiplatelets are only a triage reason ("Anticoagulant or antiplatelet medication mentioned"); no plan line routes the aspirin/clopidogrel decision to cardiology. The anticoag prompt does not list aspirin or clopidogrel.]
- **mgmt-no-tranexamic-acid** (web): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]

Guidelines:

- **esge-2021** — ESGE Guideline — endoscopic diagnosis and management of nonvariceal upper gastrointestinal haemorrhage (NVUGIH), update 2021 (2021), Transfusion threshold Hb ≤8 g/dL (target ≥10) with cardiovascular disease; low-dose aspirin for secondary prophylaxis not interrupted (resume within 3–5 days if stopped); dual antiplatelet therapy — P2Y12 decision with cardiology. Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopy. 2021;53:300–332. *(statement wording/numbering not yet verified against the source)*
- **bsg-2020** — BSG-led multisociety consensus care bundle — early clinical management of acute upper gastrointestinal bleeding (2020), Restrictive transfusion: threshold 70 g/L, 80 g/L with cardiovascular disease. Siau K, Hearnshaw S, Stanley AJ, et al. Frontline Gastroenterol. 2020;11:311–323. *(statement wording/numbering not yet verified against the source)*
- **nice-cg141** — NICE CG141 — Acute upper gastrointestinal bleeding in over 16s: management (2012), Endoscopy within 24 h of admission. National Institute for Health and Care Excellence. Clinical guideline CG141. London: NICE; 2012 (last updated 2016). *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Meckel's diverticulum; 3. Heart failure; 4. Acute respiratory distress syndrome (ARDS); 5. Portal hypertension / oesophageal varices
- differential web.passive: 1. Meckel's diverticulum; 2. Acute respiratory distress syndrome (ARDS); 3. Portal hypertension / oesophageal varices; 4. Cardiac tamponade; 5. Upper GI haemorrhage
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=164)
- alarms: Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Haemoglobin 7.6 g/dL — severe anaemia [web.clinicalPrompts.safety]
- recommended scores: wells-pe, glasgow-blatchford, qsofa, forrest, curb65, news2, rockall, caprini, asa, rcri, stop-bang, cfs, web:phq9
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting, epigastric_pain
- note: AssessmentTab ManagementPanel protocol: upper_gi_bleed (from ICD)
- note: PlanTab protocol: upper_gi_bleed (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (15), Chest Pain — Emergency Redirect (10)

</details>

#### `ugib-elderly-doac-pre-endoscopy-rockall` — Very elderly, rivaroxaban, heart failure — pre-endoscopy Rockall 5

84-year-old man with heart failure and AF on rivaroxaban; melaena, HR 106, SBP 108, Hb 10.4, urea 16.2 (GBS 12; pre-endoscopy Rockall 5: age ≥80 → 2, pulse >100 → 1, heart failure → 2).

Permutation of `ugib-nonvariceal-gbs-high`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | PASS | ESGE Guideline 2021 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | ESGE Guideline 2021 |  |
| flag-anticoagulant | redFlags | critical | PASS | ESGE Guideline 2021 |  |
| inv-group-save | investigationInclude | critical | PASS | BSG-led multisociety consensus care bundle 2020 |  |
| mgmt-ogd-within-24h | managementInclude | critical | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |
| mgmt-no-lmwh-bridging | managementExclude | critical | FAIL (known gap) | ESGE Guideline 2021 | clinical-inference.ts anticoag_check: suppress the bridging template when GI haemorrhage is present (gi_bleed_panel fired) and replace it with "Anticoagulant: withhold/reversal decision by clinician (ESGE 2021)". |
| mgmt-no-tranexamic-acid | managementExclude | critical | FAIL (known gap) | ESGE Guideline 2021; HALT-IT randomised trial 2020 | Remove tranexamic acid from the upper_gi_bleed protocol medications (ESGE 2021 recommends against it; HALT-IT). Surgeon sign-off needed. |
| score-rec-gbs | scoreRecommended | quality | PASS | ESGE Guideline 2021; Glasgow-Blatchford score 2000 |  |
| score-rec-rockall | scoreRecommended | quality | PASS | Rockall score 1996; NICE CG141 2012 |  |
| inv-renal-function | investigationInclude | quality | PASS | ESGE Guideline 2021 |  |
| mgmt-transfusion-threshold-8 | managementInclude | quality | FAIL (known gap) | ESGE Guideline 2021 | upper_gi_bleed protocol: add the ESGE cardiovascular threshold (Hb ≤8 g/dL, target ≥10) and key it on cardiac comorbidity. |

Failure details:

- **mgmt-transfusion-threshold-8** (web): no management item matched among 39 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: Only the generic "transfuse to Hb 70–90 g/L" line; heart failure does not change the threshold to 8 g/dL.]
- **mgmt-no-lmwh-bridging** (web): forbidden management item present in web.clinicalPrompts: "...dging: hold doac 48-72h pre-op (renal-adjusted); warfarin - bridge with lmwh per haematology protocol." [known gap: computeClinicalPrompts anticoag_check (any anticoagulant) adds the elective peri-operative plan line "hold DOAC 48–72h pre-op; warfarin — bridge with LMWH per haematology protocol" to an actively bleeding patient.]
- **mgmt-no-tranexamic-acid** (web): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]

Guidelines:

- **esge-2021** — ESGE Guideline — endoscopic diagnosis and management of nonvariceal upper gastrointestinal haemorrhage (NVUGIH), update 2021 (2021), DOACs: withhold at presentation; reversal agents/PCC only for life-threatening bleeding; transfusion threshold ≤8 g/dL with cardiovascular disease. Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopy. 2021;53:300–332. *(statement wording/numbering not yet verified against the source)*
- **nice-cg141** — NICE CG141 — Acute upper gastrointestinal bleeding in over 16s: management (2012), Formal risk assessment with Blatchford at first assessment and full Rockall after endoscopy. National Institute for Health and Care Excellence. Clinical guideline CG141. London: NICE; 2012 (last updated 2016). *(statement wording/numbering not yet verified against the source)*
- **rockall-1996** — Rockall score — derivation (1996), Pre-endoscopy components: age (≥80 → 2), shock (pulse >100 → 1; SBP <100 → 2), comorbidity (cardiac failure/IHD → 2; renal/liver failure, disseminated malignancy → 3). Rockall TA, Logan RF, Devlin HB, Northfield TC. Risk assessment after acute upper gastrointestinal haemorrhage. Gut. 1996;38:316–321. *(statement wording/numbering not yet verified against the source)*
- **blatchford-2000** — Glasgow-Blatchford score — derivation (2000), Score components (cardiac failure → 2). Blatchford O, Murray WR, Blatchford M. A risk score to predict need for treatment for upper-gastrointestinal haemorrhage. Lancet. 2000;356:1318–1321. *(statement wording/numbering not yet verified against the source)*
- **bsg-2020** — BSG-led multisociety consensus care bundle — early clinical management of acute upper gastrointestinal bleeding (2020), Care bundle: group and save; review anticoagulants. Siau K, Hearnshaw S, Stanley AJ, et al. Frontline Gastroenterol. 2020;11:311–323. *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. GORD / Reflux Oesophagitis; 3. Peptic Ulcer Disease
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Meckel's diverticulum; 3. Portal hypertension / oesophageal varices; 4. Prostate adenocarcinoma; 5. Gastric carcinoma
- differential web.passive: 1. Meckel's diverticulum; 2. Portal hypertension / oesophageal varices; 3. Upper GI haemorrhage; 4. Anaemia; 5. Gastrointestinal stromal tumour (GIST)
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=126)
- alarms: Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Anticoagulation therapy [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, cha2ds2-vasc, forrest, news2, rockall, has-bled, asa, rcri, stop-bang, cfs, web:phq9
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting, epigastric_pain, anorexia
- note: AssessmentTab ManagementPanel protocol: upper_gi_bleed (from ICD)
- note: PlanTab protocol: upper_gi_bleed (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (15)

</details>

#### `ugib-melaena-only-woman` — Melaena alone, no haematemesis, no NSAID (woman <55)

47-year-old woman with 4 days of black stools and postural dizziness, no vomiting; HR 96, SBP 116, Hb 8.4, urea 12.0 (GBS 11). Tests recognition of an upper GI source from melaena alone.

Permutation of `ugib-nonvariceal-gbs-high`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | PASS | ESGE Guideline 2021 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | ESGE Guideline 2021 |  |
| alarm-gi-bleed | mustAlarm | critical | PASS | ESGE Guideline 2021 |  |
| inv-ogd | investigationInclude | critical | PASS | ESGE Guideline 2021 |  |
| mgmt-ogd-within-24h | managementInclude | critical | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |
| mgmt-no-tranexamic-acid | managementExclude | critical | FAIL (known gap) | ESGE Guideline 2021; HALT-IT randomised trial 2020 | Remove tranexamic acid from the upper_gi_bleed protocol medications (ESGE 2021 recommends against it; HALT-IT). Surgeon sign-off needed. |
| score-rec-gbs | scoreRecommended | quality | PASS | ESGE Guideline 2021 |  |
| variant-nonvariceal | dxVariant | quality | PASS | ESGE Guideline 2021 |  |

Failure details:

- **mgmt-no-tranexamic-acid** (web): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]

Guidelines:

- **esge-2021** — ESGE Guideline — endoscopic diagnosis and management of nonvariceal upper gastrointestinal haemorrhage (NVUGIH), update 2021 (2021), Melaena is an upper GI bleed presentation; GBS risk stratification; endoscopy ≤24 h. Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopy. 2021;53:300–332. *(statement wording/numbering not yet verified against the source)*
- **nice-cg141** — NICE CG141 — Acute upper gastrointestinal bleeding in over 16s: management (2012), Endoscopy within 24 h of admission. National Institute for Health and Care Excellence. Clinical guideline CG141. London: NICE; 2012 (last updated 2016). *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Peptic Ulcer Disease; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Meckel's diverticulum; 3. Portal hypertension / oesophageal varices; 4. BPPV / labyrinthitis / vestibular neuritis; 5. Gastric carcinoma
- differential web.passive: 1. Upper GI haemorrhage; 2. Meckel's diverticulum; 3. Portal hypertension / oesophageal varices; 4. BPPV / labyrinthitis / vestibular neuritis; 5. Gastric carcinoma
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=65)
- alarms: Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, forrest, news2, rockall, web:gerdq
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting, epigastric_pain, nocturnal_pain
- note: AssessmentTab ManagementPanel protocol: upper_gi_bleed (from ICD)
- note: PlanTab protocol: upper_gi_bleed (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (10), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (5)

</details>

#### `ugib-nonvariceal-gbs-low-outpatient` — Very low risk — Glasgow-Blatchford 0, outpatient management

26-year-old man, one small coffee-ground vomit after three days of dyspepsia; normal pulse and BP, Hb 14.6, urea 4.8, no melaena. Glasgow-Blatchford 0: outpatient endoscopy, not admission.

Permutation of `ugib-nonvariceal-gbs-high`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | PASS | ESGE Guideline 2021 |  |
| mgmt-no-tranexamic-acid | managementExclude | critical | FAIL (known gap) | ESGE Guideline 2021; HALT-IT randomised trial 2020 | Remove tranexamic acid from the upper_gi_bleed protocol medications (ESGE 2021 recommends against it; HALT-IT). Surgeon sign-off needed. |
| level-not-emergency | emergencyLevel | quality | PASS | ESGE Guideline 2021; ACG Clinical Guideline 2021 |  |
| score-rec-gbs | scoreRecommended | quality | PASS | ESGE Guideline 2021; Glasgow-Blatchford score 2000 |  |
| inv-ogd | investigationInclude | quality | PASS | ESGE Guideline 2021 |  |
| mgmt-outpatient | managementInclude | quality | FAIL (known gap) | ESGE Guideline 2021; ACG Clinical Guideline 2021; BSG-led multisociety consensus care bundle 2020 | upper_gi_bleed protocol / gi_bleed_panel prompt: add "GBS ≤1 — outpatient endoscopy, no admission (ESGE 2021, ACG 2021)" keyed on the calculated GBS. |
| mgmt-no-transfusion | managementExclude | quality | FAIL (known gap) | ESGE Guideline 2021 | gi_bleed_panel: make the resuscitation/crossmatch line conditional on instability, Hb or GBS. |

Failure details:

- **mgmt-outpatient** (web): no management item matched among 35 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No output says the patient can be managed as an outpatient; the GI-bleed prompt adds a resuscitation plan instead.]
- **mgmt-no-tranexamic-acid** (web): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]
- **mgmt-no-transfusion** (web): forbidden management item present in web.clinicalPrompts: "• 2 × large-bore iv cannulae, hartmann's 500ml bolus, crossmatch 2 units prbc." [known gap: gi_bleed_panel prompt fires on any haematemesis/melaena symptom and adds "2 × large-bore IV cannulae, Hartmann's 500 ml bolus, crossmatch 2 units pRBC" regardless of Hb (14.6) or GBS (0).]

Guidelines:

- **esge-2021** — ESGE Guideline — endoscopic diagnosis and management of nonvariceal upper gastrointestinal haemorrhage (NVUGIH), update 2021 (2021), GBS ≤1: very low risk of rebleeding, intervention or death — no early endoscopy or hospital admission needed; outpatient management. Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopy. 2021;53:300–332. *(statement wording/numbering not yet verified against the source)*
- **acg-2021** — ACG Clinical Guideline — upper gastrointestinal and ulcer bleeding (2021), Patients with GBS 0–1 may be discharged with outpatient follow-up. Laine L, Barkun AN, Saltzman JR, Martel M, Leontiadis GI. Am J Gastroenterol. 2021;116:899–917. *(statement wording/numbering not yet verified against the source)*
- **bsg-2020** — BSG-led multisociety consensus care bundle — early clinical management of acute upper gastrointestinal bleeding (2020), Care bundle: GBS 0–1 — consider discharge with outpatient endoscopy. Siau K, Hearnshaw S, Stanley AJ, et al. Frontline Gastroenterol. 2020;11:311–323. *(statement wording/numbering not yet verified against the source)*
- **blatchford-2000** — Glasgow-Blatchford score — derivation (2000), Score components; score 0 identifies patients not needing intervention. Blatchford O, Murray WR, Blatchford M. A risk score to predict need for treatment for upper-gastrointestinal haemorrhage. Lancet. 2000;356:1318–1321. *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. GORD / Reflux Oesophagitis; 2. Peptic Ulcer Disease; 3. Acute / Chronic Gastritis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Acute alcoholic pancreatitis; 3. GORD / acid reflux / oesophagitis; 4. Perforated peptic ulcer; 5. Chronic pancreatitis
- differential web.passive: 1. GORD / acid reflux / oesophagitis; 2. Perforated peptic ulcer; 3. Acute alcoholic pancreatitis; 4. Chronic pancreatitis; 5. Pancreatic adenocarcinoma
- differential web.triageSurgical: (empty)
- emergency level: priority (acuity=review, action=priority_24_48h, score=15)
- alarms: GI haemorrhage [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, forrest, ranson, news2, rockall, web:gerdq
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: alcohol_use, nausea_vomiting, epigastric_pain, heartburn, antacid_relief
- note: AssessmentTab ManagementPanel protocol: gord (from PANE top)
- note: PlanTab protocol: upper_gi_bleed (from ICD)
- note: matchPathways: Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (5)

</details>

#### `ugib-nonvariceal-unstable-shock` — Haemodynamic instability — haemorrhagic shock

70-year-old man collapsed after a large haematemesis and melaena: HR 128, SBP 82, Hb 7.2, urea 22. GBS 17. Resuscitate (major haemorrhage), then endoscopy immediately after resuscitation.

Permutation of `ugib-nonvariceal-gbs-high`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | FAIL (known gap) | ESGE Guideline 2021 | socrates-to-features.ts: add ASSOC/CC rules haematemesis\|vomiting blood\|coffee.?ground → haematemesis and melaena\|black\|tarry → melaena; also seed PANE from SmartSymptomPicker chips (HpiTab.reseedPane), not only the SOCRATES answers. |
| level-emergency | emergencyLevel | critical | PASS | NICE CG141 2012; ESGE Guideline 2021 |  |
| alarm-haemodynamic | mustAlarm | critical | PASS | ESGE Guideline 2021 |  |
| alarm-gi-bleed | mustAlarm | critical | PASS | ESGE Guideline 2021 |  |
| inv-group-crossmatch | investigationInclude | critical | PASS | BSG-led multisociety consensus care bundle 2020 |  |
| mgmt-resuscitation | managementInclude | critical | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |
| mgmt-transfusion | managementInclude | critical | PASS | ESGE Guideline 2021; BSG-led multisociety consensus care bundle 2020 |  |
| mgmt-endoscopy-after-resus | managementInclude | critical | PASS | NICE CG141 2012; ESGE Guideline 2021 |  |
| mgmt-no-tranexamic-acid | managementExclude | critical | FAIL (known gap) | ESGE Guideline 2021; HALT-IT randomised trial 2020 | Remove tranexamic acid from the upper_gi_bleed protocol medications (ESGE 2021 recommends against it; HALT-IT). Surgeon sign-off needed. |
| score-rec-gbs | scoreRecommended | quality | PASS | ESGE Guideline 2021; Glasgow-Blatchford score 2000 |  |
| inv-coagulation | investigationInclude | quality | PASS | BSG-led multisociety consensus care bundle 2020 |  |
| mgmt-critical-care | managementInclude | quality | FAIL (known gap) | BSG-led multisociety consensus care bundle 2020 | dx-variants.ts: order ugib_variceal before ugib_nonvariceal_stable (most specific first) and add an unstable variant; keep lint:dx-phases in step. |
| mgmt-escalation-ir-surgery | managementInclude | quality | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |

Failure details:

- **dx-ugib-top3** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#2, web.triageSurgical#1 [known gap: PANE top 3: inguinal hernia, cholecystitis, GORD. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1.]
- **mgmt-critical-care** (web): no management item matched among 53 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No HDU/ICU/critical-care line in the protocol, prompts or dx variant; the only variant is "haemodynamically stable".]
- **mgmt-no-tranexamic-acid** (web): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]

Guidelines:

- **esge-2021** — ESGE Guideline — endoscopic diagnosis and management of nonvariceal upper gastrointestinal haemorrhage (NVUGIH), update 2021 (2021), Haemodynamic resuscitation first; early endoscopy after resuscitation; tranexamic acid not recommended. Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopy. 2021;53:300–332. *(statement wording/numbering not yet verified against the source)*
- **nice-cg141** — NICE CG141 — Acute upper gastrointestinal bleeding in over 16s: management (2012), Offer endoscopy to unstable patients with severe acute UGIB immediately after resuscitation; major haemorrhage protocol. National Institute for Health and Care Excellence. Clinical guideline CG141. London: NICE; 2012 (last updated 2016). *(statement wording/numbering not yet verified against the source)*
- **bsg-2020** — BSG-led multisociety consensus care bundle — early clinical management of acute upper gastrointestinal bleeding (2020), Care bundle: large-bore access, crossmatch, major haemorrhage protocol, critical care. Siau K, Hearnshaw S, Stanley AJ, et al. Frontline Gastroenterol. 2020;11:311–323. *(statement wording/numbering not yet verified against the source)*
- **blatchford-2000** — Glasgow-Blatchford score — derivation (2000), Score components (urea, Hb, SBP <90 → 3, HR, melaena, syncope → 2). Blatchford O, Murray WR, Blatchford M. A risk score to predict need for treatment for upper-gastrointestinal haemorrhage. Lancet. 2000;356:1318–1321. *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Portal hypertension / oesophageal varices; 3. Vasovagal / reflex syncope; 4. Meckel's diverticulum; 5. Gastric carcinoma
- differential web.passive: 1. Portal hypertension / oesophageal varices; 2. Upper GI haemorrhage; 3. Vasovagal / reflex syncope; 4. Meckel's diverticulum; 5. Gastrointestinal stromal tumour (GIST)
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=267)
- alarms: Hypotension [web.triage.vitalRedFlags]; Tachycardia [web.triage.vitalRedFlags]; Tachypnoea [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; SBP 82 mmHg — hypotension [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Haemoglobin 7.2 g/dL — severe anaemia [web.clinicalPrompts.safety]; Creatinine 132 μmol/L — elevated [web.clinicalPrompts.safety]; HR 128 bpm — unexplained tachycardia [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, qsofa, forrest, news2, rockall, cfs
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting, epigastric_pain
- note: AssessmentTab ManagementPanel protocol: upper_gi_bleed (from ICD)
- note: PlanTab protocol: upper_gi_bleed (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (20)

</details>

#### `ugib-on-warfarin-high-inr` — Anticoagulated — warfarin, INR 4.8, elderly woman

78-year-old woman with AF on warfarin (INR 4.8) and melaena; HR 108, SBP 104, Hb 9.4, urea 11.8 (GBS 13). Anticoagulant must be flagged for a clinician decision; no peri-operative LMWH bridging during an active bleed.

Permutation of `ugib-nonvariceal-gbs-high`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | PASS | ESGE Guideline 2021 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | ESGE Guideline 2021 |  |
| flag-anticoagulant | redFlags | critical | PASS | ESGE Guideline 2021 |  |
| inv-inr | investigationInclude | critical | PASS | ESGE Guideline 2021 |  |
| inv-group-save | investigationInclude | critical | PASS | BSG-led multisociety consensus care bundle 2020 |  |
| mgmt-ogd-within-24h | managementInclude | critical | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |
| mgmt-no-lmwh-bridging | managementExclude | critical | FAIL (known gap) | ESGE Guideline 2021 | clinical-inference.ts anticoag_check: suppress the bridging template when GI haemorrhage is present (gi_bleed_panel fired) and replace it with "Anticoagulant: withhold/reversal decision by clinician (ESGE 2021)". |
| mgmt-no-tranexamic-acid | managementExclude | critical | FAIL (known gap) | ESGE Guideline 2021; HALT-IT randomised trial 2020 | Remove tranexamic acid from the upper_gi_bleed protocol medications (ESGE 2021 recommends against it; HALT-IT). Surgeon sign-off needed. |
| flag-coagulopathy | redFlags | quality | PASS | ESGE Guideline 2021 |  |
| score-rec-gbs | scoreRecommended | quality | PASS | ESGE Guideline 2021 |  |
| mgmt-reversal-considered | managementInclude | quality | PASS | ESGE Guideline 2021 |  |
| mgmt-no-patient-hold-advice | managementExclude | quality | PASS | ESGE Guideline 2021 |  |

Failure details:

- **mgmt-no-lmwh-bridging** (web): forbidden management item present in web.clinicalPrompts: "...dging: hold doac 48-72h pre-op (renal-adjusted); warfarin - bridge with lmwh per haematology protocol." [known gap: computeClinicalPrompts anticoag_check (any anticoagulant) adds the elective peri-operative plan line "hold DOAC 48–72h pre-op; warfarin — bridge with LMWH per haematology protocol" to an actively bleeding patient.]
- **mgmt-no-tranexamic-acid** (web): forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat — if endoscopy is delayed and haemorrhage is trauma-related or massive"; it appears in every plan built on that protocol.]

Guidelines:

- **esge-2021** — ESGE Guideline — endoscopic diagnosis and management of nonvariceal upper gastrointestinal haemorrhage (NVUGIH), update 2021 (2021), Vitamin K antagonists: withhold; in haemodynamic instability give IV vitamin K and 4-factor PCC (FFP if unavailable); endoscopy not delayed for INR correction; tranexamic acid not recommended. Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopy. 2021;53:300–332. *(statement wording/numbering not yet verified against the source)*
- **bsg-2020** — BSG-led multisociety consensus care bundle — early clinical management of acute upper gastrointestinal bleeding (2020), Care bundle: identify and manage anticoagulants early; group and save. Siau K, Hearnshaw S, Stanley AJ, et al. Frontline Gastroenterol. 2020;11:311–323. *(statement wording/numbering not yet verified against the source)*
- **nice-cg141** — NICE CG141 — Acute upper gastrointestinal bleeding in over 16s: management (2012), Endoscopy within 24 h; treat patients on warfarin with PCC and vitamin K when actively bleeding. National Institute for Health and Care Excellence. Clinical guideline CG141. London: NICE; 2012 (last updated 2016). *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Peptic Ulcer Disease; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Meckel's diverticulum; 3. Portal hypertension / oesophageal varices; 4. BPPV / labyrinthitis / vestibular neuritis; 5. Gastric carcinoma
- differential web.passive: 1. Upper GI haemorrhage; 2. Meckel's diverticulum; 3. Portal hypertension / oesophageal varices; 4. BPPV / labyrinthitis / vestibular neuritis; 5. Anaemia
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=101)
- alarms: Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; INR 4.8 — coagulopathy [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Anticoagulation therapy [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, cha2ds2-vasc, forrest, news2, rockall, caprini, has-bled, asa, rcri, cfs
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting, epigastric_pain
- note: AssessmentTab ManagementPanel protocol: upper_gi_bleed (from ICD)
- note: PlanTab protocol: upper_gi_bleed (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (15)

</details>

#### `ugib-post-endoscopy-rockall` — Post-endoscopy: duodenal ulcer Forrest IIa treated endoscopically — complete Rockall 6

66-year-old man with ischaemic heart disease after OGD: duodenal ulcer with a non-bleeding visible vessel (Forrest IIa) treated with adrenaline and clips. Complete Rockall 6. High-dose PPI for 72 h, H. pylori testing, no routine second-look.

Permutation of `ugib-nonvariceal-gbs-high`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| mgmt-high-dose-ppi-72h | managementInclude | critical | PASS | ESGE Guideline 2021; NICE CG141 2012 |  |
| mgmt-no-tranexamic-acid | managementExclude | critical | PASS | ESGE Guideline 2021; HALT-IT randomised trial 2020 |  |
| score-rec-rockall | scoreRecommended | quality | PASS | Rockall score 1996; NICE CG141 2012 |  |
| score-rec-forrest | scoreRecommended | quality | PASS | ESGE Guideline 2021 |  |
| inv-hpylori | investigationInclude | quality | PASS | ESGE Guideline 2021; Maastricht VI/Florence consensus report 2022 |  |
| mgmt-hpylori-eradication | managementInclude | quality | PASS | ESGE Guideline 2021; Maastricht VI/Florence consensus report 2022 |  |
| mgmt-oral-ppi-continuation | managementInclude | quality | PASS | ESGE Guideline 2021 |  |
| mgmt-no-routine-second-look | managementExclude | quality | PASS | ESGE Guideline 2021 |  |
| variant-nonvariceal | dxVariant | quality | PASS | ESGE Guideline 2021 |  |

Guidelines:

- **esge-2021** — ESGE Guideline — endoscopic diagnosis and management of nonvariceal upper gastrointestinal haemorrhage (NVUGIH), update 2021 (2021), High-dose PPI (e.g. 80 mg IV bolus then 8 mg/h, or intermittent bolus) for 72 h after endoscopic haemostasis; Forrest classification of stigmata; no routine second-look endoscopy; H. pylori testing and eradication. Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopy. 2021;53:300–332. *(statement wording/numbering not yet verified against the source)*
- **nice-cg141** — NICE CG141 — Acute upper gastrointestinal bleeding in over 16s: management (2012), Complete Rockall score after endoscopy; PPI after endoscopy to patients with stigmata of recent haemorrhage. National Institute for Health and Care Excellence. Clinical guideline CG141. London: NICE; 2012 (last updated 2016). *(statement wording/numbering not yet verified against the source)*
- **rockall-1996** — Rockall score — derivation (1996), Complete score adds diagnosis (all diagnoses other than Mallory-Weiss/no lesion → 1; malignancy → 2) and stigmata (visible vessel → 2). Rockall TA, Logan RF, Devlin HB, Northfield TC. Risk assessment after acute upper gastrointestinal haemorrhage. Gut. 1996;38:316–321. *(statement wording/numbering not yet verified against the source)*
- **maastricht-6** — Maastricht VI/Florence consensus report — management of Helicobacter pylori infection (2022), H. pylori eradication in bleeding peptic ulcer; confirm eradication. Malfertheiner P, Megraud F, Rokkas T, et al. Gut. 2022;71:1724–1762. *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. Acute Cholecystitis; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Meckel's diverticulum; 3. Portal hypertension / oesophageal varices; 4. Gastric carcinoma; 5. Peptic ulcer disease
- differential web.passive: 1. Upper GI haemorrhage; 2. Meckel's diverticulum; 3. Portal hypertension / oesophageal varices; 4. Peptic ulcer disease; 5. Gastric carcinoma
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=72)
- alarms: Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, forrest, news2, rockall, caprini, asa, rcri, cfs
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting, epigastric_pain
- note: AssessmentTab ManagementPanel protocol: peptic_ulcer (from ICD)
- note: PlanTab protocol: peptic_ulcer (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (10), Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia) (10), Post-operative Follow-up (General) (5)

</details>

### Gastric carcinoma (weight loss with upper abdominal pain)

#### `upper-abdominal-pain-weight-loss-over55` — 

61-year-old woman with 2 months of epigastric pain, early satiety and 6 kg unintentional weight loss; no dysphagia. NG12: aged ≥55 with weight loss and upper abdominal pain → urgent OGD within 2 weeks.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-gastric-cancer-top3 | mustRankTopK | critical | FAIL (known gap) | NICE NG12 2015 | pane-engine modifiers: age ≥55 multiplier for gastric/oesophageal carcinoma (as colorectal has); consider weight_loss likelihoods. |
| level-at-least-priority | emergencyLevel | critical | PASS | NICE NG12 2015 |  |
| flag-cancer-weight-loss | redFlags | critical | PASS | NICE NG12 2015 |  |
| inv-ogd | investigationInclude | critical | PASS | NICE NG12 2015 |  |
| inv-fbc | investigationInclude | quality | PASS | NICE NG12 2015 |  |
| mgmt-urgent-two-week-ogd | managementInclude | quality | PASS | NICE NG12 2015 |  |

Failure details:

- **dx-gastric-cancer-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Peptic Ulcer Disease \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#1, web.triageSurgical#1 [known gap: PANE top 3: cholecystitis, peptic ulcer, GORD — weight_loss/anorexia do not outweigh the cholecystitis prior (×2 female, ×1.6 age 30–70). Symptom inference, passive ranking and triageSurgical all rank gastric carcinoma #1.]

Guidelines:

- **nice-ng12** — NICE NG12 — Suspected cancer: recognition and referral (oesophageal and stomach cancer) (2015), Offer urgent direct access upper GI endoscopy (within 2 weeks) to assess for oesophageal or stomach cancer in people with dysphagia (any age), or aged ≥55 with weight loss and any of upper abdominal pain, reflux or dyspepsia; consider urgent OGD in people aged ≥55 with upper abdominal pain and low haemoglobin, or raised platelets with upper abdominal pain. National Institute for Health and Care Excellence. NICE guideline NG12. London: NICE; 2015 (last updated 2023). *(statement wording/numbering not yet verified against the source)*
- **nice-cg184** — NICE CG184 — Gastro-oesophageal reflux disease and dyspepsia in adults: investigation and management (2014), Alarm features: refer under NG12 rather than empirical treatment. National Institute for Health and Care Excellence. Clinical guideline CG184. London: NICE; 2014 (last updated 2019). *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Peptic Ulcer Disease; 3. GORD / Reflux Oesophagitis
- differential web.symptomInference: 1. Gastric carcinoma; 2. Occult malignancy / systemic disease; 3. Colorectal carcinoma; 4. Pancreatic adenocarcinoma; 5. Oesophageal / gastric carcinoma
- differential web.passive: 1. Gastric carcinoma; 2. Pancreatic adenocarcinoma; 3. Chronic pancreatitis; 4. Acute alcoholic pancreatitis; 5. HIV / AIDS presentation
- differential web.triageSurgical: 1. Gastric cancer; 2. Unexplained weight loss / GI alarm symptoms — endoscopy workup
- emergency level: urgent (acuity=priority, action=same_day_call, score=62)
- alarms: Unintentional weight loss (alarm symptom) [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]
- recommended scores: ranson, news2, caprini, web:gerdq, asa, rcri, ecog
- score values: (none)
- dx variant: (none) (no group)
- note: PANE features applied: epigastric_pain, nausea_vomiting, anorexia, weight_loss
- note: AssessmentTab ManagementPanel protocol: gastric_carcinoma (from ICD)
- note: PlanTab protocol: gastric_carcinoma (from ICD)
- note: matchPathways: IBD — Surgical Complications (Crohn's / UC) (14), Liver Lesion / Hepatic Mass (14), Pancreatic Mass / Cyst (14)

</details>

### Acute variceal bleeding in cirrhosis

#### `variceal-bleed-known-cirrhosis` — 

52-year-old man with alcohol-related cirrhosis (Child-Pugh C 11) and known oesophageal varices: large haematemesis, HR 118, SBP 94, Hb 8.1, platelets 68, INR 1.7. Baveno VII: vasoactive drug + antibiotic prophylaxis now, restrictive transfusion (Hb 7–8), endoscopy with band ligation within 12 h.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | FAIL (known gap) | Baveno VII 2022 | socrates-to-features.ts: add ASSOC/CC rules haematemesis\|vomiting blood\|coffee.?ground → haematemesis and melaena\|black\|tarry → melaena; also seed PANE from SmartSymptomPicker chips (HpiTab.reseedPane), not only the SOCRATES answers. |
| level-emergency | emergencyLevel | critical | PASS | Baveno VII 2022 |  |
| alarm-haemodynamic | mustAlarm | critical | PASS | Baveno VII 2022 |  |
| inv-group-crossmatch | investigationInclude | critical | PASS | NICE CG141 2012 |  |
| mgmt-vasoactive | managementInclude | critical | FAIL (known gap) | Baveno VII 2022; NICE CG141 2012 | Add I85 to the upper_gi_bleed protocol icd10Prefixes or add a dedicated variceal protocol (Baveno VII: vasoactive + ceftriaxone + EVL ≤12 h + restrictive Hb 7–8 + pre-emptive TIPS); fix its "80–100 in varices" transfusion target at the same time. |
| mgmt-antibiotic-prophylaxis | managementInclude | critical | FAIL (known gap) | Baveno VII 2022; NICE CG141 2012 | Add I85 to the upper_gi_bleed protocol icd10Prefixes or add a dedicated variceal protocol (Baveno VII: vasoactive + ceftriaxone + EVL ≤12 h + restrictive Hb 7–8 + pre-emptive TIPS); fix its "80–100 in varices" transfusion target at the same time. |
| mgmt-endoscopy-12h | managementInclude | critical | FAIL (known gap) | Baveno VII 2022 | Add I85 to the upper_gi_bleed protocol icd10Prefixes or add a dedicated variceal protocol (Baveno VII: vasoactive + ceftriaxone + EVL ≤12 h + restrictive Hb 7–8 + pre-emptive TIPS); fix its "80–100 in varices" transfusion target at the same time. |
| mgmt-band-ligation | managementInclude | critical | FAIL (known gap) | Baveno VII 2022; NICE CG141 2012 | Add I85 to the upper_gi_bleed protocol icd10Prefixes or add a dedicated variceal protocol (Baveno VII: vasoactive + ceftriaxone + EVL ≤12 h + restrictive Hb 7–8 + pre-emptive TIPS); fix its "80–100 in varices" transfusion target at the same time. |
| mgmt-no-liberal-transfusion-varices | managementExclude | critical | PASS | Baveno VII 2022; Restrictive vs liberal transfusion in acute upper GI bleeding (RCT) 2013 |  |
| mnm-variceal | mustNotMiss | quality | FAIL (known gap) | Baveno VII 2022 | Add a variceal haemorrhage node to pane-engine (features: haematemesis, known cirrhosis/alcohol, ascites, splenomegaly, jaundice). |
| flag-cirrhosis | redFlags | quality | PASS | Baveno VII 2022 |  |
| score-rec-child-pugh | scoreRecommended | quality | PASS | Baveno VII 2022 |  |
| score-rec-gbs | scoreRecommended | quality | PASS | NICE CG141 2012 |  |
| inv-inr-lfts | investigationInclude | quality | PASS | Baveno VII 2022 |  |
| mgmt-restrictive-transfusion-varices | managementInclude | quality | FAIL (known gap) | Baveno VII 2022; Restrictive vs liberal transfusion in acute upper GI bleeding (RCT) 2013 | Add I85 to the upper_gi_bleed protocol icd10Prefixes or add a dedicated variceal protocol (Baveno VII: vasoactive + ceftriaxone + EVL ≤12 h + restrictive Hb 7–8 + pre-emptive TIPS); fix its "80–100 in varices" transfusion target at the same time. |
| mgmt-pre-emptive-tips | managementInclude | quality | FAIL (known gap) | Baveno VII 2022 | Add I85 to the upper_gi_bleed protocol icd10Prefixes or add a dedicated variceal protocol (Baveno VII: vasoactive + ceftriaxone + EVL ≤12 h + restrictive Hb 7–8 + pre-emptive TIPS); fix its "80–100 in varices" transfusion target at the same time. |
| mgmt-no-tranexamic-acid | managementExclude | quality | PASS | HALT-IT randomised trial 2020 |  |
| variant-variceal | dxVariant | quality | FAIL (known gap) | Baveno VII 2022 | dx-variants.ts: order ugib_variceal before ugib_nonvariceal_stable (most specific first) and add an unstable variant; keep lint:dx-phases in step. |

Failure details:

- **dx-ugib-top3** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#1, web.passive#4, web.triageSurgical#1 [known gap: PANE top 3: inguinal hernia, GORD, appendicitis. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1. PANE also has no variceal node.]
- **mnm-variceal** (web): not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#2, web.passive#1 [known gap: PANE has no variceal/portal-hypertension disease; symptom inference ranks "Portal hypertension / oesophageal varices" #2.]
- **mgmt-vasoactive** (web): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- **mgmt-antibiotic-prophylaxis** (web): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- **mgmt-endoscopy-12h** (web): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- **mgmt-band-ligation** (web): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- **mgmt-restrictive-transfusion-varices** (web): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- **mgmt-pre-emptive-tips** (web): no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan). The variceal dx variant (not selected, see variant-variceal) mentions TIPS only as rescue.]
- **variant-variceal** (web): detected ugib_nonvariceal_stable in group Upper GI Bleed; expected ugib_variceal [known gap: dx-variants checks ugib_nonvariceal_stable first and its keywords include "haematemesis", "upper gi bleed" and "melaena", so a variceal assessment that mentions haematemesis gets the non-variceal plan prefix (PPI, no terlipressin).]

Guidelines:

- **baveno-7** — Baveno VII — Renewing consensus in portal hypertension (2022), Acute variceal bleeding: restrictive transfusion (threshold ~7 g/dL, target 7–8); vasoactive drug (terlipressin, somatostatin or octreotide) as soon as suspected, continued 2–5 days; antibiotic prophylaxis (ceftriaxone 1 g/24 h) up to 7 days; endoscopy within 12 h of presentation once stable; EVL for oesophageal varices; pre-emptive TIPS in Child-Pugh C 10–13 or B >7 with active bleeding. de Franchis R, Bosch J, Garcia-Tsao G, Reiberger T, Ripoll C; Baveno VII Faculty. J Hepatol. 2022;76:959–974. *(statement wording/numbering not yet verified against the source)*
- **nice-cg141** — NICE CG141 — Acute upper gastrointestinal bleeding in over 16s: management (2012), Terlipressin and prophylactic antibiotics at presentation in suspected variceal bleeding; band ligation for oesophageal varices. National Institute for Health and Care Excellence. Clinical guideline CG141. London: NICE; 2012 (last updated 2016). *(statement wording/numbering not yet verified against the source)*
- **villanueva-2013** — Restrictive vs liberal transfusion in acute upper GI bleeding (RCT) (2013), Restrictive transfusion (Hb 7 g/dL) improved survival and reduced rebleeding, particularly in Child-Pugh A/B cirrhosis. Villanueva C, Colomo A, Bosch A, et al. Transfusion strategies for acute upper gastrointestinal bleeding. N Engl J Med. 2013;368:11–21. *(statement wording/numbering not yet verified against the source)*
- **halt-it-2020** — HALT-IT randomised trial — tranexamic acid in gastrointestinal bleeding (2020), Tranexamic acid: no benefit, more venous thromboembolism. HALT-IT Trial Collaborators. Effects of a high-dose 24-h infusion of tranexamic acid on death and thromboembolic events in patients with acute gastrointestinal bleeding (HALT-IT). Lancet. 2020;395:1927–1936. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Inguinal / Femoral Hernia; 2. GORD / Reflux Oesophagitis; 3. Acute Appendicitis
- differential web.symptomInference: 1. Upper GI haemorrhage; 2. Portal hypertension / oesophageal varices; 3. Liver disease / hepatitis / cirrhosis; 4. CBD stone / obstructive jaundice; 5. Hepatocellular carcinoma (HCC)
- differential web.passive: 1. Portal hypertension / oesophageal varices; 2. Liver disease / hepatitis / cirrhosis; 3. Biliary atresia; 4. Upper GI haemorrhage; 5. CBD stone / obstructive jaundice
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=162)
- alarms: Emergency now [web.triage.emergency]; GI haemorrhage [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; INR 1.7 — coagulopathy [web.clinicalPrompts.safety]; HR 118 bpm — unexplained tachycardia [web.clinicalPrompts.safety]; Albumin 26 g/L — hypoalbuminaemia [web.clinicalPrompts.safety]
- recommended scores: glasgow-blatchford, child-pugh, meld, qsofa, forrest, gcs, asge-cbd, news2, rockall, caprini, asa, web:audit, rcri, cfs
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting, jaundice
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (20), Jaundice Workup (15), ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct) (10)

</details>

#### `variceal-bleed-unrecognised-cirrhosis` — No known liver disease — cirrhosis only on examination and bloods

46-year-old woman, heavy drinker, no liver diagnosis: haematemesis, HR 112, SBP 102; spider naevi, splenomegaly, ascites; platelets 82, INR 1.5, albumin 29. Suspected variceal bleed must be treated as such before endoscopy (vasoactive + antibiotics).

Permutation of `variceal-bleed-known-cirrhosis`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-ugib-top3 | mustRankTopK | critical | FAIL (known gap) | Baveno VII 2022 | socrates-to-features.ts: add ASSOC/CC rules haematemesis\|vomiting blood\|coffee.?ground → haematemesis and melaena\|black\|tarry → melaena; also seed PANE from SmartSymptomPicker chips (HpiTab.reseedPane), not only the SOCRATES answers. |
| level-emergency | emergencyLevel | critical | PASS | Baveno VII 2022 |  |
| mgmt-vasoactive | managementInclude | critical | FAIL (known gap) | Baveno VII 2022; NICE CG141 2012 | Add I85 to the upper_gi_bleed protocol icd10Prefixes or add a dedicated variceal protocol (Baveno VII: vasoactive + ceftriaxone + EVL ≤12 h + restrictive Hb 7–8 + pre-emptive TIPS); fix its "80–100 in varices" transfusion target at the same time. |
| mgmt-antibiotic-prophylaxis | managementInclude | critical | FAIL (known gap) | Baveno VII 2022 | Add I85 to the upper_gi_bleed protocol icd10Prefixes or add a dedicated variceal protocol (Baveno VII: vasoactive + ceftriaxone + EVL ≤12 h + restrictive Hb 7–8 + pre-emptive TIPS); fix its "80–100 in varices" transfusion target at the same time. |
| mgmt-no-liberal-transfusion-varices | managementExclude | critical | PASS | Baveno VII 2022; Restrictive vs liberal transfusion in acute upper GI bleeding (RCT) 2013 |  |
| mnm-variceal | mustNotMiss | quality | FAIL (known gap) | Baveno VII 2022 |  |
| flag-liver-disease | redFlags | quality | PASS | Baveno VII 2022 |  |
| score-rec-child-pugh | scoreRecommended | quality | PASS | Baveno VII 2022 |  |
| inv-inr-lfts | investigationInclude | quality | PASS | Baveno VII 2022 |  |
| mgmt-band-ligation | managementInclude | quality | FAIL (known gap) | Baveno VII 2022 | Add I85 to the upper_gi_bleed protocol icd10Prefixes or add a dedicated variceal protocol (Baveno VII: vasoactive + ceftriaxone + EVL ≤12 h + restrictive Hb 7–8 + pre-emptive TIPS); fix its "80–100 in varices" transfusion target at the same time. |
| variant-variceal | dxVariant | quality | FAIL (known gap) | Baveno VII 2022 | dx-variants.ts: order ugib_variceal before ugib_nonvariceal_stable (most specific first) and add an unstable variant; keep lint:dx-phases in step. |

Failure details:

- **dx-ugib-top3** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#2, web.triageSurgical#1 [known gap: PANE top 3: cholecystitis, GORD, appendicitis. PANE never receives haematemesis/melaena: socrates-to-features has no answer rule for melaena, haematemesis, "vomiting blood" or coffee-ground vomit, and the "Upper GI bleed" CC hint sets only nausea_vomiting. With only epigastric_pain + nausea_vomiting, the male ×5 (×1.8 at ≥50) inguinal-hernia prior modifier or the cholecystitis/GORD priors win. Symptom inference and triageSurgical rank the bleed #1.]
- **mnm-variceal** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE has no variceal node; symptom inference ranks "Portal hypertension / oesophageal varices" #1 from the chips.]
- **mgmt-vasoactive** (web): no management item matched among 21 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- **mgmt-antibiotic-prophylaxis** (web): no management item matched among 21 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- **mgmt-band-ligation** (web): no management item matched among 21 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terlipressin, antibiotics, EVL or 12 h endoscopy on the plan).]
- **variant-variceal** (web): detected ugib_nonvariceal_stable in group Upper GI Bleed; expected ugib_variceal [known gap: dx-variants checks ugib_nonvariceal_stable first and its keywords include "haematemesis", "upper gi bleed" and "melaena", so a variceal assessment that mentions haematemesis gets the non-variceal plan prefix (PPI, no terlipressin).]

Guidelines:

- **baveno-7** — Baveno VII — Renewing consensus in portal hypertension (2022), In suspected variceal bleeding, start vasoactive drugs and antibiotic prophylaxis as soon as possible, before endoscopy. de Franchis R, Bosch J, Garcia-Tsao G, Reiberger T, Ripoll C; Baveno VII Faculty. J Hepatol. 2022;76:959–974. *(statement wording/numbering not yet verified against the source)*
- **nice-cg141** — NICE CG141 — Acute upper gastrointestinal bleeding in over 16s: management (2012), Offer terlipressin and prophylactic antibiotics at presentation to patients with suspected variceal bleeding. National Institute for Health and Care Excellence. Clinical guideline CG141. London: NICE; 2012 (last updated 2016). *(statement wording/numbering not yet verified against the source)*
- **villanueva-2013** — Restrictive vs liberal transfusion in acute upper GI bleeding (RCT) (2013), Restrictive transfusion improved survival in cirrhosis. Villanueva C, Colomo A, Bosch A, et al. Transfusion strategies for acute upper gastrointestinal bleeding. N Engl J Med. 2013;368:11–21. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. GORD / Reflux Oesophagitis; 3. Acute Appendicitis
- differential web.symptomInference: 1. Portal hypertension / oesophageal varices; 2. Upper GI haemorrhage; 3. Liver disease / hepatitis / cirrhosis; 4. Heart failure; 5. Nephrotic syndrome
- differential web.passive: 1. Portal hypertension / oesophageal varices; 2. Heart failure; 3. Nephrotic syndrome; 4. Liver disease / hepatitis / cirrhosis; 5. Hirschsprung's disease
- differential web.triageSurgical: 1. Peptic ulcer with haemorrhage
- emergency level: emergency (acuity=urgent, action=emergency_now, score=80)
- alarms: Emergency now [web.triage.emergency]; Courvoisier's sign (palpable non-tender gallbladder + jaundice) [web.clinicalPrompts.safety]; GI haemorrhage [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; HR 112 bpm — unexplained tachycardia [web.clinicalPrompts.safety]; Albumin 29 g/L — hypoalbuminaemia [web.clinicalPrompts.safety]
- recommended scores: wells-dvt, glasgow-blatchford, child-pugh, forrest, news2, rockall
- score values: (none)
- dx variant: ugib_nonvariceal_stable (Upper GI Bleed)
- note: PANE features applied: nausea_vomiting
- note: AssessmentTab ManagementPanel protocol: (none) (from ICD)
- note: PlanTab protocol: (none) (from ICD)
- note: matchPathways: GI Bleeding (Upper and Lower) (10), Bowel Obstruction (Small / Large) (5)

</details>

## Gap register (known gaps and unverified expectations that failed)

| Vignette | Expectation | Platform | Severity | Flag | Detail |
|---|---|---|---|---|---|
| `achalasia-pseudoachalasia-elderly` | mnm-malignancy | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3: inguinal hernia, GORD, peptic ulcer (male prior modifi |
| `achalasia-young` | dx-achalasia-top3 | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Hiatus Hernia [known gap: PANE top 3: cholecystitis, appendicitis, hiatus hernia — only weight_loss and regurgitation reach PANE (no dysphagia feature, see dysp |
| `adrenal-suspected-phaeochromocytoma` | mnm-phaeochromocytoma | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE has no phaeochromocytoma disease (only adrenal_incidentaloma) and a |
| `aortic-dissection-epigastric-back-pain` | mnm-dissection | web | critical | known gap | not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Inguinal / Femoral Hernia \| 3. Acute Cholecystitis [known gap: PANE top 3: pancreatitis, inguinal hernia, cholecystitis (epigastric pain + radiation to back = pancreatitis pattern); no  |
| `aortic-dissection-epigastric-back-pain` | mnm-dissection-symptom-inference | web | quality | known gap | not in top 5 of web.symptomInference: 1. Symptomatic / ruptured abdominal aortic aneurysm \| 2. Peptic ulcer disease \| 3. Acute alcoholic pancreatitis \| 4. Perforated peptic ulcer \| 5. Gallstone pancreatitis [known gap: Symptom inference |
| `aortic-dissection-epigastric-back-pain` | inv-ct-angiography | web | critical | known gap | no investigation matched among 28 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol (I71.0) and no prompt suggests CT angiography.] |
| `aortic-dissection-epigastric-back-pain` | mgmt-bp-heart-rate-control | web | quality | known gap | no management item matched among 15 (web.clinicalPrompts) [known gap: No output.] |
| `aortoenteric-fistula-herald-bleed` | mnm-aortoenteric-fistula | web | critical | known gap | not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Inguinal / Femoral Hernia \| 3. Acute Cholecystitis; also in web.passive#1 [known gap: PANE top 3: pancreatitis, inguinal hernia, cholecystitis; no aorto-enteric fistula node anywhere. T |
| `aortoenteric-fistula-herald-bleed` | flag-aortic-graft | web | critical | known gap | no red flag matched among 14 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: Surgical history (aortic graft) is not read by any red-flag |
| `aortoenteric-fistula-herald-bleed` | inv-ct-angiography | web | critical | known gap | no investigation matched among 26 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol (no ICD/PANE match) and the GI-bleed prompt only offers OGD/colonoscopy.] |
| `aortoenteric-fistula-herald-bleed` | mgmt-vascular-surgery | web | critical | known gap | no management item matched among 9 (web.clinicalPrompts) [known gap: No output mentions vascular surgery.] |
| `appendicitis-adult-typical` | score-rec-air | web | quality | known gap | air not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, news2 [known gap: Web CDS has no AIR rule (and no AIR calculator); Alvarado only.] |
| `appendicitis-adult-typical` | mgmt-no-routine-postop-antibiotics | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "...l: [x] ml. swab count correct × 2. post-operative orders: • simple appendicitis: iv amoxiclav 1.2g tds × 24h → oral co-amoxiclav × 5 days. • perforated appendicitis: iv pip-tazo  |
| `appendicitis-elderly-atypical` | mnm-mesenteric-ischaemia | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis; also in web.symptomInference#3, web.passive#4 [known gap: PANE top 3 (cholecystitis, appendicitis, appendix mass) omits it; s |
| `appendicitis-elderly-atypical` | mnm-caecal-neoplasm | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagn |
| `appendicitis-elderly-atypical` | mnm-diverticulitis | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3.] |
| `appendicitis-pregnant-t2` | mnm-obstetric-cause | web | quality | known gap | not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Acute Cholecystitis \| 3. Appendix Mass / Late Appendicitis [known gap: PANE has no obstetric disease nodes in the top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidat |
| `appendicitis-pregnant-t2` | mnm-pyelonephritis | web | quality | known gap | not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Acute Cholecystitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagn |
| `appendicitis-pregnant-t2` | inv-mri-after-inconclusive-us | web | critical | known gap | no investigation matched among 42 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: Neither the iOS radiation card nor the web appendicitis protocol mentions MRI; CT with contrast is the only second-line imaging of |
| `appendicitis-pregnant-t2` | inv-no-unqualified-ct | web | quality | known gap | forbidden investigation present in web.plan.investigations: "ct abdomen/pelvis with iv contrast - if uss inconclusive or high clinical suspicio..." (+3 more) [known gap: CT with IV contrast is suggested without a pregnancy qualifier.] |
| `appendicitis-pregnant-t2` | mgmt-obstetric-involvement | web | quality | known gap | no management item matched among 55 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No obstetric review or fetal monitoring in the web plan or prompts.] |
| `appendicitis-pregnant-t2` | mgmt-no-nsaid-after-20-weeks | web | critical | known gap | forbidden management item present in web.clinicalPrompts: "... convert to oral when tolerating po. • paracetamol 1g qds + ibuprofen 400mg tds (regular). • morphine 5mg prn if pain > 5/10. • regular diet as toler..." [known gap: Web appendic |
| `appendicitis-pregnant-t2` | mgmt-no-bhcg-negative-assumption | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "...ak (< 1%), hartmann's pouch if appendix not identifiable. • β-hcg confirmed negative (female of reproductive age). • group & screen available; cross-match if perfor..." [known ga |
| `boerhaave-classic-mackler` | dx-perforation-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Inguinal / Femoral Hernia \| 3. Acute Cholecystitis [known gap: PANE top 3: pancreatitis, inguinal hernia, cholecystitis. Subcutaneous emphysema, chest_pain_oesophageal and vomiting_effo |
| `boerhaave-classic-mackler` | mgmt-antifungal | web | quality | known gap | no management item matched among 50 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: oesophageal_perforation protocol has no antifungal.] |
| `boerhaave-presenting-as-chest-pain` | mnm-perforation | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. Acute Pancreatitis [known gap: PANE top 3: inguinal hernia, cholecystitis, pancreatitis; no oesophageal features reach PANE. Symptom inference ranks STEM |
| `boerhaave-presenting-as-chest-pain` | inv-ecg | web | critical | known gap | no investigation matched among 31 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: No investigation output mentions an ECG: the triage chest_pain pathway checklist ("ECG within 10 minutes") is not surfaced, and th |
| `boerhaave-presenting-as-pancreatitis` | mnm-perforation | web | critical | known gap | not in top 3 of web.pane: 1. Acute Pancreatitis \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis [known gap: PANE top 3: pancreatitis, cholecystitis, GORD; symptom inference: alcoholic/gallstone pancreatitis, peptic ulcer, perfora |
| `breast-abscess-non-lactational-smoker` | dx-abscess-top3 | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Fibroadenoma \| 3. Fibrocystic Breast Disease; also in web.triageSurgical#3 [known gap: PANE top 3 = cholecystitis, fibroadenoma, fibrocystic change: only breast_lump was extracted (no  |
| `breast-abscess-non-lactational-smoker` | mgmt-smoking-cessation | web | quality | known gap | no management item matched among 27 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: The breast_abscess protocol has no non-lactational (periductal mastitis) branch: n |
| `breast-family-history-brca` | level-routine | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=37); expected ≤ priority [known gap: Triage same_day_call: the word "cancer" in the complaint ("Worried about breast cancer") matches the "Possible malignancy" red flag.] |
| `breast-family-history-brca` | mgmt-genetics-referral | web | quality | known gap | no management item matched among 2 (web.clinicalPrompts) [known gap: The family-history prompt exists (computeClinicalPrompts: "Family history of breast / ovarian cancer" → genetics) but reads InferenceInput.familyHistory, which the harness |
| `breast-inflammatory-cancer` | mgmt-no-bcs-or-slnb | web | critical | known gap | forbidden management item present in web.plan: "[surgical] wide local excision (breast-conserving) + slnb or axillary clearance." (+2 more) [known gap: The C50 plan comes from the generic invasive_ductal_carcinoma protocol, which offers "Wi |
| `breast-lump-age-30-35` | flag-2ww | web | critical | known gap | no red flag matched among 6 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: The suspected-cancer referral is triggered (age ≥30 + breast lump) but labelled "Cancer screenin |
| `breast-lump-age-30-35` | inv-uss | web | critical | known gap | no investigation matched among 11 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreas |
| `breast-lump-age-30-35` | inv-core-biopsy | web | critical | known gap | no investigation matched among 11 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreas |
| `breast-lump-over-35-suspicious` | flag-2ww | web | critical | known gap | no red flag matched among 9 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: Triggered but labelled colorectal. cancer-screening.ts labels every triggered screen "colorectal |
| `breast-lump-over-35-suspicious` | mgmt-mdt | web | quality | known gap | no management item matched among 7 (web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vigne |
| `breast-lump-pregnant` | flag-2ww | web | critical | known gap | no red flag matched among 11 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: Triggered but labelled colorectal. cancer-screening.ts labels every trigg |
| `breast-lump-pregnant` | inv-uss | web | critical | known gap | no investigation matched among 12 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreas |
| `breast-lump-pregnant` | inv-core-biopsy | web | critical | known gap | no investigation matched among 12 (web.pane.seeded, web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreas |
| `breast-lump-under-30` | level-not-urgent | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: "breast lump" RED_FLAG is priority ("Possible malignancy") regardless of age, and the adaptive action maps priority  |
| `breast-lump-under-30` | inv-uss | web | critical | known gap | no investigation matched among 11 (web.pane.seeded, web.clinicalPrompts) [known gap: No breast ultrasound in any output. The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as  |
| `breast-lump-under-30` | inv-no-unrelated-seeded-orders | web | quality | known gap | forbidden investigation present in web.pane.seeded: "amylase / lipase (exclude pancreatitis) (cholecystitis)" (+3 more) [known gap: PANE top 3 starts with cholecystitis, so amylase/lipase, blood cultures and MRCP are seeded into orders for  |
| `breast-lump-under-30` | mgmt-triple-assessment | web | quality | known gap | no management item matched among 2 (web.clinicalPrompts) [known gap: The pre-histology code N63.0 (breast lump) maps to no management protocol, so the plan is empty. Harness limitation as well: web-runner.ts passes examBreast: "" (the vigne |
| `breast-male-cancer` | mnm-carcinoma | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Gynaecomastia \| 3. Acute Cholecystitis; also in web.symptomInference#1, web.passive#2, web.triageSurgical#3 [known gap: PANE top 3 = inguinal hernia (male x5 prior), gynaecomasti |
| `breast-male-cancer` | flag-2ww | web | critical | known gap | no red flag matched among 10 (web.triage.reasons, web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: Triggered but labelled colorectal. cancer-screening.ts labels every triggered screen "colorecta |
| `breast-male-cancer` | mgmt-genetics | web | quality | known gap | no management item matched among 4 (web.clinicalPrompts) [known gap: No BRCA / genetics step for male breast cancer with a family history.] |
| `breast-male-gynaecomastia` | level-routine | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=74); expected ≤ priority [known gap: Triage same_day_call: "breast lump" → Possible malignancy (priority) and the cancer screen triggers (age ≥30 + breast lump, applied to men |
| `breast-nipple-discharge-bloody-single-duct` | mnm-malignancy | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE applied no feature: the "Nipple discharge" template has no CC hint  |
| `breast-nipple-discharge-bloody-single-duct` | level-at-least-priority | web | quality | known gap | web.triage: routine (acuity=routine, action=routine_booking, score=0); expected ≥ priority [known gap: Triage routine (score 0): no rule for blood-stained nipple discharge.] |
| `breast-nipple-discharge-bloody-single-duct` | flag-2ww | web | critical | known gap | no red flag matched among 7 (web.triage.pathways, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: screenForCancer only counts nipple discharge together with a lump; NICE NG12 (≥50, unilateral nipple discharge) is n |
| `breast-nipple-discharge-bloody-single-duct` | inv-mammogram | web | critical | known gap | no investigation matched among 19 (web.pane.seeded, web.clinicalPrompts) [known gap: N64.52 maps to no protocol and PANE did not reach duct_ectasia, so no imaging is proposed.] |
| `breast-nipple-discharge-bloody-single-duct` | inv-uss | web | critical | known gap | no investigation matched among 19 (web.pane.seeded, web.clinicalPrompts) [known gap: As above: no retroareolar ultrasound proposed.] |
| `breast-nipple-discharge-bloody-single-duct` | mgmt-duct-excision | web | quality | known gap | no management item matched among 7 (web.clinicalPrompts) [known gap: No plan (no protocol for N64.52).] |
| `breast-pain-cyclical-alone` | dx-benign-top3 | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE applied no feature (template "Other / general surgical"); priors gi |
| `breast-pain-cyclical-alone` | level-routine | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: "friend had breast cancer" matches the "Possible malignancy" red flag.] |
| `breast-pain-cyclical-alone` | mgmt-reassurance | web | quality | known gap | no management item matched among 2 (web.clinicalPrompts) [known gap: N64.4 (mastodynia) maps to no protocol; no mastalgia guidance.] |
| `caustic-ingestion-alkali` | inv-airway-assessment | web | quality | known gap | no investigation matched among 25 (web.pane.seeded, web.clinicalPrompts) [known gap: No caustic-ingestion protocol or prompt; nothing mentions airway assessment.] |
| `caustic-ingestion-alkali` | mgmt-psychiatric-assessment | web | quality | known gap | no management item matched among 10 (web.clinicalPrompts) [known gap: Only the triage reason "Mental health crisis"; no plan line.] |
| `caustic-ingestion-alkali` | mgmt-nil-by-mouth | web | quality | known gap | no management item matched among 10 (web.clinicalPrompts) [known gap: No plan output at all for T54.3.] |
| `cholangitis-tg18-charcot-sepsis` | score-tg18-calculator | web | critical | known gap | expected = 2; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: Web clinical-scores.ts (ClinicalScoresPanel) omits the W |
| `cholangitis-tg18-charcot-sepsis` | score-tg18-autofill | web | quality | known gap | expected = 2; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: Web clinical-scores needs manual imaging ticks before it will diagnose, so auto-fill reads "criteria not met".] |
| `cholangitis-tg18-charcot-sepsis` | mgmt-drainage-in-generated-plan | web | quality | known gap | no management item matched among 13 (web.plan) [known gap: dx-variants: 'ascending cholangitis' is a Grade I keyword, Grade I is checked first, and Grade I phases exclude 'surgical', so ERCP disappears from the generated plan.] |
| `cholangitis-tg18-charcot-sepsis` | variant-grade2 | web | quality | known gap | detected cholangitis_grade1 in group Cholangitis; expected cholangitis_grade2 [known gap: dx-variants selects Grade I from 'ascending cholangitis'.] |
| `cholangitis-tg18-grade1-single-criterion` | mnm-malignant-obstruction | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholangitis \| 2. Inguinal / Femoral Hernia \| 3. Choledocholithiasis; also in web.symptomInference#4, web.passive#3 [known gap: PANE top 3 includes Inguinal / Femoral Hernia (male/age prior modifiers) ins |
| `cholangitis-tg18-grade1-single-criterion` | score-tg18-calculator | web | quality | known gap | expected = 1; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: iOS TokyoCholangitis and web clinical-scales count ONE G |
| `cholangitis-tg18-grade1-single-criterion` | score-tg18-autofill | web | quality | known gap | expected = 1; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill: age >75 alone → Grade II; web clinical-scores: criteria not met without manual imaging ticks.] |
| `cholangitis-tg18-grade1-single-criterion` | variant-grade1 | web | quality | known gap | detected (none) in group Cholangitis; expected cholangitis_grade1 [known gap: dx-variants keywords need 'mild cholangitis' word order; 'Mild acute cholangitis' selects no variant.] |
| `cholangitis-tg18-grade3-reynolds` | mnm-septic-shock | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholangitis \| 2. Acute Cholecystitis \| 3. Acute Diverticulitis; also in web.symptomInference#2, web.passive#2 [known gap: PANE has no sepsis node; symptom inference ranks sepsis #2. iOS: fallback mode: t |
| `cholangitis-tg18-grade3-reynolds` | score-tg18-autofill | web | critical | known gap | expected = 3; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill never sets organ-dysfunction fields (returns Grade II from age/temperature/WBC/bilirubin); web returns "criteria |
| `cholangitis-tg18-grade3-reynolds` | mgmt-no-surgery-first | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "• emergency laparotomy consent - source control; icu post-operatively." [known gap: Web clinical prompt: 'Emergency laparotomy consent — source control' for Grade III cholangitis, i |
| `cholangitis-tg18-grade3-reynolds` | variant-grade3 | web | quality | known gap | detected (none) in group Cholangitis; expected cholangitis_grade3 [known gap: dx-variants needs 'severe cholangitis' word order; 'Severe acute cholangitis' selects no variant.] |
| `cholecystitis-tg18-grade1` | score-rec-tg18-cholecystitis | web | quality | known gap | tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, news2, asa, stop-bang [known gap: Web CDS has a TG18 cholangitis rule but none for cholecystitis.] |
| `cholecystitis-tg18-grade1` | score-tg18-autofill | web | quality | known gap | expected = 1; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill sets only WBC >18 (Grade II criterion) and never the local-signs field, so it reads "criteria not met"; web  |
| `cholecystitis-tg18-grade2` | score-rec-tg18-cholecystitis | web | quality | known gap | tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, web:wagner, news2, caprini, asa, rcri [known gap: No TG18 cholecystitis CDS rule on web.] |
| `cholecystitis-tg18-grade2` | score-tg18-calculator | web | critical | known gap | expected = 2; got web.scoreCalculator.tg18-cholecystitis=1 (Mild cholecystitis — elective laparoscopic cholecystectomy) [known gap: Neither calculator has a "palpable tender RUQ mass" Grade II criterion (iOS folds it into Grade I local sign |
| `cholecystitis-tg18-grade2` | variant-grade2 | web | quality | known gap | detected cholecystitis_grade1 in group Acute Cholecystitis; expected cholecystitis_grade2 [known gap: dx-variants: the Grade I variant lists the bare keyword 'cholecystitis' and is checked first, so any cholecystitis assessment selects Grad |
| `cholecystitis-tg18-grade3-organ-dysfunction` | flag-organ-support | web | quality | known gap | no red flag matched among 47 (web.triage.reasons, web.header.allergies, web.protocol.redFlags, web.dxVariant.urgencyNote, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.vitalRedFl |
| `cholecystitis-tg18-grade3-organ-dysfunction` | score-rec-tg18-cholecystitis | web | quality | known gap | tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, gcs, asge-cbd, news2, caprini, asa, rcri, cfs [known gap: No TG18 cholecystitis CDS rule on web.] |
| `cholecystitis-tg18-grade3-organ-dysfunction` | score-tg18-autofill | web | critical | known gap | expected = 3; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill ignores the organ-dysfunction data in the record (SBP 82 on noradrenaline, AVPU C, creatinine 238, platelets |
| `cholecystitis-tg18-grade3-organ-dysfunction` | mgmt-gb-drainage-in-generated-plan | web | quality | known gap | no management item matched among 13 (web.plan) [known gap: iOS radiation plan text has no drainage step (only an IR referral chip); web PlanTab selects the Grade I variant, which filters out the conservative-phase cholecystostomy line.] |
| `cholecystitis-tg18-grade3-organ-dysfunction` | mgmt-no-penicillin-in-anaphylaxis | web | critical | known gap | forbidden management item present in web.plan: "[immediate] iv antibiotics: co-amoxiclav 1.2 g tds or piperacillin-tazobactam for severe." (+5 more) [known gap: Plan templates suggest co-amoxiclav / piperacillin-tazobactam regardless of the |
| `cholecystitis-tg18-grade3-organ-dysfunction` | mgmt-no-early-cholecystectomy-in-shock | web | quality | known gap | forbidden management item present in web.managementPanel.keyPoints: "early laparoscopic cholecystectomy (within 72 h) reduces complications vs interval surgery." [known gap: iOS TG18 Grade III recommendation offers 'emergency cholecystectom |
| `cholecystitis-tg18-grade3-organ-dysfunction` | variant-grade3 | web | quality | known gap | detected cholecystitis_grade1 in group Acute Cholecystitis; expected cholecystitis_grade3 [known gap: dx-variants selects Grade I ('cholecystitis' keyword checked first).] |
| `dyspepsia-young-no-alarm-test-and-treat` | level-routine | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=40); expected ≤ priority [known gap: Same-day call: adaptiveTriage reads CC+HPI free text without negation — "No family history of stomach cancer" gives "Possible malignancy"  |
| `dyspepsia-young-no-alarm-test-and-treat` | inv-hpylori-non-invasive | web | quality | known gap | no investigation matched among 16 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for K30 (uninvestigated/functional dyspepsia); the GORD management panel (PANE top) lists H. pylori only as a routine investigation, which is n |
| `dysphagia-progressive-over55` | dx-oesophageal-cancer-top3 | web | critical | known gap | not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Inguinal / Femoral Hernia \| 3. Hiatus Hernia; also in web.symptomInference#1, web.passive#2 [known gap: PANE top 3: GORD, inguinal hernia, hiatus hernia. PANE never gets dysphag |
| `dysphagia-progressive-under55` | mnm-malignancy | web | quality | known gap | not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Acute Cholecystitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#2, web.passive#2 [known gap: PANE top 3: GORD, cholecystitis, peptic ulcer — PANE never gets dysphagi |
| `eoe-young-atopic-recurrent-bolus` | mnm-eoe | web | quality | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease [known gap: No eosinophilic oesophagitis disease in PANE or symptom inference (only a key point in the oesophageal_stricture  |
| `eoe-young-atopic-recurrent-bolus` | level-priority-not-emergency | web | quality | known gap | web.triage: emergency (acuity=urgent, action=emergency_now, score=80); expected ≥ priority, ≤ urgent [known gap: Emergency now: "Systemic red flag symptom" and "Dysphagia" red flags plus a 2-week-wait cancer screen labelled "colorectal" (ca |
| `eoe-young-atopic-recurrent-bolus` | inv-oesophageal-biopsies | web | critical | known gap | no investigation matched among 10 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for K20.0 and nothing else asks for biopsies.] |
| `eoe-young-atopic-recurrent-bolus` | inv-six-biopsies-two-levels | web | quality | known gap | no investigation matched among 10 (web.pane.seeded, web.clinicalPrompts) [known gap: As inv-oesophageal-biopsies.] |
| `eoe-young-atopic-recurrent-bolus` | mgmt-eoe-treatment-options | web | quality | known gap | no management item output on web [known gap: No management output at all for K20.0.] |
| `food-bolus-complete-obstruction` | level-emergency | web | critical | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=63); expected ≥ emergency [known gap: Same-day call (urgent), not emergency: triage has no rule for "cannot swallow saliva"/drooling (APCQ grades saliva-only dysphagia as emer |
| `food-bolus-complete-obstruction` | flag-complete-obstruction | web | quality | known gap | no red flag matched among 6 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: No red flag names the complete obstruction; only "Dysphagia — red flag symptom".] |
| `food-bolus-complete-obstruction` | mgmt-endoscopic-removal | web | critical | known gap | no management item matched among 1 (web.clinicalPrompts) [known gap: No protocol for T18.1 (food bolus); the matchPathways registry has a "Foreign Body Ingestion / Food Bolus" pathway but it is not surfaced in management.] |
| `food-bolus-complete-obstruction` | mgmt-biopsies-underlying-cause | web | quality | known gap | no management item matched among 1 (web.clinicalPrompts) [known gap: As mgmt-endoscopic-removal.] |
| `gastric-outlet-obstruction-elderly` | dx-goo-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#5, web.passive#2 [known gap: PANE top 3: inguinal hernia, cholecystitis, GORD. The vomiting_effo |
| `gastric-outlet-obstruction-elderly` | mnm-malignancy | web | quality | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE has no malignancy in the top 3; symptom inference ranks gastri |
| `gord-alarm-weight-loss-over55` | mnm-malignancy | web | critical | known gap | not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Hiatus Hernia \| 3. Peptic Ulcer Disease; also in web.symptomInference#2, web.passive#2 [known gap: PANE top 3: GORD, hiatus hernia, peptic ulcer (the "GORD / heartburn" template |
| `gord-alarm-weight-loss-over55` | mgmt-urgent-two-week-ogd | web | quality | known gap | no management item matched among 33 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: GORD protocol OGD line is conditional ("Alarm features, age >55, or 4-week PPI tri |
| `gord-no-alarm-empirical-ppi` | level-routine | web | quality | known gap | web.triage: emergency (acuity=urgent, action=emergency_now, score=65); expected ≤ priority [known gap: Emergency now (score 65): adaptiveTriage reads CC+HPI free text without negation — "no weight loss" → Possible malignancy, "no vomiting"  |
| `groin-mimic-femoral-artery-aneurysm` | mnm-aneurysm | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Acute Cholecystitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = inguinal hernia, GORD, cholecystitis. PANE has only "A |
| `groin-mimic-femoral-artery-aneurysm` | flag-pulsatile | web | critical | known gap | no red flag matched among 12 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative) [known gap: No red flag or alarm for a pulsatile groin mass: triage has no pulsatile/aneurysm |
| `groin-mimic-femoral-artery-aneurysm` | inv-duplex-or-cta | web | critical | known gap | no investigation matched among 22 (web.pane.seeded, web.clinicalPrompts) [known gap: No duplex/CT angiography proposed; I72.4 has no protocol.] |
| `groin-mimic-femoral-artery-aneurysm` | mgmt-vascular-referral | web | quality | known gap | no management item matched among 17 (web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No vascular referral in any output (the inguinal_hernia panel is shown instead).] |
| `groin-mimic-femoral-artery-aneurysm` | mgmt-no-hernia-repair | web | critical | known gap | forbidden management item present in web.managementPanel: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Assessment ManagementPanel follows the PANE top disease (≥0.20),  |
| `groin-mimic-lymphadenopathy` | mnm-lymphoma-or-nodes | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = inguinal hernia, cholecystitis, GORD. PANE has no lymp |
| `groin-mimic-lymphadenopathy` | inv-uss-or-biopsy | web | critical | known gap | no investigation matched among 22 (web.pane.seeded, web.clinicalPrompts) [known gap: No groin ultrasound or node biopsy is proposed; the confirmed ICD R59.1 has no protocol (R59.9 → cervical lymphadenopathy only).] |
| `groin-mimic-lymphadenopathy` | inv-ldh | web | quality | known gap | no investigation matched among 22 (web.pane.seeded, web.clinicalPrompts) [known gap: No LDH (same cause as above).] |
| `groin-mimic-lymphadenopathy` | mgmt-no-hernia-repair | web | critical | known gap | forbidden management item present in web.managementPanel: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Assessment ManagementPanel follows the PANE top disease (≥0.20),  |
| `groin-mimic-testicular-torsion` | dx-torsion-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Appendicitis \| 3. Epididymo-orchitis; also in web.symptomInference#1, web.passive#1 [known gap: As above: torsion not in the PANE top 3; epididymo-orchitis ranks above it.] |
| `groin-mimic-testicular-torsion` | mnm-torsion | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Appendicitis \| 3. Epididymo-orchitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = inguinal hernia, appendicitis, epididymo-orchitis: testicular_t |
| `groin-mimic-testicular-torsion` | mgmt-no-hernia-repair | web | critical | known gap | forbidden management item present in web.managementPanel: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Assessment ManagementPanel follows the PANE top disease (≥0.20),  |
| `h-pylori-penicillin-anaphylaxis` | mgmt-bismuth-quadruple | web | quality | known gap | no management item matched among 26 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No penicillin-free regimen in any H. pylori protocol.] |
| `h-pylori-penicillin-anaphylaxis` | mgmt-no-amoxicillin | web | critical | known gap | forbidden management item present in web.plan: "[conservative] h. pylori eradication: triple therapy (ppi + amoxicillin + clarithromycin × 7 days); confirm eradication with breath test at 4 weeks." (+1 more) [known gap: Gastritis protocol p |
| `h-pylori-positive-eradication` | mgmt-14-day-or-bismuth | web | quality | known gap | no management item matched among 26 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: Gastritis protocol: "triple therapy (PPI + amoxicillin + clarithromycin × 7 days)" |
| `h-pylori-positive-eradication` | mgmt-no-7-day-clarithromycin-triple | web | quality | known gap | forbidden management item present in web.plan: "... h. pylori eradication: triple therapy (ppi + amoxicillin + clarithromycin × 7 days); confirm eradication with breath test at 4 weeks." [known gap: Gastritis protocol plan line and medicati |
| `hernia-femoral-elderly-woman` | dx-femoral-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Diverticulitis [known gap: PANE top 3 = cholecystitis, GORD, diverticulitis; femoral_hernia is not listed despite groin_swelling. PANE: unlisted f |
| `hernia-femoral-richter-obstruction` | mnm-hernia-cause | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Bowel Obstruction; also in web.triageSurgical#1 [known gap: PANE top 3 = cholecystitis, appendicitis, bowel obstruction (from the abdominal-pain template). No h |
| `hernia-groin-incarcerated` | inv-lactate | web | quality | known gap | no investigation matched among 25 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: The inguinal_hernia protocol lists FBC, U&E only; no lactate/CPK (WSES strangulation markers) anywhere in the web outputs.] |
| `hernia-groin-incarcerated` | variant-incarcerated | web | critical | known gap | detected hernia_reducible in group Hernia; expected hernia_incarcerated [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: "Irreducible inguinal hernia" contains the hernia_reducible keyw |
| `hernia-groin-strangulated` | variant-strangulated | web | critical | known gap | detected hernia_incarcerated in group Hernia; expected hernia_strangulated [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: the assessment says "strangulated" and "irreducible"; hernia_ |
| `hernia-incisional-midline-elective` | dx-incisional-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Diverticulitis; also in web.triageSurgical#1 [known gap: PANE applied no feature: the "Incisional / ventral hernia" template has no CC hint and th |
| `hernia-incisional-midline-elective` | level-routine | web | quality | known gap | web.triage: emergency (acuity=urgent, action=emergency_now, score=49); expected ≤ priority [known gap: Triage emergency_now (score 49): adaptiveTriage RED_FLAGS regexes have no negation handling ("No vomiting" → +15); "Hartmann's … reversed |
| `hernia-inguinal-elective-minimal-symptoms` | level-routine | web | quality | known gap | web.triage: emergency (acuity=urgent, action=emergency_now, score=80); expected ≤ priority [known gap: Triage emergency_now (score 80): adaptiveTriage RED_FLAGS regexes have no negation handling — "no episodes of severe pain" → "Acute abdom |
| `hernia-inguinal-elective-minimal-symptoms` | no-emergency-alarm | web | quality | known gap | forbidden alarm present in web.triage.emergency: "emergency now - do not auto-book. advise urgent emergency assessment / tapion contact and ale..." (+1 more) [known gap: Same negation false positives raise the triage "Emergency now" alarm;  |
| `hernia-inguinal-elective-minimal-symptoms` | no-strangulation-prompt | web | quality | known gap | forbidden alarm present in web.clinicalPrompts.safety: "incarcerated / strangulated hernia - strangulated hernia → emergency repair" [known gap: computeClinicalPrompts isIncarcerated tests exam text for "tender" — "non-tender" matches, so a |
| `hernia-inguinal-elective-minimal-symptoms` | mgmt-watchful-waiting-option | web | quality | known gap | no management item matched among 27 (web.plan, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: Neither the inguinal_hernia protocol nor the prompts mention watchful waiting (only "truss for unfit patient |
| `hernia-inguinal-elective-minimal-symptoms` | mgmt-no-emergency-repair | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "• emergency theatre: irreducible / strangulated hernia - bowel resection risk, consent accordingly." [known gap: The negation bug above ("non-tender") adds "Emergency Theatre: irred |
| `hernia-inguinal-female-occult-femoral` | mnm-femoral-hernia | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease [known gap: PANE top 3 = cholecystitis, GORD, PUD. The female modifier cuts inguinal_hernia to x0.3 and cholecystitis is x2 in wome |
| `hernia-inguinal-female-occult-femoral` | level-not-emergency | web | quality | known gap | web.triage: emergency (acuity=urgent, action=emergency_now, score=52); expected ≤ priority [known gap: Triage emergency_now (score 52): adaptiveTriage RED_FLAGS regexes have no negation handling ("No vomiting" → +15; "change in bowel habit" |
| `hernia-inguinal-female-occult-femoral` | inv-no-unrelated-seeded-orders | web | quality | known gap | forbidden investigation present in web.pane.seeded: "blood cultures × 2 (before antibiotics) (cholecystitis)" (+5 more) [known gap: HpiTab.seedInvestigationsFromPane seeds the stat/urgent tests of the (wrong) PANE top 3: blood cultures, MRC |
| `hernia-obturator-sbo-elderly-woman` | mnm-obturator-hernia | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Bowel Obstruction [known gap: PANE top 3 = cholecystitis, appendicitis, bowel obstruction (periumbilical site maps to rlq_pain). obturator_hernia (prior 0.005)  |
| `hernia-obturator-sbo-elderly-woman` | mnm-hernia-any | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Bowel Obstruction [known gap: As above: no hernia of any type in the PANE top 3.] |
| `hernia-obturator-sbo-elderly-woman` | variant-strangulated-or-obstructed | web | quality | known gap | detected (none) in group Hernia; expected hernia_incarcerated [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: the assessment ("Small bowel obstruction due to left obturator hernia") ha |
| `hernia-paediatric-incarcerated-infant` | dx-hernia-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1, web.triageSurgical#1 [known gap: PANE top 3 = cholecystitis, appendicitis, PUD for a 7-mont |
| `hernia-paediatric-incarcerated-infant` | mgmt-no-adult-plan | web | quality | known gap | forbidden management item present in web.plan: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+3 more) [known gap: Adult inguinal protocol and TAPP template for an infant (see the base paedia |
| `hernia-paediatric-inguinal-infant` | level-not-emergency | web | quality | known gap | web.triage: emergency (acuity=urgent, action=emergency_now, score=75); expected ≤ urgent [known gap: Triage emergency_now: computeVitalRedFlags uses adult thresholds — HR 140 and RR 36 (normal at 4 months) are flagged Tachycardia/Tachypnoea |
| `hernia-paediatric-inguinal-infant` | mgmt-prompt-repair | web | quality | known gap | no management item matched among 26 (web.plan, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No output mentions herniotomy or paediatric surgical referral.] |
| `hernia-paediatric-inguinal-infant` | mgmt-no-watchful-waiting | web | critical | known gap | forbidden management item present in web.plan: "[conservative] truss may be offered for unfit patients declining surgery - monitor for strangulation..." (+1 more) [known gap: The inguinal_hernia protocol has no paediatric branch: the plan o |
| `hernia-paediatric-inguinal-infant` | mgmt-no-adult-mesh-repair | web | critical | known gap | forbidden management item present in web.plan: "[surgical] elective: lichtenstein mesh herniorrhaphy (local or ga) or laparoscopic tep/tapp." (+5 more) [known gap: Adult plan for a 4-month-old: "Lichtenstein mesh herniorrhaphy … TEP/TAPP" ( |
| `hernia-parastomal-symptomatic` | dx-parastomal-top3 | web | quality | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis [known gap: PANE applied no feature ("Incisional / ventral hernia" template, no CC hint); inguinal hernia leads on the male pr |
| `hernia-parastomal-symptomatic` | level-routine | web | quality | known gap | web.triage: emergency (acuity=urgent, action=emergency_now, score=59); expected ≤ priority [known gap: Triage emergency_now (score 59): adaptiveTriage RED_FLAGS regexes have no negation handling ("No vomiting"); "rectal cancer" history → "P |
| `hernia-paraumbilical-incarcerated-obese` | dx-umbilical-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = cholecystitis, GORD, PUD (female: inguinal x0.3, cholecysti |
| `hernia-paraumbilical-incarcerated-obese` | inv-lactate | web | quality | known gap | no investigation matched among 26 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: No lactate in the umbilical_hernia protocol or the hernia prompts.] |
| `hernia-paraumbilical-incarcerated-obese` | mgmt-no-penicillin | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "• iv piperacillin-tazobactam 4.5g tds + metronidazole 500mg tds." (+1 more) [known gap: The recorded penicillin allergy is not cross-checked: prompts propose piperacillin-tazobactam |
| `hernia-umbilical-adult-elective` | dx-umbilical-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis [known gap: PANE top 3 = inguinal hernia (male x5), cholecystitis, GORD; umbilical_hernia (0.03, umbilical_swelling 0.90) is o |
| `hernia-umbilical-adult-elective` | mgmt-smoking | web | quality | known gap | no management item matched among 24 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: The umbilical_hernia protocol has no pre-operative optimisation (smoking) step.] |
| `hernia-umbilical-adult-elective` | mgmt-no-inguinal-template | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "emergency laparoscopic inguinal hernia repair (tapp) - operative plan ───────────────────────────────────────────────────────────── ..." [known gap: computeClinicalPrompts fires the |
| `hernia-umbilical-cirrhosis-ascites` | flag-rupture-risk | web | critical | known gap | no red flag matched among 18 (web.triage.reasons, web.protocol.redFlags, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative) [known gap: No web output mentions rupture/skin ulceration/leak for an |
| `hernia-umbilical-cirrhosis-ascites` | mgmt-ascites-control | web | critical | known gap | no management item matched among 33 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No ascites-control / hepatology step in the umbilical_hernia protocol, the dx vari |
| `hernia-umbilical-cirrhosis-ascites` | mgmt-no-standard-day-case-plan | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "... male (reduces haematoma). • ice pack to groin prn × 24h. • day-case discharge: pain controlled on oral analgesia, tolerating oral fluids, voiding. ..." [known gap: computeClinic |
| `iron-deficiency-anaemia-over60` | flag-ida | web | critical | known gap | no red flag matched among 9 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: Nothing reads the anaemia indices: severe_anaemia prompt nee |
| `iron-deficiency-anaemia-over60` | inv-colonoscopy | web | critical | known gap | no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for D50.9 and no IDA prompt; colonoscopy never suggested.] |
| `iron-deficiency-anaemia-over60` | inv-coeliac-serology | web | quality | known gap | no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: Same as inv-colonoscopy.] |
| `iron-deficiency-anaemia-over60` | inv-urinalysis | web | quality | known gap | no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: Same as inv-colonoscopy.] |
| `iron-deficiency-anaemia-over60` | mgmt-iron-replacement | web | quality | known gap | no management item matched among 6 (web.clinicalPrompts) [known gap: Same as inv-colonoscopy.] |
| `mallory-weiss-young-binge` | dx-mallory-weiss-top3 | web | quality | known gap | not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Peptic Ulcer Disease \| 3. Acute Pancreatitis [known gap: PANE top 3: appendicitis, peptic ulcer, pancreatitis — no haematemesis/vomiting_effortless features reach PANE (see UGIB gap).] |
| `mallory-weiss-young-binge` | level-not-emergency | web | quality | known gap | web.triage: emergency (acuity=urgent, action=emergency_now, score=120); expected ≤ urgent [known gap: Emergency now (score 120): any "blood"/"bleed" word is an urgent red flag regardless of volume or GBS, and "No chest pain" in the HPI fire |
| `mi-presenting-as-epigastric-pain` | mnm-acs | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Peptic Ulcer Disease \| 3. GORD / Reflux Oesophagitis [known gap: PANE has no cardiac disease; top 3 cholecystitis, peptic ulcer, GORD.] |
| `mi-presenting-as-epigastric-pain` | mnm-acs-symptom-inference | web | quality | known gap | not in top 5 of web.symptomInference: 1. GORD / acid reflux / oesophagitis \| 2. Gallstone pancreatitis \| 3. Acute alcoholic pancreatitis \| 4. Perforated peptic ulcer \| 5. Gastric carcinoma [known gap: Symptom inference needs the chip "c |
| `mi-presenting-as-epigastric-pain` | level-emergency | web | critical | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=33); expected ≥ emergency [known gap: Same-day call only (score 33): CHEST_PAIN_TERMS and the cardiac red flag need the words "chest pain/crushing/left arm/jaw"; epigastric pa |
| `mi-presenting-as-epigastric-pain` | alarm-cardiac | web | critical | known gap | no alarm matched among 3 (web.clinicalPrompts.safety) [known gap: Safety prompts fired are "Appendicitis — emergency surgical indication" (from "Acute abdominal pain" CC) and "Acute abdominal presentation"; nothing cardiac.] |
| `mi-presenting-as-epigastric-pain` | inv-ecg | web | critical | known gap | no investigation matched among 25 (web.pane.seeded, web.clinicalPrompts) [known gap: No ECG in any output.] |
| `mi-presenting-as-epigastric-pain` | inv-troponin | web | critical | known gap | no investigation matched among 25 (web.pane.seeded, web.clinicalPrompts) [known gap: No troponin in any output.] |
| `nsaid-associated-gastric-ulcer` | level-not-emergency | web | quality | known gap | web.triage: emergency (acuity=urgent, action=emergency_now, score=52); expected ≤ priority [known gap: Emergency now (score 52): adaptiveTriage reads CC+HPI free text without negation — "No bleeding" matches the "GI or other bleeding" urgen |
| `nsaid-associated-gastric-ulcer` | mgmt-ppi-8-weeks | web | quality | known gap | no management item matched among 42 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: peptic_ulcer protocol gives omeprazole 20 mg OD "4–8 weeks" in medications (matche |
| `parathyroid-hypercalcaemic-crisis` | mnm-hypercalcaemia | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Diverticulitis; also in web.symptomInference#2, web.passive#3 [known gap: PANE applied no feature ("Nausea / vomiting" template, SOCRATES empty);  |
| `parathyroid-hypercalcaemic-crisis` | mgmt-no-thyroidectomy-template | web | critical | known gap | forbidden management item present in web.plan: "total thyroidectomy" (+1 more) [known gap: Same dx-variant substring bug: the crisis plan opens with the elective Total Thyroidectomy template.] |
| `parathyroid-primary-hpt-surgical-indications` | dx-hyperparathyroid-top3 | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#3, web.passive#3 [known gap: PANE applied no feature (template "Other / general surgical"); hypercalc |
| `parathyroid-primary-hpt-surgical-indications` | mgmt-no-thyroidectomy-template | web | critical | known gap | forbidden management item present in web.plan: "total thyroidectomy" (+1 more) [known gap: detectDxVariants falls back to lower.includes("thyroid") for the Thyroid group: "parathyroidectomy"/"hyperparathyroidism" contain "thyroid", and "par |
| `pharyngeal-pouch-elderly` | mnm-pouch | web | quality | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Colorectal Cancer \| 3. GORD / Reflux Oesophagitis [known gap: No pharyngeal pouch / Zenker node in PANE or symptom inference; site "Upper neck" maps to neck_lump.] |
| `pharyngeal-pouch-elderly` | inv-barium-first | web | quality | known gap | no investigation matched among 15 (web.pane.seeded, web.clinicalPrompts) [known gap: No protocol for K22.5; no output mentions a contrast swallow.] |
| `pharyngeal-pouch-elderly` | mgmt-pouch-treatment-options | web | quality | known gap | no management item matched among 6 (web.clinicalPrompts) [known gap: No protocol for K22.5.] |
| `thyroid-bethesda-1-nondiagnostic` | level-not-emergency | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malign |
| `thyroid-bethesda-1-nondiagnostic` | mgmt-repeat-fna | web | quality | known gap | no management item matched among 11 (web.clinicalPrompts) [known gap: No output proposes a repeat FNA; E04.1 has no protocol.] |
| `thyroid-bethesda-1-nondiagnostic` | mgmt-no-thyroidectomy-plan | web | critical | known gap | forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" f |
| `thyroid-bethesda-2-benign` | level-not-emergency | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malign |
| `thyroid-bethesda-2-benign` | mgmt-surveillance | web | quality | known gap | no management item matched among 11 (web.clinicalPrompts) [known gap: No surveillance plan; E04.1 has no protocol.] |
| `thyroid-bethesda-2-benign` | mgmt-no-thyroidectomy-plan | web | critical | known gap | forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" f |
| `thyroid-bethesda-3-aus` | level-not-emergency | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malign |
| `thyroid-bethesda-3-aus` | mgmt-no-thyroidectomy-plan | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" f |
| `thyroid-bethesda-4-follicular-neoplasm` | level-not-emergency | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malign |
| `thyroid-bethesda-4-follicular-neoplasm` | mgmt-no-thyroidectomy-plan | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "total thyroidectomy - operative plan ────────────────────────────────────── pre-operative: • tfts normal (euthyroid)..." [known gap: computeClinicalPrompts "thyroidectomy_pathway" f |
| `thyroid-bethesda-5-suspicious` | level-not-emergency | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malign |
| `thyroid-bethesda-6-papillary-cn1b` | level-not-emergency | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malign |
| `thyroid-bethesda-6-papillary-cn1b` | mgmt-no-hemithyroidectomy-prefix | web | critical | known gap | forbidden management item present in web.plan: "hemithyroidectomy (ipsilateral lobe + isthmus). intraoperative recurrent laryngeal nerve neuromonitoring." [known gap: Consequence of the variant bug: the plan opens with "Hemithyroidectomy (i |
| `thyroid-bethesda-6-papillary-cn1b` | variant-thyroid-total | web | critical | known gap | detected thyroid_hemithyroidectomy in group Thyroid; expected thyroid_total [known gap: detectDxVariants uses plain substring matching and the first variant with any keyword wins: "bethesda vi" contains the hemithyroidectomy keyword "bethes |
| `thyroid-nodule-euthyroid-tirads4` | dx-thyroid-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#2, web.triageSurgical#2 [known gap: PANE top 3 = cholecystitis, GORD, PUD after neck_l |
| `thyroid-nodule-euthyroid-tirads4` | level-not-urgent | web | quality | known gap | web.triage: urgent (acuity=priority, action=same_day_call, score=25); expected ≤ priority [known gap: Triage same_day_call: adaptiveTriage RED_FLAGS regexes have no negation handling ("No family history of thyroid cancer" → "Possible malign |
| `thyroid-nodule-euthyroid-tirads4` | inv-us | web | quality | known gap | no investigation matched among 21 (web.pane.seeded, web.clinicalPrompts) [known gap: US and FNA appear only as plan text of the "Thyroid Nodule → USS + FNAC" prompt (addToPlan), not as investigation orders; E04.1 (the correct code for a sin |
| `thyroid-nodule-euthyroid-tirads4` | inv-fna | web | quality | known gap | no investigation matched among 21 (web.pane.seeded, web.clinicalPrompts) [known gap: As above (plan text only).] |
| `thyroid-nodule-euthyroid-tirads4` | inv-no-unrelated-seeded-orders | web | quality | known gap | forbidden investigation present in web.pane.seeded: "blood cultures × 2 (before antibiotics) (cholecystitis)" (+6 more) [known gap: The wrong PANE top 3 seeds blood cultures, MRCP, erect CXR, OGD and group & save for a thyroid nodule.] |
| `thyroid-nodule-hyperthyroid-hot` | dx-hyperthyroid-top3 | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Peptic Ulcer Disease; also in web.symptomInference#1, web.passive#1 [known gap: PANE top 3 = cholecystitis, GORD, PUD: SOCRATES answers carry no thyroto |
| `thyroid-post-op-hypocalcaemia` | level-at-least-urgent | web | critical | known gap | web.triage: priority (acuity=review, action=priority_24_48h, score=25); expected ≥ urgent [known gap: Triage priority_24_48h (score 25, post-op only): no rule for tingling/tetany/hypocalcaemia and lab values are not read by adaptiveTriage.] |
| `thyroid-post-op-hypocalcaemia` | flag-hypocalcaemia | web | critical | known gap | no red flag matched among 6 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.preventative) [known gap: No web engine reads the adjusted calcium 1.78 mmol/L or the symptoms; E89.2 maps to no protocol.] |
| `thyroid-post-op-hypocalcaemia` | inv-ecg | web | quality | known gap | no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: No ECG/cardiac monitoring proposed.] |
| `thyroid-post-op-hypocalcaemia` | inv-magnesium | web | quality | known gap | no investigation matched among 18 (web.pane.seeded, web.clinicalPrompts) [known gap: No magnesium proposed.] |
| `thyroid-post-op-hypocalcaemia` | mgmt-iv-calcium | web | critical | known gap | no management item matched among 5 (web.clinicalPrompts) [known gap: No IV calcium gluconate anywhere (only inside the elective thyroidectomy operative template, which does not fire here).] |
| `thyroid-post-op-hypocalcaemia` | mgmt-oral-calcium-vitd | web | quality | known gap | no management item matched among 5 (web.clinicalPrompts) [known gap: No oral calcium / alfacalcidol plan.] |
| `thyroid-post-op-neck-haematoma` | dx-haematoma-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Surgical Site Infection (SSI) \| 3. GORD / Reflux Oesophagitis [known gap: PANE top 3 = cholecystitis, surgical site infection, GORD: the "Post-op wound concern" template hints wound_er |
| `thyroid-post-op-neck-haematoma` | alarm-airway-specific | web | quality | known gap | no alarm matched among 8 (web.triage.vitalRedFlags, web.triage.emergency, web.clinicalPrompts.safety) [known gap: The alarm is the generic triage "Emergency now" (RR, SpO2, HR); no alarm names the neck haematoma or airway.] |
| `thyroid-post-op-neck-haematoma` | inv-no-imaging-before-decompression | web | quality | known gap | forbidden investigation present in web.plan.investigations: "uss wound (confirm haematoma, guide aspiration of liquefied collections)" (+3 more) [known gap: The generic postop_haematoma investigations include "USS wound (confirm haematoma … |
| `thyroid-post-op-neck-haematoma` | mgmt-no-thyroidectomy-prefix | web | quality | known gap | forbidden management item present in web.plan: "total thyroidectomy" (+1 more) [known gap: The assessment mentions "thyroidectomy", so detectDxVariants selects thyroid_total and prepends the elective Total Thyroidectomy template to the haem |
| `thyroid-rapid-enlargement-stridor` | mnm-anaplastic-or-lymphoma | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Colorectal Cancer \| 3. GORD / Reflux Oesophagitis [known gap: PANE has no anaplastic thyroid carcinoma or thyroid lymphoma disease; top 3 = cholecystitis, colorectal cancer, GORD. The  |
| `thyroid-rapid-enlargement-stridor` | mnm-thyroid-malignancy | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Colorectal Cancer \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#3, web.passive#2 [known gap: Thyroid carcinoma not in the PANE top 3 (see above).] |
| `thyroid-rapid-enlargement-stridor` | alarm-airway-specific | web | quality | known gap | no alarm matched among 7 (web.triage.vitalRedFlags, web.triage.emergency, web.clinicalPrompts.safety) [known gap: The only alarm is the generic triage "Emergency now" (vital signs); nothing names stridor or the airway.] |
| `thyroid-rapid-enlargement-stridor` | inv-core-biopsy | web | critical | known gap | no investigation matched among 35 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: Only FNAC is proposed (protocol and prompt); no core/open biopsy to distinguish anaplastic carcinoma from lymphoma.] |
| `thyroid-rapid-enlargement-stridor` | mgmt-airway | web | critical | known gap | no management item matched among 48 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No airway step in any web output: triage has no stridor rule (the emergency comes  |
| `thyroid-retrosternal-goitre-compression` | flag-compression | web | critical | known gap | no red flag matched among 16 (web.triage.reasons, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.emergency) [known gap: No red flag names tracheal compression, stridor or retroste |
| `thyroid-retrosternal-goitre-compression` | inv-ct | web | quality | known gap | no investigation matched among 24 (web.pane.seeded, web.clinicalPrompts) [known gap: CT neck/thorax appears only inside the thyroidectomy prompt plan text, not as an investigation.] |
| `ugib-cvd-dual-antiplatelet` | dx-ugib-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#5, web.triageSurgical#1 [known gap: PANE top 3: inguinal hernia, cholecystitis, G |
| `ugib-cvd-dual-antiplatelet` | mgmt-cardiology-antiplatelet-decision | web | quality | known gap | no management item matched among 42 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: Antiplatelets are only a triage reason ("Anticoagulant or antiplatelet medication  |
| `ugib-cvd-dual-antiplatelet` | mgmt-no-tranexamic-acid | web | critical | known gap | forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat |
| `ugib-elderly-doac-pre-endoscopy-rockall` | mgmt-transfusion-threshold-8 | web | quality | known gap | no management item matched among 39 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: Only the generic "transfuse to Hb 70–90 g/L" line; heart failure does not change t |
| `ugib-elderly-doac-pre-endoscopy-rockall` | mgmt-no-lmwh-bridging | web | critical | known gap | forbidden management item present in web.clinicalPrompts: "...dging: hold doac 48-72h pre-op (renal-adjusted); warfarin - bridge with lmwh per haematology protocol." [known gap: computeClinicalPrompts anticoag_check (any anticoagulant) adds |
| `ugib-elderly-doac-pre-endoscopy-rockall` | mgmt-no-tranexamic-acid | web | critical | known gap | forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat |
| `ugib-melaena-only-woman` | mgmt-no-tranexamic-acid | web | critical | known gap | forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat |
| `ugib-nonvariceal-gbs-high` | dx-ugib-top3 | web | critical | known gap | not in top 3 of web.pane: 1. GORD / Reflux Oesophagitis \| 2. Inguinal / Femoral Hernia \| 3. Acute / Chronic Gastritis; also in web.symptomInference#1, web.passive#2, web.triageSurgical#1 [known gap: PANE top 3: GORD, inguinal hernia, gast |
| `ugib-nonvariceal-gbs-high` | mgmt-stop-nsaid | web | quality | known gap | no management item matched among 46 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: The upper_gi_bleed protocol only says "PPI long-term if NSAID cannot be stopped";  |
| `ugib-nonvariceal-gbs-high` | mgmt-no-tranexamic-acid | web | critical | known gap | forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat |
| `ugib-nonvariceal-gbs-low-outpatient` | mgmt-outpatient | web | quality | known gap | no management item matched among 35 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No output says the patient can be managed as an outpatient; the GI-bleed prompt ad |
| `ugib-nonvariceal-gbs-low-outpatient` | mgmt-no-tranexamic-acid | web | critical | known gap | forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat |
| `ugib-nonvariceal-gbs-low-outpatient` | mgmt-no-transfusion | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "• 2 × large-bore iv cannulae, hartmann's 500ml bolus, crossmatch 2 units prbc." [known gap: gi_bleed_panel prompt fires on any haematemesis/melaena symptom and adds "2 × large-bore  |
| `ugib-nonvariceal-unstable-shock` | dx-ugib-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. Acute Cholecystitis \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#2, web.triageSurgical#1 [known gap: PANE top 3: inguinal hernia, cholecystitis, G |
| `ugib-nonvariceal-unstable-shock` | mgmt-critical-care | web | quality | known gap | no management item matched among 53 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No HDU/ICU/critical-care line in the protocol, prompts or dx variant; the only var |
| `ugib-nonvariceal-unstable-shock` | mgmt-no-tranexamic-acid | web | critical | known gap | forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat |
| `ugib-on-warfarin-high-inr` | mgmt-no-lmwh-bridging | web | critical | known gap | forbidden management item present in web.clinicalPrompts: "...dging: hold doac 48-72h pre-op (renal-adjusted); warfarin - bridge with lmwh per haematology protocol." [known gap: computeClinicalPrompts anticoag_check (any anticoagulant) adds |
| `ugib-on-warfarin-high-inr` | mgmt-no-tranexamic-acid | web | critical | known gap | forbidden management item present in web.protocol.medications: "tranexamic acid 1 g iv (intravenous) stat (single dose) - antifibrinolytic - if endoscopy ..." [known gap: upper_gi_bleed protocol medications list "Tranexamic acid 1 g IV stat |
| `upper-abdominal-pain-weight-loss-over55` | dx-gastric-cancer-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Peptic Ulcer Disease \| 3. GORD / Reflux Oesophagitis; also in web.symptomInference#1, web.passive#1, web.triageSurgical#1 [known gap: PANE top 3: cholecystitis, peptic ulcer, GORD — we |
| `variceal-bleed-known-cirrhosis` | dx-ugib-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#1, web.passive#4, web.triageSurgical#1 [known gap: PANE top 3: inguinal hernia, GORD, appendiciti |
| `variceal-bleed-known-cirrhosis` | mnm-variceal | web | quality | known gap | not in top 3 of web.pane: 1. Inguinal / Femoral Hernia \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#2, web.passive#1 [known gap: PANE has no variceal/portal-hypertension disease; symptom inference  |
| `variceal-bleed-known-cirrhosis` | mgmt-vasoactive | web | critical | known gap | no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terli |
| `variceal-bleed-known-cirrhosis` | mgmt-antibiotic-prophylaxis | web | critical | known gap | no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terli |
| `variceal-bleed-known-cirrhosis` | mgmt-endoscopy-12h | web | critical | known gap | no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terli |
| `variceal-bleed-known-cirrhosis` | mgmt-band-ligation | web | critical | known gap | no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terli |
| `variceal-bleed-known-cirrhosis` | mgmt-restrictive-transfusion-varices | web | quality | known gap | no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terli |
| `variceal-bleed-known-cirrhosis` | mgmt-pre-emptive-tips | web | quality | known gap | no management item matched among 23 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terli |
| `variceal-bleed-known-cirrhosis` | variant-variceal | web | quality | known gap | detected ugib_nonvariceal_stable in group Upper GI Bleed; expected ugib_variceal [known gap: dx-variants checks ugib_nonvariceal_stable first and its keywords include "haematemesis", "upper gi bleed" and "melaena", so a variceal assessment  |
| `variceal-bleed-unrecognised-cirrhosis` | dx-ugib-top3 | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#2, web.triageSurgical#1 [known gap: PANE top 3: cholecystitis, GORD, appendicitis. PANE never receives  |
| `variceal-bleed-unrecognised-cirrhosis` | mnm-variceal | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. GORD / Reflux Oesophagitis \| 3. Acute Appendicitis; also in web.symptomInference#1, web.passive#1 [known gap: PANE has no variceal node; symptom inference ranks "Portal hypertension /  |
| `variceal-bleed-unrecognised-cirrhosis` | mgmt-vasoactive | web | critical | known gap | no management item matched among 21 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terli |
| `variceal-bleed-unrecognised-cirrhosis` | mgmt-antibiotic-prophylaxis | web | critical | known gap | no management item matched among 21 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terli |
| `variceal-bleed-unrecognised-cirrhosis` | mgmt-band-ligation | web | quality | known gap | no management item matched among 21 (web.clinicalPrompts) [known gap: No management protocol loads: getProtocolByIcd has no I85 prefix (upper_gi_bleed covers K92.x only), and PANE top is <0.20. Only generic GI-bleed prompts remain (no terli |
| `variceal-bleed-unrecognised-cirrhosis` | variant-variceal | web | quality | known gap | detected ugib_nonvariceal_stable in group Upper GI Bleed; expected ugib_variceal [known gap: dx-variants checks ugib_nonvariceal_stable first and its keywords include "haematemesis", "upper gi bleed" and "melaena", so a variceal assessment  |

# Change log — `ios-plan-safety` (iOS plan safety filter, plan content, emergency redirects)

The owner authorised the "fix all gaps" programme on 2026-09-25. This branch covers the iOS plan outputs:

- the Plan-tab radiation card (`DiagnosisRadiationEngine*`);
- the SOAP draft plan (`SOAPDraftEngine.buildPlan`);
- the clinical-pipeline decisions and auto-actions (`ClinicalPipelineOrchestrator`, `BayesianDecisionEngine`, `ManagementEngine*`);
- TG18 auto-fill;
- the text-parser perforation alarm.

The branch did not touch any web code or `lib/pane-engine/**`. It also left alone:

- DrugInteractionService / DrugClasses (read only);
- the medication-history step, PreOpChecklistView, the questionnaire and the social-history fields;
- the Plan-step suggestion badges;
- ScreeningEngine / PathwayData / WellnessScreening, the NG12 port and DiagnosisScoreMapper;
- BayesianDiagnosisEngine* and DiagnosticDatabase.json.

All of this is **deterministic** and **unreviewed**. It is clinician-facing text only (hazard H-10: nothing here reaches a patient). Every rule, line and citation below needs the surgeon's check before release; the list is at the end. The plan remains a suggestion, and nothing is ordered, prescribed or recorded without the clinician.

## Results

Swift cannot be compiled here. The iOS effect was checked statically against the last full iOS run (`ac07db0`/`6bcfe37`, 397 vignettes, 176 iOS management / investigation / score failures). The checks were:

- card routing, with a port of `lookupOrder` / `keywordMatches`;
- the card text by section;
- a Python port of the patient-specific safety lines (`PlanSafetyFilter.evaluate`);
- the under-16 dose and fluid regexes;
- the exact outputs of the previous run, for every exclusion.

The real numbers come from the next iOS CI run.

| iOS expectations (critical) | Before | Expected after |
|---|---|---|
| managementInclude | 74 fail | 74 pass |
| investigationInclude | 50 fail | 50 pass |
| managementExclude | 49 fail | 49 pass |
| investigationExclude | 1 fail | 1 pass |
| scoreValue (TG18 auto-fill) | 2 fail | 2 pass |

The static check expects all 176 to pass. For 166 of them, `"ios"` was removed from `knownGap`. Where web still has the gap, the web flag and the web part of the note were kept (5 expectations). The other 10 (breast triple assessment, NG12 colorectal pathway, visible haematuria) had no iOS flag in the vignettes and are covered by the new cards.

Pass-to-fail check:

- Every expectation that passed in the last run was re-checked against the new routing and card text.
- Three losses were found and fixed:
  - `hernia-femoral-richter-obstruction` inv-ct and mgmt-ng-decompression: the new femoral card now carries CT and NG lines.
  - `lbo-right-colon-cancer` "Hartmann's procedure": reworded.
- Three wording regressions were fixed in 0cb585f:
  - the lactate "30 mL/kg" line against `acutemed-ahf-pulmonary-oedema`;
  - "strangulated hernia" in the decision title against `acutemed-sepsis-afebrile-elderly-urinary`;
  - the NELA line after a past laparotomy.

Web (`pnpm --filter @workspace/scripts run clinval:web`): 397 vignettes, 3087 expectations, 2866 pass, 129 fail, 92 n/a, **0 blocking**. The results files were restored and not committed.

Other checks, all passing:

- `pnpm run typecheck`;
- `pnpm -r run test`: pane-engine 118, scripts 35, front-desk 109, dashboard 650, api-server 588;
- `lint:guideline-registry`, `lint:patient-instructions` and `lint:interaction-parity`.

## 1. PlanSafetyFilter — the Swift twin of the web `planSafety.ts`

**New files:** `PlanSafetyFilter.swift`, `+Notes.swift` and `+Pipeline.swift`. The version is `PlanSafetyFilter.version = "1.0.0"`, registered as `ios-plan-safety-filter`. The tests are in `PlanSafetyFilterTests.swift`, which carries a DRIFT NOTE naming both files and ports the web vectors.

**Before:** iOS had its own allergy, pregnancy and under-16 line filters on the radiation card only.

- Pipeline decisions and SOAP drafts went out unfiltered.
- There were no patient-specific peri-procedural lines. A fixed "antithrombotic plan" was shown whether or not the patient took one.

**After:** one line filter and one set of safety lines at every plan choke point.

- **Choke points:**
  - radiation plan, follow-up and (new) referral reasons and notes, in `applySafety`;
  - the SOAP draft plan, in `draftPlanSafety`, which uses the working-diagnosis card to shape the lines;
  - pipeline decisions (actions and investigations) and auto-actions, in `ClinicalPipelineOrchestrator`, through `adaptDecision` and `adaptAction`.
- **Line filter (`adaptLine`), in this order:**
  1. allergy class (web classes plus the iOS `drugClasses`), then other named allergies;
  2. thrombolysis on an oral anticoagulant (iOS addition);
  3. pregnancy: DOAC/warfarin → LMWH; NSAIDs from 20 weeks; the avoid list (tetracyclines, quinolones, methotrexate, ACE-i/ARB, statins, first-trimester trimethoprim, endocrine therapy, HER2 antibodies, radioiodine);
  4. renal impairment → no NSAIDs;
  5. annotations for NSAIDs before 20 weeks and for ERCP in pregnancy;
  6. under-16: the hernia technique line, then adult doses and fixed fluid volumes replaced.
  - Lines already written by a filter (⚠) and the safety headers are left alone.
- **Patient-specific safety lines ("PATIENT-SPECIFIC SAFETY CHECKS"):**
  - **Anticoagulant / antiplatelet:** the text depends on the situation — bleeding, emergency surgery, surgery, or high- or low-risk endoscopy. Sources: BSG/ESGE 2021, PAUSE 2019, ACCP 2022, BRIDGE 2015, ESC/ESAIC 2022, BSH.
  - **Recent coronary stent:** defer the procedure; cardiology input.
  - **Diabetes and SGLT2:** SGLT2 inhibitors, sulfonylureas, metformin and insulin / type 1 (CPOC 2021; MHRA; JBDS 2023).
  - **Steroid cover** (AAGBI/SfE 2020).
  - **Anaesthetic hazards:** latex, chlorhexidine, malignant hyperthermia, suxamethonium apnoea, OSA (NAP6; AAGBI; RCoA; SAMBA).
  - **VTE** (NICE NG89 2018; RCOG GTG 37a).
  - **Pregnancy** (ACOG CO 775/723; RCOG 37a), β-hCG and paediatric lines.
  - **Frailty** (CPOC 2021; NICE CG103) and **NELA high-risk surgery** (RCS 2018).
  - **Other:** oestrogen (FSRH/UKMEC; NG89), immunosuppression / methotrexate (BSR 2017) and β-blocker masking (ATLS 10).
- **Extra investigations** (added only when the card does not already list them):
  - capillary glucose and ketones (insulin-treated);
  - pregnancy test (woman 12–55 with a procedure);
  - INR (warfarin);
  - renal function / CrCl (DOAC).
- **Under-16 fluids,** the same as the web:
  - a fixed adult volume becomes `[fluids by weight — calculate per APLS/BNFc (mL/kg)]`;
  - an amount in mL counts as a fluid from 50 mL, using the larger end of a range;
  - weight-based amounts (`4 mL × kg × %TBSA`, `mL/kg`) are kept;
  - urine-output titration wording is kept.
- The old fixed `antithromboticPlan` lines and the generic VTE line are replaced by the patient-specific ones when they apply.
- Pregnancy header before: "… no ACE inhibitors/ARBs, LMWH not DOACs or warfarin …". This read as a drug recommendation to the forbidden-item check.
- Pregnancy header after: "no NSAIDs from 20 weeks; anticoagulation with LMWH only (DOACs and warfarin are teratogenic / contraindicated); ACE-i/ARB contraindicated; ultrasound or MRI in preference to ionising imaging." The replaced-line wording is reworded the same way.

## 2. Plan content (cards, engines)

`DiagnosisRadiationEngine.contentVersion` 1.1.x → **1.2.0**. Registry changelogs were added for the radiation engine, score auto-populator, management engine, Bayesian decision engine, auto-function engine, input mapping, vademecum, scoring engine and DBN.

**39 new cards,** checked first in `lookupOrder` (`+PlanSafetyCards.swift`, `+PlanSafetyCards2.swift`). Each card cites its guideline and year in `guidelineReference`. Before this change these diagnoses reached no card or the wrong one:

- **Peri-operative:**
  - pre-operative assessment (NICE NG45 2016; CPOC 2021; ESC/ESAIC 2022; AAGBI 2010 / ESA 2011);
  - suspected anastomotic leak (ACPGBI/ESCP; NG51);
  - post-operative urinary retention (EAU 2023; BAUS);
  - post-thyroidectomy neck haematoma (DAS/BAETS/ENT UK 2022, SCOOP).
- **Hernia:**
  - femoral hernia (HerniaSurge 2018; WSES 2017);
  - incisional / ventral / parastomal hernia (EHS/AHS 2020; EHS 2018).
- **Upper GI:**
  - perforated peptic ulcer (WSES 2020);
  - non-specific abdominal pain (WSES 2020; NG126);
  - achalasia / pseudoachalasia (ESGE/ESNM 2020; ACG 2020);
  - EoE (BSG 2022);
  - food bolus (ESGE 2016);
  - pharyngeal pouch (NICE IPG22);
  - gastric outlet obstruction;
  - dysphagia — urgent endoscopy and suspected gastric cancer (NICE NG12 2015/2023).
- **Hepatobiliary:**
  - suspected pancreatic / periampullary cancer (NICE NG85 2018; ESMO 2023);
  - acute viral hepatitis (UKHSA 2019; EASL 2017).
- **Colorectal and anorectal:**
  - ASUC / toxic megacolon (BSG 2019; ECCO 2021/22);
  - C. difficile (NICE NG199 2021; IDSA/SHEA 2021);
  - infective colitis (IDSA 2017; UKHSA STEC);
  - Lynch surveillance (BSG/ACPGBI/UKCGG 2019; NG151);
  - fistula-in-ano and perianal abscess (ASCRS 2022);
  - anal cancer (ACPGBI 2017; ESMO 2021);
  - rectal prolapse (ASCRS 2017).
- **Endocrine and breast:**
  - thyroid nodule / goitre by Bethesda I–VI (BTA 2014; ATA 2015; ACR TI-RADS 2017);
  - adrenal incidentaloma / phaeochromocytoma (ESE/ENSAT 2023; Endocrine Society 2014);
  - breast abscess (ABS 2019);
  - breast lump — triple assessment (NG12; ABS 2019).
- **Diabetic foot:** Charcot (IWGDF 2023), diabetic foot infection / osteomyelitis (IWGDF/IDSA 2023) and diabetic foot ulcer (IWGDF 2023; GVG 2019).
- **Vascular, urology and other:**
  - mesenteric venous thrombosis (ESVS 2017);
  - visible haematuria (NG12; BAUS);
  - groin lymphadenopathy (NG12; BSH);
  - asplenia (Green Book ch. 7; BCSH 2011).
- **Recognise and redirect:** hypertensive emergency (ESC/ESH 2018; ESC 2019) and febrile infant under 3 months (NICE NG143).

**Content fixes to existing cards** (before → after; web wording mirrored where the same guideline applies):

- **Upper GI bleeding:** tranexamic acid line → "No antifibrinolytic drug" (HALT-IT 2020; ESGE 2021). Added:
  - ICU / IR / under-running escalation;
  - stop NSAIDs, with cardiology before stopping antiplatelets;
  - aorto-enteric fistula → vascular;
  - "coagulation screen (INR)".
- **Choledocholithiasis:**
  - unconditional "ERCP ± sphincterotomy (primary intervention)" → ASGE 2019 likelihood lines (high → ERCP; intermediate → MRCP/EUS first; ERCP only if a stone is confirmed);
  - vademecum ERCP investigation conditional;
  - alias "Charcot" → "Charcot's triad".
- **Anal fissure:** LIS "not for atypical (lateral, multiple, painless) fissures — exclude Crohn's, HIV, TB, syphilis, cancer".
- **Breast carcinoma:** inflammatory breast cancer → neoadjuvant systemic therapy, then mastectomy with axillary clearance, "no wide local excision or SLNB".
- **UTI:**
  - nitrofurantoin → "Lower UTI / cystitis only (not for pyelonephritis)";
  - trimethoprim wording;
  - pyelonephritis in pregnancy (NICE NG111).
- **Small bowel obstruction:**
  - Gastrografin → "adhesive SBO without strangulation only — not for hernia, strangulation or closed loop";
  - a hernia causing obstruction → emergency surgery (WSES 2017).
- **Large bowel obstruction / volvulus:**
  - SEMS "not if perforation, peritonitis or ischaemia"; stent contraindicated with impending perforation;
  - impending caecal perforation → emergency laparotomy and resection;
  - sigmoid volvulus decompression "only if no ischaemia or peritonitis";
  - gangrenous volvulus → emergency laparotomy, sigmoid resection and end colostomy, no endoscopic decompression (ASCRS 2021; WSES 2023/2018).
- **Renal colic:**
  - the definitive treatment lines now say "only after decompression and treatment of the infection" if the system is infected or obstructed;
  - the urology referral says the same (EAU 2024);
  - tamsulosin restrictions;
  - "ureteric colic" keyword;
  - renal ultrasound first in pregnancy and children; CT KUB "not in pregnancy or children".
- **AKI:**
  - post-renal → catheter and post-obstructive diuresis;
  - "Stop / withhold NSAIDs, ACE inhibitors, ARBs, diuretics and metformin";
  - volume replacement with 0.9% sodium chloride;
  - myeloma screen; urinalysis.
- **Acute pancreatitis:**
  - "aggressive" fluids → moderate goal-directed (WATERFALL 2022; ACG 2024), in the card, the management engine, the scoring engine and the DBN;
  - thiamine for alcohol-related disease (NICE CG100);
  - stop the causative drug (ACG 2024).
- **Other cards:**
  - Appendicitis: CT "not in pregnancy (MRI instead)"; MRI and blood-culture investigations; 3–5 days of antibiotics after complicated appendicitis.
  - Diverticulitis: percutaneous drainage and blood cultures.
  - Hyponatraemia / hypercalcaemia: 0.9% saline volume replacement; myeloma screen.
  - Seizure: ECG and first-seizure clinic.
  - Boerhaave: ECG / troponin.
  - Liver abscess: ICU.
  - Cutaneous abscess: duplex, blood-borne virus screen and MRSA line.
  - Burns: early intubation.
  - MSCC: safety-net line.
  - NSTI: clindamycin on its own line.
  - Parathyroid crisis: saline / bisphosphonate.
  - Pre-eclampsia: "ACE-i/ARB contraindicated antenatally".
  - Colorectal cancer: 2-week line and "Anaemic: correct iron deficiency".
  - PUD: aspirin line and NSAID red flag.
  - GORD: weight-loss red flag.
  - Umbilical hernia: ascites line.
  - Inguinal hernia: strangulation line.
  - IBD: colonoscopy "avoid in acute severe colitis".

**Engine wording:**

- Sepsis and qSOFA decisions: "IV antibiotics within 1 hour **if suspected infection**".
- Lactate lines: "goal-directed" in place of "aggressive"; lactate ≥ 4 no longer carries a fixed 30 mL/kg.
- Hernia decision:
  - before: "Emergency Hernia Repair — Suspected Strangulation";
  - after: "Hernia with Suspected Strangulation — Emergency Surgical Review" / "if strangulation is confirmed, emergency repair ± bowel resection".
- TG18 antibiotic recommendations: "per local policy (e.g. …; non-penicillin regimen if penicillin-allergic)".

**TG18 auto-fill** (`PatientScoreAutoPopulator+TG18Organ.swift`): the organ dysfunction behind Grade III is read from the record.

- Before: Grade II from WBC, age and temperature, even in septic shock.
- After: Grade III is ticked on any of these criteria:
  - cardiovascular: SBP < 90 or a vasopressor named without negation;
  - neurological: ACVPU not Alert;
  - renal: creatinine > 2.0 mg/dL (177 µmol/L) or oliguria / anuria;
  - hepatic: INR > 1.5;
  - haematological: platelets < 100.

**Perforation alarm** (`ClinicalTextParser`): "free intraperitoneal gas / air", "extraluminal gas / air" and "perforated viscus" now raise the pneumoperitoneum alarm and feature. Before this change, only "free air / pneumoperitoneum" did.

## 3. Emergency protocols (recognise, first actions, redirect)

The medical, obstetric and paediatric emergency cards (the precedence cards and the additional cards) open with `redirectLine`:

- the text is `EmergencyRedirect.text`: call 911, or go to OKEU Hospital, St Jude's Hospital or Tapion Hospital; inpatients call the hospital emergency team;
- the first actions follow.

The existing cards cover hypoglycaemia, DKA / HHS, pre-eclampsia / HELLP, ectopic pregnancy, trauma in pregnancy / abruption, malrotation, intussusception and the additional-card emergencies. This branch adds hypertensive emergency and febrile infant under 3 months. A card built this way is marked `emergencyCard`, which means no procedure-related safety lines.

New tests:

- `testNoCardNamesVictoriaHospital` checks that Victoria Hospital is never named in the redirect text or on any card: plan, follow-up, urgency, red flags, referrals and investigations.
- `testEveryRedirectCardNamesTheHospitalsAnd911`.

## 4. Vignette flags

`"ios"` was removed from `knownGap` on 166 expectations, all critical:

| Kind | Flags removed |
|---|---|
| managementInclude | 70 |
| managementExclude | 49 |
| investigationInclude | 44 |
| scoreValue | 2 |
| investigationExclude | 1 |

- A flag was removed only when the routed card, the safety lines or the reworded engine text satisfies the expectation in the static check.
- Where web still has the gap, the web flag and web note stay and only the iOS part of the note is dropped. This applies to 5 expectations: `lbo-cancer-impending-caecal-perforation`, `breast-inflammatory-cancer`, `dvt-pregnancy-22wk` and both TG18 auto-fills.
- No expectation was weakened or deleted.

## Needs sign-off

Deliberate differences from the web filter:

1. **Beta-lactams after an immediate penicillin reaction.** After an immediate or severe penicillin reaction (anaphylaxis, angio-oedema, urticaria, bronchospasm, "severe"), iOS **withholds** cephalosporins and carbapenems. The web only cautions (BNF allows some with specialist advice).
2. **Thrombolysis on an oral anticoagulant.** Thrombolysis (alteplase, tenecteplase) is withheld on any oral anticoagulant, with thrombectomy discussion (NICE NG128; ESO 2021; ESC 2019). This covers plan lines and now referral reasons, e.g. "thrombolysis window 4.5 h". Web has no such rule.
3. **VTE line on request.** The NICE NG89 line is added whenever the assessment mentions VTE prophylaxis, thromboprophylaxis, VTE risk or Caprini, even with no operation.
4. **Inferred "not pregnant".** Not-pregnant is inferred from "post-menopausal", "total hysterectomy", "not pregnant" or a negative test in the text. A male patient is never flagged for β-hCG.
5. **"NSAID contraindicated" counts as not given.** Wording such as "NSAID contraindicated" or "not tolerated" after a drug name is treated as not given.
6. **Peri-procedural wording.** The DOAC before high-risk endoscopy line reads "stop … 3 days before the procedure". The mechanical-valve line reads "bridging … is indicated for a mechanical valve".
7. **Past laparotomy.** The NELA line ignores a past laparotomy ("day 3 after laparotomy").
8. **DOAC renal function.** The CrCl investigation is added even when the card lists "U&E".
9. **Filter scope.** Referral reasons and notes go through the line filter too.
10. **Under-16 fluids and doses** (web parity, now merged):
    - the 50 mL cut-off uses the larger end of a range;
    - per-kg doses are no longer replaced for children, which is a behaviour change from the earlier iOS filter.
11. **TG18 proxies:**
    - SBP < 90 is taken as the cardiovascular criterion even without a named vasopressor;
    - a creatinine above 20 is read as µmol/L and converted.

Content choices:

12. **Thyroid card.** A single card graded by Bethesda I–VI. Hot nodule: no FNA, then radioiodine or hemithyroidectomy. Bethesda III–IV: diagnostic lobectomy. Bethesda V–VI: MDT, lobectomy or total thyroidectomy. N1b: lateral neck dissection.
13. **Pre-operative card:**
    - ECG only if age ≥ 65 or cardiovascular, renal or diabetic disease before intermediate / major surgery;
    - defer elective surgery if K⁺ ≥ 6.0 mmol/L; dialysis the day before;
    - NT-proBNP / troponin if RCRI ≥ 1;
    - fasting 6 h food / 2 h clear fluids.
14. **Local UTI treatment days.** The nitrofurantoin duration was kept at 5 days (St Lucia local choice), now "lower UTI / cystitis only".
15. **Hypertensive emergency card.** It is a recognise-and-redirect card (outpatient clinic). IV labetalol, nicardipine or GTN are named as first actions in a monitored setting.
16. **Febrile infant card.** It is a recognise-and-redirect card (NICE NG143).
17. **Hernia decision.** The emergency hernia decision is renamed to "surgical review", and repair is only "if strangulation is confirmed".
18. **Lactate ≥ 4 line.** The line is "goal-directed resuscitation (fluid volume by cause of shock)", with no fixed 30 mL/kg.
19. **Alarm terms.** "Perforated viscus" and "free intraperitoneal / extraluminal gas" raise the perforation alarm.
20. **Pancreatitis card:**
    - drug-induced: stop the causative drug and never rechallenge;
    - alcohol: IV thiamine before glucose.
21. **"Charcot" alias.** The vademecum alias "Charcot" was narrowed to "Charcot's triad" (it had matched Charcot foot).
22. **Gangrenous sigmoid volvulus.** The line reads "sigmoid resection and end colostomy", no longer "Hartmann's procedure".
23. **Line removal.** Pregnancy and renal line replacements remove a whole pipeline action ("⚠ … withheld (contains …)"), including other content on that line. This is the same as the web.

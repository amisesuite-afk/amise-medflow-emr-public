# Perioperative medicine cluster — clinical validation findings

The perioperative vignettes compared with current guidelines. This cluster covers pre-operative
assessment and risk (ASA, RCRI/ESC 2022, functional capacity, OSA, frailty, CKD, steroids,
anaesthetic hazards), peri-procedural antithrombotic management (surgery and endoscopy),
peri-operative diabetes (SGLT2 inhibitors, insulin), VTE prophylaxis, antibiotic prophylaxis and
allergy, and eight post-operative complications on the ward. It adds 37 vignettes.

- **Base:** `claude/pr-37-gbg22z` at b63c935, branch `clinval-periop`. No engine code, threshold or
  clinical data was changed.
- **Web:** `pnpm --filter @workspace/scripts run clinval:web`, run on 2026-09-25. These results are
  exact.
- **iOS:** not run. This machine is Linux, so the XCTest harness cannot run here. Every
  expectation that applies to iOS carries `unverified: ["ios"]`. The iOS section below is a
  **prediction from reading the code**, not an observation. Triage it after the next CI run.
- **Citations:** every citation is `verified: false`. The surgeon must check the statement
  numbering and wording against the source.
- **Thresholds:** no threshold was invented. Numbers appear only where the cited guideline states
  them (for example NICE NG89's 28 days, UKKA's potassium bands). No expectation asserts a drug
  dose.
- **Category:** the schema has no `periop` category. The vignettes use `other` (pre-operative and
  antithrombotic cases), `gi-emergency`, `general-medicine`, `urology`, `soft-tissue` and
  `vascular`, and every one carries the tag `periop`. The ids all start `periop-`.

## Summary (web, the 37 periop vignettes only)

| | Count |
|---|---|
| Vignettes | 37: 11 bases, 26 permutations. One permutes the existing `pe-postop-day5` seed. |
| Expectations | 265: **151 pass, 108 fail, 6 n/a** (the 6 n/a are iOS-only pathway checks) |
| Critical expectations graded on web | 139: 101 pass, **38 fail** |
| Quality failures | 70 |
| Blocking failures | **0**. Every web failure, critical or quality, has `knownGap: ["web"]`, a `knownGapNote` saying what the engine does instead, and a `proposedFix` |
| iOS | 264 expectations marked `unverified: ["ios"]` (every expectation except the one web-only dx-variant check) |

Whole suite after this cluster: 280 vignettes, 2219 expectations, blocking 0.
`pnpm --filter @workspace/scripts run test` passes, and every vignette passes the JSON Schema
(checked with Ajv 2020-12).

**What works.** The engines handle classic surgical complications well:

- Post-operative urinary retention, superficial and organ-space SSI, and ileus rank first on PANE.
  The typical anastomotic leak ranks #2, with CT, antibiotics and drainage/relaparotomy.
- Sepsis and hypoxia alarms fire from vital signs, and NEWS2 ≥7 reaches emergency level.
- The AKI prompt stops NSAIDs and ACE inhibitors and asks for a fluid challenge.
- The hyperkalaemia prompt defers surgery.

**What fails.** The engines do not reason about the peri-operative decisions themselves:

- which antithrombotic to stop, when, and whether to bridge;
- SGLT2 inhibitors;
- anaesthetic hazards recorded in the history;
- VTE prophylaxis;
- the allergy record.

Where they do produce a peri-operative line, it is one generic template for every patient.

## Top 10 safety gaps (ranked)

| # | Gap | Evidence (vignettes / expectations) | Guideline | Proposed fix (proposal only) |
|---|---|---|---|---|
| 1 | **Anticoagulation plans use one template for every patient, and it is wrong for most.** `clinical-inference.ts` `anticoag_check` produces a single plan line for any anticoagulant: *"hold DOAC 48–72h pre-op (renal-adjusted); warfarin — bridge with LMWH per haematology protocol"*. The effects: (a) **bridging** for non-valvular AF, CHA₂DS₂-VASc 3, no prior stroke — the BRIDGE population, where bridging only added bleeding; (b) no "stop warfarin 5 days before", no day-before INR, no restart plan; (c) the **same bridge line before a diagnostic OGD**, where warfarin should continue; (d) DOAC patients get a line headed "Anticoagulant bridging", with one interval (48–72 h) whatever the bleeding risk, plus routine PT/INR/APTT; (e) it fires for **prophylactic enoxaparin 40 mg in all 10 post-operative vignettes whose only anticoagulant is standard prophylaxis**. A separate prompt makes it worse: `coagulopathy` treats any INR >1.5 as coagulopathy. It advises "Hold elective surgery until INR <1.5" and **oral vitamin K** for a *therapeutic* INR 2.3 before a low-risk gastroscopy. | `anticoag-warfarin-af-no-bridging` (2 critical); `endo-diagnostic-ogd-warfarin` (2 critical: bridging, vitamin K reversal); `anticoag-apixaban-ckd-elderly`, `endo-ercp-sphincterotomy-apixaban`, `postop-fever-day1-early` (quality). The mechanical-mitral-valve case, where bridging *is* indicated, passes only because every warfarin patient is bridged. | ACCP 2022; BRIDGE 2015; ACC 2017; PAUSE 2019; BSG/ESGE 2021 | Replace `anticoag_check` with a rule table keyed on drug × indication (mechanical valve, recent VTE or stroke) × procedure bleeding risk. Examples: warfarin — stop 5 days before, INR the day before, bridge only at high thrombotic risk; DOAC — omit 1 or 2 days by CrCl and bleeding risk, no bridging, no routine coagulation test; low-risk endoscopy — continue. Skip prophylactic-dose LMWH. Make `coagulopathy` compare the INR with the warfarin target and the procedure before suggesting reversal. |
| 2 | **Antiplatelet drugs and recent coronary stents are invisible.** No rule reads aspirin, clopidogrel, ticagrelor or prasugrel; `hasMed` in `anticoag_check` lists only anticoagulants. The only trace is the triage reason "Anticoagulant or antiplatelet medication mentioned". Three months after an ACS drug-eluting stent, an elective laparoscopic cholecystectomy gets the full operative template: no deferral, no cardiology input. Two months after a DES before a 20 mm polypectomy: no cardiology liaison. Clopidogrel before a 25 mm EMR: no stop instruction. | `preop-recent-acs-des-elective-chole` (2 critical); `endo-dapt-recent-stent-polypectomy` (1); `endo-polypectomy-clopidogrel` (1) | ESC 2022 (delay elective surgery 12 months after ACS, 6 months after elective PCI; continue aspirin; P2Y12 decisions with the cardiologist); BSG/ESGE 2021 | An antiplatelet prompt that reads stent type and date. Continue aspirin. Interrupt a P2Y12 inhibitor only with cardiology agreement. Defer elective surgery inside the ESC windows. For endoscopy, apply the BSG/ESGE table: low thrombotic risk → stop clopidogrel 7 days before a high-risk procedure. |
| 3 | **SGLT2 inhibitors, euglycaemic DKA and basal insulin.** No rule anywhere mentions gliflozins, so dapagliflozin is never withheld before surgery. Day 2 after cholecystectomy on empagliflozin — glucose 9.8, pH 7.18, bicarbonate 10, ketones 5.4 mmol/L — gives **no DKA diagnosis, alarm, test or action**. The glucose prompts need >11 or >15 mmol/L. PANE ranks *acute cholecystitis* first (the gallbladder was removed two days earlier). The negated "no peritonism" adds **emergency laparotomy consent**. In type 1 diabetes, VRIII is suggested but "continue basal insulin" never appears. | `diabetes-sglt2-euglycaemic-dka-postop` (4 critical, plus the laparotomy line counted in gap 4); `diabetes-sglt2-preop-withhold` (1); `diabetes-type1-emergency-surgery` (1) | CPOC 2022; FDA 2020 SGLT2 label; JBDS DKA 2023 | Add a peri-operative diabetes medication prompt (the surgeon signs off the wording; hazard H-10 governs patient-facing text): SGLT2i withheld with a ketone check, sulfonylurea omitted on the day, type 1 → never omit basal insulin. Add a hard rule: ketones ≥3 or pH <7.3 / bicarbonate <15 → DKA alarm **whatever the glucose**, with an SGLT2i note. |
| 4 | **Negated or non-specific findings trigger emergency laparotomy and appendicectomy plans** (the root cause is HPB gap 1; new triggers found here). These texts all matched: "no current abscess or free air" (CT), "No free subdiaphragmatic gas beyond expected post-operative" (CXR), "no peritonism", "no generalised peritonism", "no rebound". The prompts then add *"Emergency laparotomy consent — source control; ICU post-operatively"* plus pip-tazo. That happened to an **elective** colectomy planning visit, euglycaemic DKA, post-operative ileus, post-operative pneumonia and a contained organ-space SSI. Any "guarding" or "rebound", even negated, also adds the full laparoscopic appendicectomy plan: perforated diverticulitis, the day-5 leak and the occult leak. | `mgmt-no-emergency-laparotomy` ×5 (4 critical); `mgmt-no-appendicectomy` ×3 (critical) | WSES 2017; the guideline for each index condition | A negation-aware matcher (NegEx-style) in `exam()`, `hasRadResult()` and triage `rules.ts`. Gate the operative cascades on the locked working diagnosis. |
| 5 | **Anaesthetic hazards in the record never reach the plan.** No rule reads the following: **malignant hyperthermia** (untested brother of an MH-susceptible patient: no alert, no trigger-free anaesthesia, no dantrolene); **suxamethonium apnoea** before an RSI; **latex anaphylaxis** (the header shows "Allergy: Latex", but the plan is unchanged and has no latex-free theatre); **STOP-Bang 8** (the scale is suggested, but there is no OSA flag or mitigation, and the template orders PRN morphine); **prednisolone 10 mg for 2 years** (no steroid cover). | `preop-mh-susceptible` (2 critical); `preop-suxamethonium-apnoea` (2); `preop-latex-allergy` (1); `preop-osa-stopbang` (1); `preop-long-term-steroids` (1) | AA MH guideline 2021; BChE review 2019; AAGBI 2009 / NAP6 2018; SASM 2016 / ASA 2014; Woodcock 2020 | An anaesthetic-alert rule set on PMH and allergy text. It raises a persistent red flag and a plan line: trigger-free anaesthesia with dantrolene available; no suxamethonium or mivacurium; latex-free theatre, first on the list; OSA risk mitigation; hydrocortisone cover. |
| 6 | **The allergy record does not filter the plan.** A patient with penicillin **anaphylaxis** gets penicillins from several places: the Plan tab (dx-variant prefix "IV piperacillin-tazobactam", protocol "oral co-amoxiclav"), the protocol medications, and the negated-free-air prompt. There is no prophylaxis plan and no non-beta-lactam alternative for the colectomy. The lap chole template orders co-amoxiclav at induction for everyone. Same root cause as the seed finding in ENGINE-MAP ("plan templates do not check the recorded allergy"). | `abx-penicillin-anaphylaxis-colectomy/mgmt-no-penicillin` (critical), plus 2 quality | JTF drug allergy 2022; NAP6 2018; ASHP 2013; NICE NG125 | Allergy-aware plan generation: filter or substitute every drug line against the allergy record (the penicillin class includes co-amoxiclav, pip-tazo and flucloxacillin) and show the substitution. Add a procedure-class prophylaxis prompt: single IV dose within 60 min before incision, allergy alternative. |
| 7 | **No VTE prophylaxis in any plan.** A rectal cancer case with Caprini 11 has Caprini suggested as a score, but no output recommends LMWH, 28-day extended prophylaxis or mechanical prophylaxis. C20 maps to the generic `colorectal_cancer` protocol, which has no VTE content. On post-operative day 1 after a bleeding duodenal ulcer (platelets 68) there is no VTE decision at all: no mechanical prophylaxis, and a "no LMWH" check passes only by omission. Where templates do include LMWH ("Enoxaparin 40mg"), it is not adjusted for renal function, even for a dialysis patient. | `vte-caprini-high-cancer-surgery` (1 critical, 2 quality); `vte-high-bleeding-risk-mechanical` (1); `preop-ckd-dialysis-hyperkalaemia` (quality) | NICE NG89; ACCP 2012 (Caprini) | A VTE prompt in every operative plan, driven by the VTE-versus-bleeding assessment: LMWH plus mechanical prophylaxis; 28 days after major abdominal or pelvic cancer surgery; mechanical only while bleeding risk is high, reassessed daily; renal dose adjustment. |
| 8 | **Frail emergency laparotomy: the Plan tab drops the operation, and the NELA essentials are missing.** "Perforated … Hinchey IV" selects the **Hinchey I/II abscess variant**, because the keyword `hinchey i` is a substring of `hinchey iv` and the abscess variant is checked first. The documented plan therefore reads "IV pip-tazo, CT-guided drainage, interval colectomy" and **omits Hartmann's for faecal peritonitis**; it appears only in the Assessment panel. For an 84-year-old, CFS 6, on apixaban: no P-POSSUM or NELA risk, no elderly-medicine review, no goals-of-care or escalation plan, no DOAC plan for emergency surgery. "Generalised guarding and rebound" also adds the appendicectomy plan (gap 4). | `nela-frail-emergency-laparotomy/variant-peritonitis` (critical), `mgmt-no-appendicectomy` (critical), 5 quality | WSES 2017; RCS/DH 2011; NELA standards; CPOC/BGS 2021 | `dx-variants.ts`: match Hinchey on word boundaries (`\bhinchey (i\|1)\b`), put the peritonitis variant first, and add the vector to `lint:dx-phases`. Add a NELA prompt for a locked emergency-laparotomy diagnosis: risk score, consultant presence, critical care, elderly medicine at age ≥65, treatment escalation plan, DOAC timing. |
| 9 | **High-risk PE after recent surgery: thrombolysis is listed without its contraindication.** The `pulmonary_embolism` protocol step is qualified ("if no contraindication"). Its medication list ("Alteplase 10 mg IV bolus, then 90 mg over 2 hours — massive PE") and its key point ("systemic thrombolysis … is life-saving") are not, 6 days after a laparotomy. | `postop-pe-high-risk-shock/mgmt-no-unqualified-thrombolysis` (critical) | ESC PE 2019 (major surgery within 3 weeks) | Qualify the alteplase medication line and the key point. When the patient is post-operative, put surgical embolectomy or catheter-directed therapy first. |
| 10 | **Post-operative delirium and the afebrile leak are not recognised.** In hypoactive delirium (4AT 8, AVPU C, on opioid PCA and cyclizine, not voiding), confusion produces only the generic triage reason "Systemic red flag symptom". There is no delirium flag, no precipitant screen, no medication review and no non-drug care. For a 79-year-old on bisoprolol and prednisolone with new AF, delirium, ileus and rising CRP on day 4, PANE drops the anastomotic leak from the top 3: the node depends on fever (0.8) and guarding. The CT is still suggested. | `postop-delirium-hypoactive/flag-delirium` (critical); `postop-anastomotic-leak-occult-elderly/mnm-leak` (critical) | NICE CG103; SIGN 157; ISREC 2010; WSES 2017 | A delirium prompt: new confusion or AVPU C after surgery → 4AT, precipitant checklist (bladder scan, urine, glucose, sodium, CXR, cultures), opioid and anticholinergic review, no benzodiazepines. Add leak features that do not need fever (new arrhythmia, delirium, rising CRP after day 3), plus a day-4+ "leak until proven otherwise" rule after bowel anastomosis. |

Other critical failures (all flagged):

- **Pregnancy at 29 weeks.** Emergency laparotomy with no obstetric team or fetal monitoring. The
  β-hCG prompt says "exclude ectopic", and the pelvic-free-fluid prompt fires the ruptured-ectopic
  protocol for a known 29-week pregnancy. This repeats HPB gap 6.
- **Emergency level ignores the confirmed diagnosis.** Ultrasound-proven appendicitis before
  emergency surgery in a type 1 diabetic triages as `priority_24_48h`: the free text has no
  keyword and triage reads neither imaging nor the diagnosis.
- **Organ-space SSI has no drainage.** The SSI protocol has no percutaneous drainage step; "CT-guided
  drainage" appears only in its red flags.

## Lower-impact but systematic

- **Over-triage.**
  - All 13 post-operative encounters are `emergency_now`, including a day-1
    fever (T 38.2, HR 94), a superficial SSI and stable urinary retention. The cause is "Post-operative
    concern" (urgent) for any "post-op"/"wound" word, plus the anticoagulant reason for prophylactic
    enoxaparin.
  - Elective pre-operative and endoscopy visits become `emergency_now` from negated or historical
    words:
    - "no jaundice" → possible biliary obstruction;
    - "No bleeding problems" → GI bleeding;
    - "breathless on one flight of stairs" → post-operative concern;
    - "collapse" in an allergy history;
    - "drained percutaneously".
- **NICE NG45 test minimisation.**
  - `preop_haem` adds PT/INR, APTT and Group & Screen to every surgical consultation, ASA 1
    included.
  - PSA appears as a pre-operative hernia test, and in acute urinary retention (falsely raised).
  - The operative templates start "NBM from midnight" and give co-amoxiclav at induction for
    low-risk lap chole.
- **Cardiac risk.**
  - RCRI is suggested, but its result drives nothing: no NT-proBNP or troponin, no echo for HFrEF
    with poor functional capacity, and functional capacity is never asked.
  - The ECG comes only from the age-≥40 rule.
  - No pre-operative anaemia plan (ferritin/IV iron) at Hb 10.8 or 9.4 before cancer surgery.
- **Electrolytes and oxygen.**
  - The hyperkalaemia prompt gives insulin-dextrose at K⁺ 5.8 (UKKA mild band), and never says
    "dialyse" for a haemodialysis patient.
  - The hypoxia prompt's plan line targets SpO₂ ≥94% in COPD (BTS: 88–92% pending ABG). Its step
    text mentions 88–92%, but the added plan line does not.
- **PANE ignores surgical history.**
  - Acute cholecystitis is #1 the day after a cholecystectomy (fever) and 2 days after (DKA).
  - There are no nodes for atelectasis, pneumonia, bile leak, DKA, AKI or delirium.
  - The inguinal-hernia prior (0.10–0.15) again fills top-3 slots in unrelated presentations (AKI,
    ERCP, bleeding DU, RCRI, PE).
- **Protocol selection.**
  - The Assessment panel follows the PANE top, not the confirmed diagnosis (HPB gap 7): a day-1
    fever after cholecystectomy shows the cholecystitis protocol with IV co-amoxiclav or
    pip-tazo.
  - ICD `K56.7` (ileus) maps to the `bowel_obstruction` protocol.
  - `C20` maps to `colorectal_cancer` (not `rectal_carcinoma`).
  - The bleeding-DU post-operative day-1 plan still says "OGD within 24 h".

## Per condition

### Pre-operative assessment and cardiac risk (7: ASA I base, RCRI 5, recent ACS stent, OSA, dialysis/hyperkalaemia, long-term steroids, latex)

- **Right.**
  - ASA I case: routine level, no ECG under 40.
  - RCRI, ASA, STOP-Bang, CFS and CHA₂DS₂-VASc are suggested when comorbidities trigger them.
  - Hyperkalaemia is flagged, with "surgery deferred".
  - Aspirin after PCI is never stopped.
  - Allergies appear in the header.
- **Wrong.**
  - Gaps 1, 2 and 5.
  - The NG45 over-testing, fasting advice and routine prophylaxis above.
  - No cardiac work-up beyond an age-based ECG.
  - The ASA scale is not suggested for a fit patient: the CDS pre-op triggers read
    `procedureData.preop` or symptom words.
- **Fix.** Gaps 1, 2 and 5, plus an ESC 2022 cardiac-risk prompt.

### Antithrombotic management — surgery and endoscopy (7: warfarin AF, mechanical mitral valve, apixaban elderly CKD, clopidogrel EMR, warfarin diagnostic OGD, apixaban ERCP, DAPT recent stent + polypectomy)

- **Right.**
  - The anticoagulant or antiplatelet triage reason and the INR/renal tests.
  - DOACs are held (one interval).
  - ERCP is offered for ASGE high risk.
  - Bridging for the mechanical mitral valve (for the wrong reason).
- **Wrong.** Gaps 1 and 2; routine coagulation tests with DOACs; PANE misses
  choledocholithiasis (#1 inguinal hernia) in the ERCP case.
- **Fix.** Gaps 1 and 2.

### Peri-operative diabetes (3: SGLT2i pre-op, post-op euglycaemic DKA, type 1 emergency)

- **Right.** HbA1c requested; VRIII suggested when glucose >11; insulin never stopped.
- **Wrong.** Gap 3; ketones only as a plan line; triage priority for confirmed appendicitis.
- **Fix.** Gap 3.

### VTE (2 new + 1 permutation of the PE seed: Caprini 11 cancer surgery, high bleeding risk, high-risk PE with shock)

- **Right.**
  - PE: emergency level, shock alarm, UFH, CTPA/echo, ICU, and the qualified reperfusion step.
    PE reaches PANE #3 only with the PANE answers; PANE #1 is inguinal hernia.
  - Caprini is suggested.
- **Wrong.** Gaps 7 and 9.
- **Fix.** Gaps 7 and 9.

### Antibiotic prophylaxis and allergy (2: penicillin anaphylaxis colectomy, clean mesh hernia)

- **Right.**
  - Single-dose prophylaxis at induction for the mesh repair, and no post-operative course.
  - The penicillin allergy is shown.
- **Wrong.** Gap 6; negated "free air" → emergency laparotomy (gap 4); pre-op PSA and PT/INR.
- **Fix.** Gaps 4 and 6.

### Anaesthetic hazards (2: MH susceptibility, suxamethonium apnoea)

- **Right.** Nothing specific. Appendicitis is correctly ranked and triaged in the
  suxamethonium case.
- **Wrong.** Gap 5.
- **Fix.** Gap 5.

### Frailty, emergency laparotomy, pregnancy (3: NELA frail + DOAC, elective frail with dementia, pregnant SBO)

- **Right.**
  - Perforated diverticulitis at PANE #1: emergency level, sepsis alarm, antibiotics, Hartmann's
    (Assessment panel), ICU.
  - SBO at PANE #1 in pregnancy, with a pregnancy flag and no NSAIDs.
  - CFS is suggested at age ≥65.
- **Wrong.** Gap 8; no CGA, delirium prevention or capacity/shared decision-making for dementia;
  no obstetric involvement, positioning or antenatal steroids; CT unqualified after MRI.
- **Fix.** Gap 8, plus the pregnancy branch (HPB gap 6).

### Post-operative complications (10: fever day 1, leak day 5, occult leak, superficial SSI, organ-space SSI, AKI, urinary retention, ileus, delirium, pneumonia with NEWS2 15)

- **Right.**
  - Leak, SSI, retention and ileus rank on PANE, with CT, drainage/relaparotomy, antibiotics,
    catheter + tamsulosin, NG tube, electrolytes and opioid review.
  - AKI: flag, stop NSAIDs/ACE inhibitor, fluid challenge, urinalysis.
  - Pneumonia: emergency level, hypoxia alarm, ABG, antibiotics, escalation.
  - No benzodiazepines or antipsychotics suggested in delirium.
- **Wrong.**
  - Gaps 4 and 10.
  - Over-triage of every ward review.
  - Early fever gets broad-spectrum antibiotics from the cholecystitis panel.
  - No pneumonia in PANE.
  - The COPD oxygen target.
  - PSA in acute retention.
  - Insulin-dextrose for mild hyperkalaemia.
  - No drainage step for an organ-space collection.
- **Fix.** Gaps 4 and 10, post-operative triage from NEWS2, a post-operative-day-aware fever
  prompt, and PANE conditioned on surgical history.

## Incidental passes (the expectation passed, but not for the clinical reason)

- `preop-asa1-lap-chole/inv-pregnancy-status`: the only pregnancy test is the βhCG "exclude
  ectopic" seeded from the **appendicitis** protocol, because PANE ranks appendicitis #2 in a
  pain-free pre-operative patient.
- `anticoag-warfarin-mechanical-mitral-bridging/mgmt-bridging`: bridging appears because every
  warfarin patient is bridged (gap 1), not because the valve is recognised. The valve itself is
  never flagged.
- `anticoag-apixaban-ckd-elderly/mgmt-doac-interrupt` and `endo-ercp…/mgmt-doac-interrupt`: the
  same generic "hold DOAC 48–72h" line, whatever the bleeding risk.
- `postop-pneumonia-news2-escalation/mgmt-escalation`: the first match is "Emergency laparotomy
  consent … ICU post-operatively", from the negated CXR "free subdiaphragmatic gas". The hypoxia
  prompt's "ITU review" line also matches, so the escalation itself is genuine.
- `postop-delirium-hypoactive/inv-precipitant-screen` and
  `postop-pneumonia-news2-escalation/inv-cultures`: blood cultures seeded from the
  **cholecystitis** protocol (PANE top).
- `vte-high-bleeding-risk-mechanical/mgmt-no-lmwh-now`: passes because there is no VTE content at
  all.
- `preop-recent-acs…/flag-antiplatelet-stent` and the other antiplatelet flags: only the generic
  triage reason; no stent or DAPT awareness.

## iOS (predicted from code, not observed; every iOS expectation is `unverified`)

- **Working-diagnosis radiation matches short keywords as substrings.**
  `DiagnosisRadiationEngine.radiate` takes the first entry (49 in total) whose keyword is a
  substring of the working diagnosis. Simulating that on the 37 confirmed-diagnosis names:
  - **14 that are not PE radiate to the Pulmonary Embolism card** through the keyword `"pe"`
    (15 with the real PE case). It matches "o**pe**rative" in "Pre-operative assessment…" and
    "post-operative", "**Pe**rforated", "dys**pe**psia", "poly**pe**ctomy" and "Sus**pe**cted".
    The PE card carries anticoagulation and thrombolysis text into pre-operative assessments,
    anastomotic leaks, SSI and delirium.
  - **8 radiate to the Acute Coronary Syndrome card** through `"mi"`: "he**mi**colectomy",
    "euglycae**mi**c", "**mi**tral". A ninth, the recent-NSTEMI case, matches it through
    "nstemi". "Acute kidney injury … after right hemicolectomy" gets the ACS card, not the AKI
    entry, because the ACS entry comes first.
  - The rectal cancer VTE case radiates to **Community-Acquired Pneumonia** through `"cap"` in
    "**Cap**rini".
  - There are no entries for DKA, delirium, malignant hyperthermia, anastomotic leak, ileus or
    urinary retention.

  The result depends on the exact wording the surgeon types, but the mechanism is systematic.
  The HPB cluster reported the same for "Mirizzi". **Fix:** whole-word keyword matching, and
  entries for the missing post-operative diagnoses.
- **Risk snapshot (`VisitRiskAssessment`).**
  - It flags clopidogrel, ticagrelor and prasugrel with the anticoagulants ("hold/bridge plan" on
    the procedure pathway), but **not aspirin**.
  - It lists empagliflozin and dapagliflozin only inside a generic "Diabetes — peri-procedure
    medication plan" flag, with no SGLT2-specific ketoacidosis warning.
  - STOP-Bang, CFS, RCRI and Caprini appear only when a score is already stored.
  - Expect the anticoagulant and allergy flags to pass (allergy banner for latex and penicillin),
    and the MH, suxamethonium, steroid and SGLT2 checks to fail as on web.
- **Emergency level.** `ClinicalPathwayEngine` reads CC keywords only. Ward complaints such as
  "Low urine output after bowel operation", "Confused and drowsy after operation" and "Sudden
  collapse and breathlessness on the ward" are predicted to be routine, so the critical
  `level-*` checks on the leak, PE, pneumonia, NELA, DKA and SSI cases are likely to fail on iOS.
- **Pathway.** The six `wardReview` pathway checks should pass (inpatient setting), as in the PE
  seed.

## Harness limits (no change made)

- **CDS pre-operative triggers.** ASA, Caprini, P-POSSUM, STOP-Bang, MUST, Apfel and CFS read
  `procedureData.preop` (the Perioperative tab), and the harness passes `procedureData: {}`. A
  missing *score suggestion* may therefore pass in the app once that tab is used; each affected
  expectation is `quality` and says so. No harness sets a pre-operative flag, and no calculator
  for these scores is mirrored (`scoreForms` exist only for Alvarado, AIR, TG18, qSOFA and SIRS),
  so ASA, RCRI, Caprini and STOP-Bang *values* are not graded.
- **Encounter type.** `web-runner.ts` maps every non-emergency setting to `surgical_consult`, so
  inpatient ward reviews also receive the pre-operative bloods prompt (`preop_haem`). The real
  dashboard may use a different encounter type on the ward.
- **Plan-line tests.** Prompt actions with `addToPlan` are graded as management. Two tests the
  prompts deliver as plan lines (the pre-operative ECG and the AKI urine dipstick) are therefore
  written as `management` expectations, with a note.
- **Pregnancy and gestation.** Web receives `pregnancyPossible` only; gestation (29 weeks) is
  visible only in text.
- **`unless` scope.** `unless` applies to the whole output item. The operative templates are single
  long items, so exclusions use phrase-level regexes. For example, "avoid heavy lifting" would
  otherwise excuse a penicillin line. A dose inside a regex window (`1.2g`) needs `[^;\n]`, not
  `[^.;\n]`.

## Decisions for the surgeon

1. **Bridging policy.** Confirm the practice policy that should replace "warfarin — bridge with
   LMWH per haematology protocol". The proposal follows ACCP 2022 and BRIDGE: bridge only for
   mechanical mitral (or older-generation aortic) valves, VTE within 3 months, or stroke/TIA within
   3 months. Otherwise stop 5 days before without bridging. Also confirm the DOAC interruption
   intervals (PAUSE: 1 day low/moderate, 2 days high bleeding risk; longer for dabigatran with
   CrCl <50).
2. **Endoscopy table.** Adopt the BSG/ESGE 2021 low- versus high-risk procedure table for the
   endoscopy list (ERCP with sphincterotomy, polypectomy >1 cm and EMR are high risk; diagnostic
   ± biopsy is low risk). Decide whether warfarin continues for low-risk procedures, as the
   guideline recommends.
3. **Recent stents.** Decide on a hard stop for elective surgery or endoscopic resection within
   6 months of elective PCI or 12 months of ACS, unless cardiology agrees in writing.
4. **SGLT2 wording.** Choose one SGLT2-inhibitor rule: CPOC 2022 (omit the day before and the day
   of surgery, check ketones) or the FDA label (3 days; 4 for ertugliflozin). Any patient-facing
   version must pass `lint:patient-instructions`; this is your decision under hazard H-10.
5. **Anaesthetic alerts.** Which alerts should block booking or theatre listing (MH
   susceptibility, suxamethonium apnoea, latex, difficult airway, STOP-Bang ≥5), and who must
   acknowledge them?
6. **Antibiotic prophylaxis.** Keep or remove "co-amoxiclav 1.2 g at induction" in the low-risk
   lap chole template (SIGN 104 does not recommend it). Choose the penicillin-allergy alternatives
   for the colorectal, hernia-with-mesh and biliary procedures.
7. **VTE.** Should every operative plan carry a VTE line (LMWH + mechanical, 28 days after major
   abdominal/pelvic cancer surgery per NICE NG89)? Which renal threshold switches enoxaparin to
   UFH or a reduced dose?
8. **Post-operative triage.** Should a post-operative ward review's emergency level come from
   NEWS2 (RCP 2017: ≥7 emergency, 5–6 urgent) rather than from free-text keywords?
9. **Frail emergency laparotomy.** Adopt NELA standards as prompts: a documented risk score,
   consultant presence and critical care when predicted mortality is ≥5%, and elderly-medicine
   review at age ≥65.
10. **Citations.** Please verify each citation (all `verified: false`) and sign off the vignettes
    (`authoring.reviewedBy`).

## Vignettes

| Condition | Files (`ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/`) |
|---|---|
| Pre-operative assessment | `periop-preop-asa1-lap-chole` (base), `-rcri-high-risk-hemicolectomy`, `-recent-acs-des-elective-chole`, `-osa-stopbang`, `-ckd-dialysis-hyperkalaemia`, `-long-term-steroids`, `-mh-susceptible`, `-suxamethonium-apnoea`, `-latex-allergy` |
| Antibiotic prophylaxis / allergy | `periop-abx-penicillin-anaphylaxis-colectomy` (base), `periop-abx-clean-mesh-hernia` |
| Anticoagulation (surgery) | `periop-anticoag-warfarin-af-no-bridging` (base), `-warfarin-mechanical-mitral-bridging`, `-apixaban-ckd-elderly` |
| Antithrombotics (endoscopy) | `periop-endo-polypectomy-clopidogrel` (base), `-diagnostic-ogd-warfarin`, `-ercp-sphincterotomy-apixaban`, `-dapt-recent-stent-polypectomy` |
| Diabetes | `periop-diabetes-sglt2-preop-withhold` (base), `-sglt2-euglycaemic-dka-postop`, `-type1-emergency-surgery` |
| VTE | `periop-vte-caprini-high-cancer-surgery` (base), `periop-vte-high-bleeding-risk-mechanical`, `periop-postop-pe-high-risk-shock` (permutes `pe-postop-day5`) |
| Frailty / emergency laparotomy / pregnancy | `periop-nela-frail-emergency-laparotomy` (base), `periop-frailty-elective-dementia`, `periop-pregnancy-emergency-laparotomy-sbo` |
| Post-operative complications | `periop-postop-fever-day1-early` (base), `-anastomotic-leak-day5`, `-anastomotic-leak-occult-elderly`, `-ssi-superficial`, `-ssi-organ-space-diabetic`; bases `periop-postop-aki-oliguria`, `-urinary-retention`, `-ileus`, `-delirium-hypoactive`, `-pneumonia-news2-escalation` |

### Web results per vignette

| Vignette (`periop-…`) | Pass | Fail | n/a | Critical pass / graded |
|---|---|---|---|---|
| `preop-asa1-lap-chole` | 4 | 4 | 0 | 1/1 |
| `preop-rcri-high-risk-hemicolectomy` | 4 | 4 | 0 | 2/2 |
| `preop-recent-acs-des-elective-chole` | 4 | 3 | 0 | 4/6 |
| `preop-osa-stopbang` | 3 | 2 | 0 | 1/2 |
| `preop-ckd-dialysis-hyperkalaemia` | 5 | 2 | 0 | 3/3 |
| `preop-long-term-steroids` | 2 | 2 | 0 | 2/3 |
| `preop-mh-susceptible` | 1 | 4 | 0 | 1/3 |
| `preop-suxamethonium-apnoea` | 2 | 2 | 0 | 1/3 |
| `preop-latex-allergy` | 2 | 2 | 0 | 2/3 |
| `abx-penicillin-anaphylaxis-colectomy` | 1 | 5 | 0 | 1/3 |
| `abx-clean-mesh-hernia` | 4 | 2 | 0 | 1/1 |
| `anticoag-warfarin-af-no-bridging` | 4 | 3 | 0 | 3/5 |
| `anticoag-warfarin-mechanical-mitral-bridging` | 6 | 1 | 0 | 5/5 |
| `anticoag-apixaban-ckd-elderly` | 5 | 2 | 0 | 4/4 |
| `endo-polypectomy-clopidogrel` | 3 | 2 | 0 | 2/3 |
| `endo-diagnostic-ogd-warfarin` | 3 | 3 | 0 | 1/3 |
| `endo-ercp-sphincterotomy-apixaban` | 4 | 2 | 0 | 4/4 |
| `endo-dapt-recent-stent-polypectomy` | 4 | 2 | 0 | 4/5 |
| `diabetes-sglt2-preop-withhold` | 3 | 4 | 0 | 1/2 |
| `diabetes-sglt2-euglycaemic-dka-postop` | 2 | 7 | 0 | 2/7 |
| `diabetes-type1-emergency-surgery` | 3 | 3 | 0 | 2/4 |
| `vte-caprini-high-cancer-surgery` | 1 | 3 | 0 | 0/1 |
| `vte-high-bleeding-risk-mechanical` | 2 | 2 | 0 | 2/3 |
| `postop-pe-high-risk-shock` | 8 | 1 | 0 | 6/7 |
| `nela-frail-emergency-laparotomy` | 7 | 7 | 0 | 6/8 |
| `frailty-elective-dementia` | 2 | 5 | 0 | 1/1 |
| `pregnancy-emergency-laparotomy-sbo` | 6 | 4 | 0 | 5/6 |
| `postop-fever-day1-early` | 3 | 5 | 1 | 2/2 |
| `postop-anastomotic-leak-day5` | 7 | 1 | 1 | 5/6 |
| `postop-anastomotic-leak-occult-elderly` | 2 | 4 | 0 | 2/4 |
| `postop-ssi-superficial` | 5 | 1 | 0 | 3/3 |
| `postop-ssi-organ-space-diabetic` | 7 | 2 | 0 | 5/6 |
| `postop-aki-oliguria` | 8 | 1 | 1 | 6/6 |
| `postop-urinary-retention` | 3 | 2 | 1 | 2/2 |
| `postop-ileus` | 8 | 1 | 0 | 1/2 |
| `postop-delirium-hypoactive` | 5 | 4 | 1 | 3/4 |
| `postop-pneumonia-news2-escalation` | 8 | 4 | 1 | 5/6 |

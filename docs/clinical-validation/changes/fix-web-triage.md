# Change log — `fix-web-triage` (web triage, alarms, prompts, CDS and scores)

Owner-authorised "fix all gaps" programme, 2026-09-25. Area: web triage level, alarms, consultation
prompts, CDS suggestions and scores (SURGEON-DECISIONS **C1–C3, C8, E2–E3, G1.3, G3**, and the
**G2** items that live in prompts or alarms). The branch was rebased onto
`origin/claude/pr-37-gbg22z` (screening fixes) and keeps its single `computePreventivePrompts` call
site in `clinical-inference.ts`.

The surgeon still needs to check every citation below. Nothing here orders, prescribes or
diagnoses. Every first action is a suggestion the clinician confirms. The emergency redirect only
tells the clinician (and the front desk script) to send the patient on. The code is deterministic:
no AI and no network calls. Text is read with the negation-aware, whole-word matcher
(`lib/triage-engine/src/negation.ts`).

## Results (`pnpm --filter @workspace/scripts run clinval:web`, 397 vignettes, 3087 expectations)

| | Pass | Fail | Critical fail | Quality fail | Blocking |
|---|---|---|---|---|---|
| Original base (`72e083a`) | 1882 | 1113 | 546 | 567 | 0 |
| After the rebase onto the screening fixes (`64765f4`) | 1938 | 1057 | 533 | 524 | 0 |
| After this branch | **2416** | **579** | **213** | **366** | **0** |

Compared with `64765f4`, **480 expectations went from fail to pass: 320 critical and 160 quality.**
By kind:

| Kind | Count |
|---|---|
| management | 264 |
| investigation | 83 |
| level | 48 |
| red flag | 45 |
| alarm | 28 |
| score | 5 |
| other | 7 |

Every triage-level (`level-*`) expectation now passes. Their `knownGap: ["web"]` flags were removed
(480 in total), with `knownGapNote`/`proposedFix` removed too when no other platform was left. Where
`ios` is still listed, only `web` was taken out. The 131 "flags to remove" that were already listed
on the base run belong to other areas and were left alone. No expectation was weakened or deleted.

**Two quality expectations went from pass to fail.** Both passed before only because the bowel
obstruction operative template fired on examination signs alone. That template is now gated on the
working diagnosis (fix item 5):

- `ami-infarction-septic-shock/mgmt-second-look` (quality). The "second-look laparotomy" line came
  from the obstruction template on a mesenteric-ischaemia case. The right home for it is the
  mesenteric ischaemia protocol, which is in the protocols area.
- `appendicitis-elderly-atypical/inv-lactate-or-cta` (quality). The lactate came from the same
  template. The appendicitis protocol should carry it for the elderly atypical presentation, which is
  in the protocols area.

The remaining 213 critical fails:

| Group | Count | Owner |
|---|---|---|
| Differential (`mnm-*`, `dx-*`) | 145 | PANE area |
| `web.plan`, `web.protocol.medications` or `web.managementPanel` | 64 | Protocols and plans area; see "Hooks needed in other areas" |
| TG18 auto-fill scores | 2 | See "Not done" |

## Engine behaviour changes

1. **New module `lib/triage-engine/src/emergency-recognition.ts`** (`EMERGENCY_RULES_VERSION =
   '1.0.0'`), exported from `@workspace/triage-engine` and registered as `emergency-recognition` in
   `clinical-content/registry.json`.
   - `assessEmergencies(input)` returns:
     - `emergencies` (id, title, level, reasons, guideline, suggested first actions, redirect flag);
     - `safeguarding` flags;
     - `riskModifiers`;
     - the labs it read, NEWS2, `ageYears`, `paediatric`, `pregnancy`;
     - the highest level.
   - Its inputs:
     - history and chief complaint;
     - examination text;
     - investigation results and radiology reports (`extractTriageLabs`: K, Na, glucose, ketones, pH,
       bicarbonate, adjusted calcium, troponin, lactate, Hb (g/L converted), platelets, creatinine,
       osmolality, WBC, neutrophils, ALT/AST, INR, triglycerides (mg/dL converted), urine protein,
       pregnancy test);
     - vital signs (AVPU and supplemental O₂ included);
     - past medical, surgical and drug history;
     - the confirmed diagnosis text and ICD-10 codes.
   - The age is refined from text such as "6-week-old".
   - Pregnancy and postpartum weeks come from the text only. The "pregnancy possible" tick is not
     read as a pregnancy.
   - `EMERGENCY_REDIRECT`: "Call 911 or go to the nearest emergency department now (OKEU Hospital,
     St Jude's Hospital or Tapion Hospital)." Victoria Hospital is not named.
2. **`adaptiveTriage` (`lib/triage-engine/src/adaptive-triage.ts`)**
   - **The level is now the maximum of** the text rules, vital signs, NEWS2, the blood-pressure rules
     (pregnancy ≥ 160/110 is an emergency, NICE NG133), critical labs, ECG findings and the confirmed
     diagnosis (ICD prefix table, `diagnosisLevel`). The floor only raises the level, never lowers
     it. Recognised emergencies, safeguarding flags and risk modifiers are added as 0-point reasons,
     so they do not inflate the numeric score.
   - NEWS2 (unchanged engine, `news2.ts`) is scored for age ≥ 16 when not pregnant:
     - band high → emergency;
     - band medium or low-medium (a single red score) → urgent.
   - New optional inputs: `examText`, `investigationResults`, `resultReports`,
     `diagnosis {text, icd10}`, `avpu`, `onSupplementalO2`. New outputs: `recognisedEmergencies`,
     `safeguardingFlags`, `riskModifiers`, `news2`, `emergencyRedirect`. `safetyMessage` and the
     front-desk script use `EMERGENCY_REDIRECT`.
   - Vital-sign red flags use **paediatric limits under 16** (`paediatricVitalLimits`). The adult
     thresholds apply from 16 only.
   - Breathlessness is graded by physiology (RR, SpO₂, HR, speech) instead of by the word alone.
   - Fever counts only from a recorded temperature ≥ 38.0 °C, or text that reports one
     (`textReportsFever`).
   - The symptom text no longer includes the past surgical history, so "left arm" or "radiating to"
     in an old operation note does not raise a cardiac flag.
   - `screenForCancer` now receives `freeText` and `labs: readCancerScreenLabs(...)`, so a positive
     FIT or iron-deficiency anaemia raises the level (the hand-off from `fix-web-screening`).
   - Wired in `AppContext.tsx` (`triageInput`) and mirrored in `scripts/src/clinval/web-runner.ts`.
3. **`rules.ts` (`RULES_VERSION` 1.2.0 → 1.3.0)**
   - The cardiac red flag is narrowed to chest pain radiating to the arm, jaw or neck, and crushing or
     pressure pain. Plain chest pain gets a new priority flag, "Chest pain — 12-lead ECG to exclude a
     cardiac cause".
   - "Breathless" / "shortness of breath" was removed from "Post-operative concern".
   - "Cancer" no longer flags when it refers to a relative's history or a screening/risk request.
   - "No change in bowel habit" no longer flags.
   - The chest pain pathway trigger is narrowed. Its checklist uses the ESC 2023 0 h/1 h troponin
     algorithm and aspirin 150–300 mg (ESC 2023).
4. **`computeClinicalPrompts` (`artifacts/dashboard/src/lib/clinical-inference.ts`)**
   - New optional inputs: `historyText`, `surgicalHistory`, `allergies`, `icdCodes`, `isPostOp`,
     `postOpDays`, `examOther`. They are passed by `ClinicalPromptsStrip.tsx` and mirrored in the
     harness.
   - It calls `assessEmergencies` and shows each recognised emergency as a safety prompt
     `emergency_<id>`, with the redirect first, and each safeguarding flag as `safeguarding_<id>`.
   - Where the emergency layer already covers something, the generic prompts step back:
     - hypertensive urgency when pre-eclampsia or a hypertensive emergency is recognised;
     - hyperglycaemia when DKA/HHS is recognised.
   - **Operative templates fire only when the working diagnosis supports them** (fix item 5). The
     working diagnosis is the lead clause of the assessment (`diagnosisHead`) plus the ICD codes.
     - Gated templates: cholecystectomy, appendicectomy, hernia repair, bowel obstruction,
       thyroidectomy, breast WLE.
     - Examination-sign prompts are gated the same way: Murphy, appendicitis signs, peritonism.
     - An obstetric emergency suppresses the cholecystectomy and appendicectomy templates.
   - The adult sepsis, shock, hypoxia and tachycardia prompts are skipped under 16; paediatric limits
     apply instead.
   - Post-processing:
     - no NSAIDs in pregnancy;
     - "β-HCG confirmed negative" becomes "β-HCG: result required";
     - a penicillin-allergy annotation is added to penicillin-containing lines;
     - under 16, adult fixed doses become "[weight-based dose — calculate per BNFc]". Emergency and
       safeguarding prompts are exempt; they already carry weight- or age-banded doses.
   - `hasDiabetes` no longer reads "previous gestational diabetes", pre-diabetes or a relative's
     diabetes as diabetes.
5. **Scores and CDS**
   - `clinical-scores.ts`:
     - TG18 cholecystitis Grade II reads palpable tender mass, duration > 72 h and marked local
       inflammation (C8), besides WBC > 18;
     - TG18 cholangitis Grade II adds the WBC > 12 or < 4 criterion and needs two criteria.
   - `clinical-scales.ts`: `tg18CholangitisGrade` needs two criteria, and `fever` means ≥ 39 °C (the
     ScalesTab label was changed to match). `interpretAbcd2` states it is not for triage.
   - `clinical-cds.ts`: the ABCD2 suggestion was removed (NICE NG128).
   - `ClinicalScoresPanel.tsx`: the TG18 cholecystitis Grade II toggles were added.
6. **`lab-reader-keywords.ts`**: the ferritin, MCV and FIT readers were added (screening hand-off).
7. **Unchanged:** `apcq.ts`, `pathways.ts`, `pathway-matcher.ts`, `safety-engine.ts`, and NEWS2
   scoring (`news2.ts`, twinned with iOS).

## Clinical content changes (before → after, guideline)

### Triage level and emergency recognition (C1, G1.1, G1.3)

| Item | Before | After | Guideline |
|---|---|---|---|
| Level source | Text rules and a points score | Maximum of text, vitals / NEWS2, BP, critical labs, ECG and the confirmed diagnosis | — |
| Emergency redirect | "Advise urgent emergency assessment / Tapion contact" | 911 and OKEU, St Jude's or Tapion Hospital | — |
| NEWS2 | Not used by triage | High → emergency; medium or a single red score → urgent (age ≥ 16, not pregnant) | RCP NEWS2 2017 |
| Pregnancy BP | Not recognised | ≥ 160/110 → emergency; pre-eclampsia, HELLP, eclampsia: magnesium sulfate, labetalol / nifedipine / hydralazine, CTG | NICE NG133 (2019, updated 2023) |
| Severe hypertension | Prompt at SBP ≥ 180 (IV labetalol 20 mg / GTN line "if hypertensive emergency"); no triage level | ≥ 180/120 with acute organ damage → emergency: IV labetalol / nicardipine / GTN, lower MAP by 20–25% in the first hour. Without organ damage → priority. | ESH 2023; NICE NG136 |
| ACS | "Radiating to" / "left arm" anywhere | Typical features, ECG ischaemia or troponin ≥ 52 ng/L (or "raised") → emergency; ECG within 10 min, hs-troponin 0 h/1 h; aspirin 150–300 mg suggested unless allergic or bleeding | ESC 2023 ACS |
| Plain chest pain | Cardiac flag | Priority: 12-lead ECG | ESC 2023 |
| Aortic dissection, AAA | Not recognised | Tearing chest/back pain, pulse or BP differential; AAA with pain or hypotension → vascular, permissive hypotension | ESC 2014; ESVS 2024 |
| PE | Not recognised | Recognised → emergency or urgent by physiology | ESC 2019 |
| Stroke / TIA | ABCD2 suggested | Stroke → emergency, check glucose first, note anticoagulants. TIA → aspirin 300 mg and specialist within 24 h; ABCD2 not used. | NICE NG128 (2019/2022) |
| SAH | Not recognised | Thunderclap headache → emergency, CT head, LP if CT negative after 6 h | NICE NG228 (2023) |
| Meningitis | Not recognised | Ceftriaxone; add amoxicillin at age ≥ 60 or if immunocompromised; pre-hospital benzylpenicillin | NICE NG240 (2024) |
| Cauda equina, MSCC | Not recognised | Emergency MRI; MSCC: dexamethasone, MRI within 24 h | GIRFT 2023; NICE NG234 (2023) |
| Sepsis | Needed a fever | NEWS2, lactate, hypotension, altered mental state with or without fever; neutropenic and asplenic variants | NICE NG51 (2024) |
| AF | Tachycardia prompt | Unstable → emergency (synchronised cardioversion); rapid or newly detected → urgent (rate control, CHA₂DS₂-VA, anticoagulation) | ESC 2024 AF |
| Anaphylaxis | Read as shock | Emergency; IM adrenaline 1 mg/mL: 500 µg adult / ≥ 12 y, 300 µg 6–12 y, 150 µg < 6 y, repeat after 5 min. A past reaction is not read as current. | RCUK 2021 |
| DKA / HHS / hypoglycaemia | Hyperglycaemia prompt | DKA: FRIII 0.1 units/kg/h, add 10% glucose when glucose < 14, stop SGLT2i; euglycaemic DKA check on SGLT2i. HHS: 0.9% saline first, insulin 0.05 units/kg/h only once glucose stops falling. Hypoglycaemia treated. | JBDS 2023 / 2022 / 2021 |
| Hyperkalaemia | Calcium gluconate 10% 10 mL | K ≥ 6.5 or ECG changes → emergency; 6.0–6.4 → urgent. Calcium gluconate 10% 30 mL; insulin 10 units with 25 g glucose. | UKKA 2023 |
| Calcium | Not recognised | Adjusted Ca ≥ 3.0 → urgent; ≥ 3.5 or symptomatic → emergency. Ca < 1.9, or < 2.1 after thyroid/parathyroid surgery, or tetany → hypocalcaemia. | Society for Endocrinology 2016 |
| Hyponatraemia | 3% saline 1–2 mL/kg/h for any Na < 125, no volume assessment | Na < 125, or < 130 with severe symptoms. Assess volume status first; 150 mL 3% saline for severe symptoms; stop hypotonic fluids and thiazides. | European guideline 2014 |
| Critical labs / lactate | Not read | Lactate ≥ 4 or pH < 7.2 → emergency; lactate 2–3.9 → urgent | NICE NG51 |
| Asthma, acute HF | Breathless words | Graded by physiology; acute severe or life-threatening asthma → emergency | BTS/SIGN 158; ESC 2021 HF |
| Gynae / urology / obstetric | Not recognised | Ectopic, ovarian torsion, abruption and trauma in pregnancy, testicular torsion (hernia excluded), infected obstructed or solitary kidney | NICE NG126; RCOG; EAU 2024 |
| Visible haematuria | Not recognised | Age ≥ 45 → priority suspected-cancer pathway | NICE NG12 |
| Paediatric | Adult thresholds | Febrile infant / NG143 red features, bilious vomiting, intussusception, pyloric stenosis | NICE NG143; NICE NG51 |
| Surgical | Mostly keyword-based | Peritonitis / free air, mesenteric ischaemia, acute limb ischaemia, NSTI ("a low LRINEC score does not exclude NSTI"), complete dysphagia, airway (neck haematoma after thyroid surgery: SCOOP; rapid enlargement → core biopsy), aorto-enteric fistula, pulsatile groin mass, umbilical hernia with ascites, compressive goitre, urinary retention / obstructive AKI, superficial vein thrombosis near the SFJ | ESVS 2017 / 2020; WSES; NICE NG217 |
| Trauma, head injury, burns | Not recognised | Penetrating trauma; head injury (CT criteria); burns (TBSA, chemical burns: irrigate with water only) | ATLS 10; NICE NG232 (2023); National Burn Care referral guidance 2012 |
| Other | Not recognised | First seizure; hyperemesis (thiamine, potassium, VTE); hypertriglyceridaemia ≥ 11.3 mmol/L; post-operative delirium | NICE CG137; RCOG GTG 69; ACG 2024; NICE CG103 |
| Paediatric vitals | Adult thresholds at every age | HR / RR / SBP / SpO₂ bands < 1, 1–2, 3–4, 5–11, 12–15 y | NICE NG51, NG143; AHA PALS 2020 |

### Safeguarding (C3)

| Item | Before | After | Guideline |
|---|---|---|---|
| Child | Nothing | Flag for non-mobile bruising, patterned bruises, immersion scald or an inconsistent history. Level urgent. Text: "follow the practice's safeguarding procedure". No contacts are invented. | NICE CG89 |
| Domestic abuse | Nothing | Flag with the same wording | NICE PH50 |

### Keyword fixes and prompts (E2–E3, G2, G3)

| Item | Before | After | Guideline |
|---|---|---|---|
| Dilated CBD | Any radiology entry containing "dilated", "CBD" or "common bile duct" | Measured diameter > 6 mm (> 8 mm after cholecystectomy) or explicit "dilated CBD"; ERCP only if obstruction is confirmed | TG18; ACG 2024; ASGE 2019 |
| Fever | Word "fever" | Temperature ≥ 38.0 °C recorded or reported | NICE NG51 |
| Anaesthetic hazards | Not shown | Pre-operative alert for: malignant hyperthermia (TIVA, no volatile agents or suxamethonium), suxamethonium apnoea, latex, difficult airway, OSA, steroid cover (hydrocortisone), SGLT2i withheld, T1DM basal insulin continued | AAGBI; CPOC 2021 |
| Tetanus | Not shown | Tetanus-prone wound prompt: check immunisation status; immunoglobulin for high-risk wounds | UKHSA Green Book ch. 30 |
| Asplenia | Not shown | Post-splenectomy vaccination prompt. The Green Book schedule is referenced; no schedule is invented. | UKHSA Green Book ch. 7 |
| TG18 cholecystitis | Grade II only from WBC > 18 | Plus palpable tender mass, > 72 h, gangrenous / emphysematous / abscess | TG18 (Yokoe 2018) |
| TG18 cholangitis | Grade II from one criterion; fever ≥ 38 | Any two criteria; WBC criterion added; fever ≥ 39 | TG18 (Kiriyama 2018) |
| ABCD2 | Suggested for TIA | Removed | NICE NG128 |
| COPD oxygen | Plan line "titrate to SpO₂ ≥ 94%" for every patient (88–92% only in the button text) | Target 88–92% in COPD / hypercapnic risk | BTS 2017 |
| Shock prompt | Hartmann's 1 L bolus first | Consider anaphylaxis and AAA first; no fluid bolus when heart-failure signs or PE are recorded | RCUK 2021; ESVS 2024; ESC 2021 |
| Pancreatitis | "Aggressive IV fluid resuscitation (Hartmann's 250–500 mL/h)" | Moderate goal-directed fluid (WATERFALL 2022 / ACG 2024), cautious with heart failure; cholecystectomy timing when collections are present; stop a causative drug | ACG 2024; IAP/APA 2013 |
| Pancreatitis leucocytosis | "Sepsis-6 … antibiotics" | No prophylactic antibiotics without documented infection; blood cultures if infection is suspected | ACG 2024; IAP/APA 2013 |
| Anticoagulants | "Reverse anticoagulation if on warfarin/DOAC (vitamin K + PCC)"; INR > 3 → IV vitamin K 10 mg + PCC even without bleeding | Active bleeding → withhold with drug-specific reversal. Elective procedure: warfarin stopped 5 days before; DOAC per procedure bleeding risk and renal function; no LMWH bridging for AF; mechanical valve → LMWH or IV heparin bridging. INR on warfarin without bleeding → no reversal. | BSG/ESGE 2021; ACCP 2022; PAUSE 2019 |
| Antiplatelet with a stent | Not shown | Stent window (6 months elective PCI, 12 months ACS) before a P2Y12 inhibitor is stopped; discuss with cardiology | ESC/ESAIC 2022; BSG/ESGE 2021 |
| Unstable lower GI bleed | Colonoscopy | CT angiography first | BSG 2019 |
| Hernia | "Tender" meant incarcerated; reduction offered | Strangulation suspected → "Do not attempt manual reduction". No strangulation signs → gentle reduction. Paediatric hernia → paediatric surgery, no mesh. | EHS 2018 / HerniaSurge 2018 |
| Thyroidectomy template | Any thyroid nodule | Bethesda V/VI, confirmed malignancy or compressive goitre only | BTA 2014; ATA 2015 |
| Breast | WLE template on any lump | Inflammatory breast cancer prompt (no breast-conserving surgery or SLNB); lump → USS and core biopsy as investigations | NCCN |
| Other new prompts | — | Obstetric handover in pregnancy, urine culture, stool culture, diabetic foot X-ray, alcohol → thiamine, VTE prophylaxis | NICE NG89; NICE CG100 |

## Hooks needed in other areas (not changed here)

These critical expectations still fail, and their source is not in this area.

- **Protocols and plans (`web.plan`, `web.protocol.medications`, `web.managementPanel`):**
  - tranexamic acid in upper GI bleeding (7 vignettes; HALT-IT);
  - "aggressive IV fluid resuscitation" in 8 pancreatitis vignettes;
  - adult fixed doses in paediatric plans (4);
  - DOAC or warfarin in pregnancy (2);
  - penicillins with a penicillin anaphylaxis (3);
  - lateral sphincterotomy and fissure plans in fistula / HIV cases;
  - unconditional ERCP;
  - SEMS with impending perforation;
  - a trial of non-operative management with strangulation;
  - liberal transfusion in varices;
  - terlipressin in lower GI bleeding;
  - heparin in angiodysplasia;
  - unqualified alteplase;
  - methotrexate work-up in ruptured ectopic;
  - an NSAID with a solitary kidney on anticoagulation;
  - colonoscopy in toxic megacolon;
  - the tension pneumothorax needle site;
  - breast-conserving surgery in inflammatory cancer;
  - watchful waiting and adult mesh repair in an infant hernia;
  - reassurance only for bloody single-duct discharge.
  The missing content includes C. difficile, CMV colitis, Crohn's abscess / seton, fistulotomy,
  volvulus decompression / resection, organ-space SSI drainage, mechanical VTE prophylaxis, EoE
  biopsies, anal EUA / biopsy, core biopsy in rapid thyroid enlargement, groin node USS / biopsy, MRI
  after an inconclusive USS in pregnancy, and endoscopy within 12 h for varices.
- **Differential (PANE):** 145 `mnm-*` / `dx-*` critical fails.
- **Harness note:** the two pass → fail quality expectations above need the second-look and lactate /
  CTA lines in the mesenteric ischaemia and appendicitis protocols.

## Not done

- **TG18 auto-fill** (`cholangitis-tg18-grade3-reynolds/score-tg18-autofill`,
  `cholecystitis-tg18-grade3-organ-dysfunction/score-tg18-autofill`): the auto-filled calculator
  returns "criteria not met for diagnosis" because the auto-fill does not read the diagnostic A/B/C
  criteria from the record. Wiring that is a larger change to the score auto-population and was left
  for a follow-up.
- **iOS**: none of the triage, emergency or prompt changes has a Swift twin. The iOS side
  (`TriageEngine`, consultation prompts) needs the same layer.

## Needs sign-off

1. **Local safeguarding contacts**: the practice must supply its local safeguarding and
   domestic-abuse contacts. The flags say only "follow the practice's safeguarding procedure".
2. **Dilated CBD threshold**: > 6 mm, or > 8 mm after cholecystectomy, with no age adjustment. Some
   sources allow roughly 1 mm per decade over 60.
3. **NEWS2 mapping**: a single red score (low-medium band) → urgent (same-day call), not priority.
4. **Troponin rule-in 52 ng/L**: ESC 2023 value for hs-cTnT. It depends on the assay; the practice
   laboratory's assay and cut-off need confirming.
5. **Postpartum timing**: when the text says "postpartum" without a number of weeks, ≤ 6 weeks is
   assumed. This affects pre-eclampsia, VTE and β-HCG prompts.
6. **Scrotal pain**: acute scrotal pain is always an emergency (torsion until proven otherwise). This
   over-triages epididymo-orchitis.
7. **Acute pelvic pain** in a woman of reproductive age with a positive or unknown pregnancy test →
   emergency (ectopic).
8. **Adrenaline stock (G1.2)**: the anaphylaxis prompt assumes IM adrenaline 1 mg/mL is available in
   clinic.
9. **Aspirin in suspected ACS**: 150–300 mg suggested (ESC 2023), unless allergic or bleeding. It is
   never auto-applied.
10. **Sepsis**: moderate-risk criteria → urgent (same-day call); high-risk → emergency.
11. **Hyperkalaemia 6.0–6.4 mmol/L** without ECG changes → urgent, not emergency.
12. **Calcium thresholds**:
    - hypercalcaemia ≥ 3.0 → urgent; ≥ 3.5 or symptomatic → emergency;
    - hypocalcaemia < 1.9, or < 2.1 after neck surgery or with tetany.
13. **Paediatric vital bands**: HR / RR from NICE NG51 / NG143; SBP from PALS (70 + 2 × age). The bands
    are a combination of sources, not one table.
14. **P2Y12 stopping times** are left to BSG/ESGE 2021 and cardiology. No day count is stated beyond
    the stent window.
15. **G1.x scope**: the redirect layer covers medical, obstetric, paediatric, neurological and
    trauma emergencies, besides surgical ones. The list of what the practice wants recognised needs
    confirming.
16. **Confirmed-diagnosis levels**: the ICD-10 prefix → level table (`DX_LEVELS`). For example,
    appendicitis and anorectal abscess → urgent; ACS, stroke, perforation and gangrenous hernia →
    emergency.
17. **Leucocytosis in pancreatitis**: the antibiotic lines are suppressed unless an infection is
    documented (cholangitis, infected necrosis, pneumonia, UTI, bacteraemia).

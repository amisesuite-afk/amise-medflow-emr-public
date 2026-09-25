# Acute medicine cluster: findings

This cluster covers acute medical conditions that an outpatient surgical clinic must recognise
and send on. The clinic is not an emergency department, so for most of these conditions the
correct output is recognition, the first safe actions, and a redirect to 911 / the ED. This
cluster adds 37 new vignettes. Each is compared with a current guideline.

- **Base:** branch `clinval-acutemed`, from `claude/pr-37-gbg22z` at b63c935. No engine code,
  clinical data, threshold or wording was changed.
- **Web:** `pnpm --filter @workspace/scripts run clinval:web`, run on 2026-09-25. These results
  are exact.
- **iOS:** not run. This machine is Linux and XCTest cannot run here. Every expectation that
  applies to iOS carries `unverified: ["ios"]`. The iOS section below gives **predictions from
  reading the code** and from the existing `results/ios-latest.jsonl`. They are not
  observations. Triage them after the next CI run.
- **Citations:** every citation is `verified: false`. The surgeon must check the section
  numbering and wording against the source. NICE NG250 (pneumonia, 2025) is cited as the current
  NICE pneumonia guideline; its exact recommendation numbering needs checking.
- **Thresholds:** no threshold was invented. Numbers appear only where the cited guideline
  states them: CURB65 items, qSOFA items, NEWS2 response bands, BTS/SIGN acute-asthma bands,
  GOLD NIV criteria, RCUK adrenaline doses, NICE NG133 severe hypertension, KDIGO/NICE NG148 AKI
  and JBDS DKA criteria. Where a cut-off could not be tied to a guideline, the expectation is
  `quality` (for example the SpO₂ 94 % / HR 106 alarm in the post-operative PE case).

## Summary (web, the 37 acute-medicine vignettes only)

| | Count |
|---|---|
| Vignettes | 37, with 13 base cases and 24 permutations (list at the end) |
| Expectations | 269: **136 pass, 129 fail, 4 n/a** (the 4 n/a are iOS-only qSOFA calculator/auto-fill values) |
| Critical expectations graded on web | 137: 70 pass, **67 fail** |
| Quality failures | 62 |
| Blocking failures | **0**. Every web failure has `knownGap: ["web"]`, a `knownGapNote` saying what the engine does instead, and a `proposedFix` |
| Schema | All 280 vignettes in the folder pass `vignette.schema.json`, checked with a draft 2020-12 validator (Python `jsonschema`). `pnpm --filter @workspace/scripts run test` passes (7/7) |

Critical failures by kind:

| Kind | Critical fails |
|---|---|
| Missed differential | 27 (20 must-not-miss, 7 top-3) |
| Missing investigation | 13 |
| Missing management | 11 |
| Harmful / wrong management present | 9 |
| Missing alarm | 7 |

**Emergency level.** The web level was `emergency` in 35 of the 37 vignettes. The two
exceptions were the DVT case (`urgent`) and moderate asthma in pregnancy (`priority`). All 27
critical emergency-level expectations passed. All 6 over-triage controls failed (`quality`,
`atMost`): CURB65 0 pneumonia, mild COPD, vasovagal faint, asymptomatic pre-op hypertension, AF
found at pre-op, and uncomplicated cellulitis. Many correct emergency grades came from the wrong
rule (see "Lower-impact but systematic").

### Web results per vignette

| Vignette | Pass | Fail | n/a | Critical pass / graded | Web level | PANE #1 |
|---|---|---|---|---|---|---|
| `acutemed-acs-typical-chest-pain` | 3 | 6 | 0 | 1 / 5 | emergency | Inguinal / Femoral Hernia |
| `acutemed-acs-atypical-diabetic-woman` | 2 | 4 | 0 | 1 / 5 | emergency | Acute Cholecystitis |
| `acutemed-acs-pregnancy-scad` | 2 | 6 | 0 | 2 / 6 | emergency | Acute Cholecystitis |
| `acutemed-pe-ocp-long-haul` | 6 | 1 | 0 | 4 / 4 | emergency | **Pulmonary Embolism** |
| `acutemed-pe-pregnancy-30wk` | 4 | 3 | 0 | 2 / 4 | emergency | Acute Cholecystitis |
| `acutemed-pe-high-risk-shock` | 4 | 5 | 0 | 3 / 5 | emergency | Inguinal / Femoral Hernia |
| `acutemed-pe-post-lap-chole-pleuritic` | 4 | 2 | 0 | 3 / 3 | emergency | Surgical Site Infection |
| `acutemed-pe-elderly-syncope` | 4 | 1 | 0 | 4 / 5 | emergency | Acute Cholecystitis |
| `acutemed-cap-low-severity` | 4 | 5 | 0 | 1 / 2 | emergency | Acute Cholecystitis |
| `acutemed-cap-high-severity-elderly` | 10 | 3 | 2 | 5 / 6 | emergency | Acute Cholecystitis |
| `acutemed-cap-child-rll-abdominal-pain` | 1 | 4 | 0 | 0 / 4 | emergency | Acute Cholecystitis |
| `acutemed-cap-immunosuppressed` | 4 | 3 | 0 | 3 / 4 | emergency | Acute Cholecystitis |
| `acutemed-sepsis-afebrile-elderly-urinary` | 8 | 3 | 2 | 4 / 6 | emergency | Acute Cholecystitis |
| `acutemed-sepsis-neutropenic` | 5 | 2 | 0 | 3 / 4 | emergency | Acute Cholecystitis |
| `acutemed-sepsis-asplenic-opsi` | 5 | 2 | 0 | 3 / 4 | emergency | Acute Cholecystitis |
| `acutemed-af-new-onset-rapid` | 3 | 5 | 0 | 1 / 3 | emergency | Inguinal / Femoral Hernia |
| `acutemed-af-unstable-hypotension` | 3 | 3 | 0 | 2 / 5 | emergency | Acute Cholecystitis |
| `acutemed-af-incidental-preop-elderly` | 0 | 5 | 0 | 0 / 1 | emergency | Acute Cholecystitis |
| `acutemed-ahf-pulmonary-oedema` | 5 | 6 | 0 | 3 / 5 | emergency | Inguinal / Femoral Hernia |
| `acutemed-ahf-bilateral-leg-cellulitis-mimic` | 3 | 3 | 0 | 0 / 1 | emergency | Acute Cholecystitis |
| `acutemed-asthma-acute-severe` | 2 | 5 | 0 | 1 / 3 | emergency | Acute Cholecystitis |
| `acutemed-asthma-life-threatening` | 2 | 4 | 0 | 2 / 4 | emergency | Inguinal / Femoral Hernia |
| `acutemed-asthma-pregnancy-moderate` | 2 | 3 | 0 | 0 / 1 | priority | Acute Cholecystitis |
| `acutemed-copd-hypercapnic-exacerbation` | 5 | 5 | 0 | 2 / 5 | emergency | Inguinal / Femoral Hernia |
| `acutemed-copd-mild-exacerbation-outpatient` | 2 | 3 | 0 | 0 / 0 | emergency | Acute Cholecystitis |
| `acutemed-anaphylaxis-adult-amoxicillin` | 5 | 4 | 0 | 2 / 5 | emergency | Acute Cholecystitis |
| `acutemed-anaphylaxis-child-peanut` | 1 | 4 | 0 | 1 / 4 | emergency | Acute Cholecystitis |
| `acutemed-syncope-exertional-high-risk` | 2 | 3 | 0 | 1 / 3 | emergency | Inguinal / Femoral Hernia |
| `acutemed-syncope-vasovagal-low-risk` | 3 | 2 | 0 | 0 / 0 | emergency | Acute Cholecystitis |
| `acutemed-syncope-complete-heart-block` | 5 | 2 | 0 | 2 / 4 | emergency | Acute Cholecystitis |
| `acutemed-htn-emergency-encephalopathy` | 5 | 5 | 0 | 3 / 4 | emergency | Inguinal / Femoral Hernia |
| `acutemed-htn-severe-asymptomatic-preop` | 3 | 1 | 0 | 0 / 0 | emergency | Acute Cholecystitis |
| `acutemed-htn-pregnancy-preeclampsia-epigastric` | 3 | 6 | 0 | 2 / 8 | emergency | Acute Cholecystitis |
| `acutemed-dvt-labelled-cellulitis` | 6 | 0 | 0 | 2 / 2 | urgent | Inguinal / Femoral Hernia (DVT #2) |
| `acutemed-cellulitis-true-portal-of-entry` | 2 | 2 | 0 | 1 / 2 | emergency | Acute Cholecystitis (cellulitis #2) |
| `acutemed-gastroenteritis-elderly-aki` | 6 | 1 | 0 | 4 / 4 | emergency | Acute Cholecystitis |
| `acutemed-gastroenteritis-mimic-euglycaemic-dka` | 2 | 7 | 0 | 2 / 6 | emergency | Acute Appendicitis |

PANE put a surgical disease first in 36 of 37 vignettes, and 34 of those were acute
cholecystitis (25) or inguinal/femoral hernia (9). The exception is the outpatient PE case,
where the PE PANE questions were answered. The secondary web view, symptom inference
(`web.symptomInference`), ranked the true condition first in 15 of 37. Examples: STEMI, AF, heart
failure (×2), asthma (×2), COPD (×2), pneumonia, PE, cellulitis, gastroenteritis, hypertensive
emergency, neutropenic sepsis and vasovagal syncope. This view is not what drives the
Assessment panel or the Plan.

## Top 10 safety gaps (ranked)

| # | Gap | Evidence (vignettes) | Guideline | Proposed fix (proposal only) |
|---|---|---|---|---|
| 1 | **The primary differential (PANE) has no acute-medical must-not-miss diagnosis.** `lib/pane-engine` has 131 surgical diseases. Of this cluster's conditions it contains only PE, DVT and cellulitis. It has no ACS, pneumonia, sepsis, AF, heart failure, asthma, COPD, anaphylaxis, syncope/arrhythmia, hypertensive emergency, pre-eclampsia, DKA or gastroenteritis. Surgical priors fill the top 3, headed by cholecystitis and inguinal hernia. The PE node reaches the top 3 in only 2 of 6 PE vignettes. Pregnancy, shock and syncope presentations miss it because the "Other / general surgical" CC template and chest/breathlessness chips do not map to `dyspnoea_pe`/`pleuritic_chest_pain`. The Assessment panel then shows the protocol of that wrong top (cholecystitis for pneumonia in a child, appendicitis for DKA). | 27 critical differential failures, one in each of 27 vignettes | ESC 2023 ACS; NICE NG250; NICE NG51; ESC 2024 AF; ESC 2021 HF; SIGN 158; GOLD 2025; RCUK 2021; ESC 2018 syncope; NICE NG133; JBDS 2023 | Either (a) add must-not-miss medical nodes to PANE with protocols whose first line is "redirect to ED/911", or (b) keep PANE surgical and add a **medical red-flag layer** above it. That layer would surface the symptom-inference result when it is urgent (ACS, PE, sepsis, anaphylaxis, AF, HF, asthma/COPD, DKA, hypertensive emergency) as a "consider / redirect" banner. Map chest and breathlessness chips to PANE features in `socrates-to-features.ts`. |
| 2 | **Suspected ACS gets no ECG or troponin order, and no alarm names ACS.** The triage Chest Pain Pathway panel fires in all 3 ACS cases, and its checklist says "ECG within 10 minutes", "Troponin at 0h and 3h" and "Aspirin 300mg". The harness records that panel only by title. Nothing turns the checklist into an investigation or plan action. The only ECG output is "12-lead ECG — pre-operative cardiac baseline (age ≥ 40)", and at 36 years (the SCAD case) there is none. No safety prompt mentions a cardiac cause. The 0 h/3 h troponin sampling in the checklist also differs from ESC 2023 (0 h/1 h or 0 h/2 h). | `acs-typical`, `acs-atypical-diabetic-woman`, `acs-pregnancy-scad`: 3 × (ECG, troponin, cardiac alarm) critical | ESC 2023 ACS §3 | Add an ACS prompt in `clinical-inference.ts` that emits ECG and hs-troponin as `addToInvestigations`, aspirin unless contraindicated, and "999/ED transfer". Trigger it on chest pain/pressure, **or** on dyspnoea, jaw/arm pain, epigastric pain or sweating in a patient ≥50, diabetic or female. Align the checklist to 0 h/1 h. |
| 3 | **Anaphylaxis is never named and adrenaline is never suggested.** Hypotension without fever triggers the "Shock — haemorrhagic / cardiogenic / obstructive" prompt, with a 1 L bolus, crossmatch and POCUS. There is no IM adrenaline, no age-banded dose and no anaphylaxis alarm, for either the adult (amoxicillin) or the 7-year-old (peanut). The amoxicillin allergy does show in the header, and no penicillin was offered. | `anaphylaxis-adult-amoxicillin`, `anaphylaxis-child-peanut`: 6 critical | RCUK 2021 | Add an anaphylaxis rule/prompt: acute urticaria or angioedema plus airway, breathing or circulation compromise after a drug or food leads to emergency, "IM adrenaline 1 mg/mL: 500 micrograms adult/>12 y, 300 micrograms 6–12 y, 150 micrograms <6 y, repeat at 5 min, call 999", oxygen and IV fluid. The shock prompt should list distributive/anaphylactic shock. |
| 4 | **Wrong-procedure outputs in medical mimics.** Examples: (a) A 9-year-old with right lower lobe pneumonia gets "Emergency laparoscopic appendicectomy — consent obtained, theatre booked" (from "no guarding") and a cholecystectomy panel. (b) Euglycaemic DKA gets the appendicitis protocol and an appendicectomy, because "no guarding, no peritonism" fires the generalised-peritonism prompt. (c) HELLP at 35 weeks gets cholecystectomy and appendicectomy plans. (d) Afebrile urosepsis gets "Incarcerated / strangulated hernia" and **"Emergency Theatre"** for a documented *reducible* parastomal hernia: `isIncarcerated` is set by any "tender" in the abdominal exam (here, suprapubic tenderness). | 7 critical `mustExclude` failures in 4 vignettes | BTS children's CAP 2011; JBDS 2023; NICE NG133; NICE NG51 | Use a negation-aware exam matcher (the same as HPB gap 1). Gate operative cascades on the working diagnosis. `isIncarcerated` must require irreducibility or tenderness localised to the hernia, and must respect "reducible". The Assessment panel should follow the locked diagnosis rather than the PANE top. |
| 5 | **Pregnancy-unsafe plans.** (a) PE at 30 weeks, confirmed ICD I26.99: the PE protocol offers **rivaroxaban/apixaban** first-line and "LMWH/warfarin", with no pregnancy caveat. (b) HELLP at 35 weeks: the operative template includes post-operative **ibuprofen 400 mg TDS** with platelets 88. (c) BP 172/114 in pregnancy raises **no hypertension alarm**, because the prompt only fires at SBP ≥180; NICE severe is ≥160/110. Pre-eclampsia is absent everywhere. (d) No obstetric review is suggested in the PE, ACS or HELLP cases. | `pe-pregnancy-30wk`, `htn-pregnancy-preeclampsia-epigastric`, `acs-pregnancy-scad` | ESC 2019 PE §9 (NOACs not recommended); NICE NG133; FDA 2020 NSAID | When `pregnancyPossible` is set: LMWH instead of DOAC/warfarin in the PE and DVT protocols; a BP threshold of 160/110 with a pre-eclampsia/HELLP prompt (labetalol/nifedipine/methyldopa, same-day obstetric admission); strip NSAIDs from operative templates; add an obstetric-review action. |
| 6 | **Uncontrolled oxygen in hypercapnic COPD.** The patient has recorded severe COPD, pH 7.29 and PaCO₂ 8.4 kPa. The hypoxia prompt's plan line is still "Hudson mask 5–10 L/min, titrate to SpO₂ ≥ 94%". The 88–92 % target appears only in the prompt's action caption, not in the plan it writes. NIV and ABG are offered. | `copd-hypercapnic-exacerbation`: 2 critical | BTS O₂ 2017; GOLD 2025 | The hypoxia prompt should read COPD or hypercapnic risk from PMH/labs and write "controlled oxygen via Venturi, target 88–92 %, ABG". |
| 7 | **High-risk PE is not treated as high-risk PE.** (a) Confirmed ICD **I26.09** (PE with acute cor pulmonale) has no `getProtocolByIcd` mapping (I26.9/I26.99 do), and PANE does not rank PE. So there is no thrombolysis and no UFH. (b) The shock prompt offers "Hartmann's 1L bolus", although ESC 2019 advises cautious volume loading because of RV failure. (c) The PE-as-syncope and PE-in-pregnancy cases are missed by PANE (gap 1). | `pe-high-risk-shock` (thrombolysis critical), `pe-elderly-syncope`, `pe-pregnancy-30wk` | ESC 2019 PE §5–6 | Map I26.0x to the PE protocol. In the shock prompt, when PE is suspected (hypoxia plus raised JVP or DVT signs), say "UFH, bedside echo, systemic thrombolysis" and limit the fluid volume. |
| 8 | **Arrhythmias.** (a) Unstable AF (168/min, BP 78/50, confused): no cardioversion anywhere, and AF is not in PANE. (b) New AF at 138/min: ECG, rate control, TFT and anticoagulation are missing. The tachycardia prompt offers "12-lead ECG" only as plan text. (c) AF found at pre-op assessment (CHA2DS2-VA 5): no ECG order, no anticoagulation line, and CHA₂DS₂-VASc is not suggested, because CDS needs AF in the PMH or palpitations. (d) Exertional syncope with a murmur: no cardiac-syncope diagnosis and no echocardiogram. Complete heart block is handled (bradycardia prompt, pacing, hold beta-blocker). | `af-unstable-hypotension` (cardioversion critical), `af-new-onset-rapid`, `af-incidental-preop-elderly`, `syncope-exertional-high-risk` | ESC 2024 AF; ESC 2018 syncope | Add an AF prompt/protocol (AF-CARE): ECG as an investigation, emergency DC cardioversion when unstable, rate control, CHA₂DS₂-VA and DOAC, TFT. The CDS CHA₂DS₂-VASc trigger should also fire on the "Irregular rhythm" exam chip. Add an ESC 2018 syncope risk rule (exertional, no prodrome, murmur, HR <40, SBP <90 give urgent ECG + echo). |
| 9 | **Sepsis and DKA rules keyed on temperature and glucose miss atypical presentations.** (a) The sepsis cascade needs T ≥38 °C. The afebrile 86-year-old (NEWS2 11, qSOFA 3, lactate 3.1) was flagged only because WBC 15.8 fired the leucocytosis prompt, and with a normal WBC nothing would name sepsis. (b) Febrile neutropenia and asplenia (OPSI) are not recognised as special risks (no red flag), although the generic sepsis bundle fires on the fever. (c) Euglycaemic DKA on empagliflozin (glucose 11.8, ketones 5.2, pH 7.12): no ketone check and no DKA alarm, because the hyperglycaemia cascade needs >15 mmol/L. The only insulin line is a *variable*-rate infusion (JBDS: fixed-rate). SGLT2 is not stopped. | `sepsis-afebrile-elderly-urinary`, `sepsis-neutropenic`, `sepsis-asplenic-opsi`, `gastroenteritis-mimic-euglycaemic-dka` (4 critical) | NICE NG51; SSC 2021; NICE CG151; BCSH 2011; JBDS 2023; MHRA 2020 | Base the sepsis prompt on physiology (NEWS2 ≥5 or a qSOFA item with a suspected source), not on fever. Add febrile-neutropenia and asplenia prompts. Check ketones whenever an SGLT2 inhibitor is recorded with vomiting, abdominal pain or Kussmaul breathing, whatever the glucose. |
| 10 | **Acute heart failure: no diuretic, and fluid is offered.** Pulmonary oedema (orthopnoea, crackles to mid-zones, raised JVP, SpO₂ 88 %): no IV loop diuretic, BNP, ECG order or CXR order. The tachycardia prompt offers "IV fluid challenge 500 ml if hypovolaemia likely". The bilateral "leg cellulitis" referral in a woman with HFpEF is not recognised as heart failure by PANE. | `ahf-pulmonary-oedema` (diuretic critical), `ahf-bilateral-leg-cellulitis-mimic` | ESC 2021 HF §11; NICE CG187 | Add a heart-failure protocol (oxygen if SpO₂ <90 %, IV furosemide, NIV, NT-proBNP, ECG/troponin for precipitants). Suppress fluid challenges when heart-failure signs are recorded. |

### Lower-impact but systematic

- **Over-triage and fragile correct triage.** 35 of 37 vignettes were `emergency_now`, including
  all 7 low-risk controls. The causes, all in `rules.ts` `RED_FLAGS` (the same negation problem
  as HPB gap 1):
  - Negated history fires rules. "No chest pain" gives "Possible cardiac event".
    "No haemoptysis" gives "Haemoptysis" (urgent). "No jaundice" gives "Possible biliary
    obstruction" and the Cholangitis pathway panel. "Urine pregnancy test negative" gives
    "Pregnancy mentioned".
  - The words "breathless" / "shortness of breath" are classed as "Post-operative concern"
    (urgent) in every context. For several true emergencies (acute severe asthma, atypical ACS,
    COPD) this is the rule that produced the correct emergency grade. The right answer
    currently depends on the wrong rule.
  - The Chest Pain Pathway panel fires in 14 of 37 vignettes, including vasovagal syncope,
    CURB65 0 pneumonia, pre-op hypertension and pre-op AF, mostly from negated text.
- **ICD mapping.** I26.09 (high-risk PE) and L03.116 (lower-limb cellulitis) have no protocol
  mapping. The confirmed true cellulitis therefore got **no antibiotic anywhere** (critical
  fail), because PANE ranked cholecystitis above cellulitis and the panel follows the PANE top.
- **Investigations as plan text.** Several correct tests are offered only as `addToPlan` text,
  not as investigation orders. Examples: ECG by the tachycardia/shock/bradycardia prompts; CXR
  by the hypoxia and sepsis prompts. These are graded as failed investigations. The notes say
  where this is so, and the fix is to emit them as `addToInvestigations`.
- **Two-level Wells.** The hypoxia and tachycardia prompts still say "CTPA if Wells score ≥ 2
  and D-dimer positive" in a Wells-likely patient (`pe-ocp-long-haul`), as already found by the
  soft-tissue/vascular cluster.
- **Symptom-inference detail weights never fire for chest pain** (incidental, no expectation).
  `symptom-inference.ts` looks up `detailWeights[\`${symptom}.${option}\`]`. The ACS and aortic
  dissection keys are `chest pain.Radiating to arm`, `chest pain.Radiating to jaw`,
  `chest pain.Crushing`, `chest pain.Tearing` and `chest pain.Sudden onset`, but the
  SmartSymptomPicker options are `Left arm`, `Jaw`, `Crushing / pressure` and
  `Tearing / ripping`. These high-value weights are dead code.

## Per condition

### Acute coronary syndrome (3: typical base, older diabetic woman without chest pain, pregnancy/SCAD)

- **Right.**
  - Web triage is emergency in all 3.
  - The Chest Pain Pathway panel (ECG in 10 min, troponin, aspirin, 911) is shown in all 3,
    including the atypical case (from the jaw-pain chip).
  - Symptom inference ranks STEMI first in the typical case.
  - No "β-HCG negative" line appears in the pregnant patient.
- **Wrong.**
  - Gap 1 (no ACS in PANE) and gap 2 (no ECG/troponin order, no cardiac alarm).
  - No aspirin or reperfusion line in any plan.
  - PANE's first choice is inguinal hernia or cholecystitis.
  - The pregnant patient gets no obstetric review.
- **Fix.** Gaps 1 and 2.

### Pulmonary embolism (5: outpatient OCP/flight base, pregnancy 30 weeks, high-risk shock with cancer, after laparoscopic cholecystectomy, elderly presenting as syncope)

- **Right.**
  - The base case passes every critical expectation: PE is PANE #1 (with PE answers), CTPA,
    anticoagulation, hypoxia alarm and Wells PE suggested.
  - After laparoscopic cholecystectomy, PE is at PANE #3 and CTPA is offered.
  - Where the PE protocol is reached (I26.99), ECG and CTPA are investigations.
- **Wrong.**
  - DOACs/warfarin in pregnancy (gap 5).
  - High-risk PE: no thrombolysis or UFH, a 1 L bolus, I26.09 unmapped (gap 7).
  - PANE misses PE in pregnancy, shock and syncope (gap 1).
  - "Post-op follow-up" as the CC template sets `wound_erythema`/`wound_discharge`, so surgical
    site infection is PANE #1 despite healthy port sites.
  - D-dimer gate at Wells ≥2.
- **Fix.** Gaps 5 and 7. Derive wound features from the wound exam, not from the template name.

### Community-acquired pneumonia (4: CURB65 0 base, CURB65 5 septic elderly, child RLL pneumonia presenting as abdominal pain, immunosuppressed)

- **Right.**
  - CURB65 is suggested whenever respiratory chips are present.
  - In the CURB65-5 case the septic-shock bundle fires: blood cultures, meropenem + vancomycin,
    lactate, HDU/ICU, oxygen, qSOFA and NEWS2 suggested.
  - Hypoxia alarms fire.
  - Low severity is not given IV broad-spectrum antibiotics.
- **Wrong.**
  - No pneumonia in PANE (gap 1), so the low-severity case has no plan at all: no amoxicillin,
    no CXR.
  - CURB65 0 is triaged as emergency.
  - The child gets appendicectomy and cholecystectomy plans (gap 4), and no CXR.
  - In the immunosuppressed case the CXR passes only through the peptic-ulcer seed "Erect CXR
    (free air under diaphragm)". There is no immunosuppression flag and no Pneumocystis or
    drug-pneumonitis consideration.
- **Fix.** Gap 1 (pneumonia node/protocol with CRB65/CURB65); gap 4; an immunosuppression
  prompt.

### Sepsis (3: afebrile elderly urinary base, neutropenic on chemotherapy, asplenic OPSI)

- **Right.**
  - Emergency level in all 3.
  - The febrile cases get the hour-1 bundle (blood cultures, piperacillin-tazobactam, fluids).
  - NEWS2 and qSOFA are suggested.
- **Wrong.**
  - No sepsis node in PANE.
  - The afebrile case is detected only through WBC.
  - There is an emergency hernia operation for a reducible parastomal hernia (gap 4).
  - Neutropenia and asplenia are not flagged (gap 9).
- **Fix.** Gap 9, and gap 4 for `isIncarcerated`.

### Atrial fibrillation (3: new AF with rapid ventricular rate base, unstable with hypotension, found at pre-op assessment)

- **Right.**
  - Symptom inference ranks AF first in the base case.
  - CHA₂DS₂-VASc and HAS-BLED are suggested when AF or palpitations plus a risk factor are
    recorded.
  - The tachycardia/shock prompts offer an ECG as plan text.
  - A shock alarm fires in the unstable case.
- **Wrong.**
  - Gap 8.
  - Pre-op AF is triaged as emergency (negation: "No palpitations, chest pain").
  - The CHA₂DS₂-VASc label predates ESC 2024 (CHA₂DS₂-VA, sex removed).
- **Fix.** Gap 8.

### Acute heart failure (2: pulmonary oedema base, HFpEF referred as bilateral leg cellulitis)

- **Right.**
  - Hypoxia alarm.
  - "CPAP/NIV if SpO₂ < 90 %" is in the plan.
  - Symptom inference ranks heart failure first in both.
  - No IV antibiotics were added for the bilateral "cellulitis".
- **Wrong.** Gap 10. Heart failure is absent from PANE.
- **Fix.** Gap 10.

### Asthma (3: acute severe base, life-threatening silent chest, moderate in pregnancy)

- **Right.**
  - Emergency level for severe and life-threatening; priority for moderate in pregnancy.
  - Hypoxia alarm in the life-threatening case.
  - Nothing tells the pregnant patient to withhold steroids.
- **Wrong.**
  - No bronchodilator, steroid, ipratropium, magnesium or critical-care line in any case: there
    is no asthma protocol and PANE has no asthma node.
  - The emergency grade for acute severe asthma came from "breathless", which triage classes
    as a post-operative concern.
- **Fix.** An asthma node/protocol from SIGN 158 (gap 1).

### COPD (2: hypercapnic base, mild outpatient)

- **Right.** ABG, NIV/ITU escalation and a hypoxia alarm (hypercapnic); no IV antibiotics or
  high-flow oxygen in the mild case.
- **Wrong.**
  - Gap 6 (oxygen target).
  - No bronchodilator or steroid.
  - The mild case is triaged as emergency.
- **Fix.** Gap 6; a COPD node/protocol from GOLD 2025.

### Anaphylaxis (2: adult amoxicillin base, child peanut)

- **Right.**
  - Emergency level.
  - Allergy shown in the header.
  - No penicillin in any plan.
- **Wrong.** Gap 3.
- **Fix.** Gap 3.

### Syncope (3: exertional high-risk base, vasovagal low-risk, complete heart block on a beta-blocker)

- **Right.**
  - Heart block: bradycardia alarm, pacing, "hold beta-blockers", atropine.
  - Vasovagal: no CT head and no CTPA.
- **Wrong.**
  - Exertional syncope with a murmur: no cardiac diagnosis and no echo (gap 8).
  - Vasovagal: emergency (over-triage); no ECG.
  - ECG only as plan text in heart block.
- **Fix.** Gap 8 (ESC 2018 risk rule).

### Hypertensive emergency (3: encephalopathy base, asymptomatic pre-op, pre-eclampsia/HELLP mimicking biliary pain)

- **Right.**
  - Encephalopathy (SBP 238): emergency level, hypertension alarm, "IV labetalol 20 mg bolus
    or GTN infusion — target MAP reduction 20–25 % over 1h".
  - Asymptomatic 186/104 at pre-op: oral amlodipine, "Elective surgery deferred", no IV agents
    (AAGBI/BHS 2016).
- **Wrong.**
  - The emergency branch depends on SBP ≥220 rather than on organ damage.
  - No ICU line and no CT head.
  - Hypertensive emergency is not in PANE.
  - The pre-op patient is still triaged as emergency (negation).
  - Pre-eclampsia/HELLP: gap 5 and gap 4.
- **Fix.** Branch on organ damage (`FIX_HTN_EMERG` in the vignettes); pregnancy threshold.

### Cellulitis vs DVT (2: DVT referred as cellulitis base, true cellulitis)

- **Right.** The DVT base passes every expectation: DVT at PANE #2, Wells DVT, venous duplex,
  "anticoagulate immediately on clinical suspicion", same-day level.
- **Wrong.**
  - True cellulitis: no antibiotic (L03.116 unmapped, PANE ranks cholecystitis first).
  - Triaged as emergency (fever alone).
- **Fix.** Map L03.1x; the panel follows the confirmed diagnosis.

### Acute GI infection and dehydration (2: elderly with AKI base, euglycaemic-DKA mimic)

- **Right.**
  - The elderly AKI case passes every critical expectation: AKI flag from creatinine, IV
    fluids, "Hold NSAIDs, ACE-I, ARBs, metformin", U&E, hyperkalaemia prompt.
  - No NSAIDs.
- **Wrong.**
  - Gastroenteritis is not in PANE.
  - The DKA mimic: gap 9 and gap 4.
- **Fix.** Gap 9.

## Incidental passes (right output, wrong reason)

These pass today but would fail if the incidental trigger were removed or fixed. Fixing gap 1 or
the negation work should not be allowed to make them regress.

- **Blood cultures** pass in 4 vignettes (CAP high, afebrile sepsis, neutropenic, asplenic) only
  through the cholecystitis protocol seeded from a wrong PANE top ("Blood cultures × 2
  (before antibiotics) (cholecystitis)").
- **Afebrile sepsis alarm** comes only from the leucocytosis prompt ("WBC 15.8 → sepsis screen").
- **CXR** in the immunosuppressed pneumonia case comes from the peptic-ulcer seed "Erect CXR (free
  air under diaphragm)".
- **LMWH** in pregnancy passes only because the DOAC line ends "or LMWH/warfarin".
- **Emergency level** for acute severe asthma, atypical ACS and hypercapnic COPD came from
  "breathless" being classed as a post-operative concern.
- **U&E** in the AKI case came from the diverticulitis seed as well as the creatinine prompt.

## iOS (predicted from code, not observed; every iOS expectation is `unverified`)

- **Emergency level.** `ClinicalPathwayEngine.assess` reads CC and PMH keywords only. None of the
  37 chief complaints contains an emergency or urgent keyword ("acute", "septic shock",
  "haematemesis", "severe pain", …). All 37 are therefore predicted **routine**, so the 27
  critical emergency-level expectations are predicted to fail. The existing iOS results agree:
  `pe-postop-day5`, `dvt-wells-likely` and `mimic-inferior-mi-ecg-confirmed` are all routine.
- **Differential** (fallback mode). Predicted routes:

  | Chief complaint contains | iOS route | Predicted differential |
  |---|---|---|
  | "chest pain" or "palpitation" | `chestPain` built-in pool | Includes ACS and PE (see `pe-perc-negative-low-risk`) |
  | "breath", "breathless" or "wheez" | `shortnessOfBreath` pool | Pneumonia, heart failure, asthma, COPD, TB; **no PE** (see `pe-postop-day5`) |
  | "fever" | `feverInfection` pool | — |
  | "Collapse", "Fainted", "Blackout" | `syncope` external pool | Empty (`?? []`) |

  Anaphylaxis, DKA and hypertensive emergency have no route.
- **`DiagnosisRadiationEngine`** matches the working diagnosis by first keyword substring.
  - The PE entry has the keyword `"pe"`. It matches inside "sus**pe**cted", "synco**pe**" and
    "neutro**pe**nic". The three syncope diagnoses, "Suspected overwhelming post-splenectomy
    infection", "Severe pre-eclampsia with suspected HELLP" and "Neutropenic sepsis" may
    therefore get the PE radiation card (CTPA, anticoagulation), unless an earlier entry
    matches first.
  - The ACS entry's `"mi"` matches inside "euglycae**mi**c", "haemodyna**mi**c" and
    "hypovolae**mi**a". The DKA, unstable-AF and gastroenteritis/AKI diagnoses may get the ACS
    card.
  - `inv-no-ctpa` on both syncope permutations was added to catch this on CI.
  - Entries exist for ACS, heart failure, DVT, PE, pneumonia, asthma, AF, AKI, cellulitis and
    hypertension. There are none for sepsis, anaphylaxis, COPD, syncope, pre-eclampsia or DKA.
- **Calculators.** qSOFA calculator values (3) and auto-fill (≥2) are asserted on iOS only, for
  CAP-high and afebrile sepsis. ENGINE-MAP notes that iOS qSOFA auto-fill uses RR >22 and SBP
  <100. These vignettes have RR 32/24 and SBP 86/94, so they should still score ≥2.

## Harness limits observed (no change made)

- Triage pathway panels (`activePathways`) are recorded **by title only**. The Chest Pain
  Pathway checklist (ECG, troponin, aspirin, 911) is shown to the clinician but cannot satisfy
  an investigation or management expectation. The ACS notes say this explicitly.
- Prompt actions with `addToPlan` are graded as management, even when they are tests (ECG,
  CXR). Their notes quote the plan text.
- The web harness runs no calculator for qSOFA, CURB65, NEWS2, Wells, HEART or CHA₂DS₂-VASc.
  Only whether the score is suggested is graded on web. The web triage input has no AVPU field,
  so new confusion reaches triage only as text.
- `platform.web.paneAnswers` were given only for findings on the record. Without them, PE would
  be missed in the base case too (the pre-existing `pe-postop-day5` notes show the same).
- There is no chest-pain or breathlessness CC template in `cc-matrices.ts`, so medical
  presentations use "Other / general surgical". This is what a clinician would pick today. It
  gives PANE no CC hint.

## Decisions for the surgeon

1. **Scope of medical diagnoses.** Should the consultation engine name acute medical diagnoses
   at all, in PANE or a separate layer? Or should it only recognise "medical emergency — redirect
   to 911/ED" with the first safe actions? The findings favour a separate red-flag/redirect
   layer (gap 1, option b) over enlarging the surgical PANE, but this is a product decision.
2. **Which first actions the clinic may suggest before transfer.** Examples: IM adrenaline for
   anaphylaxis (RCUK: any healthcare provider), aspirin 300 mg for suspected ACS, oxygen. This
   depends on the clinic's emergency kit and policy. Is adrenaline 1 mg/mL stocked at Rodney Bay
   and Tapion?
3. **Triage of "breathless".** "Breathless" / "shortness of breath" currently means urgent
   post-operative concern everywhere. Should breathlessness be graded by physiology (NEWS2,
   SpO₂, RR) instead? Removing the rule without a replacement would demote true emergencies
   (asthma, ACS) that depend on it today.
4. **COPD oxygen wording.** Approve "controlled oxygen, target 88–92 %, ABG" when COPD or
   hypercapnic risk is recorded (BTS 2017/GOLD 2025). This also interacts with NEWS2 Scale 2,
   which stays a clinician opt-in.
5. **Pregnancy rules.** Approve: LMWH instead of DOAC/warfarin in the PE/DVT plans; a
   160/110 threshold with pre-eclampsia/HELLP wording (NICE NG133); no NSAIDs in operative
   templates from 20 weeks.
6. **Sepsis screen.** NEWS2 (NICE NG51 2024) or qSOFA? SSC 2021 recommends against qSOFA alone.
   Should the web sepsis prompt be driven by NEWS2 ≥5 with a suspected source rather than by
   fever?
7. **AF label.** Update CHA₂DS₂-VASc to the ESC 2024 CHA₂DS₂-VA (sex removed)? It changes the
   anticoagulation threshold for women.
8. **Fluid challenges.** Should the tachycardia and shock prompts ever offer a fluid bolus when
   heart-failure signs, raised JVP or suspected PE are recorded (gaps 7 and 10)?
9. **Guideline sources.** Confirm NICE NG250 (2025) as the pneumonia reference, and the
   BTS 2009 CURB65 definitions, before these citations are marked `verified`.
10. **Surgical-clinic scenarios.** Pre-op AF, pre-op severe hypertension and exertional syncope
    before cholecystectomy. Should detection automatically add "defer elective surgery pending
    cardiology/GP" to the plan? It already does for hypertension (AAGBI/BHS 2016).

## Vignettes

All in `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/`, prefix `acutemed-`, category
`general-medicine`.

| Condition | Files (base first) |
|---|---|
| Acute coronary syndrome (ESC 2023; ESC 2018 pregnancy) | `acutemed-acs-typical-chest-pain`, `-acs-atypical-diabetic-woman`, `-acs-pregnancy-scad` |
| Pulmonary embolism (ESC 2019; NICE NG158) | `acutemed-pe-ocp-long-haul`, `-pe-pregnancy-30wk`, `-pe-high-risk-shock`, `-pe-post-lap-chole-pleuritic`, `-pe-elderly-syncope` |
| Community-acquired pneumonia (NICE NG250; BTS 2009; BTS children 2011; CHEST 2020) | `acutemed-cap-low-severity`, `-cap-high-severity-elderly`, `-cap-child-rll-abdominal-pain`, `-cap-immunosuppressed` |
| Sepsis (NICE NG51; SSC 2021; Sepsis-3; RCP NEWS2; NICE CG151; BCSH 2011) | `acutemed-sepsis-afebrile-elderly-urinary`, `-sepsis-neutropenic`, `-sepsis-asplenic-opsi` |
| Atrial fibrillation (ESC 2024) | `acutemed-af-new-onset-rapid`, `-af-unstable-hypotension`, `-af-incidental-preop-elderly` |
| Acute heart failure (ESC 2021/2023; NICE CG187; CREST; NICE NG141) | `acutemed-ahf-pulmonary-oedema`, `-ahf-bilateral-leg-cellulitis-mimic` |
| Asthma (SIGN 158 2019; GINA 2024) | `acutemed-asthma-acute-severe`, `-asthma-life-threatening`, `-asthma-pregnancy-moderate` |
| COPD (GOLD 2025; BTS O₂ 2017) | `acutemed-copd-hypercapnic-exacerbation`, `-copd-mild-exacerbation-outpatient` |
| Anaphylaxis (RCUK 2021) | `acutemed-anaphylaxis-adult-amoxicillin`, `-anaphylaxis-child-peanut` |
| Syncope (ESC 2018) | `acutemed-syncope-exertional-high-risk`, `-syncope-vasovagal-low-risk`, `-syncope-complete-heart-block` |
| Hypertensive emergency (ESC/ESH 2018; ESC 2019 position; AAGBI/BHS 2016; NICE NG133) | `acutemed-htn-emergency-encephalopathy`, `-htn-severe-asymptomatic-preop`, `-htn-pregnancy-preeclampsia-epigastric` |
| Cellulitis vs DVT (NICE NG158; NICE NG141) | `acutemed-dvt-labelled-cellulitis`, `-cellulitis-true-portal-of-entry` |
| Acute GI infection / dehydration (NICE NG148; JBDS 2023; MHRA 2020) | `acutemed-gastroenteritis-elderly-aki`, `-gastroenteritis-mimic-euglycaemic-dka` |

Permutations covered: typical and atypical presentation; older adults (15 vignettes aged 66–88);
pregnancy (4: 24–35 weeks); diabetes (4, including SGLT2-inhibitor DKA); immunosuppression (steroids/methotrexate, chemotherapy,
asplenia); anticoagulated or antiplatelet (4); paediatric (7 and 9 years); severity grades (CURB65
0 vs 5; moderate, acute severe and life-threatening asthma; mild vs hypercapnic COPD; stable vs
unstable AF; low vs high-risk PE and syncope); and dangerous mimics (MI as breathlessness, PE as
post-operative shoulder-tip pain, PE as syncope, pneumonia as appendicitis, HELLP as biliary pain,
DKA as gastroenteritis, heart failure as bilateral cellulitis, DVT as cellulitis).

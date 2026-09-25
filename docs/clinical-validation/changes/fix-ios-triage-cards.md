# Change log — `fix-ios-triage-cards` (iOS triage level, radiation cards, scores, parser, screening)

Owner-authorised "fix all gaps" programme, 2026-09-25. Area: iOS everything except the Bayesian
differential — `ClinicalPathwayEngine` (acuity), `VisitRiskAssessment`, `ClinicalPipelineOrchestrator`
alerts, `ClinicalTextParser` alarms, `DiagnosisRadiationEngine` (plan cards, referrals, red flags),
`PatientScoreAutoPopulator+*.swift`, `ClinicalScoringEngine` calculators (LRINEC, burns/Parkland,
TG18), iOS screening engine, `SOAPDraftEngine` plan text (safety filter only), and tests.
SURGEON-DECISIONS items addressed: **A** (unsafe card items), **C2**, **C5**, **C7**, **E6**,
**G1.3**, **G2**, **G3**, and the iOS parity list in `fix-web-screening.md`.

Every citation below is unverified until the surgeon checks it. Deterministic only: no AI, no
network, `AIService` untouched. Every free-text read added on this branch goes through
`NegationMatcher`. Nothing orders a test or a drug: the level, alerts and cards are suggestions the
clinician confirms.

Swift cannot be compiled in this environment (no toolchain; download blocked). Every changed file
was parsed with tree-sitter-swift and symbol-checked by hand; XCTests were added for each engine
change. The first iOS CI run is the real compile and test gate.

## Results

**Web** (`pnpm --filter @workspace/scripts run clinval:web`, 397 vignettes, 3087 expectations):
unchanged by this branch (no web code changed) — 1938 pass, 1057 fail, 533 critical fail,
**0 blocking** before and after.

**iOS**: results come only from CI (`ios-latest.jsonl`). Baseline (origin, CI run 36160876793):
1307 pass, **974 critical fail**, 0 blocking. Critical fails by kind: emergencyLevel 230,
managementInclude 249, investigationInclude 102, mustAlarm 93, redFlags 56, managementExclude 39.

Expected effect (Python re-implementation of the new rules run over the vignettes,
`scratchpad/sim`; an estimate, not a CI result):

| Kind | Before (critical fail) | Expected after |
|---|---|---|
| emergencyLevel | 230 (83 of 344 applicable pass) | ~2 (340 of 344 pass) |
| mustAlarm | 93 | ~0–4 |
| mustNotAlarm | 0 (22 pass) | 0 (all still pass) |
| redFlags | 56 | ~49 |
| managementInclude / investigationInclude / managementExclude | 249 / 102 / 39 | lower (≈45 new cards and the corrected items target many of them; not simulated) |

Remaining expected emergency-level fails: `dfu-ischaemic-calcified-abpi`,
`periop-preop-suxamethonium-apnoea` (critical), two quality.

**knownGap / unverified flags**: no iOS flag was removed, because iOS results cannot be observed
here. After the first iOS CI run, remove every `knownGap: ["ios"]` that the harness lists under
"Flags to remove" (expected: most emergencyLevel and mustAlarm iOS flags).

Other checks on the final tree: `pnpm run typecheck` exit 0; `pnpm -r run test` all pass
(pane-engine 40, scripts 9, front-desk 109, dashboard 479, api-server 542); lints `grants`,
`rls-policies`, `dx-phases`, `patient-instructions`, `nav-lockout`, `no-external-qr`,
`interaction-parity`, `report-import-parity`, `guideline-registry` all pass.

## Engine behaviour changes

1. **New `ClinicalAcuityEngine`** (`ClinicalAcuityEngine.swift`, `+Signals.swift`,
   `+Recognition.swift`; `rulesVersion = "1.0.0"`, registry entry `ios-clinical-acuity-engine`).
   The iOS emergency level was the chief-complaint keyword level only. It is now the most urgent of:
   - chief-complaint keywords (`ClinicalPathwayEngine`, unchanged apart from item 4);
   - vitals — adults: NEWS2 via `NEWS2Chart` (scoring unchanged) ≥7 emergency, ≥5 or a single 3
     urgent (RCP NEWS2 2017); NICE NG51 high-risk criteria (SBP ≤90, HR >130, RR ≥25, new
     confusion / non-alert AVPU); SpO₂ <92% (<88% on Scale 2 / COPD) emergency, <94% urgent;
     HR ≤40 bradycardia;
   - vitals — under-16s: APLS age-band ranges, age-specific hypotension, RR >60, HR <60, febrile
     infant <3 months (NICE NG143 red), NG143 amber features; infants (<1 y) always get the
     recognise-and-redirect wording;
   - blood pressure: pregnancy ≥160/110 emergency, ≥140/90 urgent (NICE NG133); adult ≥180/120
     with organ damage emergency, without organ damage priority (NICE NG136);
   - critical labs: potassium ≥6.5 emergency / ≥6.0 urgent / ≤2.5 emergency (UKKA 2023); sodium;
     glucose <3.0 emergency / <4.0 urgent; DKA and HHS (JBDS-IP); ketonaemia; corrected calcium
     ≥3.5 emergency / ≥3.0 urgent / <1.9 emergency; lactate; hs-troponin T ≥52 ng/L emergency,
     >14 urgent; Hb <70 g/L; neutropenic sepsis (NICE CG151); creatinine ≥354 µmol/L urgent;
   - ECG report text: STEMI, complete heart block, VT emergency; ischaemic changes, fast/unstable AF;
   - sepsis (infection context): emergency for SBP ≤90, lactate ≥4, NEWS2 ≥7, qSOFA ≥2, or lactate
     ≥2 with qSOFA ≥1; urgent for NEWS2 ≥5 or lactate ≥2 (NICE NG51, Sepsis-3, SSC 2021); no fever
     needed;
   - `ClinicalTextParser` alarms (critical → emergency, malignancy → priority);
   - recognition rules: anaphylaxis, ACS (incl. epigastric and anginal-equivalent presentations),
     aortic dissection, stroke, cauda equina, MSCC, testicular/ovarian torsion, ectopic,
     eclampsia / pre-eclampsia, airway compromise, caustic ingestion, GI bleed, strangulated
     hernia, bowel obstruction (incl. imaging terms), mesenteric ischaemia, toxic megacolon,
     tension pneumothorax, burns (≥15% adult / ≥10% child), electrical injury, paediatric bilious
     vomiting / intussusception / pyloric stenosis, safeguarding and domestic abuse, head injury on
     anticoagulant (CT within 8 h, NICE NG232), penetrating injury;
   - the confirmed working diagnosis (severity table; hernia + obstruction → emergency).
   It only ever raises the level. Each reason is kept (`TriageResult.levelReasons`) and shown.
   Non-surgical emergencies carry the redirect: *"EMERGENCY NOW — call 911 / transfer to the
   nearest emergency department (OKEU Hospital, St Jude's Hospital or Tapion Hospital); inpatients:
   call the hospital emergency team."* Victoria Hospital is never named.
   Under-16s never see an adult dose in an alert ("weight-based dosing — calculate per BNFc").
2. **Wired in**: `ConsultationView+Sheets.runPathway` and `AssessmentView` use the engine; the
   consultation re-runs it when the working diagnosis changes and after the debounced differential
   refresh; the Plan tab lists the alerts. `ClinValIOSRunner` mirrors those call sites (step 2 and a
   new step 5b after diagnosis confirmation).
3. **New `PregnancyContext`**: pregnancy read from the record, sentence by sentence and
   negation-aware ("not pregnant", "hCG negative", "last pregnancy" are not pregnancy), gestation
   in digits or words, obstetric notation (G2P1); males never pregnant; unknown gestation treated
   as ≥20 weeks for the NSAID rule (conservative).
4. **`ClinicalPathwayEngine`**: a past perforation/peritonitis in the PMH no longer escalates the
   current visit; "ischaemia" spelling added; `TriageResult` gained `levelReasons` and `alerts`.
5. **`ClinicalTextParser`**: "rest" matches whole words only (was matching inside "arrest");
   a written temperature is a fever only at ≥38.0 °C, or when described as raised
   (`recordedTemperatures()`: 30–43 °C, unit needed for "degrees", so "45 degrees flexion" and
   "T12" are not temperatures); the sepsis alarm uses the same rule. Hypothermia <36.0 °C read
   the same way.
6. **Score auto-fill** (`PatientScoreAutoPopulator+*.swift`): every keyword check reads a
   `ScoreText` (`NegationMatcher.Source`, one clause per field) instead of one lowercased string:
   "No rebound" no longer ticks the PAS cough/percussion criterion, "no vomiting" no longer ticks
   nausea/vomiting. The Parkland TBSA regex still reads the raw text. Parkland auto-fill now sets
   child and electrical-injury flags; time of burn is left for the clinician.
7. **Radiation safety filter** (`DiagnosisRadiationEngine+SafetyFilter.swift`,
   `radiate(for: patient)` used by the Plan tab, note editor, prescription view and clinval runner):
   - under-16: adult doses replaced by "weight-based dosing — calculate per BNFc", CHILD header;
     paediatric hernia: no mesh, no truss, herniotomy line;
   - pregnancy: header line with gestation and obstetric handover; NSAIDs removed from 20 weeks;
     DOAC/warfarin → LMWH; ACE inhibitors/ARBs, fluoroquinolones and tetracyclines removed;
     ionising imaging carries a "US / MRI first where it answers the question; shield; document"
     note (not removed);
   - allergies: class-aware cross-check (penicillins incl. co-amoxiclav / piperacillin-tazobactam
     / flucloxacillin; cephalosporins after an immediate penicillin reaction; NSAIDs; macrolides;
     sulphonamides; contrast; opioids ...) — conflicting lines removed with a named warning; lines
     that already say avoid/stop/contraindicated/if allergic are kept;
   - antithrombotics on procedural cards: procedure-specific plan instead of generic "hold/bridge"
     (no routine bridging — BRIDGE / ACCP 2022; DOAC interruption by bleeding risk and renal
     function — PAUSE 2019; P2Y12 inhibitors per BSG/ESGE 2021; coronary stent windows —
     ESC/ESAIC 2022; active bleeding → reversal).
   `SOAPDraftEngine.buildPlan` passes its plan text through the same filter (one-line change,
   `draftPlanSafety`).
8. **Lookup order**: precedence cards → Cellulitis → original dictionary → added cards, so a
   specific diagnosis is no longer captured by a generic keyword (E6).
9. **VTE line on every operative/procedural card** (`consentCategory != nil`, NICE NG89).
10. **`VisitRiskAssessment`**: aspirin counted; procedure-specific anticoagulant wording; new flags —
    Coronary stent (ESC/ESAIC 2022), SGLT2 inhibitor (omit the day before and the day of surgery,
    euglycaemic DKA — CPOC 2021), Long-term corticosteroid (SfE/AAGBI/RCP 2020), Malignant
    hyperthermia, Suxamethonium apnoea, Latex allergy (AAGBI), Child (<16), Pregnant (from the
    record; replaces "Could be pregnant?" when pregnancy is documented).
11. **Pipeline**: a critical alert is never hidden by the visit-type filter
    (`ClinicalPipelineOrchestrator+Helpers.filteredAutoActions`).
12. **Screening engine** (`PathwayData.swift`, `WellnessScreeningView.swift`): the iOS parity list
    from `fix-web-screening.md` (new fields and rules below).

## Clinical content changes (before → after, guideline)

### Radiation cards — corrected items (`DiagnosisRadiationEngine+DiseaseDictionary*.swift`)

| Card | Before | After | Guideline |
|---|---|---|---|
| AKI — hyperkalaemia | "K⁺ >6.0 or ECG changes: 10 mL 10% calcium gluconate IV"; "Insulin 10 units + 50% dextrose 50 mL" | "K⁺ ≥6.5 or ECG changes: calcium gluconate 10% 30 mL IV over 5–10 min (or calcium chloride 10% 10 mL)"; "10 units soluble insulin with 25 g glucose IV; monitor glucose for 12 h" | UK Kidney Association 2023 |
| AKI — oliguria | "furosemide challenge 20–40 mg IV" | "assess volume status; diuretics only for fluid overload, not to treat AKI" | NICE NG148 |
| AKI — postrenal | "nephrostomy/stent if hydronephrosis" | + "obstructed infected or solitary kidney → emergency decompression; no NSAIDs in AKI" | EAU 2024 |
| SAH | "IV nimodipine 60 mg 4-hourly" | "Nimodipine 60 mg ORALLY (or NG) every 4 hours for 21 days" (card and ICU referral) | NICE NG228 (2022) |
| Stroke / TIA | "TIA with ABCD² ≥4 → admit + DAPT"; referral note "ABCD² score to stratify TIA risk"; "LMWH bridge in high-risk settings" | "Suspected TIA → specialist assessment within 24 h (no ABCD² triage)"; "Check glucose first"; bridge line removed | NICE NG128 |
| DVT | "LMWH as bridge if needed"; warfarin "if … pregnant" | LMWH "when a DOAC is unsuitable — no bridging to a DOAC"; "PREGNANCY: LMWH only — no DOACs or warfarin" | RCOG Green-top 37b |
| PE | "alteplase 100 mg (contraindications: recent surgery/stroke)"; SaO₂ 94–98% | "CONTRAINDICATED after major surgery or trauma within 3 weeks, recent stroke or active bleeding: embolectomy / catheter-directed therapy"; "88–92% if COPD"; pregnancy LMWH line | ESC 2019; BTS 2017; RCOG 37b |
| Pneumonia / respiratory | O₂ 94–98% | + "88–92% if COPD / hypercapnic risk (blood gas)" | BTS 2017 |
| Acute pancreatitis | "Hartmann's 250–500 mL/h (aggressive)"; "ERCP within 72 h if gallstone + cholangitis"; "cholecystectomy before discharge" | "MODERATE goal-directed: 10 mL/kg bolus only if hypovolaemic, then 1.5 mL/kg/h, reassess 12–24 h"; "No prophylactic antibiotics"; "Urgent ERCP within 24 h if cholangitis; not routinely without cholangitis/obstruction"; "mild: same-admission cholecystectomy; necrotising/collections: defer" | WATERFALL (NEJM 2022); ACG 2024; IAP/APA |
| Cholangitis | "aggressive fluid resuscitation"; "ERCP within 12–24 h (Grade II) or 12 h (Grade III)" | "fluid resuscitation guided by response"; "ERCP within 24 h — Grade III as soon as resuscitated" | TG18; ACG 2024 |
| Perforated ulcer | "Peritonitis → aggressive fluid resuscitation" | "fluid resuscitation, IV antibiotics, source control" | WSES 2020 |
| Peptic ulcer / H. pylori | no penicillin-allergy option | + "bismuth quadruple therapy (PPI + bismuth + tetracycline + metronidazole)" | Maastricht VI (2022) |

### Radiation cards — new (≈45)

Precedence cards (`+PrecedenceCards.swift`): Primary Hyperparathyroidism; Large Bowel Obstruction
(sigmoid/caecal volvulus, obstructing tumour); Hypoglycaemia; DKA; HHS; Metastatic Spinal Cord
Compression; Pre-eclampsia / Eclampsia / HELLP; Ectopic Pregnancy; Trauma in Pregnancy / Placental
Abruption; Necrotising Soft-Tissue Infection / Fournier's; Malrotation with Volvulus;
Intussusception; Pyloric Stenosis; Variceal Haemorrhage.

Additional cards (`+AdditionalCards.swift`): Anaphylaxis; Meningitis; Hyperkalaemia;
Hyponatraemia; Hypercalcaemia; Hypocalcaemia; COPD exacerbation; Cauda Equina; Testicular Torsion;
Ovarian Torsion; PID / Tubo-ovarian Abscess; Hyperemesis Gravidarum; Seizure; Syncope; Delirium;
Upper GI Bleeding (no tranexamic acid — HALT-IT 2020); Lower GI Bleeding; Diverticulitis;
Boerhaave; Liver Abscess; Sepsis (placed after the specific cards); Cutaneous Abscess; Urinary
Retention; Epididymo-orchitis; Burns; Electrical Injury; Head Injury; Chest Trauma; Abdominal
Trauma; Acute Limb Ischaemia; SVT; Safeguarding; Tetanus-prone Wound; Colonic Polyp / EMR.
Each cites its guideline in the card; doses appear only where the cited guideline states them
(e.g. IM adrenaline 0.5 mg — RCUK 2021; magnesium sulfate 4 g — NICE NG133; hydrocortisone,
dexamethasone 16 mg — NICE NG234; 3% saline 150 mL — European hyponatraemia guideline 2014;
calcium gluconate 10% 30 mL — UKKA 2023). Non-surgical emergency cards open with the redirect.

E6 mappings: "hyperparathyroidism … nephrolithiasis" → Primary Hyperparathyroidism (was renal
colic); "cellulitis … type 2 diabetes" → Cellulitis (was diabetes); "large bowel obstruction" →
Large Bowel Obstruction (was small bowel obstruction). Burns and head injury now map to their own
cards (keyword tests updated).

### Calculators (`ClinicalScoringEngine+*.swift`)

| Calculator | Before | After | Guideline |
|---|---|---|---|
| LRINEC <6 | "Low risk — consider cellulitis; antibiotics" | "A low score does not exclude necrotising infection; if clinically suspected, urgent surgical exploration" | WSES 2018 |
| Parkland | 4 mL/kg/%TBSA, half in 8 h from arrival; threshold varied by screen | half in the first 8 h **from the time of burn**, minus fluid already given, over the hours remaining; one threshold (≥15% adult, ≥10% child); electrical injury: IV fluids and urine target 1–1.5 mL/kg/h regardless of visible TBSA; ATLS 10 starting rates shown as a note; child urine target 1 mL/kg/h | Parkland/ATLS 10th ed. (D1/D2 pending) |
| TG18 cholangitis | Grade II from one criterion | Grade II needs ≥2 criteria; drainage timing per grade | TG18; ACG 2024 |
| TG18 cholecystitis | no palpable-mass criterion | "Palpable tender RUQ mass" Grade II criterion (form toggle + auto-fill) | TG18 |
| ABCD2 | stroke-risk triage | NICE NG128 note: do not use a score to triage suspected TIA (calculator kept, note only) | NICE NG128 |
| sPESI | O₂ ≥90% | O₂ target per BTS 2017 (88–92% if COPD) | BTS 2017 |

### Screening engine (`PathwayData.swift`, parity with `fix-web-screening.md`)

New inputs: CRC high-risk family history (FDR <60 / ≥2 FDRs), Lynch carrier, Lynch-feature family
history, BRCA carrier, total hysterectomy, high-grade cervical history, prior gestational
diabetes, gastric-cancer family history, years since last normal colonoscopy, polyp count/size,
advanced histology, piecemeal EMR ≥20 mm. Rules: Lynch 2-yearly colonoscopy + aspirin discussion
(BSG/ACPGBI 2020); US MSTF 2020 post-polypectomy intervals (site check at 6 months after piecemeal
EMR ≥20 mm); family history split; 76–85 individualised (USPSTF 2021); BRCA carrier MRI and
risk-reducing surgery discussion; no cervical screening after total hysterectomy for benign
disease; PSA shared decision from 55 (from 45 for African-Caribbean ancestry or family history —
was 50); hepatitis B triple panel; diabetes screening = overweight AND a risk factor, or prior
GDM (USPSTF 2021); lipids / statin wording (USPSTF 2022); H. pylori test-and-treat with a
gastric-cancer family history (Maastricht VI); clinic BP 140–179 / 90–119 without known
hypertension → confirm with ABPM/HBPM, urine ACR, U&E, HbA1c, lipids, ECG, fundi (NICE NG136).

## Tests added / changed

- `ios/AmiseMedFlowTests/ClinicalAcuityEngineTests.swift` (new): vitals/NEWS2, paediatric
  thresholds, BP in pregnancy, labs, ECG, recognition rules, diagnosis severity, redirect wording
  (no Victoria Hospital), child dose suppression, only-raises property.
- `ios/AmiseMedFlowTests/TriageInputFixesTests.swift` (new): "rest"/"arrest", temperature,
  sepsis alarm, PMH perforation, PAS negation, `ScoreText`, pregnancy detection and negation,
  risk-snapshot flags, anticoagulant wording.
- `ios/AmiseMedFlowTests/RadiationSafetyAndScoresTests.swift` (new): corrected card items, E6
  mappings, new cards, VTE line, safety filter (child, pregnancy, allergy classes, antithrombotic
  plan), LRINEC, Parkland, TG18.
- `DiagnosisRadiationKeywordTests.swift` (burns / head injury now map to their own cards);
  `ConsultPathwayTests.swift` (PSA from 55; web parity rules).

## Registry

`clinical-content/registry.json`: `ios-diagnosis-radiation-engine` versioned 1.1.0 with a version
stamp (`DiagnosisRadiationEngine.contentVersion`) and files glob; new
`ios-clinical-acuity-engine` 1.0.0 (stamp `ClinicalAcuityEngine.rulesVersion`); changelog lines on
`ios-auto-function-engine`, `ios-bayesian-input-mapping`, `ios-clinical-scoring-engine`,
`ios-score-autopopulator`, `ios-visit-risk-assessment`, `ios-screening-engine`. `lastReviewed` left
`"unknown"` everywhere. Inventory (`docs/CLINICAL-CONTENT-INVENTORY.md`) and
`lint-guideline-registry.ts` `KNOWN_RULE_SET_FILES` updated.

## Not done, and why

- **iOS NG12 suspected-cancer rules**: iOS has no `screenForCancer` port; a new module of that size
  belongs in its own change. The NG12 redFlags expectations (most of the ~49 remaining redFlags
  fails) stay open.
- **`ManagementEngine` / `AutoFunctionEngine` / pipeline decision content**: outside the card and
  safety fixes; adult doses can still appear in pipeline outputs for children (e.g.
  `gyn-ovarian-torsion-premenarchal-11` managementExclude — source not traced).
- **`DiagnosisScoreMapper`** still recommends ABCD2 for TIA diagnoses (the calculator now carries
  the NG128 note); not changed.
- **Bayesian differential, `DiagnosticDatabase.json`**: another agent's area.
- **`ConsultPathway.recommend/steps/label` and the follow-up note layout**: coordinator's area,
  not edited.
- **iOS clinval numbers and flag removal**: need the iOS CI run.

## Needs sign-off

1. Burns fluid threshold: ≥15% adult / ≥10% child, and whether "≥" or ">" (D2); Parkland 4 mL/kg
   default vs ATLS 10 (2 mL/kg adult, 3 mL/kg child) — Parkland kept, ATLS shown as a note (D1).
2. The confirmed-diagnosis severity table and every recognition threshold in
   `ClinicalAcuityEngine+Recognition.swift` — a practice triage mapping, not a published table.
3. Redirect wording, including the inpatient clause and the three named hospitals.
4. Sepsis escalation with an infection context: emergency for SBP ≤90, lactate ≥4, NEWS2 ≥7, qSOFA ≥2,
   or lactate ≥2 with qSOFA ≥1; urgent for NEWS2 ≥5 or lactate ≥2.
5. Severe hypertension ≥180/120 without organ damage = priority (not urgent).
6. Lab thresholds: creatinine ≥354 µmol/L urgent; hs-troponin T ≥52 / >14 ng/L (assay-specific
   — the local assay may differ); Hb <70 g/L; calcium bands; hypoglycaemia <3.0 / <4.0.
7. Paediatric thresholds (APLS bands, RR >60, HR <60 → emergency, infants always redirected).
8. Pregnancy detection from free text; unknown gestation treated as ≥20 weeks.
9. Cephalosporin avoidance after an immediate (anaphylactic) penicillin reaction; contrast allergy
   removing contrast-CT lines.
10. Head injury on anticoagulants: "CT within 8 hours" (NICE NG232) (D5).
11. Antithrombotic interruption timings (PAUSE) and the stent windows as written.
12. PSA shared decision from 45 for African-Caribbean ancestry / family history, from 55 otherwise.
13. MH flag raised on a family history of malignant hyperthermia.
14. Doses written into cards from the cited guidelines: IM adrenaline 0.5 mg; magnesium sulfate
    4 g; 3% saline 150 mL; insulin–glucose 10 units + 25 g; calcium gluconate 10% 30 mL;
    dexamethasone 16 mg (MSCC); fixed-rate insulin 0.1 units/kg/h (DKA), 0.05 units/kg/h (HHS);
    pancreatitis fluid rates.
15. Oxygen targets (88–92% with COPD) on respiratory, PE and sPESI outputs.
16. ABCD2: note only (calculator kept) vs removal.

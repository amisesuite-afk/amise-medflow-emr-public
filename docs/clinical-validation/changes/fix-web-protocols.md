# Change log — `fix-web-protocols` (web management protocols and plan generation)

Owner-authorised "fix all gaps" programme, 2026-09-25. Area: the pane-engine management protocols
(`lib/pane-engine/src/management/**`), ICD-10 → protocol resolution, the dx-variant table
(`artifacts/dashboard/src/lib/dx-variants.ts`), the Plan-tab plan builder, the Assessment
management panel and the protocol medicines on the Prescriptions tab. SURGEON-DECISIONS **A1–A25**
(web parts), **B1–B16**, **C5**, **E1, E4, E5**, **G2** (plan parts) and the medical, obstetric and
paediatric emergency protocols of **G1/G3**.

Principles kept throughout:

- Emergencies outside surgery are **recognised**, the first actions are **suggested**, and the
  patient is **redirected**: "call 911 for an ambulance or arrange immediate transfer to the nearest
  emergency department (OKEU Hospital, St Jude's Hospital or Tapion Hospital)". Victoria Hospital is
  never named (a unit test checks every protocol).
- Doses appear only where the named guideline states them; otherwise "per BNF / local policy".
  Under 16, every protocol dose is replaced by "weight-based — calculate per BNFc".
- Everything is clinician-facing (Plan tab suggestion, management panel, prescription suggestions);
  nothing is patient-facing (hazard H-10) and nothing is applied without the clinician's tap.
- Deterministic only — no AI, no network. Text is read with negation-aware, whole-word matching.
- Guideline name and year are cited in the code (`ManagementProtocol.guidelines` and the step
  text). The sources are **not yet verified by the surgeon**.

## Results (`pnpm --filter @workspace/scripts run clinval:web`, 397 vignettes, 3087 expectations)

| Run | Pass | Fail | Critical fail | Quality fail | Blocking |
|---|---|---|---|---|---|
| Original base `72e083a` (before any fix branch) | 1882 | 1113 | 546 | 567 | 0 |
| This branch on the original base (before the rebase) | 2441 | 554 | 288 | 266 | 0 |
| Current base `origin/claude/pr-37-gbg22z` `0cce702` (triage, differential, screening merged; same web numbers as `0a8d1ca`) | 2625 | 370 | 66 | 304 | 0 |
| **This branch rebased on `0cce702`** | **2865** | **130** | **5** | **125** | **0** |

Against `0cce702`: **240 expectations went from fail to pass (61 critical, 179 quality)** —
management include 117, management exclude 58, investigation include 41, investigation exclude 11,
dx variant 8, red flag 5. **No expectation that passed on the base fails now.** 232
`knownGap: ["web"]` flags that now pass were removed (where `ios` was also listed, only `web` was
taken out). No expectation was weakened or deleted.

The 5 remaining critical fails are outside this area: 3 in `web.clinicalPrompts` (inflammatory
breast "no … SLNB" wording, "not DOACs or warfarin" wording, colonic stent prompt) and the 2 TG18
auto-fill scores.

## Engine changes

1. **`lib/pane-engine/src/management/types.ts`** — `ManagementProtocol` gains optional `kind`
   (`surgical | procedure | medical | emergency | bleeding`), `guidelines`, `paediatricDosing`,
   `pregnancySpecific`, `cancer`, `allergyAlternatives` (per allergy class). Steps, investigations and
   medications may carry `onlyIf` (`pregnant | not-pregnant | penicillin-allergy |
   no-penicillin-allergy | under-16 | adult`).
2. **ICD-10 lookup** (`management/index.ts`): `getProtocolByIcd` uses the **longest matching prefix**
   (dots ignored; "K35.89 — label" strings accepted) instead of the first match. `resolveProtocol
   (diseaseId, icd)`: the disease protocol wins unless the recorded code maps to a different protocol
   the disease does not cover, at least as specifically as the disease's own codes in that ICD
   category (upper GI bleed + I85.11 → variceal; liver abscess + A06.4 → amoebic; diverticulitis +
   K57.31 → lower GI bleeding; post-operative ileus + K56.7 stays ileus). `PROTOCOL_ALIASES` maps the
   new PANE disease ids (`acs`, `dka`, `hhs`, `stroke`, `tia`, `meningitis`, `food_bolus`,
   `infected_obstructed_kidney`, `sigmoid_volvulus`, `toxic_megacolon`, …) to their protocols.
   `MANAGEMENT_PROTOCOLS_VERSION = '1.0.0'`.
3. **New `management/planSafety.ts`** (`PLAN_SAFETY_VERSION = '1.0.0'`), `adaptProtocolForPatient
   (protocol, patient)` and `adaptPlanText(text, protocol, patient)`: resolves `onlyIf` branches and
   adapts every step, key point, investigation and medicine to the patient on record, and returns
   patient-specific safety lines (critical lines are also red flags):
   - **Allergy cross-check, class-aware (C5)**: penicillins (with a cephalosporin/carbapenem caution
     after an immediate reaction), cephalosporins, carbapenems, macrolides, quinolones,
     tetracyclines, sulfonamides, metronidazole, aminoglycosides, glycopeptides, clindamycin,
     NSAIDs/aspirin, opioids, heparins; latex, chlorhexidine, iodinated contrast. A step containing
     the drug becomes "⚠ ALLERGY — penicillin allergy recorded (…): withheld (contains …).
     Alternative: <the protocol's alternative or the class default>"; a protocol medicine is not
     offered and the Prescriptions tab says why. "Avoid NSAIDs", "no penicillin" are not withheld.
   - **Pregnancy** (status from the record or the text, gestation from "28 weeks", "32/40", "G2P1 at
     28 weeks"; the "pregnancy possible" tick alone is "possible", never pregnant): DOAC / warfarin
     withheld → weight-adjusted LMWH (RCOG GTG 37a/37b 2015); NSAIDs withheld from 20 weeks or when
     gestation is unknown (FDA 2020; BNF) and annotated before 20 weeks (BNF); tetracyclines,
     quinolones, methotrexate, ACE inhibitors/ARBs, statins, trimethoprim (first trimester),
     tamoxifen, aromatase inhibitors, HER2 antibodies, radioiodine withheld (BNF; RCOG GTG 12);
     ionising imaging annotated (ACOG CO 723, 2017); ERCP lines annotated "minimise fluoroscopy,
     shield" (ASGE 2012); obstetric involvement, left lateral tilt from 20 weeks, antenatal steroids
     24–34 weeks (ACOG CO 775, 2019). Pregnancy possible or unknown in a woman aged 12–55 before
     surgery/ionising imaging: "β-HCG: result required … do not record it as negative without a
     result" and a pregnancy-test investigation (NICE NG45). "β-HCG confirmed negative" is never
     generated.
   - **Under 16 (A22, G2.12)**: doses in steps replaced by "[dose: weight-based — calculate per
     BNFc]", medicines show "Weight-based — calculate per BNFc" (except protocols written with
     paediatric doses, e.g. RCUK 2021 anaphylaxis); adult hernia techniques (mesh, Lichtenstein,
     TEP/TAPP, truss) replaced by the paediatric line (open herniotomy by a paediatric surgeon, prompt
     repair in infants); CT annotated "ultrasound first" (RCR iRefer); infants get "recognise and
     redirect". No adult VTE line under 16 (NICE NG89 covers ≥ 16).
   - **VTE (G2.6)**: every operative plan gets a NICE NG89 line — mechanical prophylaxis + LMWH
     (enoxaparin 40 mg once daily; **CrCl < 30: 20 mg once daily**, dialysis: UFH — BNF), 28 days
     after major abdominal/pelvic cancer surgery; active bleeding → intermittent pneumatic compression
     first, reassess daily; on anticoagulation → see the anticoagulation plan; pregnancy → RCOG 37a.
   - **Anticoagulants / antiplatelets (G2.1, G2.2, G2.18, A12, A13)**: bleeding → withhold, reversal
     (warfarin: IV vitamin K 5 mg + 4-factor PCC; DOAC: andexanet alfa or PCC; dabigatran:
     idarucizumab), "no heparin substitution while bleeding", restart plan (BSG/ESGE 2021; BSH).
     Elective: warfarin + low-risk endoscopy → continue, INR check (BSG/ESGE 2021); warfarin +
     surgery/high-risk endoscopy → stop 5 days, INR < 1.5, **no bridging** except mechanical valve,
     VTE < 3 months or high-risk thrombophilia (BRIDGE 2015; ACCP 2022); DOAC → omit the morning dose
     (low-risk endoscopy), last dose 3 days before (high-risk endoscopy; dabigatran 5 days at CrCl
     30–50), PAUSE 2019 intervals for surgery; P2Y12 → continue for low-risk endoscopy, stop 7 days
     for high-risk endoscopy if thrombotic risk low (BSG/ESGE 2021), clopidogrel 5 / ticagrelor 3–5 /
     prasugrel 7 days before surgery (ESC/ESAIC 2022); aspirin continued. **Coronary stent within 6
     months of elective PCI or 12 months of ACS → defer elective surgery / high-risk endoscopy,
     cardiology first (ESC/ESAIC 2022)**. Emergency surgery → last dose, anti-Xa level, reversal
     discussion (ESC/ESAIC 2022).
   - **Diabetes (G2.3)**: SGLT2 inhibitor → stop in acute illness (euglycaemic DKA; MHRA; JBDS 2023);
     before a procedure **withhold the day before and the day of the procedure (CPOC 2021)**, ketones
     before and after; sulfonylurea omitted on the day, metformin per CPOC 2021; type 1 / insulin →
     continue basal insulin at 80 %, VRIII if > 1 meal missed, glucose and ketone checks (CPOC 2021)
     and a ketone investigation.
   - **Steroid cover** (AAGBI/Society for Endocrinology 2020); **anaesthetic hazards (G2.5)**: latex
     and chlorhexidine allergy (NAP6 2018), malignant hyperthermia (AAGBI 2011; EMHG 2020),
     suxamethonium apnoea (RCoA), OSA / STOP-Bang ≥ 5 (SAMBA 2012; ASA 2014); **frailty / delirium**
     (NICE CG103; CPOC 2021); **emergency laparotomy** → NELA / P-POSSUM mortality risk documented,
     consultant presence and critical care if ≥ 5 % (NELA; RCS 2018); oestrogen-containing
     contraception/HRT with VTE → stop (FSRH/UKMEC; NICE NG158), before major surgery → consider
     stopping 4 weeks before (NICE NG89); immunosuppression (blunted signs; withhold methotrexate in
     acute infection/AKI — BNF; BSR 2017); beta-blockers (blunted tachycardia — ATLS 10); renal
     impairment → NSAIDs withheld (NICE NG148).
   - Procedure detection reads the assessment ("low bleeding-risk", "surgical review", "day 4 after
     hemicolectomy", "post-thyroidectomy" are not a planned operation or active bleeding).
4. **New `artifacts/dashboard/src/lib/plan-builder.ts`** and `hooks/usePlanPatientContext.ts`:
   `planPatientContext` (AppContext fields: age, sex, pregnancy tick, allergies, medicines, PMH,
   HPI, surgical history, assessment, report-imported eGFR), `planProtocolFor` (= resolveProtocol),
   `buildPlanText` (variant prefix adapted, "Patient-specific safety checks (review before acting)",
   admission orders, adapted phases, investigations, referral).
5. **PlanTab** builds its suggested plan with `buildPlanText` from the confirmed diagnosis
   (`resolveProtocol`); nursing orders say "food up to 6 h and clear fluids up to 2 h before
   anaesthesia (AAGBI 2010; ESA 2011)" instead of "NPO from midnight"; the obese-class-I BMI note
   points to NICE NG89 instead of a fixed enoxaparin dose. **ManagementPanel** takes an optional
   `patient` (Assessment and Trauma tabs pass it; the Dictionary stays a raw reference) and shows a
   "For this patient — review before acting" block. **PrescriptionsTab** offers only adapted
   protocol medicines and lists what was not offered and why.
6. **dx-variants** (`DX_VARIANTS_VERSION = '1.0.0'`): a keyword followed by "criterion/criteria" is
   not the grade ("one Grade II criterion"); the text fallback needs the base diagnosis as a whole
   word ("thyroidectomy" no longer makes a neck haematoma a Thyroid case).
7. **clinval web runner** mirrors PlanTab (`confirmedPlanSource` → `resolveProtocol` → adapted plan),
   the adapted ManagementPanel (with its safety block) and PrescriptionsTab medicines.
8. Registry: `pane-engine-management-protocols` 1.0.0, new `plan-safety-filters` 1.0.0, `dx-variants`
   1.0.0, each with a version stamp and changelog; `lastReviewed` stays "unknown".

Tests: `lib/pane-engine/src/__tests__/planSafety.test.ts` (35), `artifacts/dashboard/src/lib/
__tests__/plan-builder.test.ts` (12, including the E4 variant wording).

## Clinical content changes (before → after)

### Section A

| # | Before | After | Source |
|---|---|---|---|
| A1 | Upper GI bleed: tranexamic acid 1 g IV (step and medicine) | Removed; "no antifibrinolytic"; restrictive transfusion Hb 70 g/L (80 with CVD); GBS 0–1 outpatient; critical care if unstable; emergency endoscopy after resuscitation (≤ 12 h) if unstable; variceal suspicion → variceal protocol | ESGE 2021; HALT-IT 2020; NICE CG141 |
| A2 | Pancreatitis "aggressive" Hartmann's 250–500 mL/h (protocol, moderate/severe variant) | Moderate goal-directed fluids, "avoid aggressive fluids"; early oral feeding | WATERFALL 2022; ACG 2024 |
| A3 | DVT/PE in pregnancy: rivaroxaban/apixaban, warfarin | Pregnancy branch: treatment-dose LMWH by early-pregnancy weight ≥ 6 weeks postpartum; DOAC and warfarin (teratogenic) contraindicated; D-dimer not used in pregnancy; filter withholds DOAC/warfarin in any protocol | RCOG GTG 37a/37b 2015 |
| A4 | NSAIDs in plans at 21–26 weeks | Withheld from 20 weeks (and when gestation unknown); annotated before 20 weeks | FDA 2020; BNF |
| A5 | (plan) no pregnancy handling | "β-HCG: result required" line and pregnancy-test investigation when pregnancy is possible | NICE NG45 |
| A6 | Ruptured ectopic: methotrexate/expectant options, "methotrexate suitability" bloods | Ruptured/unstable: surgery only, methotrexate and expectant management contraindicated; methotrexate/expectant criteria per NICE (mass < 35 mm, hCG thresholds); bloods only if methotrexate is considered; anti-D for surgery in RhD-negative; obstetric redirect | NICE NG126 |
| A7 | Incarcerated hernia: "attempt gentle manual reduction" | Reduction only when strangulation is not suspected; emergency repair otherwise (inguinal, umbilical protocols, incarcerated variant, new incarcerated-hernia protocol); watchful waiting only for minimally symptomatic men who decline or are unfit — not women or irreducible hernias | WSES 2017; HerniaSurge 2018 |
| A8 | Any Bethesda → total-thyroidectomy plan | Thyroid nodule protocol mapped from E04.x / D44.0 with a plan per Bethesda category (I repeat FNA, II surveillance, III repeat FNA/molecular/lobectomy, IV lobectomy, V–VI MDT); Bethesda I/II variants | ATA 2015; BTA 2014 |
| A9 | Inflammatory breast cancer: WLE + SLNB | Neoadjuvant systemic therapy first, then MRM + ALND + PMRT; WLE/SLNB "not for inflammatory breast cancer"; inflammatory variant | NCCN 2024 |
| A10 | Angiodysplasia (K55.21) → ischaemic colitis (heparin) | Own bleeding protocol, no anticoagulant escalation | ACG 2023; BSG 2021 IDA |
| A11 | Toxic megacolon: colonoscopy | Flexible sigmoidoscopy only; colonoscopy contraindicated; CMV, C. difficile (oral vancomycin), no antimotility agents, joint medical-surgical review | BSG 2019 |
| A12/A13 | Elective "hold / bridge" text in bleeding and head injury | Bleeding-specific reversal lines (see engine §3); TBI: CT within 8 h if anticoagulated, reversal step | BSG/ESGE 2021; NICE NG232 |
| A14 | H. pylori triple therapy with amoxicillin despite anaphylaxis | Bismuth quadruple first line where clarithromycin resistance is high/unknown; penicillin-allergy branch; allergy filter | Maastricht VI 2022; NICE CG184 |
| A15 | Tension pneumothorax: 2nd ICS MCL for everyone | Adults 4th/5th ICS anterior to mid-axillary line; children 2nd ICS MCL | ATLS 10 |
| A16 | Prophylactic antibiotics in pancreatitis | "No prophylactic antibiotics"; only for suspected infected necrosis | ACG 2024; IAP/APA |
| A17 | Cholangitis ERCP within 72 h | Grade III urgent, Grade II within 24 h, Grade I if no response within 24 h | TG18; ACG 2024 |
| A18 | Variceal transfusion 80–100 g/L | Restrictive, threshold 70, target 70–80 g/L; pre-emptive TIPS criteria | Baveno VII 2022 |
| A19 | UC "WBC > 10.5" | Hb < 10.5 g/dL (Truelove & Witts) | BSG 2019 |
| A22 | Adult doses, mesh and truss for children | Weight-based dosing per BNFc; paediatric hernia line; no truss | BNFc; BAPS practice |
| A23 | Stent despite impending caecal perforation; volvulus without decompression/resection split | Stent contraindications (perforation, peritonitis, ischaemia, impending caecal perforation); right-sided resection; left-sided options; sigmoid detorsion only without ischaemia; caecal → right hemicolectomy, no endoscopic detorsion | WSES 2018; ESGE 2020; ASCRS 2021 |
| A24 | Fistula-in-ano (K60.3) → fissure protocol | Own protocol: EUA, fistulotomy or seton by complexity; fissure protocol limited to K60.0–K60.2 | ASCRS 2022 |
| A25 | Same-admission cholecystectomy despite necrotic collections | Same admission for mild biliary pancreatitis; defer until collections resolve / > 6 weeks | IAP/APA; ACG 2024 |

A20 and A21 are iOS (not this area).

### Section B (new or rewritten protocols with ICD mappings)

B1 variceal bleed; B2 lower GI bleed (K92.2 on its own now resolves to lower GI bleeding; with an
upper-GI-bleed working diagnosis it stays upper GI; K92.0/K92.1 and the ulcer-with-haemorrhage codes
are upper GI); B3 mesenteric ischaemia (planned second look); B4 aortic aneurysm
(I71/I72; POCUS, CTA, permissive hypotension 70–90 mmHg, no large bolus, emergency EVAR/open,
TXA removed — ESVS 2024); B5 acute limb ischaemia; B6 Fournier's gangrene (SGLT2 flag); B7 C.
difficile; B8 anal cancer / atypical ulcer; B9 burns under 20 % TBSA (Lund & Browder, fluids,
escharotomy, referral criteria) and major burns (T31.2+, inhalation T27); B10 child safeguarding;
B11 trauma in pregnancy; B12 post-thyroidectomy hypocalcaemia; B13 airway-first steps (thyroid
nodule/goitre, thyroid carcinoma with core biopsy for suspected anaplastic carcinoma/lymphoma, neck
haematoma SCOOP before imaging — DAS/BAETS/ENT UK 2022); B14 ACS, aortic dissection, pneumonia,
ECG/troponin in oesophageal perforation, AAA vs renal colic; B15 ectopic redirect, food bolus
(emergency OGD); B16 pancreatitis cause-specific branches (thiamine/withdrawal, stop azathioprine,
hypertriglyceridaemia) and amoebic abscess (metronidazole then a luminal agent).

All protocols added by this branch, with their ICD mappings and sources:

- **Surgical and allied** (`surgicalAdditions.ts`): variceal bleed (I85, I86.4, I98.3 — Baveno VII;
  BSG 2015; EASL 2018); lower GI bleed (K92.2, K57.x1 — BSG 2019; ACG 2023); angiodysplasia (K55.2,
  K31.81); mesenteric ischaemia (K55.0 — ESVS 2017; WSES 2022); aortic dissection (I71.0 — ESC
  2014/2024); acute limb ischaemia (I74.2–5 — ESVS 2020); superficial vein thrombosis (I80.0–1 — ESVS
  2021); Fournier's gangrene (N49.3, N76.82 — WSES/SIS-E 2018; MHRA 2019); C. difficile (A04.7 — NICE
  NG199; ESCMID 2021); infective colitis (A09, A02.0, A03, A04.0–6/8 — IDSA 2017; UKHSA STEC);
  anal cancer (C21, K62.6 — ACPGBI 2017; ESMO 2021); fistula-in-ano (K60.3–5 — ASCRS 2022);
  gallstones/biliary colic/polyp (K80.2, K80.8, K82.8, K82.4 — NICE CG188; 2022 joint polyp
  guideline); dyspepsia (K30, R10.13 — NICE CG184; NG12); eosinophilic oesophagitis (K20.0 — BSG
  2022); food bolus (T18.0–1 — ESGE 2016); pharyngeal pouch (K22.5 — NICE IPG22); corrosive injury
  (T54, T28.5–7 — ESGE 2020); breast lump (N63 — NICE NG12; ABS 2019); nipple discharge (N64.52–53);
  mastalgia (N64.4); post-thyroidectomy hypocalcaemia (E89.2, E83.51, E20.8 — SfE 2016; BAETS 2021);
  amoebic liver abscess (A06.4 — BNF); obstructed infected kidney (N13.6 — EAU 2024); pyelonephritis
  (N10–N12, O23.0 — NICE NG111); iron-deficiency anaemia (D50 — BSG 2021); suspected colorectal
  cancer pathway (R19.5, K62.5, R19.4 — NICE DG56; BSG/ACPGBI 2022); colorectal polyp (D12, K63.5,
  K62.1 — BSG/ACPGBI/PHE 2020); diabetic foot (E1x.621, E1x.52, L97 — IWGDF/IDSA 2023; NICE NG19);
  Charcot foot (E1x.610, M14.6); pre-operative assessment (Z01.81x — NICE NG45; CPOC 2021; ESC/ESAIC
  2022); delirium (F05 — NICE CG103); post-operative pyrexia (R50.82, T88.4 — NICE NG125); perforated
  peptic ulcer (K25–K28 .1/.2/.5/.6 — WSES 2020); incarcerated/strangulated hernia (K46.0–1 — WSES
  2017).
- **Medical emergencies** (`acuteMedicine.ts`): ACS (I20.0, I21, I22, I24 — ESC 2023), AF (I48 —
  NICE NG196; ESC 2024), acute heart failure (I50, I11.0 — no fluid bolus; NICE CG187; ESC 2021),
  anaphylaxis (T78.0/.2, T88.6, T80.52 — RCUK 2021, age-banded IM adrenaline), acute asthma (J45–46 —
  BTS/SIGN 158), COPD exacerbation (J44.0–1 — 88–92 %; BTS 2017), pneumonia (J12–J18 — NICE NG138),
  sepsis (A40, A41, R65.1–2, R57.2 — NICE NG51; SSC 2021), DKA (E1x.1 — JBDS 2023; BSPED 2021), HHS
  (E1x.0 — JBDS 2022), hypoglycaemia (E16.0–2, E1x.64), hyperkalaemia (E87.5 — calcium gluconate 10 %
  30 mL; UKKA 2023), hyponatraemia (E87.1 — 2014 European guideline), hypercalcaemia (E83.52 — SfE
  2016), AKI (N17, N13.8–9, N99.0 — NICE NG148), hypertensive emergency (I16.1/.9, I67.4), acute
  stroke (I61–I64 — NICE NG128), TIA (G45 — no ABCD2), SAH (I60 — oral nimodipine; NICE NG228),
  bacterial meningitis (G00, G01, G03, A39, A87 — NICE NG240), cauda equina (G83.4 — GIRFT 2023),
  MSCC (G95.2, C79.5, G55.0 — NICE NG234), first seizure (R56.8–9, G40 — NICE NG217), syncope (R55,
  I44.2, I35.0 — ESC 2018).
- **Obstetric and paediatric** (`obstetricPaediatric.ts`): pre-eclampsia/HELLP/eclampsia (O11,
  O13–O16 — magnesium, NICE NG133), hyperemesis (O21 — RCOG GTG 69), trauma in pregnancy (O9A.2 —
  ATLS 10; BSH 2014), placental abruption (O45 — RCOG GTG 63), intussusception (K56.1 — child
  redirect, APLS; adult branch: resection for a lead point), pyloric stenosis (Q40.0), malrotation
  with volvulus (Q43.3), suspected non-accidental injury (T74.x, T76.x, Y07 — NICE CG89; RCR/RCPCH
  2017).

### Other corrections to existing protocols

- **Appendicitis**: CT only when not pregnant, MRI branch in pregnancy (WSES 2020; ACR 2018);
  antibiotics-first option for selected adults, not with an appendicolith (WSES 2020; CODA 2020); no
  routine post-operative antibiotics after simple appendicitis.
- **Cholecystitis**: TG18 grade-based timing ("if fit", Grade I–II early cholecystectomy); drainage
  in the surgical phase; MRCP only if the CBD is dilated or the patient is jaundiced.
- **Choledocholithiasis**: ASGE 2019 likelihood — MRCP/EUS for intermediate likelihood, ERCP only if
  high likelihood or confirmed; pregnancy branch (ASGE 2012); K80.3 moved to cholangitis.
- **Peptic ulcer**: H. pylori per NICE/Maastricht, 8-week PPI, OGD "not in suspected perforation".
- **Diverticulitis**: antibiotics not routinely needed in immunocompetent, systemically well
  patients; co-amoxiclav 500/125 mg for 5 days only if systemically unwell/immunosuppressed/comorbid
  (NICE NG147); prophylaxis at induction (NICE NG125); elective colectomy individualised.
- **Colorectal cancer**: resection by site (right hemicolectomy for right-sided tumours); stent
  contraindications; pre-operative anaemia, CGA/frailty (CPOC 2021); 28-day VTE prophylaxis.
- **Bowel obstruction**: adhesive SBO "without strangulation" wording, water-soluble contrast once
  (WSES/Bologna 2017), strangulation → surgery; no "drip and suck".
- **Haemorrhoids, fissure, perianal abscess, Crohn's, UC, ischaemic colitis, umbilical and obturator
  hernia, breast abscess, duct ectasia** (colorectal/hernia/breast file): thrombosed haemorrhoid
  excision < 72 h; fissure EUA/biopsy for atypical fissures and LIS caution; perianal abscess — no
  routine antibiotics, Fournier exploration; Crohn's abscess drainage and seton (ECCO); ischaemic
  colitis — heparin removed (ACG 2015); umbilical hernia in cirrhosis — ascites control and rupture
  red flag.
- **Oesophageal perforation**: ECG/troponin; antifungal cover (WSES 2019).
- **Trauma**: blunt abdominal/splenic trauma as bleeding kind, CT only once stable, pelvic binder;
  TBI per NICE NG232; rib fracture ICD codes.
- **Vascular**: AAA as above; PE — bedside echo, UFH bolus, alteplase 100 mg over 2 h with the
  3-week major-surgery contraindication, oxygen 94–98 %, CTPA only if Wells > 4 or D-dimer positive
  (NICE NG158; ESC 2019).
- **Urology**: renal colic — NSAID only with normal renal function, urgent decompression for an
  infected/obstructed/solitary kidney or anuria, MET only for 5–10 mm distal stones without
  infection/anuria (EAU 2024), low-dose CT KUB not in pregnancy or children; urinary retention — PSA
  deferred ≥ 6 weeks, clot retention three-way catheter and irrigation, cystoscopy + CT urogram for
  visible haematuria (NICE NG12); UTI — CSU after changing a long-term catheter (NICE NG113).
- **Post-operative wounds**: organ/space SSI — percutaneous drainage or relaparotomy (WSES 2017);
  neck haematoma — SCOOP before imaging, PCC for warfarin reversal (BSH 2018).
- **Skin**: cellulitis L03, abscess L02 families; groin abscess in people who inject drugs — duplex
  before incision, BBV testing.
- **Endocrine**: thyroid nodule/goitre and carcinoma as above (Bethesda, airway, core biopsy).
- **Liver abscess**: pyogenic drainage > 3 cm; amoebic drainage only if no response in 3–5 days,
  left lobe or impending rupture; luminal agent.
- **Phyllodes tumour**: ultrasound first under 40.

### dx-variants

- **E4** keywords: cholangitis "mild/moderate/severe acute cholangitis", "(TG18/Tokyo) grade
  I/II/III" (not when followed by "criterion"); pancreatitis "mild acute biliary pancreatitis",
  "moderately severe (acute) pancreatitis", "acute necrotic collection"; diverticulitis
  "uncomplicated (acute) (sigmoid) diverticulitis", "Hinchey 0", "Hinchey Ib" moved to the abscess
  variant; appendicitis "abscess"; hernia "obstruction/obstructed" → incarcerated (ties still go to
  strangulated).
- **E5**: Thyroid group ICD D44 → D44.0 (adrenal D44.1 no longer matches). No parathyroid group
  added (needs sign-off).
- Prefixes/notes: incarcerated hernia (A7), malignant LBO (A23), volvulus (A23), pancreatitis (A2,
  A16, A25), uncomplicated diverticulitis (NICE NG147), variceal (A18), cholangitis Grade I (A17),
  adhesive SBO (water-soluble contrast).
- New variants (added to the SKILL.md phase table and `lint:dx-phases`): `breast_inflammatory`
  `['immediate','conservative','followup']`, `thyroid_bethesda_nondiagnostic`
  `['immediate','conservative','followup']`, `thyroid_bethesda_benign` `['conservative','followup']`,
  `sbo_failed_nonoperative` `['immediate','surgical','followup']`.

## Needs sign-off

1. **SGLT2 inhibitors before a procedure**: CPOC 2021 "day before and day of" is used; FDA labelling
   says 3 days (4 for ertugliflozin). The line names both — the surgeon chooses.
2. **P2Y12 before high-risk endoscopy**: 7 days (BSG/ESGE 2021) and before surgery clopidogrel 5 /
   ticagrelor 3–5 / prasugrel 7 days (ESC/ESAIC 2022).
3. **Stent windows**: 6 months after elective PCI, 12 months after ACS — defer unless cardiology
   agrees (ESC/ESAIC 2022).
4. **Burns fluids (D1/D2)**: Parkland 4 mL vs the ATLS 10 / ABA 2 mL starting rate — both shown;
   formal fluids from ≥ 15 % (adult) / ≥ 10 % (child) TBSA — ≥ vs > to confirm; referral thresholds
   from the UK National Burn Care Referral Guidance 2012.
5. **E1**: "strangulation not excluded" keeps the strangulated (emergency) variant — the conservative
   choice; the vignette expects the incarcerated variant (quality, still flagged).
6. **E5**: no parathyroid variant group; confirm whether one is wanted.
7. **resolveProtocol rule**: a more specific recorded ICD code overrides the working diagnosis's
   protocol (e.g. IDC + N63 → breast-lump triple assessment; thyroid carcinoma + D44.0 → nodule
   protocol by Bethesda). Confirm this is the behaviour wanted.
8. **Guideline sources to confirm**: intussusception reduction technique (APLS + local practice);
   amoebic abscess (BNF only); pharyngeal pouch (NICE IPG22, 2003); adult intussusception branch (no
   single guideline); post-operative pyrexia (clinical practice); pyloric stenosis and malrotation
   (APLS + BAPS practice).
9. **Frailty/delirium trigger**: age ≥ 65 with frailty, CFS ≥ 5, dementia, cognitive impairment or
   previous delirium, or age ≥ 80, when a procedure or acute illness is planned.
10. **Emergency-surgery anticoagulant line**: PCC discussion for factor Xa inhibitors before surgery
    (andexanet is licensed for life-threatening bleeding, not surgery) — ESC/ESAIC 2022; confirm with
    local haematology.
11. **NSAIDs before 20 weeks**: annotated ("only if the benefit outweighs the risk"), not withheld.
12. **Phaeochromocytoma, femoral artery aneurysm, post-operative collection, toxic megacolon** use
    the closest existing protocol (adrenal incidentaloma, aortic aneurysm, SSI organ/space, UC) via
    aliases; dedicated protocols may be preferred.
13. **Fasting** in the Plan-tab nursing orders now follows AAGBI 2010 / ESA 2011 (6 h food, 2 h
    clear fluids) instead of "NPO from midnight" (clinician-facing only; the patient-facing prep
    texts are unchanged).
14. **Cellulitis Eron classes**: the plan still lists the oral Eron I option next to the IV options
    for a septic patient (`cellulitis-sepsis-elderly-diabetic/mgmt-no-oral-only`, quality, fails on
    both the base and this branch); a severity branch needs a decision (NICE NG141 first line is
    flucloxacillin; the protocol uses phenoxymethylpenicillin).

## Not done / hooks needed in other areas

- **HpiTab `seedInvestigationsFromPane`** (not this area): seeds stat/urgent investigations from
  **all top-3 PANE protocols, raw** — unadapted and ignoring `onlyIf` — so a pregnant patient can be
  seeded "CT abdomen/pelvis" from bowel obstruction, a low-risk syncope "CT head" from SAH, a post-
  thyroidectomy haematoma thyroid staging, a 30-week trauma a β-hCG from PID. Suggested change: seed
  from the leading (or confirmed) diagnosis only, through `adaptProtocolForPatient`. Until then the
  `sah` and `anaplastic_thyroid` ids are deliberately not aliased. Remaining quality fails from this:
  `appendicitis-pregnant-t2`, `periop-pregnancy-emergency-laparotomy-sbo`, `renal-colic-pregnant`
  (inv-no-ct-first), `trauma-pregnancy-30wk-rtc/inv-no-pregnancy-test`,
  `choledocholithiasis-asge-high-risk/inv-no-mrcp-before-ercp`, `breast-lump-under-30`.
- **Other raw-protocol readers** (`AmbientConsultation.tsx`, `SummaryTab.tsx` discharge medicines,
  `InvestigationsTab.tsx`, `investigation-suggestions.ts`, `AssessmentTab` leader lookup,
  `DictionaryTab.tsx`) still show protocols unadapted, with both `onlyIf` branches; they should call
  `adaptProtocolForPatient` (or `usePlanPatientContext`) — `SummaryTab` discharge medicines matter
  most (adult doses for children, allergy).
- **`clinical-inference.ts` prompts** (triage area): the remaining critical/quality fails in
  `web.clinicalPrompts` (colonic stent prompt, "not DOACs or warfarin" and inflammatory-breast
  wording matching the forbidden patterns, NBM from midnight / co-amoxiclav at induction in operative
  templates, fluid-bolus and insulin-dextrose prompts, PT/INR in pre-op bloods).
- **iOS parity**: none of the plan-safety filters or protocol changes has a Swift twin
  (`ManagementEngine*.swift`, `DiagnosisRadiationEngine`).
- **No protocol yet** for aorto-enteric fistula, inguinal lymphadenopathy, IgA vasculitis (HSP) — the
  PANE ids exist; triage recognises HSP.

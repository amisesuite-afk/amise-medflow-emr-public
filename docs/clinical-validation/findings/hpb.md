# HPB cluster — clinical validation findings

The HPB (hepatobiliary–pancreatic) vignettes compared with current guidelines. The seed
vignettes already covered appendicitis, TG18 cholecystitis grades I–III and cholangitis; this
cluster adds 32 vignettes on top of them.

- **Base:** `claude/pr-37-gbg22z` at 52616d2, branch `clinval-hpb`. No engine code or clinical
  data was changed.
- **Web:** `pnpm --filter @workspace/scripts run clinval:web`, run on 2026-09-25. These results are
  exact.
- **iOS:** not run. This machine is Linux, so the XCTest harness cannot run here. Every
  expectation that applies to iOS carries `unverified: ["ios"]`. The iOS outcomes in the last
  section are **predictions from reading the code**, not observations. Triage them after the
  next CI run.
- **Citations:** every citation is `verified: false`. The surgeon must check the statement
  numbering and wording against the source.
- **Thresholds:** no threshold was invented. Where a number could not be tied to a guideline,
  the expectation is `quality` and its note says why.

## Summary (web, the 32 HPB vignettes only)

| | Count |
|---|---|
| Vignettes | 32: 6 bases (biliary colic, choledocholithiasis, acute pancreatitis, painless jaundice, liver abscess, plus the seeded `cholecystitis-tg18-grade1` as the base for 6 cholecystitis permutations) |
| Expectations | 318: **199 pass, 117 fail, 2 n/a** |
| Critical expectations graded | 176: 122 pass, **54 fail** |
| Quality failures | 63 |
| Blocking failures | **0**. Every web failure is recorded as `knownGap: ["web"]`, with a `knownGapNote` (what the engine does instead) and a `proposedFix` |

The clean paths work. The classic painless-jaundice/pancreatic-head case passes every
expectation, and the NICE NG12 early pancreatic-cancer case passes once the PANE questions are
answered. The gallstone-pancreatitis-with-cholangitis case, pyogenic abscess drainage and
metastatic palliation also broadly work.

The failures fall into a few systemic causes, not 117 separate defects. In order of
patient-safety impact:

## Top safety gaps (ranked)

| # | Gap | Evidence (vignettes) | Guideline | Proposed fix (proposal only) |
|---|---|---|---|---|
| 1 | **Negated findings trigger operative plans, ERCP, laparotomy and antibiotics.** `clinical-inference.ts` `exam()`, `hasSx()` and `hasRadResult()` are plain substring tests: "no guarding" or any "guarding" produces a full **laparoscopic appendicectomy** operative plan (12/32 vignettes, including pancreatitis, CBD stones, pregnancy and inferior MI). "Murphy's sign negative" produces the Murphy's prompt and a **cholecystectomy** plan (pneumonia, hepatitis A, MI). "No peritonism" produces "**emergency laparotomy consent**" plus pip-tazo/metronidazole. `hasFever` matches "afebrile" and "Temperature 36.8"; `hasJaundice` matches "not jaundiced", so a pain-free biliary colic gets a **Charcot's triad → cholangitis** alarm. | `mgmt-no-appendicectomy` ×12; `mgmt-no-cholecystectomy` ×5; `biliary-colic-uncomplicated/no-cholangitis-alarm`; `liver-abscess-pyogenic/mgmt-no-open-surgery-first` | Wrong-procedure suggestions; TG18/WSES indications not met | A negation-aware matcher (NegEx-style) for every free-text test. Read fever from the temperature vital. Gate the operative-plan cascade (`hasAppendicitisIndication`, `hasGallstoneIndication`) on the working diagnosis, as the Alvarado block already does with `assessmentHasAppend`. |
| 2 | **Every acute pancreatitis plan says "Aggressive IV fluid resuscitation (Hartmann's 250–500 ml/h)"**: the protocol step, the medication ("500 ml Q2H — aggressive"), the lipase prompt and the dx-variant notes. This includes a 79-year-old with EF 30%, established respiratory failure with effusions, and pregnancy. No output mentions moderate or goal-directed fluids. The iOS template has the same text (code read). | `mgmt-no-aggressive-fluids` 8/8 web pancreatitis vignettes; `mgmt-moderate-fluids` 2/2 | WATERFALL (NEJM 2022, stopped for harm); ACG 2024 | Replace the text with moderate goal-directed lactated Ringer's (10 mL/kg bolus only if hypovolaemic, then 1.5 mL/kg/h, reassessed), in the pane-engine pancreatitis protocol, `dx-variants.ts`, `clinical-inference.ts` and iOS `DiagnosisRadiationEngine`. |
| 3 | **Dangerous mimics are missing from the primary differential, and their first test is not suggested.** Inferior STEMI: PANE has no ACS node (top 3 = inguinal hernia, cholecystitis, GORD); there is no troponin, and the only ECG is a "pre-operative baseline". Ruptured AAA: pancreatitis ranks first; the `aortic_aneurysm` prior after modifiers is 0.0024 for a 74-year-old male smoker, and it stays out of the top 3 even with `pulsatile_mass` and `haemodynamic_instability` answered true; there is no aortic imaging or vascular output, and I71.3 has no protocol mapping. RLL pneumonia: no PANE node; the CXR appears only as plan text in the hypoxia prompt. Symptom inference ranks AAA and pneumonia first, but it is a secondary view. | `biliary-colic-mimic-inferior-mi` (5 critical), `pancreatitis-mimic-ruptured-aaa` (3), `cholecystitis-mimic-rll-pneumonia` (4) | ESC 2023 ACS; ESVS 2024; NICE CG191 | Add mimic nodes (ACS, pneumonia) and calibrate AAA priors and LRs in `lib/pane-engine`, or add hard safety rules in `clinical-inference.ts`: epigastric pain + diaphoresis/brady-/hypotension + age/diabetes → stat ECG and troponin; age ≥60 + epigastric/back pain + shock/collapse → bedside US/CTA and vascular surgeon; RUQ pain + cough/hypoxia → CXR investigation. Map I20–I24 and I71 in `getProtocolByIcd`. |
| 4 | **ERCP is suggested without an indication.** The choledocholithiasis protocol lists "ERCP + sphincterotomy" unconditionally, including ASGE intermediate risk. The dilated-CBD prompt fires on any mention of "CBD" (4–6 mm ducts) and offers "ERCP — therapeutic" in low-risk gallstones and in 4 pancreatitis vignettes without cholangitis. The Charcot prompt says "arrange urgent ERCP" for hepatitis A with a 4 mm duct. | `choledocholithiasis-asge-intermediate`, `-low-risk`, `pancreatitis-*/mgmt-no-routine-ercp` ×4, `jaundice-mimic-acute-hepatitis-a` | ASGE 2019; ACG 2024; APEC 2020 | Add ASGE risk-stratum variants to the choledocholithiasis protocol and `dx-variants.ts`, fed by the existing `asgeCbd` scale. The dilated-CBD prompt should parse the diameter. The Charcot prompt should require cholestatic LFTs or duct dilatation before suggesting ERCP. |
| 5 | **Prophylactic antibiotics are shown in acute pancreatitis** (5 of the 8 vignettes without infection). The sources: the negated-peritonism prompt, the SIRS "Sepsis-6 … antibiotics" bundle, and the Assessment panel showing the *cholecystitis* protocol. No output states "no prophylactic antibiotics". | `mgmt-no-prophylactic-antibiotics` ×5 | ACG 2024; IAP/APA 2013; NICE NG104; AGA 2018 | Suppress these in a pancreatitis context without documented infection, and add an explicit "no prophylactic antibiotics" line to the protocol. |
| 6 | **Pregnancy safety.** Post-operative orders in the operative templates include **ibuprofen at 21–26 weeks** (all 3 pregnancy vignettes). The appendicectomy template asserts "**β-HCG confirmed negative**" at 26 weeks. No output involves obstetrics or fetal monitoring. CT is seeded from unrelated protocols (appendicitis, renal colic) and the unconditional CECT. The pregnancy red flag itself does fire (triage "Pregnancy mentioned"). | `mgmt-no-nsaid-after-20-weeks` ×3; `mgmt-obstetric-involvement` ×3; `inv-no-unqualified-ct` ×3 | FDA 2020; SAGES 2017; ACOG CO 723/775; ASGE 2012 | When pregnant: strip NSAIDs from 20 weeks, replace the β-HCG line with the gestation, add an obstetric review and fetal heart monitoring, and do not seed ionising imaging (`HpiTab.seedInvestigationsFromPane`). |
| 7 | **The Assessment management panel follows the PANE top, not the confirmed diagnosis** (`AssessmentTab`: PANE top ≥0.20 wins). Confirmed gallstone pancreatitis shows the cholecystitis protocol, with antibiotics. Confirmed amoebic abscess (A06.4, which is unmapped) shows the **appendicitis** protocol ("Laparoscopic appendicectomy"). Asymptomatic gallstones show "early LC within 72 h" plus IV antibiotics. | `pancreatitis-gallstone-mild`, `liver-abscess-amoebic`, `biliary-colic-asymptomatic-*` | — | Prefer the locked working diagnosis (ICD/disease id) over the PANE top. Map A06.4 to `liver_abscess`. |
| 8 | **Cholecystitis severity is under-graded, so the plan drops drainage.** The web TG18 calculator (`clinical-scores.ts`) has no Grade II criteria for duration >72 h, marked local inflammation (gangrenous) or a palpable mass. It returns Grade I for a CCI 8 / ASA IV patient failing antibiotics and for gangrenous cholecystitis in a transplant recipient. The dx-variant Grade I keyword "cholecystitis" is checked first, so the **Plan tab drops the conservative phase, which holds percutaneous cholecystostomy**; drainage survives only in the Assessment panel. "Gangrenous cholecystitis" is listed as Grade III (TG18 grades it II). Auto-fill returns "criteria not met" with WBC 19.4 and a characteristic US report. | `score-tg18-calculator` ×2; `mgmt-drainage-in-documented-plan`; `variant-grade2/3` ×4; `score-tg18-autofill` | TG18 (Yokoe 2018; Okamoto 2018; Mori 2018) | Add the missing Grade II inputs. Check variants III → II → I and move "gangrenous" to Grade II. Include the drainage phase in Grade II. Qualify "early LC" by CCI/ASA-PS. |
| 9 | **Aetiology-specific safety actions are missing.** Alcohol AP: no thiamine and no withdrawal management. Drug-induced AP: azathioprine is never stopped, and there is no steroid cover. Hypertriglyceridaemia AP: TG 31.4 mmol/L is flagged nowhere. `numLab` reads the first "amylase/lipase" key (amylase 140, lipaemic) rather than lipase 820, so no pancreatitis prompt fires at all. Amoebic abscess: no amoebicidal metronidazole and no luminal agent. | `pancreatitis-alcohol/mgmt-thiamine`; `pancreatitis-drug-induced*/mgmt-stop-azathioprine`; `pancreatitis-hypertriglyceridaemia/flag-hypertriglyceridaemia`; `liver-abscess-amoebic/mgmt-metronidazole` | NICE CG100; ACG 2024; Endocrine Society 2012; Haque NEJM 2003 | Add aetiology branches to the pancreatitis protocol (alcohol, drug, HTG ≥11.3 mmol/L); `numLab` should take the highest × ULN of amylase and lipase; add an amoebic branch with a luminal agent to the `liver_abscess` protocol. |
| 10 | **Moderately severe and severe pancreatitis get the wrong branch.** The lipase prompt says "same admission or within 2 weeks" cholecystectomy despite a 6 × 4 cm necrotic collection. `detectDxVariants` picks the group by text in array order, so "…No cholangitis…" in a pancreatitis assessment selects the *Cholangitis* group, no variant is found, and every phase appears (3 vignettes). "Moderately severe acute pancreatitis" contains "severe acute pancreatitis", so it becomes the severe variant. "40% pancreatic necrosis" would match the moderate variant first. | `pancreatitis-moderately-severe` (critical); `variant-*` ×4 | IAP/APA 2013; Atlanta 2012 | Gate same-admission cholecystectomy on mild AP without collections. `detectDxVariants`: match diseaseId/ICD across all groups before the text fallback (negation-aware); order the pancreatitis variants severe → moderately severe → mild, with non-overlapping phrases. |

Lower-impact but systematic:

- **Over-triage.** Every one of the 32 HPB vignettes is `emergency_now` on web, including an
  asymptomatic incidental-gallstone referral (score 100). The causes are negated history in the
  free text and the `rules.ts` cardiac rule matching "radiating to" (for example "radiating to
  the right shoulder blade"). This creates alarm fatigue; the fix is the same negation work.
- **Investigations.**
  - HPI completion seeds "CECT abdomen (assess pancreatic necrosis)" as an urgent order, dropping
    the protocol's conditional "at 48–72 h if severe or not improving". ACG 2024 says no CT at
    presentation.
  - The pancreatitis protocol has no triglycerides (3 fails).
  - MRCP is listed unconditionally for ASGE high risk, which is unnecessary before ERCP.
- **Scores.** The BISAP CDS rule ignores a locked "pancreatitis" working diagnosis and the lipase
  result, so BISAP is not suggested for mild or severe AP. It fires only through
  comorbidity-plus-chip combinations.
- **Timing.** The pancreatitis protocol says "ERCP within 72 h if cholangitis"; ACG 2024 and
  IAP/APA say within 24 h. The concurrent-cholangitis vignette still passes, through the TG18
  calculator text ("early biliary drainage (ERCP within 24–48 h)").
- **Coverage.** PANE has no biliary colic node, so pain-free biliary colic ranks as acute
  cholecystitis (0.73). The PANE inguinal-hernia prior (0.153 at 74 years) fills a top-3 slot in
  unrelated presentations: MI, acalculous cholecystitis, AAA, septic abscess. PANE ranks
  appendicitis above liver abscess for both abscess vignettes, and appendicitis second for
  hepatitis A.
- **Mapping.** The SOCRATES site "Periumbilical" maps to `rlq_pain` (`socrates-to-features.ts`
  SITE_RULES), which boosts appendicitis wherever pain is periumbilical, as in the AAA vignette.

## Per condition

### Biliary colic (4 vignettes: uncomplicated, 12 mm polyp, asymptomatic incidental stones, inferior-MI mimic)

- **Right.**
  - The polyp case keeps cholecystectomy and histology through the Assessment panel.
  - Blood tests and ultrasound are always suggested.
- **Wrong.**
  - No biliary colic node: a pain-free patient is labelled acute cholecystitis, and the panel
    shows IV antibiotics and "early LC within 72 h" (NICE CG188: elective LC).
  - Negated history produces emergency triage, a Charcot alarm, a dilated-CBD alarm for a 4 mm
    CBD, and an appendicectomy plan.
  - The polyp is never mentioned (ESGAR/EAES/EFISDS/ESGE 2022: ≥10 mm → cholecystectomy).
  - Asymptomatic stones get a cholecystectomy plan and antibiotics, with no reassurance or
    safety-netting (NICE CG188).
  - The inferior-MI mimic has no ACS anywhere, no troponin, and a cholecystectomy plan (ESC 2023).
- **Fix.**
  - Add a `biliary_colic` PANE node and protocol (K80.20 currently has no protocol).
  - Add a polyp-size prompt.
  - The negation and operative-plan gating from gap 1.
  - An ACS safety rule (gap 3).

### Acute cholecystitis permutations (6 vignettes: elderly diabetic atypical, acalculous ICU, pregnancy 22 weeks, high-risk Grade II, immunosuppressed gangrenous, RLL-pneumonia mimic)

- **Right.**
  - Cholecystitis stays in the PANE top 3 in all five true cholecystitis cases, including the
    sedated ICU patient and the afebrile 81-year-old.
  - The emergency level is at least urgent throughout.
  - The TG18 calculator grades WBC >18 → II and cardiovascular dysfunction → III correctly.
  - Blood cultures, antibiotics and the pregnancy flag are present.
  - The Assessment panel offers percutaneous cholecystostomy "if Grade III or unfit".
- **Wrong.**
  - Gap 8: missing Grade II criteria, Grade I variant first, drainage dropped from the Plan tab,
    unqualified "early LC within 72 h" for ASA IV (TG18: early LC only if CCI ≤5 and ASA-PS ≤2).
  - Auto-fill does not read imaging.
  - "Ibuprofen 400 mg TDS (if eGFR normal)" is inserted for an 81-year-old with CKD 3a, and at
    22 weeks' gestation (FDA 2020).
  - No immunosuppression flag or steroid cover (AAGBI/RCP/SfE 2020).
  - Pneumonia is absent from PANE; the CXR appears only as plan text; the gallbladder is normal
    but cholecystectomy and appendicectomy plans are offered.
- **Fix.** Gaps 1, 3, 6 and 8; an immunosuppression prompt.

### Choledocholithiasis — ASGE 2019 (5 vignettes: high risk, intermediate, low, pregnancy 26 weeks, elderly on warfarin)

- **Right.**
  - Choledocholithiasis is in the PANE top 3 (high risk, pregnancy, warfarin).
  - ERCP is offered in the high-risk strata.
  - MRCP is offered for intermediate risk.
  - INR/coagulation is requested.
  - A warfarin plan exists, but it is a generic "bridge with LMWH" pre-operative line. BSG/ESGE
    2021 would not bridge AF without a mechanical valve or recent VTE: over-bridging, recorded
    here as an observation, not an expectation.
- **Wrong.**
  - ERCP unconditional at ASGE intermediate risk (critical).
  - Low risk gets MRCP seeded and an ERCP from the false dilated-CBD prompt.
  - High risk still lists MRCP.
  - No malignant cause in the PANE top 3 for obstructive jaundice at 48 and 79.
  - Pregnancy: no fluoroscopy minimisation or obstetric input (ASGE 2012); ibuprofen, the
    β-HCG-negative line and an appendicectomy plan from "no guarding".
- **Fix.** ASGE risk variants (gap 4); pregnancy templates (gap 6).

### Acute pancreatitis — revised Atlanta 2012 (10 vignettes: mild gallstone base, moderately severe, severe, elderly HFrEF BISAP 4, with cholangitis, alcohol, hypertriglyceridaemia, pregnancy, drug-induced/immunosuppressed, ruptured-AAA mimic)

- **Right.**
  - Pancreatitis is in the PANE top 3 in all 9 true cases.
  - The emergency level is at least urgent in every case (web triage is emergency throughout).
  - Critical care is referenced for severe/BISAP ≥3 ("ITU if BISAP ≥3").
  - Same-admission cholecystectomy for mild gallstone AP is in the protocol (PONCHO/ACG 2024).
  - The concurrent-cholangitis case gets cholangitis at PANE #1, TG18 Grade II from both web
    calculators, blood cultures, antibiotics and early ERCP.
  - Alcohol cessation support is present.
  - The mild dx variant (when detected) has early oral feeding.
- **Wrong.**
  - Aggressive fluids everywhere (gap 2, WATERFALL/ACG 2024).
  - Prophylactic antibiotics (gap 5).
  - ERCP from the false dilated-CBD prompt in 4 cases without cholangitis (APEC 2020).
  - Routine NBM and no early oral feeding in the base case: the mild variant is not detected
    because "No cholangitis" selects the Cholangitis group.
  - CECT seeded at presentation.
  - No triglycerides.
  - BISAP not suggested.
  - "ERCP within 72 h if cholangitis" (ACG/IAP-APA: 24 h).
  - Moderately severe: same-admission cholecystectomy prompt despite a necrotic collection
    (IAP/APA 2013), and variant misread as severe.
  - Alcohol: no thiamine or withdrawal management (NICE CG100).
  - HTG: aetiology not recognised.
  - Drug-induced: azathioprine not stopped.
  - Pregnancy: ibuprofen, no obstetric input.
  - Abdominal compartment pressure is ignored in severe AP.
  - The AAA mimic is missed by PANE (gap 3).
- **Fix.** Gaps 2, 4, 5, 9 and 10; carry `conditional` through `seedInvestigationsFromPane`;
  BISAP CDS trigger on the working diagnosis or lipase.

### Obstructive / painless jaundice — pancreatic cancer (3 vignettes: pancreatic head base, elderly metastatic, non-jaundiced NICE NG12)

- **Right.**
  - The base case passes every expectation: pancreatic carcinoma at PANE #1, malignancy red
    flag, at least priority, pancreas-protocol CT, CA 19-9, EUS, INR, MDT, and no routine
    pre-operative stenting.
  - The metastatic case: pancreatic carcinoma #1, "biliary stenting for obstruction" in the
    unresectable branch, and no unconditional Whipple.
  - The NICE NG12 non-jaundiced case: pancreatic carcinoma at PANE #3 (with PANE answers), CT
    pancreas protocol, and a malignancy flag.
- **Wrong.** Frailty is not flagged (CFS 6) against the operative templates.
- **Fix.** A frailty prompt.

### Liver abscess (3 vignettes: pyogenic base, amoebic, elderly septic cholangitic)

- **Right.**
  - The pyogenic case: blood cultures, pip-tazo + metronidazole, US-guided aspiration/drain, CT,
    amoebic serology and aspirate culture (K75.0 protocol).
  - The septic case: emergency level, sepsis and haemodynamic alarms, antibiotics, HDU/ICU and
    biliary drainage (ERCP), with cholangitis at PANE #1.
- **Wrong.**
  - PANE ranks appendicitis above liver abscess in both abscess cases.
  - Amoebic: A06.4 has no protocol, and the panel shows the appendicitis protocol; no
    amoebicidal metronidazole and no luminal agent (Haque NEJM 2003, a narrative review: there
    is no formal guideline).
  - "Emergency laparotomy consent" from "No peritonism".
  - Sepsis is not in the PANE list.
- **Fix.** Gap 7 (map A06.4, panel follows the confirmed diagnosis); an amoebic branch; gap 1.

### Mimics (4: inferior STEMI, RLL pneumonia, ruptured AAA, hepatitis A)

- **Right.**
  - Hepatitis A: acute hepatitis at PANE #1 once the PANE questions are answered, INR and viral
    serology requested.
  - Every mimic reaches emergency/urgent level on web.
- **Wrong.**
  - Gap 3 (ACS, AAA, pneumonia).
  - Hepatitis A: the Charcot prompt says "arrange urgent ERCP", and the gallstone prompt offers
    cholecystectomy, for a hepatocellular picture with a normal duct.
- **Fix.** Gaps 1, 3 and 4.

## iOS (predicted from code, not observed; every iOS expectation is `unverified`)

- **Emergency level.** `ClinicalPathwayEngine` reads CC keywords only. Of the 30 vignettes with a
  level expectation, 22 are predicted to fail (21 critical). Natural complaints such as "Upper
  abdominal pain going through to the back", "Yellow eyes and upper abdominal pain in pregnancy"
  and "Fever and confusion" contain none of the urgent keywords ("jaundice", "pancreatitis",
  "severe pain", or "epigastric" plus "severe/radiating to back"). The colorectal branch *assigns*
  priority whenever the CC contains "weight loss", which could lower a jaundice-driven urgent.
  **Fix:** feed vitals, the text-parser alarms and structured symptoms into the acuity, and
  never de-escalate in a branch.
- **Differential.** Fallback mode (see ENGINE-MAP). Ultrasound results containing "gallbladder" or
  "gallstone" route to the `biliaryColic` pool, which is empty (`?? []`). "epigast" + "back" +
  "amylase" routes to the empty `acutePancreatitis` pool.
- **`DiagnosisRadiationEngine`** (first keyword match):
  - The pancreatitis template says "Hartmann's 250–500 mL/h initially (aggressive resuscitation in
    first 24h)" and "ERCP within 72h if … cholangitis" (gaps 2 and 4).
  - The choledocholithiasis template has "ERCP ± sphincterotomy + stone extraction (primary
    intervention)" at every ASGE stratum.
  - The cholecystitis template has no gallbladder drainage, so it fails the high-risk and
    acalculous drainage expectations unless the pipeline adds it.
  - There are **no entries** for liver abscess, amoebic abscess, pancreatic cancer or hepatitis,
    so no radiation card appears.
  - The ACS entry's keyword list contains `"mi"` and `"acs"` as substrings. Any HPB working
    diagnosis containing "mi" that no earlier entry matches would get the ACS card; "Mirizzi
    syndrome" is the obvious one. **Fix:** whole-word matching.
- **Calculators.** The iOS TG18 cholecystitis calculator has inputs for duration >72 h and marked
  local inflammation, so the high-risk and gangrenous vignettes should grade II on iOS (contrast
  with web gap 8). It still has no "palpable mass" input (seed finding).

## Harness observations (no change made)

- Neither harness runs a BISAP, Ranson or ASGE-CBD calculator (`web-runner.ts` and
  `ClinValIOSRunner.calculatorScores` map only Alvarado, AIR, TG18, qSOFA and SIRS), so BISAP
  *values* cannot be graded. Only "is it suggested" is tested.
- Prompt actions with `addToPlan` are graded as management, even when they are imaging or ECG
  (the CXR in the pneumonia vignette, the ECG in the MI vignette). The notes say where this gives
  partial credit.
- `unless` applies to the whole output item. Long operative templates contain incidental words
  ("avoid heavy lifting", "if"), so these vignettes use phrase-level regexes for the NSAID and
  antibiotic exclusions rather than bare words.
- PANE answers (`platform.web.paneAnswers`) are given only where the record contains that
  finding: gallstones on US, Murphy's sign, raised amylase/lipase, WBC, a pulsatile mass. The AAA
  and abscess results above include them.

## Vignettes

| Condition | Files (`ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/`) |
|---|---|
| Biliary colic | `biliary-colic-uncomplicated` (base), `-incidental-polyp`, `-asymptomatic-incidental-gallstones`, `-mimic-inferior-mi` |
| Acute cholecystitis (permutations of the `cholecystitis-tg18-grade1` seed) | `cholecystitis-elderly-diabetic-atypical`, `-acalculous-icu`, `-pregnancy-t2`, `-high-risk-grade2-drainage`, `-immunosuppressed-gangrenous`, `-mimic-rll-pneumonia` |
| Choledocholithiasis | `choledocholithiasis-asge-high-risk` (base), `-asge-intermediate`, `-asge-low-risk`, `-pregnancy`, `-elderly-warfarin` |
| Acute pancreatitis | `pancreatitis-gallstone-mild` (base), `-moderately-severe`, `-severe-organ-failure`, `-elderly-bisap-heart-failure`, `-gallstone-cholangitis`, `-alcohol`, `-hypertriglyceridaemia`, `-pregnancy`, `-drug-induced-immunosuppressed`, `-mimic-ruptured-aaa` |
| Painless jaundice / pancreatic cancer | `painless-jaundice-pancreatic-head` (base), `painless-jaundice-elderly-metastatic`, `pancreatic-cancer-new-diabetes-weight-loss`, `jaundice-mimic-acute-hepatitis-a` |
| Liver abscess | `liver-abscess-pyogenic` (base), `liver-abscess-amoebic`, `liver-abscess-elderly-biliary-septic` |

Every vignette also carries `mgmt-no-appendicectomy` (critical), because the appendicectomy
operative plan was the most frequent wrong-procedure output.

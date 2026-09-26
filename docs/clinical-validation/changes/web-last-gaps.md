# Change log — `web-last-gaps` (last web critical fails, queued hooks, quality fails)

Owner-authorised "fix all gaps found", 2026-09-25. Branch `web-last-gaps` from
`origin/claude/pr-37-gbg22z` at `aad528f`. Web dashboard, `lib/triage-engine` and the clinval web
runner only; no iOS code and no `DiagnosticDatabase.json`. The only files under `ios/` that changed
are clinical-validation vignette JSONs (web known-gap flags removed; `ios` flags kept).

Everything is clinician-facing and deterministic (no AI, no network). Every prompt line is a
suggestion the clinician confirms; nothing is ordered, prescribed or written without a tap. No
patient-facing text changed (hazard H-10). Free text is read with the negation-aware matcher
(`lib/triage-engine/src/negation.ts`). **Every citation below is unverified until the surgeon
checks it.**

## Results (`pnpm --filter @workspace/scripts run clinval:web`, 397 vignettes, 3087 expectations)

| | Pass | Fail | n/a | Critical fail | Quality fail | Blocking | Known-gap fail |
|---|---|---|---|---|---|---|---|
| Before (`aad528f`) | 2871 | 124 | 92 | 5 | 119 | 0 | 122 |
| After | **2919** | **76** | 92 | **0** | **76** | **0** | 74 |

48 expectations went from fail to pass (5 critical, 43 quality). **No expectation went from pass
to fail.** 48 `knownGap` `web` flags were removed; where `ios` was also listed, only `web` was taken
out (`cholangitis-tg18-grade1-single-criterion`, `cholecystitis-tg18-grade1` score auto-fill,
`periop-postop-aki-oliguria`). No expectation was weakened or deleted.

## Commits

| SHA | Change |
|---|---|
| `7ccc0aa` | TG18 auto-fill reads the record (Grade III with organ dysfunction) |
| `a81db8b` | Prompts: no colonic stent with impending perforation; inflammatory breast and pregnancy wording |
| `cd1c837` | Triage: asymptomatic screening requests not over-triaged; FIT / IDA triage tests |
| `855a32e` | Screening prompts read the surgical history and HPI; diabetes via `readPersonalRisk().knownDiabetes` |
| `7904271` | CDS: TG18 cholecystitis and BISAP suggested from the working diagnosis |
| `3c1e12f` | Prompts: operative templates, GI bleed, clotting screen, PE, potassium, trauma on anticoagulants |
| `04caae3` | Triage rules 1.4.0: diabetic foot red flag split per NICE NG19 |

## Task 1 — the last five web critical fails

| Vignette / expectation | Where the forbidden item came from | Fix |
|---|---|---|
| `breast-inflammatory-cancer` / mgmt-no-bcs-or-slnb | `clinical-inference.ts` inflammatory-breast prompt: "No wide local excision or SLNB …" (the grader reads a named procedure without a recognised qualifier as offered) | Reworded to the NCCN wording: "neoadjuvant systemic therapy first, then modified radical mastectomy with axillary node dissection. Breast-conserving surgery (wide local excision) and sentinel node biopsy are **not recommended** in inflammatory breast cancer (NCCN)." |
| `dvt-pregnancy-22wk` / mgmt-no-warfarin-in-pregnancy | Pregnancy obstetric prompt: "LMWH, not DOACs or warfarin" | "anticoagulation with LMWH — DOACs and warfarin are **contraindicated** in pregnancy (warfarin is teratogenic) (RCOG GTG 37a/b)" |
| `lbo-cancer-impending-caecal-perforation` / mgmt-no-stent-with-impending-perforation | Bowel-obstruction prompt step 5: "If LBO due to colonic malignancy: colonic stent as bridge to elective resection" for every obstruction | Step 5 now depends on the tumour and its contraindications (WSES 2018; ESGE 2020): perforation / free gas, peritonitis or peritonism, caecal ischaemia / pneumatosis, closed loop, caecum ≥ 12 cm → "Colonic stenting is contraindicated (…): emergency surgery — resection (subtotal colectomy when the caecum is ischaemic or perforating)"; right-sided tumour (caecum, ascending colon, hepatic flexure) → right (extended) hemicolectomy with primary ileocolic anastomosis, stent not routinely recommended; left-sided without contraindication → stent as a bridge (selected, MDT) or emergency resection / Hartmann's; a large-bowel obstruction of unknown cause → the conditional line; adhesional SBO → no stent line. Also clears `lbo-right-colon-cancer/mgmt-no-left-sided-plan-for-right-lesion`. |
| `cholangitis-tg18-grade3-reynolds` / score-tg18-autofill | ClinicalScoresPanel started with every toggle off, so the auto-filled grade was "criteria not met" | New `artifacts/dashboard/src/lib/tg18-autofill.ts` pre-fills the cards from the record (below). |
| `cholecystitis-tg18-grade3-organ-dysfunction` / score-tg18-autofill | Same | Same. |

### TG18 auto-fill (`tg18-autofill.ts`; ClinicalScoresPanel; clinval runner mirror)

- **Organ dysfunction** mirrors iOS `PatientScoreAutoPopulator+TG18Organ.swift` (`1f50221`):
  cardiovascular SBP < 90 or noradrenaline / norepinephrine / vasopressor / inotrope written (web
  adds metaraminol and vasopressin); neurological ACVPU other than Alert; renal creatinine
  > 2.0 mg/dL (177 µmol/L; a value > 20 is read as µmol/L) or oliguria / anuria written; hepatic
  INR > 1.5; haematological platelets < 100 × 10⁹/L; respiratory never inferred.
- **Cholangitis (Kiriyama 2018)**: fever / rigors / chills from the history or examination;
  clinical jaundice from the examination; biliary dilatation = measured CBD > 6 mm (> 8 mm after
  cholecystectomy) or written as dilated (the dilated-CBD rule already in the prompts); a biliary
  cause = duct stone / choledocholithiasis / stricture / stent in the imaging report; age ≥ 75.
- **Cholecystitis (Yokoe 2018)**: Murphy's sign (not "equivocal"); RUQ pain / tenderness / mass
  from the examination or history; imaging wall thickening, pericholecystic fluid, distended
  gallbladder, sludge, non-enhancing wall; palpable tender RUQ mass; duration > 72 h from "4 days",
  "80 hours" (three days is not > 72 h); marked local inflammation from gangrenous / emphysematous
  / intramural gas / abscess / perforation in the report or assessment.
- Every pre-filled toggle can be changed ("Pre-filled from the record — review each criterion").
- Also clears the quality auto-fill fails of `cholangitis-tg18-charcot-sepsis` (Grade II),
  `cholangitis-tg18-grade1-single-criterion` (Grade I), `cholecystitis-tg18-grade1` (Grade I),
  `cholecystitis-elderly-diabetic-atypical` (Grade II).

## Task 2 — queued hooks

| # | Hook | State |
|---|---|---|
| 1 | `adaptive-triage.ts` passes `freeText` and `labs: readCancerScreenLabs(...)` to `screenForCancer` | Already wired by `fix-web-triage`; this branch adds the missing tests (`artifacts/api-server/src/test/triage-screening-hooks.test.ts`): FIT 142 µg Hb/g and IDA at 66 (Hb 10.1, ferritin 8) raise the level to a same-day call; FIT < 4 does not. |
| 2 | Surgical history and HPI in `InferenceInput` | `historyText` (AppContext `freeText` + `hpiNotes`) and `surgicalHistory` were already passed by `ClinicalPromptsStrip`; the preventive adapter now uses them: the past surgical history joins the structured past history and the HPI joins the assessment as clinician notes. Hysterectomy, previous colonoscopy and polypectomy are read from them, negation-aware. `preventive.ts` 1.0.1: hysterectomy and last-normal-colonoscopy sentences that name a relative are skipped (as polyp sentences already were). |
| 3 | Diabetes prompts | `hasDiabetes` is now `readPersonalRisk(ownComorbidities).knownDiabetes` (entries naming a relative are removed first): previous gestational diabetes, pre-diabetes, diabetes insipidus, "screen for diabetes" and a relative's diabetes are not known diabetes. The type 1 basal-insulin peri-operative alert follows the same rule. |
| 4 | `lab-reader-keywords.ts` | The ferritin, MCV and FIT readers were already added by `fix-web-triage`; its test passes. This branch adds the eGFR reader (new `numLab('egfr')` call in the templates). |
| 5 | Screening over-triage from topic words | `adaptiveTriage`: when the history states there are no symptoms ("asymptomatic", "no bowel symptoms"), names a screening / risk / family-history topic, and no symptom chip other than an administrative one ("annual review") is recorded, the bare word "cancer" no longer raises "Possible malignancy". It is kept with a lump, mass, weight loss, night sweats, bleeding, change in bowel habit, dysphagia or nipple discharge. Family-history entries in the past history ("Family history of colorectal cancer (father, 58)") no longer count as the patient's higher-risk comorbidity. Clears `breast-family-history-brca`, `crc-screening-african-caribbean-fhx` and `screen-crc-fhx-sister-48-lynch-features` level fails. |

## Task 3 — quality fails fixed (clinical content, before → after)

| Topic | Before | After | Source |
|---|---|---|---|
| Fasting (lap chole, hernia templates) | "NBM from midnight" | Food up to 6 h, clear fluids up to 2 h before anaesthesia | AAGBI 2010; ESA 2011 |
| Lap chole prophylaxis | Co-amoxiclav 1.2 g at induction for everyone | Low-risk elective: not indicated (single dose if conversion, bile spillage, cholangiography); high-risk (acute cholecystitis, clinical jaundice, pregnancy, pancreatitis, immunosuppression): single dose per local policy | SIGN 104 |
| Post-cholecystectomy antibiotics | Co-amoxiclav 24 h ("complicated only") in every plan | None after biliary colic; cholecystitis: not needed for TG18 Grade I–II, only for complicated disease | TG18 |
| Post-appendicectomy antibiotics | Simple appendicitis: 24 h IV then 5 days oral co-amoxiclav | Uncomplicated: none. Complicated: pip-tazo 3–5 days after source control (max 7) — metronidazole dropped (pip-tazo already covers anaerobes) | WSES 2020; STOP-IT |
| Mesh hernia prophylaxis | Co-amoxiclav at induction ("optional") | Not routine for elective mesh repair in average-risk patients; single dose for emergency / contaminated repair | HerniaSurge 2018 |
| NSAIDs in templates | Ibuprofen 400 mg TDS for all ("if eGFR normal" in one) | Omitted with renal impairment (CKD, dialysis, eGFR < 60), age ≥ 75, heart failure, peptic ulcer / GI bleed history, or an anticoagulant | NICE NG148; BNF |
| VTE in templates | "Enoxaparin 40 mg night before + day of surgery" | NICE NG89 risk assessment; renal impairment → enoxaparin 20 mg if CrCl < 30; dialysis → UFH or renally adjusted LMWH per renal team | NICE NG89; BNF |
| Hernia template | Inguinal TAPP plan for every hernia, day-case discharge | Ventral (umbilical / paraumbilical / epigastric / incisional / parastomal) template: mesh for defects ≥ 1 cm, suture may be considered < 1 cm; cirrhosis / ascites → hepatology optimisation, planned inpatient repair, urgent if skin thinning / leak / incarceration | EHS/AHS 2020; EHS 2014 |
| Penicillin allergy in prompts | Penicillin line kept, with "avoid penicillins" appended | Each line proposing a penicillin is replaced by a withheld line (non-penicillin alternative per local guideline; after anaphylaxis also avoid cephalosporins / carbapenems unless allergy advice says otherwise). Lines that already deal with the allergy are left as written | Practice rule C5; BNF |
| GI bleed prompt | 2 large-bore cannulae, Hartmann's 500 mL, crossmatch 2 units for any bleeding | Only when haemodynamically significant (SBP < 90, shock index > 1, Hb < 80 g/L, or collapse / large volume): resuscitation, crossmatch, restrictive transfusion Hb 70 g/L (80 with CVD). Stable: Oakland (lower GI; ≤ 8 outpatient) or Glasgow-Blatchford (upper GI; 0–1 outpatient). HbA1c is never read as Hb | BSG 2019; NICE CG141; ESGE 2021 |
| Pre-op clotting | PT/INR + APTT for every surgical consultation | Only with liver disease, a vitamin K antagonist or heparin, a bleeding disorder, clinical jaundice or an emergency operation; anticoagulant prompt: INR for warfarin, no routine test with a DOAC | NICE NG45; PAUSE; ACCP 2022 |
| Suspected PE | "CTPA if Wells ≥ 2 and D-dimer positive" | Two-level Wells: > 4 → CTPA directly (interim anticoagulation if delayed); ≤ 4 → D-dimer, CTPA if positive; D-dimer unhelpful after surgery / in pregnancy | NICE NG158; ESC 2019 |
| Tachycardia with heart failure / PE | "No IV fluid challenge …" | "IV fluids withheld — BNP, echocardiography and diuretic review" | ESC 2021 HF; ESC 2019 |
| Hyperkalaemia | Insulin–glucose and salbutamol for any K⁺ > 5.5 | 5.5–5.9: treat the cause, repeat K⁺ (exclude haemolysis); ≥ 6.0: insulin–glucose; ≥ 6.5: add salbutamol | UKKA 2023 |
| Injury on an anticoagulant | Elective interruption / "no routine bridging" advice; emergency layer "do not simply hold / bridge" | Separate prompt: INR (warfarin) or last dose + renal function (DOAC); CT head within 8 h of a head injury; withhold until bleeding excluded; drug-specific reversal if bleeding confirmed or unstable. A haemothorax now counts as active bleeding | NICE NG232 2023; ACC 2020 ECDP |
| Imaging in children / pregnancy | Appendicitis signs: "CT abdomen/pelvis"; leucocytosis: "CT abdomen"; weight loss: CT C/A/P occult-malignancy screen | Child: ultrasound first, CT only if inconclusive; pregnancy: ultrasound first, MRI if inconclusive; no ionising occult-malignancy screen in pregnancy | WSES 2020; RCR iRefer; ACR 2018; ACOG CO 723 |
| Torsion | "Emergency scrotal exploration" unconditional (prompt and emergency layer) | "… if torsion cannot be excluded" | EAU 2024 |
| Asplenia vaccines | "MenACWY, MenB" | "meningococcal ACWY (MenACWY) and meningococcal B (MenB)" (schedule still per the Green Book) | UKHSA Green Book ch. 7 |
| CDS suggestions | TG18 cholecystitis never suggested; BISAP only from chips | TG18 cholecystitis from a cholecystitis working diagnosis / assessment (or RUQ pain + fever), shown in ScalesTab with the pre-filled card; BISAP from an acute pancreatitis working diagnosis ("pancreatitis excluded" does not fire) | Yokoe 2018; Wu 2008 / ACG 2024 |
| Diabetic foot red flag (rules 1.4.0) | Any "foot ulcer", "foot wound" or "spreading redness" = urgent (emergency) | Gangrene, foot infection, osteomyelitis, exposed bone: urgent. Ulcer / wound: priority (foot protection / MDT within 1 working day). "Spreading redness" alone: not a diabetic-foot flag | NICE NG19 |

Versions and registry: `RULES_VERSION` 1.3.0 → 1.4.0, `EMERGENCY_RULES_VERSION` 1.0.0 → 1.0.1
(wording), `PREVENTIVE_SCREENING_VERSION` 1.0.0 → 1.0.1; changelog entries for
`triage-rules-red-flags`, `emergency-recognition`, `preventive-screening`, `adaptive-triage`,
`web-clinical-cds` and `web-clinical-scales` (new file `tg18-autofill.ts`, added to the inventory and
the lint's `KNOWN_RULE_SET_FILES`). `lastReviewed` stays `unknown`.

## Tried and reverted

A "stable physiology" grading in `adaptiveTriage` (HR, SBP, RR, SpO₂ recorded, NEWS2 low band, no
vital red flag → keyword red flags one step lower and the summed points ignored) cleared 16 level
fails but turned 9 passing expectations into fails, 8 of them critical (`hernia-obturator-sbo-
elderly-woman`, `hernia-paraumbilical-incarcerated-obese`, `sbo-strangulated-femoral-hernia` and
`variceal-bleed-unrecognised-cirrhosis` level-emergency; `lbo-right-colon-cancer`,
`crohns-perianal-complex-fistula`, both UC vignettes). Those emergencies reach "emergency" only
through the summed score, not through the emergency layer. It was reverted; see "Not done".

## Tests

- `artifacts/dashboard/src/lib/__tests__/web-last-gaps.test.ts` (37): TG18 auto-fill (each organ
  rule, respiratory never, Grade I/II/III vectors, CBD limits, equivocal Murphy, duration), the IBC /
  pregnancy wording, the LBO stent branches, screening from surgical history / HPI (and relatives
  skipped), `knownDiabetes`, every template and prompt change above.
- `artifacts/dashboard/src/lib/__tests__/cds-working-diagnosis.test.ts` (2).
- `artifacts/api-server/src/test/triage-screening-hooks.test.ts` (12): FIT / IDA triage, screening
  requests, family-history comorbidity, diabetic foot flags.
- `preventive-screening.test.ts`: version 1.0.1.

Verified: `pnpm run typecheck`; `pnpm -r run test` (pane-engine 126, scripts 35, front-desk 109,
api-server 600, dashboard 761); every scripts lint (`lint:grants`, `lint:rls-policies`,
`check:migrations-fresh`, `lint:dx-phases`, `lint:patient-instructions`, `scan:nav-lockout`,
`lint:no-external-qr`, `lint:interaction-parity`, `lint:report-import-parity`,
`lint:guideline-registry`); the dashboard build; `clinval:web` (0 blocking, no pass → fail). The
results files were restored, not committed.

## Not done (remaining 76 web quality fails)

- **Differential (31 `mustNotMiss`)**: PANE area (no node for AF, NAI, pouch, EoE, pseudoaneurysm;
  ranking).
- **Triage level (21)**: over-triage from keyword red flags and the summed points (bleeding words,
  post-operative words, "syncope", age + comorbidity + antiplatelet). The reverted experiment above
  shows the summed score is currently the only route to "emergency" for several surgical
  emergencies. A safe fix needs (1) the emergency layer to recognise strangulated / obstructed
  hernia, variceal bleeding and acute severe colitis directly, then (2) the stable-physiology
  grading. Needs a surgeon decision (sign-off item 12).
- **Score suggestions without a web calculator (16)**: AIR, AAS, PAS, LRINEC, Oakland, shock
  index, Boey, Truelove-Witts, P-POSSUM trigger, ASA for a fit patient, CHA₂DS₂-VASc for incidental
  AF. Each needs a calculator card before a CDS rule can point to it.
- `biliary-colic-asymptomatic-incidental-gallstones` (plan lists polyp / cholecystectomy lines from
  the K80.20 protocol; triage reads a negated list as positive — `negation.ts` has an iOS twin),
  `cellulitis-sepsis-elderly-diabetic` (Eron I oral option — sign-off item 14 of fix-web-protocols),
  `hernia-paraumbilical-incarcerated-obese` dx variant (E1 sign-off), `renal-colic-pregnant`
  analgesia (O26.8 has no protocol), `dfu-ischaemic-calcified-abpi` (incompressible vessels flag),
  two alarm expectations (`acutemed-pe-post-lap-chole-pleuritic`, `biliary-colic-mimic-inferior-mi`).
- **Noticed, not changed**: the appendicectomy template's pre-operative "Pip-Tazo 4.5 g +
  Metronidazole 500 mg at induction" also doubles anaerobic cover (sign-off item 13).
- **iOS parity**: none of the prompt, template, CDS or triage changes has a Swift twin; the TG18
  organ rule is the iOS rule.

## Needs sign-off

1. **TG18 auto-fill** reads the record and pre-ticks criteria (Grade III whenever one organ rule is
   met). Web additions to the iOS organ rule: metaraminol and vasopressin count as vasopressors.
   Age ≥ 75 (TG18 wording; iOS uses > 75). Duration > 72 h read from "N days / hours" in the HPI.
2. **Colonic stent contraindications**: perforation / free gas, peritonitis *or peritonism
   (guarding / rebound)*, ischaemia / pneumatosis, closed loop, caecum ≥ 12 cm; right-sided =
   caecum, ascending colon, hepatic flexure (transverse colon is not classed).
3. **Asymptomatic screening request** rule (triage): an explicit "no symptoms" statement plus a
   screening / family-history topic and no symptom chip; the features that keep the flag.
4. **Family-history entries** no longer count as a higher-risk comorbidity in triage.
5. **SIGN 104 high-risk list** used for lap chole prophylaxis (acute cholecystitis, clinical
   jaundice, pregnancy, pancreatitis, immunosuppression); "per local antimicrobial policy" instead
   of a named drug.
6. **Mesh hernia prophylaxis** not routine in average-risk elective repair (HerniaSurge 2018).
7. **Complicated appendicitis**: pip-tazo 3–5 days after source control (maximum 7), metronidazole
   removed from the post-operative line.
8. **NSAID exclusions** in templates: renal impairment (CKD, dialysis, eGFR < 60), age ≥ 75, heart
   failure, peptic ulcer / GI bleed history, anticoagulant.
9. **Renal VTE line**: enoxaparin 20 mg once daily if CrCl < 30; UFH or renally adjusted LMWH on
   dialysis per renal team.
10. **GI bleed instability** definition: SBP < 90, shock index > 1, Hb < 80 g/L, or collapse /
    syncope / large volume / clots in the history; stable bleeding → Oakland / Glasgow-Blatchford
    first.
11. **Pre-op clotting** (NICE NG45): only liver disease, vitamin K antagonist or heparin, bleeding
    disorder, clinical jaundice (sign, symptom or bilirubin ≥ 34 µmol/L) or emergency surgery; no
    routine test with a DOAC.
12. **Triage over-triage** (not changed): whether keyword red flags with normal observations (NEWS2
    low band) should mean same-day / 24–48 h review rather than "emergency now", once the emergency
    layer recognises strangulated hernia, variceal bleeding and acute severe colitis directly.
13. **Appendicectomy induction prophylaxis** (not changed): pip-tazo + metronidazole doubles
    anaerobic cover — choose a single regimen.
14. **Penicillin allergy**: penicillin lines in prompts are withheld (replaced), not annotated; the
    cephalosporin / carbapenem caution after anaphylaxis is stated.
15. **Diabetic foot flags (rules 1.4.0)**: ulcer / wound as priority (1 working day), gangrene /
    infection / osteomyelitis / exposed bone as urgent; "spreading redness" removed.
16. **Hyperkalaemia bands** (UKKA 2023): no shift therapy at 5.5–5.9; salbutamol only ≥ 6.5.
17. **Two-level Wells** wording and "D-dimer unhelpful after recent surgery and in pregnancy".
18. **Cirrhosis with ascites** before hernia repair: planned inpatient repair after hepatology
    optimisation (ascites control, TIPS considered).
19. **Wording changes to the emergency layer** (1.0.1): torsion exploration "if torsion cannot be
    excluded"; anticoagulated head injury "drug-specific reversal if intracranial bleeding is
    confirmed".

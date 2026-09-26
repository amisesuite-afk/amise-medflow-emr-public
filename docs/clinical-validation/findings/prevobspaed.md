# Prevention, obstetric/gynaecological mimics and paediatric surgery cluster — clinical validation findings

This cluster covers three areas the practice meets but the engines were not built around:
screening and preventive care, obstetric and gynaecological emergencies that present as surgical
abdomens, and paediatric surgical emergencies. It adds 40 vignettes: 19 screening/prevention,
11 obstetric/gynaecological and 10 paediatric.

- **Base:** `claude/pr-37-gbg22z` at 9194b40, branch `clinval-prevobspaed`. That base includes the
  negation-aware / whole-word matching fixes (triage, prompts, PANE mapping, dx variants, iOS
  radiation lookup) and the later iOS negation work.
  - The vignettes were first measured on b63c935 (before the fixes), then re-measured on 3290530
    and 9194b40. The cluster's web results are identical on 3290530 and 9194b40.
  - "What the matching fixes changed" below lists the difference.
  - No engine code, clinical data, threshold or wording was changed.
- **Web:** `pnpm --filter @workspace/scripts run clinval:web`, 2026-09-25. These results are exact.
- **iOS:** not run. This machine is Linux, so the XCTest harness cannot run here. Every expectation
  that applies to iOS carries `unverified: ["ios"]`. The iOS section is a **prediction from
  reading the code** (and from `results/ios-latest.jsonl` for similar vignettes), not an
  observation.
- **Citations:** all `verified: false`. The surgeon must check the section wording against the
  source.
- **Thresholds:** no number was invented. Where a guideline gives a number (BP ≥ 160/110 in
  pregnancy, AAA screening at 65–75, HPV testing from 30), it is quoted. Paediatric dosing
  expectations only check that *fixed adult* doses are absent; they never assert a paediatric dose.

## Summary (web, the 40 new vignettes only)

| | Count |
|---|---|
| Vignettes | 40: 19 screening/prevention, 11 obstetric/gynaecological, 10 paediatric. 11 are new bases (average-risk CRC screening, tetanus-prone wound, ovarian torsion, PID, HELLP, hyperemesis, intussusception, pyloric stenosis, malrotation, HSP, febrile infant); the others are permutations, including permutations of existing vignettes (`mimic-ectopic-pregnancy`, `appendicitis-pregnant-t2`, `trauma-pregnancy-30wk-rtc`, `appendicitis-paediatric-9y`, `mimic-dka-abdominal-pain`, `trauma-paediatric-nai-bruising`, `polyp-surveillance-high-risk-3y`, `breast-family-history-brca`, `dyspepsia-young-no-alarm-test-and-treat`, `trauma-splenic-injury-unstable`) |
| Expectations | 265: **133 pass, 119 fail, 13 n/a** (n/a = iOS-only `pathway` expectations) |
| Critical expectations graded (web) | 126: 64 pass, **62 fail** |
| Quality failures | 57 |
| Blocking failures | **0**. 118 web failures are `knownGap: ["web"]` with a `knownGapNote` (what the engine does now) and a `proposedFix`; 1 is `unverified: ["web"]` because of a harness limit (family history is not passed, see below) |

Whole suite on this base: 397 vignettes, 3087 expectations, 1882 pass, 1113 fail, 92 n/a,
0 blocking. `pnpm --filter @workspace/scripts run test` passes, and all 397 vignettes validate
against `vignette.schema.json` (checked with a draft 2020-12 validator).

What works:

- The gynaecology protocols are good once reached.
  - Ovarian torsion ranks first in PANE in both torsion vignettes. The protocol says detorsion,
    ovarian preservation and "Doppler flow does not exclude torsion".
  - The PID protocol matches CDC 2021: ceftriaxone 500 mg IM, doxycycline and metronidazole for
    14 days, NAAT, HIV/syphilis testing, partner notification and TOA drainage.
  - `gyn-pid-young-woman` and `obs-ectopic-with-ius-stable` now pass every expectation.
- Preschool perforated appendicitis ranks first in PANE.
- The screening prompts produce a mammogram at 42 and LDCT plus smoking cessation for smokers
  ≥ 50.

### What the matching fixes changed (b63c935 → 3290530 / 9194b40)

- **14 expectations went from fail to pass** and their flags were removed:
  - Appendicectomy plans from "no guarding" in PID, HSP and ectopic-with-IUS.
  - "β-HCG confirmed negative" with an IUS.
  - "Emergency laparotomy consent" from "no peritonism" / "no free air" (hyperemesis,
    intussusception, inflicted injury).
  - Six screening over-triage/banner expectations: "no chest pain", "no haemoptysis", "no
    post-coital bleeding", "no bleeding" and "no weight loss" no longer escalate.
  - Tetanus-wound triage.
  - HSP adult doses (the appendicectomy template's pip-tazo went away). This one fails again,
    because the dose check was then widened to catch "Hartmann's 500ml bolus", which the HSP
    GI-bleed prompt still gives a 21 kg child.
- **2 expectations went from pass to fail** (both now flagged):
  - `screen-hypertension-accelerated-papilloedema/level-urgent` (**critical**): BP 208/126 with
    papilloedema is now `routine_booking`, score 0. It had passed only because the negated
    "No chest pain" raised "Possible cardiac event". Blood pressure is not a triage input at all
    (gap 2).
  - `paed-nai-duodenal-haematoma/mgmt-non-operative-duodenal`: the NG-decompression line had come
    from a bowel-obstruction prompt fired by a negated finding.
- The Assessment panel now follows the confirmed diagnosis. The HELLP and postpartum vignettes no
  longer show the cholecystitis/GORD protocols; they show nothing, because O14.x maps to no
  protocol.

## Web results

| Vignette | Pass | Fail | n/a | Critical pass / graded |
|---|---|---|---|---|
| `gyn-ovarian-torsion-dermoid` | 5 | 1 | 0 | 3/4 |
| `gyn-ovarian-torsion-premenarchal-11` | 5 | 1 | 0 | 3/4 |
| `gyn-pid-young-woman` | 9 | 0 | 0 | 4/4 |
| `gyn-pid-tubo-ovarian-abscess-sepsis` | 8 | 1 | 0 | 5/6 |
| `gyn-ruptured-haemorrhagic-cyst-apixaban` | 6 | 3 | 0 | 4/6 |
| `obs-ectopic-with-ius-stable` | 7 | 0 | 0 | 5/5 |
| `obs-appendicitis-pregnancy-t3` | 6 | 3 | 0 | 3/6 |
| `obs-hellp-ruq-pain-34wk` | 3 | 8 | 0 | 3/10 |
| `obs-postpartum-preeclampsia-epigastric` | 1 | 5 | 0 | 1/5 |
| `obs-abruption-concealed-partner-assault` | 5 | 6 | 1 | 3/9 |
| `obs-hyperemesis-gravidarum` | 5 | 6 | 0 | 2/3 |
| `paed-intussusception-infant-classic` | 4 | 5 | 0 | 1/5 |
| `paed-intussusception-lethargy-atypical` | 3 | 2 | 0 | 2/4 |
| `paed-pyloric-stenosis-alkalosis` | 4 | 6 | 0 | 1/6 |
| `paed-malrotation-volvulus-bilious-neonate` | 5 | 4 | 0 | 2/6 |
| `paed-malrotation-labelled-reflux` | 3 | 4 | 0 | 2/6 |
| `paed-appendicitis-preschool-perforated` | 5 | 3 | 0 | 3/4 |
| `paed-hsp-abdominal-pain` | 5 | 2 | 0 | 3/4 |
| `paed-dka-new-onset-abdominal-pain` | 7 | 4 | 0 | 6/10 |
| `paed-febrile-infant-7wk-hernia-clinic` | 3 | 6 | 0 | 2/5 |
| `paed-nai-duodenal-haematoma` | 3 | 6 | 1 | 1/4 |
| `screen-crc-average-risk-46` | 1 | 3 | 1 | — |
| `screen-crc-fhx-sister-48-lynch-features` | 0 | 3 | 1 | — |
| `screen-older-man-81-overscreening` | 1 | 4 | 1 | — |
| `screen-polyp-low-risk-no-surveillance` | 1 | 1 | 0 | — |
| `screen-polyp-piecemeal-emr-site-check` | 1 | 1 | 0 | — |
| `screen-breast-average-risk-42` | 4 | 1 | 1 | — |
| `screen-breast-brca1-carrier-33` | 1 | 4 | 0 | — |
| `screen-cervical-hpv-overdue-34` | 2 | 1 | 1 | — |
| `screen-post-hysterectomy-no-cervical-52` | 3 | 1 | 1 | 1/1 |
| `screen-prostate-58-shared-decision` | 2 | 1 | 1 | — |
| `screen-hypertension-clinic-bp-confirm` | 2 | 3 | 1 | — |
| `screen-hypertension-accelerated-papilloedema` | 2 | 3 | 0 | 1/3 |
| `screen-diabetes-38-overweight-prior-gdm` | 2 | 1 | 0 | — |
| `screen-aaa-lung-ex-smoker-68` | 2 | 1 | 1 | — |
| `screen-hepatitis-b-c-hiv-once` | 0 | 3 | 1 | — |
| `screen-hpylori-fdr-gastric-cancer` | 1 | 2 | 0 | 1/1 |
| `screen-tetanus-prone-wound-unknown-status` | 2 | 3 | 0 | 1/3 |
| `screen-post-splenectomy-vaccination` | 1 | 6 | 0 | 1/2 |
| `screen-cv-risk-lipids-smoker-52` | 3 | 1 | 1 | — |

The screening vignettes' web expectations are `quality`, except these critical ones:
accelerated hypertension, tetanus prophylaxis, pneumococcal vaccination after splenectomy, and
the iOS antithrombotic regression guards (which pass on web).

## Top 10 safety gaps (ranked)

| # | Gap | Evidence (vignettes) | Guideline | Proposed fix (proposal only) |
|---|---|---|---|---|
| 1 | **Paediatric surgical emergencies do not exist in the primary engines.** PANE (130 diseases) has no intussusception, pyloric stenosis or malrotation/volvulus. Q40.0 and Q43.3 map to no protocol, and K56.1 maps to the *adult* bowel-obstruction protocol ("drip and suck", water-soluble contrast at 24 h, colonic stenting, Hartmann's). No rule treats **bilious vomiting in an infant** as an emergency. Nothing suggests an upper GI contrast study, enema reduction, a pyloric ultrasound, correction of alkalosis before pyloromyotomy, or paediatric surgery. The neonate with volvulus instead gets the adult bowel-obstruction pathway: "CT abdomen/pelvis with IV contrast", "IV Hartmann's 1–2L + IDC", colonic stenting and an operative plan. The redcurrant-jelly stool gets the adult GI-bleed prompt ("Urgent OGD / colonoscopy", "reverse anticoagulation … PCC"). Symptom inference ranks these conditions first or second, but it is a secondary view and its investigations are not surfaced. | `paed-malrotation-*` ×2, `paed-intussusception-*` ×2, `paed-pyloric-stenosis-alkalosis`: 19 critical fails (14 without the dose checks counted in gap 3) | Langer 2017; ACR AC vomiting in infants 2020; APSA 2021; Pandya 2012 | PANE nodes and protocols for the three conditions with a paediatric-surgery referral; a hard rule "green vomit in a child < 1 year → emergency, upper GI contrast, immediate paediatric surgery" in `clinical-inference.ts` and `adaptiveTriage`. |
| 2 | **Blood pressure is invisible to triage, and pre-eclampsia/HELLP does not exist.** `computeVitalRedFlags` has no high-BP flag. BP 208/126 with headache, blurred vision and papilloedema is `routine_booking` (score 0). The `hypertensive_urgency` prompt (SBP ≥ 180) offers oral amlodipine "over 24–48 h"; its IV line starts at 220, and the recorded papilloedema is ignored (NICE NG136: same-day referral). There is no PANE node for pre-eclampsia, and 164–168/110–112 in pregnancy (severe range ≥ 160/110) raises nothing. HELLP at 34 weeks, referred as "?gallbladder", gets biliary prompts: a cholecystectomy operative plan and consent (the gallstone prompt fires on an ultrasound report that says "no gallstones"), and MRCP, ERCP and "Whipple review" from "CBD 4 mm". There is no magnesium, labetalol/nifedipine or obstetric output. Postpartum pre-eclampsia (162/106, headache, visual disturbance) is triaged `priority_24_48h`. | `screen-hypertension-accelerated-papilloedema` (2 critical), `obs-hellp-ruq-pain-34wk` (7), `obs-postpartum-preeclampsia-epigastric` (4) | NICE NG136; NICE NG133; ACOG PB 222 | BP red flags in `adaptiveTriage` (SBP ≥ 180 / DBP ≥ 120 → urgent; with papilloedema, retinal haemorrhage, encephalopathy, chest pain or AKI → emergency; ≥ 160/110 in pregnancy or ≤ 6 weeks postpartum → urgent). A pre-eclampsia rule (BP ≥ 140/90 plus headache, visual disturbance, epigastric/RUQ pain, proteinuria, platelets < 100 or raised transaminases) → obstetric emergency, magnesium, labetalol/nifedipine, delivery planning, suppressing the biliary templates. Needs a postpartum input. |
| 3 | **Children get adult doses, and normal infant vital signs trigger adult shock bundles.** All 11 vignettes under 16 fail `mgmt-no-adult-fixed-doses`. Examples: piperacillin-tazobactam 4.5 g, co-amoxiclav 1.2 g, paracetamol 1 g, ibuprofen 400 mg, morphine 5 mg, meropenem 1 g, "Hartmann's 1L bolus", "Hartmann's 500ml bolus" (≈ 54 mL/kg for a 9.2 kg infant) and "IV fluid challenge 500ml", for patients of 3.4–38 kg. `computeClinicalPrompts` and `adaptiveTriage` use adult thresholds (SBP < 90, HR > 100/110/120, RR > 24), so a well-perfused neonate with SBP 75 is labelled "shock" and a 7-week-old "septic shock". That brings adult bundles: vasopressors "if MAP < 65", urinary catheter, CT abdomen. | all `paed-*`, `gyn-ovarian-torsion-premenarchal-11` | BSPED 2021; NICE NG143 (and every paediatric source cited) | An age/weight branch in protocol medications and prompt templates (mg/kg and mL/kg with adult maximum; suppress fixed doses when age < 16 or weight < 50 kg); age-specific vital-sign ranges before the shock/sepsis/tachycardia prompts; pass `weightKg` to the engines. |
| 4 | **Safeguarding is absent: intimate-partner violence in pregnancy and child maltreatment.** An abruption after "pushed by my partner" produces no abruption, CTG, obstetric team, left lateral tilt or domestic-abuse output (O45.8X3 maps to nothing; PANE top 3 is cholecystitis, blunt trauma and splenic laceration, all < 0.20). A duodenal haematoma with pancreatic contusion, patterned bruises of different ages, an old rib fracture and a changing history gets no safeguarding flag and no child protection referral (T74.12XA maps to nothing). Instead it gets the adult pancreatitis prompt, including "interval laparoscopic cholecystectomy — gallstone pancreatitis". | `obs-abruption-concealed-partner-assault` (6 critical fails), `paed-nai-duodenal-haematoma` (2) | ATLS 10; RCOG GTG 63; NICE PH50; NICE CG89 | A trauma-in-pregnancy protocol (pregnancy status + mechanism); an IPV rule (partner/assault wording) and a child-maltreatment rule (visceral injury without a confirmed accidental cause, patterned bruising, inconsistent history, delayed presentation) that raise a safeguarding flag and referral action. Local referral contacts are needed from the practice. |
| 5 | **Operative templates keyed to signs and words rather than the diagnosis.** The appendicectomy operative plan (consent, theatre, pip-tazo at induction) fires from affirmed guarding in 5 non-appendix vignettes: both torsions, the TOA, the haemoperitoneum on apixaban and DKA in a child. A cholecystectomy operative plan appears in HELLP (see gap 2). An adult **laparoscopic inguinal TAPP with mesh** appears for a febrile 7-week-old's small reducible umbilical hernia, and for an umbilical hernia with BP 208/126. A traumatic pancreatic contusion in a 3-year-old gets "interval cholecystectomy". A neonatal volvulus gets a bowel-obstruction operative plan with contrast CT. | 4 × `mgmt-no-appendicectomy`, `paed-febrile-infant-7wk-hernia-clinic/mgmt-no-emergency-hernia-repair`, `obs-hellp…/mgmt-no-cholecystectomy`, `screen-hypertension-accelerated…/mgmt-no-proceed-with-surgery`, `paed-nai…/mgmt-non-operative-duodenal` | WSES 2020; ACOG CO 783; NICE NG143; NICE NG136 | Gate every operative-plan prompt on the working diagnosis (as the Alvarado block already does); choose hernia templates by hernia type and age; suppress elective templates while a sepsis, fever-in-infant or hypertensive-emergency prompt is active. |
| 6 | **Prevention after injury or surgery is missing.** A tetanus-prone farm laceration with unknown immunisation gets no vaccine, no immunoglobulin and no wound care: S51 maps to nothing, and no prompt reads wounds. Tetanus toxoid exists only inside the major-trauma, burns and splenic protocols. Fourteen days after a trauma splenectomy, coded Z90.81, the web produces **no management output at all**: post-splenectomy vaccines live only in the S36 splenic-laceration protocol, and nothing reads "splenectomy" in the surgical history. | `screen-tetanus-prone-wound-unknown-status` (2 critical), `screen-post-splenectomy-vaccination` (1 critical + 5 quality) | ACIP 2018; UKHSA 2019; BSH 2011 | A wound prompt (tetanus-prone classification × immunisation status → vaccine ± HTIG); an asplenia prompt from surgical history or D73.0/Z90.81 (pneumococcal, Hib, MenACWY/MenB, influenza, prophylaxis, alert card). The practice must choose which national schedule to encode. |
| 7 | **Haemorrhage on a DOAC gets an elective bridging plan.** A haemoperitoneum from a corpus luteum cyst in a woman on apixaban (HR 118, BP 96/60) gets "Anticoagulant bridging: hold DOAC 48–72h pre-op; warfarin — bridge with LMWH". There is no reversal, and the ovarian-cyst protocol adds ibuprofen 400 mg TDS. The anticoagulant flag, crossmatch and emergency level are correct. | `gyn-ruptured-haemorrhagic-cyst-apixaban/mgmt-anticoagulant-reversal` | ACC 2020 ECDP | A bleeding-on-anticoagulant branch: stop, reverse (andexanet/4F-PCC for factor Xa inhibitors; vitamin K + PCC for warfarin), haematology; no NSAIDs. |
| 8 | **Pregnancy-unsafe templates persist** (HPB gap 6 confirmed in new permutations). At 32 weeks with MRI-confirmed appendicitis: "paracetamol 1g QDS + ibuprofen 400mg TDS (regular)", "β-HCG confirmed negative (female of reproductive age)", and no obstetric team or fetal monitoring for a viable fetus. HELLP at 34 weeks with platelets 72 gets ibuprofen. Hyperemesis at 10 weeks gets "CT chest/abdomen/pelvis — occult malignancy screen" from the weight-loss prompt. | `obs-appendicitis-pregnancy-t3` (3 critical), `obs-hellp-ruq-pain-34wk`, `obs-hyperemesis-gravidarum` | ACOG CO 775; SAGES 2017; FDA 2020; ACOG CO 723 | When pregnant: strip NSAIDs from 20 weeks, replace the β-HCG line with the gestation, add obstetric review and fetal monitoring, and do not seed CT as a screen. |
| 9 | **Paediatric and obstetric medical mimics are not recognised.** DKA in a 9-year-old referred as "?appendicitis" is absent from PANE. The glucose prompt fires but is the adult pathway ("VRIII", no cerebral-oedema monitoring), next to an appendicectomy template. A febrile 7-week-old (NICE NG143 red feature) gets no paediatric referral, no lumbar puncture and no infant antibiotic regimen, only the adult septic-shock bundle. Hyperemesis gravidarum gets no thiamine (Wernicke risk), no fluids with potassium, no LMWH and no viability scan. | `paed-dka-new-onset-abdominal-pain` (4 critical), `paed-febrile-infant-7wk-hernia-clinic` (3), `obs-hyperemesis-gravidarum` (thiamine) | BSPED 2021; ISPAD 2022; NICE NG143; RCOG GTG 69 | A paediatric DKA branch (fluids by weight, insulin after fluids without bolus, hourly neuro observations); a febrile-infant rule (< 3 months with T ≥ 38 °C → urgent paediatric assessment, blood culture, urine, LP, NG143 antibiotics); a hyperemesis rule (thiamine, saline + KCl, antiemetics, LMWH, viability scan). |
| 10 | **iOS: acuity from CC keywords only, and neonatal volvulus maps to the adult obstruction plan (predicted).** `ClinicalPathwayEngine` reads CC/PMH keywords only, so all 19 vignettes with an at-least-urgent expectation are predicted to stay below urgent (16 critical). With the new word-boundary radiation lookup, "Suspected malrotation with midgut volvulus" and the "reflux" permutation match the adult **small-bowel-obstruction** entry ("volvulus"). That entry gives a 48–72 h conservative trial, Gastrografin at 24 h, morphine 2.5–5 mg, ondansetron 8 mg and co-amoxiclav 1.2 g for a 3.4 kg neonate whose midgut may be infarcting. | iOS `level-*` ×16; `paed-malrotation-*` | Langer 2017 | Feed vitals, structured symptoms and age into iOS acuity; add paediatric entries (or an age < 1 year guard) to `DiagnosisRadiationEngine` before the adult obstruction entry. |

Lower-impact but systematic (all `quality`):

- **Screening prompts use outdated fixed rules.** `computeClinicalPrompts` preventative prompts
  compared with current guidance:
  - Colorectal screening starts at ≥ 50 (USPSTF/ACG 2021: 45) and has no upper age limit
    ("Colonoscopy — CRC screening" at 81).
  - Mammography is "annual from 40" (USPSTF 2024: biennial 40–74).
  - The cervical prompt is "smear every 3 years (21–65)" with gynaecology referral; it never
    mentions HPV (WHO 2021 / USPSTF 2018 from 30). It also fires after a total hysterectomy
    (USPSTF grade D).
  - PSA "shared decision" is offered from 50 with no upper limit, so it appears at 81 (USPSTF
    grade D ≥ 70).
  - Diabetes screening starts at 40 (ADA 2024: 35, or earlier with risk factors).
  - There is nothing for AAA, HCV/HBV/HIV, H. pylori in relatives of gastric cancer patients,
    post-polypectomy intervals, a formal 10-year CV risk, or out-of-office BP confirmation.
  - The iOS `ScreeningEngine` is much closer to USPSTF but is not used by web (see iOS).
- **Family-history logic is chip-only and partial.** BRCA carrier status in the record, and the
  "BRCA mutation", "Lynch syndrome" and "Gastric cancer" chips, trigger nothing. The
  high-risk breast prompt fires only from a "Breast cancer"/"Ovarian cancer" chip, and then tells
  a known carrier to have "BRCA testing if Manchester ≥ 17". A CRC-under-50 plus
  endometrial-cancer family gets colonoscopy but no Lynch/MMR/genetics output. These were checked
  by calling `computeClinicalPrompts` directly with each chip.
- **Over-triage of screening visits.** After the fixes, 6 of 18 screening/prevention visits
  (excluding the accelerated-hypertension emergency) still reach `same_day_call` or
  `emergency_now` when they should be routine. The causes:
  - Topic words: "bowel cancer screening", "Father had stomach cancer", "friends have had
    prostate cancer" and a relative's cancer in the family history all read as "Possible
    malignancy".
  - "No change in bowel habit" is not treated as negated: the matcher handles "no change" as a
    pseudo-negation.
  - A routine post-splenectomy review reads as a "Post-operative concern".
- **A risk factor treated as a diagnosis.** `hasPmh(comorbidities, 'diabet')` matches "Previous
  gestational diabetes" and "Family history: mother type 2 diabetes". The woman being screened
  becomes a known diabetic ("diabetes monitoring", "diabetic nephropathy screening").
- **dx-variant detection by keyword.**
  - "Perforated appendicitis with periappendiceal abscess" in a 4-year-old still gets
    `appendicitis_uncomplicated`.
  - "breastfeeding" in the postpartum assessment selects the **Breast** variant group.
  - "discuss risk-reducing mastectomy" in the BRCA-carrier assessment selects
    `breast_mastectomy`. No plan follows, because Z15.01 maps to no protocol.
- **Relief-answer parsing without negation.** "Antacids did not help" and "Gaviscon — no help"
  still set `antacid_relief`, which puts GORD at the PANE top in postpartum pre-eclampsia and in a
  neonate with bilious vomiting.

## Per condition

### Screening and prevention (19 vignettes)

- **Colorectal** (average risk 46; FHx sister 48 + endometrial; 81-year-old; low-risk polyps;
  piecemeal EMR).
  - Right: FOBT/colonoscopy at ≥ 50.
  - Wrong: nothing at 46; no individualisation or upper limit; no post-polypectomy intervals (a
    generic "Colonoscopy — CRC screening" is offered 4 weeks after an EMR); no Lynch pathway;
    "bowel cancer screening" still triggers `emergency_now`.
- **Breast** (average 42; BRCA1 carrier 33).
  - Right: a mammogram at 42, and routine triage.
  - Wrong: annual rather than biennial; carrier status ignored (no MRI, risk-reducing surgery or
    high-risk service).
- **Cervical** (34 overdue; post-hysterectomy 52).
  - Right: overdue screening is prompted; the visit is now routine.
  - Wrong: no HPV testing; the prompt fires without a cervix.
- **Prostate** (58; 81).
  - Right: shared decision at 58.
  - Wrong: PSA and "consent to proceed" at 81.
- **Blood pressure** (clinic 152/94; accelerated 212/128 with papilloedema).
  - Right: the clinic-BP visit is now routine; the accelerated case gets the hypertensive-urgency
    prompt and "defer elective surgery".
  - Wrong: no ABPM/HBPM, ACR or CV score below 180 systolic. The accelerated case is triaged
    routine with no same-day admission, and still gets an inguinal TAPP plan for an umbilical
    hernia (gap 2).
- **Diabetes** (38, BMI 31, previous GDM).
  - Right: HbA1c is suggested.
  - Wrong: it is suggested for the wrong reason (she is labelled diabetic); the screening prompt
    starts at 40.
- **AAA/lung, lipids/CV risk** (68 ex-smoker; 52 smoker).
  - Right: LDCT, smoking cessation and lipid profile.
  - Wrong: no AAA ultrasound; no 10-year risk score.
- **Blood-borne viruses** (36): no HCV, HBV or HIV screening prompt.
- **H. pylori in an FDR of gastric cancer** (44): no test-and-treat; `same_day_call` from
  "stomach cancer" in the complaint.
- **Vaccination after injury or surgery** (tetanus-prone wound; post-splenectomy day 14): nothing
  (gap 6).

### Gynaecological mimics (5 vignettes: torsion adult/premenarchal, PID/TOA, haemorrhagic cyst on apixaban)

- **Right.**
  - Torsion and PID rank first in PANE.
  - The protocols are guideline-concordant (see Summary).
  - PID now passes every expectation.
  - TOA gets sepsis alarms, blood cultures, IV cefoxitin + doxycycline, drainage and admission.
- **Wrong.**
  - Appendicectomy plans from guarding in the torsions, TOA and haemoperitoneum (gap 5).
  - Adult doses at 38 kg (gap 3).
  - N70.03 (TOA) maps to no Plan protocol; only the Assessment panel shows PID.
  - The pelvic-free-fluid prompt says "ruptured ectopic protocol, salpingectomy" when hCG is
    recorded negative.
  - The haemorrhagic cyst is not in the PANE top 3 (torsion; cholecystitis from "shoulder tip" →
    `ruq_pain`; ectopic), and gets bridging rather than reversal (gap 7).

### Obstetric (6 vignettes: ectopic with IUS, appendicitis at 32 weeks, HELLP, postpartum pre-eclampsia, abruption after partner assault, hyperemesis)

- **Right.**
  - The ectopic with IUS passes every expectation: PANE #3, hCG and TVUS seeded, gynaecology
    referral, no "β-HCG negative" line.
  - Appendicitis at 32 weeks ranks second, with a laparoscopic appendicectomy plan.
  - Pregnancy red flags fire.
- **Wrong.**
  - Gaps 2, 4, 8 and 9.
  - The pregnancy-test prompt asks for a urine β-HCG in women recorded at 10–34 weeks.
  - Postpartum status cannot be recorded, so postpartum pre-eclampsia loses all pregnancy context.

### Paediatric (10 vignettes: intussusception classic/lethargic, pyloric stenosis, malrotation neonate/"reflux", preschool perforated appendicitis, HSP, DKA, febrile infant, inflicted duodenal injury)

- **Right.**
  - Symptom inference ranks the index condition first or second in 8 of 10. The exceptions are
    the inflicted injury and the febrile infant, whose #1 is "UTI (paediatric)".
  - Preschool perforated appendicitis is PANE #1 with IV antibiotics and appendicectomy.
  - HSP no longer gets an appendicectomy plan.
  - The emergency level is always emergency, but for the wrong reason (see Incidental passes).
- **Wrong.**
  - Gaps 1, 3, 4, 5 and 9.
  - PAS is never suggested (Alvarado, TG18 cholangitis and Ranson are suggested for a 4-year-old).
  - HSP (IgA vasculitis) is not in PANE; the ultrasound it needs comes only through the
    appendicitis protocol.
  - The "reflux" label steers PANE to GORD in a neonate with green vomiting.

## Incidental passes (right answer, wrong reason)

- **Emergency level in every paediatric vignette**: driven by adult thresholds (SBP < 90, HR > 120,
  RR > 24) firing on normal infant values. A well infant with the same vital signs would also be
  `emergency_now`.
- **Diabetes screening HbA1c** (`screen-diabetes-38-…`): suggested as "diabetes monitoring"
  because GDM history and a family history are read as diabetes.
- **Abdominal ultrasound** in both intussusception vignettes comes from the *cholecystitis*
  protocol ("USS abdomen (gallstones, wall thickening…)"), and in HSP from the appendicitis
  protocol. **Blood cultures** in the febrile infant come from the cholecystitis protocol, and the
  urine test from the adult sepsis bundle ("CXR + urine dipstick + abdominal CT").
- **hCG and TVUS** in the IUS ectopic come from the seeded ovarian-torsion protocol (PANE #2).
- **Left lateral tilt** at 32 weeks matches the appendicectomy template's operative positioning
  ("Trendelenburg + left lateral tilt (pelvis access)"), not aortocaval-compression advice.
- **"Stop apixaban"** matches the elective "hold DOAC 48–72 h pre-op" bridging line.
- **Gynaecology referral** in the haemorrhagic cyst comes from the ovarian-cyst protocol's
  "postmenopausal … discuss with Gynaecology" line.
- **Crossmatch/coagulation** in the abruption comes from the seeded blunt-trauma protocol.

## iOS (predicted from code, not observed; every iOS expectation is `unverified`)

- **Emergency level.** `ClinicalPathwayEngine` reads the chief complaint and PMH keywords only (now negation-aware; still no vitals, structured symptoms or age)
  ("rigidity", "peritonitis", "septic shock", "perforation", "ruptured", "acute", "jaundice", …).
  None of this cluster's natural complaints contains one: "Newborn vomiting green", "Baby
  screaming in episodes and vomiting", "Upper abdominal pain and vomiting, 34 weeks pregnant",
  "Abdominal pain after a fall, 33 weeks pregnant". **All 19 vignettes with an at-least-urgent
  expectation are predicted to stay below urgent**, which fails 16 critical level expectations.
- **Differential.** In fallback mode the abdominal-pain pool has no gynaecological, obstetric or
  paediatric candidates. `mimic-ectopic-pregnancy` on CI returned appendicitis, cholecystitis
  and biliary colic. Torsion, PID, ectopic, HELLP, abruption, intussusception, pyloric stenosis
  and malrotation are predicted absent.
- **`DiagnosisRadiationEngine`** (simulated from the source with the new word-boundary
  `keywordMatches`: word start always, word end for keywords < 5 characters):
  - Appendicitis entry: both appendicitis vignettes. The template has fixed adult doses
    (cefazolin 2 g, ondansetron 4 mg) and no pregnancy branch, so the paediatric dose and
    obstetric expectations are predicted to fail on iOS as well.
  - Small-bowel-obstruction entry: both malrotation vignettes (gap 10). The template's
    "Water-soluble contrast study (Gastrografin)" line may satisfy the upper-GI-contrast
    expectation by wording; it is not the investigation intended.
  - Colorectal carcinoma entry (staging CT, MDT, resection consent): the two CRC screening
    vignettes, because their diagnosis contains "colorectal cancer". `mgmt-no-cancer-staging-plan`
    is predicted to fail.
  - Essential hypertension entry (ACE-I/ARB step plan, no ABPM, no emergency branch): both
    hypertension vignettes. `mgmt-abpm-hbpm` and `mgmt-same-day-admission` are predicted to fail.
  - AAA entry: the AAA screening vignette.
  - No entry: the other 31.
  - **Antithrombotic regression guards.** Before 999f838, the first-substring lookup would have
    attached the PE, ACS or AF anticoagulation plans to 13 of these diagnoses:
    - "pe" in "pelvic", "haemoperitoneum", "hyperemesis", "hypertrophic", "type 1", "suspected"
      and "post-operative";
    - "mi" in "midgut", "vomiting", "abdominal", "contaminated" and "family";
    - "af" in "after";
    - also "ssi" in "discussion" (the SSI plan, not antithrombotic).
    With word-boundary matching none of these match. The 14 critical `mgmt-no-antithrombotic-plan`
    guards (13 plus the TOA) are kept so a regression shows up on the next CI run.
- **Screening.** iOS has a `ScreeningEngine` (`PathwayData.swift`, Wellness pathway):
  - It is largely USPSTF-concordant: CRC 45–75 (FIT yearly or colonoscopy 10-yearly;
    colonoscopy from 40, 5-yearly, with an FDR; "interval per report" after polyps); mammogram
    every 2 years 40–74; HPV every 5 years from 30; PSA shared decision 50–69 (45 with
    African-Caribbean ancestry or family history); AAA for men 65–75 who have ever smoked; LDCT;
    HCV 18–79; HIV 15–65; diabetes from 35 or with risk factors; lipids 40–75; tetanus booster.
  - It is not on the consultation path the harness runs, so iOS screening expectations are
    predicted to fail in the harness even where the app would show the item.
  - Gaps in it (code reading): hysterectomy is not considered, BRCA carriers only via a
    family-history flag, no HBV, no post-polypectomy tables, no asplenia vaccines.
  - Pathway expectations (`wellness` for wellness visits) are predicted to pass, as observed for
    `crc-screening-african-caribbean-fhx`.

## Harness limits (no change made)

- **Family history is not passed.** `web-runner.ts` calls `computeClinicalPrompts` with
  `familyHistory: []` because the vignette schema has no family-history field. The dashboard
  passes the Family History chips. FHx-dependent prompts were therefore checked by calling
  `computeClinicalPrompts` directly with the chips ("Colorectal cancer", "Breast cancer",
  "BRCA mutation", "Gastric cancer", "Cardiovascular disease"). One expectation
  (`screen-crc-fhx-…/mgmt-colonoscopy`) is `unverified: ["web"]`, because the dashboard would pass
  when the chip is ticked. Family history is written into `comorbidities`, as the existing
  screening vignettes do; that is what `adaptiveTriage` reads for its cancer screen.
- **No postpartum or gestation input on web.** `pregnancyPossible` is true only for
  `pregnant`/`unknown`; postpartum women are recorded as `not-pregnant`. Gestation weeks are not
  passed to any web engine.
- **Age is whole years.** A 12-day-old and an 11-month-old are both `ageYears: 0`. Weight is
  recorded (`vitals.weightKg`, `patient.weightKg`) but no web engine reads it.
- **iOS `ScreeningEngine` is not run** by either harness (see above).
- **Output categories.** Arranged screening tests (mammogram, LDCT, AAA ultrasound, ABPM,
  colonoscopy) are emitted by the prompt strip as plan lines (`addToPlan`), so those expectations
  are written as `management`. Blood tests stay under `investigations`.
- **No PAS calculator** is mapped in either runner; PAS is tested only as "suggested".

## Decisions for the surgeon

1. **Which screening rule set?** For a Saint Lucia practice with no national bowel screening
   programme, choose between USPSTF/ACG/MSTF (CRC from 45, biennial mammography from 40, PSA shared
   decision 55–69, MSTF polyp intervals) and UK NICE/BSG (BSG 2020 polyp rules). The web prompt
   strip currently mixes older US rules with neither upper age limits nor HPV. Should it be
   replaced by the iOS `ScreeningEngine` logic (ported to `lib/triage-engine`) so both platforms
   use one reviewed rule set?
2. **Blood-pressure red flags.** Approve thresholds for a triage BP flag: for example SBP ≥ 180 or
   DBP ≥ 120 → urgent, with end-organ features → emergency, and ≥ 160/110 in pregnancy or
   ≤ 6 weeks postpartum → urgent (NICE NG136 / NG133 / ACOG PB 222). None exists today.
3. **Paediatric scope.** Does the practice assess infants (< 1 year) surgically?
   - If not, the engines should only recognise and redirect: "bilious vomiting in an infant →
     emergency paediatric surgical centre", with no management templates.
   - If yes, paediatric protocols and weight-based dosing are needed before any prescribing text
     is shown.
   - Please set the age/weight below which adult templates are suppressed.
4. **Obstetric scope.** For HELLP, pre-eclampsia, abruption and hyperemesis, should the engine
   limit itself to recognition plus immediate obstetric handover (and pregnancy-safe first
   steps), or carry management content?
5. **Safeguarding contacts.** Child-protection and domestic-violence rules need the local referral
   route (agency, phone, out-of-hours). These must come from the practice; they were not invented.
6. **Vaccination schedules.** For tetanus-prone wounds and asplenia, which schedule should be
   encoded: the national/PAHO schedule, the UK Green Book or ACIP? The vignettes test only for the
   presence of vaccine and immunoglobulin, not doses or products.
7. **Expectations to confirm.**
   - Screening items (HPV testing, BRCA-carrier MRI, AAA, BBV screening) are recorded as
     `quality`.
   - Post-splenectomy pneumococcal vaccination, tetanus prophylaxis and every paediatric
     no-adult-dose expectation are `critical`.
   - Over-triage of screening visits is `quality`, although the front desk redirects "emergency"
     patients to the ER.
   - Please confirm or change.

## Vignettes

| Area | Files (`ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/`) |
|---|---|
| Colorectal screening/surveillance | `screen-crc-average-risk-46` (base), `screen-crc-fhx-sister-48-lynch-features`, `screen-older-man-81-overscreening`, `screen-polyp-low-risk-no-surveillance`, `screen-polyp-piecemeal-emr-site-check` |
| Breast / cervical / prostate | `screen-breast-average-risk-42`, `screen-breast-brca1-carrier-33`, `screen-cervical-hpv-overdue-34`, `screen-post-hysterectomy-no-cervical-52`, `screen-prostate-58-shared-decision` |
| Cardiometabolic, AAA, lung, infection screening | `screen-hypertension-clinic-bp-confirm`, `screen-hypertension-accelerated-papilloedema`, `screen-diabetes-38-overweight-prior-gdm`, `screen-cv-risk-lipids-smoker-52`, `screen-aaa-lung-ex-smoker-68`, `screen-hepatitis-b-c-hiv-once`, `screen-hpylori-fdr-gastric-cancer` |
| Vaccination relevant to surgery | `screen-tetanus-prone-wound-unknown-status` (base), `screen-post-splenectomy-vaccination` |
| Gynaecological mimics | `gyn-ovarian-torsion-dermoid` (base), `gyn-ovarian-torsion-premenarchal-11`, `gyn-ruptured-haemorrhagic-cyst-apixaban`, `gyn-pid-young-woman` (base), `gyn-pid-tubo-ovarian-abscess-sepsis` |
| Obstetric | `obs-ectopic-with-ius-stable`, `obs-appendicitis-pregnancy-t3`, `obs-hellp-ruq-pain-34wk` (base), `obs-postpartum-preeclampsia-epigastric`, `obs-abruption-concealed-partner-assault`, `obs-hyperemesis-gravidarum` (base) |
| Paediatric | `paed-intussusception-infant-classic` (base), `paed-intussusception-lethargy-atypical`, `paed-pyloric-stenosis-alkalosis` (base), `paed-malrotation-volvulus-bilious-neonate` (base), `paed-malrotation-labelled-reflux`, `paed-appendicitis-preschool-perforated`, `paed-hsp-abdominal-pain` (base), `paed-dka-new-onset-abdominal-pain`, `paed-febrile-infant-7wk-hernia-clinic` (base), `paed-nai-duodenal-haematoma` |

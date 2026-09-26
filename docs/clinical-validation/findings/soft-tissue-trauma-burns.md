# Soft tissue, vascular, trauma and burns: clinical validation findings

41 guideline-referenced vignettes in `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/`, run
through the web harness (`pnpm --filter @workspace/scripts run clinval:web`) on 2026-09-25 at
`clinval-stb` (base `52616d2`). Nothing in any engine, threshold or clinical data was changed.

- **Web results are observed.** Every web failure is flagged `knownGap: ["web"]`, with a
  `knownGapNote` saying what the engine does instead and a `proposedFix` where one is clear.
- **iOS results are not observed yet.** Every expectation that applies to iOS is
  `unverified: ["ios"]`. Where this report says what iOS does, it comes from reading the Swift
  source, and the text says so. The first iOS CI run confirms or corrects it; then triage the flags
  as the README describes.
- **Citations are `verified: false`.** They were written from the guideline texts and need a
  clinician's check against the source. One entry, `burns-fluid-threshold`, has no published source
  yet. It records the "≥15 % adult / ≥10 % child" threshold from the practice brief, which still
  has to be traced to its source.

## Summary (web)

| | Vignettes | Expectations | Pass | Fail (all known gaps) | n/a | Critical: pass / fail |
|---|---|---|---|---|---|---|
| Soft tissue (NSTI, cellulitis, abscess, diabetic foot) | 12 | 116 | 59 | 48 | 9 | 34 / 16 |
| Vascular (ALI, AAA, DVT, PE, SVT, ischaemic ulcer) | 10 | 72 | 39 | 30 | 3 | 24 / 14 |
| Trauma and burns | 19 | 168 | 84 | 66 | 18 | 51 / 27 |
| **Total** | **41** | **356** | **182** | **144** | **30** | **109 / 57** |

Where web content exists and the diagnosis code reaches it, the protocols are mostly sound. These
cases pass nearly everything:

- necrotising fasciitis (M72.6);
- stable and unstable splenic injury;
- blunt polytrauma;
- penetrating stab wounds;
- high-voltage electrical injury (T75.4);
- DVT and post-operative PE;
- the ischaemic ulcer with a calcified ABPI (the arterial-ulcer protocol mentions TBI).

The failures fall into five patterns:

1. **Missing content.** There is no acute limb ischaemia, diabetic foot, Charcot, superficial vein
   thrombosis, chemical burn, trauma-in-pregnancy or safeguarding content anywhere on web.
2. **Codes that do not reach content.** Protocols are found by one narrow ICD prefix, so the codes
   clinicians actually use reach nothing. The table below lists them.
3. **The primary differential (PANE) mis-ranks.** Symptom inference often ranks the right
   diagnosis first (NSTI, ALI, ruptured AAA, Fournier's) while PANE, the primary differential,
   does not.
4. **Triage has no trauma or burn rules**, and it has no negation handling.
5. **Several iOS defects found by reading the source**, including a substring-matching bug that
   attaches an antithrombotic plan to bleeding diagnoses.

## Top safety gaps, ranked, with proposed fixes

Ranked by potential for patient harm.

### 1. iOS attaches ACS or PE antithrombotic and thrombolytic plans to haemorrhagic diagnoses

Platform: iOS. Evidence: static reading of the source; a CI guard is now in place.

`DiagnosisRadiationEngine.radiate` picks the first entry whose keyword is a substring of the
working diagnosis (`dxL.contains($0)`), and some keywords are two or three letters long:

- `"mi"` (ACS) matches "abdo**mi**nal", "ischae**mi**a", "che**mi**cal", "haemodyna**mi**cally", "**mi**dfoot";
- `"pe"` (PE) matches "sus**pe**cted", "**pe**netrating", "su**pe**rficial", "thera**pe**utic";
- `"tb"` (TB) matches "**TB**SA";
- `"aki"` ("t**aki**ng") and `"af"` ("**af**ter") behave the same way.

Simulating the lookup over the 41 confirmed diagnoses (a throwaway script that parses the Swift
sources; not committed):

| Plan attached | Diagnoses |
|---|---|
| Acute coronary syndrome (aspirin 300 mg + ticagrelor + fondaparinux) | ruptured AAA; leaking AAA; both splenic injuries; blunt polytrauma; anterior stab; trauma in pregnancy; both acute limb ischaemia cases; ischaemic diabetic foot ulcer; circumferential burn with distal ischaemia; NSTI of the abdominal wall; chemical burn; Charcot foot (14) |
| PE (DOAC, "alteplase 100 mg") | stab with evisceration; rib fractures with haemothorax on warfarin; non-accidental injury in an 11-month-old; immersion scald; superficial scald; suspected NSTI; superficial vein thrombosis (7) |
| Pulmonary tuberculosis | every burn diagnosis written with "TBSA" (3) |
| Acute kidney injury / atrial fibrillation | "Head injury in a patient **taki**ng apixaban"; "… pain **af**ter viral cough" (2) |
| The intended entry | both cellulitis cases, both DVT cases, post-operative PE (5) |
| None | 10 of 41 |

The plan fills `managementPlan` only if it is empty and only on a clinician tap, but it is shown as
the suggested plan.

**Fix:** match whole words or phrases (a word-boundary regex, or tokenise the diagnosis), drop
keywords shorter than 4 characters or require them to be whole tokens, and add a unit test with the
diagnoses above.

**Guard:** 12 vignettes carry a critical `mgmt-no-antithrombotic-plan` exclusion, and the base burn
case a quality `mgmt-no-unrelated-plan`. All pass on web; iOS CI will show the real result.

### 2. The VTE plan in pregnancy proposes DOACs and warfarin

Platform: web (observed).

In `dvt-pregnancy-22wk` (pregnant, `pregnancyPossible` true) the DVT protocol plan offers
rivaroxaban/apixaban first line. Its only pregnancy mention is "LMWH bridging to **warfarin**…
if DOAC contraindicated (… pregnancy)", which read literally proposes warfarin antenatally. D-dimer
is also listed without the RCOG caveat.

**Fix:** make the DVT/PE protocols pregnancy-aware. In pregnancy: treatment-dose LMWH, hide the
DOAC and warfarin lines, and no D-dimer for diagnosis (RCOG GTG 37b). Add a VTE-in-pregnancy dx
variant or plan prefix. Also map the obstetric code O22.3x, which currently reaches no protocol.

### 3. The emergency level cannot see trauma, burns or limb ischaemia

Platforms: iOS and web.

**iOS** (static reading): `ClinicalPathwayEngine.assess` reads only chief-complaint and PMH
keywords. None of the 41 chief complaints contains one of its emergency or urgent words, so every
vignette in this cluster is predicted `routine`, including:

- ruptured AAA with shock;
- tension pneumothorax;
- a 27 % burn;
- the eviscerated stab wound.

Its emergency list also spells "ischemia" but not "ischaemia".

**Web** (observed): `adaptiveTriage` has no trauma, burn or stab rules and uses fixed vital-sign
thresholds (HR >120, SBP <90). It returns:

- `routine_booking` for a CT-proven grade III splenic laceration;
- `same_day_call` for an eviscerated stab wound and for a 27 % TBSA burn (HR 118).

**Fix:**

- iOS: let the acuity use vitals (NEWS2 and shock index) and the text-parser alarms, not only CC
  keywords.
- Web: add rules to `rules.ts` at urgent severity for:
  - burn with TBSA;
  - stab or gunshot wound, evisceration;
  - high-energy mechanism;
  - head injury on an anticoagulant;
  - a sudden cold, pale, pulseless limb.
- Web: add a relative-hypotension / shock-index rule.

### 4. Acute limb ischaemia does not exist on web

Platform: web (observed).

There is no ALI disease in PANE, no protocol (I74.3 reaches nothing), no alarm, no heparin step
and no revascularisation step. In the embolic Rutherford IIb case, PANE's top 3 are cholecystitis,
GORD and diverticulitis. Triage reaches "emergency" only because "severe pain in the left leg"
matches the *acute abdominal pain* rule. The iOS text parser does have a 6-Ps alarm.

**Fix:** add an ALI disease and protocol with ICD I74.2–I74.4:

- 6 Ps and Rutherford I–III;
- immediate IV heparin;
- emergency revascularisation for IIb, urgent for IIa;
- CT angiography only when it will not delay IIb.

Add a matching triage rule.

### 5. Burns: the web plan is unreachable, and iOS fluid advice is unsafe for electrical injury

Platforms: web (observed) and iOS (static).

**Web:**

- The major-burn protocol is registered for T31.3–T31.9 (≥30 % TBSA) only, and the minor-burn
  protocol for T30.0/T14.0. So T31.1x/T31.2x (10–29 %), T20–T25 site codes, T27 (inhalation) and
  chemical codes reach nothing.
- PANE splits burns at 20 % ("major >20 %", "minor <20 %"), which matches neither the adult
  15 % nor the child 10 % threshold.
- The SOCRATES mapper turns the **"Burning" character chip into the `heartburn` feature**, so GORD
  tops PANE in every burn case.
- There is no burn chip and no burn CC template.

As a result, web gives no formal fluids, burns referral, escharotomy, early intubation or 100 %
oxygen for inhalation injury, and no irrigation for the alkali burn. Only the electrical injury
works, because T75.4 maps.

**iOS BurnsAssessment** (static): for the 11 kV injury with myoglobinuria, the visible TBSA is 4 %.
The card therefore says **"Below formal resuscitation threshold … oral fluids may suffice"**, with
no pigmented-urine target and no ECG or CK prompt. The full table is in the next section.

**Fix:**

- Map burns protocols by TBSA band and site codes, with an age-dependent formal-fluid threshold.
- Stop mapping "burning" pain to heartburn outside epigastric/retrosternal sites.
- Add a burn CC template and chip.
- In BurnsAssessment, override the TBSA threshold for high-voltage electrical injury and show the
  UO 1–1.5 mL/kg/h target, ECG, CK and compartment checks.

### 6. Ruptured or leaking AAA is mis-ranked and the plan is missing

Platform: web (observed).

- **`raaa-shock`:** even with a pulsatile mass and shock answered, PANE ranks acute pancreatitis
  first (0.35), so the management panel shows the pancreatitis protocol. I71.3 (ruptured AAA)
  reaches no protocol, which is registered as I71.9. The hypotension prompt adds "Hartmann's 1 L
  bolus" where permissive hypotension applies.
- **`aaa-renal-colic-mimic`:** PANE gives renal colic 0.78, and no engine suggests aortic imaging.

**Fix:**

- Use prefix I71 for the aneurysm protocol.
- Give `pulsatile_mass` + `haemodynamic_instability` a decisive likelihood ratio for aortic
  aneurysm.
- Add "first renal colic over 60, no stone history → exclude AAA (bedside USS)".
- Suppress the 1 L bolus line when AAA is suspected.

### 7. NSTI: LRINEC can be used to rule out, and PANE never ranks NSTI in the top 3

Platforms: iOS (static) and web (observed).

**iOS** (static): the LRINEC calculator reads <6 as "Low probability of NF; consider cellulitis"
and recommends cellulitis antibiotics. That is exactly the use WSES/SIS and the Fernando
meta-analysis warn against (low sensitivity). The harness cannot drive this calculator yet: no
`lrinec` score-form mapping exists in `ClinValIOSRunner`.

**Web:**

- PANE does not rank NSTI in the top 3 in any of the four NSTI vignettes, including the classic
  case with crepitus, bullae and shock. Symptom inference ranks it #1.
- Fournier's (N49.3) reaches no protocol.
- The web CDS has no LRINEC scale.

The NSTI protocol itself is good: debridement, meropenem + clindamycin + vancomycin.

**Fix:**

- iOS LRINEC: replace the <6 text with "low score does NOT exclude NSTI — clinical suspicion
  mandates surgical assessment", and remove the cellulitis regimen from that branch.
- PANE: strengthen `crepitus_soft_tissue` and review the NSTI prior.
- Add N49.3 to the NSTI protocol.
- Add a `lrinec` mapping to both harnesses so the calculators are graded.

### 8. Safeguarding is absent

Platform: web (observed); iOS partial (static).

Neither `trauma-paediatric-nai-bruising` (a non-mobile 11-month-old with ear and trunk bruises
and an inconsistent history) nor `burns-child-immersion-nai` (glove/stocking scald, delayed
presentation) produces any safeguarding flag, referral or skeletal survey on web. The burns-minor
protocol names safeguarding, but it is never selected. iOS BurnsAssessment has an NAI toggle, but
its only effect is a line in the referral list.

**Fix:** add a NICE CG89 safeguarding prompt that routes to the safeguarding lead. It should fire on:

- bruising in a non-mobile child;
- ear, neck or trunk sites;
- an inconsistent history or delay;
- the immersion pattern.

The prompt should suggest the RCR/RCPCH investigations: skeletal survey under 2 years, CT head
under 1 year, FBC and clotting.

### 9. Trauma in pregnancy has no content

Platform: web (observed).

At 30 weeks after a collision, with uterine tenderness and bleeding, the engines give nothing on:

- left lateral tilt or manual uterine displacement;
- obstetric team;
- CTG;
- Kleihauer / anti-D for this RhD-negative woman;
- abruption.

Symptom inference ranks ectopic pregnancy first. The only pregnancy prompt asks for a urine
pregnancy test. O9A.213 reaches no protocol.

**Fix:** add a trauma-in-pregnancy protocol branch, triggered by pregnancy status plus a trauma
mechanism, as in ATLS 10 chapter 12. Skip the pregnancy-test prompt when the record says pregnant.

### 10. Tension pneumothorax site, and anticoagulated head injury

Platform: web (observed).

- **Needle-decompression site.** The pneumothorax protocol (step and key point) says "14G cannula
  **2nd ICS MCL**" for all patients. ATLS 10 moved the adult site to the 4th/5th ICS anterior to
  the mid-axillary line. Critical, flagged for surgeon confirmation.
- **Anticoagulated head injury.** For the 82-year-old on apixaban and the 79-year-old on
  warfarin, the `anticoag_check` prompt gives elective advice: "hold DOAC 48–72 h pre-op; warfarin
  — bridge with LMWH". The TBI protocol has no reversal step. S06.x codes reach no protocol (TBI is
  registered as S09.9), and no red flag mentions GCS 12. CT head is still suggested for the
  anticoagulated head injury.

**Fix:**

- Change the adult decompression site; keep 2nd ICS MCL for children.
- Make `anticoag_check` context-aware: trauma or bleeding → reversal and CT.
- Add a reversal step and S06 to the TBI protocol.

### Also found (lower rank)

- **Diabetic foot has no web protocol at all.** E11.52/.61x/.621 reach nothing. Triage uses a
  Wagner checklist, where IWGDF 2023 uses IWGDF/IDSA for infection and SINBAD/WIfI. There is no
  Charcot content on either platform. "Foot ulcer" alone triggers an urgent red flag, so a clean
  uninfected ulcer is sent to `emergency_now`.
- **Negation.** "No chest pain, breathlessness or haemoptysis" scores *Possible cardiac event* and
  *Haemoptysis*. "Not breathless" scores the post-op breathless rule. "No bleeding" scores GI
  bleeding. "no fever" scores a systemic red flag. "left arm" in a past surgical history scores a
  cardiac event. The DVT, PERC-negative and abscess cases are over-triaged as a result.
- **"spreading redness" in a non-diabetic** triggers the diabetic-foot emergency rule
  (`cellulitis-leg-adult` → `emergency_now`).
- **SOCRATES mapper side effects** (`socrates-to-features.ts`):
  - site "Groin" → `groin_swelling`, so inguinal hernia tops Fournier's and the groin abscess;
  - "Neck" → `neck_lump` in the inhalation burn;
  - "leg"/"calf" → `leg_swelling` for every leg complaint.
- **Superficial vein thrombosis** has no disease or protocol (I80.0x reaches nothing). The only
  mention is a red flag inside the varicose-veins protocol.
- **Narrow ICD prefixes** (each code below reaches no protocol):

  | Code clinicians use | Protocol registered as |
  |---|---|
  | L03.115 / L03.116 cellulitis | L03.9 |
  | L02.415 / L02.214 abscess | L02.9 |
  | S22.42 rib fractures | S29.0 |
  | S06.x head injury | S09.9 |

  `S29.0` is ICD-10 "injury of muscle and tendon at thorax level", and `S39.92` is ICD-10-CM
  "unspecified injury of lower back", so the protocol's own codes are also mislabelled.
- **Unstable patients.** CT is suggested without "if stable" (splenic protocol), and the
  bowel-obstruction CT prompt fires in the unstable polytrauma patient because of abdominal
  distension.
- **PE.** PANE needed the explicit answers "no trauma / no chest-wall tenderness". Without them it
  ranked traumatic pneumothorax, rib fractures and haemothorax above PE on post-operative day 5.
  The hypoxia and tachycardia prompts add "CTPA if Wells score ≥ 2 and D-dimer positive" and "CTPA
  if Wells score ≥ 2" (`pe-postop-day5/mgmt-no-ddimer-gate`). NICE NG158 uses Wells PE >4 → CTPA
  directly, and ≤4 → D-dimer; ≥2 is the DVT cut-off.
- **No pelvic binder** in the blunt-trauma protocol, and no ATLS haemorrhage class. Beta-blocker
  masking and relative hypotension are not flagged.
- **The web CDS still suggests Wagner** for the diabetic foot, and has no LRINEC.

## iOS BurnsAssessment and Parkland calculator against the guidelines

Static review of `Views/Consultation/PathwayData.swift` (`BurnsAssessment`),
`BurnsAssessmentView.swift` and `Services/ClinicalScoringEngine+TraumaBurns2.swift`
(`parkland`). The harness does not drive these yet.

| Check | Guideline | BurnsAssessment (pathway card) | Parkland calculator | Verdict |
|---|---|---|---|---|
| Adult TBSA | Rule of nines | Head & neck 9, trunk 18 + 18, arms 9, legs 18, perineum 1 = 100 | Takes TBSA as input | Correct |
| Child TBSA | Lund–Browder | Linear adjustment under 10 y (head 18 − (age − 1), leg 14 + 0.5 × (age − 1)), normalised to 100. Compared with Lund–Browder head + neck: 18 vs 19 at 1 y, 14 vs 15 at 5 y. From 10 y it switches to adult proportions (9) while Lund–Browder is still 13 at 10 y and 11 at 15 y. The "Lund–Browder preferred" hint shows only under 10 y | — | Approximate; under-estimates head/neck burns by 2–4 % at 10–15 y |
| Formula | Parkland 4 mL/kg/%TBSA; ABA 2–4 mL; ATLS 10 starts adults at 2 mL, children 3 mL, electrical 4 mL (to verify) | 4 × kg × TBSA | 4 × kg × TBSA | Matches Parkland; the ATLS 10 / ABA starting-rate difference is a surgeon decision |
| Timing | Half in the first 8 h **from the time of burn** | Shows first-8-h volume, and hours elapsed since the burn (red when ≥8 h) | "First half … in first 8 h from TIME OF BURN — at N mL/h", where N = half ÷ 8 | **Rate wrong for late starters.** 27 %, 80 kg, arriving at 2 h: the calculator says 540 mL/h, but 720 mL/h is needed over the remaining 6 h. The card shows no rate |
| Formal-fluid threshold | ≥15 % adult, ≥10 % child (practice brief; source to trace) | >15 % adult, >10 % child (<16 y) | "<15 → minor … may be managed with oral fluids" and "15–25 → IV resuscitation mandatory", **regardless of age** | Boundary differs (> vs ≥). The calculator tells a child with 12 % that oral fluids may suffice. The two iOS components disagree with each other |
| Urine-output target | Adult 0.5 mL/kg/h; child 1 mL/kg/h; high-voltage with pigmented urine 1–1.5 mL/kg/h | Footer: adult 0.5, child 1 | "0.5–1.0 mL/kg/h (adult)" only | No electrical target anywhere; no child target in the calculator |
| Child maintenance fluid | Add maintenance (glucose-containing) fluid | Footer text only, not calculated | Not mentioned | Gap (quality) |
| Electrical | Fluids by pigmented urine, not visible TBSA; ECG, CK, compartments | Referral line "Electrical burn"; **fluid card says "oral fluids may suffice" when visible TBSA ≤15 %** | Nothing specific | **Unsafe.** See gap 5 |
| Chemical | Copious irrigation, no neutralisation | Referral line only | — | No first-aid prompt |
| Inhalation | Early airway, 100 % O₂, COHb | Referral line; revised Baux +17 | Adds "early intubation strongly recommended" | The card has no airway prompt |
| Circumferential full thickness | Escharotomy | Referral line "Circumferential burn" | — (Baux ≥80 text mentions escharotomy) | No escharotomy prompt on the card |
| Special areas | Face, hands, feet, genitalia, perineum, major joints | All six toggles | Transfer text lists face/hands/perineum/circumferential | Correct |
| Full-thickness referral | ABA and NNBC: any full-thickness burn | Only if full-thickness >5 % | — | Gap: any full thickness should trigger referral (NNBC wording to check) |
| Size referral | ABA: partial thickness >10 %; NNBC thresholds to check | Adult >10 %, child >5 % | "TBSA >15 % adult" | The two components disagree |
| Other ABA criteria | Concomitant trauma; comorbidity/pregnancy; social/abuse | Comorbidity/pregnancy toggle; NAI toggle | — | No concomitant-trauma criterion; NAI is a referral line only |
| Revised Baux | Adults | Shown for all ages | — | Not validated in children (quality) |
| Data checks | — | The full-thickness stepper is independent of the region sliders and can exceed TBSA | — | Add validation |

Also, `ConsultPathway.recommend` matches "burn" as a substring. "Heart**burn**" in a chief
complaint therefore selects the Burns pathway (code reading; outside this cluster).

## Other iOS predictions (static, confirm on CI)

- **Pathway.** Correct for the trauma and burns bookings. Predicted misses:
  - "Fall at home, hit head" → `firstVisit`: there is no trauma keyword, because "fall from" is
    required;
  - "Chemical splash to face, eye and arms" → `firstVisit`: no "burn" in the CC and the visit is
    not booked as burns.
- **Text-parser alarms.**
  - NSTI needs the literal phrase "pain out of proportion" plus a site and a spreading/crepitus
    word. It is predicted to fire for the classic leg case, but not for the early forearm case
    ("…out of proportion to the faint redness"), and it would fire on "No crepitus" because there
    is no negation.
  - The ALI alarm (≥4 of 6 Ps) is predicted to fire for the embolic case.
  - The ruptured-AAA alarm needs "pulsatile mass" + "collapse/shock", which is present.
- **Differentials.** In database-fallback mode most complaint routes are empty. CI records the
  mode (`engineInfo.bayesDatabase`); every iOS differential expectation is unverified.

## Decisions for the surgeon

1. **Fluid formula.** Parkland 4 mL/kg/%TBSA (current, both platforms) versus the ATLS 10 / ABA
   starting rates (2 mL adults, 3 mL children, 4 mL electrical). Also the ≥ vs > wording of the
   15 % / 10 % threshold, and its published source.
2. **Needle decompression site** for adults (ATLS 10: 4th/5th ICS anterior mid-axillary).
3. **Severity of the groin injection-site "abscess" checks** (pseudoaneurysm, duplex before
   incision). They are recorded as quality because no guideline statement was cited.
4. **NICE NG232 wording** for CT within 8 h in anticoagulated patients: "perform" or "consider".
5. **NNBC referral thresholds**, to check against the 2012 document, and the ABA 2022 referral
   update.

## Harness limits met in this cluster

- **Calculators not driven.** Neither harness drives the LRINEC, Wells, Parkland, TBSA/Baux, GCS
  or ISS calculators, or the iOS `BurnsAssessment` card. Score expectations here are
  recommendations only, plus qSOFA on iOS. Adding `lrinec`, `parkland` and `burns` score-form
  mappings to `web-runner.ts` and `ClinValIOSRunner.swift` would let the findings above be graded
  rather than read.
- **No burn or trauma inputs on web.** There is no burn, wound-bleeding or trauma symptom chip and
  no trauma, burn or vascular CC template, so web inputs use the nearest chips ("wound pain", "skin
  lesion", "rash") and "Other / general surgical".
- **PANE answers are supplied.** `platform.web.paneAnswers` stands for the clinician confirming
  key features in the PANE Q&A. PANE still mis-ranks most of these cases, which shows the gaps are
  content and likelihood problems, not missing input.

## Vignettes

| Id | Condition | Permutation of | Key test |
|---|---|---|---|
| `nsti-leg-diabetic-sepsis` | NSTI, leg, diabetic, sepsis (LRINEC 11) | — | Rank, emergency, debridement + clindamycin |
| `nsti-early-low-lrinec` | Early NSTI, LRINEC 0 | nsti-leg | LRINEC must not exclude |
| `nsti-fournier-diabetic` | Fournier's gangrene, septic shock | nsti-leg | N49.3 route, groin-site mapping |
| `nsti-postop-abdominal-wall` | Post-operative NSTI | nsti-leg | NSTI vs SSI, penicillin allergy |
| `cellulitis-leg-adult` | Mild cellulitis | — | NICE NG141 first line, no over-triage |
| `cellulitis-sepsis-elderly-diabetic` | Cellulitis with sepsis | cellulitis-leg | IV antibiotics, qSOFA 3, NSTI exclusion |
| `abscess-thigh-adult` | Simple abscess | — | Incision and drainage |
| `abscess-recurrent-mrsa-pwid` | Groin abscess, PWID, MRSA | abscess-thigh | MRSA cover, pseudoaneurysm |
| `dfi-moderate-osteomyelitis` | IWGDF/IDSA 3(O) | — | X-ray, cultures, PAD check, offloading |
| `dfi-severe-wet-gangrene-abscess` | IWGDF/IDSA 4, gas, sepsis | dfi-moderate | Urgent surgery |
| `dfu-ischaemic-calcified-abpi` | CLTI, ABPI 1.4, TBPI 0.18 | dfi-moderate | Toe pressures, vascular referral, no compression |
| `dfu-neuropathic-uninfected` | IWGDF/IDSA 1 | dfi-moderate | No antibiotics, offloading, no over-triage |
| `charcot-foot-cellulitis-mimic` | Active Charcot | dfi-moderate | Must not miss, immobilise |
| `ali-embolic-af` | ALI Rutherford IIb | — | Heparin, emergency revascularisation |
| `ali-thrombotic-diabetic-claudicant` | ALI IIa acute-on-chronic | ali-embolic | Not filed as chronic PAD |
| `raaa-shock` | Ruptured AAA | — | Emergency repair, permissive hypotension |
| `aaa-renal-colic-mimic` | Leaking AAA as renal colic | raaa-shock | Must not miss, aortic imaging |
| `dvt-wells-likely` | DVT, Wells 4 | — | Ultrasound within 4 h |
| `dvt-pregnancy-22wk` | DVT in pregnancy | dvt-wells | LMWH; no DOAC, warfarin or D-dimer |
| `pe-postop-day5` | Post-operative PE, Wells 7 | — | CTPA direct, hypoxia alarm |
| `pe-perc-negative-low-risk` | PERC negative | pe-postop | No CTPA, no over-triage |
| `svt-gsv-near-sfj` | SVT within 3 cm of the SFJ | — | Therapeutic anticoagulation |
| `trauma-blunt-polytrauma-class3-shock` | Polytrauma, class III shock, FAST + | — | Primary survey, blood, laparotomy, TXA |
| `trauma-splenic-injury-stable` | Grade III spleen, stable | — | Non-operative management with monitoring |
| `trauma-splenic-injury-unstable` | Spleen, unstable | splenic-stable | Operative management, no CT |
| `trauma-tension-pneumothorax` | Tension pneumothorax | — | Immediate decompression, adult site |
| `trauma-head-injury-gcs12` | Moderate TBI | — | NG232 1-h CT |
| `trauma-head-injury-elderly-apixaban` | Minor fall on apixaban | head-gcs12 | NG232 8-h CT, reversal not bridging |
| `trauma-stab-abdomen-evisceration` | Stab with evisceration | — | Laparotomy |
| `trauma-stab-abdomen-stable-snom` | Stable anterior stab | stab-evisceration | Selective non-operative management |
| `trauma-pregnancy-30wk-rtc` | Trauma at 30 weeks, RhD negative | — | Tilt, obstetrics, CTG, Kleihauer |
| `trauma-paediatric-nai-bruising` | Non-mobile infant bruising | — | Safeguarding |
| `trauma-elderly-occult-shock-warfarin` | Beta-blocked, INR 3.4, rib fractures | — | Reversal, occult shock |
| `burns-adult-flame-27pct` | 27 % flame burn | — | Parkland from burn time, referral |
| `burns-adult-scald-14pct` | 14 % scald | burns-adult | No formal IV fluids |
| `burns-child-scald-12pct` | Child 12 % (Lund–Browder) | burns-adult | Child threshold, maintenance, 1 mL/kg/h |
| `burns-inhalation-enclosed-space` | Inhalation + CO + face/hands | burns-adult | Early airway, 100 % O₂, COHb |
| `burns-circumferential-forearm-hand` | Circumferential full thickness | burns-adult | Escharotomy |
| `burns-electrical-high-voltage` | 11 kV, myoglobinuria | burns-adult | Fluids by urine, not TBSA; ECG |
| `burns-chemical-alkali` | Alkali, eye | burns-adult | Irrigation, no neutralisation |
| `burns-child-immersion-nai` | Immersion scald, toddler | burns-child | Safeguarding, special areas |

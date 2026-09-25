# GI surgical emergencies: findings

Clinical validation of the consultation engines for the GI surgical emergencies cluster. Measured
on 2026-09-25 (web harness, `clinval:web`) on branch `clinval-giem`, based on `claude/pr-37-gbg22z`
52616d2. No engine code or clinical data was changed. Every citation is `verified: false` until a
clinician checks it against the source.

## Scope

There are 39 new vignettes in `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/`. The 3 seed
appendicitis cases were left unchanged.

| Condition | Vignettes | Guideline basis |
|---|---|---|
| Acute appendicitis (8, permutations of `appendicitis-adult-typical`) | `appendicitis-paediatric-9y`, `-perforated-abscess`, `-generalised-peritonitis-sepsis`, `-antibiotics-first-coda`, `-appendicolith`, `-score-low-band`, `-score-intermediate-band`, `-immunosuppressed-transplant` | WSES Jerusalem 2020; CODA (NEJM 2020); Alvarado; AIR; AAS; PAS |
| Small bowel obstruction (6) | `sbo-adhesive-base`, `sbo-strangulation`, `sbo-gastrografin-failed`, `sbo-virgin-abdomen`, `sbo-strangulated-femoral-hernia`, `sbo-malignant-carcinomatosis` | WSES Bologna ASBO (2017 update, published 2018); WSES 2017 complicated hernia; MASCC 2021 MBO |
| Large bowel obstruction (6) | `lbo-obstructing-sigmoid-cancer`, `lbo-cancer-impending-caecal-perforation`, `lbo-right-colon-cancer`, `sigmoid-volvulus-base`, `sigmoid-volvulus-gangrenous`, `caecal-volvulus` | WSES 2018 obstructive colorectal cancer; ASCRS 2021 volvulus; WSES 2023 sigmoid volvulus |
| Perforated peptic ulcer (3) | `ppu-perforated-peptic-ulcer`, `ppu-elderly-steroids-masked`, `ppu-septic-shock-delayed` | WSES 2020 perforated/bleeding PU; Boey; SSC 2021; Sepsis-3 |
| Acute mesenteric ischaemia (3) | `ami-embolic-af`, `ami-venous-thrombosis-ocp`, `ami-infarction-septic-shock` | ESVS 2017; WSES 2022 |
| Acute diverticulitis (5) | `diverticulitis-uncomplicated-outpatient`, `-abscess-drainage`, `-purulent-peritonitis`, `-faecal-peritonitis-shock`, `-immunosuppressed` | WSES 2020; AGA 2021; ASCRS 2020; modified Hinchey |
| Dangerous mimics (8) | `mimic-ruptured-aaa`, `mimic-aaa-symptomatic-renal-colic-label`, `mimic-ectopic-pregnancy`, `mimic-ectopic-ruptured-shock`, `mimic-dka-abdominal-pain`, `mimic-testicular-torsion`, `mimic-inferior-mi`, `mimic-inferior-mi-ecg-confirmed` | ESVS 2024 AAA; NICE NG126; ADA/JBDS 2024 hyperglycaemic crises; EAU paediatric urology; ESC 2023 ACS |

The permutations cover typical and atypical presentations, age (a 9-year-old, a 14-year-old and
patients over 75), sex and pregnancy status, diabetes, immunosuppression or steroids,
anticoagulation, severity (up to septic shock), and mimics.

## Results (web)

| | Vignettes | Expectations | Pass | Fail | n/a | Critical fail | Blocking |
|---|---|---|---|---|---|---|---|
| New GI-emergency vignettes | 39 | 323 | 204 | 102 (44 critical, 58 quality) | 17 | 44 | 0 |
| Whole suite (with the 9 seeds) | 48 | 485 | 314 | 138 | 33 | 52 | 0 |

Every web failure is flagged `knownGap: ["web"]` and has a `knownGapNote` that says what the engine
does instead. Critical gaps also have a `proposedFix`.

**iOS was not run**, because there is no Xcode here. The iOS emergency level comes only from CC
and PMH keywords (`ClinicalPathwayEngine`), so I derived it for each vignette by reproducing that
function's logic in the vignette generator. On that basis, 27 of the 39 new vignettes are flagged
`knownGap: ["ios"]`: every CC written as a patient would say it ("Left loin pain and collapse",
"Abdominal pain and vomiting") gives `routine`. The two exceptions are the strangulation and
gangrenous-volvulus CCs, which give `urgent` because they contain "distension". Every other
iOS-applicable expectation is `unverified: ["ios"]` until the next CI run. After that run, triage
each one: remove the flag if it passes, or turn it into a `knownGap` with a note if it fails.

## Top safety gaps (ranked by safety impact)

| # | Gap | Where it shows | Proposed fix |
|---|---|---|---|
| 1 | **Vascular catastrophes cannot be recognised.** PANE has no acute mesenteric ischaemia node. No prompt reacts to "pain out of proportion" or to AF with abdominal pain. K55.0 maps to the *ischaemic colitis* protocol, which gives a portal-venous CT (not CTA) and no revascularisation. Ruptured and symptomatic AAA are not in the PANE top 3 (inguinal hernia and renal colic come first) even with `pulsatile_mass = yes`. I71.3 and I71.4 map to **no protocol** because only `I71.9` is registered, so the plan has no vascular surgery, no permissive hypotension and no CTA. The shock alarm does not name the aneurysm, and the shock prompt orders a 1 L bolus. | `ami-*` (all 3), `mimic-ruptured-aaa`, `mimic-aaa-symptomatic-renal-colic-label` | Add an AMI node and CC hint to PANE. Add an "AF/embolic source + abdominal pain" prompt: CTA now, and a normal lactate does not exclude AMI. Give K55.0 its own AMI protocol (CTA, heparin, revascularisation, damage control). Map the whole `I71` prefix to the aortic protocol. Add an AAA prompt (pulsatile mass or known AAA + pain + hypotension) and raise the PANE weight for pulsatile mass. |
| 2 | **The documented plan contradicts the severity in the assessment.** `detectDxVariants` takes the first variant whose keyword is a substring of the assessment, and the least severe variant is listed first. "Adhesive SBO **with strangulation**" gives the 72-hour drip-and-suck plan plus Gastrografin, with no operation. "Hinchey III" and "Hinchey IV" contain `hinchey i`, so they select the *abscess* variant: the plan has no emergency operation, only "interval sigmoid colectomy 6–8 weeks". "Modified Hinchey **Ib**" (a pericolic abscess) is listed under *uncomplicated*, so a 6 cm abscess gets the outpatient oral co-amoxiclav plan with no drainage. Any appendicitis assessment gives `appendicitis_uncomplicated`, including abscess and generalised peritonitis. | `sbo-strangulation`, `diverticulitis-purulent-peritonitis`, `-faecal-peritonitis-shock`, `-abscess-drainage`, `appendicitis-perforated-abscess`, `-generalised-peritonitis-sepsis` | Order variants from most to least specific (peritonitis/strangulation → abscess → uncomplicated) and make the uncomplicated variant the fallback. Match Hinchey grades on word boundaries. Move "hinchey ib" to the abscess variant. Remove the bare base keyword ("appendicitis") from the uncomplicated variant. `lint:dx-phases` checks phases only; add ordering tests. |
| 3 | **Negation is ignored in triage and prompts, which creates operative plans.** "No guarding, no rebound" and "no peritonism/rigidity" fire the *peritonism* prompt ("Emergency laparotomy consent — source control") and the *appendicectomy operative plan*. This happened in DKA, uncomplicated SBO, malignant SBO, mesenteric venous thrombosis and low-risk RIF pain. The appendicectomy template, triggered by guarding, states **"β-HCG confirmed negative"** in a woman whose pregnancy test has not been done and who has an ectopic pregnancy. "No vaginal bleeding" matches the GI-bleeding red flag and gives `emergency_now` for an AIR-1 patient. | `mimic-dka-abdominal-pain`, `mimic-ectopic-pregnancy`, `sbo-adhesive-base`, `sbo-gastrografin-failed`, `sbo-malignant-carcinomatosis`, `ami-venous-thrombosis-ocp`, `appendicitis-score-low-band` | Make matching negation-aware in `scanRedFlags` and in `exam()`/`hasSx()` (`computeClinicalPrompts`). Gate operative templates on a confirmed diagnosis, not on exam substrings. Replace "β-HCG confirmed negative" with a result field that blocks the template until a negative result is recorded. Suppress operative templates while a DKA prompt is active. |
| 4 | **Web under-triage of time-critical emergencies.** A perforated ulcer with board-like rigidity gets `same_day_call`, because "severe **upper** abdominal pain" misses the regex `severe (abdominal)? pain`. An inferior STEMI with the ECG and troponin already on file gets `same_day_call`. Testicular torsion gets `same_day_call`. Sigmoid volvulus in an 81-year-old gets `priority_24_48h`. Mesenteric venous thrombosis gets `priority_24_48h`. | `ppu-perforated-peptic-ulcer`, `mimic-inferior-mi-ecg-confirmed`, `mimic-testicular-torsion`, `sigmoid-volvulus-base`, `ami-venous-thrombosis-ocp` | Let the acute-abdomen regex accept a site word. Add emergency triggers: "sudden severe", rigidity/board-like, "no flatus"/"massive distension", male + sudden testicular pain. Feed resulted imaging/ECG/troponin into triage. |
| 5 | **The iOS emergency level reads only CC/PMH keywords.** 27 of 39 new vignettes are under-triaged, all to `routine`. These include ruptured AAA, ruptured ectopic, perforated ulcer, AMI, DKA, testicular torsion and Hinchey III/IV. Vitals, exam and alarms are never considered. | 27 `level-*` expectations (`knownGap: ["ios"]`) | Compute acuity as max(CC keywords, NEWS2/vital thresholds, text-parser alarms, confirmed-diagnosis urgency), following the "AI urgency floor" rule (never downgrade). |
| 6 | **Afebrile sepsis is missed.** An 81-year-old on prednisolone with qSOFA 3, lactate 3.1 and AKI from a perforated duodenal ulcer gets no sepsis alarm, because both web sepsis prompts need a temperature ≥ 38 °C. There is no flag that steroids mask peritonism and fever, and no steroid-cover prompt. | `ppu-elderly-steroids-masked` | Add a qSOFA/lactate sepsis rule that does not need fever (Sepsis-3: RR ≥ 22, SBP ≤ 100, altered mentation; lactate ≥ 2). Treat steroid use and age ≥ 75 as masking factors. |
| 7 | **The inferior-MI mimic is not caught.** No ECG or troponin prompt appears for epigastric pain with diaphoresis, HR 52 and BP 98/60 in a diabetic smoker; the bradycardia prompt needs HR < 50. PANE has no cardiac node. A resulted ECG showing ST elevation in II, III and aVF plus troponin 412 changes nothing: no alarm, no PCI, `same_day_call`. The base case reaches "emergency" only because "No chest pain described" matches the cardiac regex (a fragile pass caused by the negation bug). | `mimic-inferior-mi`, `mimic-inferior-mi-ecg-confirmed` | Add an epigastric-pain cardiac-risk prompt (ECG within 10 min, troponin). Add an ECG/troponin result rule and an I21 protocol. |
| 8 | **Ectopic pregnancy is missed by the primary differential, and the ruptured-ectopic plan offers methotrexate.** PANE's top 3 in both ectopic cases is cholecystitis, appendicitis and choledocholithiasis. The template's LMP answer ("7 weeks ago — missed period") and spotting are not mapped to features. With shock and haemoperitoneum, the plan still lists methotrexate suitability tests and the methotrexate and expectant steps, because ectopic pregnancy has no dx-variant group. (The pregnancy test, TVUS and gynaecology referral are correct.) | `mimic-ectopic-pregnancy`, `mimic-ectopic-ruptured-shock` | Map the `lmp` answer and spotting to `missed_period` / `abnormal_uterine_bleeding`. Add ectopic variants: ruptured/unstable → surgery only. |
| 9 | **A 30 kg child gets adult fixed doses.** The protocol, protocol medications and appendicectomy template give paracetamol 1 g QDS (133 mg/kg/day), ibuprofen 400 mg TDS, co-amoxiclav 1.2 g and piperacillin-tazobactam 4.5 g to a 9-year-old. The Plan tab also drops the "if USS inconclusive" condition, so CT is listed for a child whose ultrasound already confirmed appendicitis. | `appendicitis-paediatric-9y` | Add an age/weight branch (mg/kg with an adult maximum) to protocol medications and templates. Keep the investigation `conditional` text in `buildPlanText`. |
| 10 | **Plans for colonic obstruction and volvulus are wrong.** A stent is suggested ("colonic stent as bridge to elective resection") for a closed-loop LBO with a 13.5 cm caecum, pneumatosis and peritonism, where WSES 2018 says stents are contraindicated. Sigmoid volvulus without ischaemia has no endoscopic decompression step anywhere (it appears only in the dx-variant urgency note) and no same-admission sigmoidectomy. Caecal volvulus has no right hemicolectomy. A right-sided (hepatic flexure) tumour gets the left-sided SEMS/Hartmann's options. | `lbo-cancer-impending-caecal-perforation`, `sigmoid-volvulus-base`, `caecal-volvulus`, `lbo-right-colon-cancer` | State the stent contraindications and suppress the stent option when they are present. Split the volvulus variant into sigmoid (endoscopic detorsion → sigmoidectomy; gangrene → Hartmann's) and caecal (resection). Split malignant LBO into left- and right-sided variants. |

Other critical gaps not in the top 10:

- Strangulated femoral hernia is not in the PANE top 3. The hernia symptom branch and the exam chip are not read.
- The septic-shock perforated ulcer is not in the PANE top 3.
- DKA is not in the PANE top 3.
- Testicular torsion is not in the PANE top 3, although symptom inference ranks it first.
- Uncomplicated and purulent diverticulitis are not in the PANE top 3: with LIF pain and fever, cholecystitis ranks first.

## Per condition: right and wrong against the guideline

### Acute appendicitis (WSES 2020, CODA)

**Right:**
- Appendicitis ranks first in PANE in all 8 permutations.
- Web level is at least urgent.
- Alvarado arithmetic is correct for the high, intermediate and low bands (10, 6 and 3).
- Laparoscopic appendicectomy and antibiotics are offered.
- Women of reproductive age get a pregnancy test.
- Ultrasound is offered first.
- The generalised-peritonitis case gets a sepsis alarm, blood cultures, fluids and source control.
- The transplant patient gets CT.

**Wrong, with fixes:**

| Gap | Fix |
|---|---|
| Abscess and generalised peritonitis select the uncomplicated variant (Top 2) | Specific-first variant order; uncomplicated as the fallback |
| Abscess plan has no drainage and no interval colon evaluation: PANE converges on "appendicitis", so the appendix-mass protocol is never used | Use `appendix_mass` for K35.3x, or when the assessment names an abscess or phlegmon |
| No antibiotics-first option (WSES 2020/CODA) and no appendicolith caveat | Add a conservative step for CT-confirmed uncomplicated disease without appendicolith, with the recurrence figures |
| AIR, AAS and PAS are not suggested on web (only Alvarado) | Add AIR/AAS/PAS CDS rules and calculators |
| Operative template gives 5 days of antibiotics after *simple* appendicitis (already a seed finding) | Postoperative antibiotics only for complicated disease, as a short course |
| Adult doses and unqualified CT in a child (Top 9) | Weight-based branch; keep the conditional |
| Low-risk band (AIR 1): negation gives emergency triage and "emergency laparoscopic appendicectomy — theatre booked" (Top 3) | Negation-aware matching |
| Immunosuppression and steroids are not flagged; no steroid-cover prompt | Masking-factor flag; peri-operative steroid prompt |

### Small bowel obstruction (WSES Bologna)

**Right:**
- Obstruction ranks first in PANE.
- The base case gets CT, lactate, U&E, NGT, IV fluids, the water-soluble contrast challenge and the "operate if no resolution by 48–72 h" criteria.
- Strangulation gets an emergency level, a sepsis alarm, and an operation through the prompts and management panel.
- The strangulated femoral hernia gets emergency repair, and `hernia_strangulated` is detected. The incarcerated-hernia prompt says "Attempt manual reduction … Do NOT forcibly reduce if tender". The expectation accepts it because of that caveat, but a strangulated hernia should not be reduced at all, so the surgeon should review the wording.

**Wrong, with fixes:**

| Gap | Fix |
|---|---|
| Strangulation: the documented plan is the non-operative trial (Top 2) | Check `sbo_strangulation` first; drop the conservative phase when strangulation is present |
| Failed Gastrografin (no contrast in the colon at 24 h, day 3): the documented plan stays conservative and repeats the contrast study | Add a "failed NOM" variant with a surgical phase |
| Virgin abdomen with a mass lesion is labelled adhesional; neoplasm and hernia are not in PANE ("after meals" is read as a fatty-food trigger, which lifts cholecystitis) | Virgin-abdomen variant; small-bowel neoplasm node; do not map "after meals" to a fatty-food trigger |
| Hernia is not in the PANE top 3 in the femoral hernia case | Read the hernia branch and the exam chip into PANE |
| K 3.3/3.2 with no potassium replacement: K56.50 resolves to the generic `bowel_obstruction` protocol, not `adhesion_obstruction` (which has KCl) | Exact-code-first ICD lookup |
| Malignant SBO: no palliative, oncology or MASCC medical management; negation gives an "emergency laparotomy consent" prompt | Malignant-SBO variant |
| Observation, not graded: the DOAC prompt says "hold DOAC 48–72 h pre-op" for an *emergency* repair | Emergency reversal/timing text instead |

### Large bowel obstruction and volvulus (WSES 2018; ASCRS 2021; WSES 2023)

**Right:**
- Obstructing sigmoid cancer passes every web expectation: CT, staging CT chest, CEA, MDT, and the options of SEMS bridge, Hartmann's and primary anastomosis.
- Gangrenous sigmoid volvulus gets an emergency level, sepsis and shock alarms, emergency resection, antibiotics and ICU, and no management line suggests detorsion.

**Wrong, with fixes:**

| Gap | Fix |
|---|---|
| Stent offered despite impending caecal perforation (Top 10) | State the contraindications; suppress the stent option |
| "Closed-loop" LBO selects the small-bowel strangulation variant | Separate LBO variants checked first when the assessment says "large bowel" |
| Right-sided tumour gets left-sided options | Right-sided variant |
| Sigmoid volvulus: no endoscopic decompression, no sigmoidectomy, triaged 24–48 h, not in PANE (symptom inference ranks it #2) | Sigmoid-volvulus variant; triage phrases; PANE node |
| Caecal volvulus: no resection | Caecal-volvulus variant |
| Observation, not graded: the gangrenous case's dx-variant urgency note still reads "endoscopic decompression (sigmoid)" | Put the ischaemia contraindication in the note |

### Perforated peptic ulcer (WSES 2020)

**Right:**
- Peptic ulcer disease is in the PANE top 3 in 2 of 3 cases.
- Free-air and peritonism alarms fire.
- Omental patch repair, antibiotics, PPI, stopping NSAIDs, H. pylori testing and eradication are offered.
- The septic-shock case gets the full bundle: cultures, 30 mL/kg fluids, noradrenaline, ICU and source control.

**Wrong, with fixes:**

| Gap | Fix |
|---|---|
| Base case triaged `same_day_call` (Top 4) | Regex accepts a site word; add rigidity/free-air triggers |
| Septic-shock case: PANE top 3 is cholecystitis, hernia, pancreatitis. PANE has no perforation node, and the "Perforated viscus" CC template has no `CC_HINTS` entry | Perforated-viscus node with rigidity, sudden onset and free-gas features |
| K25–K28 route to the "Upper GI Bleed" variant group, and urgent OGD is listed for a free perforation | Separate perforated-ulcer variant; OGD only at follow-up |
| No Boey or PULP score on either platform | Add Boey (WSES 2020 suggests Boey/PULP) |
| Elderly patient on steroids: afebrile sepsis missed, no masking flag, no steroid cover (Top 6) | See Top 6 |

The peritonism alarm in the steroid case fired only because "No guarding, **no rigidity**" matched "rigid". The perforation alarm is still correct there, because the CT free-air prompt also fired.

### Acute mesenteric ischaemia (ESVS 2017; WSES 2022)

**Right:**
- Emergency level on web for the embolic and late cases.
- Sepsis and shock alarms in the late case.
- Laparotomy and second-look text comes from the generic templates.
- Heparin appears, but only as the ischaemic-colitis protocol's medication "for mesenteric vein thrombosis".

**Wrong:**
- Everything specific to AMI is missing (Top 1): the diagnosis, the alarm, CTA and revascularisation.
- Mesenteric venous thrombosis is triaged 24–48 h (its only reasons are "pregnancy mentioned" from "pregnancy test negative", and pain).
- MVT gets no advice to stop the combined pill and no thrombophilia screen.
- Negation adds an "emergency laparotomy consent" prompt to an anticoagulation-only case.
- The normal lactate in `ami-embolic-af` did not lower the web level, but only because triage does not read lactate at all.

### Acute diverticulitis (WSES 2020; AGA 2021; ASCRS 2020)

**Right:**
- CT, colonoscopy after complicated disease, CT-guided drainage (management panel), IV antibiotics, sepsis and perforation alarms, Hartmann's and primary anastomosis options (panel) and ICU are all present.
- No antibiotic-free option is ever offered, which is correct for the immunosuppressed patient.

**Wrong, with fixes:**

| Gap | Fix |
|---|---|
| Hinchey substring and first-match problems (Top 2) | Word-boundary matching; specific-first order |
| PANE misses diverticulitis in 3 of 5 cases: with LIF pain, nausea and fever, cholecystitis ranks first | Re-weight `lif_pain` for diverticulitis |
| Uncomplicated disease always gets 5–7 days of co-amoxiclav, with no selective or antibiotic-free option (WSES 2020/AGA 2021) | Update the uncomplicated step |
| "Uncomplicated acute sigmoid diverticulitis" selects no variant, because only the phrase "uncomplicated diverticulitis" is a keyword | Token-based rather than phrase matching |
| Immunosuppression is not flagged | Masking/high-risk flag |

### Mimics

| Mimic | Right | Wrong → fix |
|---|---|---|
| Ruptured / symptomatic AAA | Symptom inference ranks AAA #1; hypotension alarm; crossmatch | Not in PANE; ICD I71.3/I71.4 map to no protocol; no aneurysm-specific alarm; 1 L bolus → Top 1 fixes |
| Ectopic pregnancy | Pregnancy test, TVUS, gynaecology referral; the pelvic-free-fluid prompt names ruptured ectopic; emergency surgery; crossmatch | Not in PANE; "β-HCG confirmed negative" in the template; methotrexate shown in rupture → Top 3 and Top 8 fixes |
| DKA | Emergency level; hyperglycaemia alarm; ketones/blood gas; insulin (VRIII/FRIII prompt) | Not in PANE; laparotomy and appendicectomy templates from negation; no potassium plan → Top 3 fix; DKA node or medical-mimic layer |
| Testicular torsion | Scrotal prompt; plan for exploration without a Doppler delay | Not in PANE top 3 (symptom inference #1); `same_day_call` → triage rule; read genital exam into PANE |
| Inferior MI | Nothing specific | Top 7 |

## Fragile or incidental passes

These pass on web today, but for the wrong reason:

- **`mimic-inferior-mi` emergency level:** reached only through "No chest pain described" matching the cardiac regex.
- **`appendicitis-generalised-peritonitis-sepsis`, `appendicitis-perforated-abscess`, `ppu-elderly-steroids-masked`, `ppu-septic-shock-delayed`: blood cultures** come from the *cholecystitis* protocol, which is seeded because cholecystitis is in the PANE top 3.
- **`mimic-dka-abdominal-pain` IV fluids:** come from the falsely fired peritonism prompt.
- **`ami-embolic-af` heparin:** comes from the ischaemic-colitis medication list, labelled for venous thrombosis.

Fixing the negation or seeding behaviour will turn some of these into failures. That is expected and correct.

## Notes on the vignettes

- CCs are the patient's words, and the web CC template is always "Acute abdominal pain". Web SOCRATES answers are free text, as a clinician types them in the CC strip. PANE Q&A answers are used only where the clinician would answer the question (`previous_surgery`, `nsaid_use`, `pulsatile_mass`, `hernia_irreducible`).
- Pertinent negatives are written as clinicians write them ("No guarding, no rebound"). This deliberately exercises negation.
- `critical` is used only for patient safety: missed diagnosis, missed emergency, contraindicated or missing time-critical treatment, dosing errors, and score arithmetic that moves a patient between bands. Where no guideline threshold applies, the expectation is `quality` with a note.
- Citations: every entry is `verified: false`.
  - The WSES Bologna ASBO guideline is cited as the 2017 update (World J Emerg Surg 2018;13:24). A 2025 revision was mentioned in the brief, but I could not confirm its reference, so it is not cited. If it exists and supersedes the 2017 text, replace the citation and re-check the statements.
  - The volvulus guideline is ASCRS **2021**; the diverticulitis guideline is ASCRS **2020**.
  - The author list and year of the EAU paediatric urology guideline need checking.
- Not committed: `docs/clinical-validation/results/*` and `REPORT.md` (regenerate them with `clinval:web` and `clinval:report`).

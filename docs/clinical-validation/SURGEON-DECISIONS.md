# Clinical validation — decisions for the surgeon

The consultation-bay test suite (397 synthetic vignettes: 7 surgical clusters, then 4 beyond surgery; results in
`REPORT.md`, detail in `findings/*.md`) found two kinds of problem:

- **Software bugs** (part E): fixed without a clinical decision, because they make the engine
  ignore what the clinician wrote. Listed so you know they are changing.
- **Clinical content** (parts A–D): drugs, doses, thresholds, protocols and guideline choices. Nothing
  here changes until you approve it. Each item gives the proposed change and its likely source. The sources here and in
  the vignettes are unverified (`verified: false`) until checked against the current documents.

Reply with the item numbers you approve (for example "approve A1–A12, B1–B6; A7 no"), or amend any.

## A. Remove or correct unsafe content (highest priority)

| # | Now | Proposed | Source | Finding |
|---|---|---|---|---|
| A1 | Tranexamic acid 1 g IV in every non-variceal upper GI bleed | Remove from the protocol | ESGE 2021; HALT-IT | upper-gi |
| A2 | "Aggressive" Hartmann's 250–500 mL/h in every pancreatitis plan, including heart failure | Moderate, goal-directed fluids | WATERFALL 2022; ACG 2024 | hpb |
| A3 | DVT in pregnancy: rivaroxaban/apixaban offered; warfarin proposed | LMWH in pregnancy; no DOAC or warfarin; D-dimer caveat | RCOG GTG 37a | soft-tissue-trauma-burns |
| A4 | Ibuprofen in post-op orders at 21–26 weeks' gestation | No NSAIDs from 20 weeks | MHRA / FDA NSAID pregnancy advice | hpb |
| A5 | Template states "β-HCG confirmed negative" before any test (including 26 weeks pregnant) | Replace with "β-HCG: result required" | — | hpb, gi-emergencies |
| A6 | Ruptured ectopic plan still offers methotrexate | Ruptured: surgery only | NICE NG126 | gi-emergencies |
| A7 | Strangulated/incarcerated hernia: "attempt gentle manual reduction" | No reduction when strangulation is suspected; emergency repair | WSES 2017 | hernia-breast-endocrine |
| A8 | Any Bethesda result (including I and II) gives a total-thyroidectomy operative plan | Plan by Bethesda category (repeat FNA / observe / lobectomy / total) | BTA; ATA 2015 | hernia-breast-endocrine |
| A9 | Inflammatory breast cancer: wide local excision and sentinel node biopsy | Neoadjuvant therapy first; no WLE/SLNB | NCCN | hernia-breast-endocrine |
| A10 | Angiodysplasia (K55.21) mapped to the ischaemic colitis protocol (heparin infusion) | Own bleeding plan; no heparin | ACG LGIB 2023 | colorectal-anorectal |
| A11 | Toxic megacolon plan orders colonoscopy | No colonoscopy in toxic megacolon | BSG 2019 | colorectal-anorectal |
| A12 | Upper GI bleed on anticoagulation: elective "hold DOAC / bridge with LMWH" text | Bleeding-specific reversal advice; no bridging during active bleeding | ESGE 2021; BSG/ESGE antithrombotics | upper-gi, colorectal-anorectal |
| A13 | Anticoagulated head injury: same elective hold/bridge text; no reversal step | Reversal step; CT within 8 h per NICE | NICE NG232 | soft-tissue-trauma-burns |
| A14 | H. pylori triple therapy includes amoxicillin despite recorded penicillin anaphylaxis | Penicillin-free regimen when allergic (and an allergy cross-check, C5) | Maastricht VI | upper-gi |
| A15 | Tension pneumothorax: 2nd intercostal space mid-clavicular for everyone | Adults 4th/5th ICS anterior to mid-axillary line | ATLS 10 | soft-tissue-trauma-burns |
| A16 | Prophylactic antibiotics in 5 of 8 pancreatitis cases without infection | "No prophylactic antibiotics" unless infection documented | ACG 2024; IAP/APA | hpb |
| A17 | Cholangitis: ERCP within 72 h | Within 24 h (severe: urgent) | ACG 2024; TG18 | hpb |
| A18 | Variceal protocol transfusion target 80–100 g/L | Restrictive 70–80 g/L | Baveno VII | upper-gi |
| A19 | UC key point "WBC > 10.5" | Truelove & Witts uses Hb < 10.5 g/dL | Truelove & Witts 1955 (via BSG 2019) | colorectal-anorectal |
| A20 | iOS LRINEC < 6 reads "low probability — consider cellulitis" | LRINEC must not rule out NSTI; clinical suspicion → surgical exploration | WSES 2018 | soft-tissue-trauma-burns |
| A21 | iOS burns card: "oral fluids may suffice" for small visible burns, including high-voltage electrical injury | Electrical injury: IV fluids and a urine target regardless of visible TBSA | ABA; BBA | soft-tissue-trauma-burns |
| A22 | Children (30 kg) get adult doses (paracetamol 1 g, ibuprofen 400 mg, pip-tazo 4.5 g); infants offered mesh and a truss | Weight-based paediatric dosing; paediatric hernia template | BNFc | gi-emergencies, hernia-breast-endocrine |
| A23 | Bowel obstruction: stent offered despite impending caecal perforation; sigmoid volvulus has no endoscopic decompression; caecal volvulus no resection | State stent contraindications; split sigmoid / caecal / right-sided plans | WSES 2018; ASCRS 2021 | gi-emergencies |
| A24 | Fistula-in-ano (K60.3) mapped to the fissure protocol (GTN, botox, sphincterotomy) | Own fistula plan (EUA, fistulotomy or seton by complexity) | ASCRS 2022 | colorectal-anorectal |
| A25 | Pancreatitis: same-admission cholecystectomy suggested despite a necrotic collection | Defer until collections resolve | IAP/APA; ACG 2024 | hpb |

## B. Add missing protocols or diagnoses

| # | Missing | Proposed content (outline) | Finding |
|---|---|---|---|
| B1 | Variceal bleeding (I85) | Terlipressin, antibiotics, restrictive transfusion, band ligation, endoscopy ≤ 12 h | upper-gi |
| B2 | Lower GI bleeding (K92.2 currently → upper GI protocol) | Oakland score, CT angiography if unstable, colonoscopy timing | colorectal-anorectal |
| B3 | Acute mesenteric ischaemia | CT angiography, heparin, revascularisation, vascular referral | gi-emergencies |
| B4 | Ruptured / symptomatic AAA (I71.x) | Permissive hypotension, vascular surgery, no fluid bolus | gi-emergencies, soft-tissue-trauma-burns |
| B5 | Acute limb ischaemia | Heparin, urgent vascular referral, revascularisation | soft-tissue-trauma-burns |
| B6 | Fournier's gangrene (N49.3) | Emergency debridement, broad-spectrum antibiotics; flag SGLT2 inhibitors | colorectal-anorectal |
| B7 | C. difficile infection | Oral vancomycin/fidaxomicin; fulminant → surgical review | colorectal-anorectal |
| B8 | Anal cancer and atypical anal ulcers | EUA, biopsy, HIV test | colorectal-anorectal |
| B9 | Burns under 30% TBSA (only ≥ 30% has a plan) | Fluids, referral criteria, escharotomy, airway | soft-tissue-trauma-burns |
| B10 | Safeguarding (non-mobile infant bruising, immersion scald) | Safeguarding flag and referral, skeletal survey | soft-tissue-trauma-burns |
| B11 | Trauma in pregnancy | Left tilt, obstetric call, CTG, Kleihauer, anti-D, abruption | soft-tissue-trauma-burns |
| B12 | Post-thyroidectomy hypocalcaemia | Read calcium; IV calcium, ECG, magnesium | hernia-breast-endocrine |
| B13 | Airway compromise (stridor, neck haematoma) named as an airway emergency | Airway step first; anaplastic cancer / lymphoma in the differential | hernia-breast-endocrine |
| B14 | Cardiac, respiratory and vascular mimics (MI, pneumonia, aortic dissection, aorto-enteric fistula) | Add to the differential; ECG/troponin/CT angiography prompts | upper-gi, gi-emergencies, hpb |
| B15 | Ectopic pregnancy in the main differential; Boerhaave; food bolus with complete obstruction | Add; read last menstrual period answer | upper-gi, gi-emergencies |
| B16 | Cause-specific pancreatitis actions (thiamine/withdrawal, stop azathioprine, hypertriglyceridaemia), amoebic abscess drugs | Add branches | hpb |

## C. Engine capabilities (behaviour, not wording)

| # | Now | Proposed | Finding |
|---|---|---|---|
| C1 | Triage and alarms don't read lab values, ECG or imaging | Read Hb/ferritin (IDA), FIT, calcium, troponin, ECG ST change, lactate | several |
| C2 | iOS emergency level comes only from complaint keywords (27 of 39 GI emergencies too low) | Highest of keywords, vitals (NEWS2), text alarms and confirmed diagnosis | gi-emergencies, hpb |
| C3 | Sepsis alarm needs fever | qSOFA / lactate rule without fever | gi-emergencies |
| C4 | Severity variant picks the first (mildest) match | Check most severe first; "uncomplicated" as the fallback | gi-emergencies |
| C5 | No allergy cross-check against plan drugs | Check plan drugs against recorded allergies (class-aware) | upper-gi, hernia-breast-endocrine |
| C6 | PANE: every unrelated finding counts at 0.30; inguinal hernia boosted by male prior | Recalibrate; bleeding/dysphagia/vomiting feature rules | upper-gi, hernia-breast-endocrine |
| C7 | Pregnancy status not used in plans | Pregnancy-aware templates (imaging, drugs, obstetric input) | hpb, soft-tissue-trauma-burns |
| C8 | TG18 calculator lacks > 72 h and gangrenous criteria | Add the missing Grade II criteria | hpb |
| C9 | Cancer screening: no NG12 nipple discharge ≥ 50, no "≥ 50 with rectal bleeding" rule | Add the NG12 rules | hernia-breast-endocrine, colorectal-anorectal |
| C10 | iOS DiagnosticDatabase.json fails to decode; differential uses fallback lists | Repair the file and enable it after review with this suite | (engine map) |

## D. Guideline choices only you can make

| # | Question |
|---|---|
| D1 | Burns fluids: Parkland 4 mL/kg/%TBSA, or the ATLS 10 / ABA starting rates (2 mL adults, 3 mL children)? |
| D2 | Burns fluid threshold: ≥ 15% or > 15% (and children ≥ 10%)? Which published source? |
| D3 | Opioid + benzodiazepine interaction grade: contraindicated (web) or major (iOS)? |
| D4 | Groin abscess: flag possible pseudoaneurysm (injecting drug use) as critical or quality? |
| D5 | Exact NICE NG232 wording for CT within 8 hours on anticoagulants |
| D6 | Who signs off clinical content, and review dates for P1/P2/P3 items |

## E. Keyword rules that need a clinical call (found while fixing the matching bugs)

| # | Now | Question |
|---|---|---|
| E1 | "Paraumbilical hernia … strangulation not excluded" now selects the strangulated plan | Is the strangulated plan right when strangulation is only "not excluded"? |
| E2 | Triage cardiac rule fires on "radiating to"; "left arm" in past surgical history counts as cardiac | Narrow the cardiac rule to chest pain radiating to arm/jaw? |
| E3 | "Dilated CBD" prompt fires on any mention of "CBD" (even 4 mm) | Fire only when a diameter above a threshold is written? (which threshold) |
| E4 | Variant keywords miss common wording: cholangitis grades, "Hinchey Ib" listed as uncomplicated, "uncomplicated acute sigmoid diverticulitis" and "mild acute biliary pancreatitis" select nothing | Approve a keyword list per variant |
| E5 | Thyroid group ICD prefix D44 also catches adrenal masses; no parathyroid group | Split D44 and add a parathyroid group? |
| E6 | iOS lookups: parathyroid disease → renal colic (via "nephrolithiasis"); cellulitis with type 2 diabetes → diabetes; large bowel obstruction → small bowel obstruction entry | Map these three explicitly |

## G. Phase 2 — beyond surgery (acute medicine, perioperative, endocrine/renal/urology/neurology, screening/obstetrics/paediatrics)

154 more vignettes (397 in total). The engines are surgical: most medical, obstetric and paediatric
emergencies are not recognised. Details in `findings/acutemed.md`, `periop.md`, `endorenal.md`,
`prevobspaed.md`.

### G1. Scope (decide these first; the rest follows from them)

| # | Question |
|---|---|
| G1.1 | Medical, obstetric and paediatric emergencies: a separate "recognise and redirect to 911 / emergency department" layer (fits an outpatient surgical clinic), or full diagnosis and management content? |
| G1.2 | Which first actions may the clinic suggest before transfer (IM adrenaline, aspirin, oxygen)? Is adrenaline stocked at Rodney Bay and Tapion? |
| G1.3 | Should vital signs (NEWS2), blood pressure, critical labs (K⁺, glucose/ketones, calcium, troponin) and ECG changes drive the triage level? Today triage reads text only. |
| G1.4 | Children: below what age/weight are adult templates and doses suppressed? Recognition-and-redirect only for infants? |
| G1.5 | Pregnancy: recognition and obstetric handover only, or management content? |

### G2. Unsafe content to correct

| # | Now | Proposed | Source (unverified) |
|---|---|---|---|
| G2.1 | One anticoagulation template for everyone: bridges warfarin in plain AF and before diagnostic OGD; vitamin K for a therapeutic INR; no stop/restart timing | Procedure-specific plan: no bridging for most AF (BRIDGE); DOAC intervals (PAUSE); BSG/ESGE 2021 low/high-risk endoscopy table | ACC 2017; ACCP 2022; BSG/ESGE 2021 |
| G2.2 | Recent coronary stent ignored; clopidogrel not stopped before EMR | Hard stop inside stent windows (6 months elective PCI, 12 months ACS) unless cardiology agrees | ESC/ESAIC 2022 |
| G2.3 | No SGLT2 inhibitor rule; euglycaemic DKA not recognised (glucose-only DKA triggers) | SGLT2i withholding rule (CPOC: day before and day of surgery, or FDA label 3–4 days); ketone/pH-based DKA recognition | CPOC 2021; JBDS 2023 |
| G2.4 | HHS gets the DKA insulin rate | Saline first, osmolality, lower insulin rate | JBDS HHS 2022 |
| G2.5 | Anaesthetic hazards (malignant hyperthermia, suxamethonium apnoea, latex, STOP-Bang, steroid cover) never reach the plan | Plan alerts; who acknowledges | AAGBI |
| G2.6 | No VTE prophylaxis in any operative plan (even Caprini 11 with cancer) | VTE line in every operative plan; renal adjustment of enoxaparin | NICE NG89 |
| G2.7 | Alteplase offered 6 days after laparotomy without the contraindication | State recent major surgery as a contraindication | ESC 2019 PE |
| G2.8 | COPD with CO₂ retention: oxygen to ≥ 94 % | 88–92 %, controlled, blood gas | BTS 2017 oxygen |
| G2.9 | Anaphylaxis not named; low BP gets a 1 L fluid bolus, no adrenaline | Recognise anaphylaxis; IM adrenaline first | Resus Council UK 2021 |
| G2.10 | Pulmonary oedema and high-risk PE offered fluid boluses | No bolus when heart-failure signs or suspected PE are recorded | ESC 2021 HF; ESC 2019 PE |
| G2.11 | Pregnancy: DOAC/warfarin for PE at 30 weeks; ibuprofen at 32–34 weeks; no BP alarm at 172/114 (threshold 180); eclampsia without magnesium; "β-HCG confirmed negative" at 32 weeks; CT at 10 and 26 weeks | LMWH; no NSAIDs from 20 weeks; 160/110 threshold with pre-eclampsia/HELLP wording; magnesium; obstetric review | RCOG; NICE NG133 |
| G2.12 | Children get adult doses and adult vital-sign thresholds (all 11 under-16 vignettes) | Weight-based dosing; paediatric thresholds | BNFc; APLS |
| G2.13 | Hyperkalaemia: calcium gluconate 10 mL of 10 % (web prompt and iOS AKI card) | 30 mL of 10 % | UKKA 2023 |
| G2.14 | iOS SAH card: "IV nimodipine 60 mg 4-hourly" (oral dose with IV route) | Oral 60 mg 4-hourly | NICE NG228 |
| G2.15 | Stroke: ABCD2 suggested | Remove ABCD2 (NICE advises against) | NICE NG128 |
| G2.16 | Hyponatraemia: fluid restriction offered to a volume-depleted ileostomy patient; 3 % infusion instead of 150 mL bolus; thiazide not stopped | Volume status first; bolus regimen; stop thiazide | European 2014 |
| G2.17 | Obstructed infected kidney: no nephrostomy/stent; anuric solitary kidney gets diclofenac | Urgent decompression; no NSAID in AKI | EAU 2024 |
| G2.18 | Haemorrhage on apixaban: elective "hold / bridge" line | Reversal advice | — |
| G2.19 | Web screening prompts out of date (bowel screening from 50, annual mammogram, no HPV, PSA and colonoscopy past 80; nothing for AAA, hepatitis B/C, HIV, post-polypectomy, Lynch) | Choose USPSTF/ACG/MSTF or NICE/BSG; port the iOS screening engine (already mostly USPSTF) to web | USPSTF |

### G3. Missing recognition (add as "recognise and redirect" at minimum)

Acute coronary syndrome (ECG/troponin prompt); stroke (FAST, time window); thunderclap headache/SAH;
meningitis; cauda equina; spinal cord compression; sepsis without fever (NEWS2); new/unstable AF;
anaphylaxis; hypertensive emergency; DKA/HHS/hypoglycaemia (no treatment prompt today); hyperkalaemia;
hypercalcaemia of malignancy; pre-eclampsia/HELLP; ovarian torsion; ectopic in the main differential;
intussusception, pyloric stenosis, malrotation (bilious vomiting in an infant); febrile infant
(NICE NG143); safeguarding (child protection, domestic violence — the practice must supply local
contacts); tetanus-prone wound; post-splenectomy vaccination; post-operative delirium.

## H. Sign-off register for merged fixes

Each merged fix keeps its full list under "Needs sign-off" in its change log. Nothing listed there is treated as
approved. Reply with the file and item numbers you approve (for example "fix-web-triage 1–6 approved; 7 no").
Or record each decision in the app: **Insights → Clinical sign-off** (doctor / admin, after Migration 95) lists every
item below and in sections A–G and I, with approve / amend / reject / defer and an attestation; approved rule sets reach
`clinical-content/registry.json` through `signoff:apply` ([signoff-tool](changes/signoff-tool.md)).

| Change log | Area | What needs your decision |
|---|---|---|
| [fix-web-screening](changes/fix-web-screening.md#needs-sign-off) | Preventive and cancer screening (web) | USPSTF as primary source, NG12 rectal-bleeding/IDA thresholds, PSA start age, universal hepatitis B, diabetes from 35 (10 items) |
| [fix-web-triage](changes/fix-web-triage.md#needs-sign-off) | Triage level, emergency recognition | Safeguarding contacts, CBD, troponin, sepsis, potassium and calcium thresholds, scrotal/pelvic pain as emergencies, aspirin in ACS, paediatric vital bands (14 items) |
| [fix-web-differential](changes/fix-web-differential.md#needs-sign-off) | Web differential (PANE 1.0.0) | Every likelihood, prior tiers, pregnancy multiplier, age and sex ratios, Caribbean diabetes tier, ICD T31.20 (11 items) |
| [fix-ios-triage-cards](changes/fix-ios-triage-cards.md#needs-sign-off) | iOS triage cards and safety checks | Burns fluids, redirect wording and hospitals, sepsis, BP and lab thresholds, paediatric bands, drug-allergy rules, doses written into cards (14 items) |
| [fix-ios-differential](changes/fix-ios-differential.md#needs-sign-off) | iOS differential (DiagnosticDatabase 2.0.0) | Using the database at all; priors, weight caps, 121 curated candidates, every citation |
| [fix-web-protocols](changes/fix-web-protocols.md#needs-sign-off) | Web plans and protocols, patient filter | SGLT2 withholding period, P2Y12 stop times and stent windows, burns fluids, `resolveProtocol`, protocols with uncertain sources, frailty trigger |
| [ios-screening-parity](changes/ios-screening-parity.md#needs-sign-off) | iOS screening, NG12 suspected-cancer card, TIA scores | Web rule sets applied to iOS, PSA from 45 for African-Caribbean ancestry, BRCA surveillance ages, NG12 thresholds, removing ABCD² for TIA (13 items) |
| [supplements-interactions](changes/supplements-interactions.md#needs-sign-off) | Herbs, bush teas and supplements (web + iOS) | Grades of 41 herb–drug rules, lab thresholds for the "ask about" prompts, candidate Caribbean bush teas, emergency-surgery wording, vitamin E / fish oil, local brand names |
| [lifestyle-practices](changes/lifestyle-practices.md#needs-sign-off) | Fasting, complementary therapies, sleep (web + iOS) | Evidence grade labels (IV vitamin drips: Mixed or No benefit?), trigger conditions, age ≥ 65 / sleep < 6 h / BMI ≥ 30, fasting-prompt scope, three draft health-library articles, IDF-DAR citation |
| [web-plan-filter-everywhere](changes/web-plan-filter-everywhere.md#needs-sign-off) | Web: filter on every screen, seeded investigations | Holding back stat tests from unconfirmed diagnoses, 20% leading-differential threshold, two new protocols (aorto-enteric fistula, IgA vasculitis), 50 mL fluid cut-off, pregnancy-test rules, SAH left unmapped (11 items) |
| [ios-plan-safety](changes/ios-plan-safety.md#needs-sign-off) | iOS: plan safety filter, 38 new plan cards | Cephalosporins withheld after penicillin anaphylaxis (web only cautions), thrombolysis withheld on anticoagulants, inferred "not pregnant", DOAC/valve wording, TG18 thresholds, recognise-and-redirect cards (23 items) |
| [followups-prep-h10](changes/followups-prep-h10.md#needs-sign-off) | Printed prep sheet and procedure leaflets brought under H-10; front-desk card permissions; iPad lifestyle questions | Every changed patient sentence before → after (A1–A18, B1–B24), iPad questions (C1–C3), open points: ERCP sedation vs general anaesthetic, iron before endoscopy, antithyroid medicines before thyroidectomy, juice as clear fluid |
| [web-last-gaps](changes/web-last-gaps.md#needs-sign-off) | Web: last critical fails, TG18 auto-fill, screening hooks, operative templates and prompts | TG18 auto-fill rules, colonic stent contraindications, screening-request triage rule, SIGN 104 / HerniaSurge prophylaxis, NSAID and renal VTE rules, GI bleed instability, NICE NG45 clotting, UKKA bands, diabetic foot flags, triage over-triage model (19 items) |
| [ios-last-criticals](changes/ios-last-criticals.md#needs-sign-off) | iOS differential (DiagnosticDatabase 2.1.0) and triage level 1.1.0 | NEWS2 by urgency tier, diagnoses added from report evidence, post-operative day and masking rules, new Gastric Outlet Obstruction, new and tightened likelihood ratios for 20 conditions, NG12 card sets priority, acute-clause rule, domestic-abuse red flag (21 items) |
| [ios-parity-web-last-gaps](changes/ios-parity-web-last-gaps.md#needs-sign-off) | iOS: the web-last-gaps fixes (plan filter 1.1.0, cards 1.3.0, acuity 1.2.0) | NSAID exclusions on every plan line, stable GI bleed needs recorded vitals, UKKA bands with a recorded K⁺, D-dimer / occult-malignancy CT withheld in pregnancy, injury on an anticoagulant, operative-template lines and plan default, relatives' history entries, TG18 age ≥ 75, NG19 diabetic foot terms (gangrene stays emergency) (17 items) |
| [diagnostic-reasoning](changes/diagnostic-reasoning.md#needs-sign-off) | "Dr House" reasoning panel (web + iOS): for/against, best next test, doesn't-fit alerts, 16 zebra rules, longitudinal view | Evidence and alert thresholds (web LR ≤ 0.2, iOS 0.33), acceptable alert rate (now 7.6% on web), can't-miss list, zebra rules and citations, time-out triggers |
| [outcomes-calibration](changes/outcomes-calibration.md#needs-sign-off) | Real-outcomes loop (web + iOS): prediction snapshots, final diagnoses, calibration report, proposed adjustments | Governance defaults in I2 (retention, minimum counts, who sees and exports), the 14-day reminder, the triage mapping to a common scale, the ICD-category match rule, the pathology/operation triggers (8 items) |
| [whats-missing](changes/whats-missing.md#needs-sign-off) | "What's missing" strip and score auto-fill (web + iOS) | Safety order (weight → allergy → pregnancy → renal → anticoagulant → supplements), probe values, NEWS2 rule, pregnancy 12–55 and weight < 16 scopes, renally-cleared drug list, auto-fill thresholds, all wording |
| [history-by-complaint](changes/history-by-complaint.md#needs-sign-off) | History questions by complaint (21 symptom types, 41 frames; web + iOS) | Frames and wording, classifier priority (e.g. reflux classed as chest pain), default pain regions, cough duration bands, MRC wording, chip-to-engine values, record-only chips, bleeding anticoagulant questions |
| [evidence-exam](changes/evidence-exam.md#needs-sign-off) | Evidence-based exam signs (67) and decision rules (24) feeding both engines (PANE 1.1.0, iOS database 2.2.0) | Every LR (all written from memory), rule-vs-component policy, AIR over Alvarado, PERC only with Wells ≤ 4, new cirrhosis and abdominal-wall pain (ACNES) diagnoses, sign-to-diagnosis links, exam region per history frame (106 items) |
| [followups-history](changes/followups-history.md#needs-sign-off) | History follow-ups (web + iOS): cough symptom vs aggravating factor, whole-word short database terms, chips read with their question, lump questions in the patient questionnaires | Cough clause rules, the stem list, early-form chips read as record findings, patient lump wording and stored chips, APCQ lump questions (5 items) |
| [bayes-treatment](changes/bayes-treatment.md#needs-sign-off) | Score → action, result → posterior shift, personalised treat / test / observe decisions (web + iOS) | Every effect size and harm (74 sources, all written from memory), 43 patient modifiers and 4 hard exclusions, risk bands, lab upper limits (need the practice's own ranges), confirmed-diagnosis ≥ 95% rule |
| [outcomes-calibration](changes/outcomes-calibration.md#needs-sign-off) | Real-outcomes loop: prediction snapshots, final diagnosis, calibration report and proposals (Migration 94) | Retention, proposal minimum counts (10 prior / 20 LR), admin-only report and export, 14-day reminder, whether iOS should push outcomes (see also I2) |
| [signoff-tool](changes/signoff-tool.md#needs-sign-off) | In-app clinical sign-off (Migration 95) | Who may sign (doctor and admin, or doctors only), deferred items blocking a rule set, amended approvals counting as approved, the item-to-rule-set links, 12-month review interval, attestation wording (5 items) |
| [ios-outcomes-calculators](changes/ios-outcomes-calculators.md#needs-sign-off) | iOS outcomes push (Migration 94), iOS decision-rule calculators (Ottawa ankle / knee, Canadian CT head, NEXUS, Canadian C-spine, both syncope rules, the real STONE score) linked to their bands (iOS database 2.3.0), old iOS "STONE" relabelled, validation runner stores recorded scores | STONE origin item in a Caribbean population, STONE and Canadian CT head iOS targets, rules with no iOS target, old local stone score and its boost, pre-fill and wording, outcomes push details (12 items) |
| [lab-feed](changes/lab-feed.md#needs-sign-off) | Automatic lab results (FHIR / HL7 feed, Migration 96) and practice reference ranges | Default ranges and critical limits (to be replaced by the laboratory's), escalation expectation for a critical result, exact MRN + DOB matching rule, LOINC map, retention of dismissed reconciliation rows (7 items) |
| [vademecum-phase1](changes/vademecum-phase1.md#needs-sign-off) | Disease-centred vademecum (shadow only, nothing in production reads it): finding dictionary, abdominal pain (100 diseases) and cough / breathlessness (30), criteria floors, pathognomonic findings, exclusions, incidental work-ups, multi-entry loop | Loop policy numbers, the PANE-to-LR conversion rule, criteria sets, pathognomonic LRs, exclusions, work-ups, new LRs, the 88 iOS features not carried over (V1–V14) |

Decided so far:

- **2026-09-25, practice owner:** patient pre-procedure text may tell patients to stop herbal remedies, bush teas and
  supplements 2 weeks before a planned operation or a procedure with sedation or anaesthetic. It must give the reason and the
  circumstances. Prescribed medicines stay under hazard H-10: no take/hold/stop wording.
- **2026-09-25, practice owner:** the differential is neutral across all conditions, not only surgical ones. Non-surgical emergencies are recognised and redirected. The triage level is the highest
  of text, vitals, BP, labs, ECG and diagnosis. Under-16s get "weight-based dosing — calculate per BNFc". Pregnancy filters the lists. These are
  the defaults the fixes above were built on; the individual weights and wordings still need item-by-item sign-off.

## F. Software bugs fixed (no clinical decision needed)

Done 2026-09-25 (web and shared engines; iOS lookup):

- Negated findings no longer fire ("no guarding" → no appendicectomy plan; "no black stools" → no
  emergency; "Murphy's sign negative" → no cholecystectomy plan). Rule: a negation cue within 5 words
  in the same clause; when uncertain ("cannot be excluded", "?appendicitis") the finding is kept.
- Whole-word matching: "irreducible" no longer matches "reducible"; "Bethesda VI" no longer read as
  V; "hinchey i" no longer matches "hinchey iii"; "moderately severe" no longer read as severe. When
  several variants match, the most specific wins.
- iOS: "mi" inside "abdominal" and "pe" inside "penetrating" no longer attach MI/PE antithrombotic
  plans (ruptured AAA now gets the AAA entry).
- Two-week-wait referrals labelled by the right cancer (the "colorectal" label bug).
- The Assessment management panel follows the diagnosis the clinician confirmed.
- A written temperature counts as fever only at 38.0 °C or above, or when described as raised.

Effect on the web suite: 1178 → 1265 checks passing; critical failures 312 → 281; 114 previously
failing checks now pass. 27 checks that had passed only because of the bugs (for example an
emergency reached only through "No vomiting") now fail and are listed as known gaps.

In progress: the same negation handling for the iOS text parser ("No crepitus" still raises the
necrotising-fasciitis alarm on iOS) and "Heartburn" opening the Burns pathway on iOS.

## I. Decisions made (dated, with the owner)

### I1. Patients may be told to stop herbal products 2 weeks before surgery — DECIDED 2026-09-25

- **Owner:** Dr Dawit Daniel Kabiye (practice owner), 2026-09-25, relayed with the herbs /
  supplements work (`docs/clinical-validation/changes/supplements-interactions.md`).
- **Decision:** patient-facing pre-op text MAY tell patients to stop herbal supplements 2 weeks
  before an operation or a procedure with sedation or an anaesthetic, and must give the reason and
  the circumstances. Prescribed medicines are unchanged: hazard H-10 still forbids take / hold /
  stop wording for them.
- **Approved text** (same words in `artifacts/front-desk/lib/instructions.ts` HERBAL_SUPPLEMENTS_STOP,
  `artifacts/api-server/src/lib/sms.ts` PREP_HERBAL, the dashboard's printed prep sheet and
  `supplement-catalogue.ts` / `SupplementCatalogue.swift`): "Herbal remedies, bush teas and
  supplements: please stop them 2 weeks before your operation or procedure. This includes garlic
  tablets, ginkgo, ginseng, ginger supplements, turmeric (curcumin), St John's wort, kava, echinacea,
  ashwagandha, ephedra (ma huang) and bush teas or herbal mixtures (tablets, capsules, extracts or
  strong teas — normal amounts in food are fine). Why: … When: … If your operation is less than 2
  weeks away, stop them now and tell the team what you take. If you take valerian every night, do
  not stop it suddenly — call the clinic. This does not apply to medicines prescribed by a doctor:
  do not stop any prescribed medicine unless the clinic tells you to. …"
- **Enforcement:** `lint:patient-instructions` and `outbound-safety.test.ts` allow stop wording only
  in the verbatim approved sentences, which name no prescribed medicine; tests confirm that stop
  wording with warfarin, aspirin, insulin, metformin, clopidogrel or "blood thinners" still fails.
- **Still open (not decided):** vitamin E and fish oil (not in the briefing); wording for emergency
  / urgent surgery; whether the pre-op assessment visit and minor procedures under local
  anaesthetic should carry the paragraph.

### I2. Real-outcomes loop: governance — ITEM APPROVED 2026-09-26; DEFAULTS BELOW AWAIT CONFIRMATION

- **Owner:** practice owner (Dr Dawit Daniel Kabiye) approved building the loop: record each
  patient's final diagnosis, compare it with what the engines predicted, and propose model
  changes from real data, applied only with the surgeon's approval. **Nothing changes the
  engines automatically.** Change log: [outcomes-calibration](changes/outcomes-calibration.md).
- **Defaults built in (confirm or change each):**
  1. **Retention.** Prediction snapshots and final diagnoses are kept indefinitely, like the
     clinical record they measure; outcomes are retracted, never deleted; deleting a patient
     deletes both. Revisit with the records retention schedule (compliance A-17).
  2. **Who records.** Nurse, doctor or admin confirm (and retract) final diagnoses; front desk has
     no access (database policies, Migration 94).
  3. **Who sees the report.** The "Engine accuracy" page is admin only. (Option: open it to
     doctors, since it holds aggregates only.)
  4. **Who exports.** The de-identified research export is admin only, needs a signed-in admin
     session, and is refused unless the audit-log row is written first. It stays inside the
     practice until you decide who may receive it and under what agreement; small cells (a rare
     diagnosis with an age band and a month) are not suppressed yet.
  5. **Minimum counts for proposals.** Prior tier: ≥ 10 confirmed cases of the diagnosis, a 95%
     interval that excludes the current share, and a change of tier (Dirichlet concentration 200).
     Likelihood: ≥ 20 recorded cases, a 95% interval that excludes the current value and a change
     ≥ 0.10 (Beta, 20 pseudo-cases). iOS weights: none until the log-unit fixes (C-2 to C-4).
  6. **Reminder.** "Final diagnosis not yet recorded" after 14 days, only for encounters with an
     operation or pathology.
- **Always:** a proposal is applied only through a content-change PR with a version bump, a
  vignette A/B run and your signature on each line (`docs/CLINICAL-CONTENT-UPGRADES.md` §4.6.1).

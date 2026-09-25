# Clinical validation — decisions for the surgeon

The consultation-bay test suite (243 synthetic vignettes across 7 surgical clusters, results in
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

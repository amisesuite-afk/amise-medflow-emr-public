# Clinical validation findings — upper GI cluster

34 guideline-referenced vignettes (`ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/`, category
`upper-gi`) run through the web harness (`pnpm --filter @workspace/scripts run clinval:web`) on
branch `clinval-ugi` (base `52616d2`, 2026-09-25). Measurement only: no engine, threshold or
clinical data was changed.

- **Web** results are exact. Every failing web expectation carries `knownGap: ["web"]`, a
  `knownGapNote` saying what the engine does instead, and a `proposedFix` where one is clear. The
  web run exits 0 (no blocking failures).
- **iOS** was not run (no Xcode here). Every expectation that applies to iOS carries
  `unverified: ["ios"]` so the CI unit-test job reports it without blocking. Triage it after the
  first CI run: drop the flag where it passes, convert it to a `knownGap` with a note where it fails.
- Citations are `verified: false`. They were written from the guideline texts and need a
  clinician's check against the source. `authoring.reviewedBy` is empty: the expectations need the
  surgeon's sign-off before they are treated as authoritative.
- `results/web-latest.*` and `REPORT.md` are not committed with this change (regenerate locally).

## Totals (web, 34 upper-GI vignettes)

| Expectations | Pass | Fail | n/a | Critical | Critical pass | Critical fail (all known gaps) | Quality fail |
|---|---|---|---|---|---|---|---|
| 271 | 179 | 92 | 0 | 142 | 96 | 46 | 46 |

The critical failures come from seven root causes (next section). Only
`ugib-post-endoscopy-rockall` passed everything.

## Top safety gaps (ranked)

| # | Gap | Evidence (vignette / expectation) | Proposed fix |
|---|---|---|---|
| 1 | **Tranexamic acid is prescribed on every non-variceal upper GI bleed plan.** The `upper_gi_bleed` protocol medications list "Tranexamic acid 1 g IV stat". ESGE 2021 makes a strong recommendation against it; in HALT-IT it did not reduce deaths and increased venous thromboembolism. | `mgmt-no-tranexamic-acid` fails in all 7 non-variceal bleed vignettes (`ugib-*` except post-endoscopy) | Remove it from `lib/pane-engine/src/management/protocols/upperGI.ts` (surgeon sign-off). |
| 2 | **Variceal bleeding gets no variceal treatment on the web plan.** `getProtocolByIcd` has no `I85` prefix and PANE never converges, so no protocol loads: no terlipressin, antibiotic prophylaxis, band ligation or 12 h endoscopy. The dx variant picks `ugib_nonvariceal_stable` (checked first; its keywords include "haematemesis"), which prints the non-variceal PPI prefix. If the protocol did load, its "transfuse to Hb 70–90 g/L (80–100 in varices)" contradicts Baveno VII (target 7–8 g/dL; over-transfusion increases rebleeding and mortality). | `variceal-bleed-known-cirrhosis`: `mgmt-vasoactive`, `mgmt-antibiotic-prophylaxis`, `mgmt-endoscopy-12h`, `mgmt-band-ligation`, `variant-variceal`; `variceal-bleed-unrecognised-cirrhosis` likewise. `mgmt-no-liberal-transfusion-varices` passes only because no protocol loads (noted in the vignette). | Add `I85` to the protocol, or a dedicated variceal protocol with Baveno VII content; fix the transfusion target; order `ugib_variceal` before `ugib_nonvariceal_stable` in `dx-variants.ts` (with `lint:dx-phases`). |
| 3 | **An actively bleeding anticoagulated patient gets an elective LMWH bridging plan.** `computeClinicalPrompts` `anticoag_check` fires on any anticoagulant and adds "hold DOAC 48–72h pre-op; warfarin — bridge with LMWH per haematology protocol". Antiplatelets (aspirin, clopidogrel) are not covered by that prompt at all, and nothing routes the DAPT decision to cardiology. | `ugib-on-warfarin-high-inr`, `ugib-elderly-doac-pre-endoscopy-rockall`: `mgmt-no-lmwh-bridging`; `ugib-cvd-dual-antiplatelet`: `mgmt-cardiology-antiplatelet-decision` | Suppress the bridging template when the GI-bleed prompt fires. Replace it with a clinician-decision line (withhold/reverse per ESGE; aspirin for secondary prevention not interrupted; P2Y12 with cardiology). No patient-directed hold/stop wording (H-10). |
| 4 | **Amoxicillin is prescribed despite recorded penicillin anaphylaxis.** The gastritis protocol plan line and medications list PPI + amoxicillin + clarithromycin. The allergy shows only in the header. This is the same allergy-blind plan pattern the seed appendicitis/cholangitis vignettes found. | `h-pylori-penicillin-anaphylaxis`: `mgmt-no-amoxicillin` | Filter or flag protocol drugs against recorded allergy classes in `buildPlanText` and the protocol medication list; add a bismuth quadruple regimen. |
| 5 | **MI presenting as epigastric pain is triaged as a same-day call, with no ECG, troponin or cardiac alarm.** Cardiac rules need the words "chest pain / crushing / left arm / jaw". The prompts fire "Appendicitis — emergency surgical indication" (from the "Acute abdominal pain" template) instead. | `mi-presenting-as-epigastric-pain`: `mnm-acs`, `level-emergency`, `alarm-cardiac`, `inv-ecg`, `inv-troponin` | Add an atypical-ACS rule (epigastric pain/indigestion with sweating, diabetes, age ≥50) that is urgent and says "ECG within 10 min + hs-troponin" (ESC 2023). |
| 6 | **Aorto-enteric fistula is not considered after aortic graft surgery.** Surgical history is not read by any red-flag rule. The bleed is handled as a peptic ulcer (OGD within 24 h, PPI). | `aortoenteric-fistula-herald-bleed`: `mnm-aortoenteric-fistula`, `flag-aortic-graft`, `inv-ct-angiography`, `mgmt-vascular-surgery` | New rule: GI bleeding + aortic graft/AAA repair → "aorto-enteric fistula until proven otherwise: CT angiography, vascular surgery" (ESVS 2020). |
| 7 | **Aortic dissection presenting as epigastric/back pain is not in the differential and CT angiography is never suggested.** PANE reads it as pancreatitis. Symptom inference has a dissection entry but it needs chest-pain chips. (No antithrombotic is proposed; that expectation passes.) | `aortic-dissection-epigastric-back-pain`: `mnm-dissection`, `inv-ct-angiography` | Dissection rule/prompt: abrupt or tearing pain to the back with an inter-arm BP difference or hypertension → CTA and no antithrombotics (ESC 2014). |
| 8 | **Oesophageal perforation (Boerhaave) is never in the PANE differential, and the chest-pain presentation gets no ECG.** None of its features (retrosternal pain, surgical emphysema, effortless vomiting) reach PANE. Symptom inference has no perforation entry. Once the surgeon enters K22.3, the protocol is good (CT with contrast, NBM, antibiotics, surgery). | `boerhaave-classic-mackler`: `dx-perforation-top3`; `boerhaave-presenting-as-chest-pain`: `mnm-perforation`, `inv-ecg`; `boerhaave-presenting-as-pancreatitis`: `mnm-perforation` | Map "Retrosternal"/"Chest" site and crepitus/surgical-emphysema exam chips to PANE features; add a perforation entry to symptom inference; add a chest-pain → ECG/troponin safety prompt. |
| 9 | **Food bolus with complete obstruction (cannot swallow saliva) is triaged as a same-day call, and there is no removal plan.** Adaptive triage has no saliva/drooling rule, although the app's own APCQ grades "saliva only" as emergency. There is no T18.1 protocol. In the young atopic variant (EoE), nothing asks for oesophageal biopsies. | `food-bolus-complete-obstruction`: `level-emergency`, `mgmt-endoscopic-removal`; `eoe-young-atopic-recurrent-bolus`: `inv-oesophageal-biopsies` | Add a RED_FLAGS rule for inability to swallow saliva / drooling; add a food-bolus protocol (ESGE 2016: emergent OGD ≤6 h, no barium, biopsies) and a K20 (EoE) protocol (≥6 biopsies from ≥2 levels). |
| 10 | **PANE cannot see bleeding, dysphagia or projectile vomiting, so the primary web differential misses upper GI bleeds and upper GI cancers.** `socrates-to-features` has no rules for haematemesis, melaena, coffee-ground vomit or projectile vomiting. The "Dysphagia" template has no CC hint. The "Upper GI bleed" hint sets only `nausea_vomiting`. With weak features, the male inguinal-hernia prior (×5, ×1.8 at ≥50) or the cholecystitis/GORD priors win. Symptom inference ranks the correct diagnosis #1 in almost every case. | `dx-ugib-top3` fails in 5 bleed vignettes. Cancer or specific dx not in the top 3: `dysphagia-progressive-over55`, `upper-abdominal-pain-weight-loss-over55`, `gord-alarm-weight-loss-over55`, `achalasia-pseudoachalasia-elderly`, `gastric-outlet-obstruction-elderly` | Add the missing answer/CC rules. Seed PANE from SmartSymptomPicker chips as well as SOCRATES answers. Add an age ≥55 prior modifier for oesophageal/gastric carcinoma, as colorectal cancer already has. |

Next in line (also safety-relevant):

- **Iron-deficiency anaemia is invisible.** Hb 9.1, MCV 72 and ferritin 6 in a 72-year-old man raise no
  flag, and nobody suggests colonoscopy or OGD. The severe-anaemia prompt needs Hb <8, and the NG12 IDA
  criterion in `cancer-screening.ts` needs the words "anaemia/pale/unusually tired" in the chips. The
  level expectation passes for the wrong reason: "breathless" in the CC matches the post-operative
  red-flag rule (`iron-deficiency-anaemia-over60`: `flag-ida`, `inv-colonoscopy`).
- **Every 2-week-wait cancer screen is labelled "colorectal".** In `cancer-screening.ts` the condition
  `c.met && c.rule.includes('colorectal') || c.rule.includes('bowel') || …` is true whenever any
  bowel/rectal/tarry rule exists, met or not. `cancerType` is therefore always `colorectal`, and
  colonoscopy/CEA are always added. The upper-GI branch cannot set its type (`cancerType ?? …`). Seen
  in the triage reasons of every dysphagia vignette ("Cancer screening triggered (colorectal)"). Fix:
  parenthesise `c.met && (…)`.
- **Negation drives over-triage.** In `gord-no-alarm-empirical-ppi`, "No difficulty swallowing, no
  weight loss, no vomiting, no black stools" gives *emergency now*. In `nsaid-associated-gastric-ulcer`,
  "No bleeding" gives an urgent bleed flag and "no peritonism" fires the "Generalised peritonism"
  prompt. In `mallory-weiss-young-binge`, "No chest pain" gives "Possible cardiac event". In
  `dyspepsia-young-no-alarm-test-and-treat`, "No family history of stomach cancer" gives "Possible
  malignancy".
- **Low-risk bleeding is over-treated.** GBS 0 (`ugib-nonvariceal-gbs-low-outpatient`) gets
  "crossmatch 2 units pRBC" at Hb 14.6, and nothing says outpatient management. The Mallory-Weiss
  GBS 0 case is escalated to *emergency now* because any "blood" word is an urgent red flag.
- **Shock has no dedicated plan.** The only UGIB variant is "haemodynamically stable", and no output
  mentions HDU/ICU (`ugib-nonvariceal-unstable-shock`: `mgmt-critical-care`).

## Cross-cutting root causes

1. **PANE input mapping** (`artifacts/dashboard/src/lib/socrates-to-features.ts`): no rules for
   haematemesis, melaena, coffee-ground, projectile or effortless vomiting, dysphagia (as a CC),
   retrosternal site or surgical emphysema. PANE only reads the CC template name and the SOCRATES
   answers, never the SmartSymptomPicker chips or exam chips. Together with the sex/age prior
   modifiers, this puts "Inguinal / Femoral Hernia" in the PANE top 3 of 18 of the 34 vignettes.
2. **Protocol coverage by ICD** (`getProtocolByIcd`): there is no protocol for I85 (varices), T18.1
   (food bolus), K20.0 (EoE), K22.5 (pharyngeal pouch), K30 (dyspepsia), D50 (IDA), T54 (caustic),
   I21 or I71. The plan is empty or prompt-only, so management expectations fail by omission.
3. **Allergy- and context-blind templates:** plan medications ignore recorded allergies, and
   `anticoag_check` is a peri-operative template that fires in an active bleed.
4. **Protocol content against guidelines:** tranexamic acid (ESGE 2021), the "80–100 in varices"
   transfusion target (Baveno VII), 7-day clarithromycin triple therapy (Maastricht VI: 14 days;
   bismuth quadruple where resistance is high or unknown). H. pylori regimens also disagree between
   the gastritis (7 days), peptic ulcer (7–14 days) and gastric carcinoma (14 days) protocols.
5. **dx-variant ordering:** `ugib_nonvariceal_stable` precedes `ugib_variceal` and shares generic
   keywords. This is the same ordering bug the seed vignettes found for TG18 grades. `peptic_ulcer` is
   in the "Upper GI Bleed" group, so an uncomplicated ulcer is grouped as a bleed. There is no
   unstable variant.
6. **Adaptive triage keyword rules:** no negation handling; any "bleed"/"blood" word is urgent; no rule
   for saliva-level dysphagia or atypical ACS; "coffee-ground" is not in `GI_BLEED_TERMS` or
   `RED_FLAGS` (the GBS-0 vignette gets no bleed reason for "dark coffee-ground material").
7. **`cancer-screening.ts` precedence bug:** every 2-week-wait screen is labelled colorectal (above).

## Per-condition results (web)

| Condition | Vignettes | Web result | What works | Critical gaps (known) |
|---|---|---|---|---|
| Non-variceal UGIB | `ugib-nonvariceal-gbs-high` (base), `-gbs-low-outpatient`, `-unstable-shock`, `ugib-cvd-dual-antiplatelet`, `ugib-on-warfarin-high-inr`, `ugib-elderly-doac-pre-endoscopy-rockall`, `ugib-melaena-only-woman`, `ugib-post-endoscopy-rockall` | 68 pass / 18 fail | Escalation to emergency/same-day; GI-bleed alarm; GBS and Rockall suggested; group & save; OGD within 24 h; restrictive transfusion line (70–90 g/L); resuscitation and "12 h if unstable" in shock; post-endoscopy 72 h high-dose PPI, H. pylori, Forrest; no blanket "stop aspirin" | Tranexamic acid (7/7); LMWH bridging (2); PANE top 3 (3); no outpatient pathway at GBS 0; no CVD threshold 8 g/dL for heart failure; no cardiology route for DAPT; no critical-care line |
| Variceal bleeding (cirrhosis) | `variceal-bleed-known-cirrhosis` (base), `-unrecognised-cirrhosis` | 14 pass / 15 fail | Emergency level; haemodynamic alarm; Child-Pugh/MELD suggested; symptom inference ranks varices #1–2 | No protocol for I85 → no terlipressin, antibiotics, EVL, 12 h endoscopy; wrong dx variant; PANE has no variceal node |
| Mallory-Weiss | `mallory-weiss-young-binge` | 4 / 2 | Bleed recognised (peptic ulcer in PANE top 3); protocol (K22.6) concordant ("most tears resolve spontaneously — supportive management + PPI"; Blatchford for inpatient vs outpatient endoscopy) | Quality only: PANE lacks Mallory-Weiss in the top 3; over-triage to emergency |
| Aorto-enteric fistula (mimic) | `aortoenteric-fistula-herald-bleed` | 3 / 4 | Emergency level (via the bleed) | Not suspected; no CTA; no vascular surgery |
| Dysphagia / NG12 cancer red flags | `dysphagia-progressive-over55` (base), `-under55`, `upper-abdominal-pain-weight-loss-over55`, `iron-deficiency-anaemia-over60` | 20 / 8 | Dysphagia red flag at any age; 2WW triggered; OGD suggested; no age gating of OGD for dysphagia | PANE misses oesophageal/gastric cancer; IDA not recognised; cancer type mislabelled colorectal; triage sometimes *emergency now* for a 2-week-wait red flag (over-55 dysphagia) (quality: CLAUDE.md says red flags ≠ emergencies) |
| Food bolus / EoE | `food-bolus-complete-obstruction` (base), `eoe-young-atopic-recurrent-bolus` | 4 / 9 | OGD suggested; no barium | Complete obstruction under-triaged; no removal protocol; no biopsies; no EoE diagnosis |
| Achalasia / pseudoachalasia | `achalasia-young` (base), `achalasia-pseudoachalasia-elderly` | 11 / 2 | OGD, manometry and barium in the achalasia protocol; red flags | Pseudoachalasia: malignancy not in PANE top 3 (symptom inference #1) |
| Pharyngeal pouch | `pharyngeal-pouch-elderly` | 3 / 3 | Dysphagia red flag; OGD | Quality only: no pouch node, no K22.5 protocol, no contrast swallow |
| Dyspepsia / H. pylori | `dyspepsia-young-no-alarm-test-and-treat` (base), `h-pylori-positive-eradication`, `h-pylori-penicillin-anaphylaxis` | 8 / 6 | No urgent OGD for no-alarm dyspepsia; eradication and test of cure present | Amoxicillin in anaphylaxis; 7-day triple therapy; no bismuth option; over-triage from negation; no K30 protocol |
| NSAID ulcer | `nsaid-associated-gastric-ulcer` | 6 / 2 | NSAID flagged; "stop NSAIDs"; aspirin not stopped by template; H. pylori; repeat OGD for gastric ulcer | Quality: over-triage from "No bleeding"; 8-week full-dose PPI not stated |
| Gastric outlet obstruction | `gastric-outlet-obstruction-elderly` | 6 / 2 | Same-day level; NG decompression, IV saline + KCl, OGD (protocol K31.1) | PANE top 3 misses GOO (no `vomiting_effortless` mapping) |
| GORD | `gord-no-alarm-empirical-ppi` (base), `gord-alarm-weight-loss-over55` | 8 / 3 | Empirical PPI + lifestyle; OGD and 2WW screen with alarm features | Malignancy not in PANE top 3 with alarm features; no-alarm case triaged *emergency now* (negation) |
| Boerhaave | `boerhaave-classic-mackler` (base), `-presenting-as-chest-pain`, `-presenting-as-pancreatitis` | 14 / 5 | Emergency level; alarm; CT with contrast, NBM, antibiotics, surgery from the K22.3 protocol | Never in the PANE differential; no ECG in the chest-pain presentation; no antifungal (quality) |
| Caustic ingestion | `caustic-ingestion-alkali` | 6 / 3 | Emergency; self-harm surfaced; no emesis/neutralisation/blind NG tube (**but only because nothing is output**) | Quality: no protocol (airway, psychiatry, NBM) |
| MI mimic | `mi-presenting-as-epigastric-pain` | 1 / 6 | — | Not escalated; no ECG/troponin; no cardiac alarm or differential |
| Aortic dissection mimic | `aortic-dissection-epigastric-back-pain` | 3 / 4 | Emergency level; no antithrombotic proposed | Not in differential; no CTA |

## Passes to read with care

- `iron-deficiency-anaemia-over60/level-at-least-priority` passes only because "breathless" matches the
  post-operative red flag.
- `variceal-bleed-*/mgmt-no-liberal-transfusion-varices` and the caustic `mustExclude` checks pass
  because no protocol loads (nothing is output).
- `ugib-cvd-dual-antiplatelet/mgmt-transfusion-threshold-8` passes on the generic severe-anaemia
  prompt ("Hb < 8") rather than a cardiovascular-disease rule. The heart-failure case
  (`ugib-elderly-doac-*`, Hb 10.4) shows that the rule is missing.
- `ugib-nonvariceal-gbs-low-outpatient/dx-ugib-top3` passes on "Peptic Ulcer Disease" at #2. PANE
  never sees the bleed.

## Guideline points that need the surgeon's decision

- **Pre-endoscopy PPI:** ESGE 2021 suggests considering high-dose IV PPI before endoscopy. NICE CG141
  advises against PPI before endoscopy for suspected non-variceal bleeding. The vignettes keep PPI as
  `quality`.
- **Transfusion thresholds:** the vignettes use ESGE/BSG (Hb 7 g/dL, 8 g/dL with cardiovascular
  disease) and Baveno VII (7–8 g/dL in varices). ACG 2021 also recommends a restrictive strategy; its
  exact number was not used.
- **Outpatient management:** the vignettes use GBS ≤1 (ESGE); ACG and BSG phrase it as 0–1.
- **Pouch work-up:** contrast swallow before endoscopy is kept `quality` (no strong guideline number).
- **Gastric outlet obstruction resuscitation** is rated critical from the stated metabolic state, not
  from a GOO-specific guideline (see the vignette rationale).

## Content observations (not asserted by a vignette)

- The `peptic_ulcer` key point reads "Rockford-score ≥6 (Blatchford for bleeding)". This looks like a
  typo for Rockall/Blatchford and the threshold is unclear.
- The GORD protocol step-down names ranitidine, which was withdrawn in 2020.
- The triage `gi_bleed` pathway checklist (IV PPI, terlipressin for varices, Blatchford) only shows
  when SBP <100, and it is not part of any plan output.

## iOS next steps

After the next `ios-build-check.yml` run, download `clinval-ios` and run `clinval:report`. Then
triage the 285 `unverified: ["ios"]` flags in these files. Expected hot spots from the engine map:
`ClinicalPathwayEngine` acuity is keyword-only (MI mimic, food bolus); the `DiagnosisRadiationEngine`
templates are not severity- or allergy-aware; and the fallback Bayesian pools may be empty for
dysphagia/haematemesis routes.

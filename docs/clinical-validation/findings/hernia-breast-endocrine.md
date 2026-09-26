# Clinical validation findings — hernia / abdominal wall, breast and endocrine surgery

Cluster: 45 vignettes in `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/` (ids starting `hernia-`,
`groin-mimic-`, `breast-`, `thyroid-`, `parathyroid-`, `adrenal-`). Web harness run locally on
`clinval-hbe` (2026-09-25, `clinval-web/1`, triage rules as shipped). iOS was not run: every
iOS-applicable expectation carries `unverified: ["ios"]` until the next CI run of
`ClinicalValidationTests`.

Measurement only. No engine, threshold or clinical data was changed. Every citation is
`verified: false`, and a surgeon needs to sign off the expectations (`reviewedBy`).

## What was written

| Group | Vignettes | Presentations |
|---|---|---|
| Groin / abdominal wall | 14 | elective inguinal (man, minimal symptoms), groin hernia in a woman, incarcerated and strangulated groin hernia, femoral hernia (elective, then as Richter SBO), umbilical (elective, incarcerated in obesity, cirrhosis with tense ascites), midline incisional, parastomal, obturator hernia SBO, infant inguinal hernia (reducible, then incarcerated) |
| Groin mimics | 3 | inguinal lymphadenopathy (lymphoma), common femoral artery aneurysm, testicular torsion |
| Breast | 12 | lump <30 / 30–35 / >35 with suspicious features / in pregnancy, bloody single-duct discharge, inflammatory breast cancer, lactational and non-lactational abscess, gynaecomastia, male breast cancer, family history (BRCA), cyclical pain alone |
| Thyroid | 12 | TR4 nodule (euthyroid), toxic adenoma, Bethesda I–VI (VI with cN1b nodes), rapidly enlarging mass with stridor, retrosternal goitre with tracheal compression, post-thyroidectomy neck haematoma, post-thyroidectomy hypocalcaemia |
| Parathyroid | 2 | primary hyperparathyroidism meeting the 2022 surgical criteria (on a thiazide), hypercalcaemic crisis |
| Adrenal | 2 | indeterminate incidentaloma, suspected phaeochromocytoma referred for adrenalectomy (on a beta-blocker) |

Permutations cover age (infant, adolescent, <30 / 30–35 / >35, elderly), sex (female groin hernia,
male breast), pregnancy (22 weeks) and lactation, family history, comorbidity (cirrhosis, AF on a
DOAC, obesity, penicillin allergy) and the dangerous presentations named in the brief.

Sources: WSES 2017 (complicated abdominal wall hernias), HerniaSurge 2018, EHS/AHS 2020 (umbilical),
EHS 2023 (midline incisional), EHS 2018 (parastomal), Bologna ASBO 2017, EUPSA 2022 (paediatric
hernia), EAU/ESPU 2024 (acute scrotum), ESVS 2024, EASL 2018, NICE NG12 / CG164 / NG145, ABS/RCR
best-practice diagnostic guidelines 2010, NCCN (breast screening and diagnosis; breast cancer),
RCOG GTG 12, BTA 2014, ACR TI-RADS 2017, ATA 2015 / 2016 / 2021 (anaplastic), Bethesda 2023,
DAS/BAETS 2022 (neck haematoma), Society for Endocrinology emergency guidance 2016 (hypo- and
hypercalcaemia), Fifth International Workshop on PHPT 2022, ESE/ENSAT 2023, Endocrine Society 2014
(phaeochromocytoma). Numeric thresholds appear only where the guideline states them (TI-RADS FNA
sizes, the PHPT surgical criteria); everything else is textual.

## Web results

285 expectations (138 critical, 147 quality). Critical: 81 pass, 56 fail. Quality: 83 pass, 63 fail.
2 n/a (iOS-only qSOFA calculator). Every failure is flagged `knownGap: ["web"]` with a note saying what
the engine does instead; there are no blocking failures, so `clinval:web` and the vitest suite pass.

| Group | Critical pass | Quality pass |
|---|---|---|
| Groin / abdominal wall | 32 / 46 | 31 / 52 |
| Groin mimics | 4 / 14 | 1 / 3 |
| Breast | 20 / 35 | 26 / 41 |
| Thyroid | 13 / 26 | 15 / 39 |
| Parathyroid | 5 / 8 | 6 / 7 |
| Adrenal | 7 / 8 | 4 / 4 |

What works: escalation of the obviously sick (strangulated hernia, Richter/obturator SBO, crisis,
stridor, neck haematoma all reach `emergency_now`, mostly from vital signs); the protocols that are
reached by ICD code are largely sound (femoral hernia, parastomal, incisional, breast abscess
aspiration, torsion exploration without imaging delay, bedside opening of a neck haematoma,
metanephrines and alpha-blockade before adrenalectomy, avoid thiazides in PHPT, IV saline first in
hypercalcaemia).

## Proposed fixes, ranked by patient safety

Each item names the vignette / expectation ids that show it, the code, and a proposed fix. Items
1–10 are the top safety gaps.

### 1. Hernia severity variant is chosen by substring, so incarcerated and strangulated hernias get the wrong plan

- Evidence: `hernia-groin-incarcerated/variant-incarcerated` — "Irreducible inguinal hernia" contains
  the `hernia_reducible` keyword "reducible inguinal", so the documented plan gets the **elective**
  prefix ("Day-case laparoscopic repair preferred") and loses the immediate phase.
  `hernia-groin-strangulated/variant-strangulated` — an assessment containing both "strangulated"
  and "irreducible" matches `hernia_incarcerated` first, whose urgency note says "Attempt gentle
  manual reduction", which WSES 2017 advises against when strangulation is suspected.
- Code: `artifacts/dashboard/src/lib/dx-variants.ts` `detectDxVariants` (plain `includes`, first
  variant with any keyword wins; the Hernia group lists reducible → incarcerated → strangulated).
- Fix: word-boundary matching, most-severe-first ordering (strangulated → incarcerated → reducible),
  and exclusion of "ir-"/"non-" prefixes. The same fix resolves items 2 and part of 4. Update the
  `lint:dx-phases` reference table in the same PR.

### 2. The same substring matching writes the wrong operation into thyroid and parathyroid plans

- Parathyroid → thyroidectomy: `parathyroid-primary-hpt-surgical-indications/mgmt-no-thyroidectomy-template`
  and `parathyroid-hypercalcaemic-crisis/…`. With no Parathyroid group, detection falls back to
  `lower.includes('thyroid')` ("hyperparathyroidism" contains "thyroid") and "parathyroidectomy"
  contains the `thyroid_total` keyword "thyroidectomy". The documented plan opens with "Total
  Thyroidectomy … levothyroxine replacement (lifelong)" for a patient who needs a parathyroidectomy.
- Bethesda VI read as V: `thyroid-bethesda-6-papillary-cn1b/variant-thyroid-total` — "bethesda vi"
  contains the hemithyroidectomy keyword "bethesda v", so papillary carcinoma with biopsy-proven
  lateral nodes (ATA 2015: total thyroidectomy + neck dissection) gets a hemithyroidectomy prefix.
- Post-operative haematoma: `thyroid-post-op-neck-haematoma/mgmt-no-thyroidectomy-prefix` — the
  airway-emergency plan opens with the elective total-thyroidectomy template.
- Also observed: the Thyroid group's ICD prefix `D44` captures adrenal masses (D44.1); both adrenal
  vignettes land in the Thyroid group (no keyword hit, so no plan text changes today).
- Fix: add a Parathyroid group ahead of Thyroid (E21, `primary_hyperparathyroidism`,
  `parathyroid_adenoma`), narrow `D44` to `D44.0`, word-boundary matching (item 1).

### 3. Groin mimics are anchored to "hernia": aneurysm, lymphoma node and torsion get hernia-repair plans

- Evidence: `groin-mimic-femoral-artery-aneurysm` (aneurysm not in the differential, no
  pulsatile-mass flag, no duplex/CTA, hernia repair shown), `groin-mimic-lymphadenopathy` (lymphoma
  not in the PANE list, no groin ultrasound/biopsy, hernia repair shown),
  `groin-mimic-testicular-torsion` (torsion below epididymo-orchitis in PANE; "EMERGENCY LAPAROSCOPIC
  INGUINAL HERNIA REPAIR (TAPP)" template alongside the correct exploration plan).
- Causes: the only groin CC template is "Inguinal / groin hernia"; the Assessment ManagementPanel
  follows the PANE top disease (inguinal hernia ≥0.20) instead of the surgeon's confirmed diagnosis;
  `computeClinicalPrompts` fires the hernia pathway on any CC containing "hernia"/"inguinal" and
  always attaches the adult TAPP operative plan; PANE has no femoral-aneurysm disease and no
  pulsatile feature.
- Fix: let the confirmed working diagnosis override the PANE top for the ManagementPanel; add a
  neutral "Groin lump" CC template; gate the TAPP prompt on a confirmed hernia; add a triage/prompt
  rule "pulsatile or expansile groin mass → do not needle or explore, duplex/CTA, vascular".

### 4. Airway emergencies are escalated but not recognised as airway problems

- `thyroid-rapid-enlargement-stridor`: no airway step in any output (`mgmt-airway`), anaplastic
  carcinoma and thyroid lymphoma are not PANE diseases (`mnm-anaplastic-or-lymphoma`), only FNAC is
  proposed where ATA 2021 asks for core/open biopsy (`inv-core-biopsy`). Escalation comes from RR and
  SpO₂ only; triage has no stridor rule.
- `thyroid-post-op-neck-haematoma`: the T81.0 protocol does say "immediate wound opening at bedside",
  but PANE ranks cholecystitis and wound infection (the "Post-op wound concern" template hints
  infection features), no alarm names the haematoma or airway, and the generic haematoma
  investigations suggest "USS wound".
- `thyroid-retrosternal-goitre-compression`: no red flag names tracheal compression; E04.2 has no
  protocol (escalation only because "breathless" matches the post-operative-concern regex).
- Fix: a stridor/airway rule in triage and prompts (senior anaesthetic/ENT review, oxygen, no
  elective pathway); a neck-haematoma-after-neck-surgery rule that leads with SCOOP; anaplastic
  carcinoma and lymphoma in PANE and an ATC/lymphoma branch in the thyroid carcinoma protocol.

### 5. Post-thyroidectomy hypocalcaemia is not recognised anywhere on web

- `thyroid-post-op-hypocalcaemia`: adjusted calcium 1.78 mmol/L, tetany, QTc 490 ms → triage
  `priority_24_48h` (post-op only), no red flag, no IV calcium gluconate, no ECG, no magnesium. No
  engine reads the calcium value; E89.2 has no protocol.
- Fix: a hypocalcaemia rule (perioral tingling / carpopedal spasm / low adjusted calcium after neck
  surgery → urgent; IV calcium gluconate with cardiac monitoring, magnesium, oral calcium +
  alfacalcidol) per the Society for Endocrinology guidance, and an E89.2 protocol.

### 6. Any Bethesda result triggers a total-thyroidectomy operative plan, including benign cytology

- `thyroid-bethesda-1-nondiagnostic`, `thyroid-bethesda-2-benign` (critical), `-3-aus`,
  `-4-follicular-neoplasm` (quality): `computeClinicalPrompts` "thyroidectomy_pathway" fires on any
  radiology result containing "bethesda" and attaches "TOTAL THYROIDECTOMY — OPERATIVE PLAN"
  (rationale text says III–VI). No output proposes repeat FNA (I) or surveillance (II).
- Fix: parse the category and branch per Bethesda 2023 (I repeat FNA; II surveillance; III–IV repeat
  FNA / molecular / diagnostic lobectomy; V–VI surgery by risk, total thyroidectomy for cN1, >4 cm,
  extrathyroidal extension).

### 7. Inflammatory breast cancer gets breast-conserving surgery and sentinel node biopsy

- `breast-inflammatory-cancer/mgmt-no-bcs-or-slnb`: the C50 plan is the generic
  `invasive_ductal_carcinoma` protocol, whose first surgical step is "Wide local excision
  (breast-conserving) + SLNB". NCCN: inflammatory breast cancer → neoadjuvant systemic therapy, then
  modified radical mastectomy; BCS and SLNB are not recommended. The protocol lists IBC only as a red
  flag.
- Fix: an IBC variant (C50 + "inflammatory"/"peau d'orange") that excludes BCS/SLNB and leads with
  core biopsy of breast and skin, staging and neoadjuvant therapy.

### 8. PANE ranks abdominal diseases first for breast, neck, groin and metabolic presentations

- Evidence (PANE top 3, `web.pane`): thyroid nodule, Bethesda series, toxic adenoma, PHPT, crisis,
  phaeochromocytoma, nipple discharge, breast pain → cholecystitis, GORD, PUD. Female groin hernia and
  femoral hernia → cholecystitis first. Male breast cancer and gynaecomastia → **inguinal hernia**
  first. Femoral, obturator, torsion, phaeochromocytoma, male breast cancer and anaplastic carcinoma
  never reach the list.
- Cause: `lib/pane-engine/src/engine/bayes.ts` uses only sensitivity, and every unlisted feature
  counts at `DEFAULT_SENSITIVITY = 0.30`. One organ-specific feature therefore cannot overcome the
  high abdominal priors (cholecystitis 0.15 ×2 in women, GORD 0.12, PUD 0.10; inguinal hernia ×5 in
  men); breast diseases are ×0.05 in men (male breast cancer cannot rank).
- Consequence beyond the list: `HpiTab.seedInvestigationsFromPane` seeds the wrong diseases'
  stat/urgent tests into the orders — blood cultures, MRCP, erect CXR, OGD, group & save for a thyroid
  nodule or a groin lump (`inv-no-unrelated-seeded-orders`).
- Fix: model P(feature | not disease) or use a low default (≤0.05) for features outside a disease's
  system; restrict candidates by presenting system; add missing diseases (femoral aneurysm,
  anaplastic carcinoma, thyroid lymphoma, phaeochromocytoma, inguinal lymphadenopathy) and features
  (pulsatile mass, Howship-Romberg, nipple discharge extraction, no previous surgery); keep a
  realistic prior for male breast cancer. This needs the full vignette suite and surgeon sign-off,
  since it changes every differential.

### 9. Suspected-cancer screening mislabels breast referrals as colorectal and misses NG12 nipple discharge

- Every triggered screen is labelled "Cancer screening triggered (colorectal)" (breast lump 30–35,
  >35, pregnant, male: `flag-2ww`). In `lib/triage-engine/src/cancer-screening.ts` the colorectal
  block tests `c.met && c.rule.includes('colorectal') || c.rule.includes('bowel') || …` — operator
  precedence makes it true whenever the colorectal rules exist, so `cancerType` becomes colorectal
  (and colonoscopy/CEA are added to the screen's investigations); the breast block keeps the first
  label.
- `breast-nipple-discharge-bloody-single-duct`: NG12's "≥50 with nipple discharge in one breast" is
  not implemented (discharge counts only with a lump): triage score 0, routine, no imaging (N64.52 has
  no protocol; PANE extracts no nipple-discharge feature).
- Fix: parenthesise the colorectal condition and set `cancerType` per met rule (add a vitest
  vector); add the NG12 nipple-discharge criterion; map N64.5x to the nipple-discharge protocol.

### 10. Infants get adult hernia care and adult vital-sign thresholds

- `hernia-paediatric-inguinal-infant`: plan offers "Lichtenstein mesh herniorrhaphy … TEP/TAPP",
  "Truss may be offered", the adult TAPP template and adult pre-op items (ECG ≥40, PSA if male ≥50).
  EUPSA: herniotomy, no mesh, prompt repair. HR 140 / RR 36 (normal at 4 months) are flagged
  Tachycardia/Tachypnoea → `emergency_now`.
- `hernia-paediatric-incarcerated-infant`: PANE top 3 = cholecystitis, appendicitis, PUD for a
  7-month-old (no infant priors).
- Fix: a paediatric inguinal-hernia protocol selected by age; age-banded vital-sign ranges in
  `computeVitalRedFlags`; age modifiers in PANE.

### 11. Cirrhosis with tense ascites: no rupture flag, no ascites control

- `hernia-umbilical-cirrhosis-ascites`: no output mentions rupture, skin ulceration or leak, or
  ascites control / hepatology; the TAPP prompt adds day-case discharge. Child-Pugh and MELD are
  suggested (pass).
- Fix: a cirrhosis/ascites branch in `umbilical_hernia` (red flags, hepatology co-management, ascites
  control before repair, urgent repair if leak/ulceration).

### 12. Breast lump work-up depends on fields the harness cannot fill, and on N63 having no protocol

- `breast-lump-under-30`, `-age-30-35`, `-pregnant`: no breast ultrasound or core biopsy in any
  output. Two causes: N63.0 (the usual pre-histology code) maps to no protocol, and the dashboard's
  "Breast Mass → Triple Assessment" prompt reads `examBreast`, which `web-runner.ts` always passes as
  "" (the vignette schema has no breast exam field). The engine gap (N63) is real; the prompt path is
  a harness gap.
- Fix: map N63 to a "breast lump — triple assessment" protocol with age-banded imaging; add
  `exam.breast` (and `familyHistory`, see 16) to the schema and the web runner.

### 13. Negation: normal findings raise emergencies

- "Soft, non-tender" matches "tender" in the hernia prompt, so reducible hernias get "Strangulated
  Hernia → Emergency Repair" (`hernia-inguinal-elective-minimal-symptoms/no-strangulation-prompt`,
  `hernia-umbilical-adult-elective/mgmt-no-inguinal-template`).
- Triage: "no episodes of severe pain", "No vomiting", "No weight loss", "No family history of
  thyroid cancer" score as positives → elective hernias `emergency_now`, every thyroid nodule
  `same_day_call` (`level-*` quality failures across the cluster).
- Fix: a negation window in `adaptiveTriage` RED_FLAGS and the prompt `exam()` matcher.

### 14. Obturator / femoral hernia as the cause of SBO is never named

- `hernia-obturator-sbo-elderly-woman/mnm-obturator-hernia` and
  `hernia-femoral-richter-obstruction/mnm-hernia-cause`: PANE shows bowel obstruction but no hernia.
  The obturator CT expectation passes only because the appendicitis protocol's seeded "CT abdomen/
  pelvis" appears (coincidence, not reasoning).
- Fix: Howship-Romberg / medial-thigh-pain and "no previous abdominal surgery" features; list
  external hernias as must-not-miss in SBO without previous surgery (Bologna 2017).

### 15. Allergy is not cross-checked (again)

- `hernia-paraumbilical-incarcerated-obese/mgmt-no-penicillin`: penicillin allergy recorded;
  prompts propose piperacillin-tazobactam and co-amoxiclav. Same finding as the seed vignettes.

### 16. Lower-priority guideline-concordance gaps (quality)

- Watchful waiting for minimally symptomatic men is absent from the inguinal protocol (HerniaSurge).
- No lactate/CPK in the hernia protocols (WSES strangulation markers).
- Non-lactational abscess: no smoking cessation, no periductal-mastitis branch.
- Family history: the genetics prompt exists but reads `familyHistory`, which the harness passes as
  `[]`; Z80.3 has no protocol. Breast pain alone and gynaecomastia are over-triaged by the word
  "cancer" and by the age-≥30 breast-lump screen (applied to men).
- TI-RADS thresholds (static reading, not asserted): the benign-nodule protocol and the thyroid prompt
  say "FNAC if TIRADS ≥3 or nodule ≥1 cm"; ACR TI-RADS 2017 sets FNA at TR3 ≥2.5 cm, TR4 ≥1.5 cm,
  TR5 ≥1.0 cm, so TR3 nodules of 1–2.4 cm would be over-biopsied.
- E04.1 / E04.2 (the usual codes for a single non-toxic nodule / multinodular goitre) map to no
  protocol; the benign-nodule protocol is keyed on D34.

## Harness notes

- `web-runner.ts` passes `examBreast: ''` and `familyHistory: []` to `computeClinicalPrompts`; the
  vignette schema has neither field. Breast exam findings are recorded in `exam.other` so they reach
  the passive ranking only. Adding both fields would let the breast and family-history prompts be
  measured.
- `cc-matrices.ts` templates are still not run (see `ENGINE-MAP.md`).
- Where only a generic alarm exists, the vignettes split "any emergency alarm" (critical, passes on
  the triage "Emergency now") from "alarm that names the airway" (quality, fails), so the report
  shows both.
- iOS: all expectations unverified. After the next CI run, triage each `unverified: ["ios"]` flag as
  the README describes (remove on pass; `knownGap` with a note on fail). `pathway` expectations were
  not written for this cluster.

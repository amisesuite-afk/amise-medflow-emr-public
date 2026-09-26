# Change log — `vademecum-phase1` (disease-centred vademecum and hypothetico-deductive loop, SHADOW)

2026-09-26. Branch `vademecum-phase1` (from `claude/pr-37-gbg22z`). New rule sets `vademecum-findings`,
`vademecum-abdominal-pain` and `vademecum-cough-breathlessness`, all 0.1.0 (`clinical-content/registry.json`).
Status **shadow — needs sign-off**. Nothing in production reads the vademecum: no panel, no engine, no
iOS screen other than the decode status under Settings → Diagnostics.

Owner-approved direction: one disease-centred vademecum read by both platforms and a hypothetico-deductive
loop (complaint or any first result → candidates incl. can't-miss → recall the whole profile → ask the most
discriminating item → recompute level by level → stop at the decision layer's thresholds), with formal
criteria, pathognomonic findings, exclusions and incidental-finding work-ups beside the Bayesian layer.
Phase 1 covers two areas in shadow. Plan and later phases: `docs/VADEMECUM-PLAN.md`. Shadow results:
`docs/clinical-validation/VADEMECUM-PHASE1.md`.

**Every value is unreviewed.** PANE-seeded and iOS-seeded ratios are conversions of values that were
themselves written from memory; new ratios, criteria logic, floors, pathognomonic ratios, exclusions and
work-ups were written from memory with the source named (`fromMemory: true` everywhere). No `lastReviewed`
date is set and every disease is `signOff: "pending"` (`lint:vademecum` fails otherwise).

## What it is

### Format (`clinical-content/vademecum/`, schemas in `clinical-content/schemas/`)

- `findings.json` — the one finding dictionary (525 findings): id (the PANE feature id where one exists,
  `sign.<id>` for an exam sign, `rule.<rule>.<band>` for a decision-rule band, new ids otherwise), label,
  chip, synonyms, level (history / exam / score / investigation), dimension (site, onset, character …,
  imaging, pathology), base rate, correlation group, `pane` id, `examSign` / `decisionRule` reference,
  `lab` spec (catalogue analyte, direction, × ULN or absolute cut-off), demographic spec, and `entryPoint`
  (symptom / sign / lab / imaging / pathology / score, or null). Plus the loop `policy` (listed under
  Needs sign-off, table A).
- `abdominal-pain.json` (100 diseases), `cough-breathlessness.json` (30) — per disease: PANE id, iOS
  candidate name, ICD-10, prevalence tier (the PANE scheme), can't-miss, urgency, course, applicability,
  optional `decision` (treatment-decisions.json), findings by level with LR+ / LR− (point and range), seed
  and seed detail, source, `fromMemory`, `negativeMeaningful`; `criteria`, `pathognomonic`, `exclusions`,
  `workupWhenIncidental`.
- Exam findings and decision rules are **references**: their ratios stay in `exam-signs.json` /
  `decision-rules.json` and are resolved for the disease through the sign's / rule's target group.

### The loop (`lib/pane-engine/src/vademecum-loop/`)

- **Candidates**: the complaint's areas (keywords at word starts, or the history frame from
  `classifyComplaint`) and their related mimics, plus every disease whose profile names a recorded
  entry-point finding as evidence for it (reverse index: finding → diseases). No complaint and no entry
  point: every area.
- **Posterior**: tier prior × likelihood ratios. A recorded decision-rule band supersedes its component
  findings (max(components, band) when positive); decision-rules policy between rules is kept (AIR
  supersedes Alvarado; PERC only with Wells PE ≤ 4). Findings of one correlation group count once each
  way (strongest positive × strongest negative). Unlisted findings are neutral; ratios are clamped
  (policy `minLr`–`maxLr`).
- **Hybrid layer** (off with `hybrid: false`, the "Bayesian only" comparison):
  - met *definite / suspected* criteria set a posterior floor (0.9 / 0.5) **only when the Bayesian
    posterior is at least `criteriaMinPosterior` (0.01)**; below it, the met criteria are a
    conflict record ("floor not applied") for the existing "doesn't fit" path;
  - met *referral* criteria (NG12) put the diagnosis at least in its test band (3 %, the NG12 PPV
    threshold) **without moving its rank**; *classification / severity* criteria (Bosniak, BSG 2020,
    TIRADS, Sepsis-3 qSOFA) are shown, with no floor;
  - labels "Meets TG18 acute cholecystitis diagnostic criteria: Definite (A + B + C imaging) (source)";
  - a pathognomonic finding is a very strong ratio (definitive: policy `definitiveLR` 200) shown as
    "Confirmatory finding: …", never an automatic diagnosis; if it is also a profile link it counts
    once, at the larger ratio;
  - a hard exclusion drops the diagnosis with its reason ("Previous appendicectomy"), overridable by id;
  - a definitive **pathology** finding produces a final-diagnosis prompt for the outcomes loop
    (`sourceType: 'histology'`, the FinalDiagnosisPanel pattern: a prompt, never written);
  - an incidental finding with a work-up (adrenal incidentaloma, thyroid nodule / TIRADS, pulmonary
    nodule, Bosniak cyst, asymptomatic gallstones, colorectal adenoma) lists its work-up steps.
- **External criteria evaluators**: TG18 cholecystitis / cholangitis (the dashboard's
  `tokyo*AutoFill` + `scoreTokyo*`) and NG12 (`screenForCancer`) are passed in by id; when an
  evaluator is absent the vademecum's own fallback logic over its findings applies.
- **Next question**: expected information gain (nats) over the candidates' posterior at the current
  level (history → exam → score → investigation), plus a criteria bonus when the answer would complete
  or refute a leading candidate's criteria ("1 more Revised Atlanta item …: lipase ≥ 3 × ULN"); a
  question that can move the leader or a can't-miss diagnosis across a threshold always wins. Free-text
  twins of exam signs are read, not asked.
- **Stop**: the leader reaches its treat threshold while no other can't-miss candidate is still at or
  above its test threshold (added after the first full shadow run: a thick-walled gallbladder stopped at
  "cholecystitis" after one question with gallbladder carcinoma still open); or no question at any remaining level can move the
  leader or a can't-miss diagnosis across a test or treat threshold; or `maxQuestions` (15).
  Thresholds: the decision layer (`thresholds()` of the disease's `decision`) where named, else the
  policy defaults (test 0.10 / treat 0.85; can't-miss test 0.02).
- **Display**: five places, the last two held for the likeliest can't-miss diagnoses not already shown
  (as iOS).
- **Generators** (`generators.ts`): history questions with chips grouped by dimension (SOCRATES order),
  exam signs, investigations (confirmatory ones flagged) — every chip is a vademecum finding, so it maps
  to the engine by construction.
- **Entry-point readers** (`evidence.ts`): structured labs through the reference-range classifier
  (`@workspace/triage-engine/reference-ranges`; × ULN from the practice / default range; a measured value
  below the cut-off is recorded absent), report text by kind (imaging / endoscopy / pathology) through a
  negation-aware matcher (`lib/triage-engine/src/negation.ts`), PANE features, exam-sign chips, recorded
  scores. No AI, no OCR.

### Seeding (how the numbers were made)

- PANE: LR+ = P(f | D) / PANE base rate of the feature, LR− = (1 − P) / (1 − base); absence meaningful
  when LR− ≤ 0.9; range = the ratio recomputed with P ± 0.10 (a conversion sensitivity band, not a
  published interval). PANE age / sex prior modifiers became demographic findings.
- iOS curated features: LR = exp(logLR / 5) (or the curated `likelihoodRatio`); where PANE also has
  the finding, the PANE value is the point and the iOS ratio is kept in `seedDetail` (the two
  databases are on different scales; see "Calibration fixes").
- New content: written from memory, source named per value.

### Calibration fixes made during the shadow runs (all in 0.1.0)

1. The first conversion divided by a background computed over each area's own candidates, so ratios
   of diseases from different areas were not comparable (sepsis outranked pneumonia on cough and
   crackles). Now PANE's own base rate: the ratio between any two candidates equals PANE's.
2. Mixing iOS log-LRs with PANE-scale ratios let diseases with PANE ratios outrank those with iOS ratios
   (pyonephrosis over pyelonephritis on renal-angle tenderness). PANE is now the point where both exist.
3. Previous operations were read from the whole history, so "for elective laparoscopic
   cholecystectomy" excluded biliary colic in every pre-operative vignette. The shadow now reads the
   surgical-history dimension from the surgical history only.
4. TG18 "suspected" and a qSOFA floor promoted non-specific criteria over the evidence (liver abscess →
   cholecystitis; perforation → sepsis). Added the plausibility gate; Sepsis-3 qSOFA is a severity
   screen; NG12 referral no longer moves the rank.
5. Added diseases PANE reached for these complaints: hyponatraemia (post-operative vomiting and
   seizure), cirrhosis, anal fissure, haemorrhoids, perianal abscess; PE as an abdominal mimic
   (pleuritic upper-abdominal pain after surgery); D-dimer for mesenteric ischaemia and mesenteric
   venous thrombosis synonyms; a gallbladder mural-mass finding; NG12 lung split into the
   suspected-cancer level and the urgent-chest-X-ray level (the second is honest about "unexplained").

## Findings about current production code (not changed here)

- **TG18 cholecystitis auto-fill reads "wall thickening" anywhere in an imaging report as gallbladder
  wall thickening** (criterion C): an MRI "appendix … with wall thickening" (obs-appendicitis-pregnancy-t3)
  and a liver-abscess ultrasound both returned "definite" TG18 cholecystitis from
  `tokyoCholecystitisAutoFill` + `scoreTokyoCholecystitis`. The vademecum's plausibility gate turns these
  into conflicts; the dashboard calculator pre-fill still shows them. Proposed fix: require the
  gallbladder as the subject of the thickening / fluid phrase (as the iOS reader does for the duct).
- The PANE feature mapper sets some findings the record negates or does not support (e.g.
  `wound_discharge` in acutemed-pe-post-lap-chole-pleuritic, whose negatives include wound discharge;
  `skin_necrosis` from "necrotising pancreatitis"). To investigate in `socrates-to-features.ts`.

## Files

| File | Change |
|---|---|
| `clinical-content/vademecum/*.json`, `clinical-content/schemas/vademecum-*.schema.json` | new content and schemas |
| `clinical-content/registry.json` | three entries (json-key version stamps) |
| `lib/pane-engine/src/vademecum-loop/*` | new (types, content, model, loop, generators, evidence, index); `package.json` export `./vademecum-loop`; `tsconfig.json` includes the JSON |
| `ios/AmiseMedFlow/Services/VademecumContent.swift` | new Codable structs (decode only) |
| `ios/AmiseMedFlow/Services/SharedClinicalContent.swift` | `vademecum*` File cases, per-file folder |
| `ios/project.yml` | `vademecum` folder reference |
| `ios/AmiseMedFlowTests/VademecumContentTests.swift`, `SharedClinicalContentTests.swift` | decode test; folder check |
| `scripts/src/shared-content.ts`, `lint-shared-content.ts` | two content folders, per-file schema, recursive / single-literal TS types |
| `scripts/src/vademecum.ts`, `lint-vademecum.ts` | new reference lint (`lint:vademecum`, CI step) |
| `scripts/src/clinval/vademecum-shadow.ts`, `run-web.ts`, `web-runner.ts` | shadow mode `--engine vademecum`; helpers exported (no behaviour change) |
| `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/entry-*.json` (5), `biliary-colic-asymptomatic-incidental-gallstones.json` (tag) | entry-point pilot vignettes |
| `lib/pane-engine/src/__tests__/vademecum-loop.test.ts`, `scripts/src/vademecum-content.test.ts`, `scripts/src/shared-content.test.ts` | tests |
| `.github/workflows/ci.yml`, `ios*.yml` | `lint:vademecum` step; iOS workflows trigger on `clinical-content/vademecum/**` |
| `docs/VADEMECUM-PLAN.md`, `docs/clinical-validation/VADEMECUM-PHASE1.md`, this file, `CLINICAL-CONTENT-INVENTORY.md`, `SHARED-CONTENT-PLAN.md`, `CLAUDE.md` | docs |

## Checks

`pnpm run typecheck`; `pnpm -r run test`; every scripts lint (`lint:grants`, `lint:rls-policies`,
`check:migrations-fresh`, `lint:dx-phases`, `lint:patient-instructions`, `lint:no-external-qr`,
`lint:interaction-parity`, `lint:report-import-parity`, `lint:reference-range-parity`,
`lint:guideline-registry`, `lint:history-frames`, `lint:signoff-catalogue`, `lint:shared-content`,
`lint:vademecum`); dashboard build; `clinval:web` in normal mode: 0 blocking (the five new vignettes'
web PANE gaps are flagged `knownGap: ["web"]` with notes; iOS `unverified`). Swift was not compiled here:
the new structs use plain `let` properties of existing Codable types only, and every call was
symbol-checked.

## Needs sign-off

Everything is a proposal; the JSON files are the reference and the detail tables below are generated
from them. Correct a value in `clinical-content/vademecum/*.json`, bump the file's `version` with its
registry entry, and re-run `clinval:web -- --engine vademecum`. Nothing here is live.

- V1. **Loop policy** (detail table A): the PANE prior tiers, test / treat thresholds (0.10 / 0.85; can't-miss test 0.02; the decision layer's thresholds for appendicitis, cholecystitis, PE and sepsis), criteria floors (definite 0.9, suspected 0.5), the plausibility gate (a floor applies only at a Bayesian posterior ≥ 0.01, else a conflict), the NG12 referral floor (3 %, test band only), the definitive-finding ratio (200), the ratio clamp (0.02–100), the conflict thresholds (0.2 / 0.8), the criteria bonus, the minimum information gain, 15 questions at most, five display places with two held for can't-miss diagnoses.
- V2. **Conversion of the PANE model into likelihood ratios** (table H): LR+ = P(f | D) / PANE base rate, LR− = (1 − P) / (1 − base), absence counted when LR− ≤ 0.9, range P ± 0.10. 1,430 links depend on this rule, and on PANE's own sensitivities, which are themselves unreviewed.
- V3. **Where PANE and iOS disagree, the PANE value is the point** (201 links; the iOS ratio is kept in each link's `seedDetail`). Please choose per disease which source to trust where they differ materially.
- V4. **New diseases** (table B): not in PANE, or added to cover what PANE reached for these complaints (irritable bowel syndrome, functional dyspepsia, mesenteric lymphadenitis, Meckel's diverticulitis, psoas abscess, colorectal adenoma, asymptomatic gallstones, Bosniak cyst, the cough-area diseases, hyponatraemia, cirrhosis, anorectal conditions): label, ICD-10, prevalence tier, can't-miss flag, urgency.
- V5. **Criteria logic** (table C): each of the 25 criteria sets (TG18 cholecystitis and cholangitis, Revised Atlanta, JBDS DKA, ASGE 2019, NG12 colorectal / oesophago-gastric / pancreatic / lung, Rome IV IBS and functional dyspepsia, AIR and Alvarado bands, BTS CAP, GINA, GOLD, Framingham, UDAMI-4, WAO, BSG 2020, Bosniak 2019, TIRADS, ESE 2023 adrenal, Sepsis-3 qSOFA …) as written, and the grade given to each level (definite / suspected / referral / classification).
- V6. **Grades that change the ranking**: TG18 "suspected" (A + B) gets the 0.5 floor although A + B is non-specific; Sepsis-3 qSOFA is a severity screen with no floor; NG12 "urgent chest X-ray" (≥ 40 with unexplained symptoms) is a referral-grade level.
- V7. **Pathognomonic / confirmatory findings and their ratios** (table D), including which are definitive (histology) and the requirement that a Grey Turner / Cullen sign counts for pancreatitis only with a raised lipase.
- V8. **Hard exclusions** (table E): previous appendicectomy, cholecystectomy (with the cystic-duct stump / retained-stone caveat), hysterectomy, bilateral oophorectomy, male sex, ACE-inhibitor / ARB use absent for ACE-inhibitor cough. The clinician can override each.
- V9. **Incidental-finding work-ups** (table F): adrenal incidentaloma (ESE 2023 hormone work-up), thyroid nodule (TIRADS), pulmonary nodule, Bosniak cyst, asymptomatic gallstones (NICE CG188), colorectal adenoma (BSG 2020).
- V10. **Ratios written as new content** (table G), each with its named source, all from memory.
- V11. **iOS curated features not carried over** (list I): map each to a new finding or drop it.
- V12. **Complaint routing** (per area `complaints`): the keywords and history frames that bring an area's candidates up, and the related mimics (ACS, pneumonia, anaphylaxis and PE for abdominal pain; GORD, sepsis, oesophageal perforation and DKA for cough / breathlessness).
- V13. **Entry-point pilot vignettes** (`entry-*.json`) and the `entry:imaging` tag on the incidental-gallstones vignette: the stories, the expected diagnoses and the can't-miss expectations.
- V14. **The two production findings** above (TG18 auto-fill wall-thickening reading; PANE mapper findings the record negates): confirm they should be fixed in production.

## Sign-off detail (generated from the content)

### A. Loop policy (`findings.json` → `policy`)

| Setting | Value |
|---|---|
| `levels` | ["history", "exam", "score", "investigation"] |
| `priorTiers` | {"common": 0.03, "frequent": 0.015, "uncommon": 0.007, "rare": 0.003, "veryRare": 0.001} |
| `pregnancyPossibleMultiplier` | 5 |
| `defaultThresholds` | {"test": 0.1, "treat": 0.85} |
| `cantMissThresholds` | {"test": 0.02, "treat": 0.85} |
| `criteriaFloors` | {"definite": 0.9, "suspected": 0.5, "referral": 0.03} |
| `criteriaMinPosterior` | 0.01 |
| `definitiveLR` | 200 |
| `minLr` | 0.02 |
| `maxLr` | 100 |
| `conflictLowPosterior` | 0.2 |
| `conflictHighPosterior` | 0.8 |
| `criteriaBonus` | 0.05 |
| `minInformationGain` | 0.01 |
| `maxQuestions` | 15 |
| `displaySlots` | 5 |
| `cantMissSlots` | 2 |

### B. New diseases (not in PANE or not in the iOS pools), with their sources

| Area | Disease | ICD-10 | Tier | Can't-miss | Source |
|---|---|---|---|---|---|
| abdominal-pain | Colorectal adenoma (polyp with dysplasia) (`colorectal_adenoma`) | D12.6 | common | no |  |
| abdominal-pain | Irritable bowel syndrome (`irritable_bowel_syndrome`) | K58.9 | common | no | Lacy BE et al. Bowel disorders (Rome IV). Gastroenterology 2016;150:1393-1407; NICE CG61 (2017). New in the vademecum (iOS legacy abdominalPain pool only, unrev |
| abdominal-pain | Functional dyspepsia (`functional_dyspepsia`) | K30 | common | no | Stanghellini V et al. Gastroduodenal disorders (Rome IV). Gastroenterology 2016;150:1380-92. New in the vademecum. |
| abdominal-pain | Mesenteric lymphadenitis (`mesenteric_lymphadenitis`) | I88.0 | uncommon | no | Helbling R et al. Eur J Pediatr 2017. New in the vademecum (iOS legacy rightIliacFossaPain pool, unreviewed). |
| abdominal-pain | Meckel's diverticulum (diverticulitis or bleeding) (`meckel_diverticulitis`) | Q43.0 | rare | no | Sagar J et al. J R Soc Med 2006. New in the vademecum (iOS legacy rightIliacFossaPain pool). |
| abdominal-pain | Psoas abscess (`psoas_abscess`) | K68.12 | rare | no | Mallick IH et al. Postgrad Med J 2004. New in the vademecum (iOS legacy rightIliacFossaPain pool). |
| abdominal-pain | Asymptomatic gallstones (incidental) (`asymptomatic_gallstones`) | K80.20 | common | no | NICE CG188 Gallstone disease: diagnosis and management (2014). New in the vademecum (incidental entry point). |
| abdominal-pain | Cystic renal mass (Bosniak classification) (`bosniak_renal_cyst`) | N28.1 | common | no | Silverman SG et al. Bosniak classification of cystic renal masses, version 2019. Radiology 2019;292:475-88. New in the vademecum (incidental entry point). |
| abdominal-pain | Hyponatraemia (`hyponatraemia`) | E87.1 | rare | yes | PANE model 1.1.1 (lib/pane-engine/src/vademecum/specialties, acute_medicine): sensitivity approximations of the guideline named in the module header |
| abdominal-pain | Cirrhosis / Chronic Liver Disease (Decompensated) (`cirrhosis`) | K74.60 | uncommon | no | PANE model 1.1.1 (lib/pane-engine/src/vademecum/specialties, hepatobiliary): sensitivity approximations of the guideline named in the module header |
| abdominal-pain | Anal Fissure (`anal_fissure`) | K60.2 | frequent | no | PANE model 1.1.1 (lib/pane-engine/src/vademecum/specialties, colorectal): sensitivity approximations of the guideline named in the module header |
| abdominal-pain | Haemorrhoids (`haemorrhoids`) | K64.9 | common | no | PANE model 1.1.1 (lib/pane-engine/src/vademecum/specialties, colorectal): sensitivity approximations of the guideline named in the module header |
| abdominal-pain | Perianal Abscess / Fistula (`perianal_abscess`) | K61.0 | frequent | no | PANE model 1.1.1 (lib/pane-engine/src/vademecum/specialties, colorectal): sensitivity approximations of the guideline named in the module header |
| cough-breathlessness | Acute bronchitis / viral upper respiratory infection (`acute_bronchitis_urti`) | J20.9 | common | no | NICE NG120 Cough (acute): antimicrobial prescribing (2019); Smith SM et al. Antibiotics for acute bronchitis. Cochrane 2017. New in the vademecum (the commonest |
| cough-breathlessness | Post-infectious cough (`post_infectious_cough`) | R05 | common | no | Morice AH et al. BTS guidelines: recommendations for the management of cough in adults. Thorax 2006;61 Suppl 1:i1-24. New in the vademecum. |
| cough-breathlessness | Asthma (including cough-variant asthma) (`asthma_chronic`) | J45.9 | common | no | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma management (BTS/NICE/SIGN 2024); Morice AH et al. E |
| cough-breathlessness | COPD (stable) / chronic bronchitis (`copd_stable`) | J44.9 | common | no | Global Initiative for Chronic Obstructive Lung Disease (GOLD) 2025 report. New in the vademecum (iOS legacy cough pool, unreviewed). |
| cough-breathlessness | ACE-inhibitor cough (`ace_inhibitor_cough`) | T46.4X5A | uncommon | no | Dicpinigaitis PV. Angiotensin-converting enzyme inhibitor-induced cough: ACCP evidence-based clinical practice guidelines. Chest 2006;129:169S-173S. New in the  |
| cough-breathlessness | Upper airway cough syndrome (rhinosinusitis / post-nasal drip) (`upper_airway_cough_syndrome`) | R09.82 | common | no | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice guidelines. Chest 2006;129(1 Suppl):1S-23S; Morice AH |
| cough-breathlessness | Bronchiectasis (`bronchiectasis`) | J47.9 | uncommon | no | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69. New in the vademecum (absent from both engines). |
| cough-breathlessness | Pulmonary tuberculosis (`pulmonary_tb`) | A15.0 | rare | yes | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis (2024). New in the vademecum (iOS legacy cough and |
| cough-breathlessness | Lung cancer (`lung_cancer`) | C34.90 | uncommon | yes | NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023), lung and pleural cancers; Hamilton W et al. What are the clinical features of lung ca |
| cough-breathlessness | Pulmonary nodule (incidental) (`pulmonary_nodule`) | R91.1 | common | no | Callister MEJ et al. British Thoracic Society guidelines for the investigation and management of pulmonary nodules. Thorax 2015;70 Suppl 2:ii1-54; MacMahon H et |
| cough-breathlessness | Pneumothorax (spontaneous) (`pneumothorax`) | J93.9 | uncommon | yes | Roberts ME et al. British Thoracic Society guideline for pleural disease. Thorax 2023;78 Suppl 3:s1-s42; iOS coreConditions (PANE has only the traumatic node).  |
| cough-breathlessness | Iron-deficiency anaemia (`iron_deficiency_anaemia`) | D50.9 | common | no | Snook J et al. British Society of Gastroenterology guidelines for the management of iron deficiency anaemia in adults. Gut 2021;70:2030-51; iOS coreConditions.  |
| cough-breathlessness | Panic attack / anxiety (`panic_anxiety`) | F41.0 | common | no | NICE CG113 (2011, updated 2020); iOS coreConditions. A diagnosis of exclusion. | iOS DiagnosticDatabase.json coreConditions "Panic Attack / Anxiety": Prior tier |

### C. Diagnostic, referral and classification criteria (logic written from memory)

- **Acute Appendicitis** — AIR score (diagnostic; Andersson M, Andersson RE. World J Surg 2008 (AIR); Di Saverio S et al. Diagnosis and treatment of acute appendicitis: 2020 update of the WS)
  - suspected: AIR 9–12 (high probability) ⇐ `air band high`
- **Acute Appendicitis** — Alvarado score (diagnostic; Alvarado A. Ann Emerg Med 1986; Ohle R et al. BMC Med 2011)
  - suspected: Alvarado 7–10 (appendicitis likely) ⇐ `alvarado band high`
- **Acute Cholecystitis** — TG18 acute cholecystitis diagnostic criteria (diagnostic; Yokoe M et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholecystitis. J Hepatobiliary Pancreat Sci 2018;25:)
  - suspected: Suspected (A local + B systemic) ⇐ `[tg18-cholecystitis:suspected — else (Murphy's sign OR Murphy's sign OR RUQ pain / tenderness) AND (fever OR raised WBC OR raised CRP)]`
  - definite: Definite (A + B + C imaging) ⇐ `(tg18-cholecystitis band definite OR [tg18-cholecystitis:definite — else (Murphy's sign OR Murphy's sign OR RUQ pain / tenderness) AND (fever OR raised WBC OR raised CRP) AND imaging: thick wall / pericholecystic fluid / sonographic Murphy])`
- **Choledocholithiasis** — ASGE 2019 risk of CBD stones (diagnostic; Buxbaum JL et al. Gastrointest Endosc 2019;89:1075-105)
  - suspected: High likelihood (CBD stone on imaging, or cholangitis, or bilirubin > 4 mg/dL with a dilated duct) ⇐ `(CBD stone on imaging OR (bilirubin raised AND dilated CBD))`
- **Acute Cholangitis** — TG18 acute cholangitis diagnostic criteria (diagnostic; Kiriyama S et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholangitis. J Hepatobiliary Pancreat Sci 2018;25)
  - suspected: Suspected (A + B or C) ⇐ `[tg18-cholangitis:suspected — else (fever / rigors OR rigors OR raised WBC OR raised CRP) AND (jaundice OR bilirubin raised OR ALP raised OR biliary dilatation OR duct stone)]`
  - definite: Definite (A + B + C) ⇐ `[tg18-cholangitis:definite — else (fever / rigors OR rigors OR raised WBC OR raised CRP) AND (jaundice OR bilirubin raised OR ALP raised) AND (biliary dilatation OR stone / stricture on imaging)]`
- **Acute Pancreatitis** — Revised Atlanta 2012 (2 of 3) (diagnostic; Banks PA et al. Classification of acute pancreatitis 2012: revision of the Atlanta classification. Gut 2013;62:102-11)
  - definite: 2 of 3: typical pain, lipase / amylase ≥ 3 × ULN, imaging ⇐ `(≥ 2 of: (typical epigastric pain AND (radiating to the back OR acute onset OR severe)); (lipase ≥ 3 × ULN OR amylase ≥ 3 × ULN); imaging features of pancreatitis)`
- **Gastric Carcinoma** — NICE NG12 oesophago-gastric referral criteria (referral; NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023))
  - referral: Meets NG12 urgent endoscopy criteria ⇐ `[ng12-oesophago-gastric — else (dysphagia OR (age ≥ 55 AND weight loss AND (upper abdominal pain OR reflux OR dyspepsia)))]`
- **Colorectal Cancer** — NICE NG12 colorectal referral criteria (referral; NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023); NICE DG56 (FIT) 2023)
  - referral: Meets NG12 suspected colorectal cancer criteria (or FIT ≥ 10) ⇐ `[ng12-colorectal — else (FIT ≥ 10 µg Hb/g OR (age ≥ 40 AND weight loss AND abdominal pain) OR (age ≥ 50 AND rectal bleeding) OR (age ≥ 60 AND (iron-deficiency anaemia OR low ferritin OR change in bowel habit)) OR abdominal mass OR rectal mass)]`
- **Colorectal adenoma (polyp with dysplasia)** — BSG 2020 post-polypectomy surveillance (classification; Rutter MD et al. BSG/ACPGBI/PHE post-polypectomy and post-colorectal cancer resection surveillance guidelines. Gut 2020;69:201-23)
  - classification: High-risk findings: ≥ 2 premalignant polyps with ≥ 1 advanced, or ≥ 5 premalignant polyps ⇐ `((Two or more premalignant polyps AND Advanced adenoma: 10 mm or more, or high-grade dysplasia) OR Five or more premalignant polyps)`
  - classification: No high-risk findings ⇐ `(no Five or more premalignant polyps AND (no Two or more premalignant polyps OR no Advanced adenoma: 10 mm or more, or high-grade dysplasia))`
- **Irritable bowel syndrome** — Rome IV IBS criteria (diagnostic; Lacy BE et al. Bowel disorders (Rome IV). Gastroenterology 2016;150:1393-1407)
  - suspected: Recurrent pain ≥ 1 day / week for 3 months, onset ≥ 6 months, with ≥ 2 of: related to defecation, change in frequency, change in form; no alarm features ⇐ `(onset 6 months or more ago AND (≥ 2 of: related to defecation; change in stool frequency; change in stool form) AND no weight loss AND no rectal bleeding)`
- **Functional dyspepsia** — Rome IV functional dyspepsia (diagnostic; Stanghellini V et al. Gastroduodenal disorders (Rome IV). Gastroenterology 2016;150:1380-92)
  - suspected: Postprandial fullness, early satiety or epigastric pain / burning for 3 months (onset ≥ 6 months) with a normal endoscopy ⇐ `((postprandial fullness OR early satiety OR epigastric pain) AND onset 6 months or more ago AND normal endoscopy)`
- **Pancreatic Carcinoma** — NICE NG12 pancreatic cancer referral criteria (referral; NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023))
  - referral: Meets NG12 criteria (≥ 40 with jaundice; or ≥ 60 with weight loss and another symptom) ⇐ `[ng12-pancreatic — else ((age ≥ 40 AND (jaundice OR painless jaundice)) OR (age ≥ 60 AND weight loss AND (diarrhoea OR back pain OR abdominal pain OR nausea / vomiting OR constipation OR new-onset diabetes)))]`
- **Cystic renal mass (Bosniak classification)** — Bosniak classification v2019 (classification; Silverman SG et al. Bosniak classification of cystic renal masses, version 2019. Radiology 2019;292:475-88)
  - classification: Bosniak I–II (benign: no follow-up) ⇐ `(Simple cyst: thin wall, no septa, no enhancement (Bosniak I) OR Few thin septa or fine calcification, no enhancement (Bosniak II))`
  - classification: Bosniak III (≈ 50 % malignant) ⇐ `(Thickened or irregular enhancing wall or septa (Bosniak III) AND no Enhancing soft-tissue nodule in the cyst (Bosniak IV))`
  - classification: Bosniak IV (≈ 90 % malignant) ⇐ `Enhancing soft-tissue nodule in the cyst (Bosniak IV)`
- **Adrenal Incidentaloma** — ESE 2023 adrenal imaging assessment (classification; Fassnacht M et al. European Society of Endocrinology clinical practice guidelines on the management of adrenal incidentalomas (in collaborat)
  - classification: Benign features: homogeneous, ≤ 10 HU unenhanced, under 4 cm ⇐ `(Adrenal mass 10 HU or less on unenhanced CT (lipid-rich) AND no Adrenal mass over 4 cm)`
  - classification: Indeterminate: > 10 HU or ≥ 4 cm ⇐ `(no Adrenal mass 10 HU or less on unenhanced CT (lipid-rich) OR Adrenal mass over 4 cm)`
- **Sepsis / Septic Shock (source not yet identified; incl. neutropenic sepsis)** — Sepsis-3 (qSOFA screen) (severity; Singer M et al. Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA 2016;315:801-10; Seymour CW et al. JA)
  - classification: Suspected infection with qSOFA ≥ 2 (RR ≥ 22, altered mentation, SBP ≤ 100) ⇐ `((fever OR hypothermia OR rigors OR raised WBC) AND (qsofa band high OR (≥ 2 of: RR ≥ 22; altered mentation; SBP ≤ 100)))`
- **Diabetic Ketoacidosis (DKA, incl. Euglycaemic DKA)** — JBDS DKA diagnostic criteria (diagnostic; JBDS-IP. The management of diabetic ketoacidosis in adults (2023 update))
  - definite: Ketonaemia ≥ 3 mmol/L (or ketonuria ++), bicarbonate < 15 or pH < 7.3, and glucose ≥ 11 or known diabetes ⇐ `(ketones ≥ 3 mmol/L AND bicarbonate < 15 / pH < 7.3 AND (glucose ≥ 11 mmol/L OR known diabetes))`
- **Community-acquired Pneumonia (Adult / Child)** — BTS CAP definition (diagnostic; Lim WS et al. BTS guidelines for the management of community acquired pneumonia in adults: update 2009. Thorax 2009;64 Suppl 3:iii1-55; NICE)
  - definite: Acute lower respiratory symptoms with new shadowing on the chest X-ray ⇐ `((cough OR breathlessness OR pleuritic pain OR sputum) AND new consolidation on chest X-ray)`
- **Asthma (including cough-variant asthma)** — GINA 2024 diagnostic criteria (diagnostic; Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma management (BTS/NICE/SIGN 2024))
  - definite: Variable respiratory symptoms and confirmed variable expiratory airflow limitation ⇐ `((wheeze OR variable symptoms with triggers OR night-time cough) AND bronchodilator reversibility or peak-flow variability)`
- **COPD (stable) / chronic bronchitis** — GOLD 2025 diagnosis (diagnostic; Global Initiative for Chronic Obstructive Lung Disease (GOLD) 2025 report)
  - definite: Post-bronchodilator FEV1/FVC < 0.70 with symptoms or exposure ⇐ `(post-bronchodilator FEV1/FVC < 0.70 AND (smoking / exposure OR breathlessness OR chronic sputum OR chronic cough))`
- **Lung cancer** — NICE NG12 lung cancer referral criteria (referral; NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023), lung and pleural cancers)
  - referral: Suspected cancer pathway: chest X-ray suggests lung cancer, or ≥ 40 with unexplained haemoptysis (NG12 1.1.1) ⇐ `[ng12-lung — else (chest X-ray suggests cancer OR (age ≥ 40 AND haemoptysis))]`
  - referral: Urgent chest X-ray: ≥ 40 with 2 or more unexplained symptoms, or 1 if ever smoked (NG12 1.1.3); only when the symptoms are unexplained ⇐ `((age ≥ 40 AND (≥ 2 of: cough; fatigue; breathlessness; chest pain; weight loss; appetite loss)) OR (age ≥ 40 AND has ever smoked AND (≥ 1 of: cough; fatigue; breathlessness; chest pain; weight loss; appetite loss)))`
- **Pulmonary nodule (incidental)** — BTS 2015 pulmonary nodule pathway (classification; Callister MEJ et al. British Thoracic Society guidelines for the investigation and management of pulmonary nodules. Thorax 2015;70 Suppl 2:i)
  - classification: Solid nodule ≥ 8 mm: Brock risk; PET-CT when ≥ 10 % ⇐ `Solid pulmonary nodule 8 mm or more`
  - classification: Solid nodule < 8 mm: CT surveillance (5–6 mm at 1 year; 6–8 mm at 3 months), none under 5 mm ⇐ `Solid pulmonary nodule under 8 mm`
- **Thyroid nodule (incidental on CT / MRI / PET)** — ACR TI-RADS 2017 (classification; Tessler FN et al. ACR Thyroid Imaging, Reporting and Data System (TI-RADS): white paper of the ACR TI-RADS committee. J Am Coll Radiol 2017;)
  - classification: TR5 (≥ 7 points): FNA if ≥ 1 cm ⇐ `(points ≥ 7: Thyroid nodule: solid or almost completely solid +2; Thyroid nodule: mixed cystic and solid +1; Thyroid nodule: hypoechoic +2; Thyroid nodule: very hypoechoic +3; Thyroid nodule: taller than wide +3; Thyroid nodule: lobulated or irregular margin +2; Thyroid nodule: extra-thyroidal extension +3; Thyroid nodule: punctate echogenic foci (microcalcification) +3; Thyroid nodule: macrocalcification or peripheral (rim) calcification +1)`
  - classification: TR4 (4–6 points): FNA if ≥ 1.5 cm ⇐ `(points ≥ 4: Thyroid nodule: solid or almost completely solid +2; Thyroid nodule: mixed cystic and solid +1; Thyroid nodule: hypoechoic +2; Thyroid nodule: very hypoechoic +3; Thyroid nodule: taller than wide +3; Thyroid nodule: lobulated or irregular margin +2; Thyroid nodule: extra-thyroidal extension +3; Thyroid nodule: punctate echogenic foci (microcalcification) +3; Thyroid nodule: macrocalcification or peripheral (rim) calcification +1)`
  - classification: TR3 (3 points): FNA if ≥ 2.5 cm ⇐ `(points ≥ 3: Thyroid nodule: solid or almost completely solid +2; Thyroid nodule: mixed cystic and solid +1; Thyroid nodule: hypoechoic +2; Thyroid nodule: very hypoechoic +3; Thyroid nodule: taller than wide +3; Thyroid nodule: lobulated or irregular margin +2; Thyroid nodule: extra-thyroidal extension +3; Thyroid nodule: punctate echogenic foci (microcalcification) +3; Thyroid nodule: macrocalcification or peripheral (rim) calcification +1)`
- **Acute Heart Failure / Pulmonary Oedema** — Framingham heart failure criteria (diagnostic; McKee PA et al. The natural history of congestive heart failure: the Framingham study. N Engl J Med 1971;285:1441-6)
  - suspected: 2 major, or 1 major and 2 minor criteria ⇐ `((≥ 2 of: PND / orthopnoea; raised JVP; crackles; cardiomegaly / pulmonary oedema on CXR; third heart sound; hepatojugular reflux) OR ((≥ 1 of: Orthopnoea / paroxysmal nocturnal dyspnoea; Raised JVP; Lung crackles / crepitations; Chest X-ray: pulmonary oedema / cardiomegaly; sign.s3; sign.hjr) AND (≥ 2 of: ankle oedema; night cough; breathless on exertion; tachycardia)))`
- **Acute Coronary Syndrome (STEMI / NSTEMI / Unstable Angina)** — Fourth universal definition of myocardial infarction (diagnostic; Thygesen K et al. Fourth universal definition of myocardial infarction (2018). Eur Heart J 2019;40:237-69)
  - definite: Troponin rise with ischaemic symptoms or ischaemic ECG changes ⇐ `(troponin above the 99th centile, rising or falling AND (ischaemic symptoms OR ischaemic chest pain OR ischaemic ECG changes))`
- **Anaphylaxis** — WAO 2020 anaphylaxis criteria (diagnostic; Cardona V et al. World Allergy Organization anaphylaxis guidance 2020. World Allergy Organ J 2020;13:100472)
  - definite: Acute skin / mucosal involvement with breathing difficulty or hypotension, or exposure to a known allergen with breathing difficulty or hypotension ⇐ `((urticaria / angioedema AND (wheeze / stridor OR stridor OR hypotension)) OR (exposure to a likely allergen AND (bronchospasm OR stridor OR hypotension)))`

### D. Pathognomonic / confirmatory findings

| Disease | Finding | LR+ (range) or definitive | Requires | Source |
|---|---|---|---|---|
| Acute Appendicitis | Appendicitis on ultrasound or CT | 16 (?–?) | — | Rud B et al. Computed tomography for diagnosis of acute appendicitis in adults. Cochrane Database Syst Rev 2019;11:CD009 |
| Acute Appendicitis | Histology: acute appendicitis | definitive (policy definitiveLR) | — | Histopathology is the reference standard (RCPath datasets); a definitive report confirms the diagnosis — the clinician c |
| Acute Appendicitis | Histology: normal appendix (refutes) | 0.02 (?–?) | — | Histopathology is the reference standard (RCPath datasets); a definitive report confirms the diagnosis — the clinician c |
| Acute Cholecystitis | Ultrasound signs of acute cholecystitis | 5 (?–?) | — | Kiewiet JJS et al. A systematic review and meta-analysis of diagnostic performance of imaging in acute cholecystitis. Ra |
| Acute Cholecystitis | Histology: acute cholecystitis | definitive (policy definitiveLR) | — | Histopathology is the reference standard (RCPath datasets); a definitive report confirms the diagnosis — the clinician c |
| Choledocholithiasis | Stone in the common bile duct on MRCP / EUS | 15 (?–?) | — | Giljaca V et al. Diagnostic accuracy of magnetic resonance cholangiopancreatography for common bile duct stones. Cochran |
| Acute Pancreatitis | Imaging features of acute pancreatitis (CT / US / MRI) | 12 (?–?) | — | Banks PA et al. Classification of acute pancreatitis 2012: revision of the Atlanta classification. Gut 2013;62:102-11; i |
| Acute Pancreatitis | Grey Turner / Cullen bruising with a raised lipase: haemorrhagic pancreatitis | 8 (?–?) | elevated_amylase | Mookadam F, Cikes M. N Engl J Med 2005;353:1386 (seen in ≈ 1–3 % of acute pancreatitis; also ruptured ectopic, AAA) |
| Peptic Ulcer Disease | Ulcer seen at endoscopy | 30 (?–?) | — | ASGE / BSG: endoscopy is the reference standard for peptic ulcer |
| Acute Diverticulitis | CT signs of diverticulitis | 24 (?–?) | — | Laméris W et al. Graded compression ultrasonography and computed tomography in acute colonic diverticulitis: meta-analys |
| Bowel Obstruction | Obstruction on imaging (dilated loops, transition point) | 13 (?–?) | — | Ten Broek RPG et al. Bologna guidelines for diagnosis and management of adhesive small bowel obstruction (ASBO): 2017 up |
| Small Bowel Obstruction — Adhesions | Obstruction on imaging after previous surgery | 10 (?–?) | — | Ten Broek RPG et al. Bologna guidelines for diagnosis and management of adhesive small bowel obstruction (ASBO): 2017 up |
| Perforated Peptic Ulcer / Perforated Viscus | Free subdiaphragmatic gas: visceral perforation | 12 (?–?) | — | Tarasconi A et al. Perforated and bleeding peptic ulcer: WSES guidelines. World J Emerg Surg 2020;15:3; iOS "Pneumoperit |
| Gastric Carcinoma | Malignant-looking stricture / tumour at endoscopy | 10 (?–?) | — | NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023); iOS "Malignant-looking stricture or tumour" L |
| Gastric Carcinoma | Histology: gastric / oesophageal carcinoma | definitive (policy definitiveLR) | — | Histopathology is the reference standard (RCPath datasets); a definitive report confirms the diagnosis — the clinician c |
| Colorectal Cancer | Histology: colorectal adenocarcinoma | definitive (policy definitiveLR) | — | Histopathology is the reference standard (RCPath datasets); a definitive report confirms the diagnosis — the clinician c |
| Colorectal adenoma (polyp with dysplasia) | Histology: colorectal adenoma | definitive (policy definitiveLR) | — | Histopathology is the reference standard (RCPath datasets); a definitive report confirms the diagnosis — the clinician c |
| Rectal Carcinoma | Histology: rectal adenocarcinoma | definitive (policy definitiveLR) | — | Histopathology is the reference standard (RCPath datasets); a definitive report confirms the diagnosis — the clinician c |
| Sigmoid Volvulus | Coffee-bean sign / whirl on imaging: sigmoid volvulus | 20 (?–?) | — | Alavi K et al. ASCRS clinical practice guidelines for the management of colonic volvulus and acute colonic pseudo-obstru |
| Clostridioides difficile Colitis (C. diff infection) | C. difficile toxin positive | 15 (?–?) | — | McDonald LC et al. IDSA/SHEA clinical practice guidelines for Clostridium difficile infection. Clin Infect Dis 2018;66:e |
| Mesenteric lymphadenitis | Enlarged mesenteric nodes with a normal appendix on ultrasound | 10 (?–?) | — | Helbling R et al. Eur J Pediatr 2017 |
| Meckel's diverticulum (diverticulitis or bleeding) | Positive Meckel (technetium-99m pertechnetate) scan | 20 (?–?) | — | Sagar J et al. 2006 (sensitivity ≈ 0.85 in children, specificity ≈ 0.95) |
| Psoas abscess | Psoas collection on CT / MRI | 30 (?–?) | — | Mallick IH et al. 2004 (CT is diagnostic) |
| Liver Abscess | Liver abscess on imaging | 12 (?–?) | — | Lardière-Deguelte S et al. Hepatic abscess: diagnosis and management. J Visc Surg 2015;152:231-43; iOS "Liver abscess on |
| Pancreatic Carcinoma | Pancreatic mass or double-duct sign on imaging | 12 (?–?) | — | NICE NG85 Pancreatic cancer in adults (2018); Toft J et al. Imaging modalities in the diagnosis of pancreatic adenocarci |
| Pancreatic Carcinoma | Cytology / histology: pancreatic adenocarcinoma | definitive (policy definitiveLR) | — | Histopathology is the reference standard (RCPath datasets); a definitive report confirms the diagnosis — the clinician c |
| Gallbladder Carcinoma | Histology: gallbladder carcinoma | definitive (policy definitiveLR) | — | Histopathology is the reference standard (RCPath datasets); a definitive report confirms the diagnosis — the clinician c |
| Abdominal Aortic Aneurysm (Symptomatic / Ruptured) | Abdominal aortic aneurysm on ultrasound / CT | 10 (?–?) | — | Wanhainen A et al. ESVS 2024 Clinical Practice Guidelines on the management of abdominal aorto-iliac artery aneurysms. E |
| Abdominal Aortic Aneurysm (Symptomatic / Ruptured) | CT: aneurysm with retroperitoneal haematoma | definitive (policy definitiveLR) | — | Wanhainen A et al. ESVS 2024 Clinical Practice Guidelines on the management of abdominal aorto-iliac artery aneurysms. E |
| Acute Mesenteric Ischaemia | CT angiography: mesenteric occlusion, pneumatosis or portal venous gas | 23 (?–?) | — | Cudnik MT et al. The diagnosis of acute mesenteric ischemia: a systematic review and meta-analysis. Acad Emerg Med 2013; |
| Ectopic Pregnancy | Transvaginal ultrasound: extra-uterine sac or adnexal mass with an empty uterus | 15 (?–?) | — | Kirk E et al. The diagnostic effectiveness of an initial transvaginal scan in detecting ectopic pregnancy. Hum Reprod 20 |
| Ovarian Torsion | Ultrasound signs of ovarian torsion | 8 (?–?) | — | Huchon C, Fauconnier A. Adnexal torsion: a literature review. Eur J Obstet Gynecol Reprod Biol 2010;150:8-12; iOS "Ultra |
| Pelvic Inflammatory Disease (PID) / Tubo-ovarian Abscess | Tubo-ovarian abscess or pyosalpinx on imaging | 10 (?–?) | — | CDC Sexually Transmitted Infections Treatment Guidelines 2021 (pelvic inflammatory disease); iOS LR 10 (expert estimate) |
| Renal Colic / Urolithiasis | Ureteric stone on CT KUB | 30 (?–?) | — | EAU Guidelines on Urolithiasis (2024); Rodger F et al. Diagnostic accuracy of low-dose CT for urolithiasis: systematic r |
| Testicular Torsion | Absent or reduced testicular flow on Doppler | 40 (?–?) | — | EAU Guidelines on Paediatric Urology (2024) — acute scrotum; Baker LA et al. An analysis of clinical outcomes using colo |
| Anastomotic Leak | Leak or collection at the anastomosis on imaging | 10 (?–?) | — | den Dulk M et al. Improved diagnosis and treatment of anastomotic leakage after colorectal surgery. Eur J Surg Oncol 200 |
| Intussusception | Target / doughnut sign on ultrasound | 49 (?–?) | — | Hryhorczuk AL, Strouse PJ. Validation of US as a first-line diagnostic test for assessment of pediatric ileocolic intuss |
| Malrotation with Midgut Volvulus | Whirlpool sign / abnormal SMA–SMV relationship | 15 (?–?) | — | Williams H. Green for danger! Arch Dis Child Educ Pract Ed 2007; iOS LR 15 |
| Community-acquired Pneumonia (Adult / Child) | Consolidation on chest X-ray | 15 (?–?) | — | Lim WS et al. BTS guidelines for the management of community acquired pneumonia in adults: update 2009. Thorax 2009;64 S |
| Asthma (including cough-variant asthma) | Bronchodilator reversibility or peak-flow variability | 5 (?–?) | — | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma management  |
| ACE-inhibitor cough | Cough settled after stopping the ACE inhibitor | definitive (policy definitiveLR) | — | Dicpinigaitis PV. Angiotensin-converting enzyme inhibitor-induced cough: ACCP evidence-based clinical practice guideline |
| Upper airway cough syndrome (rhinosinusitis / post-nasal drip) | Cough improved on nasal steroid / antihistamine | 5 (?–?) | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice guidelines. C |
| Bronchiectasis | Bronchial dilatation on high-resolution CT | definitive (policy definitiveLR) | — | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 (HRCT is the |
| Pulmonary tuberculosis | Sputum AFB smear, culture or GeneXpert positive | definitive (policy definitiveLR) | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis (2024) (ba |
| Lung cancer | Lung mass on chest X-ray / CT | 10 (?–?) | — | NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023), lung and pleural cancers (not definitive: inf |
| Lung cancer | Histology / cytology: lung carcinoma | definitive (policy definitiveLR) | — | Histopathology / microbiology is the reference standard; a definitive report confirms the diagnosis — the clinician conf |
| Acute Heart Failure / Pulmonary Oedema | Echocardiogram: reduced ejection fraction or raised filling pressures | 8 (?–?) | — | McDonagh TA et al. 2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure. Eur Heart J 2 |
| Pulmonary Embolism | Filling defect on CT pulmonary angiogram | 30 (?–?) | — | Konstantinides SV et al. 2019 ESC Guidelines for the diagnosis and management of acute pulmonary embolism. Eur Heart J 2 |
| Pneumothorax (spontaneous) | Pneumothorax on chest X-ray / CT | 20 (?–?) | — | Roberts ME et al. British Thoracic Society guideline for pleural disease. Thorax 2023;78 Suppl 3:s1-s42; iOS "Pneumothor |
| Traumatic / Tension Pneumothorax | Pneumothorax on imaging | 20 (?–?) | — | Roberts ME et al. British Thoracic Society guideline for pleural disease. Thorax 2023;78 Suppl 3:s1-s42 |
| Atrial Fibrillation / Flutter | Atrial fibrillation on the ECG | 20 (?–?) | — | Hindricks G / Van Gelder IC et al. ESC 2024 AF guideline (the ECG is diagnostic) |

### E. Hard exclusions (the clinician can override each)

| Disease | Excluded when | Reason shown | Note |
|---|---|---|---|
| Acute Appendicitis | Previous appendicectomy | Previous appendicectomy | Stump appendicitis after appendicectomy is rare but reported: override if the appendix base was left long or the history is uncertain. |
| Acute Cholecystitis | Previous cholecystectomy | Previous cholecystectomy | Stump (remnant) cholecystitis after subtotal cholecystectomy and retained duct stones do occur: override for a subtotal operation, and consider choledocholithiasis, which stays in the list. |
| Biliary Colic / Symptomatic Cholelithiasis | Previous cholecystectomy | Previous cholecystectomy | After cholecystectomy, biliary-type pain points to a retained duct stone or sphincter dysfunction: override only for a subtotal operation. |
| Appendix Mass / Late Appendicitis | Previous appendicectomy | Previous appendicectomy |  |
| Gallbladder Carcinoma | Previous cholecystectomy | Previous cholecystectomy | Unless the carcinoma was found on the cholecystectomy histology (then the work-up continues from the pathology entry point). |
| Ectopic Pregnancy | sex male | Male patient |  |
| Ectopic Pregnancy | Previous hysterectomy | Previous hysterectomy | Ectopic pregnancy after hysterectomy is reported but exceptional (a retained tube, a supracervical hysterectomy): override if the ovaries and a tube remain and the pregnancy test is positive. |
| Ovarian Torsion | Both ovaries removed | Both ovaries removed |  |
| Ovarian Cyst (incl. Haemorrhagic / Ruptured Corpus Luteum) | Both ovaries removed | Both ovaries removed |  |
| Uterine Fibroids | Previous hysterectomy | Previous hysterectomy |  |
| Uterine / Endometrial Carcinoma | Previous hysterectomy | Previous hysterectomy |  |
| ACE-inhibitor cough | no ACE inhibitor / ARB use | Not taking an ACE inhibitor | Override if the ACE inhibitor was stopped recently (the cough can persist for up to 3 months). |

### F. Incidental-finding work-ups

- **Colorectal adenoma (polyp with dysplasia)** (trigger: Histology: colorectal adenoma (with dysplasia); classification `bsg-2020-surveillance`; Rutter MD et al. BSG/ACPGBI/PHE post-polypectomy and post-colorectal cancer resection surveillance guidelines. Gut 2020;)
  - Confirm the colonoscopy was complete and the polyp fully excised (piecemeal ≥ 20 mm: site check at 2–6 months)
  - Surveillance colonoscopy at 3 years
  - High-grade dysplasia or an incompletely excised advanced lesion: discuss at the colorectal MDT
- **Asymptomatic gallstones (incidental)** (trigger: Gallstones found on imaging done for another reason, no biliary symptoms; classification `None`; NICE CG188 Gallstone disease: diagnosis and management (2014))
  - Normal gallbladder and biliary tree: reassure; no cholecystectomy for asymptomatic gallbladder stones
  - Dilated common bile duct or abnormal liver tests: image the duct (MRCP; EUS if MRCP is not diagnostic)
  - Advise to return with biliary pain, jaundice or fever
- **Cystic renal mass (Bosniak classification)** (trigger: Renal cyst on imaging; classification `bosniak-2019`; Silverman SG et al. Bosniak classification of cystic renal masses, version 2019. Radiology 2019;292:475-88)
  - Characterise with contrast CT or MRI when the cyst is not clearly simple on the first study
  - Bosniak III or IV: urology referral
  - Bosniak I–II: no follow-up needed
- **Adrenal Incidentaloma** (trigger: Adrenal mass on CT or MRI; classification `ese-2023-imaging`; Fassnacht M et al. European Society of Endocrinology clinical practice guidelines on the management of adrenal incidenta)
  - 1 mg overnight dexamethasone suppression test (autonomous cortisol secretion)
  - Plasma free or urinary fractionated metanephrines (phaeochromocytoma), unless ≤ 10 HU
  - Aldosterone / renin ratio when hypertensive or hypokalaemic
  - Adrenal MDT for a mass ≥ 4 cm, indeterminate imaging or hormone excess
- **Pulmonary nodule (incidental)** (trigger: Solid pulmonary nodule under 8 mm, Solid pulmonary nodule 8 mm or more; classification `bts-nodule`; Callister MEJ et al. British Thoracic Society guidelines for the investigation and management of pulmonary nodules. Thor)
  - Calculate the Brock (PanCan) malignancy risk
  - PET-CT when the Brock risk is 10 % or more (then Herder score)
  - CT surveillance by size (no follow-up for solid nodules under 5 mm)
- **Thyroid nodule (incidental on CT / MRI / PET)** (trigger: Thyroid nodule seen on CT, MRI or PET; classification `acr-tirads`; Tessler FN et al. ACR Thyroid Imaging, Reporting and Data System (TI-RADS): white paper of the ACR TI-RADS committee. J )
  - Dedicated thyroid ultrasound (an incidental nodule on CT / MRI is not characterised); TSH
  - FNA by TI-RADS category and size (TR5 ≥ 1 cm, TR4 ≥ 1.5 cm, TR3 ≥ 2.5 cm); report cytology by Bethesda category
  - A focal FDG-avid thyroid nodule on PET needs ultrasound and FNA (≈ 30 % malignant)

### G. Likelihood ratios written as new content (not seeded from PANE or iOS)

| Disease | Finding | LR+ | LR− | Source |
|---|---|---|---|---|
| Acute Cholecystitis | Thick-walled gallbladder on ultrasound | 3 | — | Kiewiet JJS et al. A systematic review and meta-analysis of diagnostic performance of imaging in acute cholecy |
| Biliary Colic / Symptomatic Cholelithiasis | Gallstones found on imaging done for another reason, no biliary symptoms | 1 | — | NICE CG188 Gallstone disease: diagnosis and management (2014) (an incidental stone does not make the pain bili |
| Choledocholithiasis | ALP raised | 2.5 | 0.5 | Buxbaum JL et al. ASGE guideline on the role of endoscopy in the evaluation and management of choledocholithia |
| Choledocholithiasis | Bilirubin raised | 3 | 0.4 | Buxbaum JL et al. ASGE 2019 (bilirubin > 4 mg/dL is a very strong predictor) |
| Acute Cholangitis | Bilirubin raised | 3 | 0.3 | Kiriyama S et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholangitis. J Hepa |
| Acute Pancreatitis | Flank or periumbilical bruising (Grey Turner / Cullen) | 5 | — | Mookadam F, Cikes M. Cullen's and Turner's signs. N Engl J Med 2005;353:1386 |
| Acute Pancreatitis | Amylase 3 × the upper limit of normal or more | 10 | 0.3 | Banks PA et al. Classification of acute pancreatitis 2012: revision of the Atlanta classification. Gut 2013;62 |
| Acute Pancreatitis | Lipase (or amylase) above normal but under 3 × ULN | 3 | 0.3 | Ismail OZ, Bhayana V. Lipase or amylase for the diagnosis of acute pancreatitis? Clin Biochem 2017;50:1275-80  |
| Peptic Ulcer Disease | H. pylori positive (biopsy urease, stool antigen or breath test) | 2 | 0.6 | Malfertheiner P et al. Maastricht VI/Florence consensus report. Gut 2022;71:1724-62 |
| GORD / Reflux Oesophagitis | Cough after meals or when lying down after eating | 3 | — | Irwin RS et al. Chest 2006 (reflux cough) |
| GORD / Reflux Oesophagitis | Cough for more than 8 weeks | 1.5 | — | Morice AH et al. ERS guidelines on the diagnosis and treatment of chronic cough. Eur Respir J 2020;55:1901136 |
| GORD / Reflux Oesophagitis | Dry, tickly cough | 1.5 | — | Irwin RS et al. Diagnosis and management of cough: ACCP evidence-based clinical practice guidelines. Chest 200 |
| GORD / Reflux Oesophagitis | Reflux, heartburn or hoarseness with the cough | 2.5 | 0.7 | Kahrilas PJ et al. Chest 2016 (reflux cough without heartburn in up to 75 %) |
| GORD / Reflux Oesophagitis | Cough improved on a trial of acid suppression | 4 | 0.5 | Irwin RS et al. Chest 2006; Kahrilas PJ et al. CHEST guideline and expert panel report on chronic cough due to |
| Acute / Chronic Gastritis | H. pylori positive (biopsy urease, stool antigen or breath test) | 2 | 0.6 | Malfertheiner P et al. Gut 2022 (Maastricht VI) |
| Perforated Peptic Ulcer / Perforated Viscus | Lipase (or amylase) above normal but under 3 × ULN | 2 | — | Tarasconi A et al. Perforated and bleeding peptic ulcer: WSES guidelines. World J Emerg Surg 2020;15:3 (hypera |
| Colorectal Cancer | Colonoscopy: malignant-looking tumour | 20 | — | ASGE / BSG: colonoscopy with biopsy is the reference standard |
| Colorectal Cancer | Ferritin low (under 30 µg/L) | 2.5 | — | Snook J et al. BSG guidelines for the management of iron deficiency anaemia in adults. Gut 2021;70:2030-51 |
| Colorectal Cancer | Histology: colorectal adenoma (with dysplasia) | 3 | — | Rutter MD et al. BSG/ACPGBI/PHE post-polypectomy and post-colorectal cancer resection surveillance guidelines. |
| Colorectal Cancer | Microcytosis (MCV under 80 fL) | 1.5 | — | Snook J et al. Gut 2021 |
| Colorectal adenoma (polyp with dysplasia) | Age 50 or over | 2 | — | Rutter MD et al. BSG/ACPGBI/PHE post-polypectomy and post-colorectal cancer resection surveillance guidelines. |
| Colorectal adenoma (polyp with dysplasia) | PR bleeding | 1.3 | — | Rutter MD et al. BSG/ACPGBI/PHE post-polypectomy and post-colorectal cancer resection surveillance guidelines. |
| Colorectal adenoma (polyp with dysplasia) | Histology: colorectal adenoma (with dysplasia) | 50 | — | Rutter MD et al. BSG/ACPGBI/PHE post-polypectomy and post-colorectal cancer resection surveillance guidelines. |
| Colorectal adenoma (polyp with dysplasia) | Positive faecal immunochemical test (FIT) | 2 | — | NICE DG30 / DG56 FIT (adenomas are the commonest finding after a positive FIT) |
| Irritable bowel syndrome | Age 50 or over | 0.5 | — | NICE CG61 (2017): new symptoms after 50 need investigation first |
| Irritable bowel syndrome | Bloating or distension that comes and goes | 1.8 | 0.7 | Lacy BE et al. Bowel disorders (Rome IV). Gastroenterology 2016;150:1393-1407 |
| Irritable bowel syndrome | Episodic / intermittent pain | 1.5 | — | Lacy BE et al. Bowel disorders (Rome IV). Gastroenterology 2016;150:1393-1407 |
| Irritable bowel syndrome | Fever | 0.3 | — | NICE CG61 (2017) |
| Irritable bowel syndrome | Nocturnal pain | 0.5 | — | NICE CG61 (2017) |
| Irritable bowel syndrome | Pain related to defecation (better or worse) | 3 | 0.4 | Lacy BE et al. Bowel disorders (Rome IV). Gastroenterology 2016;150:1393-1407 |
| Irritable bowel syndrome | PR bleeding | 0.4 | — | NICE CG61 (2017) |
| Irritable bowel syndrome | Pain with a change in stool form (Bristol type) | 2.5 | 0.5 | Lacy BE et al. Bowel disorders (Rome IV). Gastroenterology 2016;150:1393-1407 |
| Irritable bowel syndrome | Pain with a change in stool frequency | 2 | 0.6 | Lacy BE et al. Bowel disorders (Rome IV). Gastroenterology 2016;150:1393-1407 |
| Irritable bowel syndrome | Symptoms began 6 months or more ago | 3 | 0.3 | Lacy BE et al. Bowel disorders (Rome IV). Gastroenterology 2016;150:1393-1407 |
| Irritable bowel syndrome | Unintentional weight loss | 0.3 | — | NICE CG61 Irritable bowel syndrome in adults (2008, updated 2017): red flags point elsewhere |
| Irritable bowel syndrome | Anaemia (low haemoglobin) | 0.3 | — | NICE CG61 (2017) |
| Irritable bowel syndrome | Elevated WBC | 0.4 | — | NICE CG61 (2017) |
| Irritable bowel syndrome | Raised / rising CRP | 0.4 | — | NICE CG61 (2017) |
| Functional dyspepsia | Dysphagia | 0.3 | — | NICE CG184 dyspepsia (alarm feature) |
| Functional dyspepsia | Early satiety | 2.5 | 0.6 | Stanghellini V et al. Gastroduodenal disorders (Rome IV). Gastroenterology 2016;150:1380-92 |
| Functional dyspepsia | Epigastric pain | 2 | 0.3 | Stanghellini V et al. Gastroduodenal disorders (Rome IV). Gastroenterology 2016;150:1380-92 |
| Functional dyspepsia | Fever | 0.3 | — | Stanghellini V et al. Gastroduodenal disorders (Rome IV). Gastroenterology 2016;150:1380-92 |
| Functional dyspepsia | Haematemesis | 0.2 | — | NICE CG184 |
| Functional dyspepsia | Bothersome postprandial fullness | 3 | 0.5 | Stanghellini V et al. Gastroduodenal disorders (Rome IV). Gastroenterology 2016;150:1380-92 |
| Functional dyspepsia | Symptoms began 6 months or more ago | 2 | 0.5 | Stanghellini V et al. Gastroduodenal disorders (Rome IV). Gastroenterology 2016;150:1380-92 |
| Functional dyspepsia | Unintentional weight loss | 0.3 | — | Stanghellini V et al. Gastroduodenal disorders (Rome IV). Gastroenterology 2016;150:1380-92 (alarm feature) |
| Functional dyspepsia | Upper endoscopy normal | 4 | 0.3 | Stanghellini V et al. Gastroduodenal disorders (Rome IV). Gastroenterology 2016;150:1380-92 |
| Mesenteric lymphadenitis | Age 15 or under | 3 | — | Helbling R et al. 2017 (mainly children and young adults) |
| Mesenteric lymphadenitis | Fever | 1.5 | — | Helbling R et al. 2017 |
| Mesenteric lymphadenitis | Pain migration (periumbilical → RIF) | 0.3 | — | Helbling R et al. 2017 (migration points to appendicitis) |
| Mesenteric lymphadenitis | Recent sore throat or upper respiratory infection | 3 | 0.6 | Helbling R et al. Acute nonspecific mesenteric lymphadenitis: more than no appendicitis. Eur J Pediatr 2017;17 |
| Mesenteric lymphadenitis | RLQ / right iliac fossa pain | 3 | 0.4 | Macari M et al. Mesenteric adenitis: CT diagnosis of primary versus secondary causes. AJR 2002;178:853-8 |
| Mesenteric lymphadenitis | Peritoneal signs (rebound, percussion tenderness, guarding) | 0.4 | — | Helbling R et al. 2017 |
| Meckel's diverticulum (diverticulitis or bleeding) | Age 15 or under | 2 | — | Sagar J et al. 2006 |
| Meckel's diverticulum (diverticulitis or bleeding) | Painless rectal bleeding in a child | 10 | — | Sagar J et al. 2006 (painless bleeding in a child) |
| Meckel's diverticulum (diverticulitis or bleeding) | Periumbilical / central abdominal pain | 2 | — | Sagar J et al. 2006 |
| Meckel's diverticulum (diverticulitis or bleeding) | RLQ / right iliac fossa pain | 2 | — | Sagar J et al. Meckel's diverticulum: a systematic review. J R Soc Med 2006;99:501-5 |
| Psoas abscess | Back pain | 2 | — | Mallick IH et al. 2004 |
| Psoas abscess | Fever | 2.5 | 0.5 | Mallick IH et al. Iliopsoas abscesses. Postgrad Med J 2004;80:459-62 |
| Psoas abscess | RLQ / right iliac fossa pain | 1.5 | — | Mallick IH et al. 2004 |
| Psoas abscess | Pain on hip extension / flexed hip (psoas irritation) | 5 | — | Mallick IH et al. 2004 (psoas sign) |
| Acute Hepatitis | Thick-walled gallbladder on ultrasound | 3 | — | Kim YS et al. Gallbladder wall thickening in acute hepatitis. J Clin Ultrasound 2012 (reactive wall oedema) |
| Acute Hepatitis | ALT / AST 1000 U/L or more | 8 | — | EASL Clinical Practice Guidelines on hepatitis E (2018); iOS "Transaminases ≥ 1000 U/L" (cholecystitis LR 0.3, |
| Pancreatic Carcinoma | CA 19-9 raised | 4 | 0.3 | Goonetilleke KS, Siriwardena AK. Systematic review of CA 19-9 in the diagnosis of pancreatic cancer. Eur J Sur |
| Cholangiocarcinoma | CA 19-9 raised | 3 | — | Khan SA et al. BSG guidelines for cholangiocarcinoma. Gut 2012 |
| Gallbladder Carcinoma | Focal gallbladder mural mass or polyp ≥ 10 mm | 8 | — | Foley KG et al. Management and follow-up of gallbladder polyps: ESGAR, EAES, EFISDS and ESGE joint guidelines. |
| Gallbladder Carcinoma | Thick-walled gallbladder on ultrasound | 2 | — | Foley KG et al. Management and follow-up of gallbladder polyps: ESGAR, EAES, EFISDS and ESGE joint guidelines. |
| Asymptomatic gallstones (incidental) | Episodic / intermittent pain | 0.4 | — | NICE CG188 Gallstone disease: diagnosis and management (2014) |
| Asymptomatic gallstones (incidental) | Fever | 0.3 | — | NICE CG188 Gallstone disease: diagnosis and management (2014) |
| Asymptomatic gallstones (incidental) | RUQ pain / biliary colic | 0.3 | — | NICE CG188 Gallstone disease: diagnosis and management (2014) (biliary pain makes the stones symptomatic) |
| Asymptomatic gallstones (incidental) | Jaundice | 0.2 | — | NICE CG188 Gallstone disease: diagnosis and management (2014) |
| Asymptomatic gallstones (incidental) | Gallstones found on imaging done for another reason, no biliary symptoms | 20 | — | NICE CG188 Gallstone disease: diagnosis and management (2014) |
| Asymptomatic gallstones (incidental) | USS showing gallstones | 3 | — | NICE CG188 Gallstone disease: diagnosis and management (2014) |
| Acute Mesenteric Ischaemia | D-dimer raised | 1.6 | 0.1 | Cudnik MT et al. The diagnosis of acute mesenteric ischemia: a systematic review and meta-analysis. Acad Emerg |
| Acute Mesenteric Ischaemia | Lipase (or amylase) above normal but under 3 × ULN | 2 | — | Björck M et al. ESVS 2017 Clinical Practice Guidelines: management of the diseases of mesenteric arteries and  |
| Acute Aortic Dissection | D-dimer raised | 2 | 0.07 | Nazerian P et al. Diagnostic accuracy of the aortic dissection detection risk score plus D-dimer (ADvISED). Ci |
| Cystic renal mass (Bosniak classification) | Renal cyst on imaging | 30 | — | Silverman SG et al. Bosniak classification of cystic renal masses, version 2019. Radiology 2019;292:475-88 |
| Adrenal Incidentaloma | Adrenal mass on CT or MRI | 30 | — | Fassnacht M et al. European Society of Endocrinology clinical practice guidelines on the management of adrenal |
| Diabetic Ketoacidosis (DKA, incl. Euglycaemic DKA) | Lipase (or amylase) above normal but under 3 × ULN | 2 | — | Yadav D et al. Nonspecific hyperamylasemia and hyperlipasemia in diabetic ketoacidosis. Am J Gastroenterol 200 |
| Community-acquired Pneumonia (Adult / Child) | Coryza or sore throat at onset | 0.8 | — | Metlay JP, Kapoor WN, Fine MJ. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 |
| Community-acquired Pneumonia (Adult / Child) | Cough for under 3 weeks | 2 | 0.3 | Metlay JP, Kapoor WN, Fine MJ. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 |
| Community-acquired Pneumonia (Adult / Child) | Chest X-ray normal | 0.1 | — | Lim WS et al. BTS guidelines for the management of community acquired pneumonia in adults: update 2009. Thorax |
| Community-acquired Pneumonia (Adult / Child) | D-dimer raised | 1.3 | — | Non-specific D-dimer rise in infection (ESC 2019 PE guideline) |
| Acute bronchitis / viral upper respiratory infection | Coryza or sore throat at onset | 3 | 0.5 | NICE NG120 Cough (acute): antimicrobial prescribing (2019); Smith SM et al. Antibiotics for acute bronchitis.  |
| Acute bronchitis / viral upper respiratory infection | Cough | 3 | 0.2 | NICE NG120 Cough (acute): antimicrobial prescribing (2019); Smith SM et al. Antibiotics for acute bronchitis.  |
| Acute bronchitis / viral upper respiratory infection | Cough for under 3 weeks | 4 | 0.1 | NICE NG120 Cough (acute): antimicrobial prescribing (2019); Smith SM et al. Antibiotics for acute bronchitis.  |
| Acute bronchitis / viral upper respiratory infection | Cough for more than 8 weeks | 0.1 | — | Morice AH et al. ERS guidelines on the diagnosis and treatment of chronic cough in adults and children. Eur Re |
| Acute bronchitis / viral upper respiratory infection | Fever | 1.2 | — | NICE NG120 Cough (acute): antimicrobial prescribing (2019); Smith SM et al. Antibiotics for acute bronchitis.  |
| Acute bronchitis / viral upper respiratory infection | Productive cough (sputum) | 1.2 | — | NICE NG120 Cough (acute): antimicrobial prescribing (2019); Smith SM et al. Antibiotics for acute bronchitis.  |
| Acute bronchitis / viral upper respiratory infection | Lung crackles / crepitations | 0.5 | — | Metlay JP, Kapoor WN, Fine MJ. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 |
| Acute bronchitis / viral upper respiratory infection | Hypoxia (SpO₂ < 94 %) | 0.3 | — | Metlay JP, Kapoor WN, Fine MJ. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 |
| Acute bronchitis / viral upper respiratory infection | Tachycardia (HR > 100, age-adjusted in children) | 0.6 | — | Metlay JP, Kapoor WN, Fine MJ. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 |
| Acute bronchitis / viral upper respiratory infection | Tachypnoea (RR ≥ 22, age-adjusted in children) | 0.4 | — | Metlay JP, Kapoor WN, Fine MJ. Does this patient have community-acquired pneumonia? JAMA 1997;278:1440-5 |
| Acute bronchitis / viral upper respiratory infection | Consolidation on chest X-ray | 0.05 | — | Lim WS et al. BTS guidelines for the management of community acquired pneumonia in adults: update 2009. Thorax |
| Post-infectious cough | Cough for more than 8 weeks | 0.4 | — | Morice AH et al. ERS guidelines on the diagnosis and treatment of chronic cough in adults and children. Eur Re |
| Post-infectious cough | Cough for 3–8 weeks | 4 | 0.3 | Morice AH et al. ERS guidelines on the diagnosis and treatment of chronic cough in adults and children. Eur Re |
| Post-infectious cough | Dry, tickly cough | 1.5 | — | Morice AH et al. BTS guidelines: recommendations for the management of cough in adults. Thorax 2006;61 Suppl 1 |
| Post-infectious cough | Fever | 0.3 | — | Morice AH et al. BTS guidelines: recommendations for the management of cough in adults. Thorax 2006;61 Suppl 1 |
| Post-infectious cough | Haemoptysis | 0.2 | — | NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023), lung and pleural cancers |
| Post-infectious cough | Cough began with a respiratory infection | 5 | 0.2 | Morice AH et al. BTS guidelines: recommendations for the management of cough in adults. Thorax 2006;61 Suppl 1 |
| Post-infectious cough | Unintentional weight loss | 0.2 | — | Morice AH et al. BTS guidelines: recommendations for the management of cough in adults. Thorax 2006;61 Suppl 1 |
| Post-infectious cough | Chest X-ray normal | 1.5 | — | Morice AH et al. BTS guidelines: recommendations for the management of cough in adults. Thorax 2006;61 Suppl 1 |
| Asthma (including cough-variant asthma) | Age 50 or over | 0.6 | — | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma m |
| Asthma (including cough-variant asthma) | Atopy (asthma, eczema, hay fever) | 2 | 0.7 | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma m |
| Asthma (including cough-variant asthma) | Cough for more than 8 weeks | 1.5 | — | Morice AH et al. ERS guidelines on the diagnosis and treatment of chronic cough in adults and children. Eur Re |
| Asthma (including cough-variant asthma) | Dry, tickly cough | 1.5 | — | Morice AH et al. ERS guidelines on the diagnosis and treatment of chronic cough in adults and children. Eur Re |
| Asthma (including cough-variant asthma) | Fever | 0.3 | — | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma m |
| Asthma (including cough-variant asthma) | Known asthma | 5 | — | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma m |
| Asthma (including cough-variant asthma) | Cough at night or early morning | 2.5 | 0.6 | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma m |
| Asthma (including cough-variant asthma) | Smoker | 0.7 | — | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma m |
| Asthma (including cough-variant asthma) | Symptoms vary, with triggers (cold air, exercise, allergens) | 3 | 0.4 | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma m |
| Asthma (including cough-variant asthma) | Wheeze | 3 | 0.5 | Levy ML et al. Asthma diagnosis (Thorax 2003); Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Ast |
| Asthma (including cough-variant asthma) | Wheeze on auscultation | 2.6 | — | Holleman DR, Simel DL. Does the clinical examination predict airflow limitation? JAMA 1995;273:313-9 |
| Asthma (including cough-variant asthma) | Blood eosinophils raised | 2 | — | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma m |
| Asthma (including cough-variant asthma) | FeNO raised (40 ppb or more) | 3.5 | 0.4 | Global Initiative for Asthma (GINA) 2024 report; NICE NG245 Asthma: diagnosis, monitoring and chronic asthma m |
| COPD (stable) / chronic bronchitis | Age 40 or over | 3 | — | Global Initiative for Chronic Obstructive Lung Disease (GOLD) 2025 report |
| COPD (stable) / chronic bronchitis | Cough for under 3 weeks | 0.3 | — | Global Initiative for Chronic Obstructive Lung Disease (GOLD) 2025 report |
| COPD (stable) / chronic bronchitis | Cough for more than 8 weeks | 2 | — | Global Initiative for Chronic Obstructive Lung Disease (GOLD) 2025 report |
| COPD (stable) / chronic bronchitis | Breathlessness on exertion (MRC 2 or more) | 2.5 | 0.4 | Global Initiative for Chronic Obstructive Lung Disease (GOLD) 2025 report |
| COPD (stable) / chronic bronchitis | Fever | 0.4 | — | Global Initiative for Chronic Obstructive Lung Disease (GOLD) 2025 report |
| COPD (stable) / chronic bronchitis | Known COPD | 8 | — | Global Initiative for Chronic Obstructive Lung Disease (GOLD) 2025 report |
| COPD (stable) / chronic bronchitis | Productive cough (sputum) | 2 | 0.6 | Global Initiative for Chronic Obstructive Lung Disease (GOLD) 2025 report |
| COPD (stable) / chronic bronchitis | Smoker | 3.5 | 0.3 | Holleman DR, Simel DL. Does the clinical examination predict airflow limitation? JAMA 1995;273:313-9 (≥ 40 pac |
| COPD (stable) / chronic bronchitis | Wheeze | 2 | — | Holleman DR, Simel DL. Does the clinical examination predict airflow limitation? JAMA 1995;273:313-9 |
| COPD (stable) / chronic bronchitis | Hyperinflated chest, pursed-lip breathing | 3 | — | Holleman DR, Simel DL. Does the clinical examination predict airflow limitation? JAMA 1995;273:313-9 |
| COPD (stable) / chronic bronchitis | Prolonged expiration or poor air entry | 2.5 | — | Holleman DR, Simel DL. Does the clinical examination predict airflow limitation? JAMA 1995;273:313-9 |
| ACE-inhibitor cough | ACE inhibitor / ARB use | 8 | 0.05 | Dicpinigaitis PV. Angiotensin-converting enzyme inhibitor-induced cough: ACCP evidence-based clinical practice |
| ACE-inhibitor cough | Cough began after an ACE inhibitor was started | 10 | 0.3 | Dicpinigaitis PV. Angiotensin-converting enzyme inhibitor-induced cough: ACCP evidence-based clinical practice |
| ACE-inhibitor cough | Cough for more than 8 weeks | 1.5 | — | Morice AH et al. ERS guidelines on the diagnosis and treatment of chronic cough in adults and children. Eur Re |
| ACE-inhibitor cough | Dry, tickly cough | 2 | 0.3 | Dicpinigaitis PV. Angiotensin-converting enzyme inhibitor-induced cough: ACCP evidence-based clinical practice |
| ACE-inhibitor cough | Fever | 0.2 | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| ACE-inhibitor cough | Haemoptysis | 0.2 | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| ACE-inhibitor cough | Productive cough (sputum) | 0.3 | — | Dicpinigaitis PV. Angiotensin-converting enzyme inhibitor-induced cough: ACCP evidence-based clinical practice |
| ACE-inhibitor cough | Unintentional weight loss | 0.3 | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| ACE-inhibitor cough | Chest X-ray normal | 1.5 | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| Upper airway cough syndrome (rhinosinusitis / post-nasal drip) | Cough for more than 8 weeks | 1.5 | — | Morice AH et al. ERS guidelines on the diagnosis and treatment of chronic cough in adults and children. Eur Re |
| Upper airway cough syndrome (rhinosinusitis / post-nasal drip) | Dry, tickly cough | 1.2 | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| Upper airway cough syndrome (rhinosinusitis / post-nasal drip) | Fever | 0.4 | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| Upper airway cough syndrome (rhinosinusitis / post-nasal drip) | Haemoptysis | 0.2 | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| Upper airway cough syndrome (rhinosinusitis / post-nasal drip) | Nasal blockage or discharge, rhinitis | 2.5 | 0.6 | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| Upper airway cough syndrome (rhinosinusitis / post-nasal drip) | Post-nasal drip, throat clearing | 3 | 0.5 | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| Upper airway cough syndrome (rhinosinusitis / post-nasal drip) | Worse lying flat | 1.5 | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| Upper airway cough syndrome (rhinosinusitis / post-nasal drip) | Cobblestone posterior pharynx / mucus on the pharyngeal wall | 2 | — | Irwin RS et al. Diagnosis and management of cough executive summary: ACCP evidence-based clinical practice gui |
| Bronchiectasis | Severe childhood chest infection (pertussis, measles, TB) | 3 | — | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 |
| Bronchiectasis | Copious purulent sputum every day | 5 | 0.3 | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 |
| Bronchiectasis | Cough for more than 8 weeks | 2 | 0.3 | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 |
| Bronchiectasis | Haemoptysis | 2 | — | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 |
| Bronchiectasis | Productive cough (sputum) | 3 | 0.2 | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 |
| Bronchiectasis | Purulent (green / yellow) sputum | 2 | — | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 |
| Bronchiectasis | Recurrent chest infections | 4 | 0.4 | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 |
| Bronchiectasis | Finger clubbing | 2 | — | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 |
| Bronchiectasis | Coarse inspiratory crackles | 3 | — | Hill AT et al. British Thoracic Society guideline for bronchiectasis in adults. Thorax 2019;74 Suppl 1:1-69 |
| Pulmonary tuberculosis | Cough for under 3 weeks | 0.4 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | Cough for more than 8 weeks | 2 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | Cough for 3–8 weeks | 1.5 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | Fever | 2 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | Haemoptysis | 3 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | HIV infection | 4 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | Immunosuppression (HIV, steroids, transplant, chemotherapy) | 2.5 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | Night sweats | 3 | 0.6 | Wisnivesky JP et al. Evaluation of clinical parameters to predict Mycobacterium tuberculosis in inpatients. Ar |
| Pulmonary tuberculosis | TB contact, incarceration, HIV or travel to a high-TB area | 4 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | Unintentional weight loss | 2.5 | 0.6 | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | Chest X-ray normal | 0.2 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Pulmonary tuberculosis | Upper-lobe infiltrate or cavitation | 10 | — | NICE NG33 Tuberculosis (2016, updated 2024); WHO consolidated guidelines on tuberculosis, module 3: diagnosis  |
| Lung cancer | Age 40 or over | 3 | — | NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023), lung and pleural cancers |
| Lung cancer | Chest pain | 1.5 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Lung cancer | Cough for more than 8 weeks | 1.5 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Lung cancer | Breathlessness | 1.3 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Lung cancer | Significant fatigue | 1.3 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Lung cancer | Haemoptysis | 4 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Lung cancer | Hoarseness / voice change | 3 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Lung cancer | Smoker | 3 | 0.3 | Aberle DR et al. NLST. N Engl J Med 2011; Hamilton W et al. What are the clinical features of lung cancer befo |
| Lung cancer | Unintentional weight loss | 2.5 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Lung cancer | Finger clubbing | 3 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Lung cancer | Anaemia (low haemoglobin) | 1.3 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Lung cancer | Chest X-ray normal | 0.2 | — | NICE NG12 Suspected cancer: recognition and referral (2015, updated 2023), lung and pleural cancers (chest X-r |
| Lung cancer | D-dimer raised | 1.5 | — | Cancer-associated D-dimer rise (ESC 2019 PE guideline) |
| Lung cancer | Adjusted calcium > 2.6 mmol/L | 2 | — | Hamilton W et al. What are the clinical features of lung cancer before the diagnosis is made? A population bas |
| Pulmonary nodule (incidental) | Lung mass or nodule on chest X-ray or CT | 3 | — | Callister MEJ et al. British Thoracic Society guidelines for the investigation and management of pulmonary nod |
| Pulmonary nodule (incidental) | Solid pulmonary nodule 8 mm or more | 15 | — | Callister MEJ et al. British Thoracic Society guidelines for the investigation and management of pulmonary nod |
| Pulmonary nodule (incidental) | Solid pulmonary nodule under 8 mm | 30 | — | Callister MEJ et al. British Thoracic Society guidelines for the investigation and management of pulmonary nod |
| Thyroid nodule (incidental on CT / MRI / PET) | Thyroid nodule seen on CT, MRI or PET | 30 | — | Tessler FN et al. ACR Thyroid Imaging, Reporting and Data System (TI-RADS): white paper of the ACR TI-RADS com |
| Acute Heart Failure / Pulmonary Oedema | Breathlessness on exertion (MRC 2 or more) | 2 | 0.5 | Wang CS et al. Does this dyspneic patient in the emergency department have congestive heart failure? JAMA 2005 |
| Acute Heart Failure / Pulmonary Oedema | Cough at night or early morning | 1.5 | — | McKee PA et al. The natural history of congestive heart failure: the Framingham study. N Engl J Med 1971;285:1 |
| Acute Heart Failure / Pulmonary Oedema | NT-proBNP / BNP raised | 2.7 | 0.1 | Roberts E et al. The diagnostic accuracy of the natriuretic peptides in heart failure: systematic review and d |
| Acute Heart Failure / Pulmonary Oedema | Thick-walled gallbladder on ultrasound | 2 | — | Congestive hepatopathy and gallbladder wall oedema in heart failure (expert estimate) |
| Pneumothorax (spontaneous) | Breathlessness | 3 | 0.3 | Roberts ME et al. British Thoracic Society guideline for pleural disease. Thorax 2023;78 Suppl 3:s1-s42 |
| Pneumothorax (spontaneous) | Fever | 0.4 | — | Roberts ME et al. British Thoracic Society guideline for pleural disease. Thorax 2023;78 Suppl 3:s1-s42 |
| Pneumothorax (spontaneous) | Known COPD | 2 | — | Roberts ME et al. British Thoracic Society guideline for pleural disease. Thorax 2023;78 Suppl 3:s1-s42 (secon |
| Pneumothorax (spontaneous) | Productive cough (sputum) | 0.5 | — | Roberts ME et al. British Thoracic Society guideline for pleural disease. Thorax 2023;78 Suppl 3:s1-s42 |
| Pneumothorax (spontaneous) | Smoker | 2 | — | Roberts ME et al. British Thoracic Society guideline for pleural disease. Thorax 2023;78 Suppl 3:s1-s42 (smoki |
| Acute Coronary Syndrome (STEMI / NSTEMI / Unstable Angina) | D-dimer raised | 1.2 | — | Non-specific D-dimer rise (ESC 2019 PE guideline) |
| Iron-deficiency anaemia | Breathlessness on exertion (MRC 2 or more) | 1.5 | — | Snook J et al. British Society of Gastroenterology guidelines for the management of iron deficiency anaemia in |
| Iron-deficiency anaemia | Significant fatigue | 2 | — | Snook J et al. British Society of Gastroenterology guidelines for the management of iron deficiency anaemia in |
| Iron-deficiency anaemia | Fever | 0.4 | — | Snook J et al. British Society of Gastroenterology guidelines for the management of iron deficiency anaemia in |
| Iron-deficiency anaemia | Pallor | 2 | — | Snook J et al. British Society of Gastroenterology guidelines for the management of iron deficiency anaemia in |
| Iron-deficiency anaemia | Microcytosis (MCV under 80 fL) | 3 | 0.4 | Snook J et al. British Society of Gastroenterology guidelines for the management of iron deficiency anaemia in |
| Panic attack / anxiety | Fever | 0.2 | — | NICE CG113 |
| Panic attack / anxiety | Palpitations | 1.5 | — | NICE CG113 |
| Panic attack / anxiety | Sudden onset (seconds to minutes) | 1.3 | — | NICE CG113 |
| Panic attack / anxiety | Lung crackles / crepitations | 0.3 | — | expert estimate |
| Panic attack / anxiety | Hypoxia (SpO₂ < 94 %) | 0.1 | — | Hypoxia excludes hyperventilation as the sole cause (expert estimate) |
| Panic attack / anxiety | Wheeze on auscultation | 0.3 | — | expert estimate |

### H. Seeded ratios (1,500+ links) — reviewed by rule, not one by one

| Seed | Links | Conversion |
|---|---|---|
| pane | 1229 | LR+ = P(f\|D) / PANE base rate, LR− = (1 − P) / (1 − base); range: P ± 0.10 |
| pane+ios | 201 | as pane; the iOS ratio (exp(logLR / 5)) is kept in `seedDetail` for comparison |
| ios | 36 | LR = exp(logLR / 5) (or the curated likelihoodRatio); range ×/÷ 1.5 nominal |
| exam-signs | 104 | reference to clinical-content/rules/exam-signs.json (already on its own sign-off list) |
| decision-rules | 18 | reference to clinical-content/rules/decision-rules.json (already on its own sign-off list) |
| new | 203 | table G |

### I. iOS curated features not carried into the vademecum (88)

Complaint-routing, sign/rule/post-op-day keys are handled elsewhere; these feature rows had no single finding to map to (or duplicate a PANE age / sex modifier). Each needs a decision: map to a new finding, or drop.

- iOS Acute Appendicitis "Appendicitis on ultrasound or CT" (finding appendicolith|dilated appendix|inflamed ): logLR 12 → LR 12
- iOS Acute Cholecystitis "Ultrasound signs of cholecystitis" (finding gallbladder wall thicken|gallbladder&wal): logLR 12 → LR 10
- iOS Acute Cholecystitis "No right upper quadrant or epigastric pain" (notFinding ruq|right upper|epigastr|upper abdominal): logLR -8 → LR 0.2
- iOS Biliary Colic "No right upper quadrant or epigastric pain" (notFinding ruq|right upper|epigastr|upper abdominal): logLR -8 → LR 0.2
- iOS Choledocholithiasis "No jaundice, cholestasis or gallstones" (notFinding jaundice|yellow|icter|bilirubin|dark uri): logLR -6 → LR 0.3
- iOS Acute Pancreatitis "Aetiological factor (gallstones, alcohol, drugs, triglycerides)" (finding alcohol|binge|gallstone|triglycerid|azat): logLR 3 → LR 2
- iOS Acute Pancreatitis "No abdominal pain or pancreatic enzyme rise" (notFinding epigastr|upper abdominal|abdom|tummy|bac): logLR -8 → LR 0.2
- iOS Acute Diverticulitis "CT signs of diverticulitis" (finding pericolic|diverticulitis|sigmoid thicken): logLR 12 → LR 10
- iOS Acute Diverticulitis "Age 50 or over" (age_over 50): logLR 2 → LR 1.5 (PANE age/sex modifiers used instead)
- iOS Small Bowel Obstruction "Obstruction on imaging" (finding dilated small bowel|dilated loops|air-fl): logLR 12 → LR 12
- iOS Small Bowel Obstruction "No vomiting, distension or constipation" (notFinding vomit|distension|distended|bloat|obstruc): logLR -6 → LR 0.3
- iOS Perforated Peptic Ulcer "Pneumoperitoneum" (finding free air|free gas|pneumoperitoneum|subdi): logLR 12 → LR 12
- iOS Perforated Peptic Ulcer "No abdominal pain or peritonism" (notFinding abdom|tummy|belly|epigastr|peritonism|ri): logLR -8 → LR 0.2
- iOS Oesophageal / Gastric Carcinoma "Family history, H. pylori or Barrett's" (finding family history&stomach|family history&ga): logLR 2 → LR 1.5
- iOS Oesophageal / Gastric Carcinoma "Malignant-looking stricture or tumour" (finding malignant stricture|irregular stricture|): logLR 12 → LR 10
- iOS Oesophageal / Gastric Carcinoma "Age 55 or over" (age_over 55): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Oesophageal Perforation (Boerhaave) "Pleural effusion" (finding pleural effusion|hydropneumothorax): logLR 3 → LR 2
- iOS Oesophageal Perforation (Boerhaave) "No chest pain, vomiting or instrumentation" (notFinding chest|epigastr|vomit|retching|surgical e): logLR -8 → LR 0.2
- iOS Colorectal Carcinoma "Family history" (finding family history&bowel cancer|family histo): logLR 3 → LR 2
- iOS Colorectal Carcinoma "Age 50 or over" (age_over 50): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Clostridioides difficile Colitis "C. difficile toxin or pseudomembranes" (finding difficile|c. diff|c diff|cdiff|toxin pos): logLR 14 → LR 15
- iOS Clostridioides difficile Colitis "Age 65 or over" (age_over 65): logLR 2 → LR 1.5 (PANE age/sex modifiers used instead)
- iOS Acute Gastroenteritis "No vomiting or diarrhoea" (notFinding diarrh|vomit|loose|nausea): logLR -6 → LR 0.3
- iOS Obturator Hernia "Thin, frail patient" (finding thin|underweight|frail|cachectic|bmi 1): logLR 3 → LR 2
- iOS Obturator Hernia "Obturator hernia on CT" (finding obturator): logLR 14 → LR 15
- iOS Obturator Hernia "Female sex" (sex_female ): logLR 5 → LR 3 (PANE age/sex modifiers used instead)
- iOS Obturator Hernia "Age 70 or over" (age_over 70): logLR 5 → LR 3 (PANE age/sex modifiers used instead)
- iOS Obturator Hernia "No thigh, knee or groin symptoms" (notFinding thigh|obturator|hernia|groin|howship|rom): logLR -6 → LR 0.3
- iOS Liver Abscess (Pyogenic / Amoebic) "Tender hepatomegaly / intercostal tenderness" (finding hepatomegaly|tender liver|liver tender|i): logLR 5 → LR 3
- iOS Liver Abscess (Pyogenic / Amoebic) "Amoebic risk (dysentery, water exposure)" (finding bloody diarrhoea|dysentery|amoeb|shared ): logLR 3 → LR 2
- iOS Liver Abscess (Pyogenic / Amoebic) "Liver abscess on imaging" (finding liver abscess|hepatic abscess|amoebic ab): logLR 12 → LR 12
- iOS Liver Abscess (Pyogenic / Amoebic) "No fever or right upper quadrant symptoms" (notFinding fever|temperature|rigor|shiver|liver|hep): logLR -6 → LR 0.3
- iOS Pancreatic Carcinoma "Palpable gallbladder" (finding courvoisier|palpable gallbladder): logLR 8 → LR 5
- iOS Pancreatic Carcinoma "Pancreatic mass, double-duct sign or raised CA19-9" (finding pancreatic mass|double duct|head of the ): logLR 12 → LR 10
- iOS Pancreatic Carcinoma "Age 60 or over" (age_over 60): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Symptomatic / Ruptured Abdominal Aortic Aneurysm "First "renal colic" in an older patient" (finding no previous stones|first episode|no hist): logLR 2 → LR 1.5
- iOS Symptomatic / Ruptured Abdominal Aortic Aneurysm "Male sex" (sex_male ): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Symptomatic / Ruptured Abdominal Aortic Aneurysm "Age 60 or over" (age_over 60): logLR 5 → LR 3 (PANE age/sex modifiers used instead)
- iOS Symptomatic / Ruptured Abdominal Aortic Aneurysm "Age under 50" (age_under 50): logLR -12 → LR 0.1 (PANE age/sex modifiers used instead)
- iOS Symptomatic / Ruptured Abdominal Aortic Aneurysm "No abdominal, back or loin pain and no aneurysm" (notFinding abdom|back|loin|flank|groin|pulsatile|an): logLR -6 → LR 0.3
- iOS Acute Mesenteric Ischaemia "Age 60 or over" (age_over 60): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Acute Mesenteric Ischaemia "Age under 40" (age_under 40): logLR -8 → LR 0.2 (PANE age/sex modifiers used instead)
- iOS Acute Mesenteric Ischaemia "Mesenteric occlusion or bowel ischaemia on CT angiography" (finding sma occlusion|mesenteric&occlu|pneumatos): logLR 15 → LR 20
- iOS Acute Mesenteric Ischaemia "Age 75 or over" (age_over 75): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Ectopic Pregnancy "Risk factor (previous ectopic, tubal disease, IVF, IUD/IUS)" (finding previous ectopic|tubal|pid|pelvic inflam): logLR 3 → LR 2
- iOS Ovarian Torsion "Ultrasound signs of torsion" (finding reduced flow|absent flow|no doppler flow): logLR 10 → LR 8
- iOS Pelvic Inflammatory Disease "STI risk" (finding new partner|chlamydia|gonorrh|sti|coil|i): logLR 3 → LR 2
- iOS Pelvic Inflammatory Disease "No pelvic pain, discharge or adnexal signs" (notFinding pelvic|lower abdominal|iliac|suprapubic|): logLR -6 → LR 0.3
- iOS Pelvic Inflammatory Disease "Tubo-ovarian abscess or pyosalpinx on imaging" (finding tubo-ovarian|tuboovarian|pyosalpinx|adne): logLR 12 → LR 10
- iOS Pre-eclampsia / HELLP Syndrome "Hyperreflexia or clonus" (finding clonus|hyperreflexia|brisk reflexes): logLR 5 → LR 3
- iOS Placental Abruption "Risk factor" (finding pre-eclampsia|hypertens|cocaine|smok): logLR 2 → LR 1.5
- iOS Placental Abruption "No abdominal pain, bleeding or trauma in pregnancy" (notFinding abdom|tummy|pain|bleed|tender|uterus|con): logLR -6 → LR 0.3
- iOS Renal / Ureteric Colic "Age over 60 (first colic: consider AAA)" (age_over 60): logLR -2 → LR 0.7 (PANE age/sex modifiers used instead)
- iOS Renal / Ureteric Colic "No loin pain, haematuria or stone history" (notFinding loin|flank|groin|colic|haematuria|blood ): logLR -6 → LR 0.3
- iOS Acute Pyelonephritis "Complicating factor" (finding pregnan|diabet|catheter|stone|obstruct): logLR 1 → LR 1.3
- iOS Urinary Tract Infection (Cystitis) "Female sex" (sex_female ): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Testicular Torsion "Reduced or absent testicular blood flow" (finding reduced flow|absent flow|no flow|whirlpo): logLR 12 → LR 10
- iOS Testicular Torsion "Age under 25" (age_under 25): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Testicular Torsion "No scrotal or groin symptom recorded" (notFinding testic|testis|testicle|scrot|groin): logLR -6 → LR 0.3
- iOS Anastomotic Leak "Leak, collection or free gas on imaging / drain" (finding anastomotic leak|leak&anastomo|extralumi): logLR 12 → LR 10
- iOS Sepsis "No sign of infection or organ dysfunction recorded" (notFinding fever|temperature|pyrex|rigor|shiver|inf): logLR -5 → LR 0.4
- iOS Diabetic Ketoacidosis "No diabetes, ketones or hyperglycaemia recorded" (notFinding diabet|ketone|ketotic|ketoacid|insulin|e): logLR -6 → LR 0.3
- iOS Intussusception "Target sign on ultrasound" (finding target sign|target lesion|doughnut|pseud): logLR 15 → LR 20
- iOS Malrotation with Midgut Volvulus "Malrotation or whirlpool sign on imaging" (finding whirlpool|corkscrew|malrotation|abnormal): logLR 14 → LR 15
- iOS Community-Acquired Pneumonia "Egophony" (finding egophony|aegophony): logLR 7 → LR 4
- iOS Community-Acquired Pneumonia "Consolidation on chest imaging" (inv consolidation): logLR 14 → LR 15
- iOS Community-Acquired Pneumonia "No cough, sputum, breathlessness or chest signs" (notFinding cough|sputum|phlegm|breath|dyspn|crackle): logLR -6 → LR 0.3
- iOS Asthma (Acute Exacerbation) "Severity signs recorded" (finding complete sentences|accessory muscle|peak): logLR 2 → LR 1.5
- iOS Asthma (Acute Exacerbation) "No wheeze, breathlessness or cough" (notFinding wheez|breath|dyspn|asthma|chest tight|ti): logLR -8 → LR 0.2
- iOS COPD Exacerbation "Long-term COPD treatment" (finding home oxygen|nebuliser|tiotropium|spiriva): logLR 2 → LR 1.5
- iOS COPD Exacerbation "Age 50 or over" (age_over 50): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS COPD Exacerbation "No COPD, smoking or respiratory symptoms" (notFinding copd|emphysema|chronic bronchitis|chroni): logLR -6 → LR 0.3
- iOS Acute Heart Failure / Pulmonary Oedema "Third heart sound" (finding s3|third heart sound|gallop): logLR 12 → LR 11
- iOS Acute Heart Failure / Pulmonary Oedema "Age 65 or over" (age_over 65): logLR 2 → LR 1.5 (PANE age/sex modifiers used instead)
- iOS Acute Heart Failure / Pulmonary Oedema "No breathlessness, oedema or crackles" (notFinding breath|dyspn|orthopn|oedema|swollen ankl): logLR -8 → LR 0.2
- iOS Pulmonary Embolism "Previous venous thromboembolism" (finding previous dvt|previous pe|prior dvt|prior): logLR 3 → LR 1.7
- iOS Pulmonary Embolism "CTPA filling defect" (inv ctpa filling defect): logLR 17 → LR 30
- iOS Pulmonary Embolism "No breathlessness, chest pain, syncope or hypoxaemia" (notFinding breath|dyspn|sob|chest|haemoptysis|colla): logLR -8 → LR 0.2
- iOS Pulmonary Embolism "Right ventricular dilatation or dysfunction on echocardiography or CT" (finding rv dilat|rv dysfunction|rv strain|rv:lv|): logLR 5 → LR 3
- iOS Pulmonary Embolism "Loud P2, or raised JVP with hypotension or clear lungs (right heart strain)" (finding loud p2|jvp&raised&bp|jvp&raised&hypoten): logLR 3 → LR 2
- iOS Pneumothorax "Risk factor for pneumothorax" (finding previous pneumothorax|copd|emphysema|can): logLR 2 → LR 1.5
- iOS Pneumothorax "Pneumothorax on imaging" (inv pneumothorax): logLR 15 → LR 20
- iOS Acute Coronary Syndrome "Age 50 or over" (age_over 50): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Acute Coronary Syndrome "No chest, arm, jaw, epigastric or breathing symptom" (notFinding chest|arm pain|jaw|epigastr|indigestion|): logLR -6 → LR 0.3
- iOS Acute Coronary Syndrome "Epigastric pain or "indigestion" with sweating (inferior myocardial infarction can present this way)" (finding epigastr&sweat|epigastr&clammy|epigastr&): logLR 3 → LR 2
- iOS Atrial Fibrillation "Thyrotoxicosis" (finding thyrotox|hyperthyroid|graves): logLR 3 → LR 2
- iOS Atrial Fibrillation "Age 65 or over" (age_over 65): logLR 3 → LR 2 (PANE age/sex modifiers used instead)
- iOS Anaphylaxis "No skin, mucosal or airway feature" (notFinding urticaria|hives|rash|flush|itch|angioede): logLR -8 → LR 0.2

## Not done / follow-ups

- The iOS shadow is the TypeScript loop fed what the iPad records ("iOS-equivalent"); the Swift loop and
  an on-device shadow are phase 2.
- Two can't-miss expectations only the iOS engine captured (see the phase-1 report) and the remaining
  top-1 differences are listed there for the next content pass.
- Nothing is shown in the UI; the generators are exercised by tests and the shadow only.

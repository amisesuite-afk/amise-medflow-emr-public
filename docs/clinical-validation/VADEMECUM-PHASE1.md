# Vademecum phase 1 — shadow comparison (abdominal pain; cough / breathlessness)

2026-09-26, branch `vademecum-phase1`, vademecum 0.1.0 (**shadow; every value unreviewed**). Reproduce with
`pnpm --filter @workspace/scripts run clinval:web -- --engine vademecum` (about 15 minutes with the
simulated consultations; `--no-questions` takes seconds). Plan: `docs/VADEMECUM-PLAN.md`. Change log and
sign-off list: `docs/clinical-validation/changes/vademecum-phase1.md`.

## Bottom line

| Switching criterion (per area) | Abdominal pain | Cough / breathlessness |
|---|---|---|
| At least as accurate as the current engines (top-1 / top-3, web) | **Met on the web evidence**: top-1 84/95 vs PANE 82/95, top-3 94/95 vs 91/95. The iOS-equivalent run (77/95, 91/95) is below PANE and similar to the iOS engine (75/93, 87/93) | **Top-3 met, top-1 equal on the web** (13/16 both; top-3 15/16 vs 13/16). The iOS-equivalent run (11/16) is below the iOS engine (13/14) |
| Zero lost can't-miss | **Not met**: 2 can't-miss expectations captured only by the iOS engine (below) | **Met** (24/24 vs PANE 23/24, iOS 21/22) |
| No more questions to threshold | **Not met with the safe stop rule** (median 13 vs 8); met with the first stop rule (median 4 vs 8) — see "Questions" | Not met (median 15 vs 8), although the vademecum ends with the target first far more often (14/16 vs 1/16) |

**Recommendation: do not switch.** Keep the vademecum in shadow, fix the two lost can't-miss cases and the
level-advance rule (below), get the values signed off, then repeat this comparison, including an
on-device iOS run of a Swift twin (phase 2).

## Method

- **Pilot vignettes**: every clinical-validation vignette whose chief complaint maps to a pilot area (area
  keywords at word starts, or its history frame from `classifyComplaint`), plus the vignettes tagged
  `entry:lab | imaging | pathology`: 209 vignettes (178 abdominal, 31 cough / breathlessness), 111 with a
  `mustRankTopK` target; all 111 targets are diagnoses the vademecum holds.
- **Engines on the same record**: PANE as the dashboard runs it (`web-runner.ts`: feature mapper, then
  `topDiagnoses`, here top 5); the iOS Bayesian engine from the committed CI results
  (`docs/clinical-validation/results/ios-latest.jsonl`, a real simulator run; it does not include the five
  new entry-point vignettes); the vademecum hybrid and Bayesian-only layers fed the web's evidence (the
  PANE feature mapper through each finding's `pane` id, the record text for findings PANE has no feature
  for, structured labs through the reference ranges, report text by kind, Exam-step signs, recorded
  scores, the TG18 auto-fill and NG12 screening as external criteria); and the vademecum fed what the
  iPad records (text only, no PANE mapper; "iOS-equivalent" — there is no TypeScript port of the iOS
  engine, so this is not the iOS engine).
- **Grading**: top-k = rank of the vignette's first `mustRankTopK` target in the five shown; "mustRankTopK
  passed" at each expectation's own k; can't-miss = `mustNotMiss` expectations in the five shown.
- **Questions to threshold**: a simulated consultation from the chief complaint (or the entry result). The
  vademecum loop and PANE's own loop (`nextBestQuestion`: stop at 0.85 or 8 questions) are both answered
  from the vignette record; a history or examination item the record does not mention is answered
  "absent", an investigation "not known" (it still counts as a question). The vademecum stops at the
  decision thresholds or 15 questions.

## Results

### Accuracy by area

**all** (209 vignettes; 111 with a mustRankTopK target)

| Engine | Top-1 | Top-3 | Top-5 | mustRankTopK passed | Can't-miss captured |
|---|---|---|---|---|---|
| PANE (web, current) | 95/111 (86 %) | 104/111 (94 %) | 107/111 (96 %) | 105/115 (91 %) | 83/94 (88 %) |
| iOS Bayes (CI run) | 88/107 (82 %) | 101/107 (94 %) | 101/107 (94 %) | 104/111 (94 %) | 75/90 (83 %) |
| Vademecum hybrid (web evidence) | 97/111 (87 %) | 109/111 (98 %) | 109/111 (98 %) | 112/115 (97 %) | 87/94 (93 %) |
| Vademecum Bayesian only | 96/111 (86 %) | 109/111 (98 %) | 109/111 (98 %) | 112/115 (97 %) | 87/94 (93 %) |
| Vademecum hybrid (iOS-equivalent evidence) | 88/111 (79 %) | 104/111 (94 %) | 107/111 (96 %) | 107/115 (93 %) | 80/94 (85 %) |

**area:abdominal-pain** (178 vignettes; 95 with a mustRankTopK target)

| Engine | Top-1 | Top-3 | Top-5 | mustRankTopK passed | Can't-miss captured |
|---|---|---|---|---|---|
| PANE (web, current) | 82/95 (86 %) | 91/95 (96 %) | 94/95 (99 %) | 92/96 (96 %) | 60/70 (86 %) |
| iOS Bayes (CI run) | 75/93 (81 %) | 87/93 (94 %) | 87/93 (94 %) | 88/94 (94 %) | 54/68 (79 %) |
| Vademecum hybrid (web evidence) | 84/95 (88 %) | 94/95 (99 %) | 94/95 (99 %) | 95/96 (99 %) | 63/70 (90 %) |
| Vademecum Bayesian only | 83/95 (87 %) | 94/95 (99 %) | 94/95 (99 %) | 95/96 (99 %) | 63/70 (90 %) |
| Vademecum hybrid (iOS-equivalent evidence) | 77/95 (81 %) | 91/95 (96 %) | 93/95 (98 %) | 92/96 (96 %) | 57/70 (81 %) |

**area:cough-breathlessness** (31 vignettes; 16 with a mustRankTopK target)

| Engine | Top-1 | Top-3 | Top-5 | mustRankTopK passed | Can't-miss captured |
|---|---|---|---|---|---|
| PANE (web, current) | 13/16 (81 %) | 13/16 (81 %) | 13/16 (81 %) | 13/19 (68 %) | 23/24 (96 %) |
| iOS Bayes (CI run) | 13/14 (93 %) | 14/14 (100 %) | 14/14 (100 %) | 16/17 (94 %) | 21/22 (95 %) |
| Vademecum hybrid (web evidence) | 13/16 (81 %) | 15/16 (94 %) | 15/16 (94 %) | 17/19 (89 %) | 24/24 (100 %) |
| Vademecum Bayesian only | 13/16 (81 %) | 15/16 (94 %) | 15/16 (94 %) | 17/19 (89 %) | 24/24 (100 %) |
| Vademecum hybrid (iOS-equivalent evidence) | 11/16 (69 %) | 13/16 (81 %) | 14/16 (88 %) | 15/19 (79 %) | 23/24 (96 %) |

### Accuracy by entry point

**entry:complaint** (203 vignettes)

| Engine | Top-1 | Top-3 | Top-5 | mustRankTopK passed | Can't-miss captured |
|---|---|---|---|---|---|
| PANE (web, current) | 93/107 (87 %) | 102/107 (95 %) | 105/107 (98 %) | 103/111 (93 %) | 80/90 (89 %) |
| iOS Bayes (CI run) | 88/107 (82 %) | 101/107 (94 %) | 101/107 (94 %) | 104/111 (94 %) | 75/90 (83 %) |
| Vademecum hybrid (web evidence) | 94/107 (88 %) | 105/107 (98 %) | 105/107 (98 %) | 108/111 (97 %) | 83/90 (92 %) |
| Vademecum Bayesian only | 93/107 (87 %) | 105/107 (98 %) | 105/107 (98 %) | 108/111 (97 %) | 83/90 (92 %) |
| Vademecum hybrid (iOS-equivalent evidence) | 84/107 (79 %) | 100/107 (93 %) | 103/107 (96 %) | 103/111 (93 %) | 76/90 (84 %) |

**entry:lab** (2 vignettes)

| Engine | Top-1 | Top-3 | Top-5 | mustRankTopK passed | Can't-miss captured |
|---|---|---|---|---|---|
| PANE (web, current) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) |
| Vademecum hybrid (web evidence) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) |
| Vademecum Bayesian only | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) |
| Vademecum hybrid (iOS-equivalent evidence) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) |

**entry:imaging** (3 vignettes)

| Engine | Top-1 | Top-3 | Top-5 | mustRankTopK passed | Can't-miss captured |
|---|---|---|---|---|---|
| PANE (web, current) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 1/2 (50 %) |
| iOS Bayes (CI run) | — | — | — | — | — |
| Vademecum hybrid (web evidence) | 0/1 (0 %) | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | 2/2 (100 %) |
| Vademecum Bayesian only | 0/1 (0 %) | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | 2/2 (100 %) |
| Vademecum hybrid (iOS-equivalent evidence) | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | 2/2 (100 %) |

**entry:pathology** (1 vignettes)

| Engine | Top-1 | Top-3 | Top-5 | mustRankTopK passed | Can't-miss captured |
|---|---|---|---|---|---|
| PANE (web, current) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | — |
| Vademecum hybrid (web evidence) | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | — |
| Vademecum Bayesian only | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | — |
| Vademecum hybrid (iOS-equivalent evidence) | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | 1/1 (100 %) | — |

### Questions to threshold (simulated consultation, vignettes with a target)

| Group | n | Vademecum questions mean / median | Vademecum stopped at a threshold | Vademecum target first at stop | PANE questions mean / median | PANE converged | PANE target first at stop | Both stopped at threshold: n, vademecum vs PANE mean / median |
|---|---|---|---|---|---|---|---|---|
| all | 111 | 9.8 / 13 | 61/111 (55 %) | 81/111 (73 %) | 6.8 / 8 | 42/111 (38 %) | 50/111 (45 %) | 26: 4.4 / 2.5 vs 4.4 / 4.5 |
| area:abdominal-pain | 95 | 9.5 / 13 | 54/95 (57 %) | 67/95 (71 %) | 6.7 / 8 | 40/95 (42 %) | 49/95 (52 %) | 24: 4.2 / 2 vs 4.3 / 4.5 |
| area:cough-breathlessness | 16 | 11.4 / 15 | 7/16 (44 %) | 14/16 (88 %) | 7.7 / 8 | 2/16 (12 %) | 1/16 (6 %) | 2: 6.5 / 6.5 vs 5.5 / 5.5 |
| entry:complaint | 107 | 9.9 / 13 | 59/107 (55 %) | 77/107 (72 %) | 6.8 / 8 | 41/107 (38 %) | 49/107 (46 %) | 25: 4.6 / 3 vs 4.5 / 5 |
| entry:lab | 2 | 8.0 / 8 | 1/2 (50 %) | 2/2 (100 %) | 4.5 / 4.5 | 1/2 (50 %) | 1/2 (50 %) | 1: 1.0 / 1 vs 1.0 / 1 |
| entry:imaging | 1 | 15.0 / 15 | 0/1 (0 %) | 1/1 (100 %) | 8.0 / 8 | 0/1 (0 %) | 0/1 (0 %) | 0: — vs — |
| entry:pathology | 1 | 0.0 / 0 | 1/1 (100 %) | 1/1 (100 %) | 8.0 / 8 | 0/1 (0 %) | 0/1 (0 %) | 0: — vs — |


The table above uses the committed stop rule (a treat-threshold stop waits until no other can't-miss
candidate is at or above its test threshold). The first full run, with the plain rule (stop when the
leader reaches its treat threshold), gave:

| Group | n | Vademecum questions mean / median | Vademecum stopped at a threshold | Vademecum target first at stop | PANE questions mean / median | PANE converged | PANE target first at stop | Both stopped at threshold: n, vademecum vs PANE mean / median |
|---|---|---|---|---|---|---|---|---|
| all | 111 | 7.2 / 6 | 80/111 (72 %) | 78/111 (70 %) | 6.8 / 8 | 42/111 (38 %) | 50/111 (45 %) | 36: 2.8 / 1 vs 4.7 / 5 |
| area:abdominal-pain | 95 | 7.1 / 4 | 68/95 (72 %) | 63/95 (66 %) | 6.7 / 8 | 40/95 (42 %) | 49/95 (52 %) | 34: 2.6 / 1 vs 4.6 / 5 |
| area:cough-breathlessness | 16 | 8.0 / 6.5 | 12/16 (75 %) | 15/16 (94 %) | 7.7 / 8 | 2/16 (12 %) | 1/16 (6 %) | 2: 6.0 / 6 vs 5.5 / 5.5 |
| entry:complaint | 107 | 7.2 / 6 | 77/107 (72 %) | 74/107 (69 %) | 6.8 / 8 | 41/107 (38 %) | 49/107 (46 %) | 35: 2.8 / 1 vs 4.8 / 5 |

Reading: with the plain rule the vademecum needs fewer questions than PANE (median 6 vs 8; where both
stop at a threshold, 2.8 vs 4.7) and ends with the target first more often (70 % vs 45 %). But it stopped
at "cholecystitis" after one question on the thick-walled gallbladder with gallbladder carcinoma still in
its test band. The safe rule fixes that and raises target-first-at-stop to 73 %, at the cost of
questions: the can't-miss test threshold (2 %) keeps some can't-miss diagnosis open in most acute
cases, and the loop keeps asking history questions that still flip a can't-miss band instead of moving
on to the examination and investigations that would settle it (the simulated patient cannot order the
CT). **Next step**: advance a level when the remaining questions at the current level can only move a
can't-miss diagnosis whose deciding test sits at a later level (its criteria or pathognomonic finding is
an investigation), and count "order the deciding test" as the stop for a can't-miss band.

### Lost can't-miss (captured by a current engine, not by the vademecum)

- appendicitis-antibiotics-first-coda / mnm-gynaecological (captured by ios.bayes)
- appendicitis-pregnant-t2 / mnm-pyelonephritis (captured by ios.bayes)

### Hybrid vs Bayesian only: where criteria, confirmatory findings or exclusions changed the answer

- exam-murphy-negative-elderly-cholecystitis: leader Acute Cholangitis → Acute Cholecystitis; target rank 2 → 1
  - Acute Cholecystitis: Meets TG18 acute cholecystitis diagnostic criteria: Definite (A + B + C imaging) (Yokoe M et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholecyst
  - Acute Cholecystitis: Confirmatory finding: Ultrasound signs of acute cholecystitis

### Vignettes where the vademecum ranks the target lower than PANE

- exam-carnett-abdominal-wall-pain: PANE 1, vademecum 2 — vademecum top: 1. Acute Gastroenteritis / Infective Colitis 11%
- groin-mimic-testicular-torsion: PANE 1, vademecum 2 — vademecum top: 1. Incarcerated / Strangulated Hernia (Groin, Umbilical or Incisional) 52%
- gyn-ovarian-torsion-dermoid: PANE 2, vademecum 3 — vademecum top: 1. Ovarian Cyst (incl. Haemorrhagic / Ruptured Corpus Luteum) 87%
- gyn-ovarian-torsion-premenarchal-11: PANE 4, vademecum not shown — vademecum top: 1. Acute Appendicitis 39%
- ischaemic-colitis-left: PANE 1, vademecum 2 — vademecum top: 1. Ulcerative Colitis 82%
- ppu-elderly-steroids-masked: PANE 1, vademecum 3 — vademecum top: 1. Sepsis / Septic Shock (source not yet identified; incl. neutropenic sepsis) 97%
- ppu-septic-shock-delayed: PANE 1, vademecum 2 — vademecum top: 1. Sepsis / Septic Shock (source not yet identified; incl. neutropenic sepsis) 100%

### Vignettes where the vademecum ranks the target higher than PANE

- crohns-ileocaecal-abscess: PANE 4, vademecum 1
- diverticulitis-immunosuppressed: PANE 2, vademecum 1
- entry-imaging-cxr-mass: PANE not shown, vademecum 3
- entry-pathology-adenoma-histology: PANE not shown, vademecum 1
- hpi-frame-cough-haemoptysis-smoker: PANE not shown, vademecum 3
- obs-appendicitis-pregnancy-t3: PANE 2, vademecum 1
- pancreatitis-gallstone-cholangitis: PANE 4, vademecum 1
- pancreatitis-severe-organ-failure: PANE 2, vademecum 1
- sbo-strangulation: PANE 3, vademecum 1

### Entry-point vignettes

- **biliary-colic-asymptomatic-incidental-gallstones** (imaging; 96 candidates): vademecum 1. Urinary Tract Infection (Cystitis / UTI) 20%; 2. Biliary Colic / Symptomatic Cholelithiasis 16%; 3. Acute Cholecystitis 16%; PANE 1. Urinary Tract Infection (Cystitis / UTI) 22%; 2. Acute Cholecystitis 18%; 3. Renal Colic / Urolithiasis 11%
  - loop: 15 questions, stop question-cap; first questions ruq_pain=no, epigastric_pain=no, fever=no, pr_bleeding=no, dysuria=no, nausea_vomiting=no
- **entry-imaging-cxr-mass** (imaging; 33 candidates): vademecum 1. Community-acquired Pneumonia (Adult / Child) 48%; 2. COPD Exacerbation (Chronic Obstructive Pulmonary Disease) 24%; 3. Lung cancer 16%; PANE 1. Inguinal / Femoral Hernia 97%; 2. Femoral Hernia 2%; 3. Incisional Hernia 1%
  - loop: 15 questions, stop question-cap; first questions dyspnoea=no, heartburn=no, chest_pain=no, cough=yes, cough_acute=no, fever=no
  - criteria: Lung cancer: Meets NICE NG12 lung cancer referral criteria: Suspected cancer pathway: chest X-ray suggests lung cancer, or ≥ 40 with unexplained haemoptysis (NG12 1.1.1) (NICE NG12
- **entry-imaging-thick-walled-gallbladder** (imaging; 93 candidates): vademecum 1. Biliary Colic / Symptomatic Cholelithiasis 43%; 2. Acute Cholecystitis 31%; 3. Gallbladder Carcinoma 20%; PANE 1. Biliary Colic / Symptomatic Cholelithiasis 53%; 2. Acute Cholecystitis 38%; 3. Choledocholithiasis 5%
  - loop: 15 questions, stop question-cap; first questions ruq_pain=yes, fever=no, episodic_pain=no, weight_loss=yes, anorexia=no, fatty_food_trigger=no
  - criteria: Colorectal Cancer: Meets NICE NG12 colorectal referral criteria: Meets NG12 suspected colorectal cancer criteria (or FIT ≥ 10) (NICE NG12 Suspected cancer: recognition and referral
  - criteria: Pancreatic Carcinoma: Meets NICE NG12 pancreatic cancer referral criteria: Meets NG12 criteria (≥ 40 with jaundice; or ≥ 60 with weight loss and another symptom) (NICE NG12 Suspect
- **entry-lab-raised-d-dimer** (lab; 34 candidates): vademecum 1. Pulmonary Embolism 73%; 2. Community-acquired Pneumonia (Adult / Child) 11%; 3. Acute Heart Failure / Pulmonary Oedema 5%; PANE 1. Pulmonary Embolism 62%; 2. Community-acquired Pneumonia (Adult / Child) 32%; 3. Oesophageal Perforation (Boerhaave) 4%
  - loop: 15 questions, stop question-cap; first questions dyspnoea=yes, wheeze=no, cough=no, trauma_mechanism=no, chest_pain=yes, radiation_arm_jaw=no
  - criteria: Lung cancer: Meets NICE NG12 lung cancer referral criteria: Urgent chest X-ray: ≥ 40 with 2 or more unexplained symptoms, or 1 if ever smoked (NG12 1.1.3); only when the symptoms a
- **entry-lab-raised-lipase-vague-epigastric** (lab; 86 candidates): vademecum 1. Acute Pancreatitis 100%; 2. Acute Cholecystitis 0%; 3. Oesophageal Perforation (Boerhaave) 0%; PANE 1. Acute Pancreatitis 100%; 2. Acute Cholecystitis 0%; 3. Oesophageal Perforation (Boerhaave) 0%
  - loop: 1 questions, stop treat-threshold; first questions epigastric_pain=yes
  - criteria: Acute Pancreatitis: Meets Revised Atlanta 2012 (2 of 3): 2 of 3: typical pain, lipase / amylase ≥ 3 × ULN, imaging (Banks PA et al. Classification of acute pancreatitis 2012: revis
- **entry-pathology-adenoma-histology** (pathology; 2 candidates): vademecum 1. Colorectal adenoma (polyp with dysplasia) 96%; 2. Colorectal Cancer 4%; PANE 1. Acute Gastroenteritis / Infective Colitis 19%; 2. Colorectal Cancer 8%; 3. Acute Diverticulitis 5%
  - loop: 0 questions, stop treat-threshold; first questions —
  - incidental work-up: Colorectal adenoma (polyp with dysplasia): Confirm the colonoscopy was complete and the polyp fully excised (piecemeal ≥ 20 mm: site check at 2–6 months); Surveillance colonoscopy at 3 years; High-grade dysplasia or an i
  - final-diagnosis prompt: Histology: colorectal adenoma → colorectal_adenoma (D12.6, histology)

## What the hybrid layer did

- On the complaint vignettes the hybrid and Bayesian-only layers rank almost identically (top-1 97 vs
  96 of 111; one vignette changed: TG18 definite criteria plus the confirmatory ultrasound put
  cholecystitis above cholangitis in `exam-murphy-negative-elderly-cholecystitis`). That is by design
  after the calibration fixes: a criteria floor now applies only when the rest of the record makes the
  diagnosis plausible (posterior ≥ 1 %).
- Before the plausibility gate (first shadow runs), criteria floors changed the answer in 24 vignettes,
  mostly for the worse: TG18 "suspected" (A + B: RUQ pain with fever or a raised WBC) promoted
  cholecystitis over a liver abscess and a right-lower-lobe pneumonia; the dashboard TG18 auto-fill
  returned "definite" cholecystitis for an MRI of an inflamed appendix and for a liver-abscess
  ultrasound; a qSOFA floor put "sepsis, source not identified" above perforated ulcers; NG12 floors
  pushed colorectal cancer into acute colitis lists. These are now conflict records (visible, not
  promoted), Sepsis-3 qSOFA is a severity screen, and NG12 sets the test band without moving the rank.
- Exclusions work as intended once previous operations are read from the surgical history only
  (reading the whole history excluded biliary colic in every "for elective laparoscopic cholecystectomy"
  pre-operative vignette).
- Where the hybrid layer matters most is the **entry-point** cases: the Atlanta criteria on a raised
  lipase, NG12 on a lung mass, the definitive histology on an adenoma (with its final-diagnosis prompt
  and BSG 2020 work-up), which PANE cannot use at all.

## Remaining gaps (for the next content pass)

- **Lost can't-miss (abdominal pain, both captured only by iOS)**: `appendicitis-antibiotics-first-coda`
  (a gynaecological cause in a young woman with RIF pain: the two held can't-miss places go to liver
  abscess and bowel obstruction rather than ovarian torsion / ectopic after a negative pregnancy test)
  and `appendicitis-pregnant-t2` (pyelonephritis in pregnancy is not flagged can't-miss). Proposed: make
  the held can't-miss places respect the complaint's region and sex (RIF pain in a woman: a
  gynaecological can't-miss first), and mark pyelonephritis can't-miss in pregnancy.
- **Sepsis over a found source** (`ppu-elderly-steroids-masked`, `ppu-septic-shock-delayed`): the PANE
  profile of "sepsis, source not identified" carries every organ-dysfunction feature. Proposed: when a
  candidate that is itself a source (perforation, cholangitis, pyelonephritis …) is in the test band,
  "sepsis, source not identified" takes only the prior share of the systemic findings.
- Top-1 differences from PANE in `ischaemic-colitis-left`, `groin-mimic-testicular-torsion`, the two
  ovarian-torsion vignettes and `exam-carnett-abdominal-wall-pain` come from the text findings PANE has
  no feature for and the new iOS / literature links; each needs a look at its contributions
  (`evaluate(...).ranked[i].contributions`).
- **iOS-equivalent evidence** is weaker than the web evidence (top-1 88 vs 97 of 111): the text reader
  misses what the PANE mapper infers from chips and structured SOCRATES answers. On iOS the loop will get
  the iPad's chip answers directly (every chip is a vademecum finding), so this gap should close in the
  Swift twin; it is not a property of the knowledge base.
- NG12 lung "urgent chest X-ray" (≥ 40 with 2 unexplained symptoms) fires on a PE story with explained
  symptoms (`entry-lab-raised-d-dimer`): no rank change, but lung cancer moves to its test band. The
  criteria cannot know "unexplained"; phase 2 should gate it on no leading explanation above its
  treat threshold.
- Incidental gallstones (`biliary-colic-asymptomatic-incidental-gallstones`): no engine ranks
  asymptomatic gallstones. The report says "Incidental: several small gallstones", which the
  `gallstones_incidental` synonyms ("incidental gallstones") do not match, so the disease has only the
  weak `us_gallstones` ratio (3) and its NICE CG188 work-up is not offered. Proposed: a criteria level
  "gallstones on imaging with no biliary symptoms" (gallstones present, RUQ / episodic pain, fever and
  jaundice absent) instead of a phrase match.

## Production findings (not changed here)

- The dashboard TG18 cholecystitis auto-fill reads "wall thickening" in any imaging report as gallbladder
  wall thickening (criterion C), giving "definite" TG18 for an inflamed appendix on MRI and for a liver
  abscess. Fix proposal in the change log.
- The web PANE mapper sets some findings the record negates or does not support (`wound_discharge` with
  "no wound discharge" in the negatives; `skin_necrosis` from "necrotising pancreatitis"). To investigate
  in `socrates-to-features.ts`.

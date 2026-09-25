# Clinical validation — web engines (latest local run)

Generated 2026-09-25T13:39:34.845Z.

- Harness clinval-web/1; 9 vignettes from ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/.

Status legend: PASS; FAIL — BLOCKING (critical, not flagged: fails the test run); FAIL (known gap) and
FAIL (unverified) are reported only; "PASS (gap resolved)" means the flag can be removed from the vignette;
n/a = the expectation does not apply to that platform or the engine has no such output.

## Summary

| Platform | Vignettes | Expectations | Pass | Fail | n/a | Critical fail | Blocking | Known-gap fail | Unverified fail | Gap resolved |
|---|---|---|---|---|---|---|---|---|---|---|
| web | 9 | 162 | 110 | 36 | 16 | 8 | 0 | 36 | 0 | 0 |

## Blocking failures

None.

## All critical failures (including known gaps and unverified)

- `appendicitis-elderly-atypical` / **mnm-mesenteric-ischaemia** (web, FAIL (known gap)): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis; also in web.symptomInference#3, web.passive#4 [known gap: PANE top 3 (cholecystitis, appendicitis, appendix mass) omits it; symptom inference ranks it #3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- `appendicitis-pregnant-t2` / **inv-mri-after-inconclusive-us** (web, FAIL (known gap)): no investigation matched among 42 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: Neither the iOS radiation card nor the web appendicitis protocol mentions MRI; CT with contrast is the only second-line imaging offered.]
- `appendicitis-pregnant-t2` / **mgmt-no-nsaid-after-20-weeks** (web, FAIL (known gap)): forbidden management item present in web.clinicalPrompts: "... convert to oral when tolerating po. • paracetamol 1g qds + ibuprofen 400mg tds (regular). • morphine 5mg prn if pain > 5/10. • regular diet as toler..." [known gap: Web appendicectomy operative-plan prompt orders 'Paracetamol 1g QDS + Ibuprofen 400mg TDS (regular)' for a 22-week pregnant patient.]
- `cholangitis-tg18-charcot-sepsis` / **score-tg18-calculator** (web, FAIL (known gap)): expected = 2; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: Web clinical-scores.ts (ClinicalScoresPanel) omits the WBC criterion from the Grade II count and returns Grade I; clinical-scales.ts is correct here.]
- `cholangitis-tg18-grade3-reynolds` / **score-tg18-autofill** (web, FAIL (known gap)): expected = 3; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill never sets organ-dysfunction fields (returns Grade II from age/temperature/WBC/bilirubin); web returns "criteria not met".]
- `cholecystitis-tg18-grade2` / **score-tg18-calculator** (web, FAIL (known gap)): expected = 2; got web.scoreCalculator.tg18-cholecystitis=1 (Mild cholecystitis — elective laparoscopic cholecystectomy) [known gap: Neither calculator has a "palpable tender RUQ mass" Grade II criterion (iOS folds it into Grade I local signs; web grades II only on WBC >18).]
- `cholecystitis-tg18-grade3-organ-dysfunction` / **score-tg18-autofill** (web, FAIL (known gap)): expected = 3; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill ignores the organ-dysfunction data in the record (SBP 82 on noradrenaline, AVPU C, creatinine 238, platelets 88) and returns Grade II from WBC alone; web returns "criteria not met".]
- `cholecystitis-tg18-grade3-organ-dysfunction` / **mgmt-no-penicillin-in-anaphylaxis** (web, FAIL (known gap)): forbidden management item present in web.plan: "[immediate] iv antibiotics: co-amoxiclav 1.2 g tds or piperacillin-tazobactam for severe." (+5 more) [known gap: Plan templates suggest co-amoxiclav / piperacillin-tazobactam regardless of the recorded penicillin anaphylaxis.]

## Results by condition and permutation

### Acute appendicitis

#### `appendicitis-adult-typical` — Typical adult (base case)

24-year-old man, 24 h migratory RIF pain, anorexia, vomiting, low-grade fever, localised peritonism, WBC 14.8, CRP 48. Clinically uncomplicated appendicitis.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-appendicitis-top3 | mustRankTopK | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| score-alvarado-calculator | scoreValue | critical | PASS | Alvarado score (MANTRELS) 1986 |  |
| score-air-calculator | scoreValue | critical | n/a | Appendicitis Inflammatory Response (AIR) score 2008 |  |
| mgmt-lap-appendicectomy | managementInclude | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| dx-appendicitis-top1 | mustRankTopK | quality | PASS |  |  |
| score-rec-alvarado | scoreRecommended | quality | PASS | Alvarado score (MANTRELS) 1986 |  |
| score-rec-air | scoreRecommended | quality | FAIL (known gap) | WSES Jerusalem guidelines 2020; Appendicitis Inflammatory Response (AIR) score 2008 |  |
| score-alvarado-autofill | scoreValue | quality | n/a |  |  |
| inv-fbc | investigationInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| inv-crp | investigationInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| inv-imaging-us-or-ct | investigationInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| inv-urinalysis | investigationInclude | quality | PASS |  |  |
| mgmt-antibiotics | managementInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| mgmt-analgesia | managementInclude | quality | PASS | WSES Jerusalem guidelines 2020 |  |
| mgmt-no-routine-postop-antibiotics | managementExclude | quality | FAIL (known gap) | WSES Jerusalem guidelines 2020 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-uncomplicated | dxVariant | quality | PASS | WSES Jerusalem guidelines 2020 |  |

Failure details:

- **score-rec-air** (web): air not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, news2 [known gap: Web CDS has no AIR rule (and no AIR calculator); Alvarado only.]
- **mgmt-no-routine-postop-antibiotics** (web): forbidden management item present in web.clinicalPrompts: "...l: [x] ml. swab count correct × 2. post-operative orders: • simple appendicitis: iv amoxiclav 1.2g tds × 24h → oral co-amoxiclav × 5 days. • perforated appendicitis: iv pip-tazo 4.5g tds + metronidazole 500mg tds × 5 ..." [known gap: Web appendicectomy operative-plan prompt prescribes 5 days of co-amoxiclav after simple appendicitis.]

Guidelines:

- **wses-2020** — WSES Jerusalem guidelines — diagnosis and treatment of acute appendicitis (2020 update) (2020), Diagnosis (clinical scores; imaging), operative treatment (laparoscopic appendicectomy), antibiotic prophylaxis. Di Saverio S, Podda M, De Simone B, et al. Diagnosis and treatment of acute appendicitis: 2020 update of the WSES Jerusalem guidelines. World J Emerg Surg. 2020;15:27. *(statement wording/numbering not yet verified against the source)*
- **alvarado-1986** — Alvarado score (MANTRELS) (1986), Score items and weights; ≤4 unlikely, 5–6 possible, 7–8 probable, 9–10 very probable. Alvarado A. A practical score for the early diagnosis of acute appendicitis. Ann Emerg Med. 1986;15:557–64. *(statement wording/numbering not yet verified against the source)*
- **air-2008** — Appendicitis Inflammatory Response (AIR) score (2008), Score items and weights; 0–4 low, 5–8 intermediate, 9–12 high. Andersson M, Andersson RE. The appendicitis inflammatory response score: a tool for the diagnosis of acute appendicitis that outperforms the Alvarado score. World J Surg. 2008;32:1843–9. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Appendicitis; 2. Acute Cholecystitis; 3. Appendix Mass / Late Appendicitis
- differential web.symptomInference: 1. Acute appendicitis (paediatric); 2. Acute appendicitis; 3. Acute gastroenteritis; 4. Acute alcoholic pancreatitis; 5. Adhesive small bowel obstruction
- differential web.passive: 1. Acute appendicitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Acute alcoholic pancreatitis; 5. Adhesive small bowel obstruction
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=63)
- alarms: Emergency now [web.triage.emergency]; Peritoneal signs (McBurney's / Rebound / Rovsing) [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Fever 38.1°C + HR 102 bpm [web.clinicalPrompts.safety]
- recommended scores: alvarado, tg18-cholangitis, ranson, qsofa, news2
- score values: alvarado/calculator@web.scaleCalculator.alvarado=9
- dx variant: appendicitis_uncomplicated (Acute Appendicitis)
- note: PANE features applied: rlq_pain, nausea_vomiting, fever, anorexia
- note: AssessmentTab ManagementPanel protocol: appendicitis (from PANE top)
- note: PlanTab protocol: appendicitis (from ICD)
- note: no web calculator for score form 'air'
- note: matchPathways: Acute Appendicitis (12), Acute Abdomen (7), Anorectal (Haemorrhoids / Fissure / Fistula / Abscess) (7)

</details>

#### `appendicitis-elderly-atypical` — Elderly, atypical (AF on apixaban)

78-year-old woman with 3 days of vague lower abdominal pain settling in the RIF, anorexia, no fever, WBC 9.8 but CRP 145. Scores are equivocal/low although appendicitis is present; AF raises mesenteric ischaemia as a must-not-miss.

Permutation of `appendicitis-adult-typical`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-appendicitis-top5 | mustRankTopK | critical | PASS | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| mnm-mesenteric-ischaemia | mustNotMiss | critical | FAIL (known gap) | ESVS clinical practice guidelines 2017 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| score-alvarado-calculator | scoreValue | critical | PASS | Alvarado score (MANTRELS) 1986 |  |
| score-air-calculator | scoreValue | critical | n/a | Appendicitis Inflammatory Response (AIR) score 2008 |  |
| inv-ct-abdomen-pelvis | investigationInclude | critical | PASS | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| mnm-caecal-neoplasm | mustNotMiss | quality | FAIL (known gap) | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| mnm-diverticulitis | mustNotMiss | quality | FAIL (known gap) |  |  |
| flag-anticoagulant | redFlags | quality | PASS |  |  |
| flag-elderly-atypical | redFlags | quality | PASS |  |  |
| score-rec-alvarado | scoreRecommended | quality | PASS |  |  |
| inv-renal-function | investigationInclude | quality | PASS |  |  |
| inv-lactate-or-cta | investigationInclude | quality | PASS | ESVS clinical practice guidelines 2017 |  |
| mgmt-anticoagulant-plan | managementInclude | quality | PASS |  |  |
| mgmt-lap-appendicectomy | managementInclude | quality | PASS | SIFIPAC/WSES/SICG/SIMEU guidelines 2020 |  |
| mgmt-no-discharge-on-low-score | managementExclude | quality | PASS |  |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-uncomplicated | dxVariant | quality | PASS |  |  |

Failure details:

- **mnm-mesenteric-ischaemia** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis; also in web.symptomInference#3, web.passive#4 [known gap: PANE top 3 (cholecystitis, appendicitis, appendix mass) omits it; symptom inference ranks it #3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- **mnm-caecal-neoplasm** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- **mnm-diverticulitis** (web): not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3.]

Guidelines:

- **wses-elderly-2019** — SIFIPAC/WSES/SICG/SIMEU guidelines — acute appendicitis in the elderly (2019 edition) (2020), Diagnosis (scores and CT imaging in the elderly); treatment (appendicectomy vs non-operative; laparoscopy). Fugazzola P, Ceresoli M, Agnoletti V, et al. The SIFIPAC/WSES/SICG/SIMEU guidelines for diagnosis and treatment of acute appendicitis in the elderly (2019 edition). World J Emerg Surg. 2020;15:19. *(statement wording/numbering not yet verified against the source)*
- **esvs-2017** — ESVS clinical practice guidelines — diseases of the mesenteric arteries and veins (2017), Acute mesenteric arterial ischaemia — clinical suspicion (AF, embolic source) and CT angiography. Björck M, Koelemay M, Acosta S, et al. Management of the diseases of mesenteric arteries and veins: clinical practice guidelines of the European Society of Vascular Surgery (ESVS). Eur J Vasc Endovasc Surg. 2017;53:460–510. *(statement wording/numbering not yet verified against the source)*
- **alvarado-1986** — Alvarado score (MANTRELS) (1986), Score items and weights. Alvarado A. A practical score for the early diagnosis of acute appendicitis. Ann Emerg Med. 1986;15:557–64. *(statement wording/numbering not yet verified against the source)*
- **air-2008** — Appendicitis Inflammatory Response (AIR) score (2008), Score items and weights. Andersson M, Andersson RE. World J Surg. 2008;32:1843–9. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Appendicitis; 3. Appendix Mass / Late Appendicitis
- differential web.symptomInference: 1. Acute appendicitis (paediatric); 2. Acute appendicitis; 3. Acute mesenteric ischaemia; 4. Acute alcoholic pancreatitis; 5. Acute gastroenteritis
- differential web.passive: 1. Acute appendicitis (paediatric); 2. Acute alcoholic pancreatitis; 3. Acute gastroenteritis; 4. Acute mesenteric ischaemia; 5. Adhesive small bowel obstruction
- differential web.triageSurgical: 1. Unexplained weight loss / GI alarm symptoms — endoscopy workup
- emergency level: emergency (acuity=urgent, action=emergency_now, score=149)
- alarms: Emergency now [web.triage.emergency]; Peritoneal signs (McBurney's / Rebound / Rovsing) [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Incarcerated / strangulated hernia [web.clinicalPrompts.safety]; Bowel obstruction — clinical or imaging evidence [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Anticoagulation therapy [web.clinicalPrompts.safety]
- recommended scores: alvarado, ranson, cha2ds2-vasc, news2, caprini, has-bled, asa, rcri, cfs
- score values: alvarado/calculator@web.scaleCalculator.alvarado=5
- dx variant: appendicitis_uncomplicated (Acute Appendicitis)
- note: PANE features applied: rlq_pain, suprapubic_pain, nausea_vomiting, anorexia
- note: AssessmentTab ManagementPanel protocol: appendicitis (from ICD)
- note: PlanTab protocol: appendicitis (from ICD)
- note: no web calculator for score form 'air'
- note: matchPathways: IBD — Surgical Complications (Crohn's / UC) (21), Anorectal (Haemorrhoids / Fissure / Fistula / Abscess) (19), Colonoscopy Diagnostic (Rectal Bleeding / Bowel Habit Change / Iron Deficiency) (19)

</details>

#### `appendicitis-pregnant-t2` — Pregnant, second trimester (22 weeks)

29-year-old G2P1 at 22 weeks with 18 h periumbilical pain now right-sided and higher than the RIF, nausea, one vomit, low-grade fever, right flank tenderness. Ultrasound non-diagnostic.

Permutation of `appendicitis-adult-typical`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-appendicitis-top3 | mustRankTopK | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | WSES Jerusalem guidelines 2020 |  |
| flag-pregnancy | redFlags | critical | PASS | ACOG Committee Opinion No. 723 2017 |  |
| inv-mri-after-inconclusive-us | investigationInclude | critical | FAIL (known gap) | WSES Jerusalem guidelines 2020; ACOG Committee Opinion No. 723 2017 |  |
| mgmt-no-nsaid-after-20-weeks | managementExclude | critical | FAIL (known gap) | US FDA Drug Safety Communication 2020 |  |
| mnm-obstetric-cause | mustNotMiss | quality | FAIL (known gap) |  |  |
| mnm-pyelonephritis | mustNotMiss | quality | FAIL (known gap) |  |  |
| inv-ultrasound-first | investigationInclude | quality | PASS | WSES Jerusalem guidelines 2020; ACOG Committee Opinion No. 723 2017 |  |
| inv-no-unqualified-ct | investigationExclude | quality | FAIL (known gap) |  |  |
| inv-no-gadolinium | investigationExclude | quality | PASS | ACOG Committee Opinion No. 723 2017 |  |
| mgmt-lap-appendicectomy | managementInclude | quality | PASS | WSES Jerusalem guidelines 2020; SAGES guidelines for the use of laparoscopy during pregnancy 2017 |  |
| mgmt-obstetric-involvement | managementInclude | quality | FAIL (known gap) | SAGES guidelines for the use of laparoscopy during pregnancy 2017 |  |
| mgmt-no-bhcg-negative-assumption | managementExclude | quality | FAIL (known gap) |  |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-uncomplicated | dxVariant | quality | PASS |  |  |

Failure details:

- **mnm-obstetric-cause** (web): not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Acute Cholecystitis \| 3. Appendix Mass / Late Appendicitis [known gap: PANE has no obstetric disease nodes in the top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- **mnm-pyelonephritis** (web): not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Acute Cholecystitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagnosis.]
- **inv-mri-after-inconclusive-us** (web): no investigation matched among 42 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: Neither the iOS radiation card nor the web appendicitis protocol mentions MRI; CT with contrast is the only second-line imaging offered.]
- **inv-no-unqualified-ct** (web): forbidden investigation present in web.plan.investigations: "ct abdomen/pelvis with iv contrast - if uss inconclusive or high clinical suspicio..." (+3 more) [known gap: CT with IV contrast is suggested without a pregnancy qualifier.]
- **mgmt-obstetric-involvement** (web): no management item matched among 55 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No obstetric review or fetal monitoring in the web plan or prompts.]
- **mgmt-no-nsaid-after-20-weeks** (web): forbidden management item present in web.clinicalPrompts: "... convert to oral when tolerating po. • paracetamol 1g qds + ibuprofen 400mg tds (regular). • morphine 5mg prn if pain > 5/10. • regular diet as toler..." [known gap: Web appendicectomy operative-plan prompt orders 'Paracetamol 1g QDS + Ibuprofen 400mg TDS (regular)' for a 22-week pregnant patient.]
- **mgmt-no-bhcg-negative-assumption** (web): forbidden management item present in web.clinicalPrompts: "...ak (< 1%), hartmann's pouch if appendix not identifiable. • β-hcg confirmed negative (female of reproductive age). • group & screen available; cross-match if perfor..." [known gap: Web operative-plan prompt states 'β-HCG confirmed negative' for a patient recorded as pregnant.]

Guidelines:

- **wses-2020** — WSES Jerusalem guidelines — acute appendicitis (2020 update) (2020), Diagnosis in pregnancy (US first, MRI if US inconclusive); laparoscopic appendicectomy in pregnancy. Di Saverio S, Podda M, De Simone B, et al. World J Emerg Surg. 2020;15:27. *(statement wording/numbering not yet verified against the source)*
- **acog-co723-2017** — ACOG Committee Opinion No. 723 — Guidelines for diagnostic imaging during pregnancy and lactation (2017), US and MRI preferred; CT not contraindicated when needed; gadolinium only if it clearly improves diagnosis. ACOG Committee Opinion No. 723. Obstet Gynecol. 2017;130:e210–e216. *(statement wording/numbering not yet verified against the source)*
- **sages-2017** — SAGES guidelines for the use of laparoscopy during pregnancy (2017), Laparoscopic appendicectomy in any trimester; obstetric consultation; fetal heart monitoring. Pearl JP, Price RR, Tonkin AE, Richardson WS, Stefanidis D. Surg Endosc. 2017;31:3767–82. *(statement wording/numbering not yet verified against the source)*
- **fda-2020-nsaid** — US FDA Drug Safety Communication — NSAIDs in pregnancy at 20 weeks or later (2020), Avoid NSAIDs from about 20 weeks' gestation (fetal renal dysfunction, oligohydramnios). US Food and Drug Administration. Drug Safety Communication, 15 October 2020. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Appendicitis; 2. Acute Cholecystitis; 3. Appendix Mass / Late Appendicitis
- differential web.symptomInference: 1. Acute appendicitis (paediatric); 2. Acute gastroenteritis; 3. Acute alcoholic pancreatitis; 4. Adhesive small bowel obstruction; 5. Acute appendicitis
- differential web.passive: 1. Acute appendicitis (paediatric); 2. Acute gastroenteritis; 3. Acute alcoholic pancreatitis; 4. Adhesive small bowel obstruction; 5. Acute mesenteric ischaemia
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=87)
- alarms: Emergency now [web.triage.emergency]; Peritoneal signs (McBurney's / Rebound / Rovsing) [web.clinicalPrompts.safety]; Reproductive-age female with abdominal complaint [web.clinicalPrompts.safety]; Appendix > 6mm / inflamed on imaging [web.clinicalPrompts.safety]; Pelvic free fluid on imaging — female patient [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 16.2 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]
- recommended scores: alvarado, ranson, news2
- score values: (none)
- dx variant: appendicitis_uncomplicated (Acute Appendicitis)
- note: PANE features applied: rlq_pain, nausea_vomiting, anorexia
- note: AssessmentTab ManagementPanel protocol: appendicitis (from PANE top)
- note: PlanTab protocol: appendicitis (from ICD)
- note: matchPathways: Acute Appendicitis (12), Acute Abdomen (7), Anorectal (Haemorrhoids / Fissure / Fistula / Abscess) (7)

</details>

### Acute cholangitis

#### `cholangitis-tg18-charcot-sepsis` — Charcot's triad with sepsis — TG18 Grade II (base case)

68-year-old woman with RUQ pain, rigors (39.4 °C) and jaundice; WBC 17.8, bilirubin 72 µmol/L, CBD 11 mm with a distal stone. qSOFA 2 (RR 22, SBP 100) without TG18 organ dysfunction: Grade II.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholangitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| alarm-sepsis | mustAlarm | critical | PASS | Surviving Sepsis Campaign guidelines 2021 2021; Tokyo Guidelines 2018 2018 |  |
| score-tg18-calculator | scoreValue | critical | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-blood-cultures | investigationInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| mgmt-biliary-drainage | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Tokyo Guidelines 2018 2018 |  |
| mgmt-antibiotics | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| dx-cholangitis-top1 | mustRankTopK | quality | PASS |  |  |
| mnm-choledocholithiasis | mustNotMiss | quality | PASS |  |  |
| flag-charcot | redFlags | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| score-rec-tg18-cholangitis | scoreRecommended | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-qsofa-calculator | scoreValue | quality | n/a | Sepsis-3 consensus definitions 2016 |  |
| score-qsofa-autofill | scoreValue | quality | n/a | Sepsis-3 consensus definitions 2016 |  |
| inv-lfts | investigationInclude | quality | PASS |  |  |
| inv-coagulation | investigationInclude | quality | PASS |  |  |
| inv-mrcp-or-eus | investigationInclude | quality | PASS |  |  |
| mgmt-drainage-in-generated-plan | managementInclude | quality | FAIL (known gap) |  |  |
| mgmt-iv-fluids | managementInclude | quality | PASS |  |  |
| mgmt-interval-cholecystectomy | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade2 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **score-tg18-calculator** (web): expected = 2; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: Web clinical-scores.ts (ClinicalScoresPanel) omits the WBC criterion from the Grade II count and returns Grade I; clinical-scales.ts is correct here.]
- **score-tg18-autofill** (web): expected = 2; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: Web clinical-scores needs manual imaging ticks before it will diagnose, so auto-fill reads "criteria not met".]
- **mgmt-drainage-in-generated-plan** (web): no management item matched among 13 (web.plan) [known gap: dx-variants: 'ascending cholangitis' is a Grade I keyword, Grade I is checked first, and Grade I phases exclude 'surgical', so ERCP disappears from the generated plan.]
- **variant-grade2** (web): detected cholangitis_grade1 in group Cholangitis; expected cholangitis_grade2 [known gap: dx-variants selects Grade I from 'ascending cholangitis'.]

Guidelines:

- **tg18-dx-cholangitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholangitis (2018), Diagnosis A (fever/chills; inflammatory response) + B (jaundice T-Bil ≥2 mg/dL; abnormal LFTs) + C (biliary dilatation; aetiology on imaging). Grade II: any TWO of WBC >12,000 or <4,000/mm³, fever ≥39 °C, age ≥75, T-Bil ≥5 mg/dL, albumin <0.7 × lower limit of normal. Grade III: organ dysfunction.. Kiriyama S, Kozaka K, Takada T, et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholangitis. J Hepatobiliary Pancreat Sci. 2018;25:17–30. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholangitis** — Tokyo Guidelines 2018 — initial management of acute biliary infection and flowchart for acute cholangitis (2018), Grade I: antibiotics, drainage if no response; Grade II: early biliary drainage + antibiotics; Grade III: organ support then urgent drainage; treat the aetiology (e.g. cholecystectomy) after recovery. Miura F, Okamoto K, Takada T, et al. Tokyo Guidelines 2018: initial management of acute biliary infection and flowchart for acute cholangitis. J Hepatobiliary Pancreat Sci. 2018;25:31–40. *(statement wording/numbering not yet verified against the source)*
- **tg18-drainage** — Tokyo Guidelines 2018 — indications and techniques of biliary drainage for acute cholangitis (2018), Endoscopic transpapillary drainage is first line; percutaneous transhepatic drainage when endoscopy fails or is unavailable. Mukai S, Itoi T, Baron TH, et al. J Hepatobiliary Pancreat Sci. 2017;24:537–49 (TG18 update). *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy (2018), Blood cultures in Grade II/III; antimicrobial choice by severity. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*
- **ssc-2021** — Surviving Sepsis Campaign guidelines 2021 (2021), Blood cultures before antimicrobials; timely antimicrobials; source control. Evans L, Rhodes A, Alhazzani W, et al. Crit Care Med. 2021;49:e1063–e1143. *(statement wording/numbering not yet verified against the source)*
- **sepsis-3** — Sepsis-3 consensus definitions (2016), qSOFA: RR ≥22/min, altered mentation, SBP ≤100 mmHg. Singer M, Deutschman CS, Seymour CW, et al. JAMA. 2016;315:801–10. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholangitis; 2. Acute Cholecystitis; 3. Choledocholithiasis
- differential web.symptomInference: 1. Acute cholangitis; 2. CBD stone / obstructive jaundice; 3. Biliary atresia; 4. Cholangiocarcinoma; 5. Liver disease / hepatitis / cirrhosis
- differential web.passive: 1. Acute cholecystitis; 2. CBD stone / obstructive jaundice; 3. Biliary atresia; 4. Liver disease / hepatitis / cirrhosis; 5. Cholangiocarcinoma
- differential web.triageSurgical: 1. Acute cholangitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=195)
- alarms: Emergency now [web.triage.emergency]; Charcot's triad (RUQ pain + fever + jaundice) [web.clinicalPrompts.safety]; Courvoisier's sign (palpable non-tender gallbladder + jaundice) [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Murphy's sign positive [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 17.8 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; Fever 39.4°C + HR 112 bpm [web.clinicalPrompts.safety]
- recommended scores: tg18-cholangitis, qsofa, asge-cbd, news2, caprini, asa, rcri, cfs
- score values: tg18-cholangitis/calculator@web.scaleCalculator.tg18-cholangitis=2; tg18-cholangitis/calculator@web.scoreCalculator.tg18-cholangitis=1; tg18-cholangitis/autofill@web.scoreCalculator.tg18-cholangitis=0
- dx variant: cholangitis_grade1 (Cholangitis)
- note: PANE features applied: ruq_pain, nausea_vomiting, fever, jaundice, rigors
- note: AssessmentTab ManagementPanel protocol: cholangitis (from PANE top)
- note: PlanTab protocol: cholangitis (from ICD)
- note: no web calculator for score form 'qsofa'
- note: matchPathways: Jaundice Workup (30), Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (20), ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct) (10)

</details>

#### `cholangitis-tg18-grade1-single-criterion` — TG18 Grade I (mild) — only one Grade II criterion (age ≥75)

78-year-old man with 3 days of intermittent RUQ pain, fever 38.4 °C and jaundice; WBC 11.2, bilirubin 58 µmol/L, albumin 36, CBD 9 mm. One Grade II criterion (age) only, no organ dysfunction: TG18 Grade I.

Permutation of `cholangitis-tg18-charcot-sepsis`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholangitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-antibiotics | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Tokyo Guidelines 2018 2018 |  |
| mnm-malignant-obstruction | mustNotMiss | quality | FAIL (known gap) |  |  |
| no-sepsis-alarm-mild | mustNotAlarm | quality | PASS |  |  |
| score-rec-tg18-cholangitis | scoreRecommended | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-calculator | scoreValue | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-lfts | investigationInclude | quality | PASS |  |  |
| inv-mrcp-or-eus | investigationInclude | quality | PASS |  |  |
| inv-blood-cultures | investigationInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-drainage-plan | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade1 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **mnm-malignant-obstruction** (web): not in top 3 of web.pane: 1. Acute Cholangitis \| 2. Inguinal / Femoral Hernia \| 3. Choledocholithiasis; also in web.symptomInference#4, web.passive#3 [known gap: PANE top 3 includes Inguinal / Femoral Hernia (male/age prior modifiers) instead.]
- **score-tg18-calculator** (web): expected = 1; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: iOS TokyoCholangitis and web clinical-scales count ONE Grade II criterion as Grade II (TG18 requires two).]
- **score-tg18-autofill** (web): expected = 1; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill: age >75 alone → Grade II; web clinical-scores: criteria not met without manual imaging ticks.]
- **variant-grade1** (web): detected (none) in group Cholangitis; expected cholangitis_grade1 [known gap: dx-variants keywords need 'mild cholangitis' word order; 'Mild acute cholangitis' selects no variant.]

Guidelines:

- **tg18-dx-cholangitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholangitis (2018), Grade II: any two of WBC >12,000 or <4,000/mm³, fever ≥39 °C, age ≥75, T-Bil ≥5 mg/dL, hypoalbuminaemia (<0.7 × LLN). Kiriyama S, Kozaka K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:17–30. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholangitis** — Tokyo Guidelines 2018 — flowchart for acute cholangitis (2018), Grade I: antibiotics; biliary drainage if no response within 24 h; treat the aetiology (ERCP for CBD stones). Miura F, Okamoto K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:31–40. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy (2018), Antimicrobial choice by severity. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholangitis; 2. Inguinal / Femoral Hernia; 3. Choledocholithiasis
- differential web.symptomInference: 1. Acute cholangitis; 2. CBD stone / obstructive jaundice; 3. Liver disease / hepatitis / cirrhosis; 4. Cholangiocarcinoma; 5. Pancreatic adenocarcinoma
- differential web.passive: 1. CBD stone / obstructive jaundice; 2. Liver disease / hepatitis / cirrhosis; 3. Cholangiocarcinoma; 4. Biliary atresia; 5. Neonatal jaundice
- differential web.triageSurgical: 1. Acute cholangitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=192)
- alarms: Emergency now [web.triage.emergency]; Charcot's triad (RUQ pain + fever + jaundice) [web.clinicalPrompts.safety]; Courvoisier's sign (palpable non-tender gallbladder + jaundice) [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; Hepatic lesion on imaging [web.clinicalPrompts.safety]
- recommended scores: tg18-cholangitis, qsofa, asge-cbd, news2, caprini, asa, rcri, cfs
- score values: tg18-cholangitis/calculator@web.scaleCalculator.tg18-cholangitis=2; tg18-cholangitis/calculator@web.scoreCalculator.tg18-cholangitis=1; tg18-cholangitis/autofill@web.scoreCalculator.tg18-cholangitis=0
- dx variant: (none) (Cholangitis)
- note: PANE features applied: ruq_pain, colicky_pain, fever, jaundice
- note: AssessmentTab ManagementPanel protocol: cholangitis (from ICD)
- note: PlanTab protocol: cholangitis (from ICD)
- note: matchPathways: Jaundice Workup (25), Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (15), ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct) (10)

</details>

#### `cholangitis-tg18-grade3-reynolds` — TG18 Grade III (severe) — Reynolds' pentad, septic shock, on apixaban

82-year-old woman found confused: fever 39.6 °C, jaundice, BP 78/44 needing noradrenaline, oliguria, creatinine 212, INR 1.8, platelets 74, lactate 5.2; CBD 14 mm with stones. On apixaban for AF.

Permutation of `cholangitis-tg18-charcot-sepsis`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholangitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-emergency | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| alarm-sepsis | mustAlarm | critical | PASS | Surviving Sepsis Campaign guidelines 2021 2021 |  |
| alarm-haemodynamic | mustAlarm | critical | PASS | Surviving Sepsis Campaign guidelines 2021 2021 |  |
| score-tg18-calculator | scoreValue | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | critical | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-blood-cultures | investigationInclude | critical | PASS | Surviving Sepsis Campaign guidelines 2021 2021; Tokyo Guidelines 2018 2018 |  |
| mgmt-urgent-biliary-drainage | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Tokyo Guidelines 2018 2018 |  |
| mgmt-organ-support | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| mgmt-broad-spectrum-antibiotics | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign guidelines 2021 2021 |  |
| mnm-septic-shock | mustNotMiss | quality | FAIL (known gap) |  |  |
| flag-anticoagulant | redFlags | quality | PASS |  |  |
| flag-reynolds | redFlags | quality | PASS |  |  |
| score-rec-tg18-cholangitis | scoreRecommended | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| score-qsofa-autofill | scoreValue | quality | n/a | Sepsis-3 consensus definitions 2016 |  |
| inv-lactate | investigationInclude | quality | PASS | Surviving Sepsis Campaign guidelines 2021 2021 |  |
| inv-coagulation | investigationInclude | quality | PASS |  |  |
| mgmt-vasopressor-fluids | managementInclude | quality | PASS | Surviving Sepsis Campaign guidelines 2021 2021 |  |
| mgmt-anticoagulant-plan | managementInclude | quality | PASS |  |  |
| mgmt-no-surgery-first | managementExclude | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade3 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **mnm-septic-shock** (web): not in top 3 of web.pane: 1. Acute Cholangitis \| 2. Acute Cholecystitis \| 3. Acute Diverticulitis; also in web.symptomInference#2, web.passive#2 [known gap: PANE has no sepsis node; symptom inference ranks sepsis #2. iOS: fallback mode: the built-in jaundice list (5 candidates) does not contain this diagnosis.]
- **score-tg18-autofill** (web): expected = 3; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill never sets organ-dysfunction fields (returns Grade II from age/temperature/WBC/bilirubin); web returns "criteria not met".]
- **mgmt-no-surgery-first** (web): forbidden management item present in web.clinicalPrompts: "• emergency laparotomy consent - source control; icu post-operatively." [known gap: Web clinical prompt: 'Emergency laparotomy consent — source control' for Grade III cholangitis, instead of drainage first.]
- **variant-grade3** (web): detected (none) in group Cholangitis; expected cholangitis_grade3 [known gap: dx-variants needs 'severe cholangitis' word order; 'Severe acute cholangitis' selects no variant.]

Guidelines:

- **tg18-dx-cholangitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholangitis (2018), Grade III: cardiovascular (dopamine ≥5 µg/kg/min or any noradrenaline), neurological (disturbance of consciousness), respiratory (PaO₂/FiO₂ <300), renal (oliguria, creatinine >2.0 mg/dL), hepatic (PT-INR >1.5), haematological (platelets <100,000/mm³). Kiriyama S, Kozaka K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:17–30. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholangitis** — Tokyo Guidelines 2018 — flowchart for acute cholangitis (2018), Grade III: appropriate organ support and antibiotics, then urgent biliary drainage. Miura F, Okamoto K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:31–40. *(statement wording/numbering not yet verified against the source)*
- **tg18-drainage** — Tokyo Guidelines 2018 — biliary drainage for acute cholangitis (2018), Endoscopic transpapillary drainage first line; percutaneous when not possible; surgery only when both fail. Mukai S, Itoi T, Baron TH, et al. Indications and techniques of biliary drainage for acute cholangitis in updated Tokyo Guidelines 2018. J Hepatobiliary Pancreat Sci. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy (2018), Grade III regimens; blood cultures. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*
- **ssc-2021** — Surviving Sepsis Campaign guidelines 2021 (2021), Septic shock: antimicrobials within 1 h, blood cultures first, fluids, noradrenaline first-line vasopressor, source control. Evans L, Rhodes A, Alhazzani W, et al. Crit Care Med. 2021;49:e1063–e1143. *(statement wording/numbering not yet verified against the source)*
- **sepsis-3** — Sepsis-3 consensus definitions (2016), qSOFA and septic shock definitions. Singer M, Deutschman CS, Seymour CW, et al. JAMA. 2016;315:801–10. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholangitis; 2. Acute Cholecystitis; 3. Acute Diverticulitis
- differential web.symptomInference: 1. Acute cholangitis; 2. Sepsis / systemic infection; 3. CBD stone / obstructive jaundice; 4. Liver disease / hepatitis / cirrhosis; 5. Malaria
- differential web.passive: 1. Acute cholangitis; 2. Sepsis / systemic infection; 3. Malaria; 4. Leptospirosis; 5. Liver disease / hepatitis / cirrhosis
- differential web.triageSurgical: 1. Acute cholangitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=374)
- alarms: Hypotension [web.triage.vitalRedFlags]; Tachycardia [web.triage.vitalRedFlags]; Tachypnoea [web.triage.vitalRedFlags]; High fever [web.triage.vitalRedFlags]; Low SpO₂ [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; Charcot's triad (RUQ pain + fever + jaundice) [web.clinicalPrompts.safety]; Generalised peritonism (guarding / rigidity) [web.clinicalPrompts.safety]; Fever 39.6°C + HR 128 bpm + SBP 78 mmHg — septic shock [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Anticoagulation therapy [web.clinicalPrompts.safety]; WBC 24.8 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; INR 1.8 — coagulopathy [web.clinicalPrompts.safety]; Creatinine 212 μmol/L — elevated [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; SpO₂ 91% — hypoxia [web.clinicalPrompts.safety]; Albumin 24 g/L — hypoalbuminaemia [web.clinicalPrompts.safety]
- recommended scores: tg18-cholangitis, cha2ds2-vasc, qsofa, gcs, asge-cbd, web:wagner, news2, caprini, has-bled, asa, rcri, cfs
- score values: tg18-cholangitis/calculator@web.scaleCalculator.tg18-cholangitis=3; tg18-cholangitis/calculator@web.scoreCalculator.tg18-cholangitis=3; tg18-cholangitis/autofill@web.scoreCalculator.tg18-cholangitis=0
- dx variant: (none) (Cholangitis)
- note: PANE features applied: ruq_pain, fever, jaundice, rigors
- note: AssessmentTab ManagementPanel protocol: cholangitis (from PANE top)
- note: PlanTab protocol: cholangitis (from ICD)
- note: no web calculator for score form 'qsofa'
- note: matchPathways: Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (22), Jaundice Workup (20), Pancreatic Mass / Cyst (17)

</details>

### Acute calculous cholecystitis

#### `cholecystitis-tg18-grade1` — TG18 Grade I (mild) — base case

48-year-old woman, 30 h of constant RUQ pain after a fatty meal, fever 38.2 °C, Murphy's sign, WBC 13.1, CRP 86, ultrasound shows gallstones with wall thickening and pericholecystic fluid. No Grade II/III criteria.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholecystitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-calculator | scoreValue | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-lap-cholecystectomy | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| mnm-cbd-stone-or-cholangitis | mustNotMiss | quality | PASS |  |  |
| no-sepsis-alarm-grade1 | mustNotAlarm | quality | PASS |  |  |
| score-rec-tg18-cholecystitis | scoreRecommended | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | quality | FAIL (known gap) |  |  |
| inv-ultrasound | investigationInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| inv-lfts | investigationInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| inv-fbc-crp | investigationInclude | quality | PASS |  |  |
| mgmt-early-timing | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-antibiotics | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-analgesia | managementInclude | quality | PASS |  |  |
| mgmt-no-drainage-first-line-grade1 | managementExclude | quality | PASS |  |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade1 | dxVariant | quality | PASS | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **score-rec-tg18-cholecystitis** (web): tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, news2, asa, stop-bang [known gap: Web CDS has a TG18 cholangitis rule but none for cholecystitis.]
- **score-tg18-autofill** (web): expected = 1; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill sets only WBC >18 (Grade II criterion) and never the local-signs field, so it reads "criteria not met"; web clinical-scores needs manual Murphy/imaging ticks.]

Guidelines:

- **tg18-dx-cholecystitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholecystitis (2018), TG18 diagnostic criteria (A local, B systemic, C imaging) and severity grading (Grade III organ dysfunction; Grade II: WBC >18,000/mm³, palpable tender RUQ mass, duration >72 h, marked local inflammation; Grade I otherwise). Yokoe M, Hata J, Takada T, et al. Tokyo Guidelines 2018: diagnostic criteria and severity grading of acute cholecystitis. J Hepatobiliary Pancreat Sci. 2018;25:41–54. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholecystitis** — Tokyo Guidelines 2018 — flowchart for the management of acute cholecystitis (2018), Grade I: early laparoscopic cholecystectomy if CCI ≤5 and ASA ≤2. Okamoto K, Suzuki K, Takada T, et al. Tokyo Guidelines 2018: flowchart for the management of acute cholecystitis. J Hepatobiliary Pancreat Sci. 2018;25:55–72. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy for acute cholangitis and cholecystitis (2018), Antimicrobial selection by severity; blood cultures for Grade II/III. Gomi H, Solomkin JS, Schlossberg D, et al. Tokyo Guidelines 2018: antimicrobial therapy for acute cholangitis and cholecystitis. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Cholangitis; 3. Acute Appendicitis
- differential web.symptomInference: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute alcoholic pancreatitis
- differential web.passive: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute alcoholic pancreatitis
- differential web.triageSurgical: 1. Acute cholangitis
- emergency level: emergency (acuity=urgent, action=emergency_now, score=213)
- alarms: Emergency now [web.triage.emergency]; Charcot's triad (RUQ pain + fever + jaundice) [web.clinicalPrompts.safety]; Courvoisier's sign (palpable non-tender gallbladder + jaundice) [web.clinicalPrompts.safety]; Reproductive-age female with abdominal complaint [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Murphy's sign positive [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Jaundice [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]
- recommended scores: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, news2, asa, stop-bang
- score values: tg18-cholecystitis/calculator@web.scoreCalculator.tg18-cholecystitis=1; tg18-cholecystitis/autofill@web.scoreCalculator.tg18-cholecystitis=0
- dx variant: cholecystitis_grade1 (Acute Cholecystitis)
- note: PANE features applied: ruq_pain, nausea_vomiting, fever, fatty_food_trigger
- note: AssessmentTab ManagementPanel protocol: cholecystitis (from PANE top)
- note: PlanTab protocol: cholecystitis (from ICD)
- note: matchPathways: Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (17), Jaundice Workup (15), ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct) (7)

</details>

#### `cholecystitis-tg18-grade2` — TG18 Grade II (moderate) — palpable tender RUQ mass is the only Grade II criterion

57-year-old diabetic man, 60 h of RUQ pain, fever 38.6 °C, tender palpable RUQ mass, WBC 15.6, CRP 188; ultrasound shows a distended, thick-walled gallbladder with pericholecystic inflammation. No organ dysfunction.

Permutation of `cholecystitis-tg18-grade1`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholecystitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-at-least-urgent | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-calculator | scoreValue | critical | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| mgmt-lap-cholecystectomy | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| flag-diabetes | redFlags | quality | PASS |  |  |
| score-rec-tg18-cholecystitis | scoreRecommended | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-blood-cultures | investigationInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| inv-glucose | investigationInclude | quality | PASS |  |  |
| mgmt-gb-drainage-option | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-antibiotics | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-diabetes-plan | managementInclude | quality | PASS |  |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade2 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **score-rec-tg18-cholecystitis** (web): tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, web:wagner, news2, caprini, asa, rcri [known gap: No TG18 cholecystitis CDS rule on web.]
- **score-tg18-calculator** (web): expected = 2; got web.scoreCalculator.tg18-cholecystitis=1 (Mild cholecystitis — elective laparoscopic cholecystectomy) [known gap: Neither calculator has a "palpable tender RUQ mass" Grade II criterion (iOS folds it into Grade I local signs; web grades II only on WBC >18).]
- **variant-grade2** (web): detected cholecystitis_grade1 in group Acute Cholecystitis; expected cholecystitis_grade2 [known gap: dx-variants: the Grade I variant lists the bare keyword 'cholecystitis' and is checked first, so any cholecystitis assessment selects Grade I.]

Guidelines:

- **tg18-dx-cholecystitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholecystitis (2018), Grade II criteria: WBC >18,000/mm³; palpable tender mass in the RUQ; duration >72 h; marked local inflammation (any one). Yokoe M, Hata J, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:41–54. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholecystitis** — Tokyo Guidelines 2018 — flowchart for the management of acute cholecystitis (2018), Grade II: early laparoscopic cholecystectomy in an advanced centre if CCI ≤5 and ASA ≤2; otherwise antibiotics and urgent/early gallbladder drainage if not responding. Okamoto K, Suzuki K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:55–72. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy for acute cholangitis and cholecystitis (2018), Blood cultures in Grade II/III; antimicrobial choice by severity. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Inguinal / Femoral Hernia; 3. Acute Appendicitis
- differential web.symptomInference: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute alcoholic pancreatitis
- differential web.passive: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Acute gastroenteritis; 4. Adhesive small bowel obstruction; 5. Acute mesenteric ischaemia
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=197)
- alarms: Emergency now [web.triage.emergency]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Murphy's sign positive [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 15.6 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; Fever 38.6°C + HR 104 bpm [web.clinicalPrompts.safety]
- recommended scores: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, web:wagner, news2, caprini, asa, rcri
- score values: tg18-cholecystitis/calculator@web.scoreCalculator.tg18-cholecystitis=1; tg18-cholecystitis/autofill@web.scoreCalculator.tg18-cholecystitis=0
- dx variant: cholecystitis_grade1 (Acute Cholecystitis)
- note: PANE features applied: ruq_pain, nausea_vomiting, fever
- note: AssessmentTab ManagementPanel protocol: cholecystitis (from PANE top)
- note: PlanTab protocol: cholecystitis (from ICD)
- note: matchPathways: Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (17), ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct) (7), Pancreatic Mass / Cyst (7)

</details>

#### `cholecystitis-tg18-grade3-organ-dysfunction` — TG18 Grade III (severe) — septic shock, confusion, AKI, thrombocytopenia; penicillin anaphylaxis

71-year-old man, 4 days of RUQ pain and fever, new confusion, oliguria, BP 82/48 on noradrenaline, creatinine 238, platelets 88, lactate 4.6. Ultrasound: acute calculous cholecystitis, CBD not dilated. Penicillin anaphylaxis.

Permutation of `cholecystitis-tg18-grade1`.

| Expectation | Kind | Severity | web | Guideline | Proposed fix |
|---|---|---|---|---|---|
| dx-cholecystitis-top3 | mustRankTopK | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| level-emergency | emergencyLevel | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign 2021 |  |
| alarm-sepsis | mustAlarm | critical | PASS | Surviving Sepsis Campaign 2021; Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3) 2016 |  |
| alarm-haemodynamic | mustAlarm | critical | PASS | Surviving Sepsis Campaign 2021 |  |
| flag-penicillin-allergy | redFlags | critical | PASS |  |  |
| score-tg18-calculator | scoreValue | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| score-tg18-autofill | scoreValue | critical | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| inv-blood-cultures | investigationInclude | critical | PASS | Surviving Sepsis Campaign 2021; Tokyo Guidelines 2018 2018 |  |
| mgmt-gb-drainage | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-organ-support | managementInclude | critical | PASS | Tokyo Guidelines 2018 2018; Surviving Sepsis Campaign 2021 |  |
| mgmt-no-penicillin-in-anaphylaxis | managementExclude | critical | FAIL (known gap) |  |  |
| mnm-cholangitis | mustNotMiss | quality | PASS |  |  |
| flag-organ-support | redFlags | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-rec-tg18-cholecystitis | scoreRecommended | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| score-rec-news2 | scoreRecommended | quality | PASS | Surviving Sepsis Campaign 2021; Royal College of Physicians 2017 |  |
| score-qsofa-autofill | scoreValue | quality | n/a | Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3) 2016 |  |
| inv-lactate | investigationInclude | quality | PASS | Surviving Sepsis Campaign 2021 |  |
| inv-coagulation | investigationInclude | quality | PASS |  |  |
| mgmt-gb-drainage-in-generated-plan | managementInclude | quality | FAIL (known gap) |  |  |
| mgmt-non-penicillin-antibiotic | managementInclude | quality | PASS | Tokyo Guidelines 2018 2018 |  |
| mgmt-no-early-cholecystectomy-in-shock | managementExclude | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |
| pathway-first-visit | pathway | quality | n/a |  |  |
| variant-grade3 | dxVariant | quality | FAIL (known gap) | Tokyo Guidelines 2018 2018 |  |

Failure details:

- **flag-organ-support** (web): no red flag matched among 47 (web.triage.reasons, web.header.allergies, web.protocol.redFlags, web.dxVariant.urgencyNote, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.vitalRedFlags, web.triage.emergency) [known gap: No ICU/organ-support flag among web red flags.]
- **score-rec-tg18-cholecystitis** (web): tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, gcs, asge-cbd, news2, caprini, asa, rcri, cfs [known gap: No TG18 cholecystitis CDS rule on web.]
- **score-tg18-autofill** (web): expected = 3; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill ignores the organ-dysfunction data in the record (SBP 82 on noradrenaline, AVPU C, creatinine 238, platelets 88) and returns Grade II from WBC alone; web returns "criteria not met".]
- **mgmt-gb-drainage-in-generated-plan** (web): no management item matched among 13 (web.plan) [known gap: iOS radiation plan text has no drainage step (only an IR referral chip); web PlanTab selects the Grade I variant, which filters out the conservative-phase cholecystostomy line.]
- **mgmt-no-penicillin-in-anaphylaxis** (web): forbidden management item present in web.plan: "[immediate] iv antibiotics: co-amoxiclav 1.2 g tds or piperacillin-tazobactam for severe." (+5 more) [known gap: Plan templates suggest co-amoxiclav / piperacillin-tazobactam regardless of the recorded penicillin anaphylaxis.]
- **mgmt-no-early-cholecystectomy-in-shock** (web): forbidden management item present in web.managementPanel.keyPoints: "early laparoscopic cholecystectomy (within 72 h) reduces complications vs interval surgery." [known gap: iOS TG18 Grade III recommendation offers 'emergency cholecystectomy' as an equal alternative; web key points recommend early cholecystectomy without grade qualification.]
- **variant-grade3** (web): detected cholecystitis_grade1 in group Acute Cholecystitis; expected cholecystitis_grade3 [known gap: dx-variants selects Grade I ('cholecystitis' keyword checked first).]

Guidelines:

- **tg18-dx-cholecystitis** — Tokyo Guidelines 2018 — diagnostic criteria and severity grading of acute cholecystitis (2018), Grade III: dysfunction of any one organ/system — cardiovascular (hypotension needing dopamine ≥5 µg/kg/min or any noradrenaline), neurological (decreased consciousness), respiratory (PaO₂/FiO₂ <300), renal (oliguria, creatinine >2.0 mg/dL), hepatic (PT-INR >1.5), haematological (platelets <100,000/mm³). Yokoe M, Hata J, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:41–54. *(statement wording/numbering not yet verified against the source)*
- **tg18-mgmt-cholecystitis** — Tokyo Guidelines 2018 — flowchart for the management of acute cholecystitis (2018), Grade III: organ support and antibiotics; early laparoscopic cholecystectomy only with FOSF, no negative predictive factors (jaundice, neurological or respiratory dysfunction), CCI ≤3, ASA ≤2 in an advanced centre; otherwise urgent/early gallbladder drainage. Okamoto K, Suzuki K, Takada T, et al. J Hepatobiliary Pancreat Sci. 2018;25:55–72. *(statement wording/numbering not yet verified against the source)*
- **tg18-antimicrobial** — Tokyo Guidelines 2018 — antimicrobial therapy (2018), Grade III regimens; blood cultures in Grade II/III. Gomi H, Solomkin JS, Schlossberg D, et al. J Hepatobiliary Pancreat Sci. 2018;25:3–16. *(statement wording/numbering not yet verified against the source)*
- **ssc-2021** — Surviving Sepsis Campaign — international guidelines for management of sepsis and septic shock 2021 (2021), Screening (against qSOFA alone); blood cultures before antimicrobials; antimicrobials within 1 h for probable septic shock; source control. Evans L, Rhodes A, Alhazzani W, et al. Crit Care Med. 2021;49:e1063–e1143. *(statement wording/numbering not yet verified against the source)*
- **sepsis-3** — Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3) (2016), qSOFA criteria: RR ≥22, altered mentation, SBP ≤100. Singer M, Deutschman CS, Seymour CW, et al. JAMA. 2016;315:801–10. *(statement wording/numbering not yet verified against the source)*
- **rcp-news2-2017** — Royal College of Physicians — National Early Warning Score (NEWS) 2 (2017), Aggregate score and clinical response thresholds. Royal College of Physicians. National Early Warning Score (NEWS) 2. London: RCP; 2017. *(statement wording/numbering not yet verified against the source)*

<details><summary>web engine outputs</summary>

- engine: paneEngine=pane-engine (130 diseases, 135 features); triageRulesVersion=1.2.0
- differential web.pane: 1. Acute Cholecystitis; 2. Acute Cholangitis; 3. Inguinal / Femoral Hernia
- differential web.symptomInference: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Sepsis / systemic infection; 4. Hepatocellular carcinoma (HCC); 5. Meningitis / encephalitis
- differential web.passive: 1. Acute cholecystitis; 2. Acute appendicitis (paediatric); 3. Sepsis / systemic infection; 4. Meningitis / encephalitis; 5. UTI (paediatric)
- differential web.triageSurgical: (empty)
- emergency level: emergency (acuity=urgent, action=emergency_now, score=274)
- alarms: Hypotension [web.triage.vitalRedFlags]; Tachycardia [web.triage.vitalRedFlags]; Tachypnoea [web.triage.vitalRedFlags]; Low SpO₂ [web.triage.vitalRedFlags]; Emergency now [web.triage.emergency]; Fever 39.1°C + HR 124 bpm + SBP 82 mmHg — septic shock [web.clinicalPrompts.safety]; Cholecystitis / gallstone disease — surgical indication [web.clinicalPrompts.safety]; Appendicitis — emergency surgical indication [web.clinicalPrompts.safety]; Murphy's sign positive [web.clinicalPrompts.safety]; Acute abdominal presentation [web.clinicalPrompts.safety]; Pre-operative assessment [web.clinicalPrompts.safety]; WBC 22.4 × 10⁹/L — leucocytosis [web.clinicalPrompts.safety]; Creatinine 238 μmol/L — elevated [web.clinicalPrompts.safety]; Dilated common bile duct on imaging [web.clinicalPrompts.safety]; SpO₂ 93% — hypoxia [web.clinicalPrompts.safety]; Albumin 26 g/L — hypoalbuminaemia [web.clinicalPrompts.safety]
- recommended scores: alvarado, tg18-cholangitis, ranson, qsofa, gcs, asge-cbd, news2, caprini, asa, rcri, cfs
- score values: tg18-cholecystitis/calculator@web.scoreCalculator.tg18-cholecystitis=3; tg18-cholecystitis/autofill@web.scoreCalculator.tg18-cholecystitis=0
- dx variant: cholecystitis_grade1 (Acute Cholecystitis)
- note: PANE features applied: ruq_pain, nausea_vomiting, fever
- note: AssessmentTab ManagementPanel protocol: cholecystitis (from ICD)
- note: PlanTab protocol: cholecystitis (from ICD)
- note: no web calculator for score form 'qsofa'
- note: matchPathways: Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis) (10), Wound Management (Acute / Chronic / SSI) (5)

</details>

## Gap register (known gaps and unverified expectations that failed)

| Vignette | Expectation | Platform | Severity | Flag | Detail |
|---|---|---|---|---|---|
| `appendicitis-adult-typical` | score-rec-air | web | quality | known gap | air not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, news2 [known gap: Web CDS has no AIR rule (and no AIR calculator); Alvarado only.] |
| `appendicitis-adult-typical` | mgmt-no-routine-postop-antibiotics | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "...l: [x] ml. swab count correct × 2. post-operative orders: • simple appendicitis: iv amoxiclav 1.2g tds × 24h → oral co-amoxiclav × 5 days. • perforated appendicitis: iv pip-tazo  |
| `appendicitis-elderly-atypical` | mnm-mesenteric-ischaemia | web | critical | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis; also in web.symptomInference#3, web.passive#4 [known gap: PANE top 3 (cholecystitis, appendicitis, appendix mass) omits it; s |
| `appendicitis-elderly-atypical` | mnm-caecal-neoplasm | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagn |
| `appendicitis-elderly-atypical` | mnm-diverticulitis | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholecystitis \| 2. Acute Appendicitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3.] |
| `appendicitis-pregnant-t2` | mnm-obstetric-cause | web | quality | known gap | not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Acute Cholecystitis \| 3. Appendix Mass / Late Appendicitis [known gap: PANE has no obstetric disease nodes in the top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidat |
| `appendicitis-pregnant-t2` | mnm-pyelonephritis | web | quality | known gap | not in top 3 of web.pane: 1. Acute Appendicitis \| 2. Acute Cholecystitis \| 3. Appendix Mass / Late Appendicitis [known gap: Not in PANE top 3. iOS: fallback mode: the built-in abdominalPain list (10 candidates) does not contain this diagn |
| `appendicitis-pregnant-t2` | inv-mri-after-inconclusive-us | web | critical | known gap | no investigation matched among 42 (web.plan.investigations, web.pane.seeded, web.clinicalPrompts) [known gap: Neither the iOS radiation card nor the web appendicitis protocol mentions MRI; CT with contrast is the only second-line imaging of |
| `appendicitis-pregnant-t2` | inv-no-unqualified-ct | web | quality | known gap | forbidden investigation present in web.plan.investigations: "ct abdomen/pelvis with iv contrast - if uss inconclusive or high clinical suspicio..." (+3 more) [known gap: CT with IV contrast is suggested without a pregnancy qualifier.] |
| `appendicitis-pregnant-t2` | mgmt-obstetric-involvement | web | quality | known gap | no management item matched among 55 (web.plan, web.protocol.medications, web.managementPanel, web.managementPanel.keyPoints, web.clinicalPrompts) [known gap: No obstetric review or fetal monitoring in the web plan or prompts.] |
| `appendicitis-pregnant-t2` | mgmt-no-nsaid-after-20-weeks | web | critical | known gap | forbidden management item present in web.clinicalPrompts: "... convert to oral when tolerating po. • paracetamol 1g qds + ibuprofen 400mg tds (regular). • morphine 5mg prn if pain > 5/10. • regular diet as toler..." [known gap: Web appendic |
| `appendicitis-pregnant-t2` | mgmt-no-bhcg-negative-assumption | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "...ak (< 1%), hartmann's pouch if appendix not identifiable. • β-hcg confirmed negative (female of reproductive age). • group & screen available; cross-match if perfor..." [known ga |
| `cholangitis-tg18-charcot-sepsis` | score-tg18-calculator | web | critical | known gap | expected = 2; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: Web clinical-scores.ts (ClinicalScoresPanel) omits the W |
| `cholangitis-tg18-charcot-sepsis` | score-tg18-autofill | web | quality | known gap | expected = 2; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: Web clinical-scores needs manual imaging ticks before it will diagnose, so auto-fill reads "criteria not met".] |
| `cholangitis-tg18-charcot-sepsis` | mgmt-drainage-in-generated-plan | web | quality | known gap | no management item matched among 13 (web.plan) [known gap: dx-variants: 'ascending cholangitis' is a Grade I keyword, Grade I is checked first, and Grade I phases exclude 'surgical', so ERCP disappears from the generated plan.] |
| `cholangitis-tg18-charcot-sepsis` | variant-grade2 | web | quality | known gap | detected cholangitis_grade1 in group Cholangitis; expected cholangitis_grade2 [known gap: dx-variants selects Grade I from 'ascending cholangitis'.] |
| `cholangitis-tg18-grade1-single-criterion` | mnm-malignant-obstruction | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholangitis \| 2. Inguinal / Femoral Hernia \| 3. Choledocholithiasis; also in web.symptomInference#4, web.passive#3 [known gap: PANE top 3 includes Inguinal / Femoral Hernia (male/age prior modifiers) ins |
| `cholangitis-tg18-grade1-single-criterion` | score-tg18-calculator | web | quality | known gap | expected = 1; got web.scaleCalculator.tg18-cholangitis=2 (Grade II — MODERATE); web.scoreCalculator.tg18-cholangitis=1 (Mild cholangitis — antibiotics ± elective drainage) [known gap: iOS TokyoCholangitis and web clinical-scales count ONE G |
| `cholangitis-tg18-grade1-single-criterion` | score-tg18-autofill | web | quality | known gap | expected = 1; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill: age >75 alone → Grade II; web clinical-scores: criteria not met without manual imaging ticks.] |
| `cholangitis-tg18-grade1-single-criterion` | variant-grade1 | web | quality | known gap | detected (none) in group Cholangitis; expected cholangitis_grade1 [known gap: dx-variants keywords need 'mild cholangitis' word order; 'Mild acute cholangitis' selects no variant.] |
| `cholangitis-tg18-grade3-reynolds` | mnm-septic-shock | web | quality | known gap | not in top 3 of web.pane: 1. Acute Cholangitis \| 2. Acute Cholecystitis \| 3. Acute Diverticulitis; also in web.symptomInference#2, web.passive#2 [known gap: PANE has no sepsis node; symptom inference ranks sepsis #2. iOS: fallback mode: t |
| `cholangitis-tg18-grade3-reynolds` | score-tg18-autofill | web | critical | known gap | expected = 3; got web.scoreCalculator.tg18-cholangitis=0 (Criteria not met for cholangitis diagnosis) [known gap: iOS auto-fill never sets organ-dysfunction fields (returns Grade II from age/temperature/WBC/bilirubin); web returns "criteria |
| `cholangitis-tg18-grade3-reynolds` | mgmt-no-surgery-first | web | quality | known gap | forbidden management item present in web.clinicalPrompts: "• emergency laparotomy consent - source control; icu post-operatively." [known gap: Web clinical prompt: 'Emergency laparotomy consent — source control' for Grade III cholangitis, i |
| `cholangitis-tg18-grade3-reynolds` | variant-grade3 | web | quality | known gap | detected (none) in group Cholangitis; expected cholangitis_grade3 [known gap: dx-variants needs 'severe cholangitis' word order; 'Severe acute cholangitis' selects no variant.] |
| `cholecystitis-tg18-grade1` | score-rec-tg18-cholecystitis | web | quality | known gap | tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, news2, asa, stop-bang [known gap: Web CDS has a TG18 cholangitis rule but none for cholecystitis.] |
| `cholecystitis-tg18-grade1` | score-tg18-autofill | web | quality | known gap | expected = 1; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill sets only WBC >18 (Grade II criterion) and never the local-signs field, so it reads "criteria not met"; web  |
| `cholecystitis-tg18-grade2` | score-rec-tg18-cholecystitis | web | quality | known gap | tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, asge-cbd, web:wagner, news2, caprini, asa, rcri [known gap: No TG18 cholecystitis CDS rule on web.] |
| `cholecystitis-tg18-grade2` | score-tg18-calculator | web | critical | known gap | expected = 2; got web.scoreCalculator.tg18-cholecystitis=1 (Mild cholecystitis — elective laparoscopic cholecystectomy) [known gap: Neither calculator has a "palpable tender RUQ mass" Grade II criterion (iOS folds it into Grade I local sign |
| `cholecystitis-tg18-grade2` | variant-grade2 | web | quality | known gap | detected cholecystitis_grade1 in group Acute Cholecystitis; expected cholecystitis_grade2 [known gap: dx-variants: the Grade I variant lists the bare keyword 'cholecystitis' and is checked first, so any cholecystitis assessment selects Grad |
| `cholecystitis-tg18-grade3-organ-dysfunction` | flag-organ-support | web | quality | known gap | no red flag matched among 47 (web.triage.reasons, web.header.allergies, web.protocol.redFlags, web.dxVariant.urgencyNote, web.clinicalPrompts.safety, web.clinicalPrompts.investigation, web.clinicalPrompts.preventative, web.triage.vitalRedFl |
| `cholecystitis-tg18-grade3-organ-dysfunction` | score-rec-tg18-cholecystitis | web | quality | known gap | tg18-cholecystitis not recommended; recommended: alvarado, tg18-cholangitis, ranson, qsofa, gcs, asge-cbd, news2, caprini, asa, rcri, cfs [known gap: No TG18 cholecystitis CDS rule on web.] |
| `cholecystitis-tg18-grade3-organ-dysfunction` | score-tg18-autofill | web | critical | known gap | expected = 3; got web.scoreCalculator.tg18-cholecystitis=0 (Criteria not met for cholecystitis diagnosis) [known gap: iOS auto-fill ignores the organ-dysfunction data in the record (SBP 82 on noradrenaline, AVPU C, creatinine 238, platelets |
| `cholecystitis-tg18-grade3-organ-dysfunction` | mgmt-gb-drainage-in-generated-plan | web | quality | known gap | no management item matched among 13 (web.plan) [known gap: iOS radiation plan text has no drainage step (only an IR referral chip); web PlanTab selects the Grade I variant, which filters out the conservative-phase cholecystostomy line.] |
| `cholecystitis-tg18-grade3-organ-dysfunction` | mgmt-no-penicillin-in-anaphylaxis | web | critical | known gap | forbidden management item present in web.plan: "[immediate] iv antibiotics: co-amoxiclav 1.2 g tds or piperacillin-tazobactam for severe." (+5 more) [known gap: Plan templates suggest co-amoxiclav / piperacillin-tazobactam regardless of the |
| `cholecystitis-tg18-grade3-organ-dysfunction` | mgmt-no-early-cholecystectomy-in-shock | web | quality | known gap | forbidden management item present in web.managementPanel.keyPoints: "early laparoscopic cholecystectomy (within 72 h) reduces complications vs interval surgery." [known gap: iOS TG18 Grade III recommendation offers 'emergency cholecystectom |
| `cholecystitis-tg18-grade3-organ-dysfunction` | variant-grade3 | web | quality | known gap | detected cholecystitis_grade1 in group Acute Cholecystitis; expected cholecystitis_grade3 [known gap: dx-variants selects Grade I ('cholecystitis' keyword checked first).] |

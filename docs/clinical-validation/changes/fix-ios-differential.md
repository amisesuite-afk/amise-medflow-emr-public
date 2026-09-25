# Change log — `fix-ios-differential` (iOS Bayesian differential and DiagnosticDatabase.json)

Owner-authorised "fix all gaps" programme, 2026-09-25. Area: the iOS differential only —
`ios/AmiseMedFlow/Resources/DiagnosticDatabase.json`, `BayesianDiagnosisEngine*.swift`,
`BayesianDecisionEngine*.swift` (duplicate scoring / top-results extensions kept in step), the early
chief-complaint list and Bayesian route selection, and their tests. Not touched: ClinicalPathwayEngine
/ triage, DiagnosisRadiationEngine cards, score auto-populators, ConsultPathway, web code.

Everything below is **deterministic** (no AI, no network) and **unreviewed**: every prior tier,
likelihood ratio, threshold and citation needs the surgeon's check before release (list at the
end). The differential remains a suggestion list; nothing is ordered or recorded without the
clinician.

## Results

Swift cannot be compiled in this environment, so the iOS effect was measured with a TypeScript
port of the engine (routing switch translated from the Swift source, scoring, feature network,
top results, chips, applicability) run over the same 397 vignettes and graded like the iOS
runner. Baseline: `docs/clinical-validation/results/ios-latest.jsonl` (run 36164058813, fallback
mode: the 1.0.0 database never decoded). The real numbers come from the next iOS CI run.

| iOS differential expectations | Critical fail | Critical pass | Quality fail | Quality pass | Empty differential |
|---|---|---|---|---|---|
| Before (ios-latest, fallback lists) | 201 (mustNotMiss 98, mustRankTopK 103) | 44 | 85 | 23 | 138 of 397 vignettes |
| After (simulated, 2.0.0) | 18 (mustNotMiss 7, mustRankTopK 11) | 227 | 54 | 54 | 0 |

216 expectations go from fail to pass. Two go from pass to fail, both `quality`:
`acutemed-sepsis-afebrile-elderly-urinary/mnm-urinary-source` (urinary tract infection is sixth;
sepsis leads) and `cholangitis-tg18-charcot-sepsis/dx-cholangitis-top1` (choledocholithiasis 21,
cholangitis 17). No critical expectation regresses.

Web (`pnpm --filter @workspace/scripts run clinval:web`): unchanged, as expected for an iOS-only
branch — 397 vignettes, 3087 expectations, 1938 pass, 1057 fail, 92 n/a, **0 blocking** before and
after. Results files were restored, not committed.

Remaining simulated critical failures (for the next round):

- ACS presenting atypically (`acutemed-acs-atypical-diabetic-woman`, `mi-presenting-as-epigastric-pain`):
  the complaint does not route to chest pain and the ECG/troponin are not yet resulted.
- High-risk PE with shock (`acutemed-pe-high-risk-shock`, `periop-postop-pe-high-risk-shock`): PE is
  shown fifth (a "do not miss" place) behind ACS, sepsis and heart failure, so top 3 fails.
- Boerhaave (`boerhaave-classic-mackler`, `-presenting-as-chest-pain`): shown fifth or not at all.
- `aortoenteric-fistula-herald-bleed`, `gastric-outlet-obstruction-elderly`,
  `gyn-pid-tubo-ovarian-abscess-sepsis`, `cholecystitis-acalculous-icu` (complaint "fever" does not
  bring the gallbladder in), `cellulitis-sepsis-elderly-diabetic` (sepsis and NSTI), `nsti-early-low-lrinec`,
  `pancreatitis-severe-organ-failure`, `periop-postop-anastomotic-leak-day5`, `ppu-elderly-steroids-masked`,
  `thyroid-post-op-neck-haematoma`, `appendicitis-elderly-atypical/mnm-mesenteric-ischaemia` (its
  earlier pass came from a cross-field "lactate … raised" match on a normal lactate, see engine
  change 8).

`knownGap: ["ios"]` removed where the simulated result now passes with a wide margin:
`appendicitis-adult-typical` (dx-appendicitis-top3, dx-appendicitis-top1),
`cholecystitis-tg18-grade1`, `-grade2`, `-grade3-organ-dysfunction` (dx-cholecystitis-top3). Left in
place (simulated pass is marginal or the flag also covers web): `appendicitis-pregnant-t2/mnm-pyelonephritis`,
`cholangitis-tg18-grade3-reynolds/mnm-septic-shock`. No expectation was weakened or deleted.

## Engine behaviour changes (`BayesianDiagnosisEngine*.swift`, mirrored in `BayesianDecisionEngine+Scoring/TopResults.swift`)

1. **Routing reads the chief complaint only.** Before: investigation names and results were
   appended to the complaint before the routing switch, so a report ("US: gallstones", "urine
   dipstick") could replace the complaint's pool, and a route with no built-in list emptied the
   differential. After: `RouteText(baseCC)` for the switch; the investigation-first overlays (AFP,
   CA19-9, troponin, lipase …) still add pools from `evL` = complaint + investigation lines, and
   never replace the route. Both are matched **negation-aware at word starts** through
   `NegationMatcher` ("no vomiting" does not route to vomiting; "pe" is not found inside "pelvic").
2. **Displayed probability units.** logPrior / logLR / logPosterior are `round(ln × 5)`
   (`conversionFormula`); the softmax in `topResults` exponentiated them as natural logs, so a
   10-unit lead showed as e¹⁰ (≈100 %) instead of e² (88 %). Now divided by
   `BayesianDiagnosisEngine.logUnitsPerNat = 5`. The feature-network discount works in natural-log
   units too. The confidence bands on logGap are unchanged.
3. **Urgency no longer adds to the posterior.** Before: `urgency × 8` (up to +24 ≈ LR 120) was added
   after scoring, so every critical diagnosis outranked better-supported ones. After: ranks 1–3 are
   the three most probable diagnoses and ranks 4–5 are held for the most probable urgency ≥ 2
   (emergency / critical) candidates not already shown (`dontMissSlots = 2`), falling back to the
   next most probable. Urgency labels are unchanged. Stable sort on ties.
4. **Condition-neutral safety net.** When the complaint matches a `presentations` entry (29, table
   below), its curated `coreConditions` candidates go first and replace same-named or superseded
   legacy entries; every legacy entry that has a curated equivalent is replaced wherever it comes
   from (`curatedReplacements`). The unreviewed matrix cross-query now only widens complaints that
   match no presentation. Candidate cap 45 → 60 (curated first).
5. **Applicability filter.** `applicability` (sex, min/max age, pregnancy required / possible /
   excluded). Pregnancy status is read negation-aware from the complaint, HPI, PMH, examination and
   investigation text (there is no pregnancy field on the Patient model); a recorded hysterectomy is
   "not pregnant". Unknown age (0) or unspecified sex never filters.
6. **Age-banded vital-sign chips.** Tachycardia, bradycardia, tachypnoea and hypotension use APLS 7th
   edition (ALSG 2023) limits below 16 years (`VitalLimits`); adult limits unchanged. Age 0 (infant
   or no date of birth) uses the infant band.
7. **Numeric laboratory chips.** A numeric result ("Potassium 7.2") produced no chip before, because
   the chip loop looks for words such as "raised". `numericLabChips(LabPanel.parse(...))` adds:
   WBC > 11 or < 4; CRP > 10; lactate ≥ 2 (Sepsis-3); bilirubin > 21 µmol/L; ALT/AST > 40 and
   ≥ 1000 U/L ("markedly raised transaminases"); ALP > 130; lipase > 180 and amylase > 300 U/L
   (> 3 × ULN, revised Atlanta 2012); hs-troponin > 14 ng/L (ESC 2023); D-dimer > 500 µg/L;
   creatinine > 130 µmol/L; potassium ≥ 6.0 (UK Kidney Association 2023); sodium < 130
   (European hyponatraemia guideline 2014); adjusted calcium > 2.6 mmol/L; glucose < 4.0 (JBDS 2023),
   > 11 and ≥ 30 mmol/L (JBDS HHS 2022); haemoglobin < 10 g/dL; INR > 1.5; platelets < 100.
   Values in the other common unit are recognised by size only where the ranges cannot overlap.
8. **Scoring of curated features.** New keys `complaint` (the chief complaint only), `finding`
   (complaint + HPI + examination + PMH + PSHx + chips + resulted reports, negation-aware, word
   start), `findingAbsent` (mentioned only as negative, and no alternative affirmed), `notFinding`
   (a cardinal feature missing from the whole record; LR < 1). `a|b` is any alternative; the terms
   of `a&b` must now occur **in one sentence, one result line or one chip** (`FeatureText`): before,
   "lactate&raised" paired a normal "Lactate 1.4" line with a "raised WBC" chip. HPI is now passed to
   `infer` from the Diagnosis tab (`ConsultationView+DiagnosisTab.swift`) and by the clinical
   validation runner, which mirrors it.
9. **Legacy feature matching tightened.** Singleton keys (`fever_jaundice_ruf`) need every token of
   one `_or_` group; a negated value ("absent") needs the finding to be mentioned; `inv` /
   `investigations` values need **every** significant token in one test name or report (was 60 %:
   "irregular gallbladder wall thickening" fired on "oedematous gallbladder wall thickening").
10. **Deterministic pools.** Matrix pools are iterated in sorted order with a name tie-break
    (dictionary order made the list vary between launches).

## Database changes (DiagnosticDatabase.json 1.0.0 → 2.0.0)

Built by a reproducible script (not committed; rules in the file's `note`):

- **Decodes.** 3,552 features without `evidenceLabel` given a label derived from the value (6,531
  generic labels such as "Strong+" replaced); 512 fractional logLR in 8 pools (ENT, rheumatology,
  tropical, prostate) that were in natural-log units converted × 5; 135 fractional logPrior; 98
  non-string values (60 numbers, 38 booleans; `sex_female: false` → `sex_male`).
- **Priors.** Every logPrior replaced by a prevalence tier on one scale: common 0, uncommon −5,
  rare −10 (1, 1/e, 1/e²). Before: no source and two scales (−46…+46 and −5.5…−0.5). Tiers were
  derived from each pool's own ordering; the curated pool's tiers are set per candidate (table).
- **1.0.0 weights capped** (10,689 features; `originalLogLR` keeps the old value): history /
  examination ±8 (LR 0.2–5), test result ±12 (LR 0.09–11), age / sex ±5, a bare test name ("crp":
  the test was done, not its result) +3, a non-specific laboratory chip as an association (raised
  WBC, CRP, lactate, liver enzymes, bilirubin, INR, D-dimer, ESR, LDH, glucose, renal impairment,
  anaemia) +5. Reason: 77 of the 112 citations that state an LR disagreed with the stored logLR,
  and uncapped legacy features (e.g. "irregular gallbladder wall thickening" +12, Charcot's triad
  +8 for alcoholic hepatitis) outranked the evidence.
- **Sex / pregnancy applicability** on 85 legacy candidates from ICD-10 chapter or name (e.g. O*,
  N70–N98 female; N40–N51 male; Fournier's, hernia and breast conditions for both), and their sex
  features removed.
- **New pool `coreConditions`**: 121 curated candidates across medicine, surgery, obstetrics,
  paediatrics and neurology. Each feature has `likelihoodRatio`, `logLR = round(5 ln LR)` and a
  `citation`; each candidate a `source` naming the guideline or study with its year, `urgency`,
  `prevalenceTier`, `systems`, `specialties`, optional `applicability` and `supersedes` (legacy
  near-duplicates it replaces, e.g. "Urosepsis" under Sepsis). 49 candidates carry a `notFinding`
  feature (cardinal feature absent from the record, LR 0.1–0.4 ≈ (1 − sensitivity) / specificity
  in the cited source).
- **`presentations`** (29): complaint keywords → curated candidates, so every complaint gets the
  common and dangerous causes from every specialty.

Checks: `scripts/src/diagnostic-database-schema.ts` mirrors the Swift Codable structs field by
field (and the separately decoded `presentations`), flags integer fields written as decimals, and
enforces the 2.0.0 rules (presentations and supersedes name real candidates, every curated feature
has a citation and an LR matching its logLR, every curated source has a year, tiers are 0/−5/−10).
`lint:guideline-registry` now **fails** (was a warning) when the file would not decode.
`clinical-content/registry.json`: `ios-bayesian-diagnostic-database` 1.0.0 → 2.0.0 with a changelog
entry; `ios-bayesian-engine` lists `BayesianDiagnosisEngine+Routing.swift` and the new test.
`lastReviewed` stays "unknown".

Tests: `scripts/src/diagnostic-database-schema.test.ts` (bundled file decodes and meets the
rules; each mismatch kind); `ios/AmiseMedFlowTests/BayesianDifferentialDatabaseTests.swift`
(both engines decode the bundled file, Settings → Diagnostics says "Using the database", every
presentation resolves, 26 complaints from every specialty return a differential, investigation
text does not replace the route, RouteText negation / word start, probability units, "do not
miss" places, applicability and pregnancy status, APLS limits, numeric lab chips, sentence-scoped
"&", documented-absent); `DiagnosticDatabaseLoadReportTests` now asserts instead of only printing.

## Curated content (after; "1.0.0" column = what existed before)

| Candidate | ICD-10 | Tier | Urgency | Applies to | 1.0.0 | Source (candidate) |
|---|---|---|---|---|---|---|
| Acute Coronary Syndrome | I24.9 | uncommon | 3 | all | same name in 2 pool(s) | Prior tier uncommon (ACS is ~10-15% of acute chest pain; far lower for other complaints). LRs: Swap & Nagurney JAMA 2005; Panju JAMA 1998; ESC 2023 ACS guideline. |
| Pulmonary Embolism | I26.99 | uncommon | 3 | all | same name in 2 pool(s) | Prior tier uncommon. LRs: Wells Ann Intern Med 2001; West QJM 2007; ESC 2019 PE guideline (D-dimer, CTPA). |
| Aortic Dissection | I71.00 | rare | 3 | all | same name in 2 pool(s) | Prior tier rare. LRs: Klompas JAMA 2002; ESC 2024 aortic guideline. |
| Pneumothorax | J93.9 | uncommon | 2 | all | same name in 2 pool(s); supersedes Spontaneous Pneumothorax, Primary Spontaneous Pneumothorax, Pneumothorax (PE differential) | Prior tier uncommon. Signs and imaging per BTS pleural disease guideline 2023. |
| Community-Acquired Pneumonia | J18.9 | common | 2 | all | same name in 2 pool(s); supersedes Pneumonia / Pulmonary Sepsis | Prior tier common. LRs: Metlay JAMA 1997; BTS 2009 / NICE NG138 (chest X-ray as reference standard). |
| Asthma (Acute Exacerbation) | J45.901 | common | 2 | all | same name in 1 pool(s); supersedes Asthma | Prior tier common. BTS/SIGN 158 (2019); Holleman JAMA 1995. |
| COPD Exacerbation | J44.1 | common | 2 | all | same name in 1 pool(s); supersedes Chronic Obstructive Pulmonary Disease (COPD) | Prior tier common. GOLD 2024; Holleman JAMA 1995 (smoking history). |
| Acute Heart Failure / Pulmonary Oedema | I50.9 | uncommon | 2 | all | new; supersedes Heart Failure, Heart Failure with Reduced EF (HFrEF), Heart Failure with Preserved EF (HFpEF), Acute Left Heart Failure / Pulmonary Oedema, Heart Failure with Reduced EF, Heart Failure Preserved EF (HFpEF), Chronic Heart Failure | Prior tier uncommon. LRs: Wang JAMA 2005; ESC 2021 HF guideline. |
| Atrial Fibrillation | I48.91 | common | 2 | all | same name in 1 pool(s) | Prior tier common (the commonest sustained arrhythmia). Cooke J Fam Pract 2006; ESC 2024 AF guideline. |
| Supraventricular Tachycardia (SVT) | I47.1 | uncommon | 1 | all | same name in 1 pool(s) | Prior tier uncommon. ESC 2019 SVT guideline. |
| Ventricular Tachycardia | I47.2 | rare | 3 | all | same name in 1 pool(s) | Prior tier rare. ESC 2022 ventricular arrhythmia guideline. |
| Complete Heart Block / Symptomatic Bradyarrhythmia | I44.2 | rare | 3 | all | new; supersedes Complete Heart Block (CHB) | Prior tier rare. ESC 2021 pacing guideline; ESC 2018 syncope guideline. |
| Aortic Stenosis (Cardiac Syncope) | I35.0 | rare | 2 | all | new | Prior tier rare. ESC 2018 syncope guideline (exertional syncope is high risk); Etchells JAMA 1997; ESC/EACTS 2021 valve guideline. |
| Acute Pericarditis | I30.9 | uncommon | 1 | all | new | Prior tier uncommon. ESC 2015 pericardial disease guideline (diagnostic criteria). |
| Anaphylaxis | T78.2XXA | uncommon | 3 | all | same name in 1 pool(s) | Prior tier uncommon. WAO 2020 anaphylaxis guidance; Resuscitation Council UK 2021; Campbell JACI 2012 (NIAID/FAAN criteria sensitivity 97%, specificity 82%). |
| Acute Urticaria / Angioedema (without anaphylaxis) | T78.3XXA | common | 1 | all | new; supersedes Urticaria (Acute / Chronic), Urticaria / Angioedema | Prior tier common. WAO 2020 guidance (urticaria/angioedema without airway or circulatory involvement). |
| Hypertensive Emergency | I16.1 | rare | 3 | all | new; supersedes Hypertensive Urgency / Crisis, Hypertensive Urgency / Emergency, Hypertensive Encephalopathy / PRES | Prior tier rare. ESH 2023 hypertension guideline (hypertensive emergency: severe hypertension with acute organ damage). |
| Oesophageal Perforation (Boerhaave) | K22.3 | rare | 3 | all | new | Prior tier rare. Søreide & Viste Scand J Trauma Resusc Emerg Med 2011 (Mackler triad). |
| Gastro-oesophageal Reflux Disease | K21.9 | common | 0 | all | new; supersedes Gastro-oesophageal reflux disease, GERD / Oesophagitis | Prior tier common. Clinical features per NICE CG184 (2014, updated 2019) dyspepsia and GORD. |
| Musculoskeletal Chest Wall Pain | R07.89 | common | 0 | all | new | Prior tier common. Swap & Nagurney JAMA 2005 (palpation-reproducible pain lowers ACS likelihood). |
| Panic Attack / Anxiety | F41.0 | common | 0 | all | new | Prior tier common. Diagnosis of exclusion after serious causes are considered (NICE CG113, 2011, updated 2020). |
| Acute Ischaemic Stroke | I63.9 | uncommon | 3 | all | new; supersedes Ischaemic Stroke | Prior tier uncommon. Goldstein & Simel JAMA 2005 (FAST features: facial paresis, arm drift, abnormal speech, each LR ~2-5); NICE NG128. |
| Transient Ischaemic Attack | G45.9 | uncommon | 2 | all | same name in 1 pool(s) | Prior tier uncommon. NICE NG128 (2019, updated 2022). |
| Subarachnoid Haemorrhage | I60.9 | rare | 3 | all | same name in 1 pool(s) | Prior tier rare. Perry JAMA 2013 (Ottawa SAH rule); NICE NG228 (2022). |
| Bacterial Meningitis / Meningococcal Sepsis | G00.9 | rare | 3 | all | new; supersedes Bacterial Meningitis, Meningococcal Septicaemia, Bacterial Meningitis (Child) | Prior tier rare. Attia JAMA 1999 (absence of fever, neck stiffness and altered mental state makes meningitis unlikely); Thompson Lancet 2006; NICE NG240 (2024). |
| Giant Cell Arteritis | M31.6 | rare | 2 | ≥40 y | new; supersedes Temporal Arteritis (Giant Cell Arteritis), Giant Cell Arteritis (Temporal Arteritis) | Prior tier rare. Smetana & Shmerling JAMA 2002 (jaw claudication LR 4.2; age < 50 makes GCA very unlikely). |
| Tension-Type Headache | G44.209 | common | 0 | all | same name in 1 pool(s) | Prior tier common. ICHD-3 (2018) criteria; NICE CG150. |
| Migraine | G43.909 | common | 0 | all | new; supersedes Migraine Without Aura, Migraine With Aura | Prior tier common. ICHD-3 (2018); NICE CG150. |
| Cauda Equina Syndrome | G83.4 | rare | 3 | all | same name in 3 pool(s) | Prior tier rare. GIRFT national suspected CES pathway 2023 (red flags: saddle anaesthesia, bladder or bowel dysfunction, bilateral radicular symptoms). LRs are conservative estimates from the pathway's red-flag list. |
| Metastatic Spinal Cord Compression | G95.20 | rare | 3 | all | same name in 1 pool(s); supersedes Malignant Spinal Cord Compression, Spinal Cord Compression (Malignant) | Prior tier rare. NICE NG234 (2023). |
| Spinal Epidural Abscess | G06.1 | rare | 3 | all | same name in 2 pool(s) | Prior tier rare. Davis J Emerg Med 2004 (classic triad back pain, fever, deficit). |
| Epileptic Seizure | G40.909 | uncommon | 2 | all | new; supersedes Generalised Tonic-Clonic Epilepsy, Transient Loss of Consciousness Epilepsy | Prior tier uncommon. Sheldon JACC 2002 (tongue biting, post-ictal confusion); NICE NG217 (2022). |
| Delirium (Acute Confusional State) | F05 | common | 2 | all | new; supersedes Delirium | Prior tier common in older inpatients. NICE CG103 (2010, updated 2023). |
| Subdural Haematoma | I62.00 | rare | 2 | all | new | Prior tier rare. NICE NG232 (2023) head injury (anticoagulation and age as risk factors). |
| Diabetic Ketoacidosis | E10.10 | uncommon | 3 | all | new | Prior tier uncommon. JBDS-IP 2023 (ketones ≥3 mmol/L or ketonuria ++, pH <7.3 or bicarbonate <15); Kitabchi Diabetes Care 2009; MHRA 2016 on SGLT2 inhibitors. |
| Hyperosmolar Hyperglycaemic State | E11.00 | rare | 3 | all | new; supersedes Hyperosmolar Hyperglycaemic State (HHS) | Prior tier rare. JBDS-IP HHS guideline 2022 (glucose ≥30 mmol/L, osmolality ≥320 mOsm/kg, no significant ketonaemia). |
| Hypoglycaemia | E16.2 | uncommon | 3 | all | new; supersedes Hypoglycaemic Collapse | Prior tier uncommon. JBDS-IP 2023 (hypoglycaemia <4.0 mmol/L). |
| Hyponatraemia | E87.1 | uncommon | 2 | all | new | Prior tier uncommon. European hyponatraemia guideline, Spasovski Eur J Endocrinol 2014. |
| Hypercalcaemia | E83.52 | rare | 2 | all | new | Prior tier rare. Society for Endocrinology acute hypercalcaemia guidance 2016. |
| Acute Kidney Injury | N17.9 | common | 2 | all | same name in 1 pool(s); supersedes Dehydration / Electrolyte Imbalance, Pre-renal AKI / Dehydration | Prior tier common in acutely unwell older adults. KDIGO 2012 AKI guideline; NICE NG148. |
| Thyrotoxicosis | E05.90 | uncommon | 1 | all | new; supersedes Hyperthyroidism, Hyperthyroidism / Graves' Disease | Prior tier uncommon. ATA 2016 hyperthyroidism guideline; NICE NG145. |
| Hypothyroidism | E03.9 | common | 0 | all | same name in 2 pool(s) | Prior tier common. NICE NG145 (2019). |
| Sepsis | A41.9 | uncommon | 3 | all | new; supersedes Gram-Negative Sepsis / Bacteraemia, Gram-negative Bacteraemia / Sepsis, Urosepsis, Intra-Abdominal Sepsis, Pneumonia / Pulmonary Sepsis, Candidaemia / Invasive Fungal Sepsis, Candidaemia / Fungal Sepsis | Prior tier uncommon. Sepsis-3 (Singer JAMA 2016; qSOFA, Seymour JAMA 2016); NICE NG51 (2024) high-risk criteria. Scored on organ dysfunction (hypotension, tachypnoea, altered mentation, lactate, perfusion) rather than fever alone, so the infection source keeps its own place in the list. |
| Neutropenic Sepsis | D70.9 | rare | 3 | all | new | Prior tier rare. NICE CG151 (2012): fever with neutrophils ≤0.5 × 10⁹/L during anticancer treatment. |
| Urinary Tract Infection (Cystitis) | N30.00 | common | 0 | all | new; supersedes Urinary Tract Infection | Prior tier common. Bent JAMA 2002 (dysuria LR 1.5, frequency 1.8, vaginal discharge LR 0.3); EAU 2024. |
| Acute Pyelonephritis | N10 | uncommon | 2 | all | same name in 1 pool(s); supersedes Pyelonephritis, Acute Pyelonephritis (Severe / Complicated), Pyelonephritis / Upper UTI, Febrile UTI (Pyelonephritis, Child) | Prior tier uncommon. EAU Urological Infections guideline 2024. |
| Obstructed Infected Kidney | N13.6 | rare | 3 | all | new | Prior tier rare. EAU Urolithiasis guideline 2024 (urgent decompression of an obstructed infected kidney). |
| Cellulitis | L03.90 | common | 1 | all | same name in 1 pool(s); supersedes Cellulitis / SSTI, Severe Cellulitis / SSTI, Cellulitis / Erysipelas, Erysipelas / Cellulitis | Prior tier common. IDSA SSTI guideline 2014; NICE NG141 (2019). Bilateral "cellulitis" is usually another diagnosis. |
| Skin Abscess | L02.91 | common | 1 | all | new | Prior tier common. IDSA SSTI guideline 2014 (fluctuance, purulence; ultrasound when unclear). |
| Necrotising Soft Tissue Infection (Necrotising Fasciitis) | M72.6 | rare | 3 | all | new; supersedes Necrotising Fasciitis, Necrotising Fasciitis of Foot / Lower Limb, Synergistic Necrotising Cellulitis (Type I NF), Necrotising Fasciitis (Type I — Polymicrobial), Necrotising Fasciitis Type I (Polymicrobial), Necrotising Fasciitis Type II (GAS / Streptococcal) | Prior tier rare. Fernando Ann Surg 2019 (examination and imaging accuracy; LRINEC too insensitive to exclude); WSES/SIS-E 2018. |
| Fournier's Gangrene | N49.3 | rare | 3 | all | same name in 3 pool(s) | Prior tier rare. EAU 2024; Sorensen & Krieger Urol Clin N Am 2016. Occurs in women (perineum/vulva) as well as men. |
| Septic Arthritis | M00.9 | uncommon | 2 | all | same name in 1 pool(s) | Prior tier uncommon. Margaretten JAMA 2007 (age >80 LR 3.5; prosthesis LR 3.1; skin infection LR 2.8). |
| Acute Gastroenteritis | A09 | common | 0 | all | same name in 1 pool(s) | Prior tier common. NICE CKS gastroenteritis 2024; ACG 2016 acute diarrhoeal infection guideline. |
| Clostridioides difficile Colitis | A04.72 | uncommon | 2 | all | new | Prior tier uncommon. IDSA/SHEA 2017 C. difficile guideline. |
| Dengue Fever | A90 | uncommon | 2 | all | same name in 2 pool(s) | Prior tier uncommon (endemic in the Caribbean). WHO 2009 dengue guideline; PAHO 2016. |
| Leptospirosis | A27.9 | rare | 2 | all | same name in 3 pool(s) | Prior tier rare. Haake & Levett 2015. |
| Deep Vein Thrombosis | I82.409 | common | 2 | all | same name in 2 pool(s) | Prior tier common among leg-swelling presentations. Wells NEJM 2003; NICE NG158 (2020); Goodacre BMC Med Imaging 2005 (compression ultrasound). |
| Superficial Thrombophlebitis | I80.00 | uncommon | 0 | all | same name in 1 pool(s) | Prior tier uncommon. NICE NG158 (2020): superficial vein thrombosis near the saphenofemoral junction needs imaging for DVT. |
| Acute Limb Ischaemia | I74.3 | rare | 3 | all | same name in 1 pool(s); supersedes Acute Arterial Embolism, Acute Thrombosis on Atherosclerosis | Prior tier rare. ESVS 2020 acute limb ischaemia guideline (the 6 Ps; embolic source). |
| Chronic Limb-Threatening Ischaemia | I70.229 | uncommon | 1 | all | new | Prior tier uncommon. Khan JAMA 2006 (examination for PAD); Global Vascular Guidelines 2019. |
| Symptomatic / Ruptured Abdominal Aortic Aneurysm | I71.3 | rare | 3 | all | new; supersedes Abdominal Aortic Aneurysm, Abdominal Aortic Aneurysm (AAA), Ruptured Abdominal Aortic Aneurysm, Intact / Symptomatic AAA | Prior tier rare. ESVS 2024 aorto-iliac guideline; Lederle & Simel JAMA 1999 (palpation of a pulsatile mass). |
| Acute Mesenteric Ischaemia | K55.019 | rare | 3 | all | same name in 2 pool(s); supersedes Acute Mesenteric Ischaemia (Vascular), Acute Mesenteric Ischaemia (Arterial Embolism), Mesenteric Ischaemia | Prior tier rare. ESVS 2017 mesenteric guideline (pain out of proportion, AF, lactate; CT angiography). |
| Aorto-Enteric Fistula | K63.2 | rare | 3 | all | new; supersedes Aortoenteric Fistula | Prior tier rare. ESVS 2020 vascular graft infection guideline: GI bleeding after aortic repair is an aorto-enteric fistula until proven otherwise. |
| Femoral Artery Aneurysm / Pseudoaneurysm | I72.4 | rare | 2 | all | same name in 1 pool(s) | Prior tier rare. ESVS 2024; Corriere & Guzman Semin Vasc Surg 2005. |
| Ectopic Pregnancy | O00.90 | uncommon | 3 | female, ≥10 y, ≤55 y, pregnancy possible | same name in 2 pool(s) | Prior tier uncommon in women of reproductive age with pain or bleeding. Crochet JAMA 2013 (cervical motion tenderness LR 4.9, peritoneal signs 4.5, adnexal mass 2.4); NICE NG126. |
| Miscarriage (Threatened / Incomplete) | O20.0 | common | 1 | female, ≥10 y, ≤55 y, pregnancy required | new | Prior tier common in early-pregnancy bleeding. NICE NG126 (2019, updated 2023). |
| Pre-eclampsia / HELLP Syndrome | O14.90 | uncommon | 3 | female, ≥10 y, ≤55 y, pregnancy required | new; supersedes Pre-eclampsia, Pre-eclampsia / Eclampsia, HELLP Syndrome | Prior tier uncommon. NICE NG133 (2019, updated 2023); ACOG PB 222 (2020). Applies from 20 weeks and up to 6 weeks postpartum. |
| Eclampsia | O15.9 | rare | 3 | female, ≥10 y, ≤55 y, pregnancy required | new | Prior tier rare. NICE NG133 (2019, updated 2023). |
| Placental Abruption | O45.90 | rare | 3 | female, ≥10 y, ≤55 y, pregnancy required | same name in 1 pool(s); supersedes Placenta Praevia / Abruption | Prior tier rare. RCOG Green-top 63 (2011) antepartum haemorrhage. |
| Hyperemesis Gravidarum | O21.1 | uncommon | 1 | female, ≥10 y, ≤55 y, pregnancy required | same name in 1 pool(s) | Prior tier uncommon. RCOG Green-top 69 (2016, updated 2024). |
| Ovarian Torsion | N83.519 | uncommon | 3 | female | same name in 4 pool(s); supersedes Ovarian Cyst / Torsion, Ovarian Cyst Torsion | Prior tier uncommon. Huchon Hum Reprod 2010 (sudden onset, vomiting, cyst >5 cm, no discharge); ACOG CO 783 (2019). Occurs before menarche too. |
| Pelvic Inflammatory Disease | N73.9 | uncommon | 1 | female, ≥12 y | same name in 2 pool(s); supersedes Pelvic Inflammatory Disease (PID) | Prior tier uncommon. CDC STI treatment guidelines 2021; BASHH PID guideline 2019. |
| Ruptured / Haemorrhagic Ovarian Cyst | N83.209 | uncommon | 2 | female, ≥10 y, ≤55 y | new | Prior tier uncommon. Huchon 2010 (adnexal emergencies). |
| Intussusception | K56.1 | uncommon | 3 | ≤6 y | same name in 2 pool(s) | Prior tier uncommon in children aged 3 months to 6 years. Weihmiller Pediatrics 2011; Hryhorczuk Pediatr Radiol 2009 (ultrasound sensitivity 97.9%, specificity 97.8%). |
| Infantile Hypertrophic Pyloric Stenosis | Q40.0 | uncommon | 2 | ≤0 y | new; supersedes Pyloric Stenosis, Hypertrophic Pyloric Stenosis | Prior tier uncommon in infants. Macdessi BMJ 1993; Hernanz-Schulman Radiology 2003. |
| Malrotation with Midgut Volvulus | Q43.3 | rare | 3 | ≤16 y | same name in 1 pool(s) | Prior tier rare. Williams Arch Dis Child 2007; APLS 7th edition: bilious vomiting in an infant is a surgical emergency until proven otherwise. |
| Testicular Torsion | N44.00 | uncommon | 3 | male | same name in 4 pool(s) | Prior tier uncommon. TWIST score (Barbosa J Urol 2013); EAU paediatric urology 2024. Also presents as groin or lower abdominal pain. |
| Epididymo-orchitis | N45.3 | uncommon | 1 | male | same name in 1 pool(s); supersedes Epididymo-Orchitis, Acute Epididymo-orchitis | Prior tier uncommon. EAU urological infections guideline 2024 (epididymitis). |
| Acute Urinary Retention | R33.9 | common | 2 | all | same name in 1 pool(s) | Prior tier common in older men. EAU non-neurogenic male LUTS guideline 2024. In women, or with saddle anaesthesia, consider cauda equina syndrome. |
| Renal / Ureteric Colic | N20.1 | common | 1 | all | same name in 1 pool(s); supersedes Renal Colic / Ureteric Calculus, Right Ureteric Colic, Ureteric Colic (Nephrolithiasis), Ureteric Colic / Renal Calculus | Prior tier common. EAU urolithiasis guideline 2024; STONE score (Moore BMJ 2014). |
| Acute Appendicitis | K35.80 | common | 2 | all | same name in 3 pool(s); supersedes Appendicitis (Presenting with Nausea), Appendicitis (Paediatric), Appendicitis (Gynaecological Mimic), Paediatric Appendicitis | Prior tier common. Andersson Br J Surg 2004 (RIF tenderness LR 7.3, migration 3.2, rebound 3.0, fever 1.9); WSES Jerusalem 2020. |
| Acute Cholecystitis | K81.0 | common | 1 | all | same name in 3 pool(s) | Prior tier common. Trowbridge JAMA 2003; Tokyo Guidelines 2018 (diagnosis by local + systemic signs + imaging). |
| Biliary Colic | K80.20 | common | 0 | all | same name in 2 pool(s) | Prior tier common. Trowbridge JAMA 2003; TG18. |
| Ascending Cholangitis | K83.09 | uncommon | 3 | all | same name in 3 pool(s) | Prior tier uncommon. Tokyo Guidelines 2018 (systemic inflammation + cholestasis + imaging). |
| Acute Pancreatitis | K85.90 | common | 2 | all | same name in 1 pool(s); supersedes Acute Gallstone Pancreatitis, Alcoholic Pancreatitis, Biliary Pancreatitis | Prior tier common. IAP/APA 2013; revised Atlanta 2012 (2 of 3: typical pain, enzymes >3× ULN, imaging). |
| Acute Diverticulitis | K57.32 | common | 1 | all | same name in 2 pool(s) | Prior tier common. WSES 2020 acute diverticulitis guideline. |
| Perforated Peptic Ulcer | K27.5 | uncommon | 3 | all | same name in 2 pool(s) | Prior tier uncommon. WSES 2020 perforated and bleeding peptic ulcer guideline. |
| Small Bowel Obstruction | K56.609 | common | 2 | all | same name in 2 pool(s) | Prior tier common in surgical abdominal pain with vomiting. Bologna ASBO guidelines (WSES 2017). |
| Incarcerated / Strangulated Hernia | K40.30 | uncommon | 3 | all | same name in 2 pool(s) | Prior tier uncommon. HerniaSurge international groin hernia guideline 2018. |
| Upper GI Bleeding (Peptic Ulcer) | K27.4 | common | 3 | all | new; supersedes Bleeding Peptic Ulcer | Prior tier common among GI bleeding presentations. BSG/ESGE upper GI bleeding guidance (2017, 2021). |
| Oesophageal Variceal Bleeding | I85.11 | uncommon | 3 | all | same name in 1 pool(s); supersedes Oesophageal Varices Bleed, Oesophageal Varices | Prior tier uncommon. BSG/ESGE guidance; Baveno VII (2022). |
| Colorectal Carcinoma | C18.9 | uncommon | 1 | all | same name in 2 pool(s) | Prior tier uncommon. NICE NG12 (2015, updated 2023) suspected cancer; BSG IDA guideline 2021. |
| Iron Deficiency Anaemia | D50.9 | common | 1 | all | same name in 4 pool(s) | Prior tier common. BSG IDA guideline 2021 (investigate the GI tract in men and post-menopausal women). |
| Perianal Abscess | K61.0 | common | 1 | all | same name in 3 pool(s) | Prior tier common. ASCRS 2022 anorectal abscess and fistula guideline. |
| Surgical Site Infection | T81.40XA | common | 1 | all | new; supersedes Superficial Surgical Site Infection, Deep Surgical Site Infection, Post-Operative Surgical Site Infection, Superficial SSI (Incisional), Deep Incisional SSI | Prior tier common after surgery. NICE NG125 (2019, updated 2020) surgical site infections; CDC NHSN SSI criteria (purulent drainage, erythema, deliberately opened wound). |
| Anastomotic Leak | K91.89 | rare | 3 | all | same name in 2 pool(s) | Prior tier rare overall (3-10% after colorectal anastomosis: the operation feature carries that context). Hyman Ann Surg 2007; den Dulk Eur J Surg Oncol 2009 (DULK score). |
| Inguinal Hernia | K40.90 | common | 0 | all | same name in 3 pool(s) | Prior tier common. HerniaSurge international groin hernia guidelines 2018 (lifetime risk 27% men, 3% women). |
| Femoral Hernia | K41.90 | uncommon | 2 | all | same name in 4 pool(s) | Prior tier uncommon. HerniaSurge 2018: femoral hernias are commoner in older women and have a high strangulation risk (repair urgently). |
| Umbilical / Paraumbilical Hernia | K42.9 | common | 0 | all | same name in 1 pool(s); supersedes Umbilical Hernia | Prior tier common. EHS/AHS guidelines on umbilical and epigastric hernias (Henriksen NA, Br J Surg 2020;107:171-90). |
| Incisional Hernia | K43.2 | common | 0 | all | same name in 4 pool(s) | Prior tier common after laparotomy (up to 20%). EHS incisional hernia guidelines (Sanders DL et al. Br J Surg 2023). |
| Obturator Hernia | K45.8 | rare | 3 | all | same name in 3 pool(s); supersedes Obturator / Spigelian Hernia | Prior tier rare. Petrie A et al. Obturator hernia: anatomy, embryology, diagnosis, and treatment. Clin Anat 2011;24:562-9. |
| Lymphadenopathy (Lymphoma / Metastatic / Reactive) | R59.9 | uncommon | 1 | all | new; supersedes Reactive Lymphadenopathy, Inguinal Lymphadenopathy, Lymphoma | Prior tier uncommon. NICE NG12 (2015, updated 2023): unexplained lymphadenopathy with B symptoms, suspected lymphoma pathway. |
| Anal Carcinoma | C21.0 | rare | 1 | all | same name in 1 pool(s) | Prior tier rare. ASCRS clinical practice guidelines for anal squamous cell cancers (Stewart DB, Dis Colon Rectum 2018;61:755-74). |
| Breast Carcinoma | C50.919 | uncommon | 1 | all | same name in 1 pool(s); supersedes Invasive Breast Carcinoma | Prior tier uncommon in symptomatic clinics (~5-10%). Barton MB et al. Does this patient have breast cancer? JAMA 1999;282:1270-80; NICE NG12 (2015, updated 2023). Men can have breast cancer. |
| Breast Abscess / Mastitis | N61.1 | common | 1 | all | new; supersedes Mastitis / Breast Abscess, Breast Abscess | Prior tier common. ABM clinical protocol #36 (2022) mastitis spectrum. |
| Fibroadenoma / Benign Breast Lump | D24.9 | common | 0 | all | new; supersedes Fibroadenoma | Prior tier common in younger women. Barton JAMA 1999. |
| Neck Haematoma after Neck Surgery (Airway Threat) | T81.0XXA | rare | 3 | all | new | Prior tier rare (1-2% after thyroidectomy). Iliff HA et al. DAS/BAETS/ENT UK guideline on haematoma after thyroid surgery. Anaesthesia 2022;77:82-95 (SCOOP: skin exposure, cut sutures, open skin, open muscles, pack). |
| Anaplastic Thyroid Carcinoma / Thyroid Lymphoma | C73 | rare | 3 | all | new; supersedes Anaplastic Thyroid Carcinoma, Thyroid Lymphoma | Prior tier rare. Bible KC et al. 2021 ATA guidelines for anaplastic thyroid cancer. Thyroid 2021;31:337-86. |
| Oesophageal / Gastric Carcinoma | C16.9 | uncommon | 1 | all | new; supersedes Oesophageal Carcinoma, Gastric Carcinoma, Gastric Cancer, Gastrointestinal Malignancy, Gastric / Oesophageal Malignancy Bleed | Prior tier uncommon. NICE NG12 (2015, updated 2023): urgent endoscopy for dysphagia, or age ≥55 with weight loss and upper abdominal pain, reflux or dyspepsia. |
| Achalasia | K22.0 | rare | 0 | all | same name in 3 pool(s) | Prior tier rare. ACG achalasia guideline 2020; Chicago Classification v4.0 (2021). |
| Pancreatic Carcinoma | C25.9 | uncommon | 1 | all | new; supersedes Carcinoma of Head of Pancreas, Pancreatic Ductal Adenocarcinoma, Periampullary / Pancreatic Head Carcinoma | Prior tier uncommon. NICE NG85 (2018) pancreatic cancer; NICE NG12. |
| Choledocholithiasis | K80.50 | uncommon | 1 | all | same name in 2 pool(s); supersedes Choledocholithiasis / CBD Stone | Prior tier uncommon. ASGE 2019 choledocholithiasis guideline (Buxbaum JL, Gastrointest Endosc 2019;89:1075-105). |
| Acalculous Cholecystitis | K81.0 | rare | 3 | all | same name in 1 pool(s) | Prior tier rare. Tokyo Guidelines 2018 (acalculous cholecystitis in the critically ill). |
| Alcoholic Hepatitis | K70.1 | uncommon | 2 | all | same name in 1 pool(s) | Prior tier uncommon. EASL alcohol-related liver disease guideline 2018; NIAAA consortia definition 2016. |
| Toxic Shock Syndrome (TSS) | A48.3 | rare | 3 | all | same name in 1 pool(s) | Prior tier rare. CDC case definitions 2010/2011: fever, rash, hypotension and multi-organ involvement. |
| Ischaemic Colitis | K55.9 | uncommon | 2 | all | same name in 2 pool(s) | Prior tier uncommon. ACG clinical guideline on colon ischaemia (2015). |
| Acute Viral Hepatitis | B19.9 | uncommon | 1 | all | new; supersedes Viral Hepatitis, Acute Hepatitis | Prior tier uncommon. EASL Clinical Practice Guidelines on hepatitis E (2018) and hepatitis B (2017); WHO hepatitis A. |
| Liver Abscess (Pyogenic / Amoebic) | K75.0 | uncommon | 2 | all | new; supersedes Hepatic Abscess (Pyogenic / Amoebic), Pyogenic / Amoebic Liver Abscess | Prior tier uncommon. Lardière-Deguelte S et al. Hepatic abscess: diagnosis and management. J Visc Surg 2015;152:231-43. |
| Hyperkalaemia | E87.5 | uncommon | 3 | all | new | Prior tier uncommon. UK Kidney Association clinical practice guideline: treatment of acute hyperkalaemia in adults (2023). |
| Diabetic Foot Infection / Osteomyelitis | E11.628 | uncommon | 2 | all | new; supersedes Diabetic Foot Osteomyelitis, Diabetic Foot Cellulitis / Soft Tissue Infection | Prior tier uncommon. IWGDF/IDSA 2023 guidelines on diabetes-related foot infections (Senneville É, Clin Infect Dis 2023). |
| Charcot Neuro-osteoarthropathy | M14.671 | rare | 1 | all | new; supersedes Charcot Neuropathic Arthropathy | Prior tier rare. Rogers LC et al. The Charcot foot in diabetes. Diabetes Care 2011;34:2123-9; IWGDF 2023. |

| Presentation | Keywords (examples) | Curated candidates |
|---|---|---|
| abdominalPain | abdom, tummy, belly, stomach, epigastr, iliac fossa … | 37: Acute Appendicitis, Biliary Colic, Acute Cholecystitis, Acute Pancreatitis, Renal / Ureteric Colic, Acute Gastroenteritis, Acute Diverticulitis, Small Bowel Obstruction, Perforated Peptic Ulcer, Ascending Cholangitis, Acute Pyelonephritis, Urinary Tract Infection (Cystitis), Ectopic Pregnancy, Ovarian Torsion, Pelvic Inflammatory Disease, Ruptured / Haemorrhagic Ovarian Cyst, Pre-eclampsia / HELLP Syndrome, Placental Abruption, Testicular Torsion, Acute Mesenteric Ischaemia, Symptomatic / Ruptured Abdominal Aortic Aneurysm, Acute Coronary Syndrome, Diabetic Ketoacidosis, Community-Acquired Pneumonia, Sepsis, Incarcerated / Strangulated Hernia, Intussusception, Malrotation with Midgut Volvulus, Clostridioides difficile Colitis, Oesophageal Perforation (Boerhaave), Colorectal Carcinoma, Liver Abscess (Pyogenic / Amoebic), Choledocholithiasis, Anastomotic Leak, Obturator Hernia, Pancreatic Carcinoma, Oesophageal / Gastric Carcinoma |
| chestPain | chest, retrosternal, pleuritic, angina | 12: Acute Coronary Syndrome, Musculoskeletal Chest Wall Pain, Gastro-oesophageal Reflux Disease, Pulmonary Embolism, Community-Acquired Pneumonia, Acute Pericarditis, Pneumothorax, Aortic Dissection, Oesophageal Perforation (Boerhaave), Panic Attack / Anxiety, Acute Heart Failure / Pulmonary Oedema, Atrial Fibrillation |
| breathlessness | breath, dyspn, sob, wheez, cannot breathe, can't breathe … | 13: Asthma (Acute Exacerbation), COPD Exacerbation, Community-Acquired Pneumonia, Acute Heart Failure / Pulmonary Oedema, Pulmonary Embolism, Acute Coronary Syndrome, Atrial Fibrillation, Anaphylaxis, Pneumothorax, Diabetic Ketoacidosis, Sepsis, Iron Deficiency Anaemia, Panic Attack / Anxiety |
| cough | cough, phlegm, sputum, haemoptysis, chest infection | 6: Community-Acquired Pneumonia, COPD Exacerbation, Asthma (Acute Exacerbation), Acute Heart Failure / Pulmonary Oedema, Pulmonary Embolism, Sepsis |
| palpitations | palpitat, racing heart, heart racing, fast heart, heart beat, heartbeat … | 11: Atrial Fibrillation, Supraventricular Tachycardia (SVT), Panic Attack / Anxiety, Thyrotoxicosis, Ventricular Tachycardia, Acute Coronary Syndrome, Pulmonary Embolism, Iron Deficiency Anaemia, Hypoglycaemia, Hyperkalaemia, Sepsis |
| collapse | collaps, blackout, black out, blacked out, faint, syncope … | 18: Complete Heart Block / Symptomatic Bradyarrhythmia, Atrial Fibrillation, Ventricular Tachycardia, Aortic Stenosis (Cardiac Syncope), Pulmonary Embolism, Hypoglycaemia, Acute Ischaemic Stroke, Transient Ischaemic Attack, Epileptic Seizure, Upper GI Bleeding (Peptic Ulcer), Ectopic Pregnancy, Symptomatic / Ruptured Abdominal Aortic Aneurysm, Sepsis, Acute Kidney Injury, Subdural Haematoma, Anaphylaxis, Hyperkalaemia, Delirium (Acute Confusional State) |
| headache | headache, head ache, migraine, thunderclap, head pain | 9: Tension-Type Headache, Migraine, Subarachnoid Haemorrhage, Bacterial Meningitis / Meningococcal Sepsis, Hypertensive Emergency, Giant Cell Arteritis, Acute Ischaemic Stroke, Pre-eclampsia / HELLP Syndrome, Subdural Haematoma |
| neurological | weak, numb, slurred, speech, facial droop, face droop … | 13: Acute Ischaemic Stroke, Transient Ischaemic Attack, Hypoglycaemia, Epileptic Seizure, Subarachnoid Haemorrhage, Subdural Haematoma, Hypertensive Emergency, Eclampsia, Bacterial Meningitis / Meningococcal Sepsis, Giant Cell Arteritis, Hyponatraemia, Metastatic Spinal Cord Compression, Cauda Equina Syndrome |
| confusion | confus, drowsy, not himself, not herself, altered, delirium … | 17: Delirium (Acute Confusional State), Sepsis, Hypoglycaemia, Acute Ischaemic Stroke, Hyponatraemia, Diabetic Ketoacidosis, Hyperosmolar Hyperglycaemic State, Urinary Tract Infection (Cystitis), Community-Acquired Pneumonia, Acute Kidney Injury, Hypercalcaemia, Hyperkalaemia, Subdural Haematoma, Anastomotic Leak, Bacterial Meningitis / Meningococcal Sepsis, Acute Urinary Retention, Hypertensive Emergency |
| fever | fever, pyrexia, temperature, rigor, shiver, chills … | 18: Sepsis, Community-Acquired Pneumonia, Urinary Tract Infection (Cystitis), Acute Pyelonephritis, Cellulitis, Bacterial Meningitis / Meningococcal Sepsis, Neutropenic Sepsis, Dengue Fever, Leptospirosis, Ascending Cholangitis, Liver Abscess (Pyogenic / Amoebic), Skin Abscess, Spinal Epidural Abscess, Anastomotic Leak, Surgical Site Infection, Necrotising Soft Tissue Infection (Necrotising Fasciitis), Septic Arthritis, Acute Gastroenteritis |
| vomiting | vomit, nausea, being sick, feeling sick, sickness, retching | 17: Acute Gastroenteritis, Diabetic Ketoacidosis, Small Bowel Obstruction, Acute Appendicitis, Acute Pancreatitis, Hyperemesis Gravidarum, Pre-eclampsia / HELLP Syndrome, Acute Kidney Injury, Acute Coronary Syndrome, Hypercalcaemia, Infantile Hypertrophic Pyloric Stenosis, Malrotation with Midgut Volvulus, Intussusception, Bacterial Meningitis / Meningococcal Sepsis, Oesophageal Perforation (Boerhaave), Testicular Torsion, Ovarian Torsion |
| diarrhoea | diarrhoea, diarrhea, loose stool, bowel habit | 7: Acute Gastroenteritis, Clostridioides difficile Colitis, Colorectal Carcinoma, Acute Kidney Injury, Acute Mesenteric Ischaemia, Acute Diverticulitis, Ischaemic Colitis |
| limb | leg, calf, thigh, foot, feet, ankle … | 13: Cellulitis, Deep Vein Thrombosis, Skin Abscess, Necrotising Soft Tissue Infection (Necrotising Fasciitis), Septic Arthritis, Acute Limb Ischaemia, Chronic Limb-Threatening Ischaemia, Superficial Thrombophlebitis, Acute Heart Failure / Pulmonary Oedema, Femoral Artery Aneurysm / Pseudoaneurysm, Diabetic Foot Infection / Osteomyelitis, Charcot Neuro-osteoarthropathy, Femoral Hernia |
| lumpSwelling | lump, swelling, swollen, boil, abscess, pus | 11: Skin Abscess, Cellulitis, Inguinal Hernia, Femoral Hernia, Incisional Hernia, Umbilical / Paraumbilical Hernia, Incarcerated / Strangulated Hernia, Lymphadenopathy (Lymphoma / Metastatic / Reactive), Femoral Artery Aneurysm / Pseudoaneurysm, Necrotising Soft Tissue Infection (Necrotising Fasciitis), Deep Vein Thrombosis |
| groinScrotalPerineal | groin, scrot, testic, testis, testicle, between the legs … | 13: Inguinal Hernia, Femoral Hernia, Incarcerated / Strangulated Hernia, Testicular Torsion, Epididymo-orchitis, Fournier's Gangrene, Perianal Abscess, Anal Carcinoma, Lymphadenopathy (Lymphoma / Metastatic / Reactive), Skin Abscess, Femoral Artery Aneurysm / Pseudoaneurysm, Renal / Ureteric Colic, Necrotising Soft Tissue Infection (Necrotising Fasciitis) |
| backPain | back pain, backache, back ache, low back, lower back, sciatica … | 8: Cauda Equina Syndrome, Metastatic Spinal Cord Compression, Spinal Epidural Abscess, Symptomatic / Ruptured Abdominal Aortic Aneurysm, Acute Pyelonephritis, Renal / Ureteric Colic, Aortic Dissection, Acute Pancreatitis |
| urinary | urine, urinary, pass water, passing water, dysuria, retention … | 9: Urinary Tract Infection (Cystitis), Acute Pyelonephritis, Acute Urinary Retention, Cauda Equina Syndrome, Renal / Ureteric Colic, Obstructed Infected Kidney, Acute Kidney Injury, Sepsis, Delirium (Acute Confusional State) |
| giBleed | vomited blood, vomiting blood, blood in vomit, haematemesis, hematemesis, coffee ground … | 8: Upper GI Bleeding (Peptic Ulcer), Oesophageal Variceal Bleeding, Aorto-Enteric Fistula, Colorectal Carcinoma, Acute Diverticulitis, Iron Deficiency Anaemia, Acute Mesenteric Ischaemia, Ischaemic Colitis |
| allergicSwelling | swollen lip, lip swelling, swollen tongue, tongue swelling, swollen face, facial swelling … | 6: Anaphylaxis, Acute Urticaria / Angioedema (without anaphylaxis), Asthma (Acute Exacerbation), Bacterial Meningitis / Meningococcal Sepsis, Cellulitis, Dengue Fever |
| pregnancy | pregnan, weeks pregnant, postpartum, post-partum, antenatal, gestation … | 12: Ectopic Pregnancy, Miscarriage (Threatened / Incomplete), Hyperemesis Gravidarum, Pre-eclampsia / HELLP Syndrome, Eclampsia, Placental Abruption, Pulmonary Embolism, Deep Vein Thrombosis, Acute Pyelonephritis, Acute Appendicitis, Acute Cholecystitis, Diabetic Ketoacidosis |
| diabetesGlucose | sugar, glucose, diabet, ketone, hypo , hypos … | 4: Diabetic Ketoacidosis, Hyperosmolar Hyperglycaemic State, Hypoglycaemia, Sepsis |
| jaundice | jaundice, yellow, icter | 9: Ascending Cholangitis, Choledocholithiasis, Pancreatic Carcinoma, Acute Viral Hepatitis, Liver Abscess (Pyogenic / Amoebic), Acute Pancreatitis, Leptospirosis, Pre-eclampsia / HELLP Syndrome, Sepsis |
| tiredness | tired, fatigue, exhaust, lethargy, lethargic, no energy … | 9: Iron Deficiency Anaemia, Hypothyroidism, Colorectal Carcinoma, Hypercalcaemia, Acute Heart Failure / Pulmonary Oedema, Acute Kidney Injury, Hyperosmolar Hyperglycaemic State, Hyperkalaemia, Oesophageal / Gastric Carcinoma |
| childUnwell | baby, infant, child, toddler, crying, screaming … | 10: Intussusception, Infantile Hypertrophic Pyloric Stenosis, Malrotation with Midgut Volvulus, Bacterial Meningitis / Meningococcal Sepsis, Urinary Tract Infection (Cystitis), Acute Appendicitis, Acute Gastroenteritis, Sepsis, Diabetic Ketoacidosis, Testicular Torsion |
| abdominalWallBulge | hernia, bulge, belly button, navel, umbilic, scar … | 10: Inguinal Hernia, Femoral Hernia, Umbilical / Paraumbilical Hernia, Incisional Hernia, Incarcerated / Strangulated Hernia, Lymphadenopathy (Lymphoma / Metastatic / Reactive), Femoral Artery Aneurysm / Pseudoaneurysm, Obturator Hernia, Skin Abscess, Testicular Torsion |
| postOperative | after operation, after his operation, after her operation, after bowel operation, after surgery, after the operation … | 16: Surgical Site Infection, Anastomotic Leak, Pulmonary Embolism, Community-Acquired Pneumonia, Deep Vein Thrombosis, Acute Urinary Retention, Delirium (Acute Confusional State), Acute Kidney Injury, Sepsis, Necrotising Soft Tissue Infection (Necrotising Fasciitis), Small Bowel Obstruction, Acute Coronary Syndrome, Neck Haematoma after Neck Surgery (Airway Threat), Hyperkalaemia, Diabetic Ketoacidosis, Atrial Fibrillation |
| breast | breast, nipple | 5: Breast Carcinoma, Fibroadenoma / Benign Breast Lump, Breast Abscess / Mastitis, Cellulitis, Skin Abscess |
| neck | neck, thyroid, goitre, goiter, throat | 6: Neck Haematoma after Neck Surgery (Airway Threat), Anaplastic Thyroid Carcinoma / Thyroid Lymphoma, Lymphadenopathy (Lymphoma / Metastatic / Reactive), Thyrotoxicosis, Anaphylaxis, Skin Abscess |
| upperGI | swallow, dysphagia, food sticking, indigestion, dyspeps, heartburn … | 10: Gastro-oesophageal Reflux Disease, Oesophageal / Gastric Carcinoma, Upper GI Bleeding (Peptic Ulcer), Acute Coronary Syndrome, Pancreatic Carcinoma, Colorectal Carcinoma, Iron Deficiency Anaemia, Thyrotoxicosis, Infantile Hypertrophic Pyloric Stenosis, Malrotation with Midgut Volvulus |

Every feature's likelihood ratio, label and citation is in the file
(`pools.coreConditions.candidates[].features[]`). Content decisions made while tuning against the
vignettes (each is in "Needs sign-off"):

- Acute cholecystitis: Murphy's sign documented negative LR 0.4 (Trowbridge JAMA 2003); no stones
  on imaging LR 0.3 (acalculous is 5–10 %, TG18); transaminases ≥ 1000 U/L LR 0.3 (expert estimate:
  points to hepatitis or ischaemic liver injury).
- Acalculous cholecystitis (new, rare, urgency 3): critical illness / burns / TPN LR 3; distended
  thick-walled gallbladder or pericholecystic fluid LR 5 (TG18).
- Alcoholic hepatitis (replaces the legacy entry, whose Charcot's-triad feature scored +8):
  heavy alcohol use LR 4 and, when no alcohol history is recorded, LR 0.1 (NIAAA definition
  requires heavy drinking); any mention of alcohol counts, the amount is not read.
- Acute viral hepatitis: transaminases ≥ 1000 U/L LR 4; exposure now includes "outbreak"; tender
  hepatomegaly LR 1.5.
- Toxic shock syndrome (replaces the legacy entry, which fired on any fever with hypotension):
  erythroderma LR 5, desquamation LR 4, tampon / packing / burn / postpartum / invasive group A
  streptococcus LR 3, and LR 0.3 when none of these is recorded (CDC 2010/2011 case definitions).
- Ischaemic colitis (replaces the legacy entry): rectal bleeding / bloody diarrhoea LR 3,
  segmental colonic wall thickening LR 6, age > 60 LR 2 (ACG 2015).
- Achalasia (replaces the legacy entry): solids and liquids from the start LR 6; nocturnal
  regurgitation LR 2; clearing manoeuvres LR 2; "liquids still go down" LR 0.5 (ACG 2020, Chicago
  v4.0).
- Oesophageal / gastric carcinoma: smoking, alcohol or long-standing reflux LR 1.5 (BSG/AUGIS 2011).
- Anaplastic thyroid carcinoma / lymphoma: urgency 2 → 3 (airway); rapid growth LR 3 (now includes
  "doubled"); stridor / hoarseness / dysphagia LR 3 and hard fixed mass LR 3 split from one LR 2
  feature (ATA 2021).
- Incarcerated / strangulated hernia: hernia at the painful site LR 2 → 3; fever, tachycardia,
  leucocytosis or raised lactate LR 2 (WSES 2017).
- Choledocholithiasis imaging wording widened ("bile duct … stone", "CBD … dilated"); renal colic
  imaging no longer matches any "stone in the …" (it caught "stone in the common bile duct").
- Placental abruption: "uterus … tender / firm", "moving less", "seat-belt".
- Community-acquired pneumonia: fever LR 1.7, tachypnoea LR 1.5, hypoxaemia LR 1.5 as separate
  features (were "cough & fever" combinations across fields, which the sentence rule would lose);
  anastomotic leak: fever or tachycardia LR 3 (the operation is required by its `notFinding`).
- Duplicate counting removed: a laboratory chip matched by a `finding` feature is no longer also an
  `associations` feature (sepsis and mesenteric ischaemia lactate, pancreatitis lipase / amylase,
  hypercalcaemia, AKI renal impairment).

## Needs sign-off

Surgeon (and, where marked, physician / obstetric / paediatric colleagues) before release:

1. **Turning the database on at all.** 2.0.0 decodes, so the iOS differential switches from the
   built-in lists to this content on the next app build. The CLAUDE.md gotcha says this needs the
   surgeon's sign-off and the vignette suite. Conservative alternative: ship the engine fixes with
   the database file held back (the fallback lists stay in use).
2. **Prior tiers** (common / uncommon / rare = 0 / −5 / −10) for all 121 curated candidates (table)
   and the rank-derived tiers of the 1.0.0 pools. They are condition-neutral population estimates,
   not per-complaint probabilities.
3. **Caps on the 1.0.0 content** (±8 / ±12 / ±5 / +5 / +3). The alternative is to review the 1,232
   legacy candidates one by one; until then they are unreviewed.
4. **Urgency boost removed; two "do not miss" places** (ranks 4–5 for urgency ≥ 2). Conservative
   alternative: three places (ranks 3–5), which shows more dangerous diagnoses and fewer probable
   ones.
5. **Complaint-weight features** (key `complaint`, 130 features cited "expert estimate pending the
   surgeon's review"): LR 1.2–4 for the presenting complaint matching a candidate. No published LR
   exists for these.
6. **`notFinding` likelihood ratios** (49 candidates, LR 0.1–0.4): e.g. no chest, arm, jaw,
   epigastric or breathing symptom for ACS (LR 0.3, Canto JAMA 2000 — atypical ACS is real);
   no operation with an anastomosis for anastomotic leak (0.1); no alcohol history for alcoholic
   hepatitis (0.1).
7. **Applicability and pregnancy.** Pregnancy is read from free text (no Patient field): a pregnant
   patient whose notes never say so will not see pregnancy-only diagnoses (pre-eclampsia / HELLP,
   abruption, hyperemesis). Ectopic pregnancy is "possible" in females 10–55 unless pregnancy is
   recorded as excluded. Needs obstetric sign-off.
8. **Children's vital-sign limits** (APLS 7th edition bands; age 0 = infant band, so an adult without
   a date of birth gets fewer tachycardia / tachypnoea chips, never more). Needs paediatric sign-off.
9. **Numeric laboratory thresholds** (engine change 7), including the unit-guessing rule (calcium
   ≥ 5 read as mg/dL, glucose ≥ 100 as mg/dL, haemoglobin ≥ 25 as g/L).
10. **Content decisions listed above** (cholecystitis, acalculous, alcoholic and viral hepatitis,
    TSS, ischaemic colitis, achalasia, oesophageal cancer, anaplastic thyroid, hernia, CAP, leak).
11. **Medical, obstetric and paediatric candidates** (ACS, PE, AF, HF, anaphylaxis, DKA / HHS,
    hypoglycaemia, stroke, SAH, meningitis, sepsis, pre-eclampsia / HELLP, ectopic, intussusception,
    pyloric stenosis, malrotation and the rest of the table): content outside general surgery that
    a physician, obstetrician or paediatrician should check.
12. **Matrix skipped when a presentation matches** (its system-wide extras were unreviewed noise);
    complaints matching no presentation still use it.
13. **HPI now read by the differential.** Findings written only in the HPI now count; a negation the
    matcher misses ("not able to pass urine" is read as affirmed "pass urine") can now affect the
    list.
14. **Citations.** Every citation was written from the literature without a check against the
    source; each must be verified before the registry's `lastReviewed` is set.

## Not done / follow-ups

- The iOS app was not built or run here: the Swift changes were checked by reading (every new
  type is nested in `BayesianDiagnosisEngine`, names checked for clashes against this branch and
  `origin/claude/pr-37-gbg22z`). The first iOS CI run is the real result; re-triage every iOS
  differential flag on it (engine mode changes from `fallback` to `database`).
- 18 simulated critical failures remain (listed above); most need either a result that is not in
  the vignette at the time of the list (ECG, troponin) or a choice between two correct
  diagnoses for three places (sepsis vs its source).
- `BayesianDecisionEngine` keeps its own copies of the database, scoring and top-results
  extensions; the scoring and top-results copies were changed in step (they differ only in the
  extended type), its `CandidateSpec` copy was not given `applicability` / `supersedes` (extra keys
  are ignored, so it decodes 2.0.0 as the load test checks).
- CLAUDE.md ("iOS DiagnosticDatabase.json probably does not load") and `.claude/skills/ios-arch`
  describe the 1.0.0 state; left for the owner to update.
- The early chief-complaint list (`ConsultationView.swift`) uses the same `infer` and benefits from
  the routing and safety net without a code change.

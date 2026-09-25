# Clinical content inventory

| | |
|---|---|
| Status | v0.1, 2026-09-25. Engineering inventory for clinical review; **not a clinical review** |
| Code baseline | `60e2b15` (branch `claude/pr-37-gbg22z`) plus the `content-upgrades` commits |
| Machine-readable form | `clinical-content/registry.json`, checked by `pnpm --filter @workspace/scripts run lint:guideline-registry` |
| Upgrade design | `docs/CLINICAL-CONTENT-UPGRADES.md` |
| Related | `docs/compliance/clinical-safety-case.md` §7, `docs/compliance/hazard-log.md`, `docs/compliance/medical-device-positioning.md` |

This document lists every source of clinical knowledge in the iOS app, the web dashboard, the API
server, the front-desk app and the database seed. For each source it gives the location, the
format, how it is versioned today, its guideline citations, and who can change it. Section 4 also
covers the maths of the two Bayesian engines and where their priors and likelihoods come from.

"Clinical content" here means any value that can change what a clinician or patient is shown about
diagnosis, severity, escalation, investigation, treatment, dose or preparation. Documentation
templates and coding catalogues are included at lower priority because they shape the record.

## 1. Summary

| Measure | Count |
|---|---|
| Rule sets registered | **44**, in about 220 files |
| Rule sets with a content version | **2 of 44**. `DiagnosticDatabase.json` (`"version"`, stamped `1.0.0` in this change) and `lib/triage-engine/src/rules.ts` (`RULES_VERSION = '1.2.0'`). Neither version was shown to users or stored with a result before this change. The database version now appears in iOS Settings → Diagnostics |
| Rule sets with a documented clinical review (date + reviewer) | **0 of 44** |
| Rule sets with no guideline recorded at all | **32 of 44** |
| Citation status | Per rule: 5. Per rule, partial: 1. File header only: 3. Some rules only: 14. **None: 21** |
| Rule sets with tests | 19 of 44. Rule sets with a CI content check: 19 of 44 (lints for parity, phases, prep wording) |
| Change control | Everything is code or bundled data. Any repository committer can change it. There is no `CODEOWNERS` file, so there is no required clinical reviewer. **Two sources can change at runtime without a trace**: the `clinical_guidelines` table (any authenticated user can edit it, through the RLS policy "staff access" `FOR ALL`) and the iOS `CustomDrugStore` (drug names only, per device) |
| Delivery | Web, API and front desk: live on deploy. iOS: only with an app release (bundled). Database seed: when the migration runner is run |

Evidence that exists but is not a clinical review:

- **Surgeon decisions recorded in commits.** These cover the preparation wording (2026-09-24, `38a7891`, `b9ae85b`, `996fe1b`) and the bowel-prep rules in the `BowelPrepProtocols.swift` header.
- **Engineering fixes against a named standard.** NEWS2 against RCP 2017 (H-04, `e682e87`). Drug-interaction class mapping (H-07).
- **The dx-variants phase audit** of 2026-08-15. The reviewer is not recorded.
- **The in-app bowel-prep sign-off** (`BowelPrepSignOff`). It is stored per device in UserDefaults, not in the repository.

## 2. Critical findings

These are not guideline questions. They are defects in how the content is loaded or combined, so
they come before any content upgrade. None of them is fixed in this change, because each fix
changes what clinicians see. Each needs surgeon or CSO sign-off and a vignette regression run
(`docs/clinical-validation/`).

| # | Finding | Evidence | Effect |
|---|---|---|---|
| C-1 | **The iOS engine probably cannot decode `DiagnosticDatabase.json`, so the differential silently uses its built-in lists.** `CandidateSpec` needs `logPrior: Int`, `logLR: Int`, `evidenceLabel: String` and `value: String`. The file has 3,552 features with no `evidenceLabel`, 332 fractional `logLR` values (for example `1.8`), 95 fractional `logPrior` values and 98 non-string `value`s (for example `60`, `true`). `JSONDecoder` rejects the whole file on the first of these, and `static let externalDatabase = { try? ... }()` turns that into `nil` without logging | `BayesianDiagnosisEngine+Database.swift:12-78`. The same structs are duplicated in `BayesianDecisionEngine+Database.swift`. The new lint reproduces the Codable rules. Replaying the same checks over the file's history shows it last passed at `9ac04f4`; from `b4990ad` on (2026-09-20) it has fields the structs cannot read | The differential runs on 40 built-in pools (191 candidates, **no citations**) instead of 161 pools (1,232 candidates). **117 of 164 complaint routes have no built-in fallback (`?? []`), so they return an empty differential.** The diagnosis catalogue sheet and the cross-specialty matrix query are empty. This is static analysis: the Swift code could not be run here. Settings → Diagnostics now shows "Using the database (N pools)" or "Built-in fallback lists" with the decoding error, so it can be confirmed on a device |
| C-2 | **Displayed probabilities use the wrong log base.** `logLR` is stored as `round(5 × ln LR)`, but `topResults` computes `exp(logPosterior − max)`, which treats each unit as a whole natural-log unit | `BayesianDiagnosisEngine+TopResults.swift:21-25`. The database's `conversionFormula` gives the ×5 scale | Every gap is exaggerated by a power of 5. A 10-unit gap (about LR 7) is shown as odds of e¹⁰ ≈ 22,000:1, so the leader shows as about 100%. The percentages cannot be read as probabilities |
| C-3 | **The DAG discount compares natural logs with ×5 units.** `BayesianFeatureNetwork.adjustedLogLR` returns `ln(P(B\|A)/P(B\|¬A))` (for example 0.98), then takes `min(baseLogLR, adj)` against a base in ×5 units (for example 10) | `BayesianFeatureNetwork.swift:46-56, 164-182` | Any correlated feature whose parent fired is cut to about 1/5 or less of its intended weight. The discount is far larger than the CPT implies |
| C-4 | **Priors are on two scales and have no source.** Most pools use integers from −46 to +46 ("higher = more prevalent"). Seventeen pools use −5.5 to −0.5 (they look like natural-log prevalence). Pools are merged (`mergePool`, matrix) as if the scales were the same | `DiagnosticDatabase.json` pools such as `biliaryColic`, `acutePancreatitis`, `rightIliacFossaPain` | The rank order across merged pools is arbitrary. None of the 1,232 priors has a recorded source or setting |
| C-5 | **Likelihoods do not match their own citations.** 112 citations state an LR. For **77 of them** the stored `logLR` is off by more than 1 from `round(5 × ln LR)`. Examples: bilirubin for choledocholithiasis (LR 4.5 → should be 8, stored 12); haematuria for renal colic (LR 6.0 → 9, stored 16) | Recomputed from the file | The weights are not the cited evidence, even where a citation exists |
| C-6 | **Absent findings are ignored, and only positive evidence counts.** Only 125 of 14,358 features are negative. A finding the clinician did not record, or recorded as absent, changes nothing unless its value is one of a few negation words | `BayesianDiagnosisEngine+Scoring.swift` | Candidates with long feature lists gain the most. "Not recorded" and "absent" are treated the same way |
| C-7 | **6,136 distinct feature keys.** 78 keys have explicit matching. The rest go through a heuristic: half of the key's words appearing anywhere in the record. That can fire on a negated mention ("no fever") | `+Scoring.swift` `default:` branch | Features can fire unpredictably. There is no test of which features can fire at all |
| C-8 | **The web differential (`pane-engine`) cites nothing.** 130 diseases have 710 hand-set sensitivities, `DEFAULT_SENSITIVITY = 0.30` for every unlisted feature, and 58 prior modifiers (labelled "Caribbean burden-of-disease data", with no source). Nine older single-disease files that *do* cite sources are never imported | `lib/pane-engine/src/vademecum/index.ts` imports only `specialties/*` | The web and iOS differentials disagree by design. The one cited web source is dead code |
| C-9 | **`DiagnosisDosingGuide.lookup` is not deterministic.** It returns the first matching key while iterating a Swift `Dictionary`, and that order changes between launches | `DiagnosisDosingGuide.swift:24-27`. The keys include both "appendicitis" and "peritonitis" | "Perforated appendicitis with peritonitis" can show a different dosing list on different days |
| C-10 | **Scores are implemented twice, with no parity check.** About 100 iOS scores (`ClinicalScoringEngine*`) and the dashboard's `clinical-scales.ts`/`clinical-scores.ts` duplicate many of the same scores. Only NEWS2, drug interactions and the lab catalogue have parity checks | Registry entries `ios-clinical-scoring-engine`, `web-clinical-scales` | The same patient can get a different score on each platform (the H-04 pattern) |

## 3. Inventory

Priority follows the registry: **P1** means it could directly change a diagnosis, a dose, an
escalation or a patient instruction. **P2** means decision support with a clinician in the loop.
**P3** means reference catalogues. The "Who can change it" column is "any committer" unless it
says otherwise. iOS content ships only with an app release. Web content ships on deploy.

### 3.1 Bayesian and probabilistic diagnosis

| Registry id | Location | Format | Version today | Citations | Notes |
|---|---|---|---|---|---|
| `ios-bayesian-diagnostic-database` (P1) | `ios/AmiseMedFlow/Resources/DiagnosticDatabase.json` (3.8 MB) | JSON: `pools{name → candidates[{name, icd, logPrior, urgency, systems, specialties, features[{key, value, logLR, evidenceLabel, citation}]}]}`, plus `matrix` (system, specialty, complaint and urgency indices) | `"version": "1.0.0"`, `"updated": "2026-09-21"`, `"sources"` (added in this change). The old `"lastUpdated": "2026-09-20"` was not kept current. `poolVersion: "1.0"` in 86 of 161 pools. There is no changelog | Per feature: **8,316 of 14,358** features cite a source. Frequent sources: "Clinical" (211, no reference), NICE, EAU 2022/2023, Lancet/BMJ papers. **No prior has a source** | 161 pools, 1,232 candidates. See C-1, C-4, C-5, C-6, C-7 |
| `ios-bayesian-fallback-candidates` (P1) | `ios/AmiseMedFlow/Services/BayesianDiagnosisEngine+*Candidates*.swift` (8 files) | Swift array literals `[Candidate]` | None | **None** | 40 pools, 191 candidates. Probably what runs today (C-1) |
| `ios-bayesian-engine` (P1) | `BayesianDiagnosisEngine.swift` (4,120 lines), `+Scoring`, `+TopResults`, `+FeatureDAG`, `+Database`, `+Catalogue`, the `BayesianDecisionEngine*.swift` duplicates, `BayesianFeatureNetwork.swift` | Swift code with inline constants | None | None | Complaint routing (`switch` on complaint keywords), urgency boost, about 30 score-driven adjustments, confidence bands, DAG CPTs ("published clinical data and expert elicitation", with no references). See §4 |
| `ios-sequential-dbn-voi` (P2) | `SequentialDiagnosisEngine*.swift`, `DynamicBayesianNetwork*.swift`, `ValueOfInformationEngine.swift`, `BayesianSensorFusion.swift`, `ClinicalChangePointDetector.swift` | Swift | None | A few inline | Transition matrices, CUSUM thresholds and value-of-information weights are hand-set |
| `ios-auto-function-engine` (P2) | `AutoFunctionEngine*.swift`, `ClinicalPipelineOrchestrator*.swift`, `ClinicalPathwayEngine.swift`, `SurgicalAlgorithmEngine.swift` | Swift | None | Some inline guideline names | "Ask/order next" suggestions and pipeline decisions (`BayesianDecisionEngine.decide`) |
| `ios-bayesian-input-mapping` (P2) | `EncounterQuestionnaire.swift`, `ClinicalTextParser.swift`, `Views/Consultation/ConsultationViewChipData.swift`, `ConsultationViewEarlyForms.swift` | Swift | None | None | Turns intake answers, chips and free text into feature strings. A mismatch in spelling means a feature never fires |
| `pane-engine-disease-model` (P1) | `lib/pane-engine/src/vademecum/specialties/*.ts` (20 files), `_other.ts`, `registry.ts`, `index.ts`, `priors.ts`, `engine/{bayes,infoGain,likelihood,modifiers}.ts`, `constants.ts`; feature mapper `artifacts/dashboard/src/lib/socrates-to-features.ts` | TypeScript objects `DiseaseNode{id, label, icd10, prior, course, applicability, features{featureId → P(feature\|disease)}}`; `Feature{baseRate}` | `PANE_MODEL_VERSION` 1.0.0 | File headers name the guideline / study per module (approximate values, sign-off pending) | 187 diseases, 426 features; unmodelled findings at their background rate (was 0.30); frequency-tier priors; bounded sex likelihood ratios; applicability. C-8 (partly addressed 2026-09-25) |
| `pane-engine-orphan-vademecum` (P3) | `lib/pane-engine/src/vademecum/{appendicitis,cholangitis,cholecystitis,colorectalCancer,diverticulitis,gord,inguinalHernia,pancreatitis,pepticUlcer}.ts` | TypeScript | None | File headers (for example Alvarado 1986, Andersson 2004, WSES 2020) | **Not imported.** Merge after review, or delete |
| `web-clinical-cds` (P2) | `artifacts/dashboard/src/lib/clinical-cds.ts`, `clinical-inference.ts`, `transcript-dx-mapper.ts` | TypeScript rules | None | Some inline | Score suggestions, inference prompts, transcript → pane-engine features |

### 3.2 Scores and early warning

| Registry id | Location | Format | Version today | Citations | Notes |
|---|---|---|---|---|---|
| `ios-clinical-scoring-engine` (P2) | `ios/AmiseMedFlow/Services/ClinicalScoringEngine*.swift` (31 files) | Swift functions returning `ClinicalScore{…, evidenceNote}` | None | **Per score**: 106 `evidenceNote` strings across 101 score functions (for example "Alvarado 1986", "Tokyo Guidelines 2018 (TG18)", "Rockall 1996", "Blatchford 2000"). The file header lists NICE, ACS, EAST, WSES, TG18, Sepsis-3, BSG and SIGN | Tests: `ClinicalScoringEngineTests`, `ScoringEngineReferenceTests` (published weights and band boundaries for the acute scores). Some recommendations are directive (for example "cross-match ×4 units", "ITU admission") |
| `ios-score-autopopulator` (P2) | `PatientScoreAutoPopulator*.swift` (18 files) | Swift keyword lists and thresholds | None | None | Fills score inputs from the record. `LabScoreKeywords` copies its keyword lists and is kept in step by hand |
| `news2` (P1) | `ios/AmiseMedFlow/Services/NEWS2Chart.swift`, `lib/triage-engine/src/news2.ts`, `artifacts/dashboard/src/lib/vitals-news2-fields.ts` | Swift and TypeScript twins | None | RCP NEWS2, December 2017, Charts 1–3 (file headers) | One engine per platform with the same RCP boundary vectors (`NEWS2Tests.swift`, `news2.test.ts`). Fixed under H-04 on 2026-09-24. Scale 2 is a clinician opt-in only |
| `web-clinical-scales` (P2) | `artifacts/dashboard/src/lib/clinical-scales.ts`, `clinical-scores.ts` | TypeScript | None | Some per scale (derivation papers) | Duplicates many iOS scores with no parity test (C-10) |
| `ios-diagnosis-score-mapper` (P2) | `DiagnosisScoreMapper.swift`, `+Mappings.swift` | Swift mapping | None | A few | Working diagnosis / ICD / complaint → recommended scores |

### 3.3 Pathways, risk, screening and management

| Registry id | Location | Format | Version today | Citations | Notes |
|---|---|---|---|---|---|
| `ios-consult-pathway` (P2) | `ios/AmiseMedFlow/Services/ConsultPathway.swift` | Swift enum + `recommend(for:)` | None | None (practice workflow) | 7 pathways. Tests: `ConsultPathwayTests` |
| `ios-visit-risk-assessment` (P2) | `VisitRiskAssessment.swift` | Swift rules | None | None | NEWS2, anticoagulants, diabetes, BMI, smoking, pregnancy potential, surgical timeline. Flags only |
| `ios-screening-engine` (P2) | `ios/AmiseMedFlow/Views/Consultation/PathwayData.swift` (`ScreeningEngine`, also the Parkland burns fluid data) | Swift rules | None | "Based on USPSTF recommendations adapted to common Caribbean practice" (comment only; no years) | The items match current USPSTF intervals for breast (40–74), colorectal (45–75) and lung (50–80, 20 pack-years). Local adaptations (diabetes screening from 35; PSA from 45 for African-Caribbean men) need a named decision-maker |
| `ios-diagnosis-radiation-engine` (P2) | `DiagnosisRadiationEngine.swift`, `+DiseaseDictionary*.swift` (8 files), `+PrecedenceCards.swift`, `+AdditionalCards.swift`, `+SafetyFilter.swift` | Swift dictionaries: investigations, plan template, billing codes, consent category, score variables; patient safety filter (age, pregnancy, allergies, antithrombotics) | `DiagnosisRadiationEngine.contentVersion` (1.1.0) | Guideline names in many rationale strings (NICE 33, ESC, AHA, IDSA, ACG, …), mostly without years; the 2026-09 cards and filter cite guideline + year per line | Presented, never auto-applied |
| `ios-clinical-acuity-engine` (P1) | `ClinicalAcuityEngine.swift`, `+Signals.swift`, `+Recognition.swift`, `PregnancyContext.swift` | Swift rules: triage level (max of CC keywords, NEWS2 / paediatric vital signs, BP, critical labs, ECG, text alarms, recognition rules, confirmed diagnosis), recognise-and-redirect alerts | `ClinicalAcuityEngine.rulesVersion` (1.0.0) | Per rule (RCP NEWS2 2017, NICE NG51/NG143/NG136/NG133, UKKA 2023, JBDS, RCUK 2021, Sepsis-3) | Only raises the level; non-surgical emergencies carry the 911 / OKEU, St Jude's or Tapion redirect |
| `ios-surgical-vademecum` (P2) | `SurgicalVademecum*.swift` (11 files) | Swift monographs | None | Mainly choledocholithiasis, gallbladder and pancreatitis | 6 of 10 monographs name no source |
| `ios-management-engine` (P1) | `ManagementEngine*.swift` | Swift | None | Inline (WSES, Tokyo/TG18, NICE, BSG, EAST, Sepsis-3), mostly without years | Management plans for acute abdomen, bowel and critical care |
| `ios-surgical-risk-engine` (P2) | `SurgicalRiskEngine*.swift` | Swift rules | None | A few in `SurgicalRiskEngine.swift`; none in `+RiskRules` | |
| `pane-engine-management-protocols` (P1) | `lib/pane-engine/src/management/protocols/*.ts` (11 files), `index.ts`, `types.ts` | TypeScript `ManagementProtocol{keyPoints, redFlags, investigations[{lrPos?}], management[{phase, step}], medications[{drugName, dose, frequency, route}]}` | None | **Almost none**: guideline names appear in about 10 step texts. `ManagementProtocol` has no guideline field | 129 protocols, **708 medication entries with doses** |
| `dx-variants` (P2) | `artifacts/dashboard/src/lib/dx-variants.ts` + the reference table in `.claude/skills/emr-review/SKILL.md` | TypeScript | None | **Per variant**, through the SKILL.md table: WSES 2020 (appendicitis), TG18, WSES/EHS 2018 (hernia), WSES 2017 (adhesive SBO), WSES 2015 (diverticulitis; a 2020 WSES update exists, so check it), revised Atlanta 2012, BSG/ESGE 2021 | 10 groups, 31 variants. `lint:dx-phases` enforces the phase table and the disease ids. Engineering audit 2026-08-15 |
| `web-decision-support-pathways` (P2) | `artifacts/dashboard/src/lib/clinical-pathways.ts` | TypeScript | None | Some inline | Differentials, red flags and suggested tests per symptom |
| `triage-pathways` (P2) | `lib/triage-engine/src/pathways.ts`, `pathway-matcher.ts` | TypeScript | None | Some inline, without years | EMR-section completion guidance |
| `ios-procedure-templates` (P3) | `ProcedureTemplate*.swift` | Swift templates | None | Few | Operative and endoscopy notes. Includes quality items such as caecal intubation and the Boston scale |
| `clinical-guidelines-table-seed` (P2) | `supabase-clinical-guidelines-migration.sql` → table `clinical_guidelines` | SQL seed rows `{condition_icd10[], guideline_source, title, summary, key_recommendations, evidence_grade, published_year}` | `published_year` per row. There is no row versioning | Per row | Read by the AI consultant tab. **Any authenticated user can edit it at runtime, and the edits are not versioned** |

### 3.4 Medicines

| Registry id | Location | Format | Version today | Citations | Notes |
|---|---|---|---|---|---|
| `drug-interactions` (P1) | `artifacts/dashboard/src/lib/drug-interactions.ts`, `drug-classes.ts`; `ios/AmiseMedFlow/Services/DrugInteractionService.swift`, `DrugClasses.swift` | Rule pairs `{drugs, severity, effect, action}` + class member lists | None | Class terms name BNF / Stockley's / SmPC (no edition). **Individual rules have no citation** | 62 web rules, about 64 iOS rules. `lint:interaction-parity`. One grade difference is waiting for the surgeon (opioid + benzodiazepine). Not pharmacist-reviewed (H-08) |
| `web-outpatient-formulary` (P1) | `lib/triage-engine/src/formulary.ts` | TypeScript `Medication{code, genericName, brandNames, class, commonDoses[], indications, contraindications, …}` | None | None | 97 medications |
| `web-inpatient-formulary` (P1) | `artifacts/dashboard/src/lib/prescription-formulary.ts` | TypeScript `{drugName, defaultDose, defaultFrequency, defaultRoute}` | None | None | 43 drugs. About 28 doses were spot-checked against the outpatient list (engineering) |
| `web-dosing-tab` (P1) | `artifacts/dashboard/src/pages/tabs/DosingTab.tsx` | Dose data **inside a React component**, plus CrCl, IBW and BMI helpers | None | None | Move the data into a module before it can be versioned |
| `ios-surgical-formulary` (P1) | `SurgicalDrug.swift`, `SurgicalDrug+Formulary*.swift`, `CustomDrugStore.swift` | Swift array literals `{name, category, commonDoses, route, notes, sideEffects}` | None | None | About 370 drugs. `CustomDrugStore`: user-added names in UserDefaults (no doses) |
| `ios-diagnosis-dosing-guide` (P1) | `DiagnosisDosingGuide.swift` | Swift dictionary `diagnosis key → [DosingEntry]` | None | None | 14 keys, 72 entries. C-9 |

### 3.5 Procedures and patient-facing text

| Registry id | Location | Format | Version today | Citations | Notes |
|---|---|---|---|---|---|
| `ios-bowel-prep` (P1) | `BowelPrepProtocols.swift`, `BowelPrepProtocols+Patient.swift` | Swift regimen data + timing engine + safety suggestions | **Implicit**: an FNV-1a fingerprint of each regimen's wording. The surgeon's sign-off lapses when the wording changes | ESGE 2019 (Hassan C, et al. *Endoscopy* 2019;51:775–794) and product labelling. `[confirm]` placeholders block sign-off | Six regimens. Surgeon's rule: clear fluids until 2 h before; never nil by mouth from midnight. **The model for sign-off elsewhere** |
| `api-server-prep-templates` (P1) | `artifacts/api-server/src/lib/sms.ts` | TypeScript string constants | None | None | `outbound-safety.test.ts` (H-10). The surgeon's decisions of 2026-09-24 |
| `front-desk-patient-instructions` (P1) | `artifacts/front-desk/lib/instructions.ts`; service pages under `artifacts/front-desk/app/services/*`, `app/pathway`, `app/book/BookingForm.tsx`; staff text in `artifacts/dashboard/src/pages/tabs/BookingInboxTab.tsx` | TypeScript objects `ProcedureInstructions` + page text | None | None | `lint:patient-instructions` (H-10). Emailed automatically on booking |
| `front-desk-health-information` (P2) | `artifacts/front-desk/content/health-info.ts` (+ `health-info-governance.ts`); pages `app/health-information/*`, staff preview `app/staff/health-information` | TypeScript `HealthArticle[]`: sections, urgent-care signs, sources, per-article `status`/`version`/`lastReviewed`/`reviewedBy`/`reviewDue` | **`HEALTH_INFO_LIBRARY_VERSION`**, plus a version per article | Per article (guideline and year) | Ten drafts, none public until the surgeon approves each. `lint:patient-instructions` (text) and `lint:guideline-registry` (review fields). Workflow: `CLINICAL-CONTENT-UPGRADES.md` §9 |
| `outbound-content-safety-filter` (P2) | `artifacts/api-server/src/lib/outbound.ts` (`FORBIDDEN_PATTERNS`) | Regular expressions | None | None | A second, older list is in `rules.ts` |

### 3.6 Triage and red flags (shared `lib/triage-engine`)

| Registry id | Location | Format | Version today | Citations | Notes |
|---|---|---|---|---|---|
| `triage-rules-red-flags` (P1) | `lib/triage-engine/src/rules.ts` | TypeScript: `RED_FLAGS` (regex patterns), slot rules, exclusions, public holidays, pathway definitions, reminder cascade, `FORBIDDEN_PATTERNS` | **`RULES_VERSION = '1.3.0'`**, not recorded with results | Chest pain pathway: ESC 2023 | Hazard H-01: no sensitivity evidence. 1.3.0 narrowed the cardiac rule (E2) and removed "breathless" from the post-operative concern |
| `apcq-question-bank` (P1) | `lib/triage-engine/src/apcq.ts` | TypeScript `QUESTION_BANK` with `isRedFlag` / `urgencyIfSelected` | None | None | 62 red-flag options. Drives the patient-facing ER/911 redirect |
| `adaptive-triage` (P1) | `lib/triage-engine/src/adaptive-triage.ts` | TypeScript rules | None | Some (RCP NEWS2 2017; NICE NG51 / NG143 paediatric limits) | Inline adult vital-sign thresholds (for example HR > 120, SpO₂ < 94); children under 16 use `paediatricVitalLimits()`. Level = max of text rules, vitals / NEWS2, BP, critical labs, ECG and confirmed diagnosis |
| `emergency-recognition` (P1) | `lib/triage-engine/src/emergency-recognition.ts` | TypeScript rules → `RecognisedEmergency` (level, reasons, suggested first actions, redirect), safeguarding flags, risk modifiers | **`EMERGENCY_RULES_VERSION = '1.0.0'`** | Per rule (guideline and year in the rule text) | Recognise-and-redirect layer used by `adaptiveTriage` and the dashboard's clinical prompts; redirect names 911 and OKEU, St Jude's or Tapion Hospital |
| `cancer-screening` (P2) | `lib/triage-engine/src/cancer-screening.ts` | TypeScript criteria `{rule, met, guideline}` (1.1.0 rules also carry `id`, `site`, `investigations`) | **`CANCER_SCREENING_VERSION = '1.1.0'`** | Per criterion: NICE NG12 (2015 for the 1.1.0 rules; older rules unversioned), NICE DG56 2023 (FIT), BSG 2021 (IDA) | 1.1.0 reads Hb, ferritin and FIT from results (SURGEON-DECISIONS C9/C1) |
| `preventive-screening` (P2) | `lib/triage-engine/src/screening/preventive.ts`, `artifacts/dashboard/src/lib/preventive-screening-prompts.ts` | TypeScript rules → dashboard preventative prompts | **`PREVENTIVE_SCREENING_VERSION = '1.0.0'`** | Per rule: USPSTF (primary), ACG 2021 / US MSTF 2017 and 2020, NCCN 2024 / ACR 2023, ADA 2024, NICE NG136, CDC 2023 | Web port of the iOS `ScreeningEngine` (G2.19); iOS differences listed in `docs/clinical-validation/changes/fix-web-screening.md` |
| `surgical-dictionary` (P2) | `lib/triage-engine/src/surgical-dictionary.ts` | Keyword → pathology | None | Some | |
| `coding-catalogues` (P3) | `lib/triage-engine/src/condition-codes.ts`, `surgical-catalog.ts` | Code lists | None | ICD-10 (edition not recorded) | |
| `lab-report-import-catalog` (P3) | `lib/triage-engine/src/report-import/catalog.ts`, `ios/AmiseMedFlow/Services/LabAnalyteCatalog.swift` | Analyte names, units, exact conversion factors, plausible ranges | None | None | `lint:report-import-parity` |

### 3.7 Adjacent content, not registered

- **AI system prompts** (API routes, front-desk `lib/claude.ts`). The safety case (§7) counts them as clinical content. Register them when AI is re-enabled for clinical use.
- **`SOAPDraftEngine`**. Drafts documentation from the record and holds no thresholds. It is listed under `excluded` in the registry, with the report parsers and the PDF renderers.

## 4. The Bayesian engines in detail

### 4.1 iOS: `BayesianDiagnosisEngine` (naive Bayes in integer log units)

1. **Routing.** The chief complaint, plus the names and results of investigations, is matched by keyword (a long `switch true`) to one or more pools: `externalPool(name) ?? builtIn`. `matrixCandidates` adds more candidates from the matrix indices, with critical and emergency diagnoses always included.
2. **Score.** For each candidate:
   `logPosterior = logPrior + Σ effectiveLR(f)` over the features that fired, where
   `effectiveLR(f) = logLR(f)`, or the DAG-discounted value when a correlated parent fired (C-3).
3. **Additions after scoring:**
   - an urgency boost of `+8 × urgency` (0–3)
   - `+20` for a diagnosis confirmed at an earlier encounter
   - about 30 score-driven adjustments (Alvarado, Glasgow, Ranson, Tokyo, Rockall, Blatchford, Wells, qSOFA, BISAP, SOFA, …)
   - "longitudinal" merges of earlier investigations
4. **Output.** The top 5 by `logPosterior`.
   - Confidence comes from the log gap to rank 2: ≥25 "Certain", ≥15 "High", ≥7 "Moderate". A fired feature with `logLR ≥ 18` (a "pathognomonic" finding) raises it to "High".
   - The displayed % is a softmax over `exp(logPosterior − max)` (C-2).

**Where the numbers come from:**

- **`logLR`.** The file's note says `round(ln(LR±) × 5)`, "LR from the cited source, median of a range". 42% of features have no citation. Where an LR is stated, 69% do not match the conversion (C-5). The "Clinical" citation (211 features) names no source. Values in 17 pools look like natural logs, not ×5 units.
- **`logPrior`.** No source for any candidate. The code comment says only "higher = more prevalent in this CC context". The scales are mixed (C-4). The built-in lists use a third set of hand-set integers.
- **Urgency, boosts, confidence bands and CPTs.** Inline constants with no source. The CPTs are described as "published clinical data and expert elicitation".
- **Features.** Matched by substring against free text and chips. Unknown keys (about 6,000) are matched by a word heuristic (C-7). Absent findings are ignored (C-6).

### 4.2 Web: `lib/pane-engine` (normalised naive Bayes over sensitivities)

- **Priors.** `prior` is a base rate in "surgical OPD" (for example appendicitis 0.08). The priors are normalised over the 130 registered diseases, which makes it a closed world: the true diagnosis is assumed to be in the list.
- **Modifiers.** `applyModifiers` multiplies priors by age and sex rules (`SURGICAL_OPD_MODIFIERS`, 58 rules, no source).
- **Update.** `P(D|F) ∝ P(F|D) · P(D)`, with `P(F=1|D) = features[f]`, or `DEFAULT_SENSITIVITY = 0.30` when the disease does not list the feature, and `1 − that` for an absent finding. This handles absent findings, unlike iOS. But a feature a disease does not mention is still treated as present 30% of the time.
- **Stopping and next question.** `nextBestQuestion` picks the question by expected information gain. It stops at a posterior of 0.85 (`CONVERGENCE_THRESHOLD`) or after 8 questions.
- **Where the numbers come from.** Nowhere recorded (C-8). The sensitivities are plausible textbook values, but there is no link to a study, and no specificity data: specificity is implied only by the other diseases in the list.

### 4.3 Consequences for "room for upgrades"

- The engines cannot take literature likelihood ratios as they stand. iOS needs one unit system and a working decoder. The web engine models sensitivities, not LRs.
- There is no calibration: no test says "for this vignette, the leader should be X with probability within Y".
- There is no way to tell which content version produced a displayed differential.

These are addressed in `docs/CLINICAL-CONTENT-UPGRADES.md` §4.

## 5. Keeping this inventory current

- The registry (`clinical-content/registry.json`) is the source of truth. This document is its narrative.
- `lint:guideline-registry` fails CI when:
  - a file in the inventory's pattern list (`KNOWN_RULE_SET_FILES` in the lint) is not covered by a registry entry
  - a registered path disappears
  - a version stamp disagrees with the registry
- It warns about files that look like clinical content but are not registered.
- Add a new rule set to all three places (this document, the lint's list and the registry) in the same PR.

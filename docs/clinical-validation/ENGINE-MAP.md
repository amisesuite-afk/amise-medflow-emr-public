# Consultation decision pipeline — engine map

Phase 0 of the clinical validation work. This file records which engine the consultation calls at
each step, what it reads from the record, what it produces, and which output is authoritative for
each clinical question. The vignette harnesses (`ios/AmiseMedFlowTests/ClinicalValidation/`,
`scripts/src/clinval/`) call exactly these functions. Read-only: nothing here changes an engine.

Mapped at `claude/pr-37-gbg22z` 499a886 (2026-09-25).

## iOS (primary app)

`ConsultationView` (`ios/AmiseMedFlow/Views/Consultation/`) drives everything. Order of calls in a
new consultation:

| # | Trigger (view code) | Engine · entry function | Reads (Patient / view state) | Produces | Shown as |
|---|---|---|---|---|---|
| 1 | `handleAppear` | `ConsultPathway.from(visitType) ?? ConsultPathway.recommend(for:)` (`Services/ConsultPathway.swift`) | `chiefComplaint` (burn/trauma/check-up words), `visitType`, `setting`, `ward`, `operationDate`, completed `encounters` | `Recommendation { pathway, reasons }`: firstVisit, followUp, wardReview, procedure, trauma, burns, wellness | First-door sheet; step order of the tab bar |
| 1 | Risk step (`RiskSnapshotCard`) | `VisitRiskAssessment.assess(_:pathway:)` | latest `vitalsEntries` (NEWS2), `acuity`, `dateOfBirth`, `allergies`, `prescriptions` (anticoagulants, diabetes drugs), `pmhEntries`/`pmhNotes`, BMI, `socialHistory`, `postOpDays`, stored scores (ASA, RCRI, STOP-BANG, Caprini, CFS, MUST, qSOFA, HAS-BLED, GCS, eGFR) | `[RiskFlag]` (info / moderate / high) | Risk snapshot card |
| 1 | Always | Allergy banner (`ConsultationView+Banners.allergyBanner`) | `allergies` | Red "ALLERGY ALERT" banner (also shows the NKDA marker) | Top of the consultation |
| 2 | `onChange(chiefComplaint)` | `BayesianDiagnosisEngine.infer(chiefComplaint:socratesSelections: [:], pmhNotes:, surgicalHistory:, …, ageYears:, sex:, specialtyHint:)` | CC, PMH/PSHx entries, age, sex | Early differential, `prefix(4)` | CC tab |
| 2 | CC debounce 0.8 s → `runPathway()` | `ClinicalPathwayEngine.assess(chiefComplaint:pmh:)` (`Services/ClinicalPathwayEngine.swift`) | CC text and PMH text **only** (keyword lists) | `TriageResult { suggestedAcuity, redFlags, pathway, differentials }` — `ConsultationView+Sheets` sets `patient.acuity` to it only when it is more urgent (`Acuity` raw value lower), so it can escalate but never de-escalate | CC tab triage card; `acuity` |
| 3 | `onChange(hpi / examGeneral / examAbdo / investigationsJson)`, Diagnosis tab | `refreshBayesian()` → `ClinicalTextParser.parse(hpi:examGeneral:examAbdo:examOther:notes:)` | HPI, exam text, resulted investigations as "name: result" | `featureAugments` (SOCRATES-keyed chips), `clinicalAlarms` (FAST, thunderclap, sepsis, ruptured AAA, NF, limb ischaemia, UGI bleed, torsion, meningism, obstruction + peritonism, haemodynamic instability, dissection, pneumoperitoneum, malignancy), `ccHint` | Red/orange alarm banner |
| 3 | same | `BayesianDiagnosisEngine.infer(…)` with augmented SOCRATES, all exam fields, investigations, vitals (HR, SBP, T, SpO₂, RR, NEWS2), longitudinal context | See left; routes by CC keyword + investigation names/results appended to the CC | `[DiagnosisResult]` top 5 (name, ICD, displayed %, confidence from log-gap, urgency) | Diagnosis tab "Suggested Differentials" (tap = working diagnosis) |
| 4 | `handleAppear` + debounced changes | `ClinicalPipelineOrchestrator.runNow/schedule` → `SequentialDiagnosisEngine.seed` (itself `BayesianDiagnosisEngine.infer` with vitals/lab-augmented CC) → `DynamicBayesianNetwork.trajectories` → `ClinicalChangePointDetector.detect` → `BayesianDecisionEngine.decide` (+ `ManagementEngine`) → `ValueOfInformationEngine.rank` → `AutoFunctionEngine.generate` | Whole record via `PatientStateVector.from(patient:)`, SOCRATES selections | `hypotheses`, `trajectories`, `decisions` (priority, actions, investigations, disposition), `informationItems` (EVPI), `autoActions` (ask/order/calculate/document/compare/alert/schedule/prepare) | Diagnosis tab: Clinical Actions (prefix 6, filtered by visit type), 12 h trajectories, "Highest-value next investigations" (prefix 5) |
| 5 | Diagnosis tab tap / ICD search | — | — | `workingDiagnosis`, `workingDiagnosisICD` | "Radiates to: Notes · Prescriptions · Billing" |
| 5 | Diagnosis tab (every refresh) | `DiagnosticReasoningAdapter.report(results:patient:)` → `DiagnosticReasoning` core, `ZebraCheck`, `LongitudinalPatterns` | the step-3 `[DiagnosisResult]` (fired features, logLR, citations, candidate features), `workingDiagnosis`/ICD, vitals (NEWS2 series), record text, supplements, earlier encounters | for / against / missing / doesn't fit, best next discriminator, closure alerts, time-out, zebras, longitudinal patterns (`ios.reasoning`) | "Diagnostic Reasoning" card under the suggested differentials |
| 6 | Plan tab | `DiagnosisRadiationEngine.radiate(workingDiagnosis:ageYears:sex:)` (first keyword match in `allEntries`) | `workingDiagnosis` text only (age/sex are passed but not used to change content) | `DiagnosisRadiation { investigations, planTemplate, referralSuggestions, redFlags, urgencyNote, followUp, billingCodes, consentCategory, scoringCriteria }` | Radiation card: add investigation, "Use plan" (fills `managementPlan` only if empty) |
| 7 | Scores screen | `DiagnosisScoreMapper.recommendations(for:)` + `suggestedCategory(for:)` | `workingDiagnosis`, `workingDiagnosisICD`, CC | Ranked `ActiveScore` recommendations | Clinical Scores list |
| 7 | Opening a score | `PatientScoreAutoPopulator.<score>(patient:)` inside `ScoreAutoPopulateContext` → `ClinicalScoringEngine.<score>(_:)` | latest vitals, resulted labs (whole-word `LabNameMatch`), clinical text | Pre-filled input + `ScoreAutoFill` (auto keys, pending fields) → `ClinicalScore { score, risk, interpretation, recommendations, redFlags }` | Score form |
| 8 | "Draft plan" | `SOAPDraftEngine.draft(patient:)` | record + `SurgicalAlgorithmEngine.lookup(diagnosisName:)` (vademecum investigations, operative options, pearls) | `SOAPDraft { s, o, a, p }` | Assessment/plan draft |
| 9 | Plan tab | `DecisionSupportPatient.support(for:bayes:)` → `BayesianDecisionEngine.treatmentDecisionSupport` (`+Treatment.swift`, content `Resources/TreatmentDecisions.json`); `DecisionSupportPatient.posteriorShifts` (re-runs `BayesianDiagnosisEngine.infer` without the resulted investigations) | stored calculator scores, NEWS2 / qSOFA from the latest vitals, `LabPanel` values, the working diagnosis and `bayesianDx`, patient factors (age, CFS, ASA, eGFR, anticoagulant, pregnancy, allergy classes, …); `PlanSafetyFilter.adaptLine` on every line | Score / result action cards; per leading diagnosis the ranked options with observe / test / treat band, thresholds, expected benefit and harm, top factors, missing inputs | "Decision support — clinician decides" (`DecisionSupportSection`): Add to plan / Add test / Dismiss |
| – | PMH / meds / social changes | `SurgicalRiskEngine.assess(SurgicalRiskInputs)` | PMH chips, medication names, age, BMI, social chips, `LabPanel` | `[SurgicalRiskAlert]` | Peri-operative risk alerts (**not yet mirrored by the harness**: needs the view's PMH chip mapping) |

Not on the consultation path: `SurgicalVademecum` / `SurgicalAlgorithmEngine` (Clinical Hub,
Encyclopedia; SOAP uses a lookup), `DiagnosisDosingGuide` (Prescriptions), `BayesianSensorFusion`
(unused), `ScreeningEngine` (Wellness pathway).

### iOS engine mode: database vs fallback

`BayesianDiagnosisEngine.externalPool(_:)` reads `Resources/DiagnosticDatabase.json` through
`externalDatabase` (`try?` decode). Up to 1.0.0 the file did **not** decode with the Codable
structs (thousands of features without a string `evidenceLabel`, fractional `logPrior`/`logLR`,
numeric `value`s). 2.0.0 (branch fix-ios-differential, `docs/clinical-validation/changes/fix-ios-differential.md`)
decodes: `lint:guideline-registry` now fails if it stops decoding, and
`DiagnosticDatabaseLoadReportTests` asserts it on CI. With 2.0.0 the complaint is routed on its
own (not with investigation text appended), the curated `coreConditions` candidates of every
matching `presentations` entry come first, and every route returns a differential. What
happened with 1.0.0 (the built-in lists):

- A CC route written `externalPool("x") ?? builtIn` uses the built-in list (e.g. `abdominalPain`, 10
  candidates; `jaundice`, 5 candidates — no mesenteric ischaemia, no obstetric or septic causes).
- A route written `externalPool("x") ?? []` returns **no candidates**: `rightIliacFossaPain`,
  `biliaryColic`, `acutePancreatitis` and most of the newer pools (117 of 164 routes). Because
  resulted investigation names/results are appended to the CC before routing, an ultrasound
  report containing "gallstones" sends a right-upper-quadrant presentation to `biliaryColic` and
  empties the differential.
- The matrix cross-query and the "urgency safety net" also depend on the database, so they are off.

Each iOS vignette result records the mode (`outputs.engineInfo.bayesDatabase` = `fallback` |
`database`, plus the version and decode error from `DiagnosticDatabaseInfo.current`). Differential
expectations are graded in whatever mode ran; results from the two modes are not comparable.

Displayed probability: up to 1.0.0 the displayed percentage treated stored ×5 ln(LR) units as
full ln units, so confidence was overstated. `topResults` now divides by
`BayesianDiagnosisEngine.logUnitsPerNat` (5). No seed vignette asserts a displayed percentage.

## Web (dashboard)

The dashboard consultation (`artifacts/dashboard/src/pages/tabs/*`, `context/AppContext.tsx`) calls
shared, pure engines:

| Step | Engine · entry function | Reads | Produces | Shown as |
|---|---|---|---|---|
| CC strip / HPI chips | `extractFeaturesFromSocrates(cc, answers, paneContextFromConsultation(app))` (`lib/socrates-to-features.ts`) → `lib/pane-engine` 1.0.0: `applyModifiers(DISEASES, age, sex, undefined, { pregnancyPossible })` (applicability + bounded sex LRs) → `initPaneState` → `updatePosterior` per feature (unmodelled findings at the finding's background rate) → `topDiagnoses(state, diseases, 3)` | CC template name, SOCRATES answer strings, symptom chips and branch details, free text / HPI / PMH / social / exam notes (negation-aware), vitals, lab and imaging results, age, sex, pregnancy possible, optional PANE Q&A answers | PANE posterior, top 3 (`usePane`, `HpiTab.reseedPane`, `ChiefComplaintStrip`) | PANE differential; drives the Assessment management panel (top ≥ 0.20 when no diagnosis is confirmed) and the HPI investigation seeding (top-3 protocols) |
| HPI / Examination | `computeRankedDifferentials({symptoms, symptomDetails, age, sex})` (`lib/symptom-inference.ts`) | SmartSymptomPicker chips and branch details | Ranked differential (weights) | HPI and Examination "leading diagnosis" (≥ 40 %) |
| Assessment | `computeRankedDifferentials({symptoms, symptomDetails: {}, examText})` | chips + exam/HPI free text (pathognomonic signs) | Passive ranking | Differential card grid order |
| Triage (every change) | `adaptiveTriage(triageInput)` (`lib/triage-engine/src/adaptive-triage.ts`) | free text, symptom chips/details, comorbidities, medications, allergies, vitals, duration, pain score, post-op, `pregnancyPossible` | `acuity` (routine/review/priority/urgent), `recommendedAction` (emergency_now…), reasons, vital red flags, surgical matches, cancer screen | Acuity badge; front-desk script |
| Pathway registry | `matchPathways({symptoms, freeText})` (`lib/triage-engine/src/pathway-matcher.ts`) | chips, free text | Ranked clinical pathways | Pathway panel (recorded in harness notes only) |
| Assessment / Scales | `getCdsSuggestions(ctx)` (`lib/clinical-cds.ts`) | chips, exam chips, vitals, lab results, comorbidities, assessment, locked working diagnosis | Scale suggestions (Alvarado, TG18 cholangitis, NEWS2, qSOFA, BISAP, Glasgow-Blatchford, …) | "Suggested scales" |
| Prompts strip | `computeClinicalPrompts(input)` (`lib/clinical-inference.ts`) | demographics, CC entries, PMH, meds, pregnancy possible, exam text, lab results, radiology results, vitals, assessment | Safety / investigation / preventative prompts with actions (add to investigations / plan) — including long operative-plan templates | Clinical prompts strip |
| Assessment management panel | `getProtocol(diseaseId) ?? getProtocolByIcd(icd)` (`lib/pane-engine/src/management/`) → `ManagementPanel` | PANE top (≥ 0.20) or ICD | All phases of the protocol, key points, red flags | Assessment tab |
| Assessment diagnostic reasoning | `buildDiagnosticReasoning` (`lib/diagnostic-reasoning.ts`) → `@workspace/triage-engine/diagnostic-reasoning` (explain, `informationGain` over the top 3, closure guard, time-out, zebras, longitudinal) | PANE state and likelihoods, locked working diagnosis (id, else label vs ICD-10), vital records (NEWS2 series), record text, supplement history, earlier encounters and imported labs | for / against / missing / doesn't fit, best next discriminator, closure alerts (web rules: diagnosis families compatible, two conditions, already named, LR <= 0.2; `diagnosis-families.ts`), time-out (coexisting states explain), zebras, longitudinal patterns (`web.reasoning`) | "Diagnostic reasoning" card under the PANE differential (Alt+R) |
| Plan tab (confirmed diagnosis only: `confirmedPlanSource`) | `detectDxVariants(assessment, icd, diseaseId)` (`lib/dx-variants.ts`) → `buildPlanText(protocol, …, allowedPhases, planPrefix)` | assessment text (keyword detection, first matching variant wins), ICD, disease id | Generated plan text filtered to the variant's phases; investigations; referral | Plan tab (the documented plan) |
| HPI completion | `seedInvestigationsFromPane` | top-3 PANE protocols | stat/urgent investigations added to orders | Investigations tab |
| Calculators | `ScalesTab` (`lib/clinical-scales.ts`: Alvarado, TG18 cholangitis, …) and `ClinicalScoresPanel` (`lib/clinical-scores.ts`: TG18 cholangitis & cholecystitis from labs + ticks, Ranson, BISAP, NEWS2) | manual ticks; clinical-scores also reads `extractedLabs` and vitals | Score / grade + action text; "Use in decision support" records the value (`encounters.clinical_scores.decisionScores`) | Scales tab; scores panel |
| Plan tab / ManagementPanel decision support | `DecisionSupportPanel` → `lib/decision-support.ts` `buildDecisionSupport` → pane-engine `decisionSupport` (`lib/pane-engine/src/decision`, content `treatment-decisions.json`); `resultPosteriorShifts` (PANE replay without the result-only features) | recorded calculator scores, NEWS2 / qSOFA from the vitals, `extractedLabs` / results by catalogue alias, locked working diagnosis + recorded ICD codes (confirmed) else PANE top 3, patient factors; planSafety `adaptPlanText` on every line | Score / result action cards; ranked options with observe / test / treat band, thresholds, expected benefit and harm, top factors, missing inputs | "Decision support — clinician decides": Add to plan / Add test / Dismiss |

Not yet mirrored by the web harness: `cc-matrices.ts` CC templates (ddx/labs/imaging per template:
its `@/context/AppContext` type import does not resolve under the scripts tsconfig),
`clinical-pathways.ts` (EMR completion guidance) and `safety-engine.ts` (consult-state reminders).

## Which output is authoritative

| Question | iOS | Web |
|---|---|---|
| Differential | `BayesianDiagnosisEngine.infer` top 5 on the Diagnosis tab (`ios.bayes`). Early CC list and the pipeline's hypotheses are secondary; `ClinicalPathwayEngine.differentials` is a fixed per-pathway list. | PANE top 3 (`web.pane`). Symptom inference and the passive ranking are secondary views of a different engine. |
| Red flags / alarms | `ClinicalTextParser` alarms (banner) — text keywords only; pipeline `.alert` actions; `VisitRiskAssessment` flags; radiation `redFlags`/`urgencyNote`. | `adaptiveTriage` vital red flags and reasons; `computeClinicalPrompts` safety prompts; protocol red flags; dx-variant urgency note. |
| Emergency level | `ClinicalPathwayEngine.assess().suggestedAcuity` — CC/PMH keywords only; vitals and alarms are not considered. | `adaptiveTriage().recommendedAction` (emergency_now → emergency; same_day_call → urgent; priority_24_48h → priority) — uses vitals. |
| Which scores | `DiagnosisScoreMapper` (working diagnosis, ICD, CC). | `getCdsSuggestions` (symptoms, exam, vitals, labs, locked diagnosis). |
| Score values | `ClinicalScoringEngine` (calculator) after `PatientScoreAutoPopulator` (partial auto-fill). | `clinical-scales.ts` and `clinical-scores.ts` — two independent TG18 cholangitis calculators with different rules. |
| Investigations | `DiagnosisRadiationEngine` (per working diagnosis) + pipeline EVPI / decisions / order actions. | Plan protocol investigations; PANE-seeded stat/urgent tests; prompt actions. |
| Management | `DiagnosisRadiationEngine.planTemplate` + referrals (one template per diagnosis, no severity or allergy adaptation); TG18 calculator recommendations; pipeline decisions; SOAP plan. | Plan tab generated text (protocol filtered by dx variant) — the documented plan; Assessment management panel shows all phases; protocol medications; prompt templates. |
| Pathway | `ConsultPathway.recommend(for:)` | — (no equivalent; `matchPathways` is a different concept) |

## Where iOS and web differ (phase 0 observations)

- **Differential engines are unrelated**: iOS naive-Bayes pools (DiagnosticDatabase / built-in lists),
  web PANE (disease/feature likelihoods with prior modifiers) plus a separate weight-based symptom
  engine. Disease names, ids and coverage differ; the vignettes match on stems ("cholecyst").
- **Emergency level**: iOS reads only CC/PMH keywords (an RUQ-pain cholecystitis is "routine", septic
  shock without the words "septic shock" in the CC is not "emergency"); web uses vitals and scores
  everything with a fever/vomiting/jaundice/cholangitis pattern as `emergency_now`.
- **Pregnancy**: web has `pregnancyPossible` (triage, prompts); the iOS `Patient` has no pregnancy
  field, and `VisitRiskAssessment` asks "Could be pregnant?" only on trauma/burns/procedure pathways.
- **Negation** (fixed 2026-09-25): free-text matching on both platforms goes through one rule,
  `lib/triage-engine/src/negation.ts` (web: triage red flags, prompts, PANE mapping, dx variants) and its
  Swift twin `ios/AmiseMedFlow/Services/NegationMatcher.swift` (iOS: `ClinicalTextParser`, pathway red
  flags, PMH/risk flags, Bayesian scoring, `ConsultPathway`). A negation cue within 5 words in the same
  clause cancels a finding; when uncertain ("cannot be excluded", "?") the finding is kept.
  `scripts/src/negation-parity.test.ts` keeps the two test-vector lists identical. Not yet routed on
  iOS: the ~40 `PatientScoreAutoPopulator+*` functions and the Bayesian route choice (investigation
  text appended to the chief complaint).
- **TG18 grading**: iOS cholangitis counts one Grade II criterion as Grade II (TG18 needs two); web
  `clinical-scales.ts` does the same (and treats fever ≥ 38 °C as the criterion instead of ≥ 39 °C);
  web `clinical-scores.ts` needs two but omits the WBC criterion. Neither cholecystitis calculator
  has the "palpable tender RUQ mass" Grade II criterion. Auto-fill never sets organ-dysfunction
  fields on iOS; the web auto-derived grade needs manual imaging ticks before it diagnoses.
- **qSOFA auto-fill (iOS)** uses RR > 22 and SBP < 100; Sepsis-3 is RR ≥ 22 and SBP ≤ 100.
- **Severity-specific plans**: web selects a dx variant from the assessment text, but the Grade I
  variants contain the bare base keyword ('cholecystitis', 'ascending cholangitis') and are checked
  first, so Grade II/III texts get Grade I phases (cholecystostomy and ERCP disappear from the
  generated plan); keyword word order ('severe cholangitis' vs 'severe acute cholangitis') decides
  detection. iOS has one plan template per diagnosis with no severity branch.
- **Allergies**: neither platform's plan templates check the recorded allergy (penicillins suggested
  in penicillin anaphylaxis).
- **Web prompt templates** (`computeClinicalPrompts`) embed full operative plans (e.g. post-operative
  ibuprofen and 5 days of co-amoxiclav after simple appendicitis; "β-HCG confirmed negative" in a
  pregnant patient; emergency laparotomy consent for Grade III cholangitis).

The per-vignette evidence for each of these is in `REPORT.md` and `results/web-latest.md`.

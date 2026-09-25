> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Hazard log (DCB0129-style)

| | |
|---|---|
| System | AMISE MedFlow EMR: dashboard, API server, front-desk and patient portal, iOS app |
| Code baseline | v0.1: `c9a7293`. v0.2 refresh: `cc83845` (tip of `claude/pr-37-gbg22z`), plus `23904fd` (questionnaire hand-over mode, merged on that branch after `cc83845`). Line numbers in unchanged text still refer to `c9a7293` and may have drifted |
| Status | Draft v0.2, 2026-09-25 (v0.1: 2026-09-24). **No entry has been reviewed or accepted by a Clinical Safety Officer (CSO).** All ratings, including every v0.2 re-rating, are the author's proposal |
| Companion | `clinical-safety-case.md` (argument and evidence), `data-inventory.md`, `security-controls.md` |

**Status terms used in v0.2**

| Term | Meaning |
|---|---|
| Fixed in code | The change is merged on `claude/pr-37-gbg22z`, with the commit and file cited. Not verified in production |
| Pending migration | The code is ready but depends on Migrations 87–90, which are wired into `run-migrations.yml` and **not yet applied to production** (`migrations/README.md`) |
| Pending surgeon decision | Waiting for a clinical decision by the practice owner. Not a CSO acceptance |
| Open | No control added yet, or the control is partial |

## 1. Risk matrix

This is adapted from the DCB0129/DCB0160 guidance matrix. **The CSO must confirm the matrix and the definitions** before any rating is relied on.

**Severity**

| Level | Definition (patient harm) |
|---|---|
| Catastrophic | Death or permanent life-changing incapacity, **multiple patients** |
| Major | Death or permanent life-changing incapacity, single patient. Or severe injury, multiple patients |
| Considerable | Severe injury with recovery expected, single patient. Or minor injury, multiple patients |
| Significant | Minor injury not expected to recover in the short term. Or significant psychological harm (including a privacy breach with distress) |
| Minor | Minor injury expected to recover in the short term. Minor upset or inconvenience |

**Likelihood**

| Level | Definition |
|---|---|
| Very high | Certain or almost certain; expected to occur often |
| High | Not certain but very possible; expected to occur in many cases |
| Medium | Possible |
| Low | Could occur, but will not in the great majority of cases |
| Very low | Negligible |

**Risk rating** (1 = very low, 5 = very high). Likelihood is on the left, severity along the top.

| Likelihood ↓ / Severity → | Minor | Significant | Considerable | Major | Catastrophic |
|---|---|---|---|---|---|
| **Very high** | 3 | 4 | 4 | 5 | 5 |
| **High** | 2 | 3 | 3 | 4 | 5 |
| **Medium** | 2 | 2 | 3 | 3 | 4 |
| **Low** | 1 | 2 | 2 | 3 | 4 |
| **Very low** | 1 | 1 | 2 | 2 | 3 |

**What each rating means**

| Rating | Meaning |
|---|---|
| 5 | Unacceptable |
| 4 | Undesirable. The CSO must document justification to accept, and further mitigation is required before release |
| 3 | Acceptable only once further mitigation has been considered |
| 1-2 | Acceptable |

**Initial risk** is the risk with no controls, that is, the hazard inherent in the feature. **Residual risk** is the risk with the controls **that exist in code today**. It is *not* the risk after the "further actions" are done.

---

## 2. Summary

"Residual v0.2" is the author's proposed re-rating after the controls added between `c9a7293` and `cc83845`. Where it differs from v0.1 it is in bold. The CSO must confirm each re-rating.

| ID | Hazard | Initial | Residual v0.1 | Residual v0.2 | Status (2026-09-25) |
|---|---|---|---|---|---|
| H-01 | Patient-facing triage fails to identify an emergency | 4 | 3 | 3 | Open. The `DISABLE_AI` fallback keeps the ER/911 redirect (`113b1d9`) |
| H-02 | AI urgency or extraction downgrades a deterministic or true severity | 3 | 2 | 2 | Open. The urgency floor also applies to the `DISABLE_AI` fallback (`113b1d9`) |
| H-03 | Urgent result misclassified as routine in the Results Inbox | 3 | 3 | 3 | Open. Unchanged |
| H-04 | NEWS2 under-scored because implementations are defective or inconsistent | 4 | 4 | **2** | Fixed in code on iOS (`485f85d`, `2abb3cc`) and web (`e682e87`). Cloud sync of the Scale 2 flag pending Migration 88 (`48ef141`). CSO sign-off of the fix outstanding (A-4) |
| H-05 | Other clinical score calculated or auto-populated incorrectly | 3 | 3 | 3 | Open. Specific fixes: qSOFA (`13166b8`), Glasgow-Imrie (`61780fa`), saved-score lookup (`0e62bf8`) |
| H-06 | Bayesian differential misleads the clinician (anchoring or omission) | 3 | 3 | 3 | Open. The iOS disclaimer is still missing |
| H-07 | Drug-interaction checker gives false reassurance | 3 | 3 | 3 (likelihood Medium → Low) | Fixed in code: class mapping and "absence of an alert" label on both platforms, plus a parity lint (`2f111c3`, `31521d3`, `19406ae`, `8e32180`). Pending surgeon decision: opioid + benzodiazepine grade. Pharmacist review open |
| H-08 | Formulary or dosing reference content is wrong | 3 | 3 | 3 | Open. New dosing content: iOS bowel-prep regimens (`abda6b2`, `1f6e2fc`), each gated by surgeon sign-off |
| H-09 | Automated outbound message bypasses the MODE gate or the content filter | 3 | 3 | **2** | Fixed in code (`e094063`): one MODE gate (`lib/outbound.ts`) on every api-server send. Open: one pattern source, a CI check for direct provider calls |
| H-10 | Automated prep instructions give blanket medication-hold advice | 3 | 3 | **2** | Fixed in code in every patient text (`e094063`, `38a7891`, `996fe1b`, `b9ae85b`), with a CI lint and tests. The wording follows the surgeon's decisions |
| H-11 | Message or PHI sent to the wrong recipient | 3 | 2 | 2 | Open. Unchanged |
| H-12 | Sync conflict reverts a correction, or a deletion does not propagate | 3 | 3 | 3 | Partly fixed. Deletes propagate once Migration 87 is applied (`cad8d9c`, `48ac9f7`, `8f8a467`). Pull protection and peer pending rules (`e51e40c`, `dac2823`, `746d289`). **Open: longer-value-wins merge of allergies and narrative in peer sync** |
| H-13 | Loss of clinical data (store reset, dropped outbox, no PITR) | 3 | 3 | 3 | Open. Sync fixes stop edits being stuck or never uploaded (`8e350a0`, `70ade9d`, `6d6782f`, `6a1e96c`, `cc83845`). PITR, bucket backups and the iOS store-reset alert are unchanged |
| H-14 | Offline replay overwrites newer data | 3 | 3 | 3 | Partly fixed. iOS: `e51e40c`, `717a03e`, `9565db7`. Dashboard: 2 of 18 outbox executors check `updated_at` |
| H-15 | Duplicate or split patient record hides allergies or history | 3 | 3 | 3 | Partly fixed: a duplicate holding any clinical data is never hidden (`79eaa1e`). No merge workflow yet |
| H-16 | Wrong-patient data entry or display | 4 | 3 | 3 | Open on the web (localStorage encounter). iOS: guard for a patient deleted while the consultation is open (`705717f`, `925ef2f`) |
| H-17 | AI-drafted clinical document contains errors and is signed | 3 | 3 | 3 | Open. The complete kill switch (`113b1d9`) is a control, not a fix |
| H-18 | Transcription or voice-parsing error enters the record | 3 | 3 | 3 | Open. iOS dictation now on-device when supported (`16435f3`), a privacy gain only |
| H-19 | Unauthorised access to or disclosure of PHI | 3 | 3 | 3 (**2** once Migration 89 is applied and `STAFF_MACHINE_TOKEN` is set) | S-1, S-3 and S-4 fixed in code. S-2 pending Migration 89. S-5 and S-6 open. Questionnaire hand-over mode added (`23904fd`) |
| H-20 | System unavailable during clinical care | 2 | 2 | 2 | Open. New cause: staff without a `user_profiles` row are locked out once Migration 89 is applied |

**Highest residual risk, top 5 (v0.2).** Sorted by residual rating, then severity, then whether the defect is *confirmed in code* rather than theoretical:

1. **H-19** PHI access control. Until Migration 89 is applied, a portal patient's own JWT can read every patient row directly from Supabase (S-2). A security finding rated **critical**; see `security-controls.md`
2. **H-12** Peer-sync merge: the longer copy of allergies and history wins regardless of time, so a correction that shortens a field is reverted (rating 3, confirmed)
3. **H-13** Data loss: PITR off, three storage buckets not backed up, and the iOS store resets silently (rating 3, confirmed)
4. **H-07 / H-08** Interaction and dosing content is a partial list with no pharmacist review (rating 3)
5. **H-16** Wrong-patient display: the web's in-progress encounter survives sign-out in localStorage (rating 3, initial 4)

Dropped out of the v0.1 top 5: H-04, H-10 and H-09 (fixed in code), and H-07's class-name gap (fixed; the residual is content coverage).

---

## 3. Hazard entries

### H-01: Patient-facing triage fails to identify an emergency

- **Features.**
  - Web intake (APCQ): `lib/triage-engine/src/apcq.ts`, `artifacts/front-desk/app/intake/page.tsx`
  - WhatsApp/SMS conversational intake: `artifacts/front-desk/lib/claude.ts`
  - Email intake: `artifacts/api-server/src/routes/intake.ts`, `lib/triage-logic.ts`
  - Adaptive triage: `lib/triage-engine/src/adaptive-triage.ts`
- **Causes.**
  - Red-flag detection is keyword and regex based (`lib/triage-engine/src/rules.ts`, `RED_FLAGS`). Misspellings, Kwéyòl or dialect phrasing, abbreviations, and symptoms described indirectly are missed.
  - The patient does not answer the red-flag questions, or understates them.
  - Emergency questions are skipped because of adaptive branching.
  - The patient dismisses the ER redirect.
  - Intake is used for a post-operative complication (for example an anastomotic leak) that presents with vague symptoms.
- **Effects.** The patient books a routine or delayed appointment, or waits for a callback, instead of attending ED. Delayed treatment of a surgical emergency (perforation, bleeding, cholangitis, obstruction) could lead to death or serious harm.
- **Existing controls.**
  - Deterministic emergency classification leads to `recommendedAction = 'emergency_now'` (`adaptive-triage.ts:241-251`).
  - The web intake has an emergency redirect screen with a mandatory acknowledgement before continuing (`front-desk/app/intake/page.tsx:320-323, 445-446`).
  - WhatsApp intake does not offer booking slots when the action is `emergency_now` or `same_day_call` (`front-desk/lib/claude.ts`, `isBookable`).
  - The intake is labelled "Appointment scheduling only. Not medical advice." (`front-desk/app/api/booking/create/route.ts:73`, `booking/urgent/route.ts:34`).
  - The human gate: staff or nurse review, then doctor approval (`api-server/src/routes/visit-lifecycle.ts:266-271`).
  - Urgent-message escalation in email intake (`routes/intake.ts`, escalate branch).
- **Initial risk.** Major × Medium = **3**. Because this is a systematic defect across all patients, the CSO may prefer Catastrophic × Low = **4**. The initial rating in the summary uses 4.
- **Residual risk.** Major × Low = **3**.
- **Further actions.**
  1. Build a labelled test set of emergency presentations, including local phrasing and misspellings, and add it to CI with a sensitivity threshold.
  2. Make the "if in doubt call 911/999" advice persistent on every intake screen and in every automated acknowledgement.
  3. Measure time from submission to staff review. Define a service level for `priority` and `urgent` submissions.
  4. Include this feature in the medical-device assessment (`medical-device-positioning.md` §4).
- **Status (v0.2).** Open. Actions 1-4 not started. New control: with `DISABLE_AI=true` the front-desk intake falls back to deterministic PANE triage, and an emergency still gets the fixed ER/911 redirect and escalates (`113b1d9`, `artifacts/front-desk/lib/claude.ts`, `lib/ai-gate.ts`). Residual unchanged at 3.

### H-02: AI urgency or extraction downgrades a deterministic or true severity

- **Features.** Questionnaire AI summary and urgency (`api-server/src/routes/questionnaire.ts`), WhatsApp intake triage JSON (`front-desk/lib/claude.ts`), email classification (`api-server/src/lib/claude.ts`).
- **Causes.** The LLM underestimates urgency. Code later uses the AI level in preference to the deterministic one.
- **Effects.** A patient is queued at lower priority, causing delayed care.
- **Existing controls.**
  - The urgency floor, `max(questionnaire, ai)` (`questionnaire.ts:352-378`).
  - WhatsApp booking eligibility uses the deterministic PANE `recommendedAction`, not Claude's `triage.level` (`front-desk/lib/claude.ts`).
  - Email triage uses the deterministic `triage()` from `lib/triage-logic.ts`.
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Very low = **2**.
- **Further actions.**
  1. Add a unit test asserting the floor for every AI-urgency code path.
  2. Add a lint or grep check so no new route consumes an AI severity without the floor.
- **Status (v0.2).** Open. With `DISABLE_AI=true` the questionnaire summary is a deterministic row whose urgency comes from the questionnaire red flags, so the floor still holds (`113b1d9`, `routes/questionnaire.ts`). Actions 1-2 not started.

### H-03: Urgent result misclassified as routine in the Results Inbox

- **Features.** Email and document intake with AI extraction (`api-server/src/lib/email-documents.ts`, `routes/document-scan.ts`, `routes/investigations.ts`). Results Inbox UI (`artifacts/dashboard/src/pages/tabs/ResultsInboxTab.tsx:699-712`).
- **Causes.**
  - The AI-extracted `urgency` defaults to `'routine'` when absent (`ResultsInboxTab.tsx:699`).
  - The native parser or Claude misreads a critical value.
  - The document is not matched to a patient (`patient_id: null` at `email-documents.ts:97, 197`).
- **Effects.** A critical result (such as malignancy on histology, or a critical potassium or haemoglobin) is not acted on promptly.
- **Existing controls.**
  - The staff user can change urgency in the UI.
  - `escalate-results` cron exists (`docs/INCIDENT-RUNBOOK.md`).
  - AI calls are audited (`docs/AUDIT-TRAIL-COVERAGE.md`).
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. Default unknown urgency to "needs review", not "routine".
  2. Add deterministic critical-value rules alongside the AI.
  3. Show a "no patient match" queue prominently.
  4. Track time to acknowledge each result.
- **Status (v0.2).** Open. No change: the Results Inbox still defaults a missing AI urgency to `'routine'` (`ResultsInboxTab.tsx:699` at `cc83845`). With `DISABLE_AI=true`, folder-watcher extraction is skipped and documents wait for manual review (`investigations.ts`), which removes the AI misreading but not the default.

### H-04: NEWS2 under-scored because implementations are defective or inconsistent

- **Features.** There are three independent NEWS2 implementations:
  - (a) `artifacts/dashboard/src/lib/clinical-scores.ts:540-595` (`scoreNews2`), used by `components/ClinicalScoresPanel.tsx:417-426`
  - (b) `artifacts/dashboard/src/lib/clinical-scales.ts:393-438` (`news2Score`/`interpretNews2`), used by `pages/tabs/ScalesTab.tsx:144-145`
  - (c) iOS `ios/AmiseMedFlow/Models/VitalsEntry.swift:73-131`
- **Causes (confirmed by reading the code).**
  - (a) **Omits consciousness (AVPU/new confusion, 3 points) and supplemental oxygen (2 points) entirely.** `ScoringVitals` has no fields for them (`clinical-scores.ts:41-47`). When `spo2Scale2` is true, SpO₂ is not scored at all. A confused patient on oxygen is under-scored by up to 5 points and can display "LOW risk".
  - (b) Has no SpO₂ Scale 2. `interpretNews2` does not apply the "any single parameter scoring 3" escalation rule: a total of 3 made up of one red parameter shows "Low Risk".
  - (c) Applies SpO₂ **Scale 2 automatically to any patient on supplemental O₂** (`VitalsEntry.swift:83-90`). RCP guidance reserves Scale 2 for patients with confirmed hypercapnic respiratory failure, prescribed by a clinician. A non-hypercapnic patient on O₂ with SpO₂ 88-92% scores 0 instead of 3 (or 2).
  - (c) The single-parameter red-flag check is skipped whenever the respiratory rate is not recorded (`VitalsEntry.swift:118`, `guard let rr ... else { return false }`).
  - The three implementations therefore disagree with each other.
- **Effects.** Deterioration on the ward or post-op goes unrecognised. Escalation is delayed, which could lead to death or serious harm.
- **Existing controls.**
  - The clinician sees the raw vitals alongside the score.
  - Component breakdown badges (dashboard (a)).
  - iOS treats any single red parameter as "High" when RR is present (over-triage).
  - Unit tests exist for iOS scoring (`ios/AmiseMedFlowTests/ClinicalScoringEngineTests.swift`), but not for these NEWS2 edge cases (**to confirm**).
- **Initial risk.** Major × Medium = **3**. Because the defect is systematic, the CSO may rate it Catastrophic × Low = **4**.
- **Residual risk.** Major × High = **4**. The defects are deterministic: every affected patient is mis-scored.
- **Further actions.**
  1. **Immediately:** hide or label the dashboard NEWS2 panel (a) "incomplete: excludes consciousness and oxygen" until it is fixed.
  2. Replace all three with **one shared, tested implementation** in `lib/triage-engine` (and a Swift port with identical test vectors).
  3. Make Scale 2 an explicit clinician selection, recorded with the observation.
  4. Add RCP worked examples as unit tests on both platforms.
  5. Have the CSO sign off the fix before ward use.
- **Status (v0.2).** **Fixed in code** on both platforms; CSO sign-off outstanding.
  - iOS (`485f85d`): every NEWS2 calculation (`VitalsEntry`, the Scores-screen engine and the live preview) uses one chart, `ios/AmiseMedFlow/Services/NEWS2Chart.swift`. The single-parameter red flag fires whatever else is missing. Scale 2 applies only when a clinician opts the patient in (`Patient.news2UseSpO2Scale2`, default off); oxygen alone keeps Scale 1 and adds 2 points. Bands follow RCP (0-4 low, a single 3 low-medium, 5-6 medium, 7+ high). A partial score is marked, for example "NEWS2 2 (Low — incomplete: RR, SpO2 not recorded)". The Scores form and auto-populator are wired to the same inputs, and "Save readings to Vitals" keeps the oxygen flag (`2abb3cc`). Tests: `ios/AmiseMedFlowTests/NEWS2Tests.swift`.
  - Web (`e682e87`): `lib/triage-engine/src/news2.ts` (`evaluateNews2`), a TypeScript twin of `NEWS2Chart.swift`, now drives `ClinicalScoresPanel`, `ScalesTab` and `ClinicalAlgorithmPanel`. Consciousness and air/oxygen default to "not recorded", so the score is flagged incomplete rather than assuming Alert and room air. Tests: `artifacts/dashboard/src/lib/__tests__/news2.test.ts` ports every iOS boundary vector and checks the three panels agree.
  - **Pending migration.** The Scale 2 flag syncs over peer sync and NAS backup today. Cloud sync needs Migration 88 (`48ef141`, `patients.news2_spo2_scale2`). Until then two devices that meet only through Supabase can score on different scales. The default is Scale 1, which over-scores rather than under-scores a hypercapnic patient.
  - Action 1 is superseded (the panel is fixed, not hidden). Actions 2-4 are done. Action 5 is open.
  - Remaining cause: the Swift and TypeScript twins could drift. The test vectors are copied, not shared, and no CI step compares the two engines.
- **Residual risk (v0.2, proposed).** Major × Very low = **2**.

### H-05: Other clinical score calculated or auto-populated incorrectly

- **Features.**
  - More than 100 iOS scores (`ios/AmiseMedFlow/Services/ClinicalScoringEngine*.swift`) with auto-population from the record (`PatientScoreAutoPopulator*.swift`)
  - Dashboard scales and scores (`clinical-scales.ts`, `clinical-scores.ts`, `ClinicalScoresPanel.tsx`)
  - Pre-op risk (`PreopRiskScoringCard.tsx`)
  - Diagnosis-to-score mapping (`DiagnosisScoreMapper*.swift`)
- **Causes.**
  - Transcription errors in thresholds.
  - Duplicate implementations diverging between web and iOS.
  - Auto-population from stale or mis-parsed values.
  - Units (mg/dL versus mmol/L).
  - Missing inputs treated as normal: for example the dashboard's `vitals.x ? +vitals.x : undefined` treats `0` as missing (`ClinicalScoresPanel.tsx:419-424`).
- **Effects.** Wrong risk stratification leads to inappropriate management, for example of pancreatitis severity, GI-bleed disposition or VTE prophylaxis.
- **Existing controls.**
  - Score inputs are shown to the clinician.
  - Some iOS unit tests exist (`AmiseMedFlowTests/ClinicalScoringEngineTests.swift`, `ConsultPathwayTests.swift`).
  - A pending-field confirmation step on iOS (`Views/Scores/ClinicalScoresViewForms+ConfirmPendingField.swift`).
  - Evidence citations are displayed with some scales (`clinical-scales.ts`).
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. Build an inventory of every score with its reference, its owner and the test vectors used.
  2. Run cross-platform parity tests.
  3. Display "missing input" explicitly instead of scoring it as 0.
  4. Have the CSO review scores used for disposition decisions.
- **Status (v0.2).** Open, with specific iOS fixes:
  - qSOFA 2-3 without the "suspected infection" tick no longer reads "Low" (`13166b8`).
  - Glasgow-Imrie uses the standard 8 PANCREAS criteria, including urea > 16 mmol/L, and 3 or more is severe in both Glasgow scores (`61780fa`, `2abb3cc`).
  - Saved scores are found again: they were stored under one name and looked up under another, so recorded values never showed (`0e62bf8`).
  - Boundary tests for Alvarado, qSOFA, Wells, Rockall, Glasgow-Blatchford, Glasgow-Imrie, BISAP and CURB-65 (`4370325`, `ScoringEngineReferenceTests`).
  - Actions 1-4 are still open. The dashboard's `0`-as-missing issue (`ClinicalScoresPanel.tsx`) was not rechecked.

### H-06: Bayesian differential misleads the clinician (anchoring or omission)

- **Features.**
  - `lib/pane-engine` (web differential, `components/PaneDifferential.tsx`)
  - iOS Bayesian engines (`BayesianDiagnosisEngine*.swift`, `BayesianDecisionEngine*.swift`, `SequentialDiagnosisEngine*.swift`, `DynamicBayesianNetwork*.swift`, `DiagnosticDatabase.json`)
- **Causes.**
  - Priors and likelihoods are estimated from the literature (for example `lib/pane-engine/src/vademecum/appendicitis.ts:3-4`, "calibrated to surgical OPD") and have **not been validated on local patient data**.
  - Diagnoses absent from the catalogue can never appear.
  - Precise-looking percentages invite automation bias.
  - Features are entered incorrectly or parsed wrongly from free text (`socrates-to-features.ts`, `transcript-dx-mapper.ts`).
- **Effects.** Premature closure and a missed alternative diagnosis, for example ectopic pregnancy, AAA or mesenteric ischaemia presenting as "abdominal pain", leading to delayed or incorrect treatment.
- **Existing controls.**
  - The clinician must tap to set the working diagnosis (iOS `ConsultationView+PlanTab.swift:129`; `CLAUDE.md` "Central diagnosis radiation").
  - The web disclaimer: "Bayesian decision support only — not a diagnosis. Clinical judgement overrides all suggestions." (`PaneDifferential.tsx:58`).
  - Engine unit tests (`lib/pane-engine/src/__tests__/bayes.test.ts`, `registry.test.ts`).
  - The `lint:dx-phases` CI check (`CLAUDE.md`).
- **Gap.** The iOS differential percentages have **no adjacent disclaimer** (`ConsultationView+CCTab.swift:147`, `+HistoryTab.swift:166`, `+PlanTab.swift:124`).
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. Add an iOS disclaimer and an "outside catalogue / can't-miss diagnoses" reminder.
  2. Consider showing ranked bands instead of exact percentages.
  3. Run a retrospective validation against audited local cases.
  4. See `medical-device-positioning.md`: this feature is the most likely to be regulated.
- **Status (v0.2).** Open. No change. The iOS differential screens still have no adjacent disclaimer.

### H-07: Drug-interaction checker gives false reassurance

- **Features.** Web `artifacts/dashboard/src/lib/drug-interactions.ts` (36 rule pairs) with `components/DrugInteractionAlert.tsx`. iOS `ios/AmiseMedFlow/Services/DrugInteractionService.swift` (27 rules).
- **Causes (confirmed).**
  - Matching is a substring test of a rule term against the medication string (`drug-interactions.ts:57-66`, `DrugInteractionService.swift:50-66`).
  - Many rules use **class names** ("nsaid", "ssri", "opioid", "benzodiazepine", "steroid", "ace inhibitor", "maoi", "diuretic", "beta blocker") that do not occur in real prescription strings. No class-to-drug mapping was found.
  - As a result, "warfarin" with "diclofenac", or "morphine" with "diazepam", raise **no alert**.
  - The rule sets are small, partial by design, and differ between web and iOS.
  - No renal or hepatic dose checks were found in the interaction checker.
- **Effects.** The clinician may read the absence of an alert as "no interaction", leading to bleeding, respiratory depression or serotonin syndrome.
- **Existing controls.**
  - The code comment "Partial list" (`drug-interactions.ts:8`).
  - Allergy alerts on both platforms (`components/AllergyMedAlert.tsx`, used in `PrescriptionsTab.tsx:468`; iOS `AddPrescriptionSheet.swift:35-148`).
  - The iOS text "Reference guide only — verify dose, renal function, and allergies before prescribing." (`PrescriptionView+Sections.swift:89`).
  - Prescribing is a doctor-only section in the UI (`roles.ts:44`).
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. Add class-membership mapping, or adopt a maintained interaction database.
  2. Display a persistent "Absence of an alert does not mean no interaction" label.
  3. Share one rule set across platforms.
  4. Add tests for class-based pairs.
- **Status (v0.2).** **Fixed in code** for the confirmed gap. Pharmacist review open; one grade pending a surgeon decision.
  - Class-to-drug mapping: `artifacts/dashboard/src/lib/drug-classes.ts` (`2f111c3`) and its Swift port `ios/AmiseMedFlow/Services/DrugClasses.swift` (`31521d3`). Each class lists generics, older INNs and common Caribbean, UK and US brands, with a cited source (BNF / Stockley's, MHRA, SmPC, CredibleMeds). Members match as whole words. Warfarin + diclofenac, tramadol + sertraline and morphine + diazepam now alert.
  - No original rule was removed or regraded. A "never-remove" test replays the old matcher and requires every old alert to still fire.
  - False alerts removed on the web: "arb" inside carbamazepine or calcium carbonate, and "5-ASA" read as aspirin (`19406ae`).
  - Parity: each platform gained the other's missing rules with the same grade and wording (`8e32180`). CI step `lint:interaction-parity` (`scripts/src/lint-interaction-parity.ts`) fails if a pair can be raised on one platform and not the other, if a term's members differ, or if a shared pair's grade differs.
  - Both UIs show the class a drug matched through and a persistent "Absence of an alert does not mean there is no interaction" note (`DrugInteractionAlert.tsx`; iOS prescription list, add-prescription sheet and Allergies tab). Actions 1-4 done.
  - **Pending surgeon decision:** opioid + benzodiazepine is "contraindicated" on the web and "major" on iOS. It is allow-listed in the parity lint (`GRADE_ALLOWLIST`) until the surgeon picks one.
  - Still open: the rule set is a partial reference list, not a maintained database; no renal or hepatic checks; no pharmacist review (A-11).
- **Residual risk (v0.2, proposed).** Major × Low = **3**. The likelihood falls from Medium to Low, but the matrix keeps the rating at 3 while coverage is partial.

### H-08: Formulary or dosing reference content is wrong

- **Features.**
  - `lib/triage-engine/src/formulary.ts` (about 2,000 lines)
  - `artifacts/dashboard/src/lib/prescription-formulary.ts` (inpatient subset)
  - `periop-meds.ts`
  - iOS `SurgicalDrug+Formulary*.swift`, `DiagnosisDosingGuide.swift`
  - Dosing advice inside interaction "action" text, for example "Halve warfarin dose" (`drug-interactions.ts:16`)
- **Causes.** Data-entry errors. Guidance out of date. Differences between Saint Lucia formulary availability and the sources used. Paediatric or renal adjustments not covered. Two formularies with overlapping content (`CLAUDE.md` gotcha).
- **Effects.** A wrong dose is prescribed, leading to toxicity or under-treatment.
- **Existing controls.** The prescriber is a doctor. The "verify" disclaimer on iOS. `DosingTab.tsx` is deliberately not auto-filled from the diagnosis (`CLAUDE.md`).
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. Clinical pharmacist review of all dosing content, with a named source and a review date for each entry.
  2. Put content under change control (see the safety case, §7).
  3. Show the source and "last reviewed" date in the UI.
- **Status (v0.2).** Open. Actions 1-3 not started.
  - **New content in scope:** iOS bowel-preparation regimens (`ios/AmiseMedFlow/Services/BowelPrepProtocols.swift`; `abda6b2`, `1f6e2fc`). Six regimens with product examples, dose steps and a split-dose timetable, citing SmPC/label and ESGE 2019.
  - Controls on that content: an explicit regimen choice is required; safety suggestions (eGFR < 30, heart failure, hypermagnesaemia, obstruction, dehydration, frailty, G6PD/PKU) are shown but never block; the diabetes flag gives no doses; each regimen needs surgeon sign-off in Settings, tied to a fingerprint of its wording that lapses if the wording changes; sheets are marked DRAFT until signed; each export is audit-logged. Tests: `BowelPrepTests.swift`.
  - Surgeon sign-off of each regimen on the production devices is **to confirm**. Sign-off by the prescriber is not a pharmacist review.

### H-09: Automated outbound message bypasses the MODE gate or the content filter

- **Features.** The MODE gate (`artifacts/api-server/src/index.ts:8, 33-40`; `lib/sms.ts:45-59`; `lib/gmail.ts:196-205`; `front-desk/lib/twilio.ts:41-45`). `FORBIDDEN_PATTERNS` (`lib/triage-engine/src/rules.ts:174-196`).
- **Causes (confirmed).**
  - **`routes/cron.ts:85` calls `sendOrDraft(..., 'auto')`**, which forces the 24-hour reminder email to **send regardless of `MODE`**, including `dry_run`. The body is Claude-drafted (`draftReply`), and **`draft.safe` is not checked**. By contrast, `routes/intake.ts:73-79` does check it.
  - The urgent-acknowledgement reply in email intake (`routes/intake.ts:49-50`) is Claude-drafted and sent without checking `ack.safe`.
  - Staff-directed alert emails are also forced to `'auto'`: `booking.ts:156, 455`, `portal.ts:1113`, `cron.ts:285-679` and `intake.ts:57`. They go to internal addresses, but they carry PHI and ignore `dry_run`. Only `cron.ts:85` forces `'auto'` towards a **patient**.
  - The WhatsApp replies via Meta and Telnyx (`routes/whatsapp.ts:241-286`) have no MODE check.
  - `routes/intake.ts:14` lets the cron caller override MODE through `req.body.mode`. Auto mode is downgraded to supervised, but `dry_run` can be lifted.
  - `lib/sms.ts` `sendSms()` does not itself apply `FORBIDDEN_PATTERNS`. It relies on callers.
  - There are two divergent copies of the patterns: `lib/triage-engine/src/rules.ts` and `artifacts/front-desk/lib/constants.ts:37`.
  - The regexes can be evaded: "500 milligrams", "you've got a growth", numbers written as words, and non-English text all get through.
- **Effects.** A patient receives unreviewed AI text, possibly with clinical content, a misleading reassurance or wrong logistics. This leads to confusion, a missed appointment or unsafe self-management.
- **Existing controls.**
  - The boot-time `CONFIRM_AUTO_MODE` guard (`index.ts:33-40`).
  - The mode banner.
  - `FORBIDDEN_PATTERNS` checks in `lib/claude.ts:166`, `questionnaire.ts:338`, `notify.ts:97`, `summary.ts:15, 308, 356, 542`, and front-desk `twilio.ts:17-27` and `claude.ts:74-80`, each with a safe fallback text.
  - Claude system prompts forbid clinical content (`lib/claude.ts:9-33`).
  - 60-second deduplication of SMS (`lib/sms.ts:24-55`).
  - The kill-switch procedure (`docs/INCIDENT-RUNBOOK.md`).
- **Initial risk.** Considerable × High = **3**.
- **Residual risk.** Significant × High = **3**.
- **Further actions.**
  1. Remove the forced `'auto'` in `cron.ts:85`, or make it an explicit, documented exception approved by the practice owner, and check `draft.safe`.
  2. Gate every provider send behind one `outbound()` function that enforces MODE and `FORBIDDEN_PATTERNS`.
  3. Keep a single pattern source.
  4. Add a CI test that greps for direct provider calls.
- **Status (v0.2).** **Fixed in code** in the api-server (`e094063`). Front-desk gaps remain open.
  - One gate: `artifacts/api-server/src/lib/outbound.ts`. `outboundBlocked()` is consulted by SMS (`lib/sms.ts`), Gmail (`lib/gmail.ts`), WhatsApp via Meta and Telnyx (moved to `lib/whatsapp-send.ts`), Twilio TwiML replies, the pre-visit SMS and calendar writes (`lib/calendar.ts`, `routes/scheduling.ts`, `routes/booking.ts`). An unrecognised `MODE` fails closed to `dry_run`. `resolveEmailMode()` lets a caller's `force` tighten the mode, or send a staff-internal alert directly under `supervised`, but never lift `dry_run`. A malformed override such as `req.body.mode` is ignored.
  - The 24-hour reminder email (`routes/cron.ts`) now follows `MODE`: skipped under `dry_run`, a Gmail draft under `supervised`, sent under `auto`. Sending directly under `supervised` needs `REMINDER_EMAIL_AUTO_SEND=true`, a practice-owner opt-in that is off by default.
  - The Claude-drafted reminder body, and the email-intake urgent acknowledgement, are screened (`screenOutboundText()`). A quarantined draft is not sent; it is audit-logged with the matched rules and sent to staff as a `[REVIEW REQUIRED]` alert.
  - The staff WhatsApp reply no longer marks a message resolved when the provider send failed.
  - Tests: `artifacts/api-server/src/test/outbound-safety.test.ts`, `cron-reminders.test.ts`.
  - Actions 1 and 2 done. **Open:** action 3 (the second pattern copy in `artifacts/front-desk/lib/constants.ts` still exists), action 4 (no CI grep for direct provider calls), and regex evasion.
  - **Open, found in this refresh:** the front-desk app does not use the api-server gate. `artifacts/front-desk/lib/email.ts` sends unless `MODE` is exactly `dry_run`, so an unset or misspelt `MODE` on the front-desk Vercel project **sends**. `lib/twilio.ts` defaults an unset value to `dry_run` but also sends on a misspelt one. The production value is **to verify**.
- **Residual risk (v0.2, proposed).** Significant × Low = **2**.

### H-10: Automated prep instructions give blanket medication-hold advice

- **Features.** `getPrepInstructions()` in `artifacts/api-server/src/lib/sms.ts`, sent in 48-hour SMS reminders (`cron.ts:60-62`) and 24-hour email reminders (`cron.ts:80-85`, which bypasses MODE, see H-09).
- **Causes (confirmed).** Static text tells every patient having an applicable procedure:
  - "Do NOT take diabetes tablets or insulin on the morning" (`sms.ts:117`, similar at `137`, `147`, `165`)
  - "Do NOT take ... blood thinners on the morning unless specifically instructed" (`sms.ts:165`)

  This is individual medication advice in an automated message, contrary to the `CLAUDE.md` rule ("Never include clinical advice ... medication dosages ... in any automated message"). Omitting basal insulin in type 1 diabetes risks diabetic ketoacidosis. Holding or continuing an anticoagulant or antiplatelet without an individual plan risks thrombosis or bleeding.
- **Effects.** The patient follows generic advice that is wrong for them, leading to DKA, hypo- or hyperglycaemia, or thrombotic or bleeding complications. The procedure may be cancelled.
- **Existing controls.** The text includes "call us if unsure" / "follow the specific instructions given to you by Dr Kabiye" (`sms.ts:117, 155`). The pre-procedure assessment workflow (`routes/pre-procedure.ts`) is **to confirm** as covering diabetic and anticoagulated patients individually.
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. **Clinical owner to review the wording now.** Replace the medication lines with "Your doctor will give you personal instructions about diabetes and blood-thinning medicines. Do not change them unless told to."
  2. Ensure every patient on insulin or an anticoagulant has a documented individual plan before an endoscopy slot is confirmed.
- **Status (v0.2).** **Fixed in code** in every automated patient text found. The wording follows the surgeon's recorded decisions (commit messages `38a7891`, `996fe1b`); formal approval of the final text by the practice owner is still worth recording in the safety case.
  - api-server prep templates (`artifacts/api-server/src/lib/sms.ts`, `e094063`): no line tells a patient to take, skip or stop a medicine. They now say "If you take insulin, blood thinners or diabetes medicines, please call the clinic before your procedure for instructions."
  - Front-desk booking emails, public endoscopy and pathway pages and the dashboard's staff prep text (`artifacts/front-desk/lib/instructions.ts`, `38a7891`).
  - Fasting follows one rule everywhere: 6 hours for food and 2 hours for clear fluids for GA, sedation, OGD and ERCP; colonoscopy clear fluids until 2 hours before; flexible sigmoidoscopy a light breakfast; no "nil by mouth from midnight" (`ba47093`, `38a7891`, `996fe1b`).
  - Booking types map to instruction sets explicitly, so OGD, flexible sigmoidoscopy, pre-op assessment and thyroid clinic no longer get another type's preparation (`b9ae85b`, `APPOINTMENT_INSTRUCTIONS`).
  - Enforcement: `outbound-safety.test.ts` (api-server) and the CI step `lint:patient-instructions` (`scripts/src/lint-patient-instructions.ts`). The lint fails on any sentence pairing insulin, a diabetes medicine or a blood thinner with take/hold/stop/adjust/skip, on any fast-from-midnight line, and on a booking type without an explicit mapping.
  - Action 1 done. **Open:** action 2 (a documented individual plan before an endoscopy slot is confirmed).
- **Residual risk (v0.2, proposed).** Major × Very low = **2**.

### H-11: Message or PHI sent to the wrong recipient

- **Features.** SMS, WhatsApp and email (`lib/sms.ts`, `lib/gmail.ts`, `routes/whatsapp.ts`, `front-desk/lib/twilio.ts`).
- **Causes.**
  - Phone normalisation assumptions: 7 digits become `+1758`, 10 digits become `+1` (`lib/sms.ts:3-10`).
  - A shared family phone.
  - Staff reply to the wrong thread.
  - WhatsApp-to-SMS fallback to a recycled number.
  - The patient's name and procedure appear in lock-screen notifications (`ios/.../NotificationService.swift:49, 71`) and in calendar events (`CalendarService.swift:81, 110, 139`).
- **Effects.** A confidentiality breach causing distress. Instructions reach the wrong person.
- **Existing controls.** The content filter keeps diagnoses and results out of automated messages. Messages are appointment-focused. Staff replies are authenticated (`requireStaffAuth`).
- **Initial risk.** Significant × Medium = **2**, with Considerable for sensitive clinics such as breast cancer.
- **Residual risk.** Significant × Low = **2**.
- **Further actions.**
  1. Confirm the recipient on first contact.
  2. Minimise the content of notifications and calendar events (initials only).
  3. Add a privacy-policy statement about SMS and WhatsApp risks, with patient consent.
- **Status (v0.2).** Open. Actions 1-3 not started. Lock-screen notifications and calendar events still carry the patient's name.

### H-12: Sync conflict reverts a correction, or a deletion does not propagate

- **Features.**
  - iOS peer sync (`ios/AmiseMedFlow/Services/PeerSyncService+ApplyRecords.swift`)
  - iOS cloud sync (`SyncService*.swift`), tombstones (`SyncTombstones.swift`)
  - NAS restore through the same merge (`NASBackupService+Restore.swift:5-8`)
- **Causes (confirmed design).**
  - **"Longer value wins regardless of timestamp"** for chief complaint, HPI, PMH, family and social history, **allergies**, investigations and PMH/PSH entries (`PeerSyncService+ApplyRecords.swift:59-72`), and for procedure-form blobs (`:88`). A correction that shortens a field (removing an erroneous allergy or finding) is **reverted** by the longer copy on another device.
  - **Deletes are local only.** Staff cannot DELETE server rows (admin-only RLS), so a deleted note, prescription, vital or document stays on the server and on other devices (`SyncTombstones.swift:1-8`).
  - Local un-uploaded edits win over the server copy (`SyncService+Notes.swift:128`).
- **Effects.**
  - An erroneous prescription or allergy persists, leading to a wrong drug being given or a needed drug being withheld.
  - An incorrect history reappears after correction.
  - The clinician believes a record is removed when it is not.
- **Existing controls.**
  - Record-level newest-wins for administrative fields (`ApplyRecords.swift:37`).
  - Newer-wins for exam, doctor-assessed and pathway fields (`:101-114, 259-266`).
  - The iOS audit trail (`Services/AuditLog.swift`).
  - Additive restore that never replaces newer data (`NASBackupService+Restore.swift:7-8`).
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. Replace length-based merge with field-level timestamps or explicit conflict prompts for clinical fields (at least allergies and medications).
  2. Implement a server-side soft delete (`deleted_at`) that propagates.
  3. Show a "conflict" indicator.
  4. Add sync-merge unit tests.
- **Status (v0.2).** Partly fixed. The confirmed core defect (longer copy wins) is **still open**.
  - **Deletes (pending migration).** Migration 87 (`supabase-soft-delete-migration.sql`, `cad8d9c`) adds `deleted_at`/`deleted_by` to the five iOS-synced tables and a `soft_delete()` RPC that checks the role and writes an `audit_log` row in the same transaction. iOS sends its tombstones to it and removes rows deleted elsewhere on pull (`48ac9f7`). The web and API hide soft-deleted notes, and a deleted draft is never signed (`8f8a467`). Until Migration 87 is applied, the tombstones wait on the device and deletes stay local, as before.
  - **Pull protection (fixed in code).** A cloud pull never overwrites a record with unsent local edits (`e51e40c`, `PatientPullMerge`). A push clears `pendingSync` only when the server returns the row and the record was not edited during the request.
  - **Peer sync (fixed in code).** A peer apply never clears `pendingSync`, and a peer's unsent change stays pending on the receiver (`dac2823`, `PeerApplyPending`). Records created or edited offline are now exchanged, using a stamp of `max(updatedAt, syncedAt)` (`746d289`, `PeerSyncService+Versions.swift`). A newer record's blank admin fields no longer erase local values (`a672137`).
  - **Child records (fixed in code).** Edits to prescriptions, vitals and billing items after the first upload now reach the server (`70ade9d`) and reach other devices on pull when the local copy is clean (`717a03e`, `ChildPullMerge`).
  - Tests: `SyncMergeTests`, `PullProtectionTests`, `SyncGapsTests`, `SyncCompletenessTests` (action 4 done).
  - **Still open:** `PeerSyncService+ApplyRecords.swift` still merges chief complaint, HPI, PMH, family and social history, **allergies**, investigations, PMH/PSH entries and the procedure-form blobs by "longer value wins regardless of timestamp". A correction that shortens one of these fields is reverted by a longer copy on another device (actions 1 and 3).
- **Residual risk (v0.2).** Unchanged at Major × Medium = **3** until the length-based merge is replaced.

### H-13: Loss of clinical data

- **Features.** The iOS store (`AmiseMedFlowApp.swift:19-46`), the iOS outbox (`SyncService+OfflineQueue.swift`), the dashboard outbox (`sync-outbox.ts`), and server backups (`.github/workflows/backup.yml`, `docs/INCIDENT-RUNBOOK.md`).
- **Causes.**
  - On a schema-load failure, the iOS store is **copied aside and replaced with an empty store** (`AmiseMedFlowApp.swift:31-37`). If that also fails, the app runs **in memory**, so nothing entered persists (`:43-45`). The user is not told in either case (**to confirm**).
  - Dashboard outbox entries are abandoned after 5 retries (`MAX_RETRIES`).
  - The iOS outbox is kept in UserDefaults.
  - **Supabase PITR is disabled**, so the recovery point is about 24 hours (`INCIDENT-RUNBOOK.md`).
  - Server backups do not include the `call-recordings`, `patient-photos` or `clinical-attachments` buckets.
- **Effects.** Notes, vitals or prescriptions are missing, leading to repeated or omitted treatment and a medico-legal gap.
- **Existing controls.**
  - The dashboard IndexedDB outbox, with executors (`CLAUDE.md`, `sync-executors.ts`).
  - The iOS pending count and sync status bar.
  - iOS NAS backup with verification and test restore (`NASBackupService+Restore.swift`).
  - Nightly encrypted DB backups (`backup-db.sh`).
- **Initial risk.** Considerable × Medium = **3**.
- **Residual risk.** Considerable × Medium = **3**.
- **Further actions.**
  1. Show a blocking alert when the iOS store falls back to in-memory mode or is reset.
  2. Show a failed-outbox alert that names the patient.
  3. Enable PITR (the owner's budget decision).
  4. Back up all buckets.
  5. Hold a quarterly restore drill.
- **Status (v0.2).** Open. Actions 1-5 not started. Sync fixes that stop clinical edits being lost on the way to the server (fixed in code):
  - one refused record no longer aborts the rest of every sync cycle, and a refused record keeps its local data and stays pending (`8e350a0`, `SyncService+Refusals.swift`);
  - an UPDATE that RLS filters out (0 rows, no error) is recognised as a refusal instead of being retried silently for ever (`9565db7`);
  - prescriptions were rejected by the server's route CHECK, and inserts with an empty dose or frequency were rejected by NOT NULL; both stayed pending for ever (`6a1e96c`, `cc83845`);
  - booking-created patients sent an `appt:` placeholder as a row id, so their edits and child records never uploaded (`6d6782f`, `SyncRemoteIds.swift`).
  - **New cause (pending surgeon decision).** After Migration 89, a front-desk device cannot write `hpi` or insert the pre-visit `clinical_notes` row, so the patient-reported HPI and the pre-visit note captured at the iPad front desk stay on the device and travel only by peer sync (`migrations/README.md`, "Open issue"). The surgeon needs to decide whether front desk may create that note.
  - `sync_conflicts` exists in the schema but is still unused.

### H-14: Offline replay overwrites newer data

- **Features.** The dashboard outbox replays stored payloads (`sync-outbox.ts`, `sync-executors.ts`). The iOS outbox flush (`SyncService+OfflineQueue.swift`).
- **Causes.** A queued older payload is replayed after another user saved a newer version. The idempotency key is entity plus epoch, but there is no version check against the server (**to confirm** per executor).
- **Effects.** A newer clinical entry is silently overwritten.
- **Existing controls.** Retry with back-off. The `sync_conflicts` table exists in the schema, but whether any executor uses it is **to confirm**.
- **Initial risk.** Considerable × Medium = **3**.
- **Residual risk.** Considerable × Medium = **3**.
- **Further actions.** Use optimistic concurrency (an `updated_at` precondition) in the executors. Surface conflicts to the user.
- **Status (v0.2).** Partly fixed.
  - iOS (fixed in code): the pull never overwrites unsent edits (`e51e40c`); a clean prescription is updated from the server only when the server's `updated_at` is newer (`717a03e`); a push clears `pendingSync` only if the record did not change during the request.
  - Dashboard (confirmed in this refresh): 2 of the 18 outbox executors in `artifacts/dashboard/src/lib/sync-executors.ts` (assessment and plan) pass `expectedUpdatedAt` and raise a conflict; the other 16 replay without a version check. Still open.

### H-15: Duplicate or split patient record hides allergies or history

- **Features.** iOS deduplication (`ios/AmiseMedFlow/Services/PatientDeduplication.swift:1-60`), MRN generation (`MRNGenerator.swift`), web quick-create (`routes/admin.ts`), intake upsert by email (`routes/intake.ts`, `upsertPatient`), and the `duplicate_queue` table.
- **Causes.**
  - Name-based matching with an optional DOB.
  - An email-keyed upsert creates a record per email address.
  - Records created from WhatsApp phone lookups.
  - **No server-side merge exists** in the current tree: `docs/AUDIT-TRAIL-COVERAGE.md` refers to a merge route in `patient.ts`, which was retired in commit `f7da5d2`.
- **Effects.** The clinician views a partial record, so an allergy or prior surgery is not seen.
- **Existing controls.**
  - iOS registration is blocked when name and DOB match (`registeredMatches`, `PatientDeduplication.swift:48`).
  - A duplicate review sheet.
  - "Different people" marking.
  - Copies holding clinical data are never hidden.
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. Require DOB and phone at registration.
  2. Add a staff-facing merge workflow with an audit record.
  3. Produce a periodic duplicate report.
- **Status (v0.2).** Partly fixed. `hasClinicalData` now counts every clinically meaningful field, including allergies (and an explicit NKDA entry), chief complaint, PMH, exams and procedure forms. A copy holding any of them is never hidden or offered for removal, even when it shares an MRN (`79eaa1e`, `PatientDeduplication.swift`). An empty allergy list now reads "not recorded", never "NKDA" (`cd35bdf`). Actions 1-3 open.

### H-16: Wrong-patient data entry or display

- **Features.** The dashboard encounter context (`artifacts/dashboard/src/context/AppContext.tsx`), iOS patient views, document-to-patient matching, and name-based deduplication.
- **Causes.**
  - **The in-progress encounter is restored from `localStorage` on page load** (`AppContext.tsx:829-850`): vitals, symptoms and exam findings. It is not cleared on sign-out (`AuthContext.tsx:170-174`), so a later user, or the same user with a different patient open, may see or save stale findings (**to confirm** exact behaviour).
  - iOS may hide a same-name copy with no clinical data behind another record (`PatientDeduplication.swift:34-40`). Two different people sharing a name, with the DOB missing, could be conflated.
  - Results documents are auto-matched to patients.
  - Multiple patient tabs are open at once.
- **Effects.** Findings, results or prescriptions are recorded against the wrong patient, leading to wrong treatment.
- **Existing controls.**
  - The explicit "new encounter" clear (`AppContext.tsx:1140-1150`).
  - iPad opens one patient at a time, full screen (commit `6bd1c81`).
  - Unmatched documents are left with `patient_id: null` rather than guessed.
  - The iOS audit log records patient ids.
- **Initial risk.** Major × High = **4**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. Bind locally cached encounter state to the patient id and user id, and clear it on sign-out.
  2. Show a persistent patient banner (name, DOB, MRN) on every clinical screen and printout.
  3. Require confirmation when attaching a result to a patient.
- **Status (v0.2).** Open on the web: the in-progress encounter in localStorage is still not bound to a user or cleared on sign-out (`AuthContext.tsx` `signOut()` only calls `supabase.auth.signOut()`). iOS controls added: the Scores screen and the iPad and iPhone calendar consultations show "Record no longer available" if the patient is deleted or merged while open (`8e6f3dd`, `705717f`, `925ef2f`); duplicates holding clinical data are no longer hidden behind another record (`79eaa1e`). Actions 1-3 open.

### H-17: AI-drafted clinical document contains errors and is signed

- **Features.**
  - `routes/generate-letter.ts`, `generate-operative-note.ts`, `generate-endoscopy-report.ts`, `discharge-summary.ts`, `procedure-report.ts`, `summary.ts` (SOAP polish and refine), `ai-consult.ts`, `mm-cases.ts`, `suggest-codes.ts`
  - Dashboard tabs such as `LetterGeneratorTab.tsx`, `ProceduresTab.tsx`, `EndoscopyReportGenerator.tsx`
- **Causes.** LLM hallucination (invented findings, doses or laterality). Omission of key facts. Automation bias at sign-off. Prompt injection from pasted documents.
- **Effects.** Wrong information goes to the GP, the patient or an insurer, leading to wrong follow-up and medico-legal exposure.
- **Existing controls.**
  - An "AI-Assisted Draft — Reviewed, Approved, and Signed by Surgeon" footer (`ProceduresTab.tsx:136`, `LetterGeneratorTab.tsx:291`, `EndoscopyReportGenerator.tsx:149`).
  - An `action: 'draft'`/`'ai_call'` audit (`docs/AUDIT-TRAIL-COVERAGE.md`).
  - `FORBIDDEN_PATTERNS` on some summary outputs (`summary.ts`).
  - Advisory labels ("AI-generated suggestion — not a diagnosis", `PortalIntakeTab.tsx:210`; `QualityImprovementTab.tsx:583, 636`).
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.**
  1. Require an explicit review step that highlights AI-generated spans before signing.
  2. Record who approved which AI draft.
  3. Periodically audit a sample of AI drafts against source records.
- **Status (v0.2).** Open. Actions 1-3 not started. New control: `DISABLE_AI=true` now switches off every AI call site in the api-server and front-desk, so the practice can stop AI drafting at once (`113b1d9`, `lib/ai-gate.ts`; coverage table in `data-inventory.md` §6).

### H-18: Transcription or voice-parsing error enters the record

- **Features.**
  - iOS dictation (`SpeechService.swift`, server-based Apple recognition)
  - The web Whisper.js worker (`workers/asr-worker.ts`)
  - Voice segmentation with Claude (`routes/voice.ts`)
  - Narrative parsing (`routes/narrative.ts`, `local-soap-segmenter.ts`, `ClinicalTextParser.swift`)
  - Call-recording transcription with OpenAI (`routes/call-recording.ts`)
- **Causes.** Misrecognised drug names, numbers, laterality or negation ("no" dropped). Accents. Background noise.
- **Effects.** A wrong fact enters the record or feeds scores and the differential.
- **Existing controls.** Voice output is stored as `ai_proposals` for review (`routes/voice.ts`). The clinician edits the text before saving.
- **Initial risk.** Major × Medium = **3**.
- **Residual risk.** Major × Medium = **3**.
- **Further actions.** Highlight numbers, drug names and laterality for confirmation. Use on-device recognition on iOS.
- **Status (v0.2).** Open. iOS dictation now runs on-device whenever the recogniser supports it (`16435f3`, `SpeechService.swift`). That is a privacy gain, not an accuracy control. `DISABLE_TRANSCRIPTION=true` can switch off call transcription alone (`113b1d9`).

### H-19: Unauthorised access to or disclosure of PHI

The full analysis is in `security-controls.md` §3. In summary:

- **Front-desk `/api/staff/*`** runs with the service-role key and is gated only by the *presence* of a cookie (`artifacts/front-desk/middleware.ts:6-12, 43-50`; `app/api/staff/patients/route.ts:20-28`).
- **RLS on `patients` and `documents` is `auth.uid() is not null`** (`supabase-schema.sql:319-320`, `supabase-clinical-records-migration.sql:312-313`), while **portal patients are Supabase Auth users in the same project** (`routes/portal.ts:65`).
- **`requireStaffAuth()` accepts any Supabase JWT** (`api-server/src/lib/supabase.ts:28-50`).
- **iOS peer sync accepts any nearby device presenting a non-cryptographic hash of the user's email.** That hash is broadcast in Bonjour discovery info (`PeerSyncService.swift:86-91`; `+MCDelegates.swift:19`; `+ApplyRecords.swift:233-237`).
- ~~**A patient questionnaire token is sent to api.qrserver.com** (`QuestionnaireManagerTab.tsx:720`).~~ **Fixed:** QR codes are generated locally (`LocalQrCode.tsx`), with a CI lint against third-party QR services.

| | |
|---|---|
| Effects | Mass confidentiality breach, identity misuse, loss of trust, regulatory action |
| Existing controls | Private buckets. Rate limiting (`api-server/src/app.ts:136-139`). Helmet and CORS (`app.ts:49, 76`). Audit logging. `encryptionPreference: .required` for peer sync. Face ID/passcode lock after 30 s in the background (`BiometricAuthService.swift:18`) |
| Initial risk | Considerable × High = **3** (patient-safety framing) |
| Residual risk | Considerable × Medium = **3**. **As a security finding this is critical; see `security-controls.md`** |
| Further actions | See `security-controls.md` §3, items S-1 to S-6 |

**Status (v0.2).** The list above is the v0.1 finding. Current state, detailed in `security-controls.md` §3:

- **S-1 front-desk staff API: fixed in code** (`19a7479`). `artifacts/front-desk/lib/staff-auth.ts` (`requireStaff()`) validates the token and requires a staff `user_profiles` role on every `/api/staff/*` handler. The middleware no longer counts generic `sb-*` cookies, and the patient search strips PostgREST filter syntax.
- **S-2 RLS vs portal patients: pending migration.** Migration 89 (`supabase-staff-only-rls-migration.sql`; `946bdbe`, `1a01b5d`, `aaa53c0`) makes every staff policy on about 55 PHI tables and the four storage buckets test `auth_role()`, stops new auth users getting a `front_desk` profile, and adds column guards on `patients` UPDATE. `lint:rls-policies` now fails if a required policy's last definition is open again (`dd49997`). **Until Migration 89 is applied, a portal patient can still read every patient, document and booking directly from Supabase with their own JWT.**
- **S-3 `requireStaffAuth()`: fixed in code** (`f3338ca`, `e6cbf09`). A staff `user_profiles` role is required. The machine path takes `STAFF_MACHINE_TOKEN`, compared in constant time. That separation takes effect only once the variable is set on Render and the front-desk Vercel project; until then `CRON_SECRET` is still accepted.
- **S-4 QR token leak: fixed in code** (`f430146`).
- **S-5 peer-sync authentication: open.** The session still has no `securityIdentity` and admits peers by an email hash advertised in discovery info (`PeerSyncService.swift:83-91` at `cc83845`).
- **S-6 web and API Sentry scrubbing: open.** Both still call `Sentry.init` with no `beforeSend`.
- **New control:** questionnaire hand-over mode on iOS (`23904fd`). When the iPad is handed to a patient, no other patient's name is visible: no default patient list, search after 3+ letters or an MRN, at most 5 results, a full-screen cover, and a staff-only exit that needs Face ID, Touch ID or the device passcode. The prescription photo is camera-only, so the photo library cannot show other patients' images. Opening and leaving are audit-logged.

| | |
|---|---|
| Residual risk (v0.2, proposed) | Considerable × Medium = **3** today. **2** (Considerable × Low) once Migration 89 is applied and `STAFF_MACHINE_TOKEN` is set, with S-5 and S-6 still open |

### H-20: System unavailable during clinical care

- **Features.** The API on Render and Supabase.
- **Causes.** Vendor outage, a bad deploy or a bad migration.
- **Effects.** No access to history, allergies or results during clinic, leading to delay or decisions made without information.
- **Existing controls.**
  - Dashboard Supabase fallback for reads, with a degraded-mode banner (`CLAUDE.md`).
  - iOS offline-first local store.
  - The health and readiness endpoints and the rollback runbook (`docs/INCIDENT-RUNBOOK.md`).
- **Initial risk.** Considerable × Low = **2**.
- **Residual risk.** Considerable × Low = **2**.
- **Further actions.** A written downtime procedure (paper fallback, printed clinic list the day before).
- **Status (v0.2).** Open. New causes:
  - Once Migration 89 is applied, a staff account without a `user_profiles` row can sign in but sees no data. Run the pre-flight queries in `migrations/README.md` (Migration 89) first.
  - The migration runner has never completed on production. It now applies to a fresh database and re-runs cleanly, checked in CI (`8824214`, `bf6f602`, `scripts/src/check-migrations-fresh.ts`). The first complete production run will apply every step that had been failing (including 68, 77 and 87–90), so it needs a planned window and a backup first.

---

## 4. Change control for this log

- Each code change that touches a feature named above must reference the hazard ID in its pull request. The CSO decides whether to re-rate.
- A new feature that generates advice, scores, alerts or outbound messages must add a hazard entry **before** release.
- Log review cadence: at every release, and at least quarterly.

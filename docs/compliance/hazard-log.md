> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Hazard log (DCB0129-style)

| | |
|---|---|
| System | AMISE MedFlow EMR: dashboard, API server, front-desk and patient portal, iOS app |
| Code baseline | `c9a7293` |
| Status | Draft v0.1, 2026-09-24. **No entry has been reviewed or accepted by a Clinical Safety Officer (CSO).** All ratings are the author's proposal |
| Companion | `clinical-safety-case.md` (argument and evidence), `data-inventory.md`, `security-controls.md` |

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

| ID | Hazard | Initial | Residual | Status |
|---|---|---|---|---|
| H-01 | Patient-facing triage fails to identify an emergency | 4 | **3** | Open |
| H-02 | AI urgency or extraction downgrades a deterministic or true severity | 3 | 2 | Open |
| H-03 | Urgent result misclassified as routine in the Results Inbox | 3 | **3** | Open |
| H-04 | NEWS2 under-scored because implementations are defective or inconsistent | 4 | **4** | **Open: confirmed defects** |
| H-05 | Other clinical score calculated or auto-populated incorrectly | 3 | **3** | Open |
| H-06 | Bayesian differential misleads the clinician (anchoring or omission) | 3 | **3** | Open |
| H-07 | Drug-interaction checker gives false reassurance | 3 | **3** | Open: confirmed gap |
| H-08 | Formulary or dosing reference content is wrong | 3 | **3** | Open |
| H-09 | Automated outbound message bypasses the MODE gate or the content filter | 3 | **3** | Open: confirmed |
| H-10 | Automated prep instructions give blanket medication-hold advice | 3 | **3** | Open: confirmed |
| H-11 | Message or PHI sent to the wrong recipient | 3 | 2 | Open |
| H-12 | Sync conflict reverts a correction, or a deletion does not propagate | 3 | **3** | Open: confirmed design |
| H-13 | Loss of clinical data (store reset, dropped outbox, no PITR) | 3 | **3** | Open |
| H-14 | Offline replay overwrites newer data | 3 | 3 | Open |
| H-15 | Duplicate or split patient record hides allergies or history | 3 | **3** | Open |
| H-16 | Wrong-patient data entry or display | 4 | **3** | Open |
| H-17 | AI-drafted clinical document contains errors and is signed | 3 | **3** | Open |
| H-18 | Transcription or voice-parsing error enters the record | 3 | 3 | Open |
| H-19 | Unauthorised access to or disclosure of PHI | 3 | **3** | Open: see `security-controls.md` |
| H-20 | System unavailable during clinical care | 2 | 2 | Open |

**Highest residual risk, top 5.** Sorted by residual rating, then severity, then whether the defect is *confirmed in code* rather than theoretical:

1. **H-04** NEWS2 under-scoring (rating 4)
2. **H-10** Blanket insulin and diabetes-medication advice in automated prep messages, part of which bypasses the MODE gate (rating 3, confirmed, reaches patients with no human gate)
3. **H-12** Sync merge reverts corrections, and deletions don't propagate (rating 3, confirmed)
4. **H-07** Drug-interaction false reassurance: class names are not mapped to drugs (rating 3, confirmed)
5. **H-09** Outbound automation bypasses MODE and FORBIDDEN_PATTERNS (rating 3, confirmed)

H-19 (the PHI access-control gaps) is rated in patient-safety terms here. As an information-security matter it is **critical**, and it is the first priority in `security-controls.md`.

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

### H-14: Offline replay overwrites newer data

- **Features.** The dashboard outbox replays stored payloads (`sync-outbox.ts`, `sync-executors.ts`). The iOS outbox flush (`SyncService+OfflineQueue.swift`).
- **Causes.** A queued older payload is replayed after another user saved a newer version. The idempotency key is entity plus epoch, but there is no version check against the server (**to confirm** per executor).
- **Effects.** A newer clinical entry is silently overwritten.
- **Existing controls.** Retry with back-off. The `sync_conflicts` table exists in the schema, but whether any executor uses it is **to confirm**.
- **Initial risk.** Considerable × Medium = **3**.
- **Residual risk.** Considerable × Medium = **3**.
- **Further actions.** Use optimistic concurrency (an `updated_at` precondition) in the executors. Surface conflicts to the user.

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

### H-19: Unauthorised access to or disclosure of PHI

The full analysis is in `security-controls.md` §3. In summary:

- **Front-desk `/api/staff/*`** runs with the service-role key and is gated only by the *presence* of a cookie (`artifacts/front-desk/middleware.ts:6-12, 43-50`; `app/api/staff/patients/route.ts:20-28`).
- **RLS on `patients` and `documents` is `auth.uid() is not null`** (`supabase-schema.sql:319-320`, `supabase-clinical-records-migration.sql:312-313`), while **portal patients are Supabase Auth users in the same project** (`routes/portal.ts:65`).
- **`requireStaffAuth()` accepts any Supabase JWT** (`api-server/src/lib/supabase.ts:28-50`).
- **iOS peer sync accepts any nearby device presenting a non-cryptographic hash of the user's email.** That hash is broadcast in Bonjour discovery info (`PeerSyncService.swift:86-91`; `+MCDelegates.swift:19`; `+ApplyRecords.swift:233-237`).
- **A patient questionnaire token is sent to api.qrserver.com** (`QuestionnaireManagerTab.tsx:720`).

| | |
|---|---|
| Effects | Mass confidentiality breach, identity misuse, loss of trust, regulatory action |
| Existing controls | Private buckets. Rate limiting (`api-server/src/app.ts:136-139`). Helmet and CORS (`app.ts:49, 76`). Audit logging. `encryptionPreference: .required` for peer sync. Face ID/passcode lock after 30 s in the background (`BiometricAuthService.swift:18`) |
| Initial risk | Considerable × High = **3** (patient-safety framing) |
| Residual risk | Considerable × Medium = **3**. **As a security finding this is critical; see `security-controls.md`** |
| Further actions | See `security-controls.md` §3, items S-1 to S-6 |

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

---

## 4. Change control for this log

- Each code change that touches a feature named above must reference the hazard ID in its pull request. The CSO decides whether to re-rate.
- A new feature that generates advice, scores, alerts or outbound messages must add a hazard entry **before** release.
- Log review cadence: at every release, and at least quarterly.

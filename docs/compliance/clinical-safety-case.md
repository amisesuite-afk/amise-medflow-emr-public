> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Clinical safety case report (DCB0129-style)

| | |
|---|---|
| Manufacturer | Amise Medical Services (Saint Lucia). Legal manufacturer entity **to confirm** |
| Product | AMISE MedFlow EMR: web dashboard, API server, front-desk and patient portal, iOS app |
| Code baseline | `c9a7293` |
| Document status | Draft v0.1, 2026-09-24. **Not approved** |
| Clinical Safety Officer | **Not yet appointed.** Must be a registered clinician with training in clinical risk management |
| Hazard log | `hazard-log.md` |

## 1. Purpose and standard

This report sets out the argument, and the evidence available today, that the software is acceptably safe for its intended use. It follows the structure of **DCB0129** ("Clinical Risk Management: its Application in the Manufacture of Health IT Systems", NHS England).

- DCB0129 is a legal requirement only for suppliers to the NHS in England. It is used here as a recognised framework for a practice that intends to sell the software to other clinics.
- **DCB0160** is the deploying organisation's counterpart. Each customer practice should run its own DCB0160-style assessment.

**Current conclusion: the safety case is not yet made.**

- One hazard (H-04, NEWS2) has a residual risk of 4, which is undesirable.
- Several rating-3 hazards rest on defects confirmed in the code.
- No CSO has reviewed the log.
- There is no formal Clinical Risk Management Plan.
- There is no clinical validation evidence for the triage, scoring or differential engines.

The product should **not be sold or deployed to other practices** until the actions in §8 are closed.

## 2. Intended use (proposed; for the CSO and counsel to confirm)

1. **The software is**:
   - an electronic medical record and practice-management system for outpatient general and endoscopic surgery
   - a set of **clinical decision-support tools** that present calculated scores, suggested differential diagnoses, pathway prompts, interaction alerts and AI-drafted documents **to a qualified clinician**, who independently reviews the basis for each output
   - an administrative patient-intake and scheduling channel (web, WhatsApp/SMS, email)
2. **Intended users**: registered doctors, nurses and trained front-desk staff. Patients use only the intake and portal functions.
3. **Not intended**:
   - to diagnose, prescribe, order investigations or procedures, or triage patients autonomously
   - to replace clinical judgement
   - to serve as an emergency service or as monitoring equipment
4. **Clinical authority.** This mirrors `CLAUDE.md`, "Human authority". The surgeon retains full responsibility for:
   - clinical assessment
   - diagnosis
   - investigations
   - treatment decisions
   - operative planning
   - procedures
   - documentation approval
   - prescribing
   - referrals
   - final sign-off

   The software may recommend, organise, summarise and assist. It must never independently diagnose, prescribe, order procedures or modify the medical record without explicit clinician approval.

## 3. System description (safety-relevant functions)

| Function | Where | Safety relevance |
|---|---|---|
| Patient intake triage and red flags | `lib/triage-engine` (`apcq.ts`, `adaptive-triage.ts`, `rules.ts`), `artifacts/front-desk/app/intake`, `front-desk/lib/claude.ts`, `api-server/src/routes/intake.ts` | Can route a patient away from, or towards, urgent care |
| Early warning and clinical scores | Dashboard `clinical-scores.ts`, `clinical-scales.ts`. iOS `VitalsEntry.swift`, `ClinicalScoringEngine*.swift`, `PatientScoreAutoPopulator*.swift` | Informs escalation and severity |
| Bayesian differential | `lib/pane-engine`, iOS `Bayesian*Engine*.swift`, `SequentialDiagnosisEngine*.swift` | Informs diagnosis |
| Management and pathway prompts | `lib/pane-engine/src/management`, iOS `ManagementEngine*.swift`, `SurgicalAlgorithmEngine.swift`, `AutoFunctionEngine.swift` | Informs investigation and treatment |
| Prescribing support | Formularies, `drug-interactions.ts`, `AllergyMedAlert.tsx`, iOS `DrugInteractionService.swift`, `DiagnosisDosingGuide.swift` | Medication safety |
| AI documentation and extraction | API AI routes (see `data-inventory.md` §6) | Record accuracy |
| Outbound patient messaging | `api-server/src/lib/sms.ts`, `gmail.ts`, `routes/cron.ts`, `routes/whatsapp.ts`, `front-desk/lib/twilio.ts` | Patient instructions, confidentiality |
| Sync, offline and backup | iOS `SyncService*`, `PeerSyncService*`, `NASBackupService*`. Dashboard `sync-outbox.ts` | Record integrity and availability |
| Patient identity | iOS `PatientDeduplication.swift`, `MRNGenerator.swift`. API intake upsert | Wrong-patient risk |

## 4. Clinical risk management process (to be formalised)

- **Hazard identification.**
  - Done so far: a structured code review of each function above, using the prompts "what if the output is wrong, missing, late or attributed to the wrong patient". This is recorded in `hazard-log.md`.
  - To do: a facilitated workshop with the CSO, a nurse and front-desk staff.
- **Risk estimation.** The 5×5 matrix in `hazard-log.md` §1.
- **Risk evaluation.** Ratings of 4-5 must be reduced, or explicitly justified by the CSO, before release. Rating 3 is acceptable only after the listed further actions have been considered.
- **Risk control.** In order of preference:
  1. Design changes (for example a single tested NEWS2 implementation).
  2. Protective measures (for example the MODE gate and `FORBIDDEN_PATTERNS`).
  3. Information for safety (labelling and training).
- **Verification.** Each control needs objective evidence: a unit test, an end-to-end test (`e2e/emr-walkthrough.mjs`), CI lints, or a documented manual test.
- **Post-market surveillance.** Incident reporting and M&M linkage (`QualityImprovementTab.tsx`, `mm_cases`), Sentry, and the audit log.

## 5. Safety argument

**Top claim.** When used as intended by trained clinicians, the system's residual clinical risks are reduced as low as reasonably practicable and are acceptable.

| Sub-claim | Evidence available now | Gap |
|---|---|---|
| C1. Decision-support outputs do not act autonomously | Working diagnosis is set by clinician tap (iOS `ConsultationView+PlanTab.swift:129`). Diagnosis radiation needs an explicit tap (`CLAUDE.md`). AI drafts are labelled and audited. The `ai_proposals` review queue (`routes/ai-proposals.ts`) | The iOS differential % has no disclaimer (H-06) |
| C2. Calculations are correct | Some unit tests: `ios/AmiseMedFlowTests/ClinicalScoringEngineTests.swift`, `lib/pane-engine/src/__tests__/*`, `artifacts/api-server/src/test/triage-rules.test.ts` | **NEWS2 defects confirmed (H-04).** No inventory of test vectors for each score. Duplicate implementations |
| C3. Patient-facing triage is sensitive for emergencies | The deterministic emergency redirect with acknowledgement. The AI urgency floor (`questionnaire.ts:352-378`) | No sensitivity or specificity evidence. Regex coverage is unvalidated (H-01) |
| C4. Automated patient messaging contains no clinical advice and is supervised | The MODE gate with the boot guard (`api-server/src/index.ts:33-40`). `FORBIDDEN_PATTERNS` | **Bypasses confirmed:** `cron.ts:85` forced `'auto'`, unchecked drafts, and WhatsApp providers (H-09). **Blanket medication advice in prep text (H-10)** |
| C5. Records are complete, current and attributed to the right patient | Outboxes. The iOS audit trail (`Services/AuditLog.swift`). The duplicate review. NAS backup with test restore | Length-wins merge and non-propagating deletes (H-12). Silent in-memory fallback (H-13). Stale localStorage encounter (H-16). PITR off |
| C6. Only authorised people can see PHI | RLS. Roles. Private buckets. Face ID lock. Peer-sync encryption | **Critical gaps: see `security-controls.md` §3** |
| C7. Medication support is not falsely reassuring | Allergy alerts. Doctor-only prescribing UI. The "verify" text on iOS | Class names not mapped (H-07). Content not pharmacist-reviewed (H-08) |

## 6. Summary of residual risk

See `hazard-log.md` §2. The top five by residual risk:

| Rank | ID | Hazard | Residual |
|---|---|---|---|
| 1 | H-04 | NEWS2 under-scored (three inconsistent implementations, missing AVPU/O₂ on the dashboard, automatic Scale 2 on iOS) | **4** |
| 2 | H-10 | Blanket insulin and diabetes-tablet omission advice in automated prep messages | 3 |
| 3 | H-12 | Sync reverts corrections to allergies and history, and deletions do not propagate | 3 |
| 4 | H-07 | Drug-interaction checker misses class-based interactions | 3 |
| 5 | H-09 | Outbound automation bypasses MODE and the content filter | 3 |

## 7. Configuration and change control

- **Clinical content is code.** This covers scoring thresholds, formularies, interaction rules, prep instructions, Bayesian priors and system prompts. It should need a named clinical reviewer on the pull request. Suggestion: a `CODEOWNERS` entry for `lib/triage-engine/src/`, `lib/pane-engine/src/`, `artifacts/dashboard/src/lib/clinical-*.ts`, `drug-interactions.ts`, `prescription-formulary.ts`, `ios/AmiseMedFlow/Services/ClinicalScoringEngine*`, `Bayesian*`, `DrugInteractionService.swift` and `api-server/src/lib/sms.ts`.
- **Existing CI safety lints**: `lint:dx-phases`, `lint:grants`, `lint:rls-policies` and `scan:nav-lockout` (`CLAUDE.md`). Keep them. Add a NEWS2 and score test-vector suite, and a "direct provider send" lint.
- **Releases.** Every release note should list the hazard IDs affected, and the CSO signs off the release.

## 8. Actions required before the safety case can be signed

| # | Action | Owner | Hazard |
|---|---|---|---|
| 1 | Appoint a CSO. Write a Clinical Risk Management Plan | Practice owner | All |
| 2 | Fix NEWS2 (one shared implementation, clinician-selected Scale 2, RCP test vectors). Hide the dashboard panel until it is fixed | Engineering + CSO | H-04 |
| 3 | Rewrite the prep medication wording. Remove the forced `'auto'` send, or approve it as an exception, and check `draft.safe` | Clinical owner + Engineering | H-09, H-10 |
| 4 | Clinical-field merge with timestamps or conflict prompts. Server soft-delete | Engineering | H-12, H-14 |
| 5 | Map interaction classes to drugs, or license an interaction database. Add the "absence ≠ safe" label | Engineering + pharmacist | H-07, H-08 |
| 6 | Build an emergency-detection test set and measure sensitivity | CSO + Engineering | H-01 |
| 7 | Clear local caches on sign-out, bind cached state to the patient, show a persistent patient banner | Engineering | H-16 |
| 8 | Alert on iOS store reset or in-memory fallback, and on failed outbox entries. Decide on PITR | Engineering + owner | H-13 |
| 9 | Close the security gaps S-1 to S-6 | Engineering + owner | H-19 |
| 10 | Regulatory positioning decision (`medical-device-positioning.md`) | Owner + regulatory counsel | H-01, H-04, H-06 |

## 9. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Clinical Safety Officer | | | |
| Practice owner / manufacturer | Dr Dawit Daniel Kabiye (to confirm) | | |
| Engineering lead | | | |

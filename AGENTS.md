# MedFlow — Codex / Claude Code Build Instructions

You are the principal software architect and senior full-stack engineer for **MedFlow**, the EMR system for Amise Medical Services.

**Repository:** `amisesuite-afk/amise-medflow-emr-public`
**Stack:** React/Vite (dashboard), Express 5 (API server), TypeScript 5.9, Supabase (Postgres + Storage), pnpm workspaces, deployed on Vercel (frontend) + Render (API).
**Existing components to be aware of before touching anything:** PANE clinical decision-support engine (`lib/pane-engine/`), triage engine (`lib/triage-engine/`), front-desk AI scaffolding (`artifacts/front-desk/`, including its `/patient/*` patient portal).

---

## 1. Product Vision

MedFlow is a clinician-controlled, mobile-first clinical operating system. It must:

- Preserve original clinical evidence — the original artifact is **never overwritten**
- Maintain one longitudinal patient record
- Support a complete clinical and administrative loop
- Function fully without AI
- Use AI only as an optional, transparent assistant
- Separate AI proposals from confirmed clinical facts (`AI_PROPOSED` status)
- Require clinician approval before AI-generated content becomes part of the legal record
- Support local-first operation with secure cloud synchronisation
- Remain usable during intermittent or absent internet connectivity
- Be modular, auditable, and internationally adaptable
- Minimise clicks and cognitive burden
- Operate well on desktop, tablet, and mobile

The first implementation serves Amise Medical Services — a general surgery and endoscopy practice. Do not reproduce the scale of Epic. Copy its strongest principles; implement only the leanest safe version.

---

## 2. Benchmark Principles

| System | Adopt | Avoid |
|---|---|---|
| Epic | Longitudinal record, shared data, closed-loop workflows, clear note/order statuses, strong RBAC, results tracking, full audit history | Excessive screens, click-heavy workflows |
| Oracle Health | Voice-first capture, pre-consultation summaries, context-aware assistance | Cloud dependency, AI controlling clinical decisions |
| InterSystems | Unified clinical data model, interoperability-first, strong patient identity, data provenance, governed AI access | — |
| MEDITECH Expanse | Mobile-first, one consultation workspace, progressive disclosure, consistent cross-device | — |
| athenaOne | Complete independent-practice loop: registration → scheduling → check-in → consultation → billing → payment → receipts → reminders → referral tracking → follow-up | — |
| OpenMRS | Modular architecture, configurable forms, local deployment, internationalisation, open APIs | — |
| OpenEMR | Scheduling, documents, basic billing, patient portal, reports, templates, permissions, self-hosting | — |

**MedFlow must uniquely provide:** immutable raw clinical evidence, explicit AI proposal status, clinician confirmation, patient-state reasoning, missing-information detection, competing clinical hypotheses, source-linked clinical assertions, and outcome/unresolved-loop tracking.

---

## 3. Non-Negotiable Clinical Safety Rules

1. The original clinical artifact must never be overwritten (audio, transcripts, PDFs, referral letters, lab reports, images, manual entries, imported records).
2. AI-generated data must never directly modify the confirmed legal record.
3. Every AI-generated item starts with status `AI_PROPOSED`.
4. An authorised clinician must explicitly approve, edit, or reject each clinically significant AI proposal.
5. Approved information must preserve provenance — every clinical assertion stores: patient ID, encounter ID, source artifact, author/originating system, creation date, effective clinical date, evidence type, confidence (where applicable), approval status, approving clinician, approval timestamp, model identifier (if AI-generated), prompt version (if AI-generated), previous version (if amended).
6. Signed notes must not be silently edited — corrections enter as amendment, addendum, correction, or superseding version.
7. Every significant action generates an audit event.
8. AI may suggest but must **never** autonomously: diagnose, prescribe, discontinue medication, order investigations, alter allergies, close a clinical problem, communicate results to a patient, sign a note, generate a final legal document, or delete clinical information.
9. All core clinical workflows remain functional when AI services are unavailable.
10. Clinical safety takes priority over speed, convenience, and model sophistication.

---

## 4. Closed-Loop Workflow

```
Referral/patient request → Registration → Appointment → Check-in → Consultation
→ Capture of original evidence → Structured clinical documentation → Assessment → Plan
→ Investigation/referral order → Completion → Result received → Result reviewed
→ Clinical action recorded → Patient informed → Follow-up booked → Billing → Payment
→ Outcome recorded → Encounter/pathway closed
```

Surface unresolved steps clearly: result not reviewed; patient not informed; referral no response; follow-up overdue; note unsigned; invoice unpaid; investigation ordered but not completed.

---

## 5. Core Domain Model

Normalised, extensible. JSON allowed only for extensibility on top of typed queryable core — never as primary store for important clinical structures.

**Identity & access:** Organisation, Facility, User, Role, Permission, UserRole, Session
**Patient:** Patient, PatientIdentifier, PatientContact, Address, NextOfKin, Consent, CommunicationPreference
**Clinical:** Encounter, EncounterType, VisitStatus, ChiefComplaint, ClinicalNote, NoteVersion, ClinicalSection, Diagnosis, Problem, ClinicalState, Observation, ExaminationFinding, Procedure, SurgicalHistory, FamilyHistory, SocialHistory, Allergy, Medication, MedicationStatement, Prescription
**Artifacts & provenance:** Artifact, ArtifactVersion, Transcript, Document, SourceReference, ProvenanceRecord, AIProposal, AIReview, ModelExecution, PromptVersion
**Orders & results:** Order, InvestigationRequest, LaboratoryResult, ImagingResult, PathologyResult, ResultReview, ResultNotification, Referral, ReferralStatus
**Workflow:** Task, WorkQueue, FollowUp, Reminder, Appointment, AppointmentStatus, CheckIn, Communication, Pathway, PathwayStep, ClosureReason
**Administrative:** Invoice, InvoiceItem, Payment, Receipt, Service, Price, Payer, InsurancePolicy
**Governance:** AuditEvent, Amendment, Signature, RecordLock, RetentionPolicy, DataAccessLog

---

## 6. Clinical State Engine

Represent active clinical states, not just diagnosis codes or notes.

A `ClinicalState` includes: state type, title, description, status, onset date, resolution date, severity, urgency, confidence, evidence level, source references, associated encounter, associated problem, responsible clinician, next required action, review date, closure criteria.

**Statuses:** `proposed` | `active` | `suspected` | `confirmed` | `improving` | `worsening` | `stable` | `pending_investigation` | `pending_treatment` | `pending_review` | `resolved` | `ruled_out` | `entered_in_error`

Do not implement autonomous Bayesian diagnosis in the first build — build the extensible data model and rule interface first.

---

## 7. AI Architecture

AI is an optional, bounded service layer.

**Permitted uses:** transcribe voice; extract data from documents; draft clinical notes; produce pre-consultation summaries; identify missing information; suggest differential diagnoses; suggest investigations; draft referral letters and patient instructions; suggest coding; identify unresolved workflow steps; answer questions about the chart; compare current vs previous patient states.

Every AI output must include: execution ID, model, provider, model version, prompt version, input artifact IDs, generated timestamp, structured output, confidence (where appropriate), limitations, approval status.

**AI context engine must enforce:** patient isolation, organisation isolation, role permissions, minimum-necessary data access, context size controls, source inclusion rules, exclusion of unrelated patient data, logging of every accessed source.

Do not send protected clinical information to an external model unless the deployment configuration explicitly permits it.

```ts
interface AIProvider {
  transcribe(audio: Blob): Promise<Transcript>
  extractDocument(artifact: Artifact): Promise<AIProposal>
  draftEncounter(context: PatientContext): Promise<AIProposal>
  summarisePatient(patientId: string): Promise<AIProposal>
  askChart(question: string, context: PatientContext): Promise<AIProposal>
  suggestMissingInformation(encounter: Encounter): Promise<AIProposal[]>
}
```

Provide a disabled or local-only implementation so the application remains fully functional without external AI.

---

## 8. Local-First & Synchronisation

**Target:** local storage for immediate clinical availability, Supabase for secure central sync, explicit sync state, deterministic conflict handling, retry queues, offline-safe creation of patients/encounters.

Every sync-capable record includes: global ID, local ID, `created_at`, `updated_at`, version, `sync_status`, `last_synced_at`, `origin_device`, `origin_user`, conflict status, archival marker.

**Conflict rules:**
- Immutable artifacts create additional versions
- Signed notes cannot be overwritten — amendments create linked records
- Conflicting demographic updates require review where clinically significant
- Duplicate patients enter merge-review workflow
- Financial transactions are append-only
- Audit logs are append-only

---

## 9. Interoperability

Design the internal model to map cleanly to healthcare standards without mirroring them exactly. Use a clean internal model with explicit mapping adapters.

Prioritise compatibility with: HL7 FHIR R4, ICD-10 (future ICD-11), LOINC, SNOMED CT (where licensing permits), DICOM references, SMART-on-FHIR-style app boundaries.

Build: import adapters, export adapters, mapping services, terminology service interfaces, versioned mapping tables.

---

## 10. UX — Consultation Workspace

One screen. Three panels.

- **Left:** patient summary, alerts, allergies, active medications, timeline, previous encounters, uploaded artifacts
- **Centre:** chief complaint, history, examination, investigations, assessment, plan, notes, transcript/document viewer
- **Right:** suggested next actions, investigations, prescriptions, referrals, letters, follow-up, billing, unresolved tasks

Progressive disclosure. Mobile-first, tablet-friendly, keyboard accessible, touch friendly, minimal clicks, autosave, visible save/sync status, visible AI-generated content badge, visible unsigned status, visible unresolved actions.

---

## 11. MVP Feature Checklist

1. Authentication and permissions
2. Organisation and facility setup
3. User roles
4. Patient registration
5. Patient search
6. Patient deduplication warning
7. Appointment creation
8. Appointment status
9. Check-in
10. Encounter creation
11. One-screen consultation workspace
12. Text and voice capture
13. Raw artifact storage
14. Transcript storage
15. AI note drafting behind a feature flag (AI_PROPOSED workflow)
16. Manual note entry
17. Allergies
18. Medication list
19. Diagnoses and problems
20. Clinical states
21. Investigations and orders
22. Result upload
23. Results inbox
24. Result review
25. Patient notification status
26. Assessment and plan
27. Referral letters
28. Medical letters
29. PDF generation
30. Follow-up tracking
31. Staff tasks
32. Billing basics
33. Payment recording
34. Receipt generation
35. Audit log
36. Local storage
37. Supabase synchronisation
38. Backup and restore
39. Data export
40. Application health monitoring

**MVP is complete when:** Patient registered → appointment → consultation → voice/text captured → note drafted → clinician signs → investigation ordered → result uploaded → reviewed → patient informed → follow-up booked → invoice generated → payment recorded → receipt produced → unresolved cleared → encounter closed.

---

## 12. Deferred Features

Do not build in MVP unless required by a hard dependency: full hospital inpatient management; medication administration record; pharmacy stock; laboratory information system; radiology PACS; advanced insurance claims; national health exchange; advanced predictive analytics; autonomous diagnosis; autonomous prescribing; full OR management; nursing observations; bed management; population health analytics; wearable integration; automated unsupervised patient communication.

---

## 13. Engineering Principles

- Strict TypeScript
- Clear domain boundaries; dependency inversion for external services
- Versioned database migrations — no direct schema changes outside migrations
- Idempotent operations where possible
- Structured error handling and logging
- Environment validation on startup
- Secure secret handling — never in source code
- Test fixtures using fictional patients only
- Input validation client and server
- Server-side authorisation on every endpoint
- Row-level data isolation (Supabase RLS)
- Every new table: `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table> TO authenticated; GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table> TO service_role;`
- Encryption in transit and at rest
- Secure file-upload validation
- Rate limiting where appropriate
- Automatic session expiry
- Safe recovery from network failure
- Accessible UI components
- No silent failures; no unhandled promises; no placeholder security; no `TODO` used to bypass critical implementation

---

## 14. Testing Requirements

Minimum: unit tests, database integration tests, API tests, permission tests, workflow tests, sync tests, audit tests, clinical safety tests, end-to-end tests for primary patient journey.

Critical scenarios:
- Receptionist cannot sign clinical notes; clinician can
- Signed notes cannot be overwritten; amendment creates linked version
- AI proposal cannot become confirmed automatically
- Wrong-patient data cannot appear in another chart
- Offline encounter persists after restart; sync resumes without duplicating
- Failed result upload remains visible as unresolved
- Result review recorded; patient-notified status separate from result-reviewed
- Deleted users do not erase authorship
- Audit records cannot be modified through normal APIs
- Financial records are append-only

Do not mark a feature complete until its tests pass.

---

## 15. Development Method — Vertical Slices

For each slice:
1. State the user problem
2. Identify affected domain entities
3. Describe the workflow
4. Define statuses and transitions
5. Define permissions
6. Define audit events
7. Define failure and offline behaviour
8. Create/update database migration
9. Implement backend services
10. Implement API
11. Implement UI
12. Add tests
13. Update documentation
14. Run lint, type checks, tests
15. Summarise changes and remaining risks

Do not generate hundreds of unreviewed files in one pass. Prefer a working vertical flow over many incomplete modules.

---

## 16. Documentation to Maintain

`README.md`, `AGENTS.md`, `docs/architecture.md`, `docs/domain-model.md`, `docs/clinical-safety.md`, `docs/security.md`, `docs/permissions.md`, `docs/audit-model.md`, `docs/ai-governance.md`, `docs/deployment.md`, `docs/testing.md`, `docs/decision-log/`

Every major architectural decision gets an ADR in `docs/decision-log/`.

---

## 17. Definition of Done

A feature is complete only when: real user workflow works; database model defined; permissions enforced; audit events recorded; offline behaviour handled; error states visible; tests pass; documentation updated; no critical placeholders; no AI output bypasses clinician approval; works with fictional test data; does not compromise another workflow.

---

## 18. Current State — What Is Already Built

As of 2026-07-30, the following MVP items exist in `artifacts/`:

| Area | Status | Notes |
|---|---|---|
| Auth / RBAC | ✅ Working | Supabase auth, user_profiles, requireStaffAuth |
| Patient registration | ✅ Working | patients table, MRN auto-assign |
| Patient search | ✅ Working | /api/patients/search |
| Appointment / scheduling | ✅ Working | Scheduling tab, calendar integration |
| Check-in | ✅ Working | CheckInTab |
| Encounter / consultation workspace | ✅ Working | Home.tsx — tabbed SOAP workspace |
| Voice capture + SOAP segmentation | ✅ Working | VoiceDictation.tsx, /api/voice/segment |
| Manual note entry | ✅ Working | HPI, Exam, Assessment, Plan tabs |
| Allergies | ✅ Working | AllergiesTab |
| Medications | ✅ Working | MedicationsTab |
| Problems / diagnoses | ✅ Working | patient_problems table |
| Investigations & orders | ✅ Working | InvestigationsTab |
| Results inbox | ✅ Working | ResultsInboxTab with AI extraction |
| Document capture (photo/OCR) | ✅ Working | DocumentCapture.tsx, Phase 2 |
| Patient context assembly | ✅ Working | lib/patient-context.ts, Phase 3 |
| AI consultant | ✅ Working | ai-consult.ts, Sonnet |
| Assessment & plan | ✅ Working | AssessmentTab, PlanTab |
| Letters & referrals | ✅ Working | generate-letter.ts |
| Follow-up tracking | ✅ Working | FollowUpTrackerTab |
| Billing basics | ✅ Working | BillingTab |
| Audit log | ⚠️ Partial | audit.ts exists; not comprehensive |
| AI_PROPOSED workflow | ❌ Missing | AI output loads directly to fields — no formal proposal/approve flow |
| Signed note + amendment | ❌ Missing | Notes can be overwritten silently |
| Clinical state engine | ❌ Missing | No ClinicalState table or transitions |
| Patient notification status | ❌ Missing | Result reviewed ≠ patient informed tracking |
| Receipt generation | ❌ Missing | Billing tab exists; receipts not generated |
| Local-first / offline sync | ❌ Missing | All reads/writes go direct to Supabase |
| FHIR export | ❌ Missing | No interoperability adapters |
| Tests | ❌ Missing | No test suite |

---

## 19. Priority Build Backlog

### Slice A — Clinical safety foundation (highest priority)
**Problem:** AI output has no formal proposal/approve status; notes can be overwritten.
- Add `clinical_notes` table with `status` (`draft` | `signed` | `amended`), `signed_at`, `signed_by`, `version`
- Add `ai_proposals` table: `id, patient_id, encounter_id, proposal_type, content, model, model_version, prompt_version, source_artifact_id, status (proposed|approved|rejected|edited), reviewed_by, reviewed_at, approved_content`
- UI: AI output shown with "AI Draft — review before filing" badge; explicit Approve / Edit / Reject per section
- Signed note → read-only; Amendment creates linked version

### Slice B — Unresolved loop tracking
**Problem:** No surface for "result received but not reviewed", "patient not informed", "follow-up overdue".
- Add `workflow_tasks` table with task_type, patient_id, encounter_id, status, due_at, assigned_to, resolved_at
- Auto-create tasks on: result received, referral sent, investigation ordered, note unsigned, invoice unpaid
- Dashboard widget showing outstanding tasks by type

### Slice C — Clinical state engine
**Problem:** Problem list exists but no state machine or transition tracking.
- Add `clinical_states` table (see Section 6)
- API: CRUD + status transitions with audit trail
- UI: timeline view in patient summary panel

### Slice D — Audit completeness
**Problem:** audit.ts logs some events but not document access, AI call payloads, or result views.
- Comprehensive audit event taxonomy
- Middleware to log every read of PHI-bearing endpoints
- Audit viewer in Settings for admin role

### Slice E — Note signing
**Problem:** Consultation notes have no signature workflow.
- Sign button on consultation close
- Signed notes locked (read-only)
- Amendment creates `NoteVersion` with previous version FK

---

## 20. Final Operating Rule

Build MedFlow with: Epic's longitudinal discipline; Oracle's conversational interaction; InterSystems' governed data architecture; MEDITECH's mobile usability; athenaOne's practice-management loop; OpenMRS's adaptability; OpenEMR's functional completeness; and MedFlow's own unique provenance, patient-state, and clinician-controlled AI architecture.

The result must remain lean. Do not copy unnecessary enterprise complexity. Build the smallest clinically safe, operationally complete, and extensible system capable of running Amise Medical Services reliably.

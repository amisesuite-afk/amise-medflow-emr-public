# Amise MedFlow EMR — Engineering Audit & Enhancement Plan

**Date:** 24 June 2026
**Scope:** Full EMR dashboard + API server + database schema
**Objective:** Critical analysis of current state, gap identification, and implementation roadmap for closed-loop clinical decision support

---

## Executive Summary

The Amise MedFlow EMR is significantly more mature than a typical early-stage system. It already contains **37 clinical tabs**, **67+ medical conditions** with ICD-10/CPT codes, **7 validated clinical scales** (Alvarado, HEART, Wells PE, ABCD2, TG18 Cholangitis, ASGE CBD, Tokyo Cholecystitis), **17+ clinical pathways**, a **clinical decision support engine**, **PDF generation** (jsPDF + html2canvas), and **25 post-operative management templates**.

The system's strengths — clinical charting, triage routing, decision support, and procedure documentation — form a solid foundation. The gaps centre on six areas: **prescription ordering**, **results management with alerting**, **AI-assisted clinical notes**, **guidelines database**, **closed-loop follow-up**, and **document upload/storage**.

---

## Current State Inventory

### What Works Well

| Feature | Status | Detail |
|---|---|---|
| Patient Demographics | Production | Full CRUD, MRN, insurance, emergency contact, photo |
| Intake & Triage | Production | Adaptive triage engine, acuity scoring (0-100), red-flag routing, NICE NG12 cancer screening |
| Vital Signs | Production | BP/HR/temp/RR/SpO₂/glucose/weight/height, BMI auto-calc, red-flag thresholds, trending |
| Clinical History | Production | PMH, surgical, medications, allergies, toxic habits, family history |
| Physical Examination | Production | System-by-system templates, chip-based entry, anatomical sketch |
| Review of Systems | Production | 12 systems with positive/negative tracking |
| Investigations | Production | Lab ordering with St Lucia Lab catalogue, result entry with H/L/C flags, AI OCR extraction |
| Radiology | Production | Modality/region/urgency/contrast ordering, CT/MRI/endoscopy |
| Assessment & Diagnosis | Production | ICD-10 picker (351 codes), differentials, acuity grading |
| Clinical Decision Support | Production | 7 validated scales, 17+ pathways, deterministic CDS rules engine |
| Management Plan | Production | Plan type (management/discharge/follow-up/referral), protocol selection |
| Procedures | Production | Pre-op/post-op, 25 management templates, consent, anaesthetic risk |
| Clinical Notes | Production | SOAP, ward round, follow-up formats, note saving to Supabase |
| PDF Generation | Production | Full encounter record with multi-page A4, iOS Safari support |
| Attachments | Production | Clinical photos with anatomical area, dimensions, description metadata |
| Trauma & Burns | Production | ABCDE, GCS, ISS/AIS scoring, Parkland formula, Baux score |
| Billing | Production | Line-item charges (XCD), CPT codes, payment tracking |
| Booking Management | Production | Confirm/waitlist/cancel with Supabase-direct fallback |
| Visit Lifecycle | Production | Check-in → encounter → close with plan/referral |
| Role-Based Access | Production | front_desk/nurse/doctor/admin with tab visibility gating |
| Vademecum | Production | 15 disease-specific clinical reference modules |

### What's Partially Built (Schema Exists, UI Incomplete)

| Feature | Schema | API | UI | Gap |
|---|---|---|---|---|
| Clinical Notes | ✅ Full (note_type, AI flags, signature workflow) | ✅ `saveClinicalNote()` in db.ts | ⚠️ Progress Notes tab only | No linked images in notes, no AI-assisted editing |
| Documents | ✅ Full (12 document types, storage_path) | ❌ No CRUD endpoints | ❌ Placeholder | No upload/download/viewer |
| Investigation Results | ✅ Full (analytes JSONB, is_critical) | ✅ Extract + order endpoints | ⚠️ Entry only | No critical value alerting, no trending UI |
| Imaging Orders | ✅ Full (status workflow, linked_document_id) | ✅ Order endpoint | ⚠️ Request only | No result receipt tracking UI |
| Consultation Requests | ✅ Full (clinical_context JSONB, ai_response) | ❌ | ❌ | No AI clinical aid |

### What's Missing Entirely

| Feature | Schema | API | UI | Priority |
|---|---|---|---|---|
| Prescription Ordering (RX) | ❌ | ❌ | ❌ | **P1 — Core** |
| AI Consultant Surgeon Aid | ❌ | ❌ | ❌ | **P1 — Core** |
| Clinical Guidelines Database | ❌ | ❌ | ❌ | **P1 — Token savings** |
| Results Alerting (positive/pending) | ❌ | ❌ | ❌ | **P1 — Safety** |
| Closed-Loop Follow-Up Tracking | ❌ | ❌ | ❌ | **P1 — Core** |
| Document Upload & Storage | ❌ | ❌ | ❌ | **P2 — Important** |
| RX PDF Page | ❌ | ❌ | ❌ | **P2 — Important** |
| Follow-Up Scheduling Integration | ❌ | ❌ | ❌ | **P2 — Important** |
| Drug Interaction Checking | ❌ | ❌ | ❌ | **P3 — Enhancement** |

---

## Gap Analysis — Deep Dive

### 1. Prescription Ordering (RX) — Missing

**Current state:** Medications tab records active/stopped meds with dose/frequency/route but has no prescription workflow — no prescribing, no signing, no printable RX page.

**What's needed:**
- `prescriptions` table: drug, dose, frequency, route, duration, quantity, refills, instructions, prescriber, signed_at, status (draft/signed/dispensed/expired)
- RX PDF template with practice header, patient info, drug details, prescriber signature, date
- Prescribe-from-medication flow (one click from existing med entry)
- Predefined drug formulary (common surgical meds: antibiotics, analgesics, PPIs, antiemetics, laxatives, DVT prophylaxis)

**Database recommendation:** A `prescriptions` table is needed. The existing `medications` table tracks what the patient is ON; prescriptions track what the doctor is ORDERING. These are distinct clinical concepts.

### 2. AI Consultant Surgeon Aid — Missing

**Current state:** Claude AI is used only for triage classification and email routing. The `consultation_requests` table exists with `clinical_context` and `ai_response` JSONB fields but has no UI or clinical workflow.

**What's needed:**
- AI consultation panel in the Assessment/Plan tabs
- Context assembly: demographics + vitals + symptoms + exam + investigations + ICD codes + current meds
- Prompt engineering for surgical decision support:
  - Differential diagnosis with reasoning
  - Management plan suggestions with evidence
  - Counterpoints and alternative approaches
  - Guideline references
- Safety layer: AI suggestions display as "decision support" with physician sign-off required
- Token optimisation: inject matching guidelines from local DB instead of having Claude search its training data

**Database recommendation:** The existing `consultation_requests` table is sufficient. Add `guidelines_referenced` JSONB field to track which local guidelines were injected.

### 3. Clinical Guidelines Database — Missing

**Current state:** `clinical-pathways.ts` has 17+ pathways with suggested diagnoses, red flags, and lab/imaging recommendations. The Vademecum has 15 disease modules. But these are hardcoded TypeScript — no searchable guidelines database.

**What's needed:**
- `clinical_guidelines` table: condition_icd10, guideline_source (NICE, ACS, ASCRS, BSG, etc.), title, summary, key_recommendations (JSONB), evidence_grade, last_updated
- Pre-populated with guidelines for the practice's surgical focus:
  - **GI/Endoscopy**: BSG colonoscopy surveillance, NICE NG12 cancer referral, ASGE gallstone management, ACG GORD management
  - **General Surgery**: NICE appendicitis, hernia repair (EHS), cholecystectomy (Tokyo TG18)
  - **Breast**: NICE early breast cancer (NG101), triple assessment pathway
  - **Thyroid**: ATA thyroid nodule guidelines, Bethesda classification
- Auto-suggestion when ICD-10 code is selected in Assessment tab
- Token savings: inject guideline summary into Claude context instead of relying on model's training data (estimated 40-60% token reduction for consultation queries)

**Database recommendation:** YES — a `clinical_guidelines` table significantly reduces AI token usage. Instead of asking Claude "what are the guidelines for cholecystitis management," inject the local guideline text and ask Claude to apply it to the specific patient context. This also ensures guidelines are current and auditable.

### 4. Results Alerting — Missing

**Current state:** `investigation_results` has `is_critical` boolean and status workflow (ordered→resulted→reviewed) but no alerting mechanism. Results are entered but nobody is notified of abnormals.

**What's needed:**
- Dashboard alert badge showing pending/critical results count
- Results review queue (unreviewed results, critical first)
- Notification on result entry: if `is_critical = true`, create an alert record
- "Acknowledge" workflow: physician reviews and marks as acknowledged with action taken
- Auto-link results to the originating encounter and patient follow-up chain

**Database recommendation:** Add `result_alerts` table or extend `investigation_results` with `acknowledged_by`, `acknowledged_at`, `action_taken` fields. The simpler extension approach is sufficient given the practice size.

### 5. Closed-Loop Follow-Up Tracking — Missing

**Current state:** Plans table has `follow_up_date` and `follow_up_notes` but no workflow tracking. No visibility into which patients are overdue for follow-up, pending results, or incomplete work.

**What's needed:**
- `patient_tasks` table: patient_id, task_type (follow_up_appointment, pending_result, prescription_fill, referral_response, procedure_scheduling), due_date, status (open/completed/overdue/cancelled), assigned_to, notes
- Patient dashboard showing open tasks per patient
- Overdue task alerting (daily summary integration)
- Auto-generate tasks from:
  - Plan follow-up dates
  - Ordered-but-not-resulted investigations
  - Sent-but-not-acknowledged referrals
  - Prescriptions needing renewal

**Database recommendation:** YES — a `patient_tasks` table is the backbone of closed-loop management. This is the single most impactful addition for clinical safety.

### 6. Document Upload & Storage — Partially Built

**Current state:** `documents` table has full schema (12 types, storage_path, mime_type) but DocumentsTab is a placeholder. AttachmentsTab handles clinical photos via base64 in localStorage (session-only, not persisted to Supabase).

**What's needed:**
- Supabase Storage bucket configuration (`patient-documents`)
- Upload component with drag-and-drop, camera capture, file picker
- Document viewer (inline PDF, image lightbox)
- Link documents to clinical notes (note → attached images/files)
- Migrate AttachmentsTab photos to Supabase Storage on encounter save

**Database recommendation:** Schema is sufficient. Need Supabase Storage bucket and RLS policies.

---

## Architecture Recommendations

### Token Optimisation Strategy

The user correctly identified that a local guidelines database reduces AI costs. Here's the full strategy:

1. **Guidelines injection** (40-60% savings): Instead of open-ended "what should I do for cholecystitis," inject the stored guideline and ask "given these guidelines, apply to this patient"
2. **Classification cache** (20-30% savings): The existing `condition-db.ts` with 67 conditions already covers most cases. Use it for deterministic matching before falling back to Claude
3. **Structured context assembly** (15-25% savings): Send only relevant patient data to Claude, not the entire encounter record
4. **Model tiering**: Use `claude-haiku-4-5` for classification/extraction, `claude-sonnet-4-6` for clinical reasoning

### Database Changes Required

**New tables needed:**

| Table | Purpose | Fields |
|---|---|---|
| `prescriptions` | RX ordering | drug_name, dose, frequency, route, duration, quantity, refills, instructions, prescriber_id, encounter_id, patient_id, signed_at, status, pharmacy_notes |
| `clinical_guidelines` | Guideline reference | condition_icd10[], guideline_source, title, summary, key_recommendations (JSONB), evidence_grade, url, last_updated |
| `patient_tasks` | Closed-loop tracking | patient_id, encounter_id, task_type, description, due_date, status, assigned_to, completed_at, completed_by, notes |

**Extended tables:**

| Table | Changes |
|---|---|
| `investigation_results` | Add `acknowledged_by`, `acknowledged_at`, `action_taken` |
| `clinical_notes` | Add `linked_attachments` (UUID[] referencing documents) |
| `consultation_requests` | Add `guidelines_referenced` (JSONB) |

**Does the database need to be increased?** Not in size — Supabase's free tier handles this data volume easily. But the schema needs the 3 new tables above to support the requested features. The existing 20+ tables provide a solid foundation.

---

## Implementation Roadmap

### Phase 1: Foundation (Safety & Data) — Week 1-2

1. **Database migration**: Create `prescriptions`, `clinical_guidelines`, `patient_tasks` tables; extend `investigation_results` and `clinical_notes`
2. **Clinical guidelines seed data**: Pre-populate 30-40 guidelines for the practice's surgical focus
3. **Document upload**: Implement Supabase Storage integration, replace DocumentsTab placeholder
4. **Results alerting**: Add acknowledged_by/at fields, build results review queue

### Phase 2: Clinical Workflows — Week 3-4

5. **Prescription (RX) tab**: Drug formulary, prescribe workflow, RX PDF generation
6. **AI Consultant panel**: Claude integration in Assessment tab with guideline injection
7. **Clinical notes with images**: Link AttachmentsTab photos to progress notes
8. **Patient task tracking**: Auto-generate tasks from plans, results, referrals

### Phase 3: Closed-Loop & Output — Week 5-6

9. **Follow-up dashboard**: Overdue patients, pending results, incomplete tasks
10. **PDF outputs**: RX page, clinical summary, referral letter templates
11. **Results auto-read**: Extend AI OCR to auto-classify and alert on uploaded lab reports
12. **Daily summary integration**: Include overdue tasks and pending results in existing cron digest

### Phase 4: Polish & Integration — Week 7-8

13. **AI note editing**: Claude-assisted SOAP note drafting with physician sign-off
14. **Scheduling from EMR**: Book follow-up from Plan tab directly to Google Calendar
15. **Drug interaction checking**: Basic contraindication alerts from formulary data
16. **Audit trail**: Complete action logging for clinical notes, prescriptions, results

---

## Production Bug Fixes Required

### Bug 1: HTTP 502 on Booking Inbox
- **Symptom:** Dashboard booking inbox shows HTTP 502 loading bookings
- **Cause:** API server on Render returning 502 (service sleeping or deployment issue)
- **Fix:** Verify Render service health; the Supabase-direct fallback should handle reads but the 502 suggests the fallback isn't triggering cleanly

### Bug 2: "String did not match expected pattern" on Referring Providers
- **Symptom:** Referring Providers tab shows validation error on load
- **Cause:** Regex pattern validation failing when loading provider directory
- **Fix:** Investigate the pattern matcher in ReferringProvidersTab.tsx

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| AI hallucination in clinical suggestions | High | FORBIDDEN_PATTERNS scan + physician sign-off + "decision support only" labelling |
| Prescription errors | High | Drug formulary with dose ranges + physician signature required |
| Missed critical results | High | Results alerting with overdue escalation to daily summary |
| Data loss (localStorage attachments) | Medium | Migrate to Supabase Storage; persist on encounter save |
| Token cost overruns | Medium | Guidelines injection + model tiering + context pruning |
| Supabase Storage limits | Low | 1 GB free tier sufficient for text + compressed photos |

---

## Summary

The EMR is already a capable clinical documentation system. The requested enhancements — AI consultant aid, prescriptions, guidelines database, results alerting, and closed-loop tracking — are achievable within the existing architecture. The key architectural addition is the `patient_tasks` table for closed-loop management; everything else builds on existing patterns (JSONB fields, Supabase Storage, Claude integration).

**Recommended first action:** Database migration (3 new tables + 2 field extensions) — this unblocks all downstream features.

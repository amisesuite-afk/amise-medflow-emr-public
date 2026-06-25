# Amise MedFlow EMR — Production Readiness Analysis

**Date:** 2026-06-25
**Scope:** Front-desk (Next.js/Vercel), Dashboard EMR (React+Vite/Vercel), API Server (Express/Render)
**Basis:** Full codebase audit of all routes, tabs, endpoints, and data flows

---

## Executive Summary

The system has **strong bones** — booking, questionnaire, triage, AI intake, and notification pipelines are fully wired end-to-end. The critical gap is **data persistence**: roughly half the clinical tabs in the EMR dashboard store data only in the browser's localStorage, meaning it vanishes on device switch, browser clear, or logout. This creates a two-tier EMR where some clinical data (allergies, assessment, plan) is safely in Supabase, while other data (surgical history, review of systems, prescriptions, procedures) exists only in one browser session.

---

## 1. Patient Journey: What Works End-to-End

### COMPLETE FLOWS (Production-Ready)

| Flow | Path | Persists? | Notifications |
|------|------|-----------|---------------|
| **Web Booking** | BookingForm → /api/booking/create → appointment_requests → Google Calendar → SMS + Email | Yes (Supabase) | SMS + WhatsApp + Email confirmation |
| **Questionnaire Intake** | /questionnaire → consent → questions → AI summary → nurse review → doctor approve → encounter created | Yes (Supabase) | Red flag alerts to staff |
| **Kiosk Check-in** | /kiosk → APCQ questions → vitals photo → completion | Yes (Supabase) | Staff queue notification |
| **APCQ Web Intake** | /intake → chief complaint → triage → questions → submission | Yes (Supabase) | Red flag notification |
| **WhatsApp Inbound** | Patient WhatsApp → Twilio webhook → intent detection → appointment_request | Yes (Supabase) | Staff SMS alert |
| **Email Document Intake** | Inbound email → Gmail cron → Claude classify → Supabase documents | Yes (Supabase) | Audit log |
| **Appointment Lifecycle** | pending → staff_confirmed → patient_confirmed → attended → encounter | Yes (Supabase) | SMS reminders at 48h, 24h |
| **Visit Lifecycle** | Check-in → encounter created → consultation → complete → plan + referral | Yes (Supabase) | N/A |
| **Staff Escalation** | Unactioned booking → 2h staff re-notify → 4h doctor escalation → 8h auto-cancel | Yes (Supabase) | SMS + Email escalation |
| **Patient Portal** | Magic link login → view appointments, documents, encounter history | Yes (Supabase RLS) | N/A |

### PARTIALLY COMPLETE (Functional but with gaps)

| Flow | What Works | What's Missing |
|------|-----------|---------------|
| **Referral Submission** | Form + DB write + SMS confirmation | Document/image upload for referral letter |
| **Procedure Prep** | Claude drafts adjustment note for anticoagulants/diabetes meds | Staff delivery mechanism (currently local "sent" flag only) |
| **AI Clinical Consult** | Structured advice via Claude (differential, investigations, approach) | No persistence of consult history per patient |
| **Lab Result Extraction** | Claude Vision extracts results from uploaded images | No LIS integration; manual upload only |

---

## 2. EMR Dashboard: The Persistence Problem

This is the most critical finding. The dashboard has **20 clinical tabs** but only **8 persist data to Supabase**. The rest store data in localStorage — meaning data entered during a consultation is lost if the clinician switches devices, clears their browser, or uses a different workstation.

### Tier 1: Persisted to Supabase (Safe)

| Tab | Supabase Table | Auto-save | Notes |
|-----|---------------|-----------|-------|
| Allergies | patient allergies (via syncAllergyList) | 3s debounce | Full CRUD |
| Assessment | assessments | 2s debounce | Upserts on encounter_id |
| Plan | plans | 2s debounce | Upserts on encounter_id |
| PMH | pmh_items | On change | Upserts on (patient_id, condition) |
| Medications | patient medications (via syncMedicationList) | 2s debounce | Full sync |
| Examination | exam_findings | 3s debounce | Entire object replaced |
| Progress Notes | clinical_notes | On save | SOAP format |
| Patient Tasks | patient_tasks | Full CRUD | Supabase direct |
| Vitals Monitoring | vitals, investigation_results | On record | Full CRUD |

### Tier 2: localStorage Only (Lost on browser clear)

| Tab | What's Lost | Clinical Impact |
|-----|-----------|----------------|
| **Surgical History** | Past surgeries, dates, complications | Surgeon operating without knowing prior procedures |
| **Toxic Habits** | Smoking, alcohol, substance use | Anaesthetic risk assessment incomplete |
| **Review of Systems** | 14-system review findings | Missed systemic disease signs |
| **Scales** | WHO, Karnofsky, ASA, ECOG scores | Risk stratification undocumented |
| **Prescriptions** | Current prescriptions written during visit | Prescriptions exist only in browser; no dispensary record |
| **Procedures** | Operative notes, consent, findings | Surgical records not persisted |
| **Trauma** | AIS scores, burn TBSA, MIST, ABCDE | Trauma documentation lost |
| **Attachments** | Uploaded photos, scans (base64 in localStorage) | Clinical images not stored server-side |
| **Billing** | Charges, insurance info | No billing record |
| **Documents** | Generated documents | No document storage |
| **Radiology** | Orders and findings | Orders not tracked |

### Tier 3: RAM Only (Lost on page refresh)

| Data | Impact |
|------|--------|
| PANE diagnostic state | Differential diagnosis working state |
| Triage working calculations | Acuity score needs recalculation |
| Lab/vital records in monitoring | Entered data gone |

---

## 3. API Server: Fully Functional

The API server is the strongest component — all defined endpoints are implemented and functional:

| Category | Endpoints | Status |
|----------|-----------|--------|
| Questionnaire (14 endpoints) | Session lifecycle, consent, answers, AI summary, nurse/doctor review, SMS | All functional |
| Booking (8 endpoints) | Request, confirm, waitlist, cancel, lapse, list, red-flag notify | All functional |
| Scheduling (4 endpoints) | Slots, sync, cache, upcoming | All functional (Calendar fallback to mock) |
| Cron (5 endpoints) | Reminders, daily summary, booking reminders, staff escalation, calendar sync | All functional |
| Visit Lifecycle (2 endpoints) | Check-in, complete | All functional |
| Email/Document Intake (5 endpoints) | Cron process, referring provider CRUD | All functional |
| AI (3 endpoints) | Triage preview, consult, summary/refine | All functional |
| Patient Portal (35+ endpoints) | Full EMR access, documents, encounters, prescriptions, referrals | All functional |
| WhatsApp (1 endpoint) | Inbound webhook | Functional |
| Investigations (3 endpoints) | Result extraction, lab orders | Functional |
| Health (2 endpoints) | Healthz, env check | Functional |

**No stub endpoints found in the API server.** Every defined route has a working implementation.

### MODE Gating (Safety Controls)

| MODE | Email AI | SMS/WhatsApp | Calendar | Booking DB Writes |
|------|---------|-------------|----------|-------------------|
| `dry_run` (default) | Log only | Log only | Read-only | Yes (writes proceed) |
| `supervised` | Escalations auto, replies drafted | Active | Active | Yes |
| `auto` | All auto-sent | Active | Active | Yes |

---

## 4. Front-Desk App: Mostly Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Booking Form | Fully functional | Multi-track (routine/referral/endoscopy), procedure-specific questions, slot selection |
| Questionnaire | Functional if configured | Requires Supabase env vars + APCQ migration |
| Kiosk Mode | Functional | 90s idle timeout, photo vitals capture |
| Web Intake (APCQ) | Functional | Client-side triage engine, sessionStorage persistence |
| Patient Portal | Functional | RLS-gated, magic link auth |
| Referral Form | Partial | Form + DB write, no document upload |
| Email Notifications | Functional | Procedure-specific HTML emails with prep instructions |
| SMS/WhatsApp | Functional | E.164 normalization, confirmation + reminders |
| Calendar Integration | Functional | Slot lookup, event creation, holiday awareness |
| Staff Approval (DraftApproval) | Partial | Approve/reject UI exists; procedure-prep endpoints incomplete |

### Missing Env Vars on Production (Likely Cause of Questionnaire Failure)

The questionnaire page failure on production is caused by one of:
1. `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not set on Vercel
2. `questionnaire_templates` table has no active `general_screening` template (APCQ migration not run)

---

## 5. What's Mute — Functions That Don't Follow Through

### A. Prescriptions: Written but Not Recorded

The Prescriptions tab lets the doctor write prescriptions during a consultation, but they're stored only in localStorage. There is no:
- Supabase table for prescriptions written in the dashboard
- Prescription signing workflow
- Dispensary/pharmacy integration
- Prescription history per patient

**The patient portal has prescription_requests (API server)** but the dashboard doesn't use it.

### B. Surgical History, Toxic Habits, ROS, Scales: Entered but Not Saved

These tabs collect important clinical data but lose it on browser clear. A doctor entering surgical history on one workstation won't see it on another.

### C. Procedures: Operative Notes Lost

The Procedures tab collects operative notes, consent, and findings but stores them only in localStorage. For a surgical practice, this is the most critical gap.

### D. Trauma: Full Assessment Lost

The Trauma tab has a comprehensive AIS scoring, burn TBSA calculation, and ABCDE assessment — all lost on browser clear.

### E. Billing: No Backend

The Billing tab is a UI shell with no insurance verification, claim submission, or payment tracking.

### F. Documents/Attachments: No Server Storage

Attachments (photos, scans) are stored as base64 in localStorage. There's no Supabase Storage or S3 integration for the dashboard.

### G. Radiology: No Integration

Radiology orders exist in the UI but there's no RIS/PACS connection. Orders don't go anywhere.

### H. Patient Auto-Load Gap

When a patient is selected in the dashboard, there's no `loadPatientById()` that pulls their existing Supabase data (allergies, PMH, medications, encounters) back into the UI. If you close the browser and reopen, you must re-select the patient AND the existing data may not reload into all tabs.

---

## 6. Deployment Checklist

### Immediate (Required for Production)

| Item | App | Action |
|------|-----|--------|
| Supabase env vars on Vercel | Front-desk | Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY |
| Run APCQ migration | Supabase | Execute supabase-apcq-migration.sql |
| Run web-intake migration | Supabase | Execute supabase-web-intake-delivery-method-migration.sql |
| Run service-role grants | Supabase | Execute supabase-service-role-grants-fix-migration.sql |
| Set MODE=supervised | API server | Start with supervised mode, not auto |
| Set SMS_PROVIDER=twilio | API server | Enable real SMS delivery |
| Google credentials | Both | Service account with Calendar + Gmail scopes |
| Twilio credentials | API server | Account SID + auth token + from number |
| CRON_SECRET | API server | Shared secret for scheduled tasks |
| Set up cron jobs | External | /api/cron/reminders, /api/cron/daily-summary, /api/cron/calendar-sync, /api/cron/booking-reminders, /api/cron/staff-escalation |

### High Priority (Data Loss Prevention)

| Item | Effort | Impact |
|------|--------|--------|
| Persist Surgical History to Supabase | Medium | Surgical practice — must know prior ops |
| Persist Prescriptions to Supabase | Medium | Legal requirement; dispensary record |
| Persist Procedures/Operative Notes | Medium | Core surgical documentation |
| Persist ROS findings | Low | Complete consultation record |
| Persist Scales scores | Low | Risk stratification audit trail |
| Persist Toxic Habits | Low | Anaesthetic risk |
| Patient data auto-reload on selection | Medium | Encounter continuity |
| Attachment blob storage (Supabase Storage) | Medium | Clinical photos, scans |

### Medium Priority (Completeness)

| Item | Effort | Impact |
|------|--------|--------|
| Prescription signing workflow | High | E-prescribing |
| Drug interaction checking | High | Patient safety |
| Billing integration | High | Revenue capture |
| Radiology order routing | Medium | Currently orders go nowhere |
| FHIR endpoint completion | Medium | Interoperability |
| Document storage backend | Medium | Clinical document management |
| Staff directive delivery (real SMS/email) | Low | Consultant AI Aid actions |

---

## 7. Architecture Strengths

1. **Safety-first AI**: Every Claude output scanned against FORBIDDEN_PATTERNS before reaching patients. No diagnoses, fees, drug doses in automated messages.
2. **Human gates mandatory**: Nurse review → doctor approve workflow enforced. AI urgency never downgrades deterministic red flags.
3. **Graceful degradation**: Calendar unavailable → pending status. Email fails → SMS still sent. API server down → Supabase direct reads.
4. **Multi-channel intake**: Web form, kiosk, WhatsApp, email, patient portal — all feed into single appointment_requests table.
5. **Escalation cascade**: 2h → 4h → 8h automatic escalation prevents unactioned bookings.
6. **MODE gate**: dry_run → supervised → auto progression prevents premature automation.
7. **Audit trail**: All actions logged to audit_logs table with immutable records.

---

## 8. Architecture Risks

1. **Split persistence**: Half clinical data in Supabase, half in localStorage — creates an incomplete medical record.
2. **No encounter auto-reload**: Patient data doesn't automatically populate from DB on selection.
3. **Single-point API dependency**: Dashboard reads fall back to Supabase, but writes require the API server on Render.
4. **Optimistic slot locking**: Booking confirmation uses SELECT-then-INSERT, not database-level locking — race condition possible under high concurrency.
5. **No backup/export**: No mechanism to export patient data or back up the Supabase database.
6. **Calendar mock fallback**: If Google Calendar is misconfigured, fake slots are returned — patients could book non-existent appointments.

---

## 9. Verdict

**The system is deployable for the booking/intake/notification pipeline today.** Patients can book appointments, complete questionnaires, receive confirmations, and get reminders. Staff can manage the booking inbox, review intake summaries, and approve appointments.

**The EMR dashboard is NOT production-ready for clinical documentation.** The localStorage-only persistence for surgical history, prescriptions, procedures, ROS, scales, and trauma means clinical data is at risk of loss. For a surgical practice, operative notes and prescription records stored only in one browser session is a patient safety concern.

**Recommended deployment strategy:**
1. Deploy booking/intake/notification pipeline now (it works)
2. Prioritise persisting Tier 2 tabs to Supabase before using the EMR for clinical documentation
3. Start with MODE=supervised and SMS_PROVIDER=dry_run, verify flows, then enable real delivery

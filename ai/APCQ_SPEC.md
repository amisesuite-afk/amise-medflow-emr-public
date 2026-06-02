# Adaptive Pre-Consultation Questionnaire (APCQ) — Product Specification

**Practice:** Amise Medical Services, Saint Lucia  
**Physician:** Dr Dawit Daniel Kabiye MD, DM — General Surgery, Endoscopy, Breast Surgery  
**Version:** 1.0 · 2026-06-02

---

## 1. Problem Statement

| Pain Point | Impact |
|---|---|
| Paper intake forms: 30+ questions | 15–20 min to complete; patients rush or skip |
| No branching logic | Irrelevant questions dilute relevant positives |
| Doctor re-gathers history in room | First 8–12 min of every consultation wasted |
| No pre-visit brief for physician | Doctor walks in cold; red flags missed until examined |
| No structured consent trail | Data collection compliance risk |

---

## 2. Solution

The APCQ reduces the intake form to **5–10 targeted questions** using AI-driven adaptive branching:

- **Starts broad:** Chief complaint → specialty pathway selected automatically
- **Zooms in on positives:** Each positive answer triggers deeper follow-up questions in that branch
- **Skips irrelevant branches:** A patient with breast concern never sees colorectal questions
- **Detects red flags in real-time:** Alerts nursing staff before the physician enters
- **Generates a pre-visit brief:** Claude produces a structured summary for the physician to read in 60 seconds

---

## 3. User Roles & Views

| Role | Dashboard View | Capabilities |
|---|---|---|
| **Patient (anonymous)** | Public URL `/questionnaire/{token}` | Complete questionnaire, give consent |
| **Front Desk** | `QuestionnaireManagerTab` | Start sessions, generate QR codes, send SMS links, view recent sessions |
| **Nurse** | `NurseAPCQTab` | Review completed questionnaires, see AI summary, add notes, mark reviewed |
| **Doctor** | `NurseAPCQTab` (with approve button) | Read AI summary, approve → auto-populate EMR |
| **Admin** | `NurseAPCQTab` | Full visibility, manage templates |

---

## 4. Workflow

```
Patient arrives at reception
        │
        ▼
Front desk selects template + creates session
(QuestionnaireManagerTab → POST /api/questionnaire/session/start)
        │
        ├── QR Code displayed on screen (patient scans)
        ├── OR: SMS link sent to patient's phone (Twilio)
        └── OR: Front desk assists on shared kiosk
        │
        ▼
Patient opens /questionnaire/{token}
        │
        ▼
Consent screen (Saint Lucia EHR Act)
Patient types name + ticks checkbox
        │
        ▼
Adaptive questionnaire — 5–10 questions
(APCQ engine selects next question based on each answer)
        │
        ├── Red flag detected → amber banner + nurse alerted
        └── No red flags → questionnaire continues
        │
        ▼
Session marked complete
Claude generates structured pre-visit summary (async)
        │
        ▼
Nurse reviews in NurseAPCQTab
├── Reads Q&A responses
├── Reads AI summary (key positives, red flags, focus areas)
├── Adds nurse notes
└── Marks as Reviewed
        │
        ▼
Doctor reads summary before entering room
Doctor clicks Approve
        │
        ▼
EMR encounter created / updated
Chief complaint + intake summary populated into SOAP note
Session marked doctor_approved + emr_populated
```

---

## 5. Questionnaire Modes

| Mode | Questions | Use Case |
|---|---|---|
| **General Screening** | 10–15 | Annual check, new patient with no specific complaint |
| **Condition Specific** | 5–10 | Referred patient, known diagnosis, follow-up |

The mode is set by front desk at session creation. Patients can also self-select if the kiosk is left in open mode.

---

## 6. Specialty Pathways

| Template Key | Specialty | Triggered By Chief Complaint |
|---|---|---|
| `general_screening` | General Medical | General check-up, no specific complaint |
| `abdominal_pain` | General Surgery | Abdominal pain, nausea/vomiting |
| `upper_gi` | Endoscopy | Difficulty swallowing, acid reflux, blood in vomit |
| `colorectal` | Endoscopy / General Surgery | Rectal bleeding, change in bowel habit |
| `breast_surgery` | Breast Surgery | Breast lump, nipple discharge, breast concern |
| `post_op_review` | Post-Op | Post-operative concern, wound issue |

When `chief_complaint` is answered, the engine automatically adds the relevant pathway's questions to the queue and removes irrelevant ones.

---

## 7. Adaptive Branching Logic

The engine (`lib/triage-engine/src/apcq.ts`) maintains a **question queue** and an **answered set**:

1. **Initial queue** is set from the template's default question list
2. On each answer, `processAnswer()` runs:
   - If answer value is in an option's `triggersKeys` → those question keys are prepended to the queue
   - If answer value is in an option's `skipsKeys` → those keys are removed from the queue
   - Duplicates and already-answered keys are de-duplicated
3. **Stopping conditions:**
   - Queue is empty, OR
   - Total questions shown >= 12 (hard cap), OR
   - `isSessionSufficient()` returns true (chief complaint answered + >= 3 responses)
4. **Red flags always surface** regardless of branching — no positive red-flag answer is ever skipped

### Example: Breast pathway branching

```
chief_complaint = ["Breast concern"]
  → adds: breast_lump_duration, breast_lump_change, nipple_discharge,
          skin_changes, breast_pain, mammogram_history, family_history_breast

nipple_discharge = true
  → adds: nipple_discharge_type (immediately next)

nipple_discharge_type = "Bloody"
  → isRedFlag = true → alert fired; urgency = "urgent"
```

---

## 8. Red Flag Detection

Red flags trigger an amber banner on the patient screen ("A member of our nursing team will be with you shortly") and are stored in `questionnaire_sessions.red_flags_detected`.

| Symptom / Answer | Severity |
|---|---|
| Pain score >= 8/10 | urgent |
| Dysphagia for liquids only or saliva only | urgent / emergency |
| Rectal bleeding >= cup volume | urgent |
| Peritoneal signs (rigidity / rebound) | emergency |
| Haematemesis >= cup volume | urgent |
| Bloody nipple discharge | urgent |
| Skin changes on breast (dimpling, puckering) | priority |
| Bowel not opened > 3 days | priority |
| Post-op fever | priority |
| Fever + tachycardia | urgent |
| Unintentional weight loss | priority |
| Family history of cancer (breast / colorectal) | priority |

---

## 9. AI Summary (Claude)

After the questionnaire is completed, `generateIntakeSummary()` calls Claude asynchronously:

**Input:** Full Q&A transcript formatted as plain text via `buildResponseSummary()`

**System prompt constraints:**
- May: summarise, organise, highlight, flag concerns
- May NOT: diagnose, suggest treatments, prescribe, speculate beyond data

**Output JSON schema:**
```json
{
  "chiefComplaint": "string",
  "keyPositives": ["string"],
  "redFlags": [{ "symptom": "string", "severity": "urgent|priority|routine", "action": "string" }],
  "recommendedFocusAreas": ["string"],
  "estimatedUrgency": "routine|priority|urgent|emergency",
  "summary": "string (< 300 words)"
}
```

**Model:** `claude-opus-4-5` (configurable via `CLAUDE_MODEL` env var)

The summary is stored in `intake_summaries` and shown to the nurse and physician in the review panels.

---

## 10. Legal Consent

Shown as the first screen before any questions:

> "I consent to the collection of my health information for the purpose of improving my care at
> Amise Medical Services. This information is confidential and accessible only to your care team.
> Data is stored securely in accordance with Saint Lucia's Electronic Health Records Act."

Patient must:
1. Tick the "I have read and agree" checkbox
2. Type their full name to confirm

Consent is recorded in `consent_records` with:
- Verbatim consent text snapshot (version-controlled)
- Patient name as entered
- IP address + user agent
- Timestamp (UTC-4, `America/St_Lucia`)

Consent records are **append-only** — `ON DELETE RESTRICT` on `questionnaire_sessions`.

---

## 11. Delivery Methods

| Method | Flow |
|---|---|
| **Kiosk** | Front desk starts session → shows QR code on screen → patient scans with phone |
| **QR Code** | Generated using `api.qrserver.com` from session URL; displayed in `QuestionnaireManagerTab` |
| **SMS** | `POST /api/questionnaire/send-sms` → Twilio (or dry_run) → patient receives link |
| **Staff-assisted** | Staff navigates to the session URL on a shared device and hands it to patient |

**Patient URL format:** `https://front-desk-amisesuite-afks-projects.vercel.app/questionnaire/{session_token}`
Session tokens are 32-char random hex strings, generated server-side at session creation.

---

## 12. Database Schema

| Table | Purpose |
|---|---|
| `questionnaire_templates` | Named questionnaire types (6 templates) |
| `question_bank` | Question definitions with options, red-flag flags, branching metadata |
| `branching_rules` | Declarative conditional routing rules (source question + answer -> target question) |
| `questionnaire_sessions` | One row per patient attempt; tracks consent, status, review, and approval |
| `questionnaire_responses` | Individual Q&A pairs within a session; `is_red_flag` boolean per answer |
| `intake_summaries` | Claude-generated pre-visit brief; INSERT/UPDATE restricted to service_role |
| `consent_records` | Immutable consent audit trail; append-only |

All tables: RLS enabled, audit trail, `timestamptz` with UTC-4 convention.

---

## 13. API Contract

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/questionnaire/session/start` | None (public) | Create session, return first question + session token |
| `POST` | `/api/questionnaire/session/:token/answer` | None (session token) | Submit answer, get next question; detects red flags |
| `GET` | `/api/questionnaire/session/:token` | None (session token) | Resume session — return all responses + current question |
| `GET` | `/api/questionnaire/nurse/queue` | Staff header | List completed/red-flag sessions for nurse review |
| `GET` | `/api/questionnaire/session/:token/summary` | None | Return AI intake summary (202 if not ready) |
| `POST` | `/api/questionnaire/session/:token/nurse-review` | None | Mark session nurse-reviewed with notes |
| `POST` | `/api/questionnaire/session/:token/doctor-approve` | None | Approve, create EMR encounter, mark `emr_populated` |
| `POST` | `/api/questionnaire/send-sms` | None | Send session link to patient via SMS (Twilio / dry_run) |
| `GET` | `/api/questionnaire/templates` | None | List active questionnaire templates |

---

## 14. Security & HIPAA Compliance

| Control | Implementation |
|---|---|
| **Row-Level Security** | Enabled on all 7 APCQ tables; anon access scoped to own session via `app.session_token` GUC |
| **Session token** | 32-char random hex (`gen_random_bytes(16)`); unguessable; single-use questionnaire access |
| **Audit log** | Every read/write action recorded in `audit_log` with actor, timestamp, payload |
| **Consent trail** | `consent_records` is append-only with verbatim text snapshot — cannot be edited or deleted |
| **AI summary** | Only service_role can INSERT/UPDATE `intake_summaries` — prevents client-side forgery |
| **Encryption** | Supabase: AES-256 at rest, TLS 1.3 in transit |
| **MFA** | Required on all staff Supabase accounts |
| **Session expiry** | Session tokens do not expire by time, but `abandoned` status disables access |
| **No PII in URLs** | Session token is random hex with no patient identifier embedded |
| **SMS** | Phone numbers not stored server-side beyond the audit log entry |

---

## 15. Medical Governance

**The APCQ is a documentation and triage tool — not a diagnostic tool.**

| AI May | AI May NOT |
|---|---|
| Summarise patient-reported symptoms | Suggest a diagnosis |
| Highlight concerning patterns | Recommend specific treatments |
| Flag potential red flags | Quote drug doses or medication advice |
| Suggest clinical focus areas | Interpret investigation results |
| Draft structured intake summary | Sign or approve clinical decisions |

**Every clinical action follows this chain:**

```
AI Suggestion -> Nurse Review -> Physician Approval -> Permanent EMR Record
```

The physician's `doctor-approve` action is the gating step — no EMR encounter is created without it.

---

## 16. Future Roadmap

| Feature | Priority | Notes |
|---|---|---|
| WhatsApp chatbot flow | High | Send questions interactively via WhatsApp Business API |
| Flutter mobile app | Medium | Native patient portal for QR scan + questionnaire |
| Offline kiosk mode | Medium | Service worker + IndexedDB for areas with poor connectivity |
| Analytics dashboard | Medium | Completion rates, avg questions shown, red-flag frequency by template |
| Template builder | Low | Admin UI to create/edit question banks without SQL |
| Multi-language support | Low | Creole, French for Saint Lucia patient population |
| Appointment integration | High | Auto-link session to scheduled appointment by patient phone number |
| Pre-op checklist automation | High | Merge APCQ post-op pathway into pre-op checklist workflow |

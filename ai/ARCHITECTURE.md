# MedFlow Caribbean — System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENTS                                      │
│                                                                  │
│   Flutter Mobile (iOS/Android)    Flutter Web (staff portal)    │
│   WhatsApp Business API           AI Front Desk (voice/chat)    │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS / WSS
┌────────────────────────▼────────────────────────────────────────┐
│                   SUPABASE PLATFORM                              │
│                                                                  │
│   ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│   │  PostgREST  │  │  Auth (JWT)  │  │  Realtime (WS)     │    │
│   │  REST API   │  │  MFA / RLS   │  │  Live updates      │    │
│   └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘    │
│          └───────────────┬┘                    │                 │
│   ┌───────────────────── ▼ ──────────────────────────────────┐  │
│   │           PostgreSQL 15 (RLS + pgcrypto)                  │  │
│   │   patients · appointments · encounters · notes            │  │
│   │   procedures · billing · audit_logs · …                   │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│   ┌──────────────┐  ┌───────────────────────────────────────┐  │
│   │   Storage    │  │  Edge Functions (Deno)                 │  │
│   │  (images /   │  │  AI orchestration · WhatsApp webhook   │  │
│   │   documents) │  │  Calendar sync · Billing logic         │  │
│   └──────────────┘  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  EXTERNAL SERVICES                               │
│                                                                  │
│   Anthropic Claude   OpenAI GPT-4o   Google Gemini              │
│   Google Calendar    WhatsApp API    Twilio SMS                  │
│   Cloudflare CDN     Google Workspace                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flutter App Structure

```
medflow_caribbean/
├── lib/
│   ├── main.dart
│   ├── app/
│   │   ├── router.dart              # GoRouter with role-based guards
│   │   └── theme.dart
│   ├── core/
│   │   ├── supabase_client.dart     # Supabase singleton
│   │   ├── auth/                   # Auth state, MFA, session
│   │   ├── offline/                # Drift local DB + sync queue
│   │   └── security/               # Encryption helpers
│   ├── features/
│   │   ├── scheduling/
│   │   │   ├── data/               # Repository + Supabase calls
│   │   │   ├── domain/             # Entities + use cases
│   │   │   └── presentation/       # Pages + widgets
│   │   ├── patient_registration/
│   │   ├── emr/
│   │   │   ├── soap_notes/
│   │   │   ├── medications/
│   │   │   └── diagnoses/
│   │   ├── endoscopy/
│   │   │   ├── ogd/
│   │   │   ├── colonoscopy/
│   │   │   └── ercp/
│   │   ├── surgical/
│   │   ├── breast_clinic/
│   │   ├── billing/
│   │   ├── analytics/
│   │   ├── ai_assistant/
│   │   └── admin/
│   └── shared/
│       ├── widgets/                # Design system components
│       ├── constants/
│       └── utils/
├── supabase/
│   ├── migrations/                 # Versioned SQL migrations
│   ├── functions/                  # Edge Functions (Deno)
│   └── seed.sql
├── test/
│   ├── unit/
│   ├── widget/
│   └── integration/
└── pubspec.yaml
```

---

## Role Hierarchy

```
Super Admin
  └── Admin
        ├── Surgeon (Dr. Kabiye)
        ├── Nurse / Clinical Staff
        ├── Front Desk
        └── Billing
```

| Permission | Surgeon | Nurse | Front Desk | Billing | Admin |
|---|---|---|---|---|---|
| View patient records | Full | Limited | Demographics only | No | Full |
| Create / sign notes | Yes | Draft only | No | No | No |
| Book appointments | Yes | Yes | Yes | No | Yes |
| View billing | Summary | No | No | Full | Full |
| Manage users | No | No | No | No | Yes |
| View audit logs | No | No | No | No | Yes |

---

## Offline Strategy

- **Drift** (SQLite) as local DB mirror for critical read paths
- **Sync queue** — mutations stored locally when offline, synced on reconnect
- **Conflict resolution** — last-write-wins for non-clinical fields; physician signature blocks overwrite for clinical records
- **Priority data** for offline: today's appointments, active patient records

---

## AI Integration Points

| Module | AI Role | Human Gate |
|---|---|---|
| SOAP Notes | Draft from voice/text | Physician review + signature |
| Triage | Acuity score suggestion | Nurse confirms |
| WhatsApp Front Desk | Booking + FAQ | Escalate to staff |
| Endoscopy Reports | Template pre-fill | Physician edits + signs |
| Billing Codes | CPT/ICD suggestion | Billing staff confirms |
| Analytics | Insight summaries | Read-only |

---

## Data Flow: Appointment → Encounter → Note → Bill

```
Patient contacts (WhatsApp / Web / Phone)
  → AI Front Desk triages + books
  → Appointment created in Supabase
  → Google Calendar event synced
  → Reminder sent D-1 and H-2
  → Patient arrives → Front desk checks in
  → Encounter opened by nurse (vitals, chief complaint)
  → Surgeon opens EMR → AI drafts SOAP from intake
  → Surgeon reviews, edits, signs
  → Diagnoses + procedures coded (AI suggests ICD/CPT)
  → Billing invoice generated
  → Payment collected → Receipt issued
  → Follow-up appointment booked if needed
  → Audit log entry at every step
```

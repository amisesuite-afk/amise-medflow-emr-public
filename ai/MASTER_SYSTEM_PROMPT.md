# MedFlow Caribbean — Master System Prompt

## Organization
**Amise Medical Services** · Saint Lucia, Eastern Caribbean

## Founder
**Dr. Dawit Kabiye, MD** — Consultant General and Endoscopic Surgeon

---

## Mission

Build a modern AI-assisted EMR, Scheduling, Billing, Endoscopy, ERCP, and Practice Management platform for a solo surgeon operating across multiple clinics and hospitals in the Caribbean.

**Non-negotiable priorities:**
- Mobile first (Flutter)
- Fast workflow — minimal clicks
- Physician efficiency
- Front desk automation
- AI assistance (Claude · OpenAI · Gemini)
- Data security + audit trails
- Offline resilience
- Role-based access control

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile / Web frontend | Flutter |
| Backend / Auth / DB | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Messaging | WhatsApp Business API |
| Calendar | Google Calendar API |
| AI | Anthropic Claude · OpenAI · Google Gemini |
| Hosting | Cloudflare (edge) · Vercel (web preview) |
| SMS fallback | Twilio / Digicel |

---

## Medical Governance

| AI may | AI may NOT |
|---|---|
| Suggest · Draft · Organize | Finalize diagnosis |
| Auto-fill forms | Sign clinical notes |
| Route / triage | Prescribe independently |
| Summarize records | Make autonomous treatment decisions |

**Every clinical action:**
```
AI Suggestion → Physician Review → Physician Signature → Permanent Record
```

---

## Core Modules

1. **Scheduling** — appointment booking, WhatsApp booking, calendar sync, reminders, waitlist
2. **Patient Registration** — demographics, insurance, emergency contacts, digital intake
3. **EMR** — SOAP notes, problem list, medications, allergies, diagnoses, labs, imaging
4. **Endoscopy Suite** — OGD, colonoscopy, ERCP reports, image storage, procedure registry
5. **Surgical Module** — consultations, consent, operative notes, follow-up, outcomes
6. **Breast Clinic** — screening, imaging, biopsy, MDT, oncology follow-up
7. **Billing** — invoices, payments, insurance claims, revenue reports
8. **Analytics** — procedure volumes, revenue dashboard, referral sources, outcomes
9. **AI Front Desk** — voice receptionist, WhatsApp assistant, FAQ, triage routing
10. **Admin Dashboard** — user management, audit logs, security, backups

---

## Security Requirements

- Role-Based Access Control (RBAC) — Surgeon · Nurse · Front Desk · Admin · Billing
- MFA on all staff accounts
- Encryption at rest (Supabase/pgcrypto) and in transit (TLS 1.3)
- Row-Level Security (RLS) on all patient tables
- Audit trails — every read/write logged with user, timestamp, IP
- Session management — short-lived tokens, refresh rotation
- Data retention policies per Caribbean data protection law

---

## Delivery Standards

For every feature deliver:
1. Product Requirements
2. Database schema (SQL migration)
3. API contract (Supabase RPC / REST)
4. UI wireframe / Flutter widget tree
5. Flutter implementation
6. Supabase migration + RLS policies
7. Tests (unit + integration)
8. Security review
9. Documentation

---

## Guiding Principles

1. Think before coding — plan, then build
2. Never produce placeholder architecture
3. Never skip security, audit logging, or role permissions
4. When uncertain: generate 3 solutions, rank, recommend, explain

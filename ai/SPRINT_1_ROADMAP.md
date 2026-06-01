# MedFlow Caribbean — Sprint 1 Roadmap (2 weeks)

## Sprint Goal
**Working Flutter app with auth, patient registration, and appointment booking.**
Dr. Kabiye can log in on mobile, register a patient, and book an appointment that syncs to Google Calendar.

---

## Week 1 — Foundation

### Day 1–2: Project Setup
- [ ] Create Flutter project (`medflow_caribbean`)
- [ ] Configure Supabase project — URL, anon key, service role key
- [ ] Add dependencies: `supabase_flutter`, `go_router`, `riverpod`, `drift`, `dio`
- [ ] Set up environment config (`.env` via `flutter_dotenv`)
- [ ] CI/CD: GitHub Actions → build APK on push
- [ ] Design system: colours, typography, spacing (Caribbean palette — deep teal, warm gold, white)

### Day 3: Auth & RBAC
- [ ] Supabase Auth — email/password login
- [ ] MFA setup (TOTP)
- [ ] `user_profiles` table + RLS
- [ ] Role-based router guards (GoRouter)
- [ ] Login screen → role-appropriate home screen

### Day 4: Database Migration 1
- [ ] `patients` table + RLS policies
- [ ] `appointments` table + RLS policies
- [ ] `audit_logs` table (trigger-based logging on patients + appointments)
- [ ] Seed: Dr. Kabiye user profile + test patient

### Day 5: Patient Registration
- [ ] Patient search screen (name / MRN / phone)
- [ ] New patient form (multi-step: demographics → insurance → emergency contact)
- [ ] Patient record view (read-only summary)
- [ ] Offline: cache last 50 patients in Drift

---

## Week 2 — Scheduling & AI

### Day 6–7: Appointment Booking
- [ ] Calendar view (week + day) with appointment slots
- [ ] New appointment form: patient lookup → type → site → time → notes
- [ ] Google Calendar sync via Supabase Edge Function
- [ ] Appointment status workflow: scheduled → arrived → in_progress → completed

### Day 8: WhatsApp Reminders
- [ ] WhatsApp Business API webhook (Supabase Edge Function)
- [ ] Automated D-1 and H-2 reminder messages
- [ ] Patient reply handling: confirm / cancel / reschedule

### Day 9: AI Front Desk (MVP)
- [ ] WhatsApp → Supabase Edge Function → Claude API
- [ ] Intents: book appointment · check status · FAQ · escalate
- [ ] Forbidden content filter (no clinical advice, no fees, no diagnoses)
- [ ] Human escalation queue in admin dashboard

### Day 10: Polish + QA
- [ ] Full flow test: patient registration → booking → WhatsApp reminder → check-in
- [ ] Security review: RLS test (cross-user data isolation)
- [ ] Offline test: airplane mode → create patient → reconnect → sync
- [ ] Performance: load 500 patient records < 300 ms
- [ ] Bug fixes

---

## Sprint 1 Deliverables

| # | Deliverable | Owner |
|---|---|---|
| 1 | Flutter project with auth + RBAC | Engineer |
| 2 | Supabase schema migration v1 | DB Architect |
| 3 | Patient registration (full form) | Engineer |
| 4 | Appointment calendar + booking | Engineer |
| 5 | Google Calendar sync | DevOps |
| 6 | WhatsApp reminder edge function | Engineer |
| 7 | AI Front Desk MVP (booking + FAQ) | Engineer |
| 8 | RLS security test suite | QA + Security |
| 9 | APK build + TestFlight / Play internal track | DevOps |

---

## Definition of Done (Sprint 1)

- Dr. Kabiye can log in on an Android or iOS device
- Front desk can register a new patient in < 2 minutes
- Appointment booked → appears on Google Calendar < 30 seconds
- WhatsApp reminder sent automatically 24h and 2h before
- Patient can book via WhatsApp without staff involvement (non-urgent)
- Offline: works with no internet for read + draft (syncs on reconnect)
- Zero critical security findings from RLS audit

---

## Sprint 2 Preview (EMR Core)

- SOAP Note editor with AI pre-fill from voice
- Problem list, medication management, allergies
- Encounter signing (physician signature + timestamp)
- Diagnoses (ICD-10 search + AI suggestion)
- Basic endoscopy report form (OGD + Colonoscopy)

## Sprint 3 Preview (Endoscopy + Billing)

- Full endoscopy suite: OGD · Colonoscopy · ERCP
- Image upload + Supabase Storage
- Billing module: invoices, line items, payments
- Insurance claim tracking

---

## Tech Decisions Rationale

**Flutter over React Native:** Dr. Kabiye confirmed mobile-first. Flutter gives native performance on iOS + Android from one codebase, with no WebView overhead for clinical workflows.

**Supabase over custom backend:** Gives RLS, Auth, Realtime, Storage, and Edge Functions in one managed platform. Reduces operational overhead for a solo surgeon practice.

**Riverpod over Bloc:** Less boilerplate, better async handling, easier to unit test individual providers.

**Drift (offline-first):** Drift compiles SQLite queries at build time — type-safe, fast, works offline. Sync queue handles reconnection without user intervention.

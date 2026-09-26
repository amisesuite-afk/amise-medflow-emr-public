# MedFlow product roadmap — after Amise MedFlow is finished

| | |
|---|---|
| Status | **Deferred by the owner (2026-09-25).** Build nothing here until Amise MedFlow, the practice's own app, is complete. |
| Naming | **MedFlow** is the product. **Amise MedFlow** is the first practice's instance of it. |
| Related | `docs/MULTI-TENANCY-PLAN.md` (how practices' data is kept apart), `docs/compliance/` (legal/regulatory drafts) |

Owner's brief: *"For the app's reproducibility and multiple users: registration, and specific blocks built by
specialty or general practice, outpatient or in hospital, and hardware and software legal requirements — to be
created after I finish my own Amise MedFlow app. It will continue to be the MedFlow app."*

## 1. Practice registration (onboarding)

A new practice signs up and gets a working, empty MedFlow configured for it:

- Practice details: name, clinicians and credentials, registration numbers, sites, phone/WhatsApp lines,
  email, country, time zone, letterhead, currency. (iOS `PracticeProfile` is the starting point; the web and
  API still carry Amise hard-codes — see `MULTI-TENANCY-PLAN.md` §1.)
- Its own database (per-practice Supabase project first — see `MULTI-TENANCY-PLAN.md`), migrations applied by
  the runner, first admin account, staff invitations with roles (front desk, nurse, doctor, admin).
- Device setup: iPhone/iPad sign-in by practice code, device pairing, NAS/backup target.
- Signed agreements captured before go-live (terms, data-processing agreement, BAA where US rules apply).

## 2. Specialty and setting "blocks"

MedFlow is assembled from blocks the practice switches on at registration (and can change later):

| Block type | Examples already built for Amise (reusable) | To add for other practices |
|---|---|---|
| **Core (always on)** | Patient record, notes, vitals + NEWS2, prescriptions + interaction checks, documents, billing, audit trail, sync, backups | — |
| **Practice type** | General & endoscopic surgery | General practice / family medicine, other surgical specialties, medical specialties |
| **Setting** | Outpatient clinic, ward rounds, theatre list, endoscopy list | Outpatient-only (hides ward/theatre), inpatient/hospital (bed management, handover, discharge) |
| **Consultation pathways** | First visit, follow-up, ward review, procedure, trauma, burns, wellness/screening | Per-specialty pathways and question sets |
| **Procedure modules** | Endoscopy (OGD, colonoscopy, ERCP), bowel-prep protocols, operative notes, consent, WHO checklist | Specialty procedure forms |
| **Scores / decision support** | ~100 clinical scores, Bayesian differential (surgical pools) | Specialty score sets and differential pools |
| **Patient communication** | Booking, prep texts, questionnaires, hand-over mode | Specialty prep texts — each practice's clinical owner must approve its own wording |

Design rules carried over from Amise: a block only adds screens and content; turning it off hides it without
deleting data; every block meets the engineering gate in `CLAUDE.md`; patient-facing clinical wording is always
the practice clinician's approved text.

## 3. Hardware and software requirements

- **iPhone / iPad**: iOS 17 or later (iPhone XS/XR or newer; iPad 6th generation, Air 3, Pro 2018 or newer),
  device passcode required, Face ID/Touch ID recommended. Guided Access for patient hand-over on shared iPads.
- **Web** (dashboard, front desk): current Safari, Chrome or Edge.
- **Network**: internet for cloud sync; nearby iPhone↔iPad sync over Wi-Fi/Bluetooth after one-time pairing.
- **Optional**: NAS for local backups (Synology via Tailscale in Amise's setup), printer (AirPrint),
  Apple Pencil, labs/imaging connections (HL7/FHIR, DICOM server on the NAS).
- **Accounts the practice needs**: Google Workspace (email/calendar), Twilio (SMS/WhatsApp), Sentry
  (crash reports), each under a data-processing agreement.

## 4. Legal and regulatory requirements (per country)

Drafts for Saint Lucia are in `docs/compliance/`. For each new country or practice: data protection law
(Saint Lucia Data Protection Act; GDPR for UK/EU; HIPAA for US), data-processing agreements/BAAs with every
vendor, medical-device status of the scores and decision support (`medical-device-positioning.md`), a clinical
safety officer and safety case, terms of use and privacy notice, professional liability insurance, records
retention rules, and an independent security review before selling.

## 5. Order of work (when the owner starts this)

1. Finish Amise MedFlow (current work).
2. Remove the remaining Amise hard-codes from web and API (practice settings table + sites table).
3. Registration/onboarding flow and per-practice database provisioning.
4. Block switches (practice type, setting) — start by hiding ward/theatre for outpatient-only practices.
5. Legal pack per country and first pilot practice.

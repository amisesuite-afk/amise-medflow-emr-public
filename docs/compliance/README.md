> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Compliance document pack

This is the legal, regulatory and clinical-safety groundwork for AMISE MedFlow EMR before it is sold to other practices.

| | |
|---|---|
| Prepared | 2026-09-24 |
| Code baseline | `c9a7293`. Every file and line citation refers to that tree |
| How this was produced | Static reading of the code, migrations and workflows. **Nothing was verified against production** (Supabase, Render, Vercel, vendor contracts). Anything that needs a live check is marked **to confirm** or **to verify** |
| What it is not | Legal advice or a regulatory determination. It frames the decisions and evidence for a lawyer, a Clinical Safety Officer (CSO) and regulatory counsel |

## Index

| Document | Purpose | Audience |
|---|---|---|
| [`data-inventory.md`](data-inventory.md) | What personal and health data is collected. Where it is stored (Supabase, iOS SwiftData, NAS, IndexedDB, audit_log). Retention. Who can access it. Data flows to each subprocessor. An accurate statement of AI use | Counsel, owner, engineering |
| [`subprocessors.md`](subprocessors.md) | Vendor register: purpose, data, region, DPA/BAA need, status | Counsel, owner |
| [`privacy-policy-draft.md`](privacy-policy-draft.md) | Patient-facing privacy notice (Saint Lucia DPA 2011 framing, with GDPR and HIPAA annex) | Patients (after legal review) |
| [`terms-of-use-draft.md`](terms-of-use-draft.md) | Clinician terms: decision support only, clinician retains responsibility | Staff and clinician users |
| [`clinical-safety-case.md`](clinical-safety-case.md) | DCB0129-style safety argument, evidence, gaps and sign-off | CSO, owner |
| [`hazard-log.md`](hazard-log.md) | 20 hazards with causes, effects, cited controls, initial and residual risk (5×5), and actions | CSO, engineering |
| [`medical-device-positioning.md`](medical-device-positioning.md) | SaMD assessment (MHRA, EU MDR Rule 11, FDA CDS four criteria), recommended positioning, and where labels would go in the UI | Owner, regulatory counsel |
| [`security-controls.md`](security-controls.md) | Current controls, known gaps, priority findings S-1 to S-6, pen-test and SOC 2 readiness checklists | Owner, engineering, auditors |

Related existing documents: `docs/SECRETS-HYGIENE.md`, `docs/AUDIT-TRAIL-COVERAGE.md`, `docs/INCIDENT-RUNBOOK.md`, `migrations/README.md`, `CLAUDE.md`.

## Headline findings

1. **Access-control gaps (critical, to verify).**
   - The front-desk `/api/staff/*` routes trust the mere presence of a cookie.
   - The RLS policies `staff_select_patients` and `staff_select_documents` (`auth.uid() is not null`) may give **patient-portal users** read access to all patients.
   - `requireStaffAuth()` accepts any Supabase JWT.

   See `security-controls.md` §3.
2. **No multi-tenant isolation.** Every authenticated user sees every patient. This blocks multi-practice sale until each customer has an isolated stack or a tenant model is built.
3. **NEWS2 is under-scored.** There are three inconsistent implementations. The dashboard panel omits consciousness and oxygen, and iOS applies SpO₂ Scale 2 automatically. This is hazard H-04, residual risk **4**.
4. **Outbound messaging.**
   - The 24-hour reminder email is forced to `'auto'`, bypassing `MODE=dry_run`, and its AI-drafted body is not safety-checked (`cron.ts:85`).
   - Automated prep messages tell every patient "do NOT take ... insulin" (H-09, H-10).
5. **AI.** Anthropic receives **identifiable PHI** from the web and API, with no de-identification. iOS AI is disabled. The `DISABLE_AI` kill switch is checked in only 3 of the 18 API files that call Anthropic, and not at all in the front-desk intake. **No BAA or DPA is recorded** with any vendor.
6. **Regulatory.** Patient-facing triage, NEWS2 escalation, the Bayesian differential and the AI consult are **likely medical-device functions** in the UK, the EU and the US.

## Status of open actions and owners

**Owner key**

- **PO**: practice owner (Dr Kabiye, or the legal entity)
- **CSO**: Clinical Safety Officer (not yet appointed)
- **ENG**: engineering
- **LAW**: Saint Lucia counsel
- **REG**: regulatory counsel
- **PHARM**: clinical pharmacist

"Signs" names who must formally approve or sign.

| # | Action | Owner | Signs | Priority | Status | Ref |
|---|---|---|---|---|---|---|
| A-1 | Verify and fix S-1 (front-desk cookie check), S-2 (RLS vs portal users) and S-3 (`requireStaffAuth`). Add a live RLS test as a patient user | ENG | PO (authorises the emergency change) | **P0** | Open | `security-controls.md` §3 |
| A-2 | Collect or sign DPAs (and BAAs if in HIPAA scope) with Supabase, Render, Vercel, Google Workspace and Twilio. Confirm that the Gmail account is Workspace | PO | **PO signs** each agreement | **P0** | Not yet signed / unknown | `subprocessors.md` |
| A-3 | Anthropic and OpenAI: sign a BAA/DPA with zero retention, **or** remove `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` from production (Render and the front-desk Vercel project) | PO | **PO signs** the agreement or approves the switch-off | **P0** | Not yet signed / unknown | `subprocessors.md` #9-10 |
| A-4 | Hide or label the dashboard NEWS2 panel now. Replace the three implementations with one tested implementation | ENG | **CSO** signs the fix | **P0** | Open | H-04 |
| A-5 | Rewrite the prep-instruction medication wording. Remove or justify the forced `'auto'` in `cron.ts:85`. Check `draft.safe` | PO (clinical content), ENG | **PO** approves the wording | **P0** | Open | H-09, H-10 |
| A-6 | Appoint a CSO. Write a Clinical Risk Management Plan. Review and accept the hazard log | PO | **PO** appoints. **CSO** signs the safety case | P1 | Open | `clinical-safety-case.md` |
| A-7 | Remove the api.qrserver.com call (session token leak) | ENG | — | P1 | Open | S-4 |
| A-8 | iOS peer-sync authentication hardening, or disable peer sync by default | ENG | CSO/PO accepts the residual risk | P1 | Open | S-5 |
| A-9 | Add PHI scrubbing to web and API Sentry | ENG | — | P1 | Open | S-6 |
| A-10 | Clinical-field merge with timestamps or conflict prompts. Server-side soft delete | ENG | CSO | P1 | Open | H-12, H-14 |
| A-11 | Map drug-interaction classes to drugs, or license a database. Add the "absence of alert" label. Pharmacist review of formulary and dosing content | ENG, PHARM | **CSO** | P1 | Open | H-07, H-08 |
| A-12 | Clear browser PHI caches on sign-out. Idle timeout. Staff MFA | ENG | — | P1 | Open | G-4, G-5, H-16 |
| A-13 | Obtain Saint Lucia legal advice: DPA 2011 commencement and registration, lawful bases, medical-records retention period, cross-border transfers, **consent for call recording**, liability wording | LAW | **LAW** advises. **PO** approves the published notice and terms | P1 | Open | `privacy-policy-draft.md`, `terms-of-use-draft.md` |
| A-14 | Regulatory positioning decision (records-only abroad versus a UKCA/CE programme). Answer the counsel questions | REG, PO | **PO** decides | P1 (before any non-Saint Lucia sale) | Open | `medical-device-positioning.md` §6 |
| A-15 | Implement the UI labelling changes L1-L16 | ENG | CSO reviews the wording | P2 | Open | `medical-device-positioning.md` §5 |
| A-16 | Terms-of-use acceptance on sign-in, versioned and logged | ENG | LAW approves the text | P2 | Open | `terms-of-use-draft.md` |
| A-17 | Retention schedule and a deletion or anonymisation process (including backups and devices) | PO, LAW, ENG | **PO** approves the schedule | P2 | Open | `data-inventory.md` §3 |
| A-18 | Enable PITR, or document acceptance of the ~24-hour RPO. Back up all storage buckets. Hold a restore drill | PO (budget), ENG | **PO** | P2 | Open | H-13, G-10 |
| A-19 | iOS: explicit file protection, exclude the store from backups, on-device dictation, minimise PHI in notifications and calendar events | ENG | — | P2 | Open | G-11, G-12 |
| A-20 | Make `DISABLE_AI` cover all AI routes, including the front-desk intake | ENG | — | P2 | Open | G-8 |
| A-21 | Multi-tenant architecture (or a per-customer isolated stack) before multi-practice sale | ENG, PO | PO | P1 (sale blocker) | Open | G-1 |
| A-22 | Enable GitHub secret scanning and push protection. First rotation of secrets | PO (repo admin), ENG | — | P2 | Open | `docs/SECRETS-HYGIENE.md` |
| A-23 | Pen test (staging environment with synthetic data), then SOC 2 Type I readiness | PO (commissions), ENG | PO | P2 | Open | `security-controls.md` §4-5 |
| A-24 | Confirm the facts marked "to confirm": vendor regions, Render and Sentry configuration, whether `backup.yml` is live, whether Railway, Meta or Telnyx are in use | ENG, PO | — | P2 | Open | `data-inventory.md` §7 |

## Maintaining this pack

- Update `subprocessors.md` whenever a new outbound host or SDK is added.
- Update `hazard-log.md` whenever a feature that produces scores, alerts, advice, AI output or patient messages changes.
- Re-baseline the code references (the commit SHA at the top of each file) at each review.

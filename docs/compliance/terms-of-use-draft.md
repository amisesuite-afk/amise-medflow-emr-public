> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Terms of Use for clinician users (draft)

> These terms are for **staff and clinician users** of AMISE MedFlow EMR (the dashboard, the iOS app and the staff areas of the front-desk app). They sit alongside, and do not replace, a commercial licence or subscription agreement, a data-processing agreement, and (where applicable) a BAA between the software provider and each customer practice. Items in [brackets] are to be completed.

---

## AMISE MedFlow EMR: Clinician Terms of Use

Version [x.y] · Effective [date]

**Provider:** [legal entity to confirm], Saint Lucia ("we", "us")
**Customer:** the practice that has given you an account ("your practice")
**You:** the individual user

By signing in you confirm that you have read and accept these terms. Your acceptance is recorded, together with the version number.

### 1. What the software is

AMISE MedFlow EMR is an electronic medical record and practice-management system. It includes **clinical decision-support tools**:

- triage and red-flag prompts
- clinical scores and early-warning scores (for example NEWS2)
- a probabilistic differential-diagnosis list
- management and pathway prompts
- drug-interaction and allergy alerts
- dosing references
- AI-assisted drafting and extraction of documents

These tools **support** professional judgement. They are not a substitute for it.

[Regulatory status statement, to be completed after `medical-device-positioning.md` is resolved. For example: "The software is not a CE- or UKCA-marked medical device and is not cleared by the US FDA."]

### 2. The clinician retains full responsibility

This mirrors the "Human authority" principle in the product's design (`CLAUDE.md`).

**2.1** You, the clinician, always keep full professional responsibility for:

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

**2.2** The software may recommend, organise, summarise and assist. It will **never** independently diagnose, prescribe, order procedures or change the medical record without your explicit approval. You must not use it as if it could.

**2.3** Before relying on any output, you must check it against the patient in front of you, the source data, and current guidelines. This applies to scores, probabilities, suggested diagnoses, suggested investigations, alerts, doses and AI-drafted text.

**2.4** You must review, correct and approve every AI-drafted document before signing it. That includes letters, operative notes, endoscopy reports, discharge summaries, coding suggestions and message drafts. Your signature means that you have done so.

### 3. Known limitations you must be aware of

You acknowledge the following:

- **(a) Differential diagnoses.** The list is produced by a statistical model built from published literature. It has not been validated on your patient population. It can show only the conditions in its catalogue, so a serious diagnosis may be missing from the list.
- **(b) Clinical scores.** Scores depend entirely on the data entered or imported. They may be incomplete if inputs are missing. [Until hazard H-04 is closed: "The dashboard NEWS2 panel does not currently include consciousness level or supplemental oxygen; always use the full NEWS2 chart."]
- **(c) Drug interactions.** Interaction checking covers only a limited list. **The absence of an alert does not mean there is no interaction.** Always consult an authoritative formulary.
- **(d) AI output** may be incomplete, inaccurate or invented, and may repeat errors in source documents.
- **(e) Patient-submitted information.** Intake forms, WhatsApp/SMS conversations and emails are reported by patients. They are unverified and may be incomplete.
- **(f) Sync and offline use.** Information entered offline, or on another device, may not yet be visible. In rare cases a correction may not reach every device. Check that the sync status shows up to date before relying on a record for a critical decision.

### 4. Your obligations

You must:

1. **Keep your credentials to yourself.** Use only your own account. Keep your password and devices secure. Lock or sign out of shared workstations when you leave them.
2. **Access records only when needed.** Access a patient's record only when you have a legitimate need related to their care or your role. Access is logged and audited.
3. **Enter information accurately.** Enter information accurately and against the correct patient. Confirm the patient's identity (name, date of birth and MRN) before recording or acting.
4. **Report problems.** Promptly report to [contact] any suspected software fault, safety incident, near miss or data breach, including incorrect scores, alerts or AI output.
5. **Follow local rules.** Follow your practice's policies and your professional regulator's standards on record-keeping, confidentiality and consent.
6. **Handle exports carefully.** Do not export, photograph or send patient information outside the system except as your practice permits.
7. **Stay within your role.** Do not attempt to bypass role-based restrictions, safety controls or audit logging.
8. **Use AI only with approved data flows.** Use AI features only for their intended purpose, and only where your practice has confirmed the required data-processing agreements are in place.

### 5. Patient communications

- **Automated messages.** The software can send appointment messages and reminders. Your practice decides whether these are sent automatically, reviewed first, or held (the "mode" setting).
- **What automated messages must not contain.** Clinical advice, diagnoses, results, medication doses or fees.
- **Your own messages.** You remain responsible for the content of any message you write or approve.

### 6. Availability

- We aim for high availability but do not guarantee uninterrupted service.
- Your practice must maintain a **downtime procedure** so that care can continue if the system is unavailable.
- The system is not a monitoring or alarm system and must not be relied on for real-time alerts.

### 7. Liability

[To be drafted by counsel, aligned with the commercial agreement and Saint Lucia law. Consider:

- no limitation of liability for death or personal injury caused by negligence, where the law does not allow one;
- the allocation between provider, practice and clinician;
- professional indemnity requirements for users.]

### 8. Changes

We may update these terms. We will tell you about material changes, and you will be asked to accept the new version the next time you sign in.

### 9. Governing law

[To confirm: the laws of Saint Lucia, and the courts of Saint Lucia.]

---

## Implementation notes (not part of the terms)

- **Where acceptance should happen.** On first sign-in and after each version change: dashboard `artifacts/dashboard/src/components/LoginPage.tsx` / `AuthGuard`, and iOS `ios/AmiseMedFlow/Views/LoginView.swift`. Record `{user_id, terms_version, accepted_at}`, for example as an `audit_log` event with `action: 'accept_terms'`. Nothing of this kind exists in the code today.
- **Keep the limitations in step with the hazard log.** Section 3 must be updated whenever a related hazard in `hazard-log.md` is opened or closed.

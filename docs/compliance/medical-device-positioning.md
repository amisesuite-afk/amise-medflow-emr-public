> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Medical device positioning (SaMD assessment)

> This is an engineering-led first pass to frame questions for regulatory counsel. It is **not a regulatory determination**.

| | |
|---|---|
| Status | Draft v0.1, 2026-09-24. Code baseline `c9a7293` |
| Markets considered | Saint Lucia (current), United Kingdom (MHRA), European Union (MDR 2017/745), United States (FDA) |

## 1. Why this matters

Software that has a medical purpose for individual patients (diagnosis, prevention, monitoring, prediction, prognosis or treatment) can be a medical device in the UK, the EU and the US, whatever the vendor calls it. Selling to practices in those markets without the correct classification, conformity assessment and registration is a legal risk. It also undermines the "decision support only" defence in the Terms of Use.

**Saint Lucia.** No specific medical-device or software-as-a-medical-device regime was identified during this review. Whether any exists, including through CARPHA or the Caribbean Regulatory System, is **unknown / to confirm with counsel**.

## 2. Feature inventory for classification

| # | Function | What it does (from code) | Audience | Where |
|---|---|---|---|---|
| F1 | EMR record-keeping, scheduling, billing, messaging logistics | Stores, displays and transmits data | Staff | Across the apps |
| F2 | **Patient-facing symptom intake with emergency redirect** | Scores free text and answers against red-flag rules. Shows an ER/911 redirect. Sets booking urgency | **Patients** | `lib/triage-engine/src/apcq.ts`, `adaptive-triage.ts`, `rules.ts`; `artifacts/front-desk/app/intake/page.tsx:320-446`; `front-desk/lib/claude.ts` (conversational intake) |
| F3 | Staff-facing triage acuity | Acuity, score, recommended action and front-desk script | Staff | `adaptive-triage.ts`, `artifacts/dashboard/src/pages/Home.tsx` |
| F4 | **NEWS2 and deterioration alerts** | Calculates NEWS2 from entered vitals. Displays escalation actions ("EMERGENCY: ... Activate rapid response team") | Clinicians | `dashboard/src/lib/clinical-scales.ts:393-438`, `clinical-scores.ts:540-595`, iOS `Models/VitalsEntry.swift:73-131`, iOS `ClinicalChangePointDetector.swift`, `AutoFunctionEngine.swift` ("alert — CUSUM/NEWS2 deterioration") |
| F5 | Other clinical scores (more than 100) and risk calculators | Calculates published scores. Some are auto-populated from the record | Clinicians | iOS `ClinicalScoringEngine*.swift`, `PatientScoreAutoPopulator*.swift`; dashboard `clinical-scales.ts`, `PreopRiskScoringCard.tsx` |
| F6 | **Bayesian differential diagnosis** | Ranks diagnoses with numeric probabilities from entered or parsed features. Value-of-information "ask/order next" suggestions | Clinicians | `lib/pane-engine`, `dashboard/src/components/PaneDifferential.tsx`; iOS `Bayesian*Engine*.swift`, `ValueOfInformationEngine.swift`, `AutoFunctionEngine.swift` |
| F7 | Management and pathway suggestions | Suggests investigations and management steps for a working diagnosis | Clinicians | `lib/pane-engine/src/management`, iOS `ManagementEngine*.swift`, `SurgicalAlgorithmEngine.swift`, `SurgicalVademecum*.swift` |
| F8 | Prescribing support | Interaction and allergy alerts. Dosing reference. Dosing suggestions by diagnosis | Clinicians | `drug-interactions.ts`, `AllergyMedAlert.tsx`, `DiagnosisDosingGuide.swift`, the formularies |
| F9 | AI documentation drafting | Drafts letters, op notes, discharge summaries and reports. The clinician edits and signs | Clinicians | API AI routes |
| F10 | AI extraction of results and urgency | Extracts values from lab and imaging documents. Proposes urgency | Staff and clinicians | `email-documents.ts`, `document-scan.ts`, `ResultsInboxTab.tsx` |
| F11 | AI clinical consult ("AI consultant") | LLM answers clinical questions about a patient | Doctors | `routes/ai-consult.ts` |
| F12 | Burns fluid calculation (Parkland) and other dose or volume calculators | Calculates a fluid volume | Clinicians | iOS `Views/Consultation/BurnsAssessmentView.swift`, `PathwayData.swift:192` |

## 3. Assessment by jurisdiction

### 3.1 United Kingdom (MHRA)

- **Legal basis.** UK MDR 2002 (as amended). MHRA guidance: "Medical device stand-alone software including apps".
- **The MHRA's key questions.**
  - Does the software do more than store, archive, communicate or simply search?
  - Does it apply to individual patients?
  - Does it have a medical purpose?

  Software that calculates, interprets or ranks patient-specific information to inform diagnosis or treatment is generally a device. Pure EMR functions (F1) and documentation templates are generally not.

| Feature | View (to confirm) |
|---|---|
| F1, F9 (drafts the clinician must edit and sign) | Likely **not** a device, provided no clinical interpretation is added. AI drafting that *summarises* existing data is lower risk, but an LLM that infers clinical content could be argued otherwise |
| F2 | **Likely a device.** It is a patient-facing symptom assessment that directs urgency, including an ER redirect |
| F4, F5, F12 | **Likely devices.** Calculators that take patient-specific data and produce a result used for clinical decisions, especially where the result carries escalation or dose recommendations |
| F6, F7, F11 | **Likely devices**: diagnosis and treatment decision support |
| F8 | Interaction and allergy alerting and dose guidance: **likely device functions** |
| F10 | Urgency proposal from results: **likely a device function** |

- **Classification.** Under the current UK MDR 2002 rules, much stand-alone software has historically been Class I. The UK has announced reforms that are expected to align software classification more closely with EU MDR Rule 11 (**timing and final text to confirm**). Plan on Class IIa or above for F2, F4 and F6.
- **Also note.**
  - **DCB0129** is required for NHS supply. **DTAC** (Digital Technology Assessment Criteria) is used by NHS buyers.
  - UK GDPR and the DPA 2018 apply.

### 3.2 European Union (MDR 2017/745, Rule 11; MDCG 2019-11)

**Rule 11 summary**

| Software that... | Class |
|---|---|
| Provides information used to take decisions for diagnostic or therapeutic purposes | **IIa** |
| Does the above, where the decision could cause **death or irreversible deterioration** | **III** |
| Does the above, where the decision could cause **serious deterioration or surgical intervention** | **IIb** |
| Monitors physiological processes | IIa |
| Monitors vital parameters where variations could result in immediate danger | IIb |
| All other software | Class I |

**Application to this product (to confirm)**

- **F6** (differential for acute surgical conditions: appendicitis, cholangitis, perforation, GI bleed). Wrong decisions could lead to a surgical intervention or to serious deterioration, so plausibly **IIb**.
- **F4** (NEWS2 with escalation text). It supports monitoring decisions for vital parameters, so plausibly **IIa-IIb**.
- **F2** (patient-facing triage). Plausibly **IIa** or higher. MDCG 2019-11 gives symptom checkers as a Rule 11 example.
- **F5, F8, F10, F11, F12**. At least **IIa**.
- **F1, F9**. Likely not devices (MDCG 2019-11: software for storage, communication or simple search is not a device).

**Consequences.** Class IIa or above needs a notified body, a QMS (ISO 13485), a software lifecycle (IEC 62304), risk management (ISO 14971), usability engineering (IEC 62366-1), clinical evaluation, PMS/PSUR, EUDAMED registration and UDI. The **EU AI Act** is also likely to treat AI components of a Class IIa+ device as **high-risk AI systems** (to confirm).

### 3.3 United States (FDA; 21st Century Cures Act §3060, FD&C Act §520(o)(1)(E); FDA CDS Guidance, September 2022)

A clinical decision support (CDS) software function is **excluded from the device definition only if all four criteria are met**:

| # | Criterion | Assessment |
|---|---|---|
| 1 | Not intended to acquire, process or analyse a medical image, a signal from an in vitro diagnostic device, or a pattern or signal from a signal acquisition system | F4-F6 use **manually entered** vitals and history: *likely met*. F10 analyses lab reports (IVD results) and images (`document-scan.ts`; iOS `analyseResultImage`, which is disabled): **may fail** |
| 2 | Intended for displaying, analysing or printing medical information about a patient or other medical information (such as guidelines) | *Likely met* for F4-F8 |
| 3 | Intended for **supporting or providing recommendations to an HCP** about prevention, diagnosis or treatment | **F2 fails**: it is patient-facing. Under the 2022 guidance, the FDA reads this criterion narrowly. Software that gives a **specific directive**, or supports **time-critical** decisions, generally fails. **F4** ("EMERGENCY: ... Activate rapid response team") is time-critical and directive, so it **likely fails**. **F6** shows a ranked list with precise probabilities: at risk, because the FDA views a single or narrowly ranked output as more directive. F5 and F8 are borderline |
| 4 | Intended to enable the HCP to **independently review the basis** for the recommendation, so the HCP does not rely primarily on it | **F6 is at risk.** The Bayesian likelihoods, priors and feature contributions are not shown to the user in a reviewable way (**to confirm** what the UI exposes). **F11 (the LLM consult) likely fails**: the basis of an LLM output cannot be independently reviewed. F5 is likely met where the score components are shown (for example the NEWS2 breakdown badges) |

**US conclusion (to confirm).**

- F1 and F9 are likely non-device.
- **F2, F4, F6, F10 and F11 are likely device software functions** that fail one or more criteria.
- F5, F7, F8 and F12 need a function-by-function review.
- FDA enforcement discretion may apply to some low-risk functions. The "Policy for Device Software Functions and Mobile Medical Apps" and "General Wellness" guidance should be reviewed with counsel.
- **HIPAA applies separately** if a US customer is a covered entity.

## 4. Recommended positioning

1. **Split the product into two regulatory modules**:
   - **(A) MedFlow Records**: EMR, scheduling, messaging logistics and documentation drafting. Position it as a non-device.
   - **(B) MedFlow Decision Support**: triage, scores, differential, management prompts, prescribing alerts and the AI consult. Treat it as SaMD.

   Make module (B) **feature-flagged per tenant and per market**. There is no tenant concept today (see `security-controls.md`), so this depends on the multi-tenancy work.
2. **For sale outside Saint Lucia before any regulatory approval**, ship only (A). Disable F2 (patient-facing triage), F4 escalation text, F6, F10 urgency and F11 in those markets. Alternatively, pursue UKCA/CE marking as Class IIa or IIb.
3. **For Saint Lucia**, take counsel's advice on any local requirements, then keep (B) under the DCB0129-style safety case (`clinical-safety-case.md`) and label it clearly as decision support.
4. **Design for CDS criterion 4 regardless of market.** Show *why* for every output:
   - the score inputs and thresholds
   - the features driving each differential, with their weights and sources
   - the guideline behind each management prompt

   This lowers risk and helps any future exemption argument.
5. **Remove directive or time-critical language** from calculators where possible. For example, replace "EMERGENCY: Activate rapid response team" with "NEWS2 ≥7: local escalation policy applies (RCP 2017)".
6. **Keep patient-facing intake strictly administrative.** Keep the ER redirect as generic safety advice ("If you think this is an emergency, call 911"). Avoid presenting it as a triage outcome computed from the patient's answers. Whether this is enough to take F2 out of scope is a question for counsel.

## 5. Labelling changes: where they would go in the UI

This section lists locations only. No code has been changed.

| # | Location | Current state | Proposed label or change |
|---|---|---|---|
| L1 | Dashboard `components/PaneDifferential.tsx:58` | Has "Bayesian decision support only — not a diagnosis..." | Keep. Add "Probabilities are model estimates from published literature, not validated locally. Diagnoses outside the catalogue are not shown." |
| L2 | iOS `Views/Consultation/ConsultationView+CCTab.swift:147`, `+HistoryTab.swift:166`, `+PlanTab.swift:124` (differential %) | **No disclaimer next to the percentages** | Add the same disclaimer as L1. Consider bands (high, moderate, low) instead of exact % |
| L3 | Dashboard `components/ClinicalScoresPanel.tsx` (News2Card, around line 417) | Scores NEWS2 without AVPU or O₂ | Until it is fixed: "Incomplete NEWS2: consciousness and oxygen not included". After it is fixed: "Calculated from entered values; verify against observations chart (RCP NEWS2 2017)" |
| L4 | Dashboard `pages/tabs/ScalesTab.tsx:144-145` and `lib/clinical-scales.ts` `interpretNews2` | Directive "EMERGENCY: ..." text | Replace with non-directive, policy-referencing text (§4 item 5) |
| L5 | iOS vitals and NEWS2 displays (`Models/VitalsEntry.swift`, `Views/Vitals/*`, `Views/Ward/*`) | Risk colour and "High" label | Show the component breakdown. Show the Scale used and who selected it |
| L6 | Dashboard `components/DrugInteractionAlert.tsx`, iOS `Views/Prescription/PrescriptionView+Sections.swift:89` | iOS has "Reference guide only..." | Both: "Interaction checking covers a limited list. **No alert does not mean no interaction.**" |
| L7 | Dosing and formulary views: dashboard `pages/tabs/DosingTab.tsx`, iOS `DiagnosisDosingGuide.swift` consumers | Mixed | Show the source and last-reviewed date on each entry, and "Verify against local formulary" |
| L8 | Front-desk intake (`artifacts/front-desk/app/intake/page.tsx`: disclaimer screen and emergency redirect) | Disclaimer and 911 redirect exist | Consent screen: "This form helps us schedule your visit. It does not assess or diagnose your condition. If you think you are having an emergency, call 911 or go to the nearest Emergency Department now." Repeat it on every page footer |
| L9 | WhatsApp/SMS intake first message (`front-desk/lib/claude.ts` `SYSTEM_PROMPT` / first reply) | No fixed disclaimer | Send a fixed, non-AI first message with the same wording as L8 |
| L10 | AI-drafted documents (`LetterGeneratorTab.tsx:291`, `ProceduresTab.tsx:136, 1949`, `EndoscopyReportGenerator.tsx:149`) | "AI-Assisted Draft — Reviewed, Approved, and Signed by Surgeon" footer | Keep. Add an in-app review banner before signing: "AI-generated text: check every finding, dose and side." |
| L11 | AI consult (`routes/ai-consult.ts` consumers in the dashboard) | To confirm | "AI suggestions may be incorrect. Not for autonomous clinical decisions." |
| L12 | Results Inbox (`pages/tabs/ResultsInboxTab.tsx:699-712`) | AI urgency pre-selected, default routine | Label as "AI-suggested urgency". Default unknown to "Needs review" |
| L13 | Login and first-run for staff (dashboard `components/LoginPage.tsx`, iOS `Views/LoginView.swift`) | None | Click-through acceptance of the Terms of Use (`terms-of-use-draft.md`) and an intended-use statement, versioned and logged to `audit_log` |
| L14 | Settings → About (dashboard `pages/tabs/SettingsTab.tsx`, iOS `Views/SettingsView.swift`) | None | Intended use, version, manufacturer and a regulatory status statement (for example "Not a CE/UKCA-marked medical device") |
| L15 | iOS AI consent sheet (`Views/AIConsentGate.swift`) and Settings AI section (`SettingsView.swift:277`) | Says data is "de-contextualised" and sent to Anthropic, although iOS AI is disabled | Correct it: "AI features are currently disabled on iOS." If AI is re-enabled, say exactly what is sent, including identifiers |
| L16 | Printed and PDF outputs with scores or differentials (iOS `ClinicalScoresPDF.swift`, `PatientSummaryPDF.swift`) | To confirm | Footer: "Decision-support output. Clinician-verified: [name/date]." |

## 6. Questions for regulatory counsel

1. Does Saint Lucia (or the OECS) regulate medical-device software? Is registration needed for local sale?
2. Is F2 (patient-facing intake with ER redirect) in scope if reframed as administrative (§4 item 6)?
3. Target markets and sequencing: is a UKCA/CE Class IIa/IIb programme commercially justified, or should the product ship as records-only (A) abroad?
4. Does the LLM-based consult (F11) need to be withdrawn from regulated markets entirely?
5. What are the EU AI Act obligations if AI components are placed on the EU market?

# Change log — `lab-feed` (automatic lab results and practice reference ranges)

2026-09-26. Branch `lab-feed` (from `claude/pr-37-gbg22z`). Owner-approved item. Storage:
**Migration 96** (`supabase-lab-feed-migration.sql`), wired in `run-migrations.yml` after the sign-off
register (Migration 95), **not yet applied** to production. Rule sets
`lab-reference-ranges` 1.0.0 and `lab-feed-loinc-map` 1.0.0 in `clinical-content/registry.json`,
status **needs sign-off**. Laboratory integration guide: `docs/LAB-FEED.md`.

No engine, score formula, diagnosis weight or `DiagnosticDatabase.json` was changed. No AI. Nothing
is ever sent to a patient.

## 1. Practice reference ranges

One table of reference ranges (`lab_reference_ranges`) and one helper that every consumer reads
through (`lib/triage-engine/src/reference-ranges.ts`, `@workspace/triage-engine/reference-ranges`):
analyte (catalogue saved name), unit (the catalogue app unit), sex, age band, lower, upper,
critical low, critical high, laboratory source, effective date.

- **Lookup.** The practice's own range when one matches the analyte, the patient's sex and age and
  is in effect on the collection date (most specific first: a sex-specific row beats "any", a
  narrower age band beats a wider one, then the latest effective date); otherwise the built-in
  default. Defaults are adult (18+); a child gets no default and only the laboratory's own flag
  counts. An unknown age still gets the adult range (the practice sees adults).
- **Comparison.** A value is compared only when its unit is the range's unit (after the
  catalogue's unit normalisation); otherwise the flag is "unknown", never guessed.
  Low if value < lower, high if > upper; critical if value < critical low or > critical high.
- **Admin UI.** Settings → Laboratory reference ranges (admin only): every default shown with a
  "Replace…" button, practice ranges with Edit and Retire (rows are never deleted). Every change
  goes through the API and is audit-logged with the values before and after.
- **iOS.** A read-only twin of the defaults, `ios/AmiseMedFlow/Services/LabReferenceRanges.swift`,
  parity-enforced by `lint:reference-range-parity`. **Follow-up:** iOS does not yet read it
  (LabPanel.hasCriticalValues and the scores keep their built-in numbers, which equal the
  defaults), and syncing the practice's own ranges to iOS is not built.

### Consumers moved onto the helper (same numbers by default)

| Consumer | Before | Now |
|---|---|---|
| Report import critical flag (`report-import-save.ts isCriticalLabValue`) | Hard-coded switch (iOS LabPanel thresholds) | Practice critical limits, else the defaults (identical; lactate "≥ 4" is stored as "> 3.9") |
| Decision layer "× ULN" rules (lipase, amylase, troponin; `decision-support.ts`) | Content placeholders 60 / 100 / 14 with "assumed — use the local reference range" | The practice's ULN when one is set (the text then shows "(ULN n U/L)"); otherwise unchanged, still marked "assumed". The engine is unchanged: its `uln` input was already there |
| TG18 cholangitis B2 "> 1.5 × ULN" (`clinical-scores.ts`) | ALP 130, GGT 65, AST 40, ALT 40 | Practice ULNs, else those defaults |
| Tumour markers (`LabInterpretationPanel`) | CEA 5, CA 19-9 37, AFP 10, CA-125 35, PSA 4 | Practice ULNs in the panel's unit, else those defaults |
| Light's criteria serum LDH ULN (`ClinicalAlgorithmPanel`) | 200 U/L | Practice ULN, else 200 |
| Outcome snapshots (`outcomes-completion.ts`) | — | Same ULNs as the Plan panel |

Left alone on purpose: clinical grading bands that are guideline definitions rather than laboratory
ranges (HbA1c ADA bands, corrected-calcium grades, TG18 WBC < 4 / > 10 and CRP ≥ 10, bilirubin
≥ 34 µmol/L), the inference rule "amylase > 1000" in `clinical-inference.ts` (an engine), and the
consultation `CriticalResultAlert` thresholds (CDS text).

## 2. Inbound laboratory feed

`POST /api/lab-feed/inbound` accepts FHIR R4 (a Bundle of DiagnosticReport + Observation + Patient,
or a single DiagnosticReport) and HL7 v2 ORU^R01 (MSH, PID, OBR, OBX with NM, SN, ST, CE/CWE, TX/FT;
NTE comments; abnormal flags).

- **Authentication.** One secret per laboratory (`LAB_FEED_SECRETS`), sent as `x-lab-id` +
  `x-lab-feed-key`, compared in constant time, checked **before** the body is read; unknown lab,
  wrong or missing key → 401; no secrets configured → 503 (feed off). Rate-limited. The body is
  never logged.
- **Mapping.** LOINC first (`loinc.ts`, blood / serum / plasma codes only), else the printed label
  through the catalogue's names and synonyms, accepting only harmless trailing words ("serum",
  "total", "hs"…). A LOINC code and a label that name different tests are **not trusted**: the
  value is kept under its printed label, unmapped. Urine and other fluids are never filed under the
  blood analyte.
- **Units.** The catalogue's conversion rules (the same code as the report import): an exact
  factor converts (Hb g/L → g/dL, creatinine mg/dL → µmol/L, glucose mg/dL → mmol/L…); an
  ambiguous or unexpected unit is never converted and is marked for the reviewer.
- **Flags never downgrade the laboratory.** Abnormal = practice range low/high **or** the
  laboratory's flag / printed range says abnormal. Critical = practice critical limit **or** the
  laboratory's critical flag (HH, LL, AA).
- **Idempotent.** Per message (laboratory + message control id / bundle id) and per report
  (laboratory + report id + status + report time). A resend is acknowledged as a duplicate; a
  failed message (AE) can be resent safely. A corrected report is filed as a new result.

### Patient matching (safety-critical)

Automatic filing **only** when the laboratory sent an MRN that exactly one patient has (exact, as
stored) **and** a date of birth equal to that patient's. Everything else (no MRN, MRN not found,
two patients with the MRN, no date of birth, date of birth different) goes to **Results to
reconcile**, with the identity as the laboratory sent it. A nurse, doctor or admin searches
candidates (same MRN, or same date of birth), sees MRN / DOB / name ticks side by side, and files
it; a mismatch needs an explicit "I have checked the identity" confirmation, which is
audit-logged. Names are never used to attach automatically.

### Storage and review

A filed report is one `investigation_results` row, exactly like the report import (multi-analyte
`analytes`), with `source = 'lab-feed'`, status `resulted` shown as "Received — awaiting clinician
review", the practice range used for each flag, the laboratory's own flag, and the provenance in
`notes`. The Results Inbox has a **Lab feed** tab: "To reconcile" and "New results". "Mark reviewed"
(nurse / doctor / admin, signed in) sets `reviewed`, records who and when, is audit-logged, closes
the review task and opens an "inform patient" task for abnormal / critical results (the clinician
decides how; nothing is sent automatically).

**Feeding the engines.** A result on file reaches What's missing, the decision layer and the
diagnostic reasoning the same way an imported report does: Investigations → Lab and imaging
reports on file → **Use in this consultation** copies the values into the consultation's results
and the encounter's score inputs, with the report-import rules (names a reader would take for
another test stay out; only confirmed units feed scores). This is a tap, not automatic: the result
may belong to an earlier visit.

### Critical values

- **In-app:** a red banner on every page for doctors and admins ("Critical lab result waiting —
  n to review · n not yet matched to a patient"), linking to the Lab feed tab; an urgent workflow
  task per critical report.
- **Email:** when `DOCTOR_NOTIFY_EMAIL` is set, one staff-internal email per message with critical
  results, through `sendOrDraft` (the MODE gate: nothing leaves under `dry_run`; under
  `supervised` it is promoted to a direct send because it is staff-internal). It says only that a
  critical result is waiting, from which laboratory, and where to look — **no patient data**.
- **Never to patients.** No SMS, WhatsApp or email to a patient is generated by the feed.

## Files

| Part | Files |
|---|---|
| Ranges (shared) | `lib/triage-engine/src/reference-ranges.ts`; iOS `ios/AmiseMedFlow/Services/LabReferenceRanges.swift`; lint `scripts/src/lint-reference-range-parity.ts` |
| API | `artifacts/api-server/src/routes/lab-feed.ts`; `src/lib/lab-feed/{types,hl7,fhir,loinc,normalise,matching,processor,alerts,auth,ranges}.ts`; gate in `src/app.ts` |
| Dashboard | `components/lab-feed/{LabFeedInbox,LabFeedCriticalBanner,ReferenceRangesSettings}.tsx`; `lib/{reference-ranges-store,lab-feed-session,tumour-markers}.ts`; `hooks/useReferenceRanges.ts`; consumers listed above |
| Database | `supabase-lab-feed-migration.sql` (Migration 96) |
| Tests | `api-server/src/test/lab-feed-parsers.test.ts`, `lab-feed-route.test.ts`; `dashboard/src/lib/__tests__/reference-ranges.test.ts`; `scripts/src/lab-feed-migration.test.ts`, `reference-range-parity.test.ts` |

## Needs sign-off

Nothing below is treated as approved. Reply with the item numbers you approve.

1. **Default reference ranges** (adults 18+, marked "default — replace with your laboratory's
   ranges"; to be replaced by Laboratory Services Ltd's own ranges before go-live):

   | Analyte | Unit | Range | Critical |
   |---|---|---|---|
   | WBC | ×10⁹/L | 4.0–11.0 | — |
   | Haemoglobin | g/dL | male 13.0–17.0, female 12.0–15.5 | < 8.0 (any sex) |
   | Platelets | ×10⁹/L | 150–400 | < 50 |
   | INR | — | 0.8–1.2 | > 2.5 |
   | D-dimer | µg/L FEU | ≤ 500 | — |
   | CRP | mg/L | ≤ 5 | — |
   | Sodium | mmol/L | 135–145 | < 120 or > 155 |
   | Potassium | mmol/L | 3.5–5.3 | < 2.5 or > 6.0 |
   | Urea | mmol/L | 2.5–7.8 | — |
   | Creatinine | µmol/L | male 59–104, female 45–84 | > 300 (any sex) |
   | eGFR | mL/min/1.73m² | ≥ 60 | — |
   | Calcium (total) | mmol/L | 2.20–2.60 | < 1.75 or > 3.0 |
   | Magnesium | mmol/L | 0.70–1.00 | — |
   | Glucose | mmol/L | 3.9–7.8 (random) | < 3.0 or > 20.0 |
   | HbA1c | % | ≤ 5.6 | — |
   | Bilirubin | µmol/L | ≤ 21 | — |
   | ALT / AST | U/L | ≤ 40 | — |
   | ALP | U/L | 30–130 | — |
   | GGT | U/L | ≤ 65 | — |
   | Albumin | g/L | 35–50 | — |
   | Amylase | U/L | ≤ 100 | — |
   | Lipase | U/L | ≤ 60 | — |
   | LDH | U/L | ≤ 200 | — |
   | Lactate | mmol/L | ≤ 2.0 | > 3.9 (i.e. ≥ 4.0 at one decimal) |
   | Troponin I / T / unspecified | ng/L | ≤ 14 | > 52 |
   | CEA | ng/mL | ≤ 5 | — |
   | CA 19-9 | U/mL | ≤ 37 | — |
   | AFP | ng/mL | ≤ 10 | — |
   | CA-125 | U/mL | ≤ 35 | — |
   | PSA (male) | ng/mL | ≤ 4 | — |

   Points to decide: the troponin I ULN of 14 ng/L is below most high-sensitivity troponin I
   assays' 99th percentile (it over-flags; the laboratory's assay value should replace it); the
   LDH ULN of 200 U/L matches the Light's-criteria number the app used, but LDH ranges depend on
   the method; glucose 3.9–7.8 assumes a random sample; ESR, ferritin and the other analytes have
   no default (the laboratory's own flag applies).
2. **Critical limits.** They reproduce iOS `LabPanel.hasCriticalValues`, so the web and iOS agree.
   Should the practice add others (for example WBC < 1.0 or > 30, bilirubin, amylase / lipase, a
   paediatric set)? None were added without your decision.
3. **Escalation expectation for a critical result** (proposed, not yet agreed):
   - the laboratory's own telephone call for critical values **continues unchanged** — the feed is
     an addition, not a replacement;
   - the in-app banner and the email go to the doctor; the doctor (or the doctor on call)
     acknowledges by opening the result and marking it reviewed with the action taken, **within
     60 minutes during clinic hours**;
   - a critical result that cannot be matched to a patient is matched first, the same day, by the
     nurse or doctor on duty (the email says so);
   - out of hours: the laboratory's phone call to the on-call doctor is the route; the feed does
     not page anyone;
   - not built, pending your choice: a repeat alert if a critical result stays unreviewed (for
     example every 30 minutes, or an SMS to `STAFF_NOTIFY_PHONE` after 60 minutes).
4. **Matching rule**: automatic filing only on exact MRN + date of birth; a person matches
   everything else; a mismatch can be filed only with an explicit identity confirmation. Also:
   whether the laboratory will send the practice MRN (AM-######) in PID-3 / Patient.identifier with
   type MR — without it every result goes to reconciliation.
5. **LOINC map** (`loinc.ts`, 100+ codes) and the label fallback: to be checked against the codes
   the laboratory actually sends.
6. **Flags never downgrade the laboratory** (practice range or the laboratory's flag, whichever is
   more abnormal), and the report-import / decision-layer / TG18 / tumour-marker / Light's
   consumers reading the practice ranges once entered.
7. **Retention** of dismissed reconciliation rows (identity of people who may not be patients of
   the practice) and of the message log (no bodies). Proposed: kept indefinitely like the record,
   for audit, pending your decision.

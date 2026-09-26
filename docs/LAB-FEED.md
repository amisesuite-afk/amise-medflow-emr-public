# Laboratory results feed — integration guide

For the laboratory's IT team (and the practice). AMISE MedFlow EMR, Amise Medical Services,
Saint Lucia. Status: built, **not live** until the go-live checklist below is complete.

The practice's EMR accepts laboratory results sent by the laboratory's system over HTTPS, in
**HL7 v2 ORU^R01** or **FHIR R4**. Results for a patient the EMR can identify with certainty are
filed to that patient's record for a clinician to review; every other result waits in a
reconciliation queue for a nurse or doctor to match by hand. Nothing is sent to patients.

## 1. Endpoint

```
POST https://<api host>/api/lab-feed/inbound
```

`<api host>` is the practice's API server (given to the laboratory at go-live). HTTPS only.
One message per request, up to 2 MB. Rate limit: 120 requests per minute.

| Format | `Content-Type` | Body |
|---|---|---|
| HL7 v2 (2.3 – 2.5.1), ER7 | `application/hl7-v2` (or `x-application/hl7-v2+er7`) | One ORU^R01 message, segments separated by CR (LF and CRLF also accepted), no MLLP framing |
| FHIR R4 | `application/fhir+json` (or `application/json`) | A `Bundle` (type `message`, `transaction`, `batch`, `collection` or `searchset`) with `DiagnosticReport`, `Observation` and `Patient` resources, or one `DiagnosticReport` with `contained` resources |

## 2. Authentication

Each laboratory has its own id and secret (at least 32 random characters), set by the practice
on the API server (`LAB_FEED_SECRETS`) and given to the laboratory over a separate, secure
channel. Send both headers on every request:

```
x-lab-id: slulab
x-lab-feed-key: <your secret>
```

A missing or wrong key, or an unknown laboratory id, gets `401 {"error":"Unauthorised"}`; the
body is not read. Never put the secret in the URL. The practice can rotate a secret at any time
(the old one stops working at once).

## 3. What the message must contain

| Item | HL7 v2 | FHIR R4 | Why |
|---|---|---|---|
| Message id (unique per message) | `MSH-10` | `Bundle.identifier.value` (else `MessageHeader.id`, else `Bundle.id`) | Idempotency: a resent message is recognised |
| Report id (accession) | `OBR-3` filler order number (else `OBR-2`) | `DiagnosticReport.identifier[0].value` (else `.id`) | Idempotency per report; shown to clinicians |
| **Practice MRN** (format `AM-######`) | `PID-3` repetition with identifier type `MR` (`PID-3.5`), or the only `PID-3` identifier | `Patient.identifier` with `type` code `MR` (`http://terminology.hl7.org/CodeSystem/v2-0203`), or the only identifier | **Automatic filing needs it** |
| **Date of birth** | `PID-7` | `Patient.birthDate` | **Automatic filing needs it** |
| Name, sex | `PID-5`, `PID-8` | `Patient.name`, `Patient.gender` | Shown when matching by hand; sex selects sex-specific ranges |
| Test / panel | `OBR-4` | `DiagnosticReport.code` | |
| Collected, reported | `OBR-7`, `OBR-22` (else `MSH-7`) | `effectiveDateTime` / `effectivePeriod.start`, `issued` | Times without a zone are read as Eastern Caribbean Time (UTC-4) |
| Report status | `OBR-25` (`F` final, `C` corrected, `P` preliminary, `X` cancelled) | `DiagnosticReport.status` | A corrected report is filed as a new result; a cancelled one is ignored |
| Each result | `OBX`: `-2` value type (`NM`, `SN`, `ST`, `CE`/`CWE`, `TX`/`FT`), `-3` code (LOINC with coding system `LN`, in the first or the alternate triplet), `-5` value, `-6` unit, `-7` range, `-8` abnormal flags, `-11` status (`D` / `W` are dropped), `-14` time | `Observation`: `code` (LOINC system `http://loinc.org`), `valueQuantity` (with `comparator`), `valueString`, `valueCodeableConcept`, `interpretation`, `referenceRange`, `note`, `status` (`entered-in-error` / `cancelled` are dropped); panels via `hasMember` | |
| Comments | `NTE` after an `OBX` (that result) or after an `OBR` (the report) | `Observation.note`, `DiagnosticReport.conclusion` | |

Abnormal flags (HL7 table 0078 / FHIR ObservationInterpretation): `H`, `L`, `A` mark abnormal;
**`HH`, `LL`, `AA` mark critical** and raise the practice's critical-result alert. The practice
also applies its own reference ranges; a result is never marked less abnormal than the laboratory
marked it.

**Please send the practice MRN.** Automatic filing happens only when the MRN matches exactly one
patient **and** the date of birth matches that patient. Without the MRN every result waits for a
person to match it.

## 4. Codes and units

Send LOINC codes where you have them. Results are matched to the EMR's analyte catalogue by LOINC
first, then by the printed name. If a LOINC code and the printed name point to different tests,
the result is kept under its printed name and not used by any score. Codes for urine or other
fluids are never filed under the blood analyte.

Units are converted only with exact factors (for example Hb g/L → g/dL, creatinine mg/dL →
µmol/L, glucose mg/dL → mmol/L, WBC 10*3/µL → ×10⁹/L). A unit that is ambiguous (urea in mg/dL,
D-dimer without FEU/DDU, HbA1c in mmol/mol) or unexpected is stored as sent and marked for the
clinician. Please send UCUM or the usual printed units.

| EMR analyte | LOINC codes recognised | Stored in |
|---|---|---|
| WBC | 6690-2, 26464-8, 804-5 | ×10⁹/L |
| Haemoglobin | 718-7, 20509-6 | g/dL |
| Platelets | 777-3, 26515-7 | ×10⁹/L |
| Haematocrit | 4544-3, 20570-8 | as reported |
| Red cell count | 789-8 | as reported |
| MCV | 787-2 | as reported |
| MCH | 785-6 | as reported |
| MCHC | 786-4 | as reported |
| RDW | 788-0 | as reported |
| Neutrophils | 751-8, 770-8 | as reported |
| Lymphocytes | 731-0, 736-9 | as reported |
| Monocytes | 742-7, 5905-5 | as reported |
| Eosinophils | 711-2, 713-8 | as reported |
| Basophils | 704-7, 706-2 | as reported |
| ESR | 4537-7, 30341-2 | mm/h |
| INR | 6301-6, 34714-6 | (no unit) |
| Prothrombin time | 5902-2 | as reported |
| APTT | 3173-2, 14979-9 | as reported |
| Fibrinogen | 3255-7 | as reported |
| D-dimer | 48065-7 | µg/L FEU |
| CRP | 1988-5, 30522-7 | mg/L |
| Procalcitonin | 33959-8 | as reported |
| Sodium | 2951-2, 2947-0 | mmol/L |
| Potassium | 2823-3, 6298-4 | mmol/L |
| Chloride | 2075-0 | as reported |
| Bicarbonate | 1963-8, 2028-9 | as reported |
| Urea (from urea nitrogen / BUN) | 3094-0, 6299-2 | mmol/L |
| Creatinine | 2160-0, 14682-9, 38483-4 | µmol/L |
| eGFR | 33914-3, 48642-3, 48643-1, 62238-1, 98979-8 | mL/min/1.73m² |
| Calcium | 17861-6, 2000-8 | mmol/L |
| Ionised Ca | 1994-3 | as reported |
| Magnesium | 19123-9 | mmol/L |
| Phosphate | 2777-1 | as reported |
| Uric acid | 3084-1 | as reported |
| Glucose | 2345-7, 14749-6, 2339-0, 1558-6, 15074-8 | mmol/L |
| A1c (glycated) | 4548-4, 17856-6, 59261-8 | % |
| Bilirubin | 1975-2, 14631-6 | µmol/L |
| Direct bili (conjugated) | 1968-7, 14629-0 | as reported |
| Indirect bili (unconjugated) | 1971-1 | as reported |
| ALT | 1742-6 | U/L |
| AST | 1920-8 | U/L |
| ALP | 6768-6 | U/L |
| GGT | 2324-2 | as reported |
| Albumin | 1751-7 | g/L |
| Total protein | 2885-2 | as reported |
| Globulin | 10834-0 | as reported |
| Amylase | 1798-8 | U/L |
| Lipase | 3040-3 | U/L |
| LDH | 2532-0, 14804-9 | U/L |
| Lactate | 2524-7, 32693-4, 2518-9 | mmol/L |
| Creatine kinase | 2157-6 | as reported |
| Troponin I | 10839-9, 42757-5, 89579-7 | ng/L |
| Troponin T | 6598-7, 67151-1 | ng/L |
| TSH | 3016-3 | as reported |
| Free T4 | 3024-7 | as reported |
| Free T3 | 3051-0 | as reported |
| Ferritin | 2276-4 | as reported |
| Iron | 2498-4 | as reported |
| TIBC | 2500-7 | as reported |
| Vitamin B12 | 2132-9 | as reported |
| Folate | 2284-8 | as reported |
| CEA | 2039-6 | as reported |
| CA 19-9 | 24108-3 | as reported |
| CA-125 | 10334-1 | as reported |
| CA 15-3 | 6875-9 | as reported |
| PSA | 2857-1 | as reported |
| Free PSA | 10886-0 | as reported |
| AFP | 1834-1 | as reported |
| Total cholesterol | 2093-3 | as reported |
| HDL cholesterol | 2085-9 | as reported |
| LDL cholesterol | 13457-7, 18262-6 | as reported |
| Triglycerides | 2571-8 | as reported |

Any other test is accepted and stored under its printed name ("as reported").

## 5. Responses

The EMR never returns patient data. HL7 requests get an HL7 `ACK` (with `MSA-2` = your
`MSH-10`); FHIR requests get JSON.

| HTTP | HL7 `MSA-1` | Meaning | What to do |
|---|---|---|---|
| 200 | `AA` | Accepted: filed, queued for matching, or a duplicate of a message already processed (`MSA-3` says which, with counts) | Nothing |
| 400 | `AR` | Rejected: the message could not be read (reason code in `MSA-3` / `error`, e.g. `unsupported_message_type`, `obx_without_obr`, `missing_control_id`, `invalid_json`) | Fix and send again with a new message id |
| 401 | — | Authentication failed | Check `x-lab-id` / `x-lab-feed-key` |
| 413 | — | Larger than 2 MB | Split the message |
| 429 | — | Rate limit | Retry later |
| 503 | `AE` | Not stored this time (feed switched off, database update pending, or a storage error) | **Resend the same message later** (it is safe: duplicates are recognised) |

FHIR JSON example:

```json
{ "ok": true, "status": "processed", "messageId": "BND-2026-0001",
  "reports": [ { "reportRef": "slulab:LAB-26-0789:final:2026-09-26T12:25:00.000Z", "outcome": "attached", "critical": true } ] }
```

`outcome` is `attached` (filed to a patient), `queued` (waiting to be matched by hand),
`duplicate`, `skipped` (cancelled or empty) or `failed` (resend).

## 6. Idempotency and corrections

- A message with a `MSH-10` / Bundle id already processed from your laboratory is acknowledged
  (`AA`, "duplicate") and changes nothing. Always use a new id for a new message.
- A report already stored (same report id, status and report time) is never stored twice, even
  inside a new message.
- A **corrected** report (`OBR-25 = C` / `status = corrected | amended`) with a new report time is
  filed as a new result marked "Corrected report"; the earlier one stays on the record.
- After an `AE` / 503, resend the same message; anything already stored is recognised.

## 7. Test messages

Fictitious patient (use the test MRN the practice gives you, not a real patient). HL7:

```bash
printf 'MSH|^~\\&|LIS|SLULAB^Laboratory Services Ltd|AMISE-MEDFLOW|AMISE|20260926083000-0400||ORU^R01^ORU_R01|TEST-0001|P|2.5.1\r''PID|1||AM-999999^^^AMISE^MR||Test^Patient||19700520|F\r''OBR|1||LAB-TEST-0001|24362-6^Renal function panel^LN|||20260926071500-0400|||||||||||||||20260926082500-0400|||F\r''OBX|1|NM|2951-2^Sodium^LN||138|mmol/L|135-145|N|||F\r''OBX|2|NM|2823-3^Potassium^LN||4.1|mmol/L|3.5-5.3|N|||F\r''OBX|3|NM|2160-0^Creatinine^LN||1.0|mg/dL|0.6-1.1|N|||F\r' \
  | curl -sS -X POST "https://<api host>/api/lab-feed/inbound" \
      -H "Content-Type: application/hl7-v2" -H "x-lab-id: slulab" -H "x-lab-feed-key: $LAB_FEED_KEY" --data-binary @-
```

Expected: `MSA|AA|TEST-0001|processed: 1 filed, 0 to reconcile` when AM-999999 exists with that
date of birth; `queued: 0 filed, 1 to reconcile` otherwise. Sending it again: `duplicate`.

FHIR (save as `bundle.json`):

```json
{
  "resourceType": "Bundle", "type": "collection",
  "identifier": { "system": "urn:slulab:bundle", "value": "TEST-BND-0001" },
  "entry": [
    { "fullUrl": "urn:uuid:p1", "resource": { "resourceType": "Patient", "id": "p1",
      "identifier": [ { "type": { "coding": [ { "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "MR" } ] }, "value": "AM-999999" } ],
      "name": [ { "family": "Test", "given": [ "Patient" ] } ], "gender": "female", "birthDate": "1970-05-20" } },
    { "fullUrl": "urn:uuid:dr1", "resource": { "resourceType": "DiagnosticReport", "id": "dr1", "status": "final",
      "identifier": [ { "value": "LAB-TEST-0002" } ], "code": { "text": "Lipase" },
      "subject": { "reference": "urn:uuid:p1" }, "effectiveDateTime": "2026-09-26T07:15:00-04:00", "issued": "2026-09-26T08:25:00-04:00",
      "performer": [ { "display": "Laboratory Services Ltd" } ], "result": [ { "reference": "urn:uuid:o1" } ] } },
    { "fullUrl": "urn:uuid:o1", "resource": { "resourceType": "Observation", "id": "o1", "status": "final",
      "code": { "coding": [ { "system": "http://loinc.org", "code": "3040-3" } ], "text": "Lipase" },
      "valueQuantity": { "value": 45, "unit": "U/L" }, "referenceRange": [ { "high": { "value": 60 } } ] } }
  ]
}
```

```bash
curl -sS -X POST "https://<api host>/api/lab-feed/inbound" -H "Content-Type: application/fhir+json" \
  -H "x-lab-id: slulab" -H "x-lab-feed-key: $LAB_FEED_KEY" --data-binary @bundle.json
```

More realistic samples (a full blood count with unit conversions, a critical potassium, repeats,
comments, an unknown test, malformed messages) are in
`artifacts/api-server/src/test/fixtures/lab-feed-samples.ts`.

## 8. Go-live checklist

**Practice (owner / admin):**

1. Apply Migration 96 (`docs/OWNER-STEPS-MIGRATIONS.md`). Until then the endpoint answers 503.
2. Enter the laboratory's reference ranges in Settings → Laboratory reference ranges (replace
   every row marked "default"), and approve the sign-off items in
   `docs/clinical-validation/changes/lab-feed.md` (critical limits, escalation).
3. Create the laboratory's secret (for example `openssl rand -hex 32`) and set
   `LAB_FEED_SECRETS=slulab:<secret>` on the API server (Render → Environment); give the secret to
   the laboratory over a secure channel (not email).
4. Make sure `DOCTOR_NOTIFY_EMAIL` is set (critical-result email; staff only, no patient data) and
   that `MODE` is what you intend (`dry_run` sends no email).
5. Create a test patient (e.g. AM-999999, DOB 1970-05-20) for the laboratory's test messages;
   dismiss or review the test results afterwards.
6. Agree with the laboratory that its **telephone call for critical values continues** — the feed
   is an addition, not a replacement.
7. Watch the Results Inbox → Lab feed tab for the first week: every result "to reconcile" means
   a missing or different MRN / date of birth; ask the laboratory to fix the source.

**Laboratory:**

1. Configure the interface (HL7 v2 over HTTPS POST, or FHIR R4) with the endpoint and both headers.
2. Send the practice MRN (`AM-######`) with identifier type `MR`, and the date of birth.
3. Check your test codes against the LOINC table above; tell the practice about any test you
   send without LOINC.
4. Send the test messages (section 7): one matching, one with a wrong date of birth (must be
   queued, not filed), one duplicate (must be acknowledged as a duplicate), one malformed (must be
   rejected with `AR`), and one with a critical flag (`HH`).
5. Handle `AE` / 503 by resending later, and `AR` / 400 by fixing the message.
6. Keep the secret out of logs and URLs; tell the practice at once if it may have leaked.

## 9. Security and privacy summary

- HTTPS only; per-laboratory secret compared in constant time and checked before the body is read.
- The message body is **not stored** and **not logged**. The message log keeps the laboratory id,
  message id, format, status, counts, error code, and the SHA-256 and size of the body.
- A matched report is stored as the patient's result; an unmatched one keeps only what matching
  needs (identity as sent, normalised results) and is visible only to nurses, doctors and admins.
- Every filing, match, dismissal and review is audit-logged. No AI is involved. Nothing is sent to
  patients.

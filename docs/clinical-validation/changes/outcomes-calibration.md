# Change log — `outcomes-calibration` (real-outcomes loop: predictions, final diagnoses, calibration)

2026-09-26. Branch `outcomes-calibration` (from `claude/pr-37-gbg22z`). Owner-approved item
(SURGEON-DECISIONS.md I2). Storage: **Migration 94** (`supabase-outcomes-calibration-migration.sql`),
wired in `run-migrations.yml`, **not yet applied** to production.

Record what the engines predicted when an encounter was completed, record the final diagnosis
confirmed later, and measure accuracy on the practice's own patients. Model changes are
**proposed** from the data and applied only with the surgeon's approval.

**Nothing changes an engine automatically.** This change did not alter any engine weight, prior,
score formula, `DiagnosticDatabase.json` or version stamp. No AI, no network call beyond the
practice's own Supabase and API server. Coded data only: disease ids, ICD-10 codes, numbers and
version stamps; no free text.

## What the clinician sees

1. **Completion.**
   - Web: the sign-off dialog ("Review and sign — close encounter") has a line "Recorded for
     accuracy measurement (codes only)" with the engines' leading diagnoses, the clinician's
     ICD-10 code and, when an operation or pathology makes one expected, a reminder to record
     the final diagnosis.
   - iOS: "Review and complete" says the same under "Diagnosis and orders".
2. **Final diagnosis** (nurse, doctor, admin).
   - Web: a "Final diagnosis" card on the patient summary. It lists the patient's completed
     encounters, with the engines' leader and the working diagnosis. The clinician picks the
     final diagnosis (a PANE node, the ICD-10 catalogue or a typed code; "Same as the working
     diagnosis" is one tap), then the source (histology, imported report, operative findings,
     operative note, discharge summary, follow-up visit, other) and its date. Optional: what was
     done for each decision-layer option, and the urgency the case needed. Then **Confirm**.
   - **Retract** keeps the row and lets a corrected one be confirmed.
   - A gentle amber "Final diagnosis not yet recorded" shows on encounters completed more than 14
     days ago that had an operation or pathology.
   - iOS: the same in the saved-visit sheet ("Final diagnosis" section, capture sheet), and the
     reminder on the visit-history row.
3. **Engine accuracy** (admin only, Insights hub). The page shows:
   - top-1 / top-3 / top-5 accuracy per engine and model version, with Wilson 95% intervals;
   - a decile reliability table and the Brier score (multi-class and leader);
   - per-diagnosis sensitivity and PPV;
   - triage over- and under-triage;
   - decision-band agreement;
   - the overdue final diagnoses (MRN only);
   - **Proposed adjustments** (PANE priors and likelihoods, with counts and credible intervals),
     downloadable as JSON and as a Markdown review diff;
   - **Research export**: de-identified, admin only, audit-logged before release.

## How it works

| Part | Web / API | iOS |
|---|---|---|
| Snapshot built | `artifacts/dashboard/src/lib/outcomes-snapshot.ts` (pure), `outcomes-completion.ts` (from AppContext, same inputs as the decision-support panel) | `Services/OutcomeSnapshot.swift` `OutcomeSnapshotBuilder`, `ConsultationView+OutcomeSnapshot.swift` |
| Stored | Sent with `POST /api/visit/complete` → `lib/prediction-snapshots.ts` sanitises it, forces `encounter_ref = web:<encounter id>`, upserts with `ignoreDuplicates` (first completion wins) | `Encounter.predictionSnapshotJson` (set once), pushed to `prediction_snapshots` by `SyncService+Outcomes.swift` (`encounter_ref = ios:<Encounter.syncCode>`, first completion wins) |
| Final diagnosis | `lib/outcomes-db.ts` → `diagnosis_outcomes` (RLS: nurse/doctor/admin), `components/outcomes/FinalDiagnosisPanel.tsx` | `Encounter.finalDiagnosisJson` (array; retract, never delete), `Views/Consultation/FinalDiagnosisSection.swift`; pushed to and pulled from `diagnosis_outcomes` (`SyncService+Outcomes.swift`) |
| Sanitisers | `@workspace/triage-engine/outcomes` (`codes.ts`) | Swift twin `Services/OutcomeSanitiser.swift`, same vectors (`ios/AmiseMedFlowTests/Resources/OutcomeSanitiserVectors.json`) |
| Maths | `@workspace/triage-engine/outcomes` (`lib/triage-engine/src/outcomes/*`): sanitisers, calibration, shrinkage, de-identification | — |
| Report | Admin page `pages/tabs/CalibrationTab.tsx`; script `pnpm --filter @workspace/scripts run outcomes:calibration -- --input <export.json> \| --supabase` | — |
| Export | `GET /api/outcomes/research-export` (`routes/outcomes.ts`) | — |

- **Snapshot contents.** The PANE top 5 (disease id, ICD-10, posterior) and the PANE feature ids
  answered. Then:
  - the adaptive-triage level;
  - the decision-layer scores (recorded calculators; NEWS2 / qSOFA from the vitals) and every
    option's band with the decision's probability;
  - the clinician's **confirmed** working diagnosis (a PANE-suggested, unlocked one is not
    recorded as the clinician's) and the recorded ICD-10 codes (code only; labels dropped);
  - the versions `pane`, `rules`, `emergency`, `decision`, `management`, `planSafety`,
    `reasoning`;
  - `expects_outcome` and its triggers:
    - `operation`: a CPT code, a procedure name, a peri-operative procedure or the Assessment
      "procedures" field;
    - `pathology`: a biopsy, histology, cytology or FNA request. The flags are stored, never the
      text.
- **iOS snapshot.**
  - The iOS differential top 5 (ICD-10, display % ÷ 100) and the acuity level.
  - NEWS2, only from a complete set of that day's observations.
  - The working ICD-10.
  - The versions: DiagnosticDatabase version and whether the database or the fallback lists ran,
    plus the acuity, plan-safety, radiation and reasoning versions.
  - The triggers: operation (a procedural visit type, or an operation date within 30 days) and
    pathology (a Pathology-category or biopsy/histology/cytology/FNA investigation).
  - iOS has no PANE ids; the report matches iOS predictions by ICD-10 category.
- **Matching.** A prediction matches the final diagnosis when both have PANE ids and they are
  equal; otherwise when the ICD-10 categories (first three characters) are equal.
- **Triage scale.** For over/under-triage both platforms map to one scale:
  - web: `urgent` → emergency, `priority` → urgent, `review` → soon;
  - iOS: `emergency` / `urgent` / `priority` → emergency / urgent / soon.

  The reference is the clinician's retrospective "urgency the case needed".
- **Decision bands.** Agreement: treat + done, and observe or not-for-patient + not done. Test
  bands are not graded.
- **Proposals** (PANE only).
  - Prior shares: Dirichlet shrinkage towards the current tiers. Likelihoods P(feature |
    disease): Beta shrinkage towards the current values.
  - Thresholds and caveats: SURGEON-DECISIONS I2 and `docs/CLINICAL-CONTENT-UPGRADES.md` §4.6.1.
  - Output: a `PROPOSAL — not applied` JSON and a Markdown diff (`-` current / `+` proposed, with
    a 95% interval and counts) plus a sign-off table. A prior outside the tier scale is flagged
    as a warning about the sample.
- **Research export.**
  - Admin session only (the machine token is refused).
  - The `audit_log` row (`action 'export'`, `resource_type 'research_export'`, counts only) is
    written first, and the export is refused (503) if that fails.
  - Content: no identifiers or exact dates. Age bands 0–15 / 16–29 / 30–44 / 45–59 / 60–74 / 75+
    at completion in St Lucia time, completion and source months, random case ids that are new in
    every export, and shuffled rows.

## Tolerating the migration's absence (production has not applied 87–93 either)

- **`POST /api/visit/complete`** still closes the encounter. The response carries
  `predictionSnapshot: "unavailable"` (for `42P01` / `PGRST205` / `PGRST204` / `42703`).
  Otherwise the status is `saved`, `exists`, `invalid`, `failed` or `none`. A warning is logged
  once.
- **Dashboard.** The final-diagnosis card and the admin page say "available after the database
  update (Migration 94)". A save reports "Not saved: … after the database update". Nothing is
  queued, nothing is put in localStorage (`phi-storage.ts` unchanged: no new key), nothing
  returns a 500.
- **Research export:** `200 { available: false }`. The script prints that the tables are missing
  and exits 0.
- **iOS**: the first "table missing" answer (`42P01` / `PGRST205` / `PGRST204` / `42703`) stops the
  outcomes step quietly (no sync error, nothing in the pending count), notes the time and does not ask
  again for six hours or until the next sign-in / launch. The records stay pending on the device and
  go up once the migration is applied.

## iOS: push and pull (added 2026-09-26, branch `ios-outcomes-calculators`)

`SyncService+Outcomes.swift`, rules in `OutcomeSync.swift`, sanitisers in `OutcomeSanitiser.swift`. It runs
after the main sync steps in its own requests and never throws, so it cannot hold back the rest of the sync.

- **Who.** Only a confirmed nurse, doctor or admin role (`OutcomeSync.mayUse`), matching the Migration 94
  RLS. Front desk, and a role that could not be read (falls back to front desk, unconfirmed), neither push
  nor pull.
- **Same values as the web.** Every record goes through the Swift twin of `sanitizeSnapshot` /
  `sanitizeFinalDiagnosis` (ICD-10 normalisation, disease-id, key and version patterns, probability
  rounding, caps, triage scale, triggers, dates). The shared vectors are run by both platforms
  (`OutcomeSyncTests.swift`, `outcomes-sanitiser-vectors.test.ts`). The Swift `normaliseICD10` now splits
  labels exactly as the web does (any whitespace around a dash, two spaces, comma, semicolon).
- **Snapshots (first completion wins).** INSERT with `encounter_ref = ios:<syncCode>`, `encounter_id` null,
  `created_by` the signed-in user. A `23505` (the server already has this encounter's snapshot, e.g. an
  earlier insert whose answer was lost) adopts the existing row. Snapshots are never updated.
- **Final diagnoses (retract, then confirm).** Pending records go retractions first, so the server's
  "one confirmed row per encounter" index accepts the corrected diagnosis. A record already on the server
  is retracted with an UPDATE of `status`, `retracted_at`, `retracted_by` only (`eq status confirmed`); a
  record confirmed and retracted before it was ever sent is inserted as retracted (with its time), so the
  server keeps what was recorded. `client_ref` (`ios:<UUID>`) makes a retried insert idempotent: a `23505`
  is resolved by reading the row back by `client_ref`. When a retraction does not go through, the new
  confirmed diagnosis of that encounter waits.
- **Sync hard rules.** `pendingSync` clears only when the server returns the row and `updatedAt` did not
  change during the request (`SyncPushConfirmation`); the row id is kept at once (no second insert after a
  crash). A 0-row retraction is read back by id: still confirmed → refused; already retracted → applied (a
  retry after a lost answer); gone → left pending. A `42501` marks the record refused
  (`SyncRefusals .predictionSnapshot / .diagnosisOutcome`, counted in "N changes not permitted for your
  role") and the loop carries on; a transport error stops it. Patient ids go through
  `SyncRemoteId.serverId`; a patient not yet on the server waits.
- **Pull.** For this device's encounters the server knows, `diagnosis_outcomes` rows are merged
  (`OutcomeSync.merge`): a retraction made elsewhere is taken, a final diagnosis recorded on the web for an
  iOS encounter (the web card lists iOS snapshots) is added, not pending. An encounter with any unsent
  final-diagnosis change is skipped (never overwritten); a retracted record never becomes confirmed again.
  Snapshots are not pulled: they are written once, on the device that completed the visit.
- Encounters themselves are still not peer-synced or in the NAS backup, so a snapshot exists only on the
  device that completed the visit until it is pushed. The web report now includes iOS predictions once
  pushed (matched by ICD-10 category).

## Tests

- `scripts/src/outcomes-migration.test.ts` (PGlite): roles (front desk and portal: nothing), write-once
  snapshots, retract-only outcomes, one confirmed per encounter, idempotent `client_ref`, CHECKs
  refuse free text; the file applies twice.
- `artifacts/dashboard/src/lib/__tests__/outcomes-calibration.test.ts`: a fixed four-case fixture
  with hand-computed Brier scores (0.13, 0.85, 1.9041, 0.78; mean 0.916025), leader Brier
  0.400625, top-1/3/5 = 1/3/3 of 4, reliability bins, sensitivity/PPV, triage, band agreement,
  Wilson and Beta quantiles against known values, the shrinkage proposals (minimum counts,
  interval exclusion, shrinkage towards the current value, Beta(38, 12) → 0.76), sanitisers and
  the export.
- `outcomes-snapshot.test.ts` (web snapshot builder), `outcomes-db.test.ts` (graceful absence,
  duplicate / refused / 0-row retract), `outcomes-ios-contract.test.ts`.
- `artifacts/api-server/src/test/visit-lifecycle.test.ts` (snapshot saved / unavailable / exists
  / invalid; completion never blocked) and `outcomes.test.ts` (export: admin only, audit first,
  503 without audit, unavailable without tables).
- `scripts/src/outcomes-calibration.test.ts` (script: rows and exports; the PANE table is
  unchanged after proposing).
- iOS `AmiseMedFlowTests/OutcomeSnapshotTests.swift` and `OutcomeSyncTests.swift` (shared sanitiser
  vectors, server rows, role gate, back-off, retract-before-confirm order, 0-row retraction, pull merge;
  not run here: Swift cannot be compiled in this environment).
- `artifacts/dashboard/src/lib/__tests__/outcomes-sanitiser-vectors.test.ts` (the same vectors through
  the TypeScript sanitisers).

## Needs sign-off

1. **Governance defaults** (SURGEON-DECISIONS I2): retention indefinite, retract not delete;
   nurse/doctor/admin record; the report page for admin only; the export for admin only, internal
   use, no small-cell suppression yet.
2. **Minimum counts and shrinkage strength:** priors ≥ 10 cases, Dirichlet concentration 200,
   change of tier; likelihoods ≥ 20 cases, 20 pseudo-cases, change ≥ 0.10.
3. **Reminder:** 14 days after completion, only after an operation or pathology.
4. **Triggers:** what counts as "operation" (web: CPT code / procedure name / peri-operative
   procedure / Assessment procedures; iOS: procedural visit types or an operation date within 30
   days) and "pathology" (biopsy, histology, histopathology, cytology, FNA, core needle, frozen
   section).
5. **Triage mapping to one scale** (web urgent/priority/review; iOS emergency/urgent/priority →
   emergency/urgent/soon), and using the clinician's retrospective urgency as the reference
   standard.
6. **Match rule:** PANE id when both sides have one, else the ICD-10 3-character category. For
   example K80 (gallstones) does not match K81 (cholecystitis).
7. **Decision-band grading:** treat + done and observe / not-for-patient + not done agree; test
   bands are not graded.
8. **iOS push (now built):** iOS predictions and final diagnoses go to Supabase for nurse, doctor and
   admin accounts; a record confirmed and retracted before it was sent is stored on the server as
   retracted; the device's clock sets `confirmed_at` (the time the clinician confirmed it, possibly
   offline) where the web lets the database set it. Needs a device test once Migration 94 is applied
   (`docs/clinical-validation/changes/ios-outcomes-calculators.md`).

## Owner actions

- **Deploy day:** run the migration workflow so that Migration 94 is applied. It is independent
  of 87–93 and safe to apply on its own. Until then, snapshots are skipped and the screens say
  "available after the database update".
- Then complete one test encounter on the web and check `prediction_snapshots` has its row.
- Confirm or change the I2 defaults.

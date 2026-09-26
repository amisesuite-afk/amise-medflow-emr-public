# Change log — follow-ups to "history by complaint"

Source: the "Found but not changed" list in `history-by-complaint.md`. The owner approved "fix all
gaps found". The exam items (finding 6, the iOS exam chips) are left to the EXAM-step work and are not
touched here. Finding 7 (web lump templates that list pain sites) is not covered.

Nothing here changes a diagnosis engine's content: no `DiagnosticDatabase.json` weight, term or
candidate, and no pane-engine disease, prior or likelihood. What changes is how record text and chips
are **read**. Nothing has had a clinical review; every `lastReviewed` stays `unknown`.

## 1. A typed "cough" was read as "worse on coughing" (finding 4)

`ClinicalTextParser` added the exacerbating chip "Coughing" for any mention of "cough". The iOS engine
then read a patient with a cough as having pain made worse by coughing, and the reverse.

**Change.** A clause classifier, shared by both platforms, decides what each cough word records:

| Written | Kind | Parser adds |
|---|---|---|
| "cough for three weeks", "productive cough", "coughing up blood", "presents with cough and fever", "cough worsened over the week" | symptom | associations "Cough" |
| "pain worse on coughing", "aggravated by coughing", "made worse by coughing or sneezing", "pain on deep inspiration or coughing", "hurts when coughing", "coughing makes the pain worse", a chip read as "aggravating: Coughing" | aggravating factor | exacerbating "Coughing" |
| "cough impulse", "impulse on coughing", "cough tenderness" | examination sign | nothing |

Negation is applied as before ("no cough", "not worse on coughing" add nothing). Rules:
`lib/triage-engine/src/cough-mention.ts` (header), Swift twin `ios/AmiseMedFlow/Services/CoughMention.swift`,
33 shared vectors `ios/AmiseMedFlowTests/Resources/CoughMentionVectors.json` (run by
`CoughMentionTests.swift`, which also runs the parser over them, and by the dashboard test
`cough-mention.test.ts`).

**Web twin.** The PANE mapper's free-text cough rule (`socrates-to-features.ts` TEXT_RULES) had the same
problem in the HPI and transcript text ("pain worse on coughing" and "cough impulse" set the `cough`
feature). It now uses the same classifier (the history agent had fixed only the Aggravating chip).
PANE mapper version 1.0.2 → **1.0.3**.

## 2. Short database terms matched inside other words (finding 1)

`DiagnosticDatabase.json` finding terms are matched at a word start, so a 3–4 letter term fired inside a
longer word: "sti" in "still" / "stiffness", "stab" in "stabbing" and "stable", "burn" in "burning", "lip"
in "lipase", "gas" in "gastric", "rat" in "rate", "anal" in "analgesia", "foot" in "football", "boil" in
"boiling", "cool" in "cooled".

**Change.** `BayesianDiagnosisEngine+FeatureTerms.swift` (`termAffirmed` / `termOccurrences`, used by
the complaint, finding, findingAbsent and notFinding features): a term of four letters or digits or
fewer is matched as a whole word through `NegationMatcher`'s `wholeWord` (with a plural: "STIs",
"legs", "burns"). Terms the database writes as stems keep word-start matching (`FeatureTerm.stems`:
anxi, dizz, obes, ovar, shak, smok, worr, tars, numb, weak, itch, walk, leak, warm, fall, farm, pain).
Terms with a space or punctuation ("red ", "bp 2", "k+") are unchanged. The database is unchanged.

**Evidence** (iOS engine simulator, 441 vignettes, against the `ios-latest.jsonl` baseline, which the
simulator reproduces exactly):

| | pass → fail | fail → pass | fired candidate × feature changes |
|---|---|---|---|
| Short-term rule alone | 0 | 0 | +37 / −196 in 131 vignettes (5 features gain, 27 lose) |

Largest removals: the toxic-shock "burn" finding on "burning" pain (26), "sti" on "still"/"stiff"
(20 + 20 + 18), "stab" on "stabbing" (20 + 19), "gas" on "gastric" (16), "boil"/"pus" (8 + 6 + 6).
Additions are notFinding features that now correctly see the cardinal feature missing (e.g. "lip"
no longer found in "lipase": +30 on the anaphylaxis notFinding). The chip audit now uses the same
rule (it read "stab" in the lump "Stable" chip, which is now record only on iOS).

## 3. Chips fed the engine whatever question they were chosen under (findings 2 and 3)

- A "Coughing" chip chosen under "What makes it worse?" reached the cough findings.
- Early-form ("Quick Clinical Flags") chips stored under `exam`, `pmh`, `pshx`, `social` or `inv`
  (86 chips, e.g. "splenomegaly", "cirrhosis", "smok", "tsh suppressed") never reached the
  examination, history or result features they were written for: `score()` reads those features
  from the record fields only. The same held for history-frame risk chips stored under `history`.

**Change** (history-frames 1.0.0 → **1.1.0**, mapping only):

- `lib/triage-engine/src/history-frames/engine-dimensions.ts`, generated into `HistoryFrameData.swift`
  (`chipLabels`, `chipRecordFields`), read by `BayesianDiagnosisEngine+ChipDimensions.swift`.
- The finding features read each chip with its question: "aggravating: Coughing", "associated:
  Fever", "radiation: Back". A cough term then follows the classifier of section 1: the symptom term
  "cough" no longer fires on the manoeuvre, and the manoeuvre term "coughing" (as in
  "movement|twisting|lifting|strain|coughing") no longer fires on a cough. The labels were checked
  against every database term: only "radiat" matches a label, so a radiation chip "Back" now reaches
  "radiat&back" (it is the radiation of the pain), and a site chip "Back" does not.
- Chips under `exam`, `pmh`, `history`, `pshx`, `social`, `inv` are also read as that record field
  (history → past and social history). All 86 early-form chips now reach at least one of their
  features (simulated before the change: every one has a matching feature; none needed a new value).
- Stored answers are unchanged (keys and values as stored; the label is added when the engine reads
  them), so no aliases or migration are needed; the existing history-frame aliases still apply.
- `lint:history-frames` models both rules; the record-only table was regenerated: iOS record only
  561 → 563 (the six lump / breast "Stable" chips from section 2 leave the mapped list; radiation
  "Jaw" and "Arm" for neck and breast pain now reach the ACS radiation finding, and syncope risk
  "Antihypertensives" the "antihypertensive" PMH feature).

**Evidence** (simulator, 441 vignettes): 0 pass → fail, 0 fail → pass; +70 / −21 fired
candidate × features in 35 vignettes (cough findings no longer fire on "Coughing" as an aggravating
factor or on "cough impulse": −20; the respiratory notFinding features now fire for those patients:
+55; "radiat&back" from radiation chips: +12).

**All iOS engine changes together** (sections 1–3, parser ported into the simulator): 0 pass → fail,
0 fail → pass; +108 / −230 fired candidate × features in 164 of 441 vignettes.

## 4. The patient questionnaires asked hernia patients pain questions (finding 5)

The complaint's history-frames symptom type now chooses the question set (administrative intake,
plain wording, no advice; `lint:patient-instructions` passes):

- **iPad questionnaire** (`EncounterQuestionnaire`, `AdaptiveQuestionnaireSheet`). "Hernia / groin lump"
  was a pain type: SOCRATES ("What is it like?", "Does the pain spread?", worse / better).
  `CCCategory.questionSet` (HistoryFrameClassifier): pain → pain questions (abdominal pain, chest
  pain, perianal, as before); lump → a new "Lump or Swelling" step for hernia and neck lump:
  where, when first noticed, size change, painful or tender, red skin; hernia: "It goes back in when I
  lie down", "I can push it back in", "It gets bigger when I cough or strain", "It does not go back
  in", "It used to go back in but now it does not"; neck: "Does it move up and down when you
  swallow?". Answers are stored as lump-frame chips (Days / Weeks …, Slow growth, Painless / Tender,
  Reducible, Cough impulse, Irreducible, Recently irreducible, Moves on swallowing, Redness) and read
  back into the clinician's history by `parseSocratesFromHPI`. Other complaints are unchanged.
- **Web patient intake** (`artifacts/front-desk/app/patient/intake`). A hernia or lump was asked
  "How severe is your discomfort?". `lib/intake-question-set.ts` classifies the complaint and location;
  a lump gets "Has the lump got bigger…?", "Is the lump painful or tender to touch?", "Is the skin over
  the lump red or hot?", a neck lump "Does the lump move up and down when you swallow?", and a hernia
  or groin lump "Can you push it back in, or does it go away when you lie down?", "Does it get bigger
  when you cough, strain or stand up?" and the existing "stuck" question.
- **APCQ** (`lib/triage-engine/src/apcq.ts`). "Lump or mass" was given the breast questions ("How long
  have you noticed the breast lump or change?", nipple discharge, mammogram, hormones).
  `complaintSymptomType()` queues lump questions (location, how long, change, tender, skin); groin,
  belly button or scar adds the existing hernia question, breast adds the breast questions.
  `detectSpecialty` is unchanged ("Lump or mass" still routes to breast surgery; see follow-ups).

## 5. iPad front-desk scheduler

**(a) Calendar errors.** `AppointmentSchedulerView` stored a calendar error in `savedError` and never
showed it; with calendar access denied, Save did nothing and the visit type was not saved. Now the
booking is saved to the patient's record first (`ApptType.applyBooking`: visit type; booking type
unless the record holds a more specific label such as a calendar import's "Colonoscopy"; for a
procedure or endoscopy the setting and date, as before), then the calendar is written. A failure
shows "Calendar Not Updated" with the error ("Calendar access denied — enable in Settings → Privacy
& Security → Calendars."), a line that the record was saved, **Retry Calendar** and **Done Without
Calendar** (reminders and email / SMS / questionnaire follow as usual). Tests:
`SchedulerRecordSaveTests.swift`.

**(b) `appointment_type`.** Not only missing from the front-desk allow-list: `patients` has no
`appointment_type` column (only `appointments` and `appointment_requests` do), and the iOS patient
push never sent it, so the booking type stayed on the device for every role. Now:

- Migration 97 `supabase-patients-appointment-type-migration.sql` adds `patients.appointment_type`
  (guarded, idempotent), wired in `run-migrations.yml`, listed in `docs/sql/check-ios-columns.sql`
  and `migrations/README.md`.
- Migration 89's front-desk allow-list (`supabase-staff-only-rls-migration.sql`) and iOS
  `FrontDeskPatientColumns` list `appointment_type` (administrative field).
- iOS syncs it in its own requests (`SyncService+AppointmentType.swift`, like pathway data and the
  NEWS2 Scale 2 flag): until Migration 97 runs they fail and are retried; the whole-row patient push
  and pull are unaffected. A local change not yet pushed wins (`appointmentTypeSyncedValue`); a
  42501 is recorded in `SyncRefusals` (`.appointmentType`).
- `check:migrations-fresh` (99 steps), `lint:rls-policies`, `lint:grants` pass. CLAUDE.md and the
  ios-arch skill mention the column.

## Checks

- `pnpm run typecheck`; `pnpm -r run test`: pane-engine 236, scripts 121, front-desk 112,
  api-server 653, dashboard 1,022 — all pass.
- Lints: `lint:grants`, `lint:rls-policies`, `check:migrations-fresh`, `lint:dx-phases`,
  `lint:patient-instructions`, `scan:nav-lockout`, `lint:no-external-qr`, `lint:interaction-parity`,
  `lint:report-import-parity`, `lint:reference-range-parity`, `lint:shared-content`,
  `lint:guideline-registry`, `lint:signoff-catalogue`, `lint:history-frames` — all pass.
- Dashboard and front-desk builds pass. `e2e/emr-walkthrough.mjs` 30 pass; `e2e/encounter-switch.mjs`
  11 pass.
- `clinval:web`: 3,164 expectations, 0 blocking, 0 critical, 2,992 pass — identical to before, no
  expectation changed status (results files restored).
- Swift is not compiled here. New tests for CI (`ios-build-check.yml`): `CoughMentionTests`,
  `FeatureTermMatchingTests`, `ChipDimensionsTests`, `QuestionnaireQuestionSetTests`,
  `SchedulerRecordSaveTests`. The iOS vignette evidence above is from the TypeScript simulator of
  `BayesianDiagnosisEngine`, not the device.

## Needs sign-off

1. The cough classifier's clause rules and vectors (what counts as the symptom, the factor, the sign).
2. The short-term rule and the stem list (which 4-letter terms keep prefix matching). "fit" is not a
   stem, so "fitting" no longer matches the pre-eclampsia "fit" term (the seizure features list
   "fitting" themselves).
3. Reading early-form and parser chips under `exam` / `pmh` / `inv` as record findings, and history
   risk chips as past and social history.
4. The patient lump questions (wording and which answers are stored as which chip), including that
   "It gets bigger when I cough or strain" is stored as "Cough impulse".
5. The APCQ lump question set and its location follow-ups.

## Follow-ups (not done)

- APCQ `detectSpecialty` still sends "Lump or mass" to breast surgery; the lump location could decide.
- `BayesianDecisionEngine+Scoring.swift` is an unused copy of the diagnosis engine's scoring (its
  `score()` has no caller); it was not changed. Remove it or keep it in step.
- The iOS routing keyword match (`ccToSystems`, presentations) is not a feature-term matcher and was
  not changed.
- The iOS exam chips (finding 6) belong to the EXAM-step work.

# Change log — `followups-prep-h10` (printed prep sheet H-10, pathway-data refusals, iPad lifestyle questions)

Owner-authorised "fix all gaps found", 2026-09-25. Three follow-ups found by earlier agents.
Branch `followups-prep-h10` (from `claude/pr-37-gbg22z` at `e3482c8`), not pushed.

| Commit | Change |
|---|---|
| `daa36c1` | Dashboard printed prep sheet and procedure leaflet use the approved H-10 wording |
| `a7aae9e` | `lint:patient-instructions` rule 8: the dashboard printouts |
| `d13464a` | Supplement and lifestyle cards read-only for front desk; outbox drops 42501 refusals |
| `2ae6761` | iOS front-desk iPad questionnaire asks the lifestyle questions |

## 1. Printed patient prep sheet and procedure leaflet (hazard H-10, no fast from midnight)

`PatientPrepCard` (Plan → "Patient Preparation Instructions", printed or saved as Word and handed
to the patient) told patients to stop, hold, reduce or take prescribed medicines and to take
nothing by mouth from midnight. A search of every dashboard component that prints patient text
(`window.open` / `downloadAsWord` / "leaflet" / "Patient information" / "instructions") found one
more: the `SurgicalConsentTab` "Patient information" leaflet (`printPatientLeaflet`, and the same
text on screen under "Pre-operative preparation instructions"). The other printouts (endoscopy
reports, letters, surveillance, education handouts, post-op plans) had no medicine instruction or
midnight wording; the staff checklists that say "NBM" or "anticoagulant held" are not given to
patients.

Both now use the approved sentences of `artifacts/front-desk/lib/instructions.ts` and
`artifacts/api-server/src/lib/sms.ts`, word for word:

| Constant (`artifacts/dashboard/src/lib/patient-prep-sheet.ts`) | Text | Same as |
|---|---|---|
| `PREP_MEDICATIONS_CALL` | MEDICATIONS: If you take insulin, blood thinners or diabetes medicines, please call the clinic before your procedure for instructions. If you have any questions about your other medicines, please call us. | `MEDICATIONS_CALL` / `PREP_MEDICATIONS` |
| `PREP_FASTING_STANDARD` | Nothing to eat for 6 hours and nothing to drink for 2 hours before your appointment time (clear fluids such as water are fine until then). | `FASTING_STANDARD` |
| `PREP_COLONOSCOPY_DAY_OF` | On the day of your procedure: finish your bowel prep as directed. Clear fluids only, then nothing to drink for 2 hours before your appointment time. | instructions.ts `colonoscopy` |
| `PREP_COLONOSCOPY_CLEAR_FLUIDS` | Clear fluids only, then nothing to drink for 2 hours before your appointment time. | the second sentence of the line above |
| `PREP_MINOR_NO_FASTING`, `PREP_MINOR_GA_SEPARATE` | No fasting is needed. Please eat a light meal before your appointment. / If you have been told you will have a general anaesthetic, the clinic will give you separate instructions. | instructions.ts `minor_procedure` |

The verbatim herbal paragraph (`HERBAL_PREOP_PATIENT_TEXT`, SURGEON-DECISIONS.md I1) is kept,
unchanged, on every sheet.

How it works now:

- The sheet's content and HTML moved from the component to `lib/patient-prep-sheet.ts`
  (relative imports only), so the lint and a unit test render it.
- The per-medicine table ("Your Medication Instructions": STOP / HOLD / REDUCE / CONTINUE / TAKE
  per drug) is gone. Every sheet has a "Your Medicines" section with `PREP_MEDICATIONS_CALL`.
  Herbal products recorded in the medicines list or the herbs / supplements history (the same
  matcher as before; valerian deliberately not matched) are listed as a pointer:
  "Herbal products recorded at your visit: garlic tablets. Please read "Herbal remedies, bush teas
  and supplements" below." (new wording, no instruction; see sign-off).
- Patient-entered fields (name, DOB, procedure, allergies) are now HTML-escaped on the sheet.

### Tests and lint

- `lint:patient-instructions` rule 8 (`scripts/src/lint-patient-instructions.ts`): renders the
  sheet for both colonoscopy regimens and pre-op (with a medicine list of every class the old
  sheet instructed on: warfarin, aspirin, clopidogrel, apixaban, insulin, metformin, amlodipine,
  ibuprofen, ferrous sulphate, levothyroxine, omeprazole, multivitamin, plus garlic, turmeric and
  valerian) and fails on: any sentence pairing a medicine word (tablets, medication, blood
  pressure, iron, NSAIDs, named drugs …) with take / hold / stop / reduce / continue / restart /
  avoid / skip / withhold; any "midnight"; any named prescribed medicine outside the approved
  sentences; a missing approved medicines, fasting or herbal sentence; an approved constant that
  differs from `instructions.ts` / `sms.ts`. It also scans the `PatientPrepCard` source (on-screen
  preview) and every `SurgicalConsentTab` leaflet `prep` block, and all three files were added to
  its rule-1/midnight source list. Self-tests include the old wording. Run against the old files,
  it fails with 78 problems.
- `artifacts/dashboard/src/lib/__tests__/patient-prep-sheet.test.ts` (6 tests).
- Registry: the three files are under `front-desk-patient-instructions`.

## 2. Supplement and lifestyle cards under Migration 89

Under Migration 89, `patients.pathway_data_json` is clinician-only (the front-desk column guard
raises 42501). A front-desk save of the web supplement or lifestyle card would be refused, and the
offline outbox would retry it forever.

- **Read-only for front desk.** `SupplementHistoryCard` and `LifestyleHistoryCard` take the role
  from `useAuth().profile` and, for `front_desk` (or no role), show "Recorded by nurse or doctor"
  and disable every control (`roles.ts` `canRecordPathwayData`, `PATHWAY_DATA_READ_ONLY_NOTE`).
- **Refusals are permanent.** `saveSupplementHistory` / `saveLifestyleHistory` return
  `refused: true` for a permission refusal (`isPermissionRefusal`: code 42501, "permission denied",
  "row-level security", the guard's "may only change"). Their outbox executors throw
  `OutboxRefusalError`; `flush()` drops the entry, logs `entity_type:entity_id … refused by the
  server (permission) — dropped, not retried` (no payload), and notifies the refusal listeners.
  `trackedSave()` never queues such a refusal (`isPermanentRefusal`, limited to the `supplements`
  and `lifestyle_history` entity types) and reports it the same way. A network or other error
  still retries with back-off. Same idea as iOS `SyncService+Refusals.swift`.
- **Notice.** `SyncStatusIndicator` (header) shows one dismissible line: "Not saved: herbs, teas &
  supplements history — recorded by nurse or doctor (your role cannot change it)." (or "fasting,
  therapies & sleep history").
- The outbox storage is injectable (`__setOutboxStoreForTests`) so `flush()` is tested end to end.
- Tests: `artifacts/dashboard/src/lib/__tests__/outbox-refusal.test.ts` (12): the refusal
  classifier, the save helpers against a stand-in Supabase returning Migration 89's 42501, flush
  dropping supplements and lifestyle entries once with a notice, a network error still retried,
  a successful save drained, the role rule and the cards' source.

Note: today the web routes a `front_desk` profile to `ReceptionistView`, which does not show these
cards, so the path is mainly defence in depth (a role change mid-session, future routing, or
entries queued before this change, which now drain instead of retrying).

## 3. iOS front-desk iPad questionnaire: lifestyle questions

`AdaptiveQuestionnaireSheet` did not ask the web intake's lifestyle questions.

- `ios/AmiseMedFlow/Services/LifestyleQuestions.swift` (new) is the Swift twin of
  `lib/triage-engine/src/lifestyle-questions.ts`: the same question text, help text, option values
  and labels, the timing follow-up (asked once any fast other than "No" is chosen), "No" exclusive,
  and the same "(patient-reported)" line prefixes.
  `artifacts/dashboard/src/lib/__tests__/lifestyle-questions-ios-parity.test.ts` parses the Swift
  file and fails when any of these differ, or when the questions stop being last.
- **Always last, never displacing a clinical question.** They are the last two sections of the
  last step (Social history → Last Meal → Fasting → Traditional or complementary treatments). The
  iPad questionnaire has no question cap, so nothing is pushed out. Like the web templates (asked
  for new consultations, screening, pre-op, second opinion), they are not asked when the complaint
  is "Post-operative review" or the booked visit is a follow-up or post-op review.
- **The supplements question** was already on the Medical History step (supplements agent); not
  duplicated.
- **Where the answers go — the same as the web.** The web does not copy the answers into the
  structured record: the dashboard shows them as "Fasting (patient-reported): …" social-history
  lines (`lifestyleQuestionnaireLine`), and the clinician records the structured fields. The iPad
  now writes the same lines (identical wording; "No" gives no line) at the end of
  `EncounterAnswers.pmhxText`, i.e. `Patient.pmhNotes` (a front-desk column under Migration 89)
  and the pre-visit note. It does not write `PathwayData.lifestyle` directly: that is
  `pathway_data_json`, clinician-only under Migration 89, so a front-desk push would be refused
  (and show "N changes not permitted for your role" after every questionnaire).
  Instead, the clinician's Social tab (`LifestyleHistorySection`) shows the patient's answers and a
  **"Record the patient's answers"** button that maps them into `PathwayData.lifestyle`
  (`LifestyleQuestionnaireAnswers.filling`): fasting values map one to one (the option values are
  the record's raw values), "Fasting now" → currently fasting, "within the next month" / "later" →
  fast planned (the former also sets "When" to "Within the next month"), "Not sure" → status not
  recorded, therapies map one to one, "No" therapies records nothing. It fills only fields not
  recorded yet; a clinician-recorded field is never changed. This is the same pattern as the
  supplements question (`patientReportedSupplements` → "Add as a recorded entry").
- Swift could not be compiled here. Every call was symbol-checked against the repo
  (`QCheckboxGrid(label:options:rawSelection:)`, `LifestyleHistory.Fasting/FastStatus/Therapy`,
  `recordsFasting`, `Patient.visitType`, `livePatient`, `scaledFont`), new type names were grepped
  first (no clashes), and no `Color.opacity` is used.
- Tests: `ios/AmiseMedFlowTests/LifestyleQuestionsTests.swift` (4; run in the iOS CI job).
- Registry (`lifestyle-practices`): new files and tests, changelog entry; no rule or wording change,
  version unchanged. `lifestyle-practices.md` updated (it said the iPad was not changed).

## Checks

- `pnpm run typecheck`: clean.
- `pnpm -r run test`: pane-engine 126, scripts 35, front-desk 109, dashboard 695 (38 files),
  api-server 588 — all pass.
- Scripts lints: `lint:grants`, `lint:rls-policies`, `check:migrations-fresh`, `lint:dx-phases`,
  `lint:patient-instructions`, `scan:nav-lockout`, `lint:no-external-qr`,
  `lint:interaction-parity`, `lint:report-import-parity`, `lint:guideline-registry`: all pass (the
  registry lint's usual review-status warnings only).
- Dashboard and front-desk builds: pass.
- `clinval:web`: 397 vignettes, 2871 pass, 5 critical (known gaps), **0 blocking** — unchanged.
  Results files restored, not committed.

## Needs sign-off

The direction is the surgeon's decision (hazard H-10: no take / hold / stop wording for prescribed
medicines; no fast from midnight), so the change is made. Please confirm the wording.

### A. Printed prep sheet (`PatientPrepCard` → `lib/patient-prep-sheet.ts`)

| # | Before | After |
|---|---|---|
| A1 | Colonoscopy, evening regimen, 8 pm: "Continue clear fluids until midnight — then NOTHING by mouth" | "Continue drinking clear fluids through the evening" |
| A2 | Evening regimen, heading "Morning of procedure — NOTHING by mouth": "No food or drink of any kind" | Heading "Morning of procedure": "Clear fluids only, then nothing to drink for 2 hours before your appointment time." (approved colonoscopy sentence) |
| A3 | Evening regimen, morning: "If you are on blood pressure medication: take your tablets at 7:00 am with a small sip of water ONLY — do not eat or drink anything else" | Removed; covered by the approved MEDICATIONS line |
| A4 | Evening regimen, 4 pm: "Continue drinking clear fluids throughout the afternoon" | Unchanged |
| A5 | Split regimen, 8 pm: "Continue clear fluids until midnight — then nothing by mouth until morning" | "Continue drinking clear fluids through the evening" |
| A6 | Split regimen, morning: "STOP ALL FLUIDS 2 hours before your scheduled appointment time" | "Clear fluids only, then nothing to drink for 2 hours before your appointment time." |
| A7 | Split regimen step "Blood pressure medication": "If hypertensive: take your BP tablets at 7:00 am with a small sip of water only" | Step removed; covered by the MEDICATIONS line |
| A8 | Pre-op fasting table, "Solid food and milk": "Nothing to eat or drink from midnight the night before" | Row "Food and drink": "Nothing to eat for 6 hours and nothing to drink for 2 hours before your appointment time (clear fluids such as water are fine until then)." |
| A9 | Pre-op table, "Clear fluids": "Stop 2 hours before your scheduled time" + examples | Examples only ("Water, black tea/coffee, apple juice without pulp, clear broth only"); the 2 h rule is in A8 |
| A10 | Pre-op table, "Blood pressure tablets": "Take at 7:00 am with a small sip of water only" | Row removed; covered by the MEDICATIONS line |
| A11 | Pre-op heading "Fasting (NBM) Instructions" | "Fasting Instructions" |
| A12 | On-screen pre-op box: "NBM from midnight — no food or drink from midnight the night before. Clear fluids stop 2 hours before. Blood pressure medication at 7:00 am with a sip of water only." | "Fasting: Nothing to eat for 6 hours and nothing to drink for 2 hours before your appointment time (clear fluids such as water are fine until then)." |
| A13 | "Your Medication Instructions" table, per recorded drug: warfarin "STOP 5 days before your procedure. Your surgeon will advise on bridging if needed."; rivaroxaban/apixaban/dabigatran/edoxaban "STOP 48–72 hours before (or as directed by your surgeon)."; clopidogrel/ticagrelor/prasugrel "STOP 5 days before. If on a coronary stent, discuss with your surgeon first."; aspirin "STOP 5 days before your procedure (blood thinner — increases polypectomy bleeding risk)."; iron "STOP 3 days before — iron interferes with bowel preparation quality."; vitamins / supplements "STOP 3 days before your procedure."; metformin "HOLD on the day of preparation and day of procedure — restart once eating normally."; insulin "REDUCE dose while fasting — do not take usual insulin dose when not eating. Surgeon will advise."; NSAIDs "HOLD on the day of procedure — increases bleeding risk."; blood pressure drugs "CONTINUE — take at 7:00 am on the morning of your procedure with a small sip of water only."; PPIs "CONTINUE as usual."; levothyroxine "TAKE as usual with a small sip of water — do not skip." | Table removed. "Your Medicines" section on every sheet: "MEDICATIONS: If you take insulin, blood thinners or diabetes medicines, please call the clinic before your procedure for instructions. If you have any questions about your other medicines, please call us." |
| A14 | Herbal products in the table: "Herbal remedy: please stop it 2 weeks before your procedure — see "Herbal remedies, bush teas and supplements" below." | "Herbal products recorded at your visit: <names>. Please read "Herbal remedies, bush teas and supplements" below." (new wording, no instruction; the approved paragraph itself is unchanged) |
| A15 | Colonoscopy "Additional Important Instructions": "Blood thinners: stop aspirin, warfarin, plavix 5 days before." | Removed; covered by the MEDICATIONS line |
| A16 | Same list: "Vitamins and iron tablets / supplements: stop 3 days before your procedure." | Removed. Herbal products and supplements are covered by the approved herbal paragraph (2 weeks); iron and vitamins now have no patient text (see open point 1) |
| A17 | Same list: "Blood pressure medication: if you are hypertensive, take your medication at 7:00 am on the morning of your procedure with a small sip of water." | Removed; covered by the MEDICATIONS line |
| A18 | Colonoscopy note box "&#128Shopping: Before you start —" (broken character) | "Before you start —" |

### B. Procedure leaflet (`SurgicalConsentTab` → "Patient information", printed; same text on screen)

| # | Template | Before | After |
|---|---|---|---|
| B1 | Lap. cholecystectomy — Fasting | No solid food or milk from midnight. Clear fluids (water, black tea, black coffee) permitted until 2 hours before surgery. | `PREP_FASTING_STANDARD` |
| B2 | Lap. cholecystectomy — Medications | Continue all regular medications with a sip of water on the morning of surgery unless specifically advised otherwise. Hold anticoagulants as directed. | `PREP_MEDICATIONS_CALL` |
| B3 | Appendicectomy — Fasting | Emergency surgery: fast from the time of decision. Elective: no food or milk from midnight; clear fluids until 2 hours before. | Emergency surgery: fast from the time of decision. Planned surgery: `PREP_FASTING_STANDARD` (emergency wording kept: still open in I1) |
| B4 | Appendicectomy — Medications | Continue regular medications unless directed otherwise. IV antibiotics will be given at induction. | `PREP_MEDICATIONS_CALL` IV antibiotics will be given at induction. |
| B5 | Inguinal hernia — Fasting | No solid food or milk from midnight. Clear fluids until 2 hours before. | `PREP_FASTING_STANDARD` |
| B6 | Inguinal hernia — Medications | Continue all regular medications. Hold anticoagulants as per anaesthetic team's instructions. | `PREP_MEDICATIONS_CALL` |
| B7 | Colonoscopy — Fasting | Low-residue diet for 2 days before. Clear fluids only on the day before. No solid food from midnight before the procedure. | Low-residue diet for 2 days before. Clear fluids only on the day before. `PREP_COLONOSCOPY_DAY_OF` |
| B8 | Colonoscopy — Medications | Hold iron supplements for 7 days. Hold anticoagulants and antiplatelet agents as instructed. Continue blood pressure and heart medications with a sip of water. Diabetic patients: contact clinic for specific insulin/oral hypoglycaemic adjustment. | `PREP_MEDICATIONS_CALL` |
| B9 | Colonoscopy — On the day | "Nothing to eat or drink after completing prep (except small sip of water for tablets)." | Removed (fasting is in B7) |
| B10 | Colonoscopy — Recovery | …If polyps were removed, avoid blood-thinning medications for 5–7 days unless directed otherwise. | …If you take blood thinners and polyps were removed, please call the clinic for instructions. (new sentence in the approved call-the-clinic style) |
| B11 | ERCP — Fasting | No solid food or milk for 6 hours before. Clear fluids permitted until 2 hours before the procedure. | `PREP_FASTING_STANDARD` |
| B12 | ERCP — Medications | Hold anticoagulants and antiplatelet agents as instructed. Continue blood pressure, heart, and thyroid medications with a sip of water. Do not take metformin on the day of the procedure. | `PREP_MEDICATIONS_CALL` |
| B13 | ERCP — On the day | "Nothing to eat or drink from midnight (or as instructed)." | Removed (fasting is in B11) |
| B14 | OGD — Fasting | No solid food or milk for 6 hours. Clear fluids permitted until 2 hours before the procedure. | `PREP_FASTING_STANDARD` |
| B15 | OGD — Medications | Hold iron supplements for 5 days (they darken the stomach lining). Continue all other regular medications with a sip of water. If you take anticoagulants, contact clinic for instructions. | `PREP_MEDICATIONS_CALL` |
| B16 | OGD — On the day | "Nothing to eat or drink from midnight (or as instructed for afternoon procedures: fast from 7am)." | Removed (fasting is in B14) |
| B17 | Thyroidectomy — Fasting | No solid food or milk from midnight. Clear fluids until 2 hours before. | `PREP_FASTING_STANDARD` |
| B18 | Thyroidectomy — Medications | Continue anti-thyroid medications (carbimazole/propylthiouracil) until the day of surgery. Continue beta-blockers if prescribed. Contact the clinic about anticoagulants. | `PREP_MEDICATIONS_CALL` |
| B19 | Mastectomy — Fasting | No solid food or milk from midnight. Clear fluids until 2 hours before. | `PREP_FASTING_STANDARD` |
| B20 | Mastectomy — Medications | Continue all regular medications. Discuss anticoagulants with the anaesthetic team. Do not apply deodorant or lotions to the chest or underarm on the morning of surgery. | `PREP_MEDICATIONS_CALL` (the deodorant line is already in "On the day") |
| B21 | Wide local excision — Fasting | Not required for local anaesthesia only. If sedation planned: no food or milk for 6 hours. | `PREP_MINOR_NO_FASTING` `PREP_MINOR_GA_SEPARATE` |
| B22 | Wide local excision — Medications | Continue all regular medications. Inform the surgeon if you are on aspirin, warfarin, or other blood thinners. | `PREP_MEDICATIONS_CALL` |
| B23 | Anterior resection — Fasting | Enhanced Recovery After Surgery (ERAS) protocol: carbohydrate drink until 2 hours before surgery. No solid food from midnight. | `PREP_FASTING_STANDARD` Enhanced Recovery After Surgery (ERAS) protocol: carbohydrate drink until 2 hours before surgery. |
| B24 | Anterior resection — Medications | Continue all regular medications with a sip of water. Hold anticoagulants as instructed. DVT prophylaxis (injections and compression stockings) will start before or shortly after surgery. | `PREP_MEDICATIONS_CALL` DVT prophylaxis (injections and compression stockings) will start before or shortly after surgery. |

Allowed by the lint after review: the thyroidectomy leaflet sentence "If your whole thyroid is
removed, you will need to take a daily thyroid hormone tablet (thyroxine) for the rest of your
life." (post-operative information about a new prescription, not a pre-procedure hold / stop;
the front-desk thyroid-surgery after-care says the same). Please confirm.

### C. iPad questionnaire (item 3)

- C1. The questions, options and help text are the web's, unchanged (already listed for sign-off
  in `lifestyle-practices.md` item 8).
- C2. Not asked for a post-operative-review complaint or a follow-up / post-op visit (web parity).
- C3. "Record the patient's answers" mapping (clinician tap, fills unrecorded fields only): "Fasting
  now" → currently fasting; "within the next month" → fast planned, When "Within the next month";
  "later" → fast planned; "Not sure" → not recorded. The web has no such button yet (see Not done).

### Open points noticed (not changed)

1. **Iron and vitamins before colonoscopy / OGD.** The old sheet and leaflet told patients to stop
   iron 3–7 days before (it darkens the bowel / stomach lining). H-10's direction removes it;
   iron now has no patient text. If the surgeon wants an approved iron line, it needs his wording
   (and vitamin E / fish oil are still open in I1).
2. **Thyroid medicines before thyroidectomy** (continue carbimazole / propylthiouracil and beta-
   blockers): now only the call-the-clinic line. Staff should make sure these patients are
   told individually.
3. **ERCP leaflet says sedation.** `SurgicalConsentTab` ERCP: "Anaesthesia: Sedation", "Arrange a
   driver — you cannot drive after sedation", and the leaflet paragraph "performed under
   sedation". Dr Kabiye decided ERCP is done under general anaesthesia at Tapion (instructions.ts,
   sms.ts). Not changed here (consent content); needs his wording.
4. **Pre-op sheet "Do NOT have milk or juice"** row says juice is not a clear fluid while the
   clear-fluids row lists apple juice without pulp. Unchanged; wording for the surgeon.
5. **Emergency-surgery fasting** ("fast from the time of decision", appendicectomy leaflet) kept:
   emergency wording is still open in I1.

## Not done

- The web dashboard does not offer "record the patient's answers" for the web intake's lifestyle
  answers (they stay as "(patient-reported)" lines); the iPad now has the button. Adding it to
  `LifestyleHistoryCard` would need the intake answers loaded for the open patient.
- iOS was not compiled or run here (no Swift toolchain); CI's iOS job runs
  `LifestyleQuestionsTests`.
- Nothing pushed.

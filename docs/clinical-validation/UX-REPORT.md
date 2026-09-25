# Usability review — consultation flow (iOS and web)

Prepared for Dr Dawit Kabiye as part of consultation testing. Review date 25 September 2026.
Branch `ux-review`, based on `claude/pr-37-gbg22z` at `60e2b15`.

> **Status (branch `ux-seamless`, on top of `ux-safety-fixes`).** C1–C4 and M8 were fixed on the
> web and M1–M3 on iOS in `ux-safety-fixes`. `ux-seamless` fixes the rest of the top 10 and most
> of the remaining findings, so the parts of the consultation reach each other without leaving
> it (table below). The web screenshots in `docs/clinical-validation/ux/web/` were re-taken
> after these changes (the Tools menu and Scores panel are steps 26–29, so the numbering changed
> again after step 25). The `D/nn` and `P/nn` references below point to the original set, which
> is in git history at commit `ad11177`. Encounters saved before the fixes keep any content that
> was filled automatically; it is not rewritten. Swift cannot be compiled here: the iOS changes
> are checked by the CI build, the unit tests (`ConsultationSeamlessTests`) and the UI walkthrough.
>
> | # | Finding | Web | iOS |
> |---|---|---|---|
> | C1–C4 | Auto-content, NKDA | ✓ fixed (`ux-safety-fixes`) | n/a |
> | M1, M2 | Identity, NKDA banner | n/a | ✓ fixed (`ux-safety-fixes`) |
> | M3 | Header safety strip | n/a | ✓ fixed: NEWS2 with band colour and age, every allergy (not only severe), antithrombotic by name, footnote size or larger, on the iPad header and under the iPhone record's title (`RecordSafetyStrip`) |
> | M4 | iPad: two navigation systems, two Save Visit | n/a | ✓ fixed: one "Consultation" section-bar entry (the 11 step items are gone; Overview links still open a step), the pathway step bar is the only step navigation; header "Save Visit" removed; "Save snapshot" and "Complete" labelled and explained on screen |
> | M5 / top-10 #10 | Scores, Vitals, Rx outside the consultation | ✓ fixed: Tools menu in every navigation mode opens Scores, Vitals, Prescriptions (and Notes, Tasks) in a side panel over the step; Scores is also a step in the pathway bar | ✓ fixed: Tools in the consultation toolbar (and in More) opens Clinical Scores, Vitals, Prescriptions as a sheet over the step, patient identity and safety strip on it |
> | M6 | Three navigation layers, 17 pills, Scores disappears | ✓ fixed: one bar — phase as group labels inside it (✓ only when every step in it is documented), actions in its header; 15 pills (Notes, Monitor, Tasks moved to Tools, Scores added); 44 px targets on touch; "+N ›" overflow cue | n/a |
> | M7 | Web start-up friction | open | n/a |
> | M8 | Completion without sign-off | ✓ fixed (`ux-safety-fixes`) | ✓ fixed: "Review and complete" sheet — steps not documented, allergy status, unedited template / questionnaire content, diagnosis and orders, attestation; "Complete visit" only after the tick |
> | M9 | Walk-in disappears from Today | n/a | ✓ fixed: "Added today" group |
> | M10 | "AI Draft" buttons | n/a | ✓ relabelled "Draft from template" while AI is off; the exam template no longer says "Afebrile"; unedited template text is flagged at completion. The first-launch AI disclosure is unchanged (open) |
> | M11 | Next hidden while typing; fields below chip walls | n/a | ◐ keyboard toolbar "Next: <step>"; ICD-10 search first on the Diagnosis step. HPI editor still below the SOCRATES chips |
> | M12 | Duplicated question card, overlapping plan | ✓ fixed: each HPI question asked once (Adaptive HPI card); the printed plan leaves out lines that repeat an investigation requested above | n/a |
> | m1 | iPhone Delete in the Close position | n/a | ✓ in a More menu |
> | m2 | Fixed 9–10 pt type | n/a | ✓ section-bar, quick-action and chip labels use text styles |
> | m3 | iPhone front-desk questionnaire | n/a | ✓ "Questionnaire" action on each Check-In row |
> | m4–m10 | Web minors | m5 fixed (solid sticky bar); others open | n/a |

## 1. Scope and method

**What was reviewed.** The surgeon's core outpatient task, a first-visit surgical consultation:
find the patient, take the history (CC, HPI, PMH, PSHx, medicines, allergies, social),
examine, investigate, diagnose, plan, compute a score, then save and complete the visit.
Supporting tasks: add a patient, record vitals, prescribe with an interaction check, and the
front-desk hand-over questionnaire.

**How.**

| Platform | Evidence | How it was produced |
|---|---|---|
| Web dashboard | 28 screenshots per viewport, measured clicks | `e2e/ux-walkthrough.mjs`, run in this sandbox on desktop 1440×900 and iPad 1024×1366. Supabase and API mocked with synthetic data. Output in `docs/clinical-validation/ux/web/` |
| iOS app | Source code (file:line); the CI walkthrough adds screenshots and measured taps | XCUITest walkthrough `ios/AmiseMedFlowUITests` in the DEBUG-only demo mode (`-UITestDemoMode`). Runs in `.github/workflows/ios-ui-walkthrough.yml` on an iPhone 16 Pro Max and an iPad Pro 13″. Swift cannot be compiled or run here, so no iOS screenshots are committed yet |

**Criteria.**

- Nielsen's 10 heuristics. H1 visibility of status, H2 match with the real world, H3 user control, H4 consistency, H5 error prevention, H6 recognition over recall, H7 flexibility and efficiency, H8 minimalist design, H9 error recovery, H10 help.
- NISTIR 7804 (EHR usability protocol) and NISTIR 7741 (EHR user-centred design). Focus areas: information density, visibility of safety-critical information (allergies, NEWS2, red flags), error prevention, and wrong-patient prevention.
- Engineering gate items 2 (cognitive load) and 3 (clicks and documentation time) from `CLAUDE.md`.

**Severity.**

- **Critical:** can put wrong or unverified clinical content into the record, or hide safety information. Fix before clinical use.
- **Major:** measurable cost in time or errors, or a safety weakness with a workaround. Fix soon.
- **Minor:** friction or polish.

**How to reproduce.**

```bash
# Web (any machine with the repo): dev server with the CI placeholder env, then
VITE_SUPABASE_URL=https://placeholder.supabase.co \
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-payload-not-a-real-anon-key.placeholder-signature-not-a-real-anon-key \
pnpm --filter @workspace/dashboard run dev
pnpm run ux:web                       # UX_BASE_URL=http://localhost:<port> if not 3000

# iOS (a Mac with Xcode 16+ and XcodeGen)
ios/UIWalkthrough/run.sh all          # or: iphone | ipad
# CI: Actions → "iOS — UI Walkthrough" → Run workflow (also runs on pushes to claude/** touching ios/**)
#     artifacts: ux-walkthrough-iphone, ux-walkthrough-ipad (screenshots + metrics), ux-metrics (combined)
```

## 2. Top 10 findings

| # | Sev. | Platform | Finding | Proposed change (short) |
|---|---|---|---|---|
| 1 | Critical | Web | **"NKDA" is shown, and printed in the note, when allergies were never asked.** | Show "Allergies not recorded" (amber) until the clinician records allergies or NKDA |
| 2 | Critical | Web | **The examination is pre-filled as normal on first open.** Unexamined systems, including a *wound* the patient does not have, appear as findings in the clinical note | Never auto-insert findings. "All normal" stays a deliberate, per-system action |
| 3 | Critical | Web | **Choosing a chief complaint silently fills "ordered" investigations.** The note lists 14 "Investigations ordered" the clinician never ordered | Offer them as suggestions, ticked one by one; only ticked items are ordered |
| 4 | Critical | Web | **The working diagnosis is auto-set and locked (primary ICD K81.0) from one exam sign.** It then drives an inpatient plan | Show it as a suggestion with Accept; nothing enters the record until accepted |
| 5 | Major | iOS | **No patient identity on the consultation screens.** The title is just "Consultation" (wrong-patient risk) | Persistent patient banner (name, age/sex, MRN, allergy status) on every consultation step and sheet |
| 6 | Major | iOS | **A recorded "NKDA" raises a red "ALLERGY ALERT" banner** (false alarm, alert fatigue) | Red banner only for real allergies; a green "NKDA" chip; amber "not recorded" |
| 7 | Major | iOS | **NEWS2 is missing from the iPad record header.** Non-severe allergies are missing too, and the iPhone shows NEWS2 in 9-pt text | Header safety strip: NEWS2 with band colour and text, allergy summary, anticoagulant, all at readable size |
| 8 | Major | Web + iOS | **Completing an encounter has no sign-off and no summary of what is missing** (web: a bare browser `confirm()`) | Completion sheet: missing items, unconfirmed auto-content, attestation, sign |
| 9 | Major | iOS (iPad) | **Two navigation systems for the same consultation, and two different "Save Visit" buttons** | One navigation model: the pathway step bar inside a single record view; one Save Visit |
| 10 | Major | Web + iOS | **Scores cannot be reached from within the consultation.** Web: the Scores tab disappears once a CC is chosen. iPhone: the consultation has to be left and reopened | Add Scores (and Vitals, Rx) to the consultation's "More"/tools on every pathway |

Details, evidence and more findings follow.

## 3. Task efficiency

### 3.1 Web: measured (`docs/clinical-validation/ux/web/ux-metrics-web.json`)

Flow: empty home → new patient → visit type → CC and one triage answer → HPI → PMH → PSHx →
Meds → allergy (penicillin) → two exam findings → Labs → Imaging → Assessment (impression) →
Plan → Summary → close.

| Viewport | Clicks* | Drop-downs | Interactions | Text entries | Keystrokes | Scrolls | Screens |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop 1440×900 | 29 | 2 | **31** | 6 | 364 | 6 | 18 |
| iPad 1024×1366 | 29 | 2 | **31** | 6 | 364 | 3 | 18 |

\*Includes the click into each of the 6 text fields and the close confirmation, so there are 23 clicks
on controls. The score step could not be done (finding M6). The diagnosis search was not needed
because the diagnosis had already been set by the system (finding C4).

**Re-measured after the fixes** (same script, `e2e/ux-walkthrough.mjs`; the flow now also ticks
suggested tests and confirms the suggested diagnosis, C3–C4, and signs off in-app, M8):

| Branch | Viewport | Clicks | Drop-downs | Interactions | Scrolls | Screens | Scores reached |
|---|---|---:|---:|---:|---:|---:|---|
| `ux-safety-fixes` | Desktop | 36 | 2 | 38 | 6 | 19 | no (tab gone after the CC) |
| `ux-safety-fixes` | iPad | 36 | 2 | 38 | 4 | 19 | no |
| `ux-seamless` | Desktop | **38** | 2 | **40** | **4** | 20 | yes: Tools → Scores → close, 3 clicks, back on the Plan step |
| `ux-seamless` | iPad | **38** | 2 | **40** | **2** | 20 | yes, same |

Like for like (without the new Scores step), the flow is 35 clicks instead of 36: the "Skip to HPI"
click went with the duplicated question card (M12). Scrolls fell by 2 on both viewports (the
sticky pathway bar no longer sits under a separate phase bar). Text entries (6) and keystrokes
(364) are unchanged. The walkthrough also records: no phase breadcrumb next to the bar, 15 pills
in 5 phase groups, the ONSET question shown once (was twice), and Tools → Vitals and
Tools → Prescriptions opening over the step.

### 3.2 iOS: expected from the code (the CI walkthrough replaces these with measured values)

Flow (a) as scripted: Today → patient → consultation → "First visit" pathway (12 steps) →
typing in CC, HPI, exam (2 fields), diagnosis search, plan → compute and save one score → Save
Visit → Complete.

| Device | Taps | Text entries | Interactions | Screens | Extra cost specific to the device |
|---|---:|---:|---:|---:|---|
| iPhone | ≈ 31 | 6 | ≈ 37 | ≈ 19 | +4 taps to leave and re-enter the consultation for a score (M5). Scrolls to reach the HPI editor and the ICD search (M11) |
| iPad | ≈ 29 | 6 | ≈ 35 | ≈ 19 | Horizontal drags on the 25-item section bar to reach Scores (M4) |

After `ux-seamless` (expected until the CI walkthrough re-runs): the score is reached on both
devices with Tools → Clinical Scores and closed with Done (3 taps, the consultation keeps its
step), instead of 4 taps to leave and re-enter on iPhone and a horizontal drag on the iPad
section bar. Completing adds the review sheet (attestation tick + Complete visit: 1 tap more than
the old dialog). The walkthrough now scripts both, and the iPhone hand-over flow (e) through the
Check-In row.

**CI run 36181523764** (before these changes) failed on iPhone at a_consultation ("ICD-10 search
field" not found: it was below four other panels on the Diagnosis step) and b_add_patient (the
chief-complaint chip was under the keyboard); e was not reachable on iPhone. The iPad
a_consultation was missing from the metrics because asking an off-screen section-bar item for
`isHittable` raised an XCTest failure that ended the test before the recorder wrote its JSON.
All four are addressed: the ICD search is the first section, the keyboard is put away before the
chips (and the form dismisses it on scroll), the Check-In row has a Questionnaire action, and the
recorder checks hittability only for elements on screen and writes the metrics from a teardown
block if XCTest still ends a test early.

**CI run 36195058935** (first run with the `ux-seamless` changes; follow-up branch `ux-seamless-2`):
- iPad a_consultation: the script's "Clinical Scores" lookup matched the record's section-bar
  button (same label) before the Tools menu item, so it opened the Scores section instead of the
  sheet. The walkthrough now takes menu items by identifier and never a `patient.…` item, and
  checks that the Tools sheet (Done) opened. On iPad the patient's identity is in the record
  header directly above the embedded consultation (now `patient.header.identity`); the Tools and
  Complete sheets show it again.
- iPhone a_consultation was stopped by XCTest's 10-minute default: the flow asks for 25 minutes
  (run.sh caps at 30). The Save snapshot / Complete explanation moved from the footer (hidden
  while the Plan editor had the keyboard up) to just under the step bar on the last step.
- iPhone d_prescription: the quick-action tap did not open Prescriptions. The recorder now waits
  for a target to stop moving before tapping, closes an open menu or popover first, and taps
  once more if the screen did not change.
- iPhone b_add_patient: the "Added today" row was below the fold (rows are built lazily). The
  group now sits right after "Waiting", has a summary tile, and the script scrolls to look.

Other iOS flows, expected:

- **(b) Add patient:** 4 taps and 1 text entry.
- **(c) Record vitals:** about 9 taps and 6 text entries. The quick chips or "All Normal (Adult)" can cut this to about 4 taps.
- **(d) Prescription with interaction:** about 6 taps and 1 text entry. The warning appears while typing.
- **(e) Front-desk hand-over:** iPad, 3 taps and 1 text entry. iPhone, not reachable directly (m3).

**Against the engineering gate (items 2 and 3).** A first-visit consultation costs about 30–37
interactions and 350+ keystrokes on either platform. About half the taps are just step
navigation through 12 steps (iOS) or 17 steps (web). The keystrokes are free text the pathway
chips could replace. The biggest avoidable costs:

- leaving the consultation to score (iPhone), or losing the Scores tab (web);
- scrolling past long chip lists to reach the free-text boxes;
- the web entering age and sex twice;
- the web's visit-type gate after the patient is created;
- the web's empty home page (no worklist).

## 4. Findings in detail

Screenshot paths are relative to `docs/clinical-validation/ux/web/`: `D` is `desktop-1440x900/`,
`P` is `ipad-1024x1366/`.

### Critical

**C1. Web: "NKDA" when allergies are not recorded** (H2, H5; NISTIR safety-critical information)
- *Screen:* the header on every consultation screen, and the clinical note.
- *Evidence:* the header shows grey "NKDA" for a patient just created, before the Allergies step (`D/03`, `D/04`, `D/12`). Source:
  - `artifacts/dashboard/src/components/AppHeader.tsx:92-98` falls back to `NKDA` whenever `allergyList` is empty;
  - `artifacts/dashboard/src/components/PatientContextBanner.tsx:59-61` does the same;
  - `artifacts/dashboard/src/pages/tabs/SummaryTab.tsx:543` prints "No known drug allergies (NKDA)" into the note when the field is empty.
- *Impact:* "not asked" reads as "asked, none". For a surgeon about to prescribe antibiotics or give contrast, this is the most dangerous state an allergy field can be in. The iOS app already models this correctly: an empty list means "not recorded" (`ios/AmiseMedFlow/Models/Patient+Allergies.swift`). So this is also a parity gap.
- *Proposed change:* three explicit states:
  - "Allergies not recorded" (amber, clickable to the Allergies step);
  - "NKDA" (only after the "No known allergies" chip);
  - the allergy list.

  The summary prints "Allergies: not recorded" in the first state. Completion (C/M8) should flag it.

**C2. Web: examination pre-filled as normal, including a non-existent wound** (H5; NISTIR documentation integrity)
- *Screen:* Exam, then Summary / clinical note.
- *Evidence:* "5 systems documented" before anything is touched (`D/14`, `P/14`). "✓ Normal" is pre-selected for General, Respiratory, Cardiovascular and Extremities (`D/15`). The note then contains General, CVS, Resp, Extremities and "**Wound**: Wound healing by primary intention… Sutures/staples intact" (`D/25`) for a patient with no wound; only the abdomen was examined. Source: `artifacts/dashboard/src/pages/tabs/ExaminationTab.tsx:390-414` writes each visible system's `normalProse` on first open.
- *Impact:* the signed record states examinations that were not performed, which is a medico-legal and clinical risk (missed findings, false reassurance at handover). Recording "normal" also marks Exam ✓ in the pathway bar (`ClinicalWorkflowBar.tsx`).
- *Proposed change:* open the Exam step empty, with "Not examined" as the default state per system. Keep "Nml" per system and "All Normal" as deliberate taps (they are already there and quick). Show any template text as unconfirmed (grey, italic) until edited or ticked. Never include a Wound section unless a wound is recorded.

**C3. Web: chief complaint auto-fills "ordered" investigations and imaging** (H5; CLAUDE.md human-authority rule)
- *Screen:* CC picker → Labs / Imaging → clinical note.
- *Evidence:*
  - Right after "Biliary colic" is picked, Labs and Imaging show ✓ in the pathway bar (`D/06`).
  - Labs shows "4 ordered" (`D/16`).
  - The note lists 14 "Investigations ordered" (blood cultures ×2, MRCP, CT abdomen, OGD twice, group and save, erect CXR, LFTs, FBC, amylase, CRP, and USS under *Laboratory*) (`D/25`, `D/26`).
  - Source:
    - `artifacts/dashboard/src/components/ChiefComplaintStrip.tsx:182-204` (`prefillFromMatrix`);
    - `:206-256` (`seedPane` adds protocol tests from the top-3 differentials);
    - `ClinicalWorkflowBar.tsx:61-62` counts them as done.
- *Impact:* orders the clinician never placed appear in the record and on a printable lab request form. That is unnecessary tests (blood cultures, CT, OGD for biliary colic) and misleading documentation. It contradicts "must never … order procedures … without explicit clinician approval".
- *Proposed change:* keep the matrix as **suggested** investigations: a list of unticked checkboxes with "Add selected". Only ticked items go into `orderedInvestigations`. The note header becomes "Investigations requested" and lists only those. Labs ✓ only when the clinician has requested something.

**C4. Web: working diagnosis auto-set and locked from a free-text sign** (H3, H5; CLAUDE.md "never independently diagnose")
- *Screen:* Exam → Assessment → header → note.
- *Evidence:*
  - Tapping the "Murphy's sign +" exam chip makes the header show "🎯 Acute Cholecystitis" (`D/18`).
  - Assessment shows "Diagnosis locked — Acute Cholecystitis via Murphy's sign +" and PRIMARY DX **K81.0** already selected (`D/19`, `P/19`).
  - Its management card proposes NBM, IV morphine and "same-day admission" for an afebrile outpatient.
  - The note prints "WORKING DIAGNOSIS K81.0 — Acute Cholecystitis" (`D/26`).
  - The app's own card quotes Murphy's sign at 65 % sensitivity and 87 % specificity, so it is not pathognomonic.
  - Source: `artifacts/dashboard/src/pages/tabs/AssessmentTab.tsx:688-716` (`setWorkingDiagnosis({… locked: true})` and the ICD auto-fill).
- *Impact:* the system states a diagnosis, and radiates it to plan, billing and letters, before the surgeon decides. Anchoring risk: here the presentation was biliary colic.
- *Proposed change:* show "Suggested: Acute cholecystitis (Murphy's sign)", with Accept and Dismiss, in the Assessment step. `workingDiagnosis`, the ICD and the header chip are set only on Accept. This is the pattern `CLAUDE.md` already mandates for diagnosis radiation. Reserve "locked" for the clinician's own choice.

### Major

**M1. iOS: no patient identity on consultation screens** (NISTIR 7804 wrong-patient prevention; H1)
- *Evidence:*
  - `ios/AmiseMedFlow/Views/Consultation/ConsultationView.swift:166` sets the title to `"Consultation"`.
  - The patient's name appears nowhere in the consultation UI: `fullName` is used only in the HPI prose and the letter (`ConsultationView+HPITab.swift:265`, `+Sheets.swift:203`).
  - The CC step shows the MRN alone (`ConsultationView+CCTab.swift:24-31`).
  - The same holds for the iPad full-screen consultation opened from a calendar appointment (`PatientRecordPresentation.swift:82-104`) and for the Record Vitals and Add Prescription sheets.
- *Impact:* with several patients a session (Today list, ward round), nothing on screen confirms whose record is being written to. That is a classic wrong-patient documentation risk. On the iPhone the only cue is a truncated back-button label.
- *Proposed change:* a compact identity banner at the top of `ConsultationView` and of every sheet: name, age/sex, MRN, allergy status chip and NEWS2. Title = patient name, subtitle = pathway.

**M2. iOS: red "ALLERGY ALERT" for a patient recorded as NKDA** (H2, H8; alert fatigue)
- *Evidence:*
  - `ConsultationView.swift:146` shows the banner whenever `patient.allergies` is non-empty.
  - `ConsultationView+Banners.swift:100-121` lists every entry, including the NKDA marker. The result is a red banner reading "ALLERGY ALERT · NKDA [Mild] — None".
  - The walkthrough's demo patients Morgan and Riley carry the NKDA marker.
- *Impact:* a red alert that means "no allergy" trains users to ignore the red allergy banner.
- *Proposed change:*
  - use `patient.recordedAllergies` for the red banner;
  - show a green "NKDA (recorded)" chip when `hasExplicitNKDA`;
  - show amber "Allergies not recorded" when the list is empty.

**M3. iOS: safety information missing or too small in the record header** (NISTIR safety-critical visibility; H1)
- *Evidence:*
  - The iPad header (`PatientDetailPadView.swift:111-160`) shows an acuity pip, a shield icon only for *severe* allergies, and a drop icon for anticoagulants (11-pt icons, no text). It has **no NEWS2**, and non-severe allergies are not shown at all.
  - The iPhone record header shows NEWS2 in 9-pt text (`PatientDetailView.swift:139-153`).
  - The red-flag clinical alarm banner exists only inside the consultation.
- *Impact:* a deteriorating ward patient (the demo's NEWS2 9) looks the same as a routine one in the iPad record header.
- *Proposed change:* a header safety strip:
  - NEWS2 score, band word and colour, and time since the vitals were taken;
  - allergy summary text;
  - anticoagulant name;
  - active red flags.

  Use Dynamic Type at no smaller than footnote size, on both devices.

**M4. iOS iPad: two navigation systems, and two different "Save Visit" actions** (H4, H8)
- *Evidence:*
  - The record's horizontal section bar has about 25 sections with 9-pt labels (`PatientDetailPadView.swift:215-245`). Eleven of them open the *same* `ConsultationView` at a different tab (`:257`), which has its own pathway step bar (`ConsultationView+TabBarDispatch.swift:16-72`).
  - `activeTab` is `@State` and is set only in `onAppear` (`ConsultationView.swift:15, 177`), so switching between two consultation sections in the section bar may keep the previous step. The iPad walkthrough checks this and records the outcome in its metrics notes (`probeSectionBarSwitch`).
  - The header has its own "Save Visit" (`PatientDetailPadView.swift:170-190`) that saves without the SOCRATES selections and the Bayesian differential (comment at `:327-329`). The consultation toolbar's "Save Visit" (`ConsultationView.swift:341-354`) saves both. The two are visible at the same time.
- *Impact:* two ways to reach every consultation step, with different state and different save content. Users can't predict which one they are in (recall load), and snapshots differ depending on which button was pressed.
- *Proposed change:* on iPad, keep the pathway step bar as the only consultation navigation. Collapse the eleven consultation sections into one "Consultation" section. Remove the header Save Visit, or make it call the same save as the consultation.

**M5. iPhone: scores, vitals and prescriptions are outside the consultation** (H7; gate 3)
- *Evidence:* the consultation (`ConsultTab`, `ConsultationViewData.swift:287-308`) has no Scores, Vitals or Rx. They are quick actions on the record overview (`PatientDetailView.swift:25-57`). Walkthrough (a) has to go Back, Scores, Back, Consultation: 4 extra taps, and the place in the pathway is lost.
- *Proposed change:* a "Tools" menu in the consultation toolbar with Scores, Vitals and Prescriptions, opened as sheets over the current step. Or add Scores to the "More" menu and to the pathways where it is routine (ward review, procedure).

**M6. Web: navigation overload; the tab set changes twice; Scores disappears** (H4, H6, H8)
- *Evidence:*
  - Three stacked navigation layers: the phase bar (History › Exam › Assessment › Plan), a 17-pill pathway bar, and a row of Back / Dictate / Ambient / Next / Summary (`D/06`). There is also a left icon rail with no labels.
  - The tab set changes after the visit type is chosen (`D/04`), and again when a CC is picked (`D/06`). The second change replaces the tab bar with `ClinicalWorkflowBar` (`artifacts/dashboard/src/pages/Home.tsx:862`), which has no Scales entry, although `VISIT_TYPE_TABS.new_consult` includes Scales (`Home.tsx:109-125`).
  - The pills are about 24 px tall, and on the iPad the bar is cut off at "14 Referra" with no scroll cue (`P/06`).
  - The phase bar shows "✓ History" once HPI is written, although PMH, PSHx and Meds are still empty (`D/15`).
- *Proposed change:*
  - One navigation model: the pathway steps, with the phase shown as group labels inside the same bar.
  - A stable tab set for the whole encounter.
  - Scores in every pathway.
  - 44 px targets and a visible overflow ("+5 ›") on narrow screens.
  - ✓ only for documented content.

**M7. Web: start-up friction: empty home, the same data asked twice, a gate after creation** (H7, H6; gate 3)
- *Evidence:*
  - Home is an empty canvas titled "No patient loaded", with no worklist or today list (`D/01`).
  - After "Create Patient & Open Encounter", the next screen blocks with "Visit type required" (`D/03`).
  - The HPI panel then asks for age and sex again: "Age and sex required to generate HPI prose" (`D/04`), although sex was chosen in the new-patient form.
- *Proposed change:*
  - A Today worklist on the home page (waiting, clinic, ward, as on iOS).
  - Put the visit type in the new-patient form, pre-selected "First consult".
  - Carry age and sex from the form.

**M8. Web and iOS: completion without sign-off or a summary of gaps** (H5, H9; NISTIR error prevention)
- *Evidence:*
  - Web: a native `window.confirm('Mark this encounter as complete and close it?')` (`artifacts/dashboard/src/components/AppHeader.tsx:167-178`). No list of empty sections, no mention of unconfirmed auto-content (C2–C4), no attestation. The closed note still has an empty "Licence # …… Date ……" signature line (`D/26`, `D/28`).
  - iOS: the Complete dialog does list the undocumented steps (good, `ConsultationView.swift:435-447`). But completing does not sign a note, and "Save Visit" (snapshot) versus "Complete" (status) is unexplained on screen.
- *Proposed change:* one "Review and sign" sheet on both platforms:
  - missing sections;
  - allergy status;
  - auto-filled content still unconfirmed;
  - diagnosis and orders;
  - an attestation line;
  - a single Sign & complete action, which also saves the visit snapshot.

**M9. iOS: a patient added from Today disappears from Today**
- *Evidence:* Today lists clinic patients only when `operationDate` is today (`ios/AmiseMedFlow/Views/TodayDashboardBoard.swift:62-65`). "+" on Today opens `AddPatientView()`, which sets no date for an outpatient. Walkthrough (b) records whether the new patient shows on Today (metrics note).
- *Impact:* a walk-in added during clinic has to be found again under Patients.
- *Proposed change:* when adding from Today, default the appointment date to today (editable). Or show an "Added today" group.

**M10. iOS: "AI Draft" buttons are deterministic templates, and "AI Draft Examination" writes normal findings** (H2, H5)
- *Evidence:*
  - HPI, Exam and Plan have purple "✦ AI Draft …" buttons (`ConsultationView+HPITab.swift:136`, `+ExamTab.swift:62`, `+PlanTab.swift:86`), but AI is disabled on iOS. The drafts come from `SOAPDraftEngine` or fixed text.
  - `draftExam()` fills every blank system with normal findings, including "Afebrile" with no temperature recorded (`ConsultationView+Sheets.swift:155-170`).
  - The first-launch AI disclosure sheet describes data sent to Anthropic (`Views/AIConsentGate.swift`), which iOS does not do.
- *Impact:* a mislabelled control. One tap fills a whole exam with normal findings, the same integrity risk as C2, though here it takes an explicit action.
- *Proposed change:*
  - rename the buttons "Insert template" and drop the AI styling;
  - insert per system, with the inserted text marked unconfirmed;
  - never assert "Afebrile" without a temperature;
  - show the AI disclosure only when an AI feature is enabled.

**M11. iOS: typing hides Next, and the free-text fields sit below long chip lists** (H7; gate 3)
- *Evidence:*
  - The step footer (Back/Next) is removed while the keyboard is shown (`ConsultationView.swift:156`), so a Next press takes a keyboard dismissal or a step-bar tap.
  - The HPI editor sits at the bottom of the SOCRATES builder (`ConsultationView+HPITab.swift:118`).
  - The ICD-10 search sits below differentials, clinical actions, trajectories and EVPI (`ConsultationView+DiagnosisTab.swift:360`).
  - The walkthrough counts the scrolls this takes.
- *Proposed change:*
  - keep Next available (keyboard toolbar "Next step");
  - put the free-text/summary field first, with chips below or collapsible;
  - pin the ICD search at the top of the Diagnosis step.

**M12. Web: duplicated content** (H8)
- *Evidence:*
  - The triage card and the "Adaptive HPI" card below it ask the same ONSET question with the same chips (`D/06`, `P/06`).
  - The note says "Investigations already ordered above — plan sections 1–2 may overlap" (`D/26`).
- *Proposed change:* one question card, and let the note builder deduplicate.

### Minor

- **m1. iOS iPhone: Delete in the Close position.** The record's trash button sits top-left (`.cancellationAction`, `PatientDetailView.swift:129-133`), where users expect Close; Done is top-right. A confirmation exists. *Change:* move Delete to an overflow menu.
- **m2. iOS: fixed small type in dense places.** Quick-action labels are 10 pt (`PatientDetailView.swift:75`), NEWS2 9 pt (`:144`), and the iPad section labels 9 pt (`PatientDetailPadView.swift:225`). None of these scale with Dynamic Type. *Change:* use text styles, with a minimum of caption2.
- **m3. iOS iPhone front desk: no direct hand-over questionnaire.** It opens only after saving a new appointment, "Open Pre-Consult Questionnaire" then Save (`AppointmentSchedulerView.swift:386`), which writes a calendar event. *Change:* a "Questionnaire" action on the Check-In patient row, as on the iPad.
- **m4. Web: literal "\n" in the differential placeholder** ("1. …\n2. …\n3. …", `P/20`). *Change:* use real newlines in the placeholder.
- **m5. Web: the sticky phase bar covers content when scrolled** (the "CONSERVATIVE" heading is hidden, `D/19`). *Change:* offset the scroll or add a solid background.
- **m6. Web: static differential list with irrelevant items for RUQ pain** (vertigo, dengue, hypoglycaemia, syncope, `D/18`). *Change:* filter by complaint, or collapse below the top 5.
- **m7. Web: AI-labelled controls when AI may be off** ("AI will extract…", "AI code suggest", "🧠 AI"). *Change:* hide or grey them with "AI off" when `DISABLE_AI` is set.
- **m8. Web: HPI draft states the diagnosis as history** ("presents with a history of biliary colic", `P/06`). *Change:* seed with the presenting symptom (RUQ pain), not the label.
- **m9. Web: left rail icons without labels in the consultation.** Recognition over recall (H6). *Change:* tooltips and labels on hover or long-press.
- **m10. Web: the Summary view drops the patient header.** Only "Edit encounter" remains (`D/23`). *Change:* keep the identity banner on every view (see M1).

## 5. What works well

- **iOS allergy model:** NKDA must be explicit, and an empty list means "not recorded" (`Patient+Allergies.swift`). The web should copy it (C1).
- **iOS "first door" pathway picker:** a suggested pathway with reasons, a risk snapshot, "Skip" always available, and the other steps under "More".
- **iOS step bar:** documented dots and a "Step n of N" footer. The Complete dialog lists undocumented steps. VoiceOver labels give the step state.
- **iOS vitals entry:** a live NEWS2 preview with band and partial-score warning, quick chips, and an explicit SpO₂ Scale 2 toggle.
- **iOS and web prescribing:** the interaction warning shows *while typing*, with the "absence of an alert does not mean safe" note (H-07), and never blocks.
- **iOS front-desk privacy:** no patient list before 3+ letters, hand-over full-screen, staff exit behind device authentication.
- **Web:** a recorded allergy shows immediately in the header as an amber chip (`D/13`). The note is generated without AI and says "Review before printing". A closed encounter is read-only, with a 7-day reopen window (`D/28`).

## 6. NISTIR 7804 / 7741 checklist (summary)

| Area | iOS | Web |
|---|---|---|
| Patient identification on every screen | ✗ Not in the consultation (M1) | ◐ Header yes; Summary no (m10) |
| Allergy status: visible, three states | ✓ Three states; red only for real allergies; every allergy in the record header (M2, M3 fixed) | ✓ "Not recorded" / NKDA / list (C1 fixed) |
| NEWS2 / deterioration visible where decisions are made | ✓ Record header strip on iPad and iPhone, band colour and age (M3 fixed) | ◐ Not in the consultation header |
| Red flags | ✓ Clinical alarm banner in the consultation; red-flag chips on the plan card | ✓ Red-flag chips in Assessment and Plan |
| Information density | ✓ One consultation entry, one step bar (M4 fixed) | ◐ One pathway bar with phase groups; each question asked once (M6, M12 fixed); the left icon rail still has no labels (m9) |
| Error prevention: auto-generated content | ◐ Template exam on an explicit tap (M10) | ✗ Auto exam, auto orders, auto diagnosis (C2–C4) |
| Completion / sign-off | ✓ Review sheet: gaps, unedited content, attestation (M8 fixed) | ✓ In-app sign-off: gaps, attestation (M8 fixed) |
| Wrong-patient prevention on switching | ✗ Nothing on screen in the consultation (M1) | ✓ Name in the header |

## 7. Nielsen heuristics: where they fail most

- **H1 Visibility of system status:** ✓ marks for visited but undocumented phases (web); no NEWS2 on the iPad header.
- **H2 Match with the real world:** "NKDA" meaning "not asked"; an "AI" label on templates; a diagnosis written as history.
- **H3 User control and freedom:** a diagnosis locked by the system (C4).
- **H4 Consistency and standards:** two navigation systems (iPad) and three (web); two different Save Visit buttons; the tab set changes mid-encounter.
- **H5 Error prevention:** C1–C4, M8, M10.
- **H6 Recognition over recall:** unlabelled icon rails; the tabs that disappear.
- **H7 Flexibility and efficiency:** leaving the consultation to score; hidden Next while typing; the start-up gate.
- **H8 Minimalist design:** duplicated triage cards; 25-item and 17-item bars; long chip walls above the free-text boxes.
- **H9 Error recovery:** after completion, the web offers a reopen window (good); iOS completion can be undone only by editing.
- **H10 Help:** reasonable inline hints (the pathway reasons, "Tap triage chips…").

## 8. What the iOS walkthrough cannot reach

- **iPhone front-desk hand-over questionnaire (flow e).** Before `ux-seamless` it was reachable only by saving a new appointment, which creates an EventKit calendar event, so the flow was recorded as `not-reachable` (m3). It is now scripted through the Check-In row's "Questionnaire" action on both devices' flows.
- **Face ID lock, sign-in, the AI disclosure sheet and the staff-exit authentication.** Deliberately skipped in demo mode (no biometrics on a CI simulator). They need a manual check on a device.
- **Sync, peer sync, NAS backup, the audit-log upload and Sentry.** Switched off in demo mode by design, so sync-status UI and conflict states are not exercised.
- **Calendar-driven Today content** (calendar sections, import banner, "Start Encounter" from an appointment). The calendar is off in demo mode.
- **AI features.** Never called (the "AI Draft" buttons are not pressed; AI is disabled on iOS anyway).
- **Dictation / speech, camera and photo capture, PDF share sheets, and document upload** (the upload needs Supabase storage).
- **Landscape and split-screen iPad, and large Dynamic Type sizes.** Only portrait at the default size is scripted. Worth adding later.
- **Real timing.** The metrics count taps and screens, not seconds or think time. A moderated session with the surgeon is still needed for time-on-task.
- **iOS numbers in section 3.2 are estimates from the code** until the CI workflow has run. Its `ux-metrics.json` and screenshots replace them.

## 9. Files

| Path | What |
|---|---|
| `ios/AmiseMedFlow/Services/UITestDemoMode.swift` | DEBUG-only demo mode: synthetic in-memory patients, no sync or network |
| `ios/AmiseMedFlowUITests/UXWalkthroughTests.swift`, `UXRecorder.swift` | XCUITest flows a–e, screenshots, tap/screen counting |
| `ios/UIWalkthrough/run.sh` (+ `pick_simulator.py`, `collect_results.py`) | Local / CI runner, attachment export, `ux-metrics.json` merge |
| `.github/workflows/ios-ui-walkthrough.yml` | CI: iPhone 16 Pro Max and iPad Pro 13″, artifacts even on failure |
| `e2e/ux-walkthrough.mjs` | Web walkthrough (desktop and iPad viewports), including Tools → Scores / Vitals / Prescriptions |
| `artifacts/dashboard/src/lib/consult-steps.ts`, `components/ClinicalWorkflowBar.tsx`, `ConsultToolsMenu.tsx`, `ConsultToolDrawer.tsx` | Web: one pathway bar, phase groups, Tools panel over the step |
| `ios/AmiseMedFlow/Views/Consultation/ConsultationToolSheet.swift`, `CompleteEncounterSheet.swift`, `Views/RecordSafetyStrip.swift`, `Services/EncounterCompletionReview.swift`, `RecordSafetySummary.swift`, `ConsultTool.swift` | iOS: Tools sheet, review-and-complete, header safety strip |
| `docs/clinical-validation/ux/web/` | Web screenshots and `ux-metrics-web.json` |

# Change log — `ios-screening-parity` (iOS screening, NG12 suspected cancer, TIA scores)

Owner-authorised "fix all gaps" programme, 2026-09-25. Area: the iOS gaps that the web fixes left
open — the iOS parity list in `fix-web-screening.md` (items 1–10, and item 11: no NG12 port on
iOS), and ABCD² still being recommended for TIA on iOS. SURGEON-DECISIONS **G2.19**, **C9**, **C1**.

Every citation below is unverified until the surgeon checks it. Deterministic only: no AI, no
network, `AIService` untouched. Nothing orders a test or a referral: every item is a suggestion the
clinician confirms, and the new card can be dismissed.

**Scope change during the work:** item 4 of the brief (paediatric doses in `ManagementEngine` /
`AutoFunctionEngine` / pipeline decisions) was dropped by the coordinator: another agent is writing
the Swift twin of the web `planSafety` filter, which covers under-16 doses there. The commit made
for it before the change was removed (not pushed); `ManagementEngine*`, `AutoFunctionEngine*`,
`ClinicalPipelineOrchestrator*` and the radiation content are untouched on this branch.

## Checks

Swift cannot be compiled here (no toolchain). Every changed Swift file was parsed with
tree-sitter-swift (no errors) and each call was symbol-checked by hand against its declaration; the
first iOS CI run is the real compile and test gate.

- `pnpm run typecheck`: exit 0.
- `pnpm -r run test`: all pass (pane-engine 83, scripts 35, front-desk 109, dashboard 565, api-server 582).
- Lints: `dx-phases`, `grants`, `guideline-registry`, `interaction-parity`, `no-external-qr`,
  `patient-instructions`, `report-import-parity`, `rls-policies`, `scan:nav-lockout`,
  `check:migrations-fresh` — all exit 0.
- `clinval:web`: 397 vignettes, 3087 expectations, 2625 pass / 370 fail / 92 n/a, critical fail 66,
  **blocking 0**. No web logic changed on this branch (comments only), so the web result is the
  base result. Results files restored, not committed.
- iOS clinval: results come from CI only. No `knownGap: ["ios"]` flag was removed: none of the 56
  iOS known-gap expectations concerns screening, NG12 or ABCD² (the screening and suspected-cancer
  vignettes carry `unverified: ["ios"]`, which the harness clears after a CI run). The iOS runner
  now mirrors the new NG12 card (step 5c), so after the next CI run the harness can grade
  `crc-fit-positive-abdominal-pain`, `crc-ida-no-gi-symptoms`, `iron-deficiency-anaemia-over60`,
  `breast-nipple-discharge-bloody-single-duct` and `haematuria-visible-smoker-2ww` against it.

## 1. iOS screening engine (`PathwayData.swift` `ScreeningEngine`, `WellnessScreeningView.swift`)

Commit `4fefb43` (earlier on the base branch) had added the new `WellnessScreening` fields and most
rules. This branch aligns the remaining rows and wording with the web module
`lib/triage-engine/src/screening/preventive.ts` (1.0.0) and adds the missing inputs.

| Topic | Before (iOS) | After (iOS, = web) | Guideline |
|---|---|---|---|
| Polyp surveillance | "Previous polyps" assumed adenomas; ≥10 mm, villous/HGD/TSA → 3 y; 1–2 with size → 7–10 y | Web rows exactly: new `polypHistology` field (adenoma, sessile serrated, traditional serrated, hyperplastic, not recorded); > 10 adenomas → 1 y + genetics; adenoma ≥10 mm / villous / HGD → 3 y; 5–10 → 3 y; 3–4 → 3–5 y; 1–2 < 10 mm → 7–10 y; SSL rows (3 y / 3 y / 3–5 y / 5–10 y); TSA → 3 y; hyperplastic ≥10 mm → 3–5 y, < 10 mm → routine 10 y; piecemeal EMR ≥20 mm → 6 months, 1 y, 3 y; otherwise "per the report". Title "Post-polypectomy surveillance — <interval>"; high-risk only when early surveillance | US MSTF 2020 |
| Polyp / colonoscopy inputs | Fields existed, no inputs for count, size, last normal colonoscopy | Inputs: histology picker, number of polyps, largest size (mm), last normal colonoscopy (years ago) | — |
| Colorectal age floor | None (Lynch item at any age) | All colorectal items from 18 | preventive.ts |
| Family history < 40 | Nothing shown | "Colorectal screening due from 40 (family history)", no test offered; high-risk wording asks for the youngest relative's age | ACG 2021; US MSTF 2017 |
| Family history > 75 | Family item shown at any age ≥ 40 | 76–85: individualised item; > 85: nothing | USPSTF 2021 |
| Average risk | "FIT every year, or colonoscopy every 10 years (USPSTF 2021)" | Adds the grade (B at 45–49, A at 50–75) and ACG 2021; up-to-date item has no test to add | USPSTF 2021; ACG 2021 |
| Lynch carrier | Colonoscopy 2-yearly …; aspirin | + "overdue if the last one was more than 2 years ago"; aspirin "NICE NG151; dose per clinician" | BSG/ACPGBI/UKCGG 2019; NCCN 2024; NICE NG151 |
| BRCA carrier | From 25 | From 18 (the MRI investigation offered from 25); RRSO ages 35–40 (BRCA1) / 40–45 (BRCA2) after childbearing | NCCN 2024; ACR 2023 |
| Breast family history | From 30 | From 25; "Familial risk assessment tool (e.g. Manchester score, Ontario FHAT)" | USPSTF 2019; ACR 2023 |
| Cervix | "HPV test every 5 years (or cytology every 3)" | "Primary high-risk HPV test every 5 years; cytology every 3 years if HPV testing is unavailable"; 21–29 cytology | USPSTF 2018; WHO 2021 |
| PSA | Early (45) for African-Caribbean or family history; "PSA" investigation offered | Early also with BRCA; **no PSA investigation offered** ("order a PSA only if the patient chooses screening"); "not recommended from 70" | USPSTF 2018; ACS 2023 |
| Hepatitis B | Triple panel once | + "vaccinate if not immune (ACIP 2022, adults 19–59)" at 18–59 | CDC 2023; ACIP 2022 |
| BP confirmation | Shown for any clinic BP 140–179 **or** DBP 90–119, including 185/95 | Not shown when SBP ≥ 180 or DBP ≥ 120 (hypertensive-urgency alerts own that range); detail shows the reading | USPSTF 2021; NICE NG136 |
| Diabetes | "HbA1c or fasting glucose; repeat every 3 years if normal" | "HbA1c or fasting plasma glucose; repeat every 3 years if normal, yearly with prediabetes (ADA 2024)" | ADA 2024 |
| AAA, lung, HCV, HIV, H. pylori, DXA, smoking | Short lines without sources | Guideline named on each (USPSTF 2019/2021/2020/2019; Maastricht VI 2022, ACG 2024; DXA + FRAX, USPSTF 2018; cessation with NRT/varenicline/bupropion, USPSTF 2021); H. pylori marked high risk; smoking cessation from 18 | as listed |

Persistence: `WellnessScreening` is stored as JSON inside `Patient.pathwayDataJson` (synced over
peer sync and Supabase `patients.pathway_data_json`). Every new field decodes with a default
(`?? false`, `?? nil`, `?? .notRecorded`; an unknown histology string also falls back), optionals
are omitted when nil, and statuses are keyed by the unchanged item ids. Tests cover the round trip
and a legacy JSON (`testNewFieldsRoundTripAndOldJSONStillDecodes`). Caveat (unchanged behaviour of
this storage): a device still on an older build ignores the new keys and, if it edits and re-saves
the wellness form, writes the JSON back without them.

Differences from the web that remain (deliberate or out of scope):

- iOS reads structured toggles; the web parses free text (past history, notes, family history).
- iOS keeps AUDIT-C, PHQ-9, influenza, tetanus and pneumococcal lines (vaccination schedule is
  open surgeon decision D6), and lipids from 20 with hypertension (not in the web module).
- iOS shows the Lynch-family genetics item next to polyp surveillance; the web shows it only when
  there are no polyps (a genetics referral should not be hidden by a surveillance plan; the web
  behaviour is the gap).
- No HIV status, pregnancy or previous colorectal cancer inputs on iOS: HPV from 25 with HIV, the
  pregnancy caveats and "no screening after colorectal cancer" are web-only.
- iOS has no "youngest affected relative" age: the high-risk family item says "40, or 10 years
  before the youngest affected relative if earlier".
- Lung: iOS requires the recorded pack-years ≥ 20; the web also prompts when pack-years are unknown.

## 2. iOS NG12 suspected-cancer twin (new)

- `ios/AmiseMedFlow/Services/SuspectedCancerScreening.swift` — Swift twin of
  `lib/triage-engine/src/cancer-screening.ts` 1.1.0 (`screenForCancer`, `readCancerScreenLabs`,
  `isAnaemic`, `hasLabIronDeficiencyAnaemia`, `isFitPositive`): every criterion, rule text,
  guideline label, threshold and investigation list, including the chip rules and the 1.1.0 rules
  (rectal bleeding ≥ 50, weight loss + abdominal pain ≥ 40, nipple change ≥ 50 not bilateral,
  unexplained visible haematuria ≥ 45, FIT ≥ 10 µg Hb/g or recorded positive, IDA ≥ 60 two-week
  wait, BSG IDA under 60 urgent). Free text through `NegationMatcher` (twin of `negation.ts`), one
  clause per chip. Labs from resulted investigations (imaging/endoscopy narratives excluded), latest
  first, names matched whole-word with `LabNameMatch` (Hb, ferritin, MCV, FIT; "HbA1c" is not Hb);
  Hb > 25 or in g/L converted to g/dL; "< 10" read as below 10. `rulesVersion = "1.1.0"`.
- `SuspectedCancerScreening+Prompt.swift` — twin of the dashboard `suspectedCancerPrompts`: only
  the 1.1.0 criteria raise the card (older chip rules stay with the triage level, as on the web);
  suppressed when the assessment, working diagnosis or past history states an unhedged cancer at
  that site; no investigations in an emergency encounter ("arrange once the acute episode is
  managed"); IDA adds the BSG 2021 oral-iron line (no dose); microcytic anaemia without a ferritin
  → ferritin prompt. Inputs: chief complaint, associated-symptom chips, family-history notes, HPI,
  general/abdominal/skin/other examination, assessment, resulted labs.
- `Views/Consultation/SuspectedCancerSection.swift` — card at the top of the Diagnosis tab (where the
  consultation shows its differentials and clinical actions). "Add to Ix" adds the investigations
  as Suggested; "Add to plan" appends the referral / iron line to the management plan; the cross
  dismisses it for the session (keyed by patient and criteria, so a newly met criterion shows it
  again). Not placed on the Plan step (another agent owns that UI).
- Tests: `AmiseMedFlowTests/SuspectedCancerScreeningTests.swift` ports every vector of
  `artifacts/api-server/src/test/cancer-screening-ng12.test.ts` plus prompt tests; DRIFT NOTEs in
  both test files and both engine files name the twins.
- Registry: new `ios-suspected-cancer-screening` 1.1.0 (version stamp `rulesVersion`), added to
  `docs/CLINICAL-CONTENT-INVENTORY.md` and the lint's `KNOWN_RULE_SET_FILES`. `lastReviewed` stays
  `unknown`.

## 3. ABCD² for TIA (`DiagnosisScoreMapper`)

| Before | After | Guideline |
|---|---|---|
| A TIA or stroke diagnosis recommended ABCD² first ("48-hour stroke risk after TIA") | ABCD² is not recommended; NIHSS and mRS remain. The calculator stays in Clinical Scores, with a reference-only NG128 note on the form (its result already carried the NG128 evidence note) | NICE NG128 (2019, updated 2022): do not use ABCD² or other scores to assess urgency; aspirin 300 mg and specialist assessment within 24 h for every suspected TIA |
| "tia" matched as a substring: "dementia", "initial" recommended ABCD²/NIHSS/mRS and set the Neuro score category (vignette `periop-frailty-elective-dementia`) | Whole-word "TIA" or "transient ischaemic/ischemic attack" | — |

Tests: `AmiseMedFlowTests/TIAScoreRecommendationTests.swift`.

## Commits

`15daf09`, `c947305` (TIA), `243fd03` (screening), `71603e2`, `e46f89c` and following (NG12 engine,
prompt, card, tests, registry, drift notes, clinval runner) — see `git log` on `ios-screening-parity`.

## Needs sign-off

1. **Screening rule set on iOS**: the same USPSTF / ACG / US MSTF / NCCN / ACR / ADA / NICE NG136
   choices as the web (fix-web-screening.md sign-off items 1, 5, 6, 7 apply to iOS too).
2. **PSA from 45 for African-Caribbean ancestry alone** (iOS keeps it; the web has no ancestry
   input and starts at 45 only with a family history or BRCA). Choose one rule for both.
3. **No PSA investigation offered** from the screening list (web parity): the PSA is ordered only
   after the shared decision.
4. **BRCA carrier item from 18** (MRI offered from 25), and the breast family-history item from 25
   (was 30 on iOS).
5. **Colorectal family history under 40**: a "due from 40" item without a test; the clinician must
   check the youngest relative's age (iOS has no field for it). Add the field?
6. **Lynch-family genetics item shown alongside polyp surveillance** on iOS (the web hides it when
   polyps are recorded) — which behaviour should both platforms have?
7. **Lipids from 20 with hypertension** on iOS only (not in USPSTF 2022 / the web module): keep or remove.
8. **iOS vaccination and questionnaire lines** (influenza, tetanus, pneumococcal, AUDIT-C, PHQ-9):
   kept pending decision D6; the web does not show them.
9. **NG12 on iOS**: the same decisions as the web (fix-web-screening.md items 2, 3, 8, 9): direct
   2WW for rectal bleeding ≥ 50, ferritin cut-off 45 µg/L, age ≥ 50 as the post-menopausal stand-in,
   oral-iron wording, and the card showing the 1.1.0 criteria only.
10. **NG12 card placement and inputs**: Diagnosis tab; reads HPI, examination and assessment text
    and the associated-symptom chips; dismissal lasts for the app session only.
11. **Known-cancer suppression** also reads the working diagnosis on iOS (the web reads the
    assessment and past history).
12. **ABCD² removed from the TIA recommendations** (NICE NG128); NIHSS / mRS still recommended for TIA.
13. **Litres in the paediatric dose rule** — not changed here (item 4 dropped); noted for the agent
    porting `planSafety`: `suppressAdultDoses` does not treat "1 L" fluid volumes as doses, and it
    skips whole lines that mention urine output (so "Hartmann's 1 L stat then titrate to urine
    output" keeps the adult volume for a child).

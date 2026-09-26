# Change log — `whats-missing` (one ranked "What's missing" strip, web and iOS; score auto-fill from the record)

2026-09-26. Branch `whats-missing` (from `claude/pr-37-gbg22z` at `bbf323d`). Rule set `whats-missing` 1.0.0
in `clinical-content/registry.json`, status **needs sign-off**. Owner-approved item.

The engines already know many of the gaps in a record: NEWS2 lists the parameters it could not score,
each calculator needs its inputs, the decision layer lists "missing inputs that would change the
answer", the reasoning panel has a best next discriminator, and the NG12 screen asks for a ferritin.
They were shown in different places, often twice, and never ranked. This change gathers them into one
deterministic list per encounter, ranks it with a simple rule and shows the top five in one strip.

Everything is **deterministic** (no AI, no network). **Suggestions only:** an item's action goes to the
step or tool that records the value, or adds the test as a *suggested* investigation. Nothing is ordered,
prescribed or recorded automatically. The text is clinician-facing only (hazard H-10): no medicine is
started, held or stopped by it, and it carries no dose.

No score formula, diagnosis weight, `DiagnosticDatabase.json`, decision-layer content or
diagnostic-reasoning rule was changed. The outcomes / calibration work (new table, final-diagnosis
capture) was not touched.

## What the clinician sees

**Web** — a compact strip under the patient header on every consultation step (`WhatsMissingStrip`):

```
▾ WHAT'S MISSING (7)                                        ranked by impact · suggestions only
● Safety    Allergy status not recorded   Needed before prescribing — record the allergies or NKDA   [Record allergies] ×
● Safety    Renal function: eGFR not on file   Needed before morphine (renally cleared / NSAID) (+1)  [Add test]        ×
● Decision  Clinical Frailty Scale not recorded   May change Treat → Observe for elective …           [Open score]      ×
…
more… (2)
```

- Each line: tier dot, **what**, **why** (one line; the other engines' reasons are in the tooltip and
  counted as "(+n)"), one primary action, sometimes a second (pregnancy: "Add test" for a urine β-hCG,
  or "Record pregnancy status"), and "×" to dismiss for this session (kept in memory for the encounter,
  never stored).
- "Add test" adds the investigation through the existing suggested-order path; it is not ordered until
  the clinician confirms it in Investigations. Field actions open the step (Allergies, Medications, HPI,
  Examination for observations and weight, Scores for a score).
- Keyboard: every control is a button; Alt+M collapses / expands the strip. It hides itself when nothing
  is missing.

**iOS** — a compact row under the allergy status (the header safety strip) on every step
(`WhatsMissingRow`): the top item, its action and "+N"; tapping the row opens a sheet with the ranked
list (top five, "More…"), each item with its reasons, action(s) and "Dismiss". Field actions switch to
the step (Allergies, Meds, HPI, Exam) or open the Vitals / Scores tool over the current step.

**Score auto-fill ("from record").** The same record now pre-fills calculators on both platforms:

- Web Scales step: Alvarado, Wells PE, Wells DVT, CURB-65, Glasgow-Blatchford, RCRI, Caprini and BISAP
  (Tokyo was already done). Each field taken from the record carries a "from record" tag until the
  clinician changes it; the card lists the record inputs it needs that are not on file ("Not on file:
  urea, Hb"). The web has no AIR calculator, so AIR auto-fill is iOS only.
- iOS populators gain the fields they did not read: Alvarado neutrophils and examination findings, AIR
  WBC / neutrophil / CRP bands, BISAP urea, mental status from ACVPU and SIRS with WBC, pleural effusion,
  Wells PE heart rate and findings, Glasgow-Blatchford melaena / syncope / liver disease / heart failure,
  CURB-65 confusion from ACVPU. They are marked auto and leave the "needs attention" list.
- A value in the record is never listed as missing; it is pre-filled instead.

## Signals (every one comes from an engine that already existed)

| Tier | Signal | Condition | Group (de-duplication key) |
|---|---|---|---|
| Safety | Weight | age < 16 and no weight | `weight` |
| Safety | Allergy status | no allergy and no NKDA recorded | `allergy` |
| Safety | Pregnancy status | female 12–55, status not recorded (not pregnant / pregnant / post-partum / a pregnancy test result / hysterectomy / post-menopausal), and ionising imaging planned, a medicine planned or a procedure planned | `pregnancy` |
| Safety | eGFR | no eGFR and no creatinine, and a renally cleared or NSAID drug current or planned, or iodinated contrast planned | `renal` |
| Safety | Anticoagulant last dose | procedure planned, an anticoagulant on the list, no "last dose / held since …" written | `anticoag-last-dose` |
| Safety | Supplements question | procedure planned and the supplements question not asked | `supplements` |
| Decision | Decision-layer missing input | the decision layer lists it (CFS, ASA, eGFR, pregnancy, BMI, HAS-BLED, NEWS2) **and** re-running the same decision with an adverse value (CFS 7, ASA IV, eGFR 25, pregnant, BMI 42, HAS-BLED 3, NEWS2 7) changes an option's band | the input's group |
| Decision | Risk score not calculated | a risk decision needs its score (Glasgow-Blatchford, Caprini) | `score:<key>` |
| Decision | Ferritin | the NG12 / BSG ferritin prompt fires (microcytic anaemia, no ferritin) | `ferritin` |
| Decision | Best next discriminator | the reasoning panel's first discriminator, while no working diagnosis is confirmed | `discriminator` |
| Score | NEWS2 parameters | some observations recorded and some not; or none recorded in an emergency / inpatient / post-operative setting | `obs` |
| Score | Score inputs | record inputs (labs, observations, imaging, height / weight) of the recommended or recorded scores that are not on file: NEWS2, qSOFA, Alvarado, AIR, Glasgow-Blatchford, CURB-65, Wells PE / DVT, Caprini, RCRI, BISAP, TG18 cholecystitis and cholangitis | the concept's group (`fbc`, `crp`, `renal`, `lfts`, `coag`, `obs`, `imaging-us`, `weight`) |
| Score | Decision input that does not flip | listed by the decision layer, the probe changes no band ("Refines …") | the input's group |
| Score | Discriminator after confirmation | as above, once a working diagnosis is confirmed | `discriminator` |

"Recommended" scores are the web `getCdsSuggestions` list and iOS `DiagnosisScoreMapper`, plus any score
the clinician recorded. On iOS a medicine counts as planned when its prescription is dated today (ECT);
current medicines on the web are the medication list, planned ones the pending prescriptions and any
renally cleared drug or anticoagulant written in the plan.

## Ranking (explainable, lexicographic)

1. **Tier**: safety (cannot prescribe or dose safely without it) → decision (could change the leading
   decision) → score completeness.
2. **Within the tier**:
   - safety: a fixed order — weight under 16, allergy status, pregnancy status, renal function,
     anticoagulant last dose, supplements;
   - decision: a band flip first, the one **closest to its threshold** first (|P − treat threshold|), then
     a missing risk score, then ferritin, then the best next discriminator;
   - score: the input **needed by the most scores** first (NEWS2 counts as one), then "refines" items,
     then a discriminator after confirmation.
3. **Ties**: the rule file's group order.

**De-duplication**: signals that share a field or a test become one item with the best tier (urea for
BISAP and Glasgow-Blatchford and the NSAID's eGFR become one "Renal function: urea and eGFR not on file"
at safety tier; WBC and neutrophils become one FBC line; the decision layer's pregnancy input and the
safety pregnancy check become one). The other reasons stay in `also`.

Top 5 shown, the rest under "more…". Example lines (clinval): "Renal function: creatinine and eGFR not on
file — Needed before ibuprofen (renally cleared / NSAID)"; "Clinical Frailty Scale not recorded — May change
Treat → Observe for elective inguinal hernia repair (inguinal hernia (reducible, minimally symptomatic))".

## Replaced prompts

- **iOS**: the NG12 card (`SuspectedCancerSection`, Diagnosis step) no longer shows the ferritin check
  ("Anaemia work-up"): the row covers it (what, why, "Add test: Ferritin"). The suspected-cancer referral
  card is unchanged.
- **Web**: nothing to replace — `ClinicalPromptsStrip` (the web home of the ferritin prompt, β-hCG,
  NSAID-renal and anticoagulant prompts) is imported in `Home.tsx` but **not rendered** (a dead import
  since at least `e06d92d`). The strip is now the only place the web ferritin prompt reaches the
  clinician. See "Findings".
- Kept: the allergy banner / header allergy status, NEWS2 "incomplete" notes inside the calculators,
  the decision-support card's own "missing" lines and every safety alert.

## Files

| Part | Web | iOS |
|---|---|---|
| Rules (byte-identical) | `lib/pane-engine/src/whats-missing/whats-missing-rules.json` | `ios/AmiseMedFlow/Resources/WhatsMissingRules.json` |
| Core: ranking, merge | `lib/pane-engine/src/whats-missing/engine.ts` | `Services/WhatsMissingCore.swift` |
| Core: record fill | `record-fill.ts` | `Services/WhatsMissingCore+Fill.swift` |
| Core: decision probe | `decision-probe.ts` | `Services/WhatsMissingCore+Probe.swift` |
| Rules types / loader | `rules.ts`, `types.ts` | `Services/WhatsMissingRules.swift` |
| Record adapter | `artifacts/dashboard/src/lib/whats-missing-web.ts`, `whats-missing-app.ts` | `Services/WhatsMissingPatient.swift` |
| UI | `components/WhatsMissingStrip.tsx` in `Home.tsx`; Scales-step cards (`ScalesTab.tsx`) | `Views/Consultation/WhatsMissingRow.swift` in `ConsultationView`; populators via `PatientScoreAutoPopulator+RecordFill.swift` |
| Tests | `lib/pane-engine/src/__tests__/whats-missing.test.ts`, `artifacts/dashboard/src/lib/__tests__/whats-missing-web.test.ts`, `scripts/src/whats-missing-parity.test.ts` | `AmiseMedFlowTests/WhatsMissingTests.swift` |
| Shared vectors | `scripts/src/gen-whats-missing-vectors.ts` (`gen:whats-missing-vectors`) → `ios/AmiseMedFlowTests/WhatsMissing/whats-missing-vectors.json`: 24 fill, 5 probe, 18 rank, 9 term, 4 part vectors | same file |
| Harness | `web.missing` (`web-runner.ts`); expectation kinds `missing.top` / `mustInclude` / `mustExclude` (`grade.ts`, schema, README); vignette `orders` and `supplements` inputs | `ios.missing` (`ClinValIOSRunner.swift`), `ClinValGrader.swift`, `ClinValModels.swift` |

## Checks

- `pnpm run typecheck` ✓; `pnpm -r run test` ✓ (pane-engine 236, dashboard 875, api-server 600,
  front-desk 109, scripts 47); every scripts lint ✓ (`lint:grants`, `lint:rls-policies`,
  `check:migrations-fresh`, `lint:dx-phases`, `lint:patient-instructions`, `lint:no-external-qr`,
  `lint:interaction-parity`, `lint:report-import-parity`, `lint:guideline-registry` with the new entry;
  `scan:nav-lockout` warns on the new `topSection === 'consultation'` conditional for the strip, which
  holds only shortcuts to steps that stay reachable from the step bar, plus its two existing warnings);
  dashboard build ✓; `e2e/emr-walkthrough.mjs` 27/27 (one new check: the strip renders with the allergy
  status first) and `e2e/encounter-switch.mjs` 11/11 ✓.
- `clinval:web`: 433 vignettes, 3149 expectations — **2981 pass, 76 fail (all quality; 74 known gaps),
  0 critical fails, 0 blocking**. Against the base (425 vignettes, 3138 expectations: 2970 / 76 / 0):
  **no expectation changed status**; the 11 new expectations pass. Results files restored, not committed.
- **Swift was not compiled here.** Type names were grepped for collisions (`WhatsMissing*`,
  `mergeRecord` did not exist), argument labels follow declaration order, every call was checked against
  its declaration, and no `Color.opacity` is passed to `.background` / `.foregroundStyle`. The iOS
  vignette expectations are `unverified: ["ios"]` until an iOS CI run.

### New vignettes (`missing-*`, web pass, iOS unverified)

| Vignette | Top item |
|---|---|
| `missing-child-no-weight` | Height and weight not recorded (under 16) — above the missing allergy status |
| `missing-woman-30-ct-planned` | Pregnancy status not recorded — before ionising imaging (CT with contrast) |
| `missing-cholecystitis-no-wbc` | Full blood count: WBC and neutrophils not on file — needed for TG18 (and CRP listed; the ultrasound is on file so no imaging item) |
| `missing-nsaid-no-egfr` | Renal function: creatinine and eGFR not on file — before ibuprofen |
| `missing-anticoag-last-dose-colonoscopy` | Anticoagulant last dose not recorded — apixaban before colonoscopy |
| `missing-supplements-before-hernia-repair` | Herbs and supplements not asked — before an operation |
| `missing-ferritin-microcytic-anaemia` | Ferritin not on file — NG12 / BSG pathway |
| `missing-news2-partial-post-op` | Observations not recorded: RR, SpO₂, air/O₂ and ACVPU |

### Load on the 433 vignettes (web)

0 items in 59 vignettes, 1 in 136, 2 in 98, 3 in 77, 4 in 33, 5 in 16, 6 or more in 14 (mean 2.0). Top
item tier: safety 187, score 167, decision 20. The most common top items: "Herbs and supplements not asked"
119 (vignettes rarely record the answer and many plan a procedure), best next discriminator 81 (mostly
after confirmation, so score tier), renal function 71, full blood count 31, pregnancy status 29,
anticoagulant last dose 17.

## Findings (not changed here)

- **`ClinicalPromptsStrip` is not rendered on the web** (imported in `Home.tsx`, never placed), so the
  web's β-hCG, NSAID-renal, anticoagulant, ferritin, NG12 and preventive prompts from
  `computeClinicalPrompts` reach clinicians only through the harness. Deciding whether to render it is
  outside this change.
- The decision layer asks for pregnancy status when sex is not recorded ("unknown"); the strip then shows
  a "Refines …" pregnancy item for a patient of unknown sex (seen in the e2e walkthrough patient).
- iOS has no way to tell a current medicine from one prescribed in this visit; "prescribed today (ECT)"
  is the rule here. The iOS harness dates vignette medicines 30 days back.
- `appendicitis-adult-typical/score-alvarado-autofill` (iOS known gap: "auto-fill reads only temperature
  and WBC") should now pass on iOS (migration, anorexia, nausea, RIF tenderness, rebound, fever and WBC
  are read: 9/10). Leave the flag until an iOS run shows it resolved.

## Needs sign-off

Nothing here has had a clinical review; `lastReviewed` stays `unknown`.

1. **Ranking rule**: safety → decision → score; within safety the fixed order weight (under 16) →
   allergy → pregnancy → renal function → anticoagulant last dose → supplements. In particular:
   **weight before allergy status in a child**, and the supplements question and the anticoagulant's
   last dose counted as safety-critical (they top 136 of 433 vignettes).
2. **Decision-gap probe values** (the "worst plausible" value used to ask "would it change the
   answer?"): CFS 7, ASA IV, eGFR 25, pregnant, BMI 42, HAS-BLED 3, NEWS2 7; a probe that changes no band
   demotes the input to score completeness ("Refines …").
3. **Discriminator placement**: in the decision tier only while no working diagnosis is confirmed; after
   confirmation it ranks after score completeness.
4. **NEWS2 rule**: a partial set always lists the missing parameters; no observations at all are listed
   only in an emergency, inpatient or post-operative setting. ACVPU and air / oxygen count as parameters
   (not recorded = missing, as H-04 already decided).
5. **Safety thresholds and scopes**: pregnancy 12–55 (female) with ionising imaging, a planned medicine
   or a planned procedure; weight under 16 regardless of a planned drug; allergy status always; what counts
   as a recorded pregnancy status (a pregnancy test result, "not pregnant", post-partum, hysterectomy,
   post-menopausal).
6. **Term lists** in the rules JSON: renally cleared / NSAID drugs (including morphine, tramadol,
   gabapentin, pregabalin, DOACs, LMWH, metformin, aminoglycosides, vancomycin, nitrofurantoin, lithium,
   digoxin, aciclovir, trimethoprim, co-trimoxazole, methotrexate), anticoagulants, ionising imaging and
   contrast terms, "last dose" wording, insulin names, the history and examination-finding terms used for
   auto-fill (read negation-aware; ≤ 4-character terms as whole words).
7. **Auto-fill thresholds** (from each score's source; formulas unchanged): Alvarado temperature
   ≥ 37.3 °C (web label changed from "> 37.3" to "≥ 37.3", Alvarado 1986), WBC > 10, neutrophils > 75 %;
   AIR temperature ≥ 38.5 °C, PMN 70–84 / ≥ 85 %, WBC 10–14.9 / ≥ 15, CRP 10–49 / ≥ 50; Glasgow-Blatchford HR
   > 100; CURB-65 urea > 7, RR ≥ 30, SBP < 90 or DBP ≤ 60, age ≥ 65, ACVPU other than Alert = confusion;
   Wells PE HR > 100; Caprini BMI > 25 and age bands 41–60 / 61–74 / ≥ 75; RCRI creatinine > 177 µmol/L;
   BISAP urea > 8.9 mmol/L, age > 60, SIRS decided from the known criteria (temperature < 36 / > 38, HR > 90,
   RR > 20, WBC < 4 / > 12). Units read as the iOS populators already did (WBC > 100 → cells/µL,
   Hb > 25 → g/L, creatinine < 15 → mg/dL, urea > 50 → BUN mg/dL); a neutrophil count ≤ 20 is read as
   ×10⁹/L and converted with the WBC. Recent surgery: ≤ 28 days (Wells PE), ≤ 84 days (Wells DVT).
8. **Findings filled from text** (affirmed only, never "false"): migration, anorexia, nausea / vomiting,
   RIF pain / tenderness, rebound, melaena, syncope, haemoptysis, DVT signs, confusion; history: cancer,
   DVT / PE, heart failure, IHD, cerebrovascular disease, insulin-treated diabetes, liver disease, IBD,
   varicose veins, OCP / HRT, immobility.
9. **Actions**: "Add test" names — "Urine pregnancy test (β-hCG)", "U&E with creatinine and eGFR",
   "Full blood count (FBC)", "C-reactive protein (CRP)", "Liver function tests (LFTs)",
   "Prothrombin time (PT/INR)", "Ultrasound abdomen (RUQ)", "Ferritin" — added as suggested (web: the
   suggested-order path; iOS: an investigation with status "Suggested", noted "(what's missing)").
10. **Wording** of every what / why line (`text` and `groups` in the rules JSON).
11. **Replacement**: the iOS NG12 card no longer shows the ferritin check (the row carries it).

## Not done / follow-ups

- iOS compile and the iOS vignette run (next iOS CI).
- A web AIR calculator (the core already fills AIR; iOS only today).
- Structured "planned" medicine and last-dose fields on both platforms (text and dates are used now).
- Rendering (or retiring) the web `ClinicalPromptsStrip`, then replacing its duplicates with the strip.

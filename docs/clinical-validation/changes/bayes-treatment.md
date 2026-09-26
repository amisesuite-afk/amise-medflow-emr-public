# Change log — `bayes-treatment` (decision support: score → action, result → action, treatment thresholds)

2026-09-25. Branch `bayes-treatment` (from `claude/pr-37-gbg22z`). Rule set
`treatment-decision-support` 1.0.0 in `clinical-content/registry.json`, status **needs sign-off**.

This adds a deterministic decision layer, cited per number, to the Plan step on the web and on iOS.
The web and iOS engines are twins and run the same test vectors. There is no AI and no network call.
**Suggestions only:** nothing is added to the plan, ordered or prescribed until a clinician taps
"Add to plan" or "Add test". "Dismiss" hides an item for that encounter view only; it is not stored.
The plan-safety filters (web `planSafety` `adaptPlanText`, iOS `PlanSafetyFilter.adaptLine`) run on
every line and stay the final hard filter. If the filter withholds an option, the option is shown
as "not for this patient" and is never ranked. The text is clinician-facing only (hazard H-10).

This change did not alter any score formula, any diagnosis weight, `DiagnosticDatabase.json` or the
diagnostic reasoning panel (web Assessment step / iOS Diagnosis step, which another change owns).
The Plan-side "Test further" band links only loosely to that panel's best next test, through a
provider hook (`decision-support-links.ts` / `DecisionSupportLinks.bestNextTest`). When that panel
does not register the hook, the band shows the decision's own test.

## What the clinician sees

A card titled **"Decision support — clinician decides"**. On the web it sits on the Plan step and,
in compact form, in the management panel whenever a patient is open. On iOS it is on the Plan tab,
above the lifestyle section. It has three parts:

1. **Score actions.** Each recorded score gets a card with the guideline action for its band and a
   citation. A trigger chip shows the score and its value, e.g. "GBS 7" or "qSOFA 2". There are 21 score sets: Glasgow-Blatchford, Rockall (full and pre-endoscopy),
   Alvarado, AIR, TG18 cholecystitis and cholangitis grade, Wells PE and DVT, CURB-65, NEWS2
   (including the single-parameter-3 band), qSOFA, Caprini, RCRI, Glasgow-Imrie, BISAP, Ranson,
   LRINEC, HAS-BLED, CFS and ABCD2.
   - How scores are recorded: on the web, a score counts once the clinician taps "Use in decision
     support" on the Scales-step calculator or the TG18 cholecystitis score card. It is stored in
     the encounter's `clinical_scores` under `decisionScores`. NEWS2 (at least 4 parameters) and
     qSOFA are also read from the vitals.
   - On iOS the stored calculator scores are used in the same way.
2. **Result actions.** A resulted value that crosses a cited threshold gets a card showing the
   value, the threshold and the action. The 8 thresholds:
   - lipase ≥ 3 × the upper limit of normal (ULN); amylase ≥ 3 × ULN, not shown when lipase
     already fires;
   - troponin above the upper reference limit;
   - lactate ≥ 4 and lactate 2 to < 4;
   - K⁺ ≥ 6.5 and K⁺ 6.0 to < 6.5;
   - Hb < 70 g/L.

   **"Which result moved it":** a line under the card shows how the resulted investigations moved
   the differential, in the form "P(<diagnosis>) <before> → <after> — moved most by <result>". On the
   web this replays the PANE posterior without the result-only features, then leaves each result
   out in turn. On iOS it re-runs `BayesianDiagnosisEngine.infer` without the resulted
   investigations, then leaves each out in turn (up to 6).
3. **Treatment decisions**, up to 4, for the leading diagnoses or risk triggers. There are 11:
   - appendicitis; cholecystitis; uncomplicated diverticulitis;
   - upper GI bleeding (risk taken from GBS);
   - pulmonary embolism (pretest probability from Wells PE; CTPA as the test);
   - VTE prophylaxis (triggered by a Caprini score);
   - sepsis antibiotic timing; elective inguinal hernia repair;
   - same-admission cholecystectomy after gallstone pancreatitis;
   - emergency laparotomy;
   - peri-procedural bridging (triggered by an anticoagulant plus a planned procedure).

   Each decision shows:
   - the trigger chip, i.e. where P came from: "Confirmed: <diagnosis>", a pre-test score
     ("<score> <value> → <P> pre-test"), the engine's differential ("P(<diagnosis>) <P>") or a risk
     score ("<score> <value> → <P> <risk label>");
   - for each option, a **threshold bar** with the patient's P marked against the observe / test /
     treat zones, and the band as text: *Treat*, *Test further* (with the test) or *Observe*;
   - **Borderline** when the band changes across the pessimistic, point and optimistic estimates;
   - a **Low evidence** flag when an effect is an estimate rather than a guideline number;
   - the **personalised factors** that moved the threshold (top 3), with the treatment threshold
     before and after them ("treat threshold 19% → 41%");
   - **missing inputs** that would change the answer, e.g. "CFS not recorded";
   - options that are **not for this patient**, with the reason (a contraindication in the content,
     or withheld by the plan-safety filter);
   - "Add to plan", "Add test" (web: added to the orders through the existing suggested-order path;
     iOS: added as an investigation with status "suggested", noted as "for <decision> (decision
     support)"), and "Dismiss".

## How the numbers are made

- **Thresholds** (Pauker and Kassirer 1980):
  - treatment threshold T = H / (H + B);
  - test threshold Tt = ((1−Sp)·H + R) / ((1−Sp)·H + Se·B);
  - test-treatment threshold Ttx = (Sp·H − R) / (Sp·H + (1−Se)·B).

  B is the absolute benefit if the disease is present, H the absolute harm if it is absent, Se and
  Sp the test's sensitivity and specificity, and R the test's own harm. If there is no test, or
  Tt ≥ Ttx, the plain treatment threshold is used. If B ≤ 0, T = 1, so the band is always Observe.
- **Personalisation:**
  - Harm: each active modifier's odds ratio multiplies the harm on the odds scale; the result is
    capped at 0.99.
  - Benefit: B′ = B × benefitX + benefitAdd − ΔH. ΔH is the extra harm the modifiers add, because
    that harm also falls on patients who have the disease.
  - Ranges: the low estimate uses the high ΔH and the high estimate the low ΔH.
  - A modifier can **exclude** an option. Examples: major surgery within 3 weeks excludes systemic
    thrombolysis; a DOAC excludes bridging; severe pancreatitis excludes same-admission
    cholecystectomy; therapeutic anticoagulation excludes prophylactic LMWH.
  - Factor attribution is leave-one-out on the treatment threshold.
- **Where P comes from:**
  1. A confirmed diagnosis (the web's locked working diagnosis or recorded ICD codes; the iOS
     working diagnosis) gives P = max(0.95, engine P). It also suppresses the engine's other
     differentials (the `managementPanelSource` rule).
  2. Otherwise a pretest score band (Wells PE).
  3. Otherwise the engine's probability, if it is at least 10%.
  4. Risk decisions use the risk band of their score (GBS, Caprini). Bridging uses a baseline risk
     plus the high-risk factors (mechanical valve, VTE within 3 months).
- **Ranking:** options are ranked by net benefit P·B − (1−P)·H. Options that are not for this
  patient get no rank.
- **Rounding:** percentages and values are formatted identically on both platforms. Swift uses
  `floor(x + 0.5)` to match JavaScript's `Math.round`.

## Files

| Part | Web | iOS |
|---|---|---|
| Content (byte-identical) | `lib/pane-engine/src/decision/treatment-decisions.json` | `ios/AmiseMedFlow/Resources/TreatmentDecisions.json` |
| Engine | `lib/pane-engine/src/decision/{types,engine,index}.ts` | `Services/BayesianDecisionEngine+Treatment.swift`, `+TreatmentTypes.swift`, `TreatmentDecisionContent.swift` |
| Record adapter | `artifacts/dashboard/src/lib/decision-support.ts`, `decision-support-links.ts` | `Services/DecisionSupportPatient.swift` |
| UI | `components/DecisionSupportPanel.tsx`, `RecordScoreButton.tsx`; `PlanTab`, `ManagementPanel`, `ScalesTab`, `ClinicalScoresPanel` | `Views/Consultation/DecisionSupportSection.swift`, in `ConsultationView+PlanTab.swift` |
| Tests | `lib/pane-engine/src/__tests__/decision.test.ts`, `artifacts/dashboard/src/lib/__tests__/decision-support.test.ts`, `scripts/src/decision-content-parity.test.ts` | `AmiseMedFlowTests/TreatmentDecisionTests.swift` |
| Shared vectors | `scripts/src/gen-decision-vectors.ts` (`pnpm --filter @workspace/scripts run gen:decision-vectors`) → `ios/AmiseMedFlowTests/DecisionSupport/decision-vectors.json` (32 vectors) | same file |
| Validation harness | `scripts/src/clinval/web-runner.ts` → `web.decisions`, `.notForPatient`, `.shift` | `ClinValIOSRunner.swift` step 9 → `ios.decisions`, `.notForPatient`, `.shift` |

The parity test fails in three cases: the two JSON copies differ; the vectors are stale (regenerate
them with `gen:decision-vectors`); or a JSON key has no field in the Swift content structs.

There are 16 new vignettes, `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/decision-*.json`,
each with `unverified: ["ios"]`. They cover:
- frail vs fit cholecystitis (drainage vs early LC);
- appendicitis in pregnancy (surgery first);
- uncomplicated vs immunosuppressed / penicillin-allergic diverticulitis;
- Wells-unlikely PE (test first), and post-operative PE (thrombolysis not for this patient);
- Caprini low (mechanical) vs high on a DOAC (LMWH not for this patient);
- GBS 0–1 vs GBS high with shock;
- severe gallstone pancreatitis (defer cholecystectomy);
- frail hernia (watchful waiting);
- sepsis with lactate 4 and shock;
- warfarin for AF (no bridging) vs a mechanical valve (bridging).

## Verification

- pane-engine vitest checks the shared vectors, the personalisation cases, the threshold arithmetic
  and content hygiene: every number cites a source, ranges are ordered, there are no fixed doses,
  and no hospital is named.
- Dashboard vitest (15 new tests) confirms that plan-safety is the final filter, that negated
  history is read correctly ("no immunosuppression" does not set the factor), that recorded scores
  are used, and that the shift readout is right.
- scripts vitest runs the parity test.
- `clinval:web` over 413 vignettes gives 2956 pass and 76 fail. All 76 failures are the known
  known-gap or quality failures that were there before this change: 0 blocking and no pass → fail.
  All 37 new decision expectations pass on the web.
- **iOS was not compiled here** (no toolchain in this environment). The Swift was checked by hand:
  new type names were grepped for collisions and call labels checked against their declarations,
  and the `Color.opacity` patterns were avoided. `TreatmentDecisionTests` runs the same vectors, and
  the iOS vignettes stay `unverified: ["ios"]` until an iOS CI run.

## Needs sign-off

Every number was **written from memory**: all 74 sources are `fromMemory: true`, and nearly every
effect size is tagged `evidence: "estimate"`. Check each against the cited source before relying on
any of it. `lastReviewed` stays `unknown`.

1. **Treatment effects and harms** (B and H, as low / point / high). All are estimates:

   | Decision | Option | B (low / point / high) | H (low / point / high) |
   |---|---|---|---|
   | Appendicitis | appendicectomy | .20 / .30 / .40 | .02 / .03 / .05 |
   | Appendicitis | antibiotics-first | .14 / .22 / .30 | .01 / .015 / .03 |
   | Cholecystitis | early LC | .20 / .30 / .40 | .04 / .07 / .10 |
   | Cholecystitis | percutaneous cholecystostomy | .15 / .22 / .30 | .02 / .04 / .07 |
   | Cholecystitis | antibiotics / supportive | .08 / .12 / .18 | .01 / .02 / .03 |
   | Diverticulitis | antibiotics | −.01 / 0 / .02 | .01 / .02 / .03 |
   | Diverticulitis | admission | −.01 / 0 / .02 | .01 / .02 / .04 |
   | Upper GI bleed | admission and endoscopy within 24 h | .30 / .50 / .70 | .002 / .004 / .008 |
   | Upper GI bleed | endoscopy within 12 h | 0 / 0 / .10 | .005 / .01 / .02 |
   | Pulmonary embolism | anticoagulation | .10 / .20 / .30 | .008 / .015 / .025 |
   | Pulmonary embolism | thrombolysis | −.07 / −.04 / −.01 | .05 / .07 / .10 |
   | VTE prophylaxis | LMWH | .60 / .70 / .80 (relative reduction × risk) | .006 / .012 / .02 |
   | VTE prophylaxis | mechanical | .30 / .50 / .60 | .001 / .002 / .005 |
   | Sepsis | antibiotics within 1 h | .02 / .04 / .08 | .01 / .02 / .03 |
   | Inguinal hernia | elective repair | .03 / .08 / .20 | .01 / .02 / .04 |
   | Gallstone pancreatitis | same-admission cholecystectomy | .07 / .12 / .17 | .01 / .02 / .04 |
   | Emergency laparotomy | emergency laparotomy | .30 / .50 / .70 | .04 / .08 / .12 |
   | Peri-procedural bridging | LMWH bridging | .20 / .50 / .70 | .01 / .019 / .03 |

   Several were tuned after sanity runs so the bands match the guideline answer: early LC, admission
   for diverticulitis, hernia repair and LMWH. With them, a frail patient is steered to drainage,
   Caprini 1 to mechanical prophylaxis, and a fit patient with uncomplicated diverticulitis to
   observation. Please confirm that these are the answers you want.
2. **Test characteristics:**

   | Decision | Test | Se | Sp | Harm |
   |---|---|---|---|---|
   | Appendicitis | CT | 0.95 | 0.94 | 0.001 |
   | Cholecystitis | ultrasound | 0.81 | 0.83 | 0 |
   | Pulmonary embolism | CTPA | 0.83 | 0.96 | 0.001 |
3. **The 28 global and 15 decision-specific modifiers.**
   - Harm odds ratios for:
     - age 65–79 and ≥ 80;
     - CFS 5–6 and ≥ 7;
     - ASA III and ≥ IV;
     - eGFR 30–59 and < 30;
     - anticoagulant, antiplatelet, HAS-BLED ≥ 3;
     - pregnancy, penicillin allergy, diabetes, immunosuppression;
     - BMI ≥ 40, NEWS2 ≥ 7, shock.
   - Benefit multipliers and additions: appendicolith and pregnancy for antibiotics-first; shock
     for sepsis timing; the diverticulitis admission factors; shock for 12-hour endoscopy and for
     thrombolysis.
   - Exclusions: recent surgery → thrombolysis; DOAC → bridging; severe pancreatitis →
     same-admission cholecystectomy; therapeutic anticoagulation → prophylactic LMWH.

   Every odds ratio and addition is an estimate. The exclusions follow the cited guidelines.
4. **Risk bands.**
   - GBS: 0–1 → 0.4%, 2–5 → 10%, 6–11 → 35%, ≥ 12 → 70% risk of needing an intervention.
   - Caprini: 0 → 0.4%, 1–2 → 1.5%, 3–4 → 3%, ≥ 5 → 6% VTE risk.
   - Wells PE: ≤ 4 → 12%, > 4 → 37%.
   - Bridging:
     - baseline thromboembolic risk 0.4%;
     - mechanical valve **5% (an estimate, weighted for valve thrombosis)**;
     - VTE within 3 months 5%.
5. **Engine rules:**
   - a confirmed diagnosis floor of 0.95;
   - a minimum engine probability of 10% before a decision is shown;
   - at most 4 decisions;
   - a confirmed diagnosis suppresses the engine's other differentials;
   - "severe" in a confirmed pancreatitis diagnosis sets predicted-severe;
   - "femoral" in the diagnosis excludes the inguinal hernia decision (so femoral hernias in women
     are not offered watchful waiting).
6. **Net-benefit simplification:** extra harm from patient factors is taken off the benefit as
   well, i.e. it is assumed to fall on patients with the disease too (`harmInDiseased` defaults to
   true).
7. **Default ULNs** (lipase 60 U/L, amylase 100 U/L, hs-troponin T 14 ng/L) are placeholders. The
   card tells the clinician to use the local laboratory's range. Please give the practice's
   laboratory ranges.
8. **Wording:** the qSOFA ≥ 2 and lactate ≥ 4 actions are written conditionally ("If suspected
   infection, sepsis bundle now…"), so they do not assert sepsis in a patient who has, for example,
   bleeding or ischaemia.
9. **Recording scores for decision support:** "Use in decision support" writes the calculator
   value to `clinical_scores.decisionScores` on the encounter. This is a new stored field in an
   existing JSON column; no migration is needed.
10. **"Add test"** adds to the orders on the web (the existing suggested-order path) and adds an
    investigation with status "suggested" on iOS. Please confirm that this is acceptable, or
    whether iOS should create an order instead.
11. **For the differential owners (not changed here):** the shift readout showed PANE moving
    toward HHS on a raised glucose in a septic patient. That comes from the PANE weights, which this
    change does not alter.
12. **iOS runner:** `ClinValIOSRunner` reads `postOpDays` from the encounter to set "recent surgery
    within 21 days". Please confirm that this matches how post-op day is recorded in the app.

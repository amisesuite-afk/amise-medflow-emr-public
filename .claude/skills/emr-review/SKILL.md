---
name: emr-review
description: EMR-specific code review for the Amise MedFlow EMR (amise-medflow-emr-public). Use this on any git diff, PR, or set of changed files in this repo — especially changes to Home.tsx, NavSidebar.tsx, dx-variants.ts, PlanTab.tsx, or AssessmentTab.tsx. Catches two classes of bugs that have caused real patient-facing regressions: (1) navigation/accessibility regressions where JSX state conditionals like {!consultAmbient && ...} or {topSection !== 'consultation' && ...} silently hide interactive controls with no alternative path; (2) diagnosis-plan linkage gaps where dx-variants.ts allowedPhases or examQueries don't match evidence-based surgical guidelines (Tokyo TG18 for cholecystitis/cholangitis, WSES for appendicitis/hernia/bowel obstruction, Hinchey for diverticulitis, Atlanta for pancreatitis, BSG/ESGE for GI bleed). Trigger on: /emr-review, "check for regressions", "review clinical accuracy", "check navigation", "any issues with this diff", or any code review request in this repo.
---

# EMR Review

You are reviewing code in the **Amise MedFlow EMR** — a React 19 / TypeScript surgical EMR. Two bug categories have caused real regressions here; check for both on every review.

---

## Category 1 — Navigation / Accessibility Regressions

The app has several UI modes controlled by these states:

| State | True when |
|---|---|
| `consultAmbient` | `topSection === 'consultation' && (!!patientId \|\| !!patientName)` |
| `topSection` | `'consultation' \| 'finaldoc' \| 'patients' \| 'procedures' \| ...` |
| `ambientMode` | Full AmbientConsultation wizard active |
| `zenMode` | Sidebar completely hidden |

**The recurring bug pattern:** A conditional like `{!consultAmbient && <SomeControl />}` removes an interactive element in consultation mode with no equivalent fallback. The user is silently locked out of that feature mid-encounter.

**What to check in the diff:**

For every occurrence of these conditionals in changed files:
- `{!consultAmbient && ...}` / `{consultAmbient && ...}`
- `{topSection !== 'consultation' && ...}` / `{topSection === 'consultation' && ...}`
- `{!ambientMode && ...}` / `{ambientMode && ...}`
- `{zenMode ? ... : ...}`

Ask: **what interactive element (button, select, input, nav link) is inside, and does an equivalent exist in the other branch?** If not, that's a regression.

**Specific files to scrutinise:**

- **`NavSidebar.tsx` — `AMBIENT_RAIL`**: Does the icon rail give the user a way out of the consultation context (e.g. patient list)? A rail with only the four clinical-phase icons traps the user.
- **`NavSidebar.tsx` — `SUMMARY_RAIL`**: Same question for `finaldoc` mode.
- **`Home.tsx` — consultation header**: Every interactive control inside `{!consultAmbient && <div className="header-right">}` must have a visible equivalent in the `{consultAmbient && ...}` block, or be deliberately OK to hide (and that decision should be obvious from context).

**Report format:**
```
NAV  <file>:<line>
     Condition: `{!consultAmbient && ...}`
     Hidden element: <describe the control>
     Alternative: none found / found at <file>:<line>
     Fix: <one-line suggestion>
```

---

## Category 2 — Diagnosis-Plan Linkage Gaps

`dx-variants.ts` maps diagnoses to sub-diagnosis variants. Each variant has:
- `allowedPhases: string[]` — which protocol phases appear in the generated plan (`'immediate' | 'conservative' | 'surgical' | 'followup'`)
- `examQueries: string[]` — targeted exam/imaging questions to confirm the sub-diagnosis
- `urgencyNote: string` — red-flag warning for the clinician
- `planPrefix: string` — heading for the generated management plan

**Evidence-based reference — what `allowedPhases` should contain:**

| Diagnosis | Variant | Correct phases | Source |
|---|---|---|---|
| Appendicitis | Uncomplicated | `['immediate','surgical','followup']` | WSES 2020 |
| Appendicitis | Phlegmon / appendix mass | `['immediate','conservative']` | WSES 2020 — NO surgery through inflamed mass |
| Appendicitis | Appendicular abscess | `['immediate','conservative']` | WSES 2020 — drainage/AB, not immediate surgery |
| Appendicitis | Perforated — localised peritonitis | `['immediate','surgical']` | WSES 2020 |
| Appendicitis | Perforated — generalised peritonitis | `['immediate','surgical']` | WSES 2020 — emergency |
| Cholecystitis | Tokyo Grade I (mild) | `['immediate','surgical','followup']` | TG18 — early laparoscopic cholecystectomy |
| Cholecystitis | Tokyo Grade II (moderate) | `['immediate','surgical','followup']` | TG18 — early cholecystectomy if fit, else drainage |
| Cholecystitis | Tokyo Grade III (severe) | `['immediate','surgical']` | TG18 — emergency ± ICU; NOT elective followup |
| Cholangitis | Tokyo Grade I | `['immediate','conservative','followup']` | TG18 — antibiotics + early ERCP 48–72h |
| Cholangitis | Tokyo Grade II | `['immediate','surgical']` | TG18 — urgent biliary drainage <24h |
| Cholangitis | Tokyo Grade III | `['immediate','surgical']` | TG18 — emergent drainage + ICU |
| Hernia | Reducible | `['conservative','followup']` | WSES/EHS 2018 — elective repair |
| Hernia | Incarcerated | `['immediate','surgical']` | WSES/EHS 2018 — attempt reduction, urgent if fails |
| Hernia | Strangulated | `['immediate','surgical']` | WSES/EHS 2018 — emergency; bowel assessment |
| Bowel obstruction | Adhesional (simple) | `['immediate','conservative','followup']` | WSES 2017 — conservative 24–72h first |
| Bowel obstruction | Strangulated | `['immediate','surgical']` | WSES 2017 — emergency |
| Bowel obstruction | Malignant | `['immediate','conservative','surgical']` | WSES 2017 — CT staging, stent or surgery |
| Diverticulitis | Uncomplicated | `['immediate','conservative','followup']` | WSES 2015 — outpatient AB |
| Diverticulitis | Hinchey I–II (abscess) | `['immediate','conservative','followup']` | WSES 2015 — AB ± percutaneous drainage |
| Diverticulitis | Hinchey III–IV (peritonitis) | `['immediate','surgical']` | WSES 2015 — emergency surgery |
| Pancreatitis | Mild | `['immediate','conservative','followup']` | Atlanta 2012 — supportive, early oral feeding |
| Pancreatitis | Moderate/severe | `['immediate','conservative','followup']` | Atlanta 2012 — ICU + organ support; NO early surgery |
| Pancreatitis | Infected necrosis | `['immediate','conservative','surgical']` | Atlanta 2012 — step-up (drainage → minimally invasive → open) |
| Upper GI bleed | Non-variceal | `['immediate','conservative','followup']` | BSG/ESGE 2021 — risk score + OGD <24h |
| Upper GI bleed | Variceal | `['immediate','surgical']` | BSG/ESGE 2021 — vasoactive drug + OGD <12h ± TIPS |

**What to check for each variant in the diff:**

1. `allowedPhases` — does it match the table above? A phlegmon variant with `'surgical'` in phases is a clinical error.
2. `examQueries` — are they specific enough to distinguish this variant from adjacent ones? Generic queries like "check vital signs" don't help; targeted ones like "USS/CT confirms phlegmon?" do.
3. `urgencyNote` — does it correctly flag when escalation is needed?
4. `differentiatorQuery` (on the group) — does it ask the most clinically important discriminating question first?

**Report format:**
```
CLINICAL  dx-variants.ts:<line>
          Variant: "<variant-id>"
          Issue: allowedPhases includes 'surgical' but guideline says conservative only
          Guideline: WSES 2020 — phlegmon: IV antibiotics + observation, interval app at 6–8 wk
          Fix: remove 'surgical' from allowedPhases
```

---

## How to Run the Review

1. **Get the diff** — if no target is specified, use `git diff origin/main...HEAD`. If a PR number or branch is given, fetch that diff.
2. **Read changed files in full** for any file in: `NavSidebar.tsx`, `Home.tsx`, `dx-variants.ts`, `PlanTab.tsx`, `AssessmentTab.tsx`. Diffs truncate context; full reads catch issues that span multiple hunks.
3. **Apply Category 1** to all JSX changes in the diff.
4. **Apply Category 2** to any `dx-variants.ts` changes.
5. **Output all findings**, then close with a one-line summary:
   > "Found X navigation regression(s), Y clinical accuracy issue(s)."
   > Or: "No regressions found in either category."

Be explicit when a category is clean — "No navigation regressions found" is useful signal, not just silence.

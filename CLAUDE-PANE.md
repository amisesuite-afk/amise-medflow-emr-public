# PANE — Probabilistic Adaptive Next-question Engine

## Purpose

PANE is a Bayesian CDS (Clinical Decision Support) layer built on top of the existing MedFlow EMR.
It maintains a posterior probability distribution over differential diagnoses and uses information
gain to select the most diagnostically useful next question.

## Principles

- **Pure functions**: no side effects, no API calls — runs entirely in browser
- **Stack-agnostic**: engine code has zero React/DOM dependencies
- **Additive**: augments the existing rule-based triage; does not replace it
- **Conservative priors**: calibrated to Amise Medical Services surgical OPD (Saint Lucia)

## Architecture

```
lib/pane-engine/                       ← pure TypeScript, zero framework deps
  src/
    types.ts                           ← Feature, DiseaseNode, PaneState
    constants.ts                       ← CONVERGENCE_THRESHOLD, MAX_QUESTIONS
    engine/
      bayes.ts                         ← initPaneState, updatePosterior
      infoGain.ts                      ← nextBestQuestion, isConverged, topDiagnoses
    vademecum/
      appendicitis.ts                  ← seed disease 1
      cholecystitis.ts                 ← seed disease 2
      pepticUlcer.ts                   ← seed disease 3
      index.ts                         ← DISEASES + FEATURES registries
    __tests__/
      bayes.test.ts                    ← vitest unit tests
      infoGain.test.ts
    index.ts                           ← public exports

artifacts/dashboard/src/hooks/usePane.ts  ← React wrapper hook
```

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| P0 | Types, Bayes engine, info-gain, 3 seed diseases, `usePane` hook, tests | ✅ Done |
| P1 | 10 more diseases (GORD, IBD, hernia, pancreatitis, cholangitis, diverticulitis, …), UI integration | Pending |
| P2 | Age/sex prior modifiers, Supabase audit log, differential → assessment export | Pending |

## Math

**Bayesian update** for each disease D_i after observing feature F = observed:

```
P(D_i | F) ∝ P(F | D_i) × P(D_i)
```

Where:
- `P(F=1 | D_i)` = `features[featureId]` (sensitivity for that disease)
- `P(F=0 | D_i)` = `1 − sensitivity`
- Features not listed in a disease node default to `DEFAULT_SENSITIVITY = 0.30`
- An implicit `_other_` node (prior = 0.67) ensures posteriors always sum to 1

**Information gain** for an unanswered feature F:

```
P̂(F=1) = Σ_i  P(F=1 | D_i) × P(D_i | evidence)
IG(F)   = H(current) − [ P̂(F=1) × H(after F=1) + P̂(F=0) × H(after F=0) ]
```

Shannon entropy: `H = −Σ p × ln(p)`

## Running tests

```bash
pnpm --filter @workspace/pane-engine run test
```

## Important constraints

- Disease priors are rough estimates for a surgical OPD in Saint Lucia; not validated
  for population-level triage. Always present as decision *support*, not diagnosis.
- The engine must never surface raw probability numbers to patients — only to clinical staff.
- Forbidden-content rules from the main CLAUDE.md (no diagnoses to patients, no drug doses)
  apply to any text derived from PANE output.

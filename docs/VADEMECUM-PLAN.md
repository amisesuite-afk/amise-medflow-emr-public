# Vademecum plan — one disease-centred knowledge base and a hypothetico-deductive loop

Status: **phase 1 delivered in shadow** (2026-09-26, branch `vademecum-phase1`). Nothing in production
reads the vademecum. Every value is written from memory or converted from the existing engines, and
awaits clinical sign-off (`docs/clinical-validation/changes/vademecum-phase1.md`). Shadow results:
`docs/clinical-validation/VADEMECUM-PHASE1.md`.

## Why

Today each platform carries its own diagnostic knowledge: PANE's disease modules (P(finding | disease)
per feature), the iOS `DiagnosticDatabase.json` (log-LR per complaint pool), the history frames, the
Exam-step signs, decision rules, the TG18 / NG12 helpers, and hand-written chip → feature mappings
between them. A finding added in one place is invisible to the others, and the questions the
consultation asks are not generated from what the engine needs to know.

The owner-approved direction is one canonical, disease-centred vademecum read by both platforms,
and one loop that works the way a clinician does:

1. The chief complaint — or any result recorded first (a sign, a laboratory value, an imaging or
   pathology report, a score) — brings up the candidate diagnoses, including the can't-miss ones.
2. Each candidate's whole profile is recalled (history, examination, scores, investigations).
3. The next question is the most discriminating unanswered item at the current level.
4. Every answer recomputes the posterior; the loop moves level by level (history → examination →
   scores → investigations) and can go back from a result to the history and examination.
5. It stops when the leading diagnosis crosses its treat threshold, or when no remaining question can
   move the leader or a can't-miss diagnosis across a test or treat threshold (the decision layer).

Formal criteria (TG18, Atlanta, JBDS, NG12, Rome IV …), pathognomonic findings, hard exclusions and
incidental-finding work-ups sit beside the Bayesian layer (the hybrid layer) and never auto-diagnose.

## Phase 1 (done, shadow)

| Part | Where |
|---|---|
| Format and schemas | `clinical-content/vademecum/{findings,abdominal-pain,cough-breathlessness}.json`, `clinical-content/schemas/vademecum-{findings,area}.schema.json` |
| Content | acute and chronic abdominal pain (100 diseases incl. mimics and can't-miss), cough / breathlessness (30) |
| Loop | `lib/pane-engine/src/vademecum-loop/` (`@workspace/pane-engine/vademecum-loop`, not exported from the package root) |
| Generators | `generators.ts`: history questions and chips by dimension, exam signs, investigations |
| Entry points | `evidence.ts`: labs via the reference ranges, report text negation-aware, PANE features, exam signs, scores; reverse index in `model.ts` |
| Shadow | `pnpm --filter @workspace/scripts run clinval:web -- --engine vademecum` (`scripts/src/clinval/vademecum-shadow.ts`) |
| Checks | `lint:shared-content` (schemas, Swift / TS type parity, registry, bundling), `lint:vademecum` (references, criteria logic, nothing marked reviewed), `vademecum-loop.test.ts`, `vademecum-content.test.ts`, iOS `VademecumContentTests.swift` |
| iOS | bundled folder reference `vademecum` (`ios/project.yml`), Codable structs `VademecumContent.swift`, listed under Settings → Diagnostics → Shared clinical rules. No engine reads it. |
| Registry | `vademecum-findings`, `vademecum-abdominal-pain`, `vademecum-cough-breathlessness` (0.1.0, unreviewed) |

### Switching criteria (per area, all three)

1. At least as accurate as the current engine (top-1 and top-3 on the pilot vignettes, web and iOS).
2. Zero lost can't-miss diagnoses (no mustNotMiss that PANE or iOS captures and the vademecum does not).
3. No more questions to threshold than PANE's own question loop.

And, before any switch: clinical sign-off of every value in the change log, a review of the
calibration on the outcomes loop (Migration 94) where there are enough confirmed cases, and the
iOS shadow run on device (the TypeScript "iOS-equivalent" run is not the iOS engine).

## Phase 2 — more areas and the iOS twin of the loop

- Areas in order of vignette coverage and risk: chest pain; GI bleeding (upper / lower);
  jaundice; dysphagia and weight loss; breast lump; neck lump; groin and abdominal-wall lumps;
  perianal complaints; urinary symptoms and haematuria; post-operative complications (fever,
  wound, leak, collection, VTE) as a cross-cutting area keyed on post-op day.
- Port the loop to Swift as a twin with shared vectors (`VademecumLoopVectors.json`: candidate
  sets, posteriors, next question, stop reason for fixed inputs), the same pattern as the
  diagnostic-reasoning and What's-missing twins. Then run the shadow on device from the iOS
  clinval harness (`ios.vademecum`), so the iOS comparison uses the real platform.
- Replace the LR ranges on PANE-seeded links (a conversion sensitivity band) with the source's
  95 % interval where one exists; drop links the sign-off rejects.

## Phase 3 — generated questions in the UI (behind a setting)

- Web: the ChiefComplaintStrip / HPI card offers the generated history chips for the current
  candidates (`generateHistoryQuestions`), the Exam step the generated signs, the Plan step the
  generated investigations, each with "why this question" (the candidate it separates, the criteria
  item it completes). The history frames stay the layout (SOCRATES for pain; cough, lump … otherwise);
  the vademecum decides which chips appear inside them.
- iOS: the same through the Swift twin in the HPI and Examination steps.
- The criteria, confirmatory findings, exclusions (with override) and conflicts appear in the
  existing diagnostic-reasoning panel ("Meets TG18 definite criteria", "Confirmatory finding: …",
  "Excluded: previous appendicectomy — override", conflicts through the existing "doesn't fit" path).
  No new alert UI.
- Pathology entry points offer the final diagnosis to the outcomes loop through the
  FinalDiagnosisPanel pattern (a prompt; never written without the clinician).

## Phase 4 — generate the engines' data from the vademecum

- Generate the iOS `DiagnosticDatabase.json` pools for the migrated areas from the vademecum
  (logLR = round(5 · ln LR), curated `likelihoodRatio` and `citation` kept), with a lint that fails
  when the generated file is stale.
- Generate PANE's disease modules for the migrated areas the same way (P(f | D) = LR+ × base rate),
  or replace PANE's per-disease scoring with the vademecum loop once the switching criteria hold.
- Retire the hand mappings the vademecum makes redundant: chip → feature rules in
  `socrates-to-features.ts` / `FRAME_KEY_RULES`, `engine-dimensions.ts` chip labels, the iOS
  `IOS_RULES`-style label regexes, and the duplicated exam-sign / decision-rule targets.
- Move the TG18 / NG12 external evaluators into vademecum criteria once their shadow results match
  (the dashboard TG18 auto-fill reads "wall thickening" in any imaging report as gallbladder wall
  thickening: see the phase-1 report).

## Principles that do not change

- Deterministic; no AI in the loop. Nothing is ordered, recorded or diagnosed without a tap.
- Can't-miss diagnoses keep held display places; a formal criterion never hides a can't-miss.
- A criterion's floor applies only when the rest of the record makes the diagnosis plausible; a met
  criterion the evidence contradicts is shown as a conflict, not silently promoted or dropped.
- Every value carries its source, its seed and `fromMemory` until signed off; `lastReviewed` stays
  "unknown" until a named clinician has reviewed it.

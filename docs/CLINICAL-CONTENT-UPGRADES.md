# Clinical content upgrades: design

| | |
|---|---|
| Status | Design v0.1, 2026-09-25. **Proposal for the surgeon and the (future) CSO. Not approved** |
| Surgeon's request | "Room for upgrades, both for the Bayesian diagnosis engine and for the clinical content, as new guidelines are published" |
| Built in this change | Guideline registry (`clinical-content/registry.json`), its CI lint (`lint:guideline-registry`), a version stamp on `DiagnosticDatabase.json`, and the iOS Settings → Diagnostics rows that show it |
| Inputs | `docs/CLINICAL-CONTENT-INVENTORY.md` (what exists and its critical findings), `docs/compliance/clinical-safety-case.md`, `docs/compliance/medical-device-positioning.md`, `docs/compliance/hazard-log.md` |
| Regression gate | The clinical-validation harness in `docs/clinical-validation/`: guideline-referenced vignettes run through the consultation engines (built separately) |

## 0. Principles

1. **Clinical content is part of the device.** Guidelines, thresholds, priors, likelihoods,
   doses and patient wording change what clinicians see. So they get the same change control as
   code, plus a clinical sign-off (safety case §7).
2. **Suggestion, not decision.** Every output stays a labelled suggestion that the clinician can
   inspect. Nothing in this design lets content act on the record by itself (`CLAUDE.md`, Human
   authority).
3. **Never learn automatically.** The model is locked. Any change, including one proposed from
   local outcome data, is a new version that a human has reviewed and signed.
4. **Fix before you upgrade.** The inventory found loading and unit defects (C-1 to C-5). If
   better guidelines are loaded into an engine that mis-reads them, nothing improves. Phase 1
   (§7) comes first.
5. **Traceable.** A displayed output should always be traceable to the content version that
   produced it, and that version to its sign-off record.

## 1. (a) Guideline registry

### 1.1 What is built now

`clinical-content/registry.json` has one entry per rule set (44 entries, about 220 files):

| Field | Meaning |
|---|---|
| `id`, `title`, `platforms`, `kind` | Identity. `platforms` ⊂ {ios, web, api, front-desk, database} |
| `files`, `tests`, `ciChecks` | Where the content lives (a `*` is allowed in the last path segment), what tests it and which CI lint guards it |
| `guidelines[]` | `{name, version, section, citation}` for each guideline or source the rule set follows |
| `citationStatus` | `per-rule`, `per-rule-partial`, `file-header`, `partial` or `none` |
| `contentVersion`, `versionStamp` | Semantic version, or `"unversioned"`. `versionStamp` says where the file itself records it (JSON key or regex). The lint fails if the file and the registry disagree |
| `lastReviewed`, `reviewer` | A documented **clinical** review (surgeon, CSO, pharmacist). `"unknown"` where none is recorded. Today that is all 44 |
| `reviewEvidence` | Anything short of a clinical review: surgeon decisions in commits, engineering fixes against a standard, audits |
| `reviewPriority`, `nextReviewDue` | P1, P2 or P3, and the due date. Today's dates are *proposed* first-review targets (P1 2026-10-31, P2 2026-12-31, P3 2027-03-31) |
| `changeAuthority` | Who can change it, and how it ships |
| `changelog[]` | Per-version entries, once the rule set is versioned |

`scripts/src/lint-guideline-registry.ts` runs in CI (`ci.yml`, "Lint clinical guideline registry").

- **It fails** on:
  - a malformed registry
  - a registered path or test that matches no file
  - a file in the inventory's `KNOWN_RULE_SET_FILES` that no entry covers
  - a version stamp that disagrees with the registry
- **It warns**, without failing:
  - with the review-due list: lastReviewed `"unknown"`, or nextReviewDue passed, in America/St_Lucia
  - about files that look like clinical content but are neither registered nor listed under `excluded`
  - when `DiagnosticDatabase.json` would not decode with the iOS engine's Codable structs

### 1.2 Next steps for the registry

- **A guideline catalogue.** Add `clinical-content/guidelines.json` with one record per guideline:
  - issuing body, title, edition or year, DOI/URL
  - usual update cadence, and the date it was last checked for a new edition

  Rule sets then refer to a guideline by id, and a query answers "which rule sets does the new
  WSES diverticulitis update touch?". Watch list to start with:
  - WSES (appendicitis, diverticulitis, ASBO, hernia)
  - Tokyo Guidelines
  - revised Atlanta
  - BSG/ESGE (GI bleeding, bowel preparation)
  - RCP NEWS2
  - NICE NG12
  - USPSTF
  - BNF/Stockley's
- **Rule-level references.** As content moves into data packs (§2), each rule, candidate or feature
  gets a `guidelineRef` (guideline id + section/recommendation number). A rule set's
  `guidelines[]` then becomes a summary that can be generated.
- **Review cadence.** The default is 12 months from the last review, or sooner when a watched guideline issues a new edition.
  - Medicines rule sets get a pharmacist review.
  - Patient wording gets the surgeon's review (hazard H-10).
- **CODEOWNERS.** Require the clinical owner's review on every registered path, as the safety case
  §7 already proposes. Generate the list from the registry so the two cannot drift.
- **Runtime-editable content.** The `clinical_guidelines` table can be edited by any authenticated
  user. Restrict writes to `admin`, or version its rows (`version`, `reviewed_by`, `reviewed_at`),
  so the AI consultant tab cannot quote an unreviewed edit.

## 2. (b) Versioned content packs

### 2.1 What a pack is

A **content pack** is one registry rule set (or a small group that must change together) held as
**data**, not code, with a manifest:

```jsonc
{
  "pack": "bayesian-differential",
  "version": "2.0.0",
  "engine": { "name": "BayesianDiagnosisEngine", "minVersion": "2.0.0", "maxVersion": "2.x" },
  "contentHash": "sha256:…",              // canonical JSON of the data files
  "files": ["pools.json", "priors/slu-outpatient-surgery.json", "citations.json"],
  "guidelines": ["wses-appendicitis-2020", "tg18"],
  "changelog": [{ "version": "2.0.0", "date": "…", "summary": "…", "hazards": ["H-06"] }],
  "signoff": "clinical-content/signoffs/bayesian-differential-2.0.0.json"
}
```

Candidates to become packs, in order:

1. `DiagnosticDatabase.json` (already data)
2. the pane-engine disease model
3. the drug-interaction rules and classes (one shared JSON read by both platforms, which removes the need for the parity lint)
4. the formularies and dosing tables (take the data out of `DosingTab.tsx` first)
5. the management protocols
6. the triage red flags and the APCQ bank

Small, fully tested algorithms stay as code, with a version constant: NEWS2, and each score
function in `ClinicalScoringEngine`. For code, the "pack" is the constant plus its registry entry.

### 2.2 Semantic versioning for clinical content

| Bump | When | Examples |
|---|---|---|
| **MAJOR** | The meaning of the numbers or the model changes. Results are not comparable with the previous version | Unit change (×5 log units → natural log or stored LR); new engine maths; removing candidates; new prior profiles |
| **MINOR** | Any change to a clinical value within the same model | New candidate, feature or rule; changed LR, prior, threshold, dose or grade; new red flag |
| **PATCH** | No clinical value changes | Citation text, labels, typo in a non-clinical string, metadata |

Any change to a number that can alter an output is at least MINOR, and needs the full workflow
in §3. A PATCH still needs the lint and the regression suite, but a lighter sign-off (the
clinical owner confirms "no clinical change").

### 2.3 Changelog and diff tool

- **Changelog.** It lives in the manifest (and in the registry's `changelog[]` until packs exist). Each entry has the version, the date, a one-line summary, the guideline that prompted it, the hazard ids and the sign-off file.
- **Diff tool** (to build: `pnpm --filter @workspace/scripts run content:diff <pack> <fromRef> <toRef>`). It gives a *semantic* diff, not a line diff:
  - candidates, features, rules and doses added or removed
  - changed values, shown in clinical terms (for example "LR+ 3.2 → 4.5 (logLR 6 → 8)")
  - citations added, removed or changed
  - an **impact section** from the vignette harness: for each vignette whose top-3 or must-not-miss result changes, what changed, plus the calibration metrics before and after (§4.2)
- **Output.** Markdown for the PR description, plus a hash that the sign-off record quotes, so the reviewer signs exactly what they read.

### 2.4 How iOS gets updates

| | **A. Bundled with app releases only** (recommended now) | **B. Signed remote packs** (later) |
|---|---|---|
| How | The pack is a resource in the app bundle. It changes only through a new build that has passed CI, the vignette suite and sign-off | The app downloads a pack, verifies its signature and hash, and activates it without an app update |
| Speed | Days: TestFlight/App Store | Hours |
| Safety case | Simple. One tested, signed-off artefact per release. The content version equals the app version | Adds new hazards: partial download, wrong pack for the engine version, a pack changing mid-consultation, a compromised signing key, devices on different content, and rollback |
| Regulatory | A content change is a device change, recorded in the release | A change to a device in the field, outside the app release process. It needs its own change control, distribution records and PMS (see §6) |
| Offline-first | No dependency | Must work with no network, and keep the bundled pack as the fallback |
| App Store | No issue | Data interpreted by reviewed code is the usual reading of guideline 2.5.2 (no downloaded code). Confirm before building |

**Recommendation: A, bundled only**, for as long as:

- there is no CSO
- the safety case is not made
- no market needs faster updates

Web content already follows the same rule in practice: it changes only with a deploy.

**Path to B**, when the preconditions are met:

- Preconditions:
  - a CSO is in post
  - packs and the diff tool exist
  - the content version is recorded with every output (§5.4)
  - rollback has been tested
- Signatures:
  - Ed25519 (CryptoKit `Curve25519.Signing`) over the manifest, which includes the content hash
  - the public key is pinned in the app, and a second key is held for rotation
  - the signing key is offline, and releases are signed by two people
- Compatibility: the manifest's `engine.minVersion/maxVersion` must match the engine in the app, or the pack is ignored.
- Activation:
  - the pack is downloaded and verified in the background
  - it is activated only at app launch or between encounters, never mid-consultation
  - the previous pack is kept
  - an audit event records the pack, version and hash
- Rollback:
  - a signed "revoke" list returns devices to the previous pack or the bundled one
  - the bundled pack is always the last-known-good fallback, and any verification failure falls back to it
- Anti-downgrade: versions only go up, except through a signed rollback instruction.
- Staged rollout: one device first (the surgeon's), then the practice.
- Kill switch: a setting that pins the bundled pack.

## 3. (c) Update workflow

```
new guideline / review due / incident or M&M / surgeon request
        │
        ▼
1. Impact assessment ── registry: which rule sets cite it? which hazards?
        │                 → "Content change request" issue (template)
        ▼
2. Content change (branch) ── data edit + registry (guideline version, changelog)
        │                       + version bump + content:diff output in the PR
        ▼
3. Automated gates (CI) ── lint:guideline-registry, parity lints, lint:dx-phases,
        │                    lint:patient-instructions, unit tests
        │                    + VIGNETTE REGRESSION SUITE (docs/clinical-validation) must pass
        ▼
4. Clinical safety review ── surgeon (clinical owner); CSO once appointed;
        │                      pharmacist for medicines; hazard log updated
        │                      → signed record clinical-content/signoffs/<pack>-<version>.json
        ▼
5. Release ── web deploy / iOS build; release note lists pack versions + hazard ids
        │
        ▼
6. After release ── overrides, incidents, M&M linkage; rollback if needed
```

### 3.1 The gates in detail

- **The vignette gate** (built by the clinical-validation work). A content change may merge only if:
  - every **must-not-miss** vignette that passed before still passes (the critical diagnosis stays in the top 5)
  - the top-1 and top-3 accuracy on the affected pools do not fall
  - the calibration metrics (§4.2) do not get worse beyond an agreed tolerance

  Any intended change in a vignette's expected answer is itself a reviewed change to the
  vignette, with its guideline reference.
- **The sign-off record.** It is a small JSON committed with the change. It holds:
  - the pack and version
  - the diff hash
  - the vignette run id and result
  - the reviewer's name and role, and the date
  - the decision
  - the hazard ids
  - any conditions

  A future lint can fail when a pack version on `main` has no sign-off record. This extends the
  bowel-prep pattern (a sign-off bound to a wording fingerprint, which lapses when the wording
  changes) from UserDefaults on one device into the repository, where it is audited.
- **Audit trail.** The chain is:
  - git history and the PR (who changed what, and why)
  - the diff output and the vignette report (what effect it had)
  - the sign-off record (who accepted it)
  - the release note (when it shipped)
  - the content version stored with each saved output (what the clinician saw; see §5.4)

### 3.2 Expedited path

A safety-critical fix (for example a wrong dose or a missed red flag) may be released on:

- the surgeon's same-day sign-off
- the full automated gates, including vignettes

The CSO reviews it within an agreed number of days, and the hazard log records that it was
expedited. Never skip the regression suite.

### 3.3 Who does what

| Step | Owner |
|---|---|
| Guideline watch (quarterly), impact assessment | Engineering, with the clinical owner confirming scope |
| Content edit, diff, registry, version | Engineering or the clinical owner |
| Vignettes: new and updated expected answers | Clinical owner (with guideline references) |
| Sign-off | Surgeon as clinical owner; CSO once appointed; pharmacist for medicines |
| Release note and hazard IDs | Engineering, reviewed by the CSO |

## 4. (d) Bayesian engine upgrades

### 4.0 Phase 1 correctness fixes (before anything below)

These come from the inventory (§2 there). Each changes outputs, so each is a MAJOR version with an
A/B run on the vignette suite (§4.7) and the surgeon's sign-off:

| # | Fix | Suggested approach |
|---|---|---|
| C-1 | The database does not decode | Validate the file in CI (the registry lint already checks the Codable rules; promote that check from warning to failure). Make the decoder report errors instead of `try?` → nil. Then decide per defect: fix the data (missing labels, values given as numbers), or accept a documented tolerant decoding. **Activating 161 pools that have never run on a device is itself a major clinical change**: gate it on the vignette suite |
| C-2 | Softmax base | `exp((logPosterior − max) / 5)`, or better, keep log-odds in natural log units throughout (see 4.1) |
| C-3 | DAG units | Compute the discount in the same units as the base LR |
| C-4 | Two prior scales | One scale (natural-log prior odds or probabilities), with a stated source and setting (see 4.5) |
| C-5 | LR ≠ citation | Recompute every cited `logLR` from its cited LR by code, not by hand (see 4.1) |

### 4.1 Literature-sourced likelihood ratios

Replace the hand-entered `logLR` with the published figures, and let code do the conversion:

```jsonc
// Illustrative. The LR+ and CI are the figures the database already cites for RIF tenderness
// (Andersson RE, World J Surg 2007); the locator and population are placeholders to fill at review.
{ "key": "site", "value": "RLQ",
  "lrPositive": 7.31, "lrNegative": null, "ci95": [5.88, 9.10],   // null: not reported → absent finding gives no update
  "source": { "citation": "andersson-2007-wjs", "locator": "<table/page>" },
  "population": "<study population and setting>",
  "derivation": "literature" }            // literature | sens-spec | expert
```

- **The citation store.** `citations.json` maps an id to the full reference, DOI/PMID, study design and setting. There are no free-text citations, and "Clinical" (211 features today) is not allowed.
- **LR−.** It is used when a finding is recorded as absent (see 4.4). Only 125 of 14,358 features have a negative value today.
- **Derivation.**
  - `sens-spec`: computed from the reported sensitivity and specificity.
  - `expert`: allowed where the literature is silent, but labelled as expert opinion in the UI and counted in a coverage report.
- **Coverage lint.** It fails on a feature with no source. It warns when more than a set share of a pool's weight comes from `expert` features.
- **Dependence.** Keep the DAG, but the CPTs need sources too. Prefer pooled LRs for clusters of findings that occur together (for example "RLQ pain + migration"), where studies report them, over multiplying correlated LRs.
- **Where to look.**
  - The JAMA *Rational Clinical Examination* series
  - Systematic reviews of individual findings (appendicitis, cholecystitis, SBO, diverticulitis, GI bleeding, AAA)
  - The guideline documents themselves (TG18, WSES), where they report diagnostic accuracy

### 4.2 Calibration testing against vignettes

The harness supplies vignettes with a reference answer and, where the guideline allows, a
reference probability band. The engine adapter returns the ranked list, the probabilities and the
content and engine versions. Metrics per pool and overall:

- **Must-not-miss sensitivity**: the critical diagnosis is in the top 5. This is the hard gate.
- Top-1 and top-3 accuracy.
- **Calibration**:
  - Brier score and log loss against the reference answer
  - a reliability table (predicted-probability bins against the observed hit rate)
  - an overconfidence count (probability ≥ 90% when the leader is wrong)
- **Stability**: the rank change under small perturbations (one feature removed or added). This catches brittle, single-feature rankings.

Until calibration passes, show **bands** (high, moderate or low likelihood) instead of exact
percentages (positioning doc L2).

### 4.3 Explainability ("why this ranking")

For each candidate the engine returns a contribution list, not just labels:

- **Prior.** The setting profile, the value and its source.
- **Each fired feature.** Its LR, its contribution in log-odds, and its source (citation id), with "expert opinion" marked.
- **Absent findings** that were used (LR−).
- **Safety-net ranking adjustments.** The urgency floor, and "confirmed at a previous visit". These are shown **separately**, labelled "ranking adjustment, not evidence", because they are not likelihoods.
- **What would change it most.** The value-of-information suggestion: the unanswered finding with the largest expected effect.

The UI shows a compact waterfall with a "Sources" link. This is also what the FDA CDS criterion 4
("the HCP can independently review the basis") needs. See positioning doc §4 item 4.

### 4.4 Handling missing features

- **Three states per finding: present, absent, not assessed.**
  - Present uses LR+.
  - Absent uses LR−, but only when the clinician recorded it as absent (a negative chip, "no", a negated phrase).
  - Not assessed changes nothing (LR = 1).
  - iOS today treats "absent" and "not assessed" the same way (both ignored).
  - The web engine updates only on answered questions, which is right, but it assumes `DEFAULT_SENSITIVITY = 0.30` for findings a disease does not list. Replace that with an explicit "not informative" (1.0) unless a source gives a value.
- **Negation detection** in the free-text parser, so that "no fever" is recorded as absent, not present (C-7).
- **Show what is missing.** "Not assessed: rebound, WBC" beside the leader, with the value-of-information suggestion. That helps; it is never a reason to down-rank.
- **Coverage warning.** When fewer than N informative findings have been assessed, show "Too little information to rank".

### 4.5 Prevalence priors by setting

- **Prior profiles.** Each profile is a separate file in the pack:
  - `slu-outpatient-surgery` (the default for Amise)
  - `emergency-department`
  - `ward`

  Each entry holds a probability or prior odds, a source (literature, or local audited data with n and dates) and a review date.
- **Selection.** The profile follows the encounter setting (`Patient.setting`: outpatient, inpatient or emergency; the web encounter type). It is shown in the UI ("Priors: outpatient surgery, Saint Lucia"), and the clinician can switch it.
- **The web modifiers.** The age and sex prior modifiers become part of the profile, each with a source.
- **Must-not-miss.** These diagnoses stay visible through the urgency floor, not through inflated priors, so that changing the setting cannot hide them.

### 4.6 Optional local learning from audited outcomes (strictly governed)

- **Inputs.** Only **audited** outcomes: the final diagnosis confirmed by histology, operative findings or a defined follow-up, from closed encounters, linked to the features recorded *at the time*. M&M cases (`mm_cases`) are an obvious source.
- **Method.** An offline analysis, never on the device and never at runtime.
  - Shrink the local counts towards the literature priors and LRs (for example Beta or Dirichlet updating with the literature as the prior).
  - Report credible intervals and the sample size.
  - Set minimum case numbers per candidate before any proposal.
  - Check for verification and referral bias. Only verified diagnoses count, which over-represents operated cases.
- **Output.** A *proposal*: a content change request with the diff and the vignette A/B. It goes through the full §3 workflow, signed by the surgeon and the CSO. **Never automatic, never applied on the device, never continuous.** Each accepted proposal is a new locked pack version.
- **Privacy.** Only aggregated, de-identified counts leave the database. Record the analysis in the DPIA and the data inventory.

### 4.7 Versioned models and A/B comparison

- **The pair.** Every result carries an engine version (the code) and a pack version (the data).
- **A/B runs.** The harness runs A = main and B = the candidate over the whole vignette suite. The report shows:
  - the per-vignette rank changes
  - the metrics from §4.2
  - the must-not-miss gate
  - the largest movers, with their contributing features (§4.3)

  The report is attached to the PR and quoted in the sign-off.
- **Retrospective replay.** Optionally, replay the same A/B on de-identified audited cases (§4.6).
- **Not allowed.** There is no live A/B on patients, and no silent "shadow mode" that shows one clinician a different engine.

## 5. (e) UI provenance

### 5.1 Wording

- **Under a differential, score, pathway or dosing suggestion:**
  - "Based on **<guideline> (<year>)**, last reviewed **<date>**" (from the registry or pack)
  - where there has been no review: "Based on <guideline> (<year>) · **not yet clinically reviewed**"
  - where no guideline is recorded: "Practice content · no guideline recorded · not yet clinically reviewed"

  Be honest. Never show a date that is not in the registry.
- **Every decision-support output:** "**Suggestion, not a decision.** The diagnosis and plan are yours." (`CLAUDE.md`, Human authority).
- **The differential:** add "Probabilities are model estimates from published literature; not validated locally" (positioning L1/L2), until §4.2 is met.

### 5.2 Where

| Surface | iOS | Web |
|---|---|---|
| Differential | `ConsultationView+CCTab.swift`, `+HistoryTab.swift`, `+PlanTab.swift` (the differential %; L2) | `components/PaneDifferential.tsx` (L1) |
| Scores | Score detail (`ClinicalScore.evidenceNote` is already shown, so add the reviewed line) | `ScalesTab.tsx`, `ClinicalScoresPanel.tsx` |
| Interactions and dosing | `PrescriptionView+Sections.swift`, dosing guide views | `DrugInteractionAlert.tsx`, `DosingTab.tsx` (L6, L7) |
| Management and pathways | Plan tab, radiation suggestions | `ManagementPanel`, `PlanTab.tsx` (dx-variants) |
| Content versions | Settings → Diagnostics (the database version is **already there**), later Settings → About (L14) | Settings tab |
| Printed and PDF | `ClinicalScoresPDF.swift`, `PatientSummaryPDF.swift` footer: pack versions (L16) | Printed letters and reports |

### 5.3 How

- **Build step.** A build step turns the registry (later, the packs) into a small `provenance.json`: rule-set id → guideline label, year, last reviewed, content version. It is bundled in both apps, and a lint keeps it in step with the registry.
- **One component per platform.** `ProvenanceFootnote(ruleSetId:)` in SwiftUI and `<ProvenanceFootnote ruleSet="…"/>` in React. The wording lives in one place.
- **Consistent tone.** The existing "decision support only" strings move into the same component.

### 5.4 Recording provenance with outputs

When a differential, score or dosing suggestion is copied into a note, or saved to score history,
store `ruleSetId@contentVersion` (and the engine version) with it. That is what links an incident
or an M&M case to the exact content that was on screen.

## 6. (f) Regulatory notes

- **Content changes are device changes.** `medical-device-positioning.md` treats the differential (F6), NEWS2 (F4), scores (F5), management prompts (F7) and prescribing support (F8) as likely device functions. In every market considered, changing their content changes the device:
  - **EU MDR / UKCA.** Assess each change for significance (MDCG 2020-3). A change to the algorithm, the inputs or the performance claims can be "significant" and need notified-body review. The technical documentation must keep the content version, the verification (the vignette suite) and the risk assessment.
  - **US FDA.** A change that affects safety or effectiveness may need a new submission. A **Predetermined Change Control Plan** (PCCP) can pre-authorise defined types of content update, such as guideline-driven LR updates within stated performance bounds, if a US route is ever taken. The locked, versioned model in §4.6 and §4.7 is what a PCCP expects.
  - **IEC 62304 / ISO 14971.** Treat content packs as configuration items. Each version needs regression evidence (the vignettes) and an updated risk assessment. The registry and the sign-off records are the configuration record.
  - **DCB0129 (the framework used here).** Every release note lists the content versions and the hazard ids affected, and the CSO signs it (safety case §7).
- **Why bundled-only now.** Remote packs would be field changes to a device outside the release process. They need their own distribution records, per-device content tracking, rollback evidence and post-market surveillance. None of that exists yet, and no CSO is in post.
- **Positioning.** Provenance (§5) and explainability (§4.3) support the CDS criterion-4 argument (the basis can be reviewed independently) and the "decision support only" labelling. So does removing false precision: bands instead of exact %, and the C-2 fix.
- **Local learning** (§4.6) is **not** an adaptive algorithm in the regulatory sense, as long as it stays offline, periodic, human-approved and released as locked versions. If it ever became automatic, it would be a different device.
- **Per-market switches.** Module B (decision support) features can be enabled per market by pack approval status (positioning §4 item 1). For example, a pack approved for Saint Lucia use but not assessed for the UK stays off there.
- **Saint Lucia.** No specific regime has been identified (positioning §1). Follow the DCB0129-style process above anyway. It is also what any later market will ask for.

## 7. Phased plan

| Phase | Scope | Status |
|---|---|---|
| 0. Foundations | Inventory; registry + CI lint; version stamp on `DiagnosticDatabase.json`; Settings → Diagnostics shows the version and whether the engine loaded it | **Done in this change** |
| 1. Correctness | C-1 to C-5 (decode, units, priors, LR recomputation), each A/B'd on the vignette suite and signed off. Fix C-9 (deterministic dosing lookup). Differential disclaimer and bands (L1, L2). `CODEOWNERS` from the registry. Sign-off records. Restrict `clinical_guidelines` writes | Next |
| 2. Packs | Pack manifest and `content:diff`; `citations.json`; the LR schema (4.1); interactions as one shared data pack; formulary and dosing data out of components | |
| 3. Calibration and explanation | Calibration metrics in the harness (4.2); the contribution waterfall (4.3); three-state findings (4.4); setting priors (4.5); provenance footnotes and content versions recorded with outputs (§5) | |
| 4. Optional | Signed remote packs (2.4 B) once the preconditions hold; local-learning proposals (4.6) once there are enough audited outcomes | |

## 8. Decisions needed from the surgeon

1. **C-1.** Should the 161-pool database be activated on iOS, or should it stay on the built-in lists until Phase 1 is complete? The database has never run on a device since it was expanded. Activating it is a large clinical change, and needs the vignette suite.
2. **The review order.** Confirm P1, P2 and P3 in the registry, and the first-review target dates.
3. **Who signs.** Who signs content off until a CSO is appointed? Is there a pharmacist for the medicines rule sets (hazard H-08)?
4. **Delivery.** Confirm bundled-only delivery for iOS content (§2.4).
5. **Local adaptations.** Confirm, with rationale, the local changes to screening (diabetes from 35; PSA from 45 for African-Caribbean men), so they can be recorded as practice decisions in the registry.

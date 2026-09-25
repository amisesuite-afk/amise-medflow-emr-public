# Herbs, teas, bush remedies & supplements — catalogue, interactions, recording, alerts, prompts

Branch `supplements-interactions` (from `claude/pr-37-gbg22z`), 2026-09-25.

**Source:** the practice owner's evidence briefing (Dr Dawit Daniel Kabiye, "Ancient Remedy, Modern
Market", Sept 2026): §5 supplements and herbal products and §7 perioperative checklist. Only its
clinical facts are used, not its market figures, philosophy or talk notes. Citations used: Ang-Lee MK
et al. JAMA 2001;286:208-16; OpenAnesthesia / SPAQI 2025; J Clin Anesth 2024 review; Proc (Bayl Univ Med
Cent) 2022; Halegoua-DeMarzio D et al. Am J Med 2023 (DILIN, turmeric); NIDDK LiverTox (ashwagandha);
Björnsson HK et al. Liver Int 2020; Saper RB et al. JAMA 2008 (Ayurvedic metals); Public Health
Ontario 2019; Nortier JL et al. NEJM 2000 and Debelle FD et al. Kidney Int 2008 (aristolochic acid);
Schwarz C et al. JAMA Netw Open 2022 (SmartAge); BNF / Stockley's for the drug classes.

Everything clinician-facing is decision support: no alert stops, prescribes, orders or edits anything,
and every "add to plan" needs a clinician tap. Stop times are shown to clinicians only.

## What changed

### 1. Catalogue (web and iOS twins, parity-linted)

`artifacts/dashboard/src/lib/supplement-catalogue.ts` and `ios/AmiseMedFlow/Services/SupplementCatalogue.swift`
(registry id `supplement-catalogue`, version 1.0.0). 17 items, each with names, concern, the commonly cited
stop time before elective surgery (§7), harms (liver / renal / metal) and source:

| Item | Concern (short) | Commonly cited stop time |
|---|---|---|
| Garlic (supplement) | Platelet inhibition; strongest link to surgical bleeding | at least 7 days; many advise 2 weeks |
| Ginkgo | PAF inhibition; bleeding, especially with anticoagulants | at least 36 hours; SPAQI 2 weeks |
| Ginger (supplement) | Thromboxane synthetase inhibition | 2 weeks (SPAQI) |
| Turmeric / curcumin | Hepatocellular DILI 1–4 months, HLA-B*35:01 (DILIN 10 cases, 1 death); bleeding with anticoagulants; lead chromate adulteration; culinary amounts fine, risk is piperine / nanoparticle capsules | 2 weeks; LFTs if symptomatic |
| Ashwagandha | Cholestatic DILI with severe jaundice and itch, 1–5 months, sometimes fatal (LiverTox); Danish ban 2023; avoid in liver disease, pregnancy, thyroid disease | 2 weeks; LFTs if symptomatic |
| Ginseng | Hypoglycaemia, especially in fasting patients (pre-op fast or religious fast); platelet effects; reduced INR | at least 7 days; SPAQI 2 weeks |
| St John's wort | CYP3A4 / P-gp induction (warfarin, ciclosporin, tacrolimus, DOACs, contraceptives, anaesthetics); serotonergic | at least 5 days |
| Kava | Potentiates anaesthetic sedation | 24 hours |
| Valerian | Potentiates sedation; withdrawal if stopped suddenly | taper over 1–2 weeks |
| Echinacea | Immune effects; avoid if immunosuppression planned | stop early before transplant-type surgery |
| Ephedra (ma huang) | Hypertension, arrhythmia; FDA ban 2004 | at least 24 hours; ideally avoid |
| Ayurvedic (rasa shastra / metal-based) | Lead, mercury, arsenic (20.7% of products; 19% of published lead cases) | — |
| Chinese herbal slimming product | Aristolochic acid nephropathy, upper-tract urothelial carcinoma | — |
| Detox tea / colon cleanse / laxative cleanse | Dehydration, electrolyte disturbance, laxative dependence | — |
| IV vitamin drip (outside clinical care) | Infection and fluid risks | — |
| Spermidine / "autophagy booster" | No benefit shown in humans (SmartAge RCT); recording only | — |
| Bush tea / herbal remedy (unspecified) | Plant not identified | "identify the plant; stop non-essential herbal products 1–2 weeks before elective surgery (ASA / SPAQI) — clinician to confirm" |

Caribbean bush teas are **not** catalogue items (their pharmacology is not in the briefing); see
"Needs sign-off".

### 2. Interaction rules (supplement × drug class), same grade and wording on both platforms

`drug-classes.ts` / `DrugClasses.swift`: 11 supplement terms, 9 new classes (DOAC, calcineurin
inhibitor, immunosuppressant, triptan, combined oral contraceptive, sulfonylurea, Z-drug hypnotic /
barbiturate, general anaesthetic, sympathomimetic) and levothyroxine. `drug-interactions.ts` /
`DrugInteractionService.swift`: 41 rules —

- garlic, ginkgo, ginger, turmeric, ginseng × anticoagulant, antiplatelet, NSAID → bleeding (**major**);
- St John's wort × warfarin, DOAC, calcineurin inhibitor (levels), SSRI, SNRI, triptan (serotonin),
  combined oral contraceptive (**major**);
- ginseng × insulin, sulfonylurea (hypoglycaemia), warfarin (reduced INR) (**moderate**);
- kava, valerian × benzodiazepine, opioid, Z-drug / barbiturate, general anaesthetic (**moderate**);
- ephedra × MAOI (**contraindicated**), sympathomimetic, general anaesthetic (**major**);
- ashwagandha × levothyroxine, benzodiazepine, Z-drug / barbiturate, immunosuppressant (**moderate**);
- echinacea × immunosuppressant (**moderate**).

`lint:interaction-parity` now also compares the supplement catalogue (every item and field, shared
wording, prompt texts, trigger words, version) and requires every supplement rule to have the same
effect and action on web and iOS.

**Wiring:** a recorded supplement is screened like a drug — web `DrugInteractionAlert` in the
Medications, Prescriptions (prescribing screen) and Inpatient tabs; iOS PrescriptionView, AddPrescriptionSheet
(live screen while prescribing) and the consultation interaction list.

### 3. Recording

- **Record:** patient-level `SupplementHistory` {status not_asked / none / taking, entries (catalogue id,
  name, details), askedAt}, stored in the `supplements` key of `patients.pathway_data_json` (Migration 86,
  TEXT). iOS keeps it in `PathwayData.supplements`; the dashboard reads and writes the same key
  (read-modify-write that keeps the iOS keys; dates with second precision for iOS `.iso8601`). **No new
  column, no migration.** Clients tolerate the column being absent (web: load/save errors are ignored /
  queued in the outbox; iOS: existing SyncService+PathwayData behaviour). No iOS column-list change.
- **Web:** Medications tab card "Herbs, teas, bush remedies & supplements" (catalogue search + free text,
  mandatory status). AppContext loads, drafts and autosaves it (outbox executor `supplements`).
- **iOS:** consultation Meds step and pre-op checklist (`SupplementHistorySection`), patient overview card.
- **SOAP / notes:** "Supplements: …" / "Supplements: none reported." / "Supplements: not asked." — iOS
  SOAPDraftEngine (S and narrative background), web SOAP compile (ProgressNotesTab) and the consultation
  summary documents (SummaryTab).
- **Pre-op checklist:** iOS PreOpChecklistView and web Perioperative tab (critical checklist item + card
  with the alerts). Help text: "50–70% of surgical patients do not disclose herbal use (J Clin Anesth 2024
  review)".
- **Patient question** (asks, never instructs): "Do you take any herbs, bush teas, bush medicines, vitamins
  or supplements? Please include teas and remedies from the garden or market." — front-desk pre-visit
  questionnaire (answer stored as one marked row of `previsit_submissions.medications`), portal intake
  (appended to `current_meds`), front-desk AI intake prompt, iOS AdaptiveQuestionnaireSheet (a
  "SUPPLEMENTS (PATIENT-REPORTED):" line in pmhNotes, which the clinician confirms in the Meds step).

### 4. Perioperative alert

"Supplement: <name> — <concern>. Commonly cited stop time: <…> before elective surgery (source)." for
each recorded catalogue item — iOS risk snapshot and pre-op checklist; web clinical prompts (pre-op) and
Perioperative tab. "Not asked" is flagged before a procedure. Ashwagandha recorded with liver disease,
pregnancy or thyroid disease → "Ashwagandha: avoid in liver disease, pregnancy and thyroid disease
(LiverTox; Danish ban 2023)".

### 5. Diagnostic "ask about" prompts (web `supplement-prompts.ts` in clinical-inference; iOS `SupplementAlerts`)

- ALT or AST ≥ 120 U/L, or hepatitis / raised-LFT words → ask about turmeric / curcumin (esp. with
  piperine), ashwagandha, other herbal products.
- Anaemia (Hb < 12 g/dL; < 13 in men) or neuropathy with abdominal pain, raised blood lead (≥ 5 µg/dL
  or ≥ 0.24 µmol/L, unit required) or lead words, or a recorded Ayurvedic / turmeric product with any of
  these → ask about Ayurvedic (rasa shastra) products and turmeric (lead chromate); consider blood lead.
- Rapidly progressive renal failure or upper-tract urothelial cancer words → ask about Chinese herbal
  products, slimming pills and Chinese herbal weight-loss products (aristolochic acid).
- K < 3.5 or Na < 135 mmol/L, dehydration or chronic constipation → ask about detox teas and cleanses.
- Fever (≥ 38.0 °C or fever words) or cellulitis / line-site infection → ask about IV drips given
  outside clinical care.

### 6. Patient-facing text — surgeon decision 2026-09-25

Recorded in `docs/clinical-validation/SURGEON-DECISIONS.md` (H1) and CLAUDE.md. The approved paragraph
("Herbal remedies, bush teas and supplements: please stop them 2 weeks before your operation or procedure
… Why … When … valerian … This does not apply to medicines prescribed by a doctor …") is in the procedure
sets of `artifacts/front-desk/lib/instructions.ts` (`HERBAL_SUPPLEMENTS_STOP`), the api-server prep
templates `lib/sms.ts` (`PREP_HERBAL`: colonoscopy, OGD, ERCP, surgery, flexible sigmoidoscopy) and the
dashboard's printed prep sheet (replacing its old "turmeric, ginger, cinnamon 5 days" line). The
"(tablets, capsules, extracts or strong teas — normal amounts in food are fine)" clarification is
included. `lint:patient-instructions` and `outbound-safety.test.ts` allow stop wording only in those
verbatim sentences, pin the three copies to each other, and have new self-tests showing stop wording
with warfarin, aspirin, insulin, metformin, clopidogrel or "blood thinners" still fails. ERCP's
"no sedation wording" rule ignores only this paragraph. The per-product clinician stop times never reach
patient text.

## Checks run

`pnpm run typecheck` (clean); `pnpm -r run test` (dashboard 589, api-server 588, front-desk 109, scripts
23, pane-engine 83 — all pass); lints: interaction-parity, guideline-registry, patient-instructions,
grants, rls-policies, dx-phases, report-import-parity, no-external-qr (all pass); dashboard and
front-desk builds (pass); `clinval:web`: 0 blocking (2628 pass vs 2625 before; 3 known gaps now pass).
No migration, so `check:migrations-fresh` is not affected. Swift was not compiled here (no toolchain):
new types were checked for name clashes (`Supplement*` did not exist) and symbols by hand; XCTests are in
`ios/AmiseMedFlowTests/SupplementTests.swift`.

## Needs sign-off

1. **Grades** of the 41 supplement rules (conservative: major for bleeding / serotonin / transplant
   levels; moderate for kava, valerian, ashwagandha, echinacea, ginseng hypoglycaemia; contraindicated for
   ephedra + MAOI). Candidates to discuss: kava + benzodiazepine (coma case reports) as major; echinacea +
   immunosuppressant as major in transplant recipients; St John's wort + calcineurin inhibitor as
   contraindicated.
2. **Prompt thresholds:** ALT / AST ≥ 120 U/L (3 × ULN 40); Hb < 12 / < 13 g/dL (WHO); K < 3.5, Na < 135;
   blood lead ≥ 5 µg/dL; and the fever-only trigger for the IV-drip prompt (may be noisy).
3. **Caribbean bush teas — add with sources?** Candidate plants, NOT active rules: cerasee (Momordica
   charantia), soursop leaf (Annona muricata), noni (Morinda citrifolia), aloe, moringa, sorrel / hibiscus,
   fever grass (lemongrass). Today they fall under "Bush tea / herbal remedy (unspecified)".
4. **Patient text:** exact wording for emergency / urgent surgery; whether the pre-op assessment visit
   and minor procedures under local anaesthetic should carry the herbal paragraph (both deliberately left
   without it; the assessment visit's "no sedation wording" rule would need changing).
5. **Vitamin E and fish oil** (not in the briefing): add as catalogue items / bleeding rules?
6. **Brand and synonym names** added only where certain (Kyolic, Kwai, EGb 761, Tebonin, Tanakan,
   Ginsana, Echinaforce, KSM-66; drug brands per SmPC): confirm local availability.
7. Pharmacist review of the new drug classes (hazard H-08), as for the existing interaction list.

## Findings outside this change (not fixed)

- `artifacts/dashboard/src/components/PatientPrepCard.tsx` (printed prep sheet) still tells patients to
  stop / hold / reduce prescribed medicines (warfarin, DOACs, clopidogrel, aspirin, metformin, insulin,
  NSAIDs) and says "NOTHING by mouth" from midnight. It is outside `lint:patient-instructions`, and these
  conflict with hazard H-10 and the surgeon's no-midnight decision. Needs the surgeon's wording; only its
  herbal line was changed here, per the 2026-09-25 decision.
- A front-desk dashboard user editing the supplement card would be refused by Migration 89
  (pathway_data_json is clinician-only) and the outbox would keep retrying; front desk records the
  patient's answer through the questionnaires instead.

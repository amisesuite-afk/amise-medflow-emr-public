# Change log — `web-plan-filter-everywhere` (every protocol screen through the patient filter)

Owner-authorised "fix all gaps found", 2026-09-25. Follows `fix-web-protocols.md` ("Not done /
hooks needed in other areas"): the pane-engine patient filter (`planSafety.ts`,
`adaptProtocolForPatient`) and `resolveProtocol` were used only by the Plan tab, the Assessment
management panel and the Prescriptions tab. Every other screen read the management protocols raw:
adult doses for children, a drug the patient is allergic to, both `onlyIf` branches, CT without a
pregnancy caveat.

Branch `web-plan-filter-everywhere` (from `claude/pr-37-gbg22z` at `ac07db0`). Web dashboard and
`lib/pane-engine` only. Nothing patient-facing (hazard H-10); nothing ordered, prescribed or
written without the clinician's tap.

## One helper, every screen

`artifacts/dashboard/src/lib/plan-builder.ts` is now the only file that imports the pane-engine
protocol lookups (`getProtocol`, `getProtocolByIcd`, `resolveProtocol`, `getAllProtocols`); a
unit test scans `src/` and fails if another file does.

| Helper | What it does |
|---|---|
| `patientProtocol(diseaseId, icd, ctx)` | `resolveProtocol` (a more specific recorded ICD code wins), then `adaptProtocolForPatient` |
| `dischargeMedicationLines` / `dischargeProtocolFill` | Discharge medicines: a withheld drug becomes `⚠ WITHHELD — <drug>: <reason>. <alternative>` — the protocol's own alternative medicine when it lists one (`alternativeTo`), otherwise the filter's alternative wording; a child's doses read "Weight-based — calculate per BNFc" with the reason |
| `investigationsWithCaveats` | The protocol's orderable label and the patient caveat (pregnancy, child, contrast allergy) kept apart, so an order or imaging request is made from the protocol wording |
| `seedInvestigations(source, ctx, { leader })` | The suggested (seeded) investigations — see below |

| Screen | Before | Now |
|---|---|---|
| SummaryTab discharge summary "Protocol fill" | Raw protocol of the working diagnosis (locked or not): adult doses, allergens, both branches | Confirmed diagnosis only (`confirmedPlanSource`), adapted; withheld drugs replaced with reason and alternative; BNFc line for a child; warning signs without the clinician-facing safety lines; referral letter adds the critical patient lines |
| InvestigationsTab protocol panel | Raw protocol of the PANE leader at ≥ 0.85, else the ICD code | Confirmed diagnosis, adapted; caveat shown next to each test, orderable label unchanged |
| AmbientConsultation | Raw protocol for the protocol card, assessment red flags, "Insert suggested plan" and the "If <leader>" preview; substring allergy flag | Adapted everywhere; patient safety lines first; withheld medicines listed as withheld (class-aware allergy check replaces the substring check); the preview uses `seedInvestigations` |
| DictionaryTab | ManagementPanel raw; "Start" pre-added the raw stat/urgent tests | ManagementPanel adapted whenever a patient is open (raw, every branch labelled, only with no patient); "Start" pre-adds only the adapted, caveat-free stat/urgent tests (a caveated test stays in the Investigations panel with its caveat) |
| Suggested investigations (HPI / Labs / Imaging) | Stat/urgent tests of every top-3 PANE differential, raw | `seedInvestigations` — below |
| AssessmentTab ICD-drift offer | `getProtocol` for label / ICD prefix | Same, via `planProtocolFor` (no clinical content shown) |

`applyModifiers` now gets the pregnancy context (`{ pregnancyPossible }`) in `usePane.ts`,
`AmbientConsultation`, `SuggestedInvestigationsPanel` and `DictionaryTab`; a test fails if any
`applyModifiers(DISEASES, …)` call in `src/` omits it.

## Seeded investigations (`seedInvestigations`)

`HpiTab.seedInvestigationsFromPane` was already replaced by `SuggestedInvestigationsPanel` (UX C3,
`ceb5d31`: suggestions, ticked to order). Its diagnosis source is now:

1. **One diagnosis.** The confirmed diagnosis (locked working diagnosis or recorded ICD-10 code),
   else the PANE leader at ≥ 20% (`managementPanelSource`, the ManagementPanel's rule) — never
   every top-3 differential. When the confirmed diagnosis has no protocol (e.g. O26.83), the
   leader is used as a considered diagnosis.
2. **Through the patient filter.** Conditional branches resolved (no "CT — not pregnant" branch in
   pregnancy), pregnancy / child / contrast caveats on imaging, "pregnancy test — result required"
   before a procedure in a woman who may be pregnant.
3. **Stat and urgent only; no stat test from a considered diagnosis.** A stat test presupposes the
   diagnosis (immediate CT head for SAH, POCUS for ruptured AAA); it is held back until the
   diagnosis is confirmed. The ManagementPanel (reference) still lists it.
4. **Suggestions only.** Unticked, badged "Suggested for <diagnosis>" or "<diagnosis> (leading
   differential)"; nothing reaches the record without "Order ticked".

The chief-complaint suggestions (cc-matrices) get the same imaging caveats
(`adaptInvestigationForPatient`).

### `sah` and `anaplastic_thyroid` aliases

- **`anaplastic_thyroid` → `thyroid_carcinoma`: mapped.** It now seeds only when it leads; in the
  neck-haematoma vignette `postop_haematoma` leads (0.97) and is confirmed. The thyroid carcinoma
  protocol has no stat test and carries the anaplastic / airway lines (ATA 2021).
- **`sah`: still not mapped.** Seeding would now be safe (the immediate CT head is stat, held back
  from a considered diagnosis). But the PANE engine ranks SAH first (0.34) in the low-risk vasovagal
  syncope vignette (`acutemed-syncope-vasovagal-low-risk`), so before a diagnosis is confirmed the
  Assessment reference panel and the Ambient preview would show the SAH emergency protocol ("call
  911") for that patient. Confirmed SAH (ICD I60) already resolves to `subarachnoid_haemorrhage`.
  Revisit once the syncope ranking is fixed in the differential.

## Gaps the one-diagnosis rule exposed

Eight expectations had passed only because another top-3 differential's protocol supplied the test.
Each was fixed at the source, not flagged:

| Vignette / expectation | Fix |
|---|---|
| `crohns-perianal-complex-fistula` / inv-mri-pelvis | `crohns_disease`: MRI pelvis for perianal disease (ECCO-ESGAR 2019) |
| `hernia-femoral-richter-obstruction` / inv-ct | `femoral_hernia`: CT if obstruction or strangulation is suspected and it will not delay surgery (WSES 2017) |
| `liver-abscess-amoebic` / inv-blood-cultures | `amoebic_liver_abscess`: blood cultures × 2 (exclude a pyogenic or mixed abscess) |
| `appendicitis-elderly-atypical` / inv-lactate-or-cta | planSafety: age ≥ 65 with an acute digestive-system presentation (K-code protocol with immediate steps, not elective) → "Venous blood gas with lactate … CT angiography if mesenteric ischaemia is suspected (a normal lactate does not exclude it) (ESVS 2017; NELA)" |
| `aortoenteric-fistula-herald-bleed` / inv-blood-cultures | New protocol `aortoenteric_fistula` (ESVS 2020 graft infection): emergency redirect, CTA (stat), bloods and crossmatch (stat), blood cultures, OGD only after CTA in a vascular centre, vascular surgery; no ICD mapping (K63.2 / T82.7 too broad); no tranexamic acid |
| `paed-hsp-abdominal-pain` / inv-ultrasound-intussusception, inv-urine-protein-bp | New protocol `hsp_iga_vasculitis` (SHARE 2019; D69.0): urinalysis + protein:creatinine, BP, bloods, ultrasound for intussusception; child → same-day paediatric team; adult branch → nephrology; no fixed doses, no operation |
| `renal-colic-pregnant` / inv-ultrasound-first | Confirmed code O26.83 has no protocol → the leader (`renal_colic`) as considered: USS KUB, CT KUB with the pregnancy caveat |

## Other filter fixes (planSafety 1.1.0)

- **Under 16, fluids** (coordinator request): a fixed adult fluid volume in a fluid line ("1 L",
  "500 mL", "4–6 L over 24 h", "200–300 mL/hr") becomes `[fluids by weight — calculate per
  APLS/BNFc (mL/kg)]` (the iOS twin's string), keeping the titration wording ("then titrate to urine
  output"); a fluid medication (Hartmann's 1 L) gets that dose and keeps its frequency. Weight-based
  amounts ("4 mL × kg × %TBSA", "per kg") were being replaced by the dose placeholder; they no
  longer are. Drug doses in mL (calcium gluconate 10 mL) still get the BNFc dose line.
- **"USS KUB" is not ionising.** An ultrasound or MRI named first is no longer annotated as
  ionising imaging because "KUB" appears in it.
- **Pregnancy test not suggested** for male patients, age < 10 or > 55, or a recorded pregnancy
  (pregnancy-specific protocols such as ectopic keep the quantitative β-hCG).
- **Withheld medicines** carry their phase and replacement line, for the discharge summary.
- `imaging-utils.detectModality`: the modality named first wins — "CT abdomen/pelvis … in
  pregnancy MRI / ultrasound first" was parsed as an ultrasound request.

Versions: `PLAN_SAFETY_VERSION` 1.1.0, `MANAGEMENT_PROTOCOLS_VERSION` 1.1.0 (198 protocols, 747
medication entries); `clinical-content/registry.json` changelogs and the inventory updated.

## Clinical validation (`clinval:web`)

Against `claude/pr-37-gbg22z` at `ac07db0`, 397 vignettes, 3087 expectations:

| | Pass | Fail | n/a | Critical fail | Blocking | Known-gap fail |
|---|---|---|---|---|---|---|
| Before | 2865 | 130 | 92 | 5 | 0 | 126 |
| After | 2870 | 125 | 92 | 5 | 0 | 123 |

No expectation that passed before fails now. Fail → pass: `appendicitis-pregnant-t2` and
`periop-pregnancy-emergency-laparotomy-sbo` inv-no-unqualified-ct, `renal-colic-pregnant`
inv-no-ct-first (web known-gap flags removed; iOS flags kept), `breast-lump-under-30`
inv-no-first-line-mammogram, `trauma-pregnancy-30wk-rtc` inv-no-pregnancy-test. The web runner
mirrors the new seeding (`web.pane.seeded` = `seedInvestigations`).

## Tests

- `artifacts/dashboard/src/lib/__tests__/plan-filter-consumers.test.ts`: Summary discharge
  medicines (no allergy; penicillin anaphylaxis with the class alternative and with the protocol's
  own alternative; pregnancy — NSAID from 20 weeks, tetracycline; child — BNFc), Investigations /
  Ambient investigations and medicines, seeding (confirmed wins, leader only, no stat when
  considered, fallback, pregnancy, penicillin, child), Dictionary launch; source scans for raw
  protocol imports and context-free `applyModifiers`.
- `investigation-suggestions.test.ts`: seeded suggestions and complaint caveats.
- `lib/pane-engine/src/__tests__/planSafety.test.ts`: fluid volumes under 16, USS KUB, pregnancy
  test applicability, the age ≥ 65 lactate line, the new protocols, the aliases, the filled gaps.

Verified: `pnpm run typecheck`, `pnpm -r run test` (pane-engine 126, dashboard 599, api-server 582,
front-desk 109, scripts 35), every scripts lint and `check:migrations-fresh`, the dashboard build,
`clinval:web`.

## Files outside this area

None of the files other agents are editing was changed (`clinical-inference.ts`, drug
interactions/classes, medication-history UI, pre-op checklists, questionnaire, social history,
Plan-tab suggestion badges, AppContext.tsx, BookingInboxTab.tsx, PatientSearchTab.tsx, iOS code).
The only files under `ios/` touched are three clinical-validation vignette JSONs (web known-gap
flags removed, as in `fix-web-protocols`).

## Needs sign-off

1. **No stat test from a considered diagnosis.** Stat tests of an unconfirmed leading differential
   are held back (not downgraded) until the diagnosis is confirmed; they remain in the reference
   ManagementPanel. Alternative: show them as "urgent — confirm the diagnosis first".
2. **Fallback to the leader** when the confirmed diagnosis has no protocol (e.g. O26.83 renal colic
   in pregnancy). The ManagementPanel deliberately shows nothing in that case; the suggestions
   (badged "leading differential", no stat) do use the leader.
3. **Leader threshold 20%** for seeding (the ManagementPanel's threshold; previously any top-3).
4. **SummaryTab now fills only from a confirmed diagnosis** (it used an unlocked working
   diagnosis too).
5. **Dictionary "Start"** still pre-adds stat/urgent tests to the ordered list (unchanged
   behaviour from UX C3), now adapted and without caveated tests. Should it become suggestions?
6. **New protocols** — `aortoenteric_fistula` (ESVS 2020; kind emergency; no ICD mapping) and
   `hsp_iga_vasculitis` (SHARE 2019; D69.0 for children and adults; steroids "may be considered"
   for severe abdominal pain or orchitis; monitoring "at least 6 months, 12 if urinary
   abnormalities persist"). Content and citations not verified by the surgeon.
7. **Protocol additions** — MRI pelvis for perianal Crohn's (ECCO-ESGAR 2019), CT for an
   obstructed/strangulated femoral hernia (WSES 2017), blood cultures in amoebic liver abscess.
8. **Age ≥ 65 acute-abdomen lactate line** (ESVS 2017; NELA): trigger = K-code protocol with
   immediate-phase steps, assessment not "elective".
9. **Paediatric fluids**: the ≥ 50 mL (or any litre volume) threshold that separates a fluid volume
   from a drug dose in mL in a fluid line; the exact string is shared with iOS.
10. **Pregnancy-test suppression**: age < 10 or > 55, male, or a recorded pregnancy.
11. **`anaplastic_thyroid` alias** to the thyroid carcinoma protocol; **`sah` left unaliased** until
    the syncope ranking is fixed.

## Not done

- iOS parity for any of this (other than the shared fluid string, which the iOS agent owns).
- `sah` alias (above). The syncope ranking itself belongs to the differential area.
- The Dictionary "Start" action still writes orders directly (sign-off item 5).

# Change log — `ios-parity-web-last-gaps` (the web-last-gaps fixes on iOS)

Owner-authorised "fix all gaps found" programme, 2026-09-25. Branch `ios-parity-web-last-gaps` from
`origin/claude/pr-37-gbg22z` at `b9f5a7c`. [web-last-gaps](web-last-gaps.md) ended "None of these
changes has an iOS version yet"; this branch brings each of them to iOS, word for word where the same
guideline applies. Area: iOS Swift only (plan cards, `PlanSafetyFilter`, score auto-fill and calculator,
triage diagnosis tiers, pipeline PMH flags, operative-plan default), the registry, the vignette
`knownGap` flags and this log. Not touched: web code, `DiagnosticDatabase.json`,
`BayesianDiagnosisEngine*`, the diagnosis / differential views.

Everything is **deterministic** (no AI, no network), **clinician-facing only** (hazard H-10: nothing
reaches a patient) and **unreviewed**. Every line is a suggestion the surgeon edits before anything is
saved. **Every citation below is unverified until the surgeon checks it.**

iOS has no prompt strip, so the web prompt rules run at the iOS plan choke points instead:
`PlanSafetyFilter.adaptLine` (radiation card, SOAP draft plan, pipeline decisions and auto-actions) and a
new card-level step in `DiagnosisRadiationEngine.applySafety`.

## Commits

| SHA | Change |
|---|---|
| `b679790` | Cards: IBC, pregnancy anticoagulation, LBO stent line, PE two-level Wells, appendicitis antibiotics, umbilical hernia (mesh ≥ 1 cm, smoking), NICE NG45 pre-op bloods |
| `d394ad0` | `PlanSafetyFilter` 1.1.0 + `PlanSafetyFilter+PromptParity.swift` + `DiagnosisRadiationEngine+PromptParity.swift`; `RadiationContext` reads CC, exam, imaging, SBP / HR, Hb / K⁺ / bilirubin; radiation content 1.3.0; pipeline PMH flags ignore relatives |
| `8a08426` | TG18 age ≥ 75 and metaraminol / vasopressin; Wells PE calculator two-level wording; acuity rules 1.2.0 (NICE NG19 terms) |
| `f63b9b6` | `WebLastGapsParityTests.swift` (web vectors, DRIFT NOTE) |
| `960670d` | Registry: radiation 1.3.0, plan safety 1.1.0, acuity 1.2.0, changelogs |
| `dc6bb53` | Vignettes: `ios` removed from 7 `knownGap` flags; TG18 grade 1 note updated |
| `29c160a` | Operative plan: no blanket co-amoxiclav prophylaxis default |
| `775eff0` | Surgical risk: hyperkalaemia action follows the UKKA bands |

## Item by item (web → iOS)

| # | web-last-gaps item | iOS before | iOS after |
|---|---|---|---|
| 1 | Colonic stent by side and contraindications (WSES 2018; ESGE 2020) | LBO card: generic lines, stent "not if perforation, peritonitis or ischaemia" | `PlanSafetyFilter.colonicStent` reads the diagnosis, assessment, imaging reports and exam (web rules: perforation / free gas, peritonitis / peritonism / guarding / rebound, ischaemia / pneumatosis, closed loop, caecum ≥ 12 cm; right-sided = caecum, ascending colon, hepatic flexure). A line proposing a colonic stent (card, SOAP, pipeline) is replaced by the web contraindicated line or the web right-sided line. The card's left-sided line is the web wording |
| 2 | Inflammatory breast cancer "not recommended" (NCCN) | "breast-conserving surgery and SLNB are contraindicated" | "Breast-conserving surgery (wide local excision) and sentinel node biopsy are not recommended in inflammatory breast cancer (NCCN)", with the web neoadjuvant → modified radical mastectomy wording |
| 3 | "DOACs and warfarin are contraindicated" in pregnancy (RCOG GTG 37a/b) | "LMWH only (DOACs and warfarin are teratogenic / contraindicated)", "LMWH, not DOACs or warfarin" | Web wording in the pregnancy header, the replaced DOAC line, the pregnancy safety note, the DVT card, the visit-risk flag and the recognition action |
| 4a | Fasting 6 h food / 2 h clear fluids (AAGBI 2010; ESA 2011) | Pre-op card only | Web line on cholecystectomy and hernia cards (adults) |
| 4b | SIGN 104 lap chole prophylaxis; HerniaSurge 2018 mesh prophylaxis | No prophylaxis line on the cards; new operative plans pre-filled "Co-amoxiclav 1.2 g IV at induction" | Web lines by risk (acute cholecystitis, jaundice, pregnancy, pancreatitis, immunosuppression → single dose; otherwise not indicated / not routine; incarcerated hernia → single dose). Operative-plan default: single dose only if indicated per SIGN 104 / local policy |
| 4c | WSES 2020 appendicitis antibiotics | "3–5 days only … no routine antibiotics after simple appendicitis" | Web lines: uncomplicated — no post-operative antibiotics; complicated — pip-tazo 3–5 days after source control (max 7) |
| 4d | No post-op antibiotics after TG18 Grade I–II cholecystectomy | — | Web line on the cholecystectomy cards when the diagnosis is acute cholecystitis |
| 4e | NSAID exclusions (NICE NG148; BNF) | NSAIDs withheld only for AKI / CKD 4–5 / dialysis / solitary kidney | Web analgesia line on operative cards, and every plan line proposing an NSAID is withheld for renal impairment (CKD, dialysis, eGFR < 60), age ≥ 75, heart failure, peptic ulcer / GI bleed history or an anticoagulant (lines that stop / avoid an NSAID are kept) |
| 4f | Kidney-adjusted VTE line (NICE NG89; BNF) | Patient-specific NICE NG89 line; eGFR checked before dialysis; "e.g. enoxaparin 40 mg" shown with renal adjustment | Dialysis checked first; dialysis → UFH or renally adjusted LMWH per renal team; eGFR < 30 → enoxaparin 20 mg; no 40 mg example in either |
| 4g | Ventral hernia template; cirrhosis / ascites (EHS/AHS 2020) | Umbilical card: mesh > 2 cm; cirrhosis line | Mesh for defects ≥ 1 cm, suture may be considered < 1 cm; smoking / weight optimisation; web cirrhosis line and inpatient line when cirrhosis or ascites is recorded |
| 5 | Penicillin lines withheld with the alternative | Withheld; "choose an alternative (BNF / local antimicrobial guideline)" | Withheld with the web wording "use a non-penicillin alternative per the local antimicrobial guideline (after anaphylaxis, avoid cephalosporins and carbapenems too unless allergy advice says otherwise)" |
| 6 | GI-bleed resuscitation only when unstable (BSG 2019; NICE CG141) | Upper GI card: "two large-bore cannulae" and cross-match for every bleed | Stable (a recorded SBP or HR; not SBP < 90, shock index > 1, Hb < 80 g/L, collapse / syncope / massive / large volume / clots): web Blatchford / Oakland line, restrictive transfusion only if needed, group and save instead of cross-match. Unstable or no vital signs: card unchanged |
| 7 | No routine clotting screen before elective surgery (NICE NG45) | Umbilical card "FBC / U&E / Clotting"; INR only for warfarin | No routine clotting in the card; the patient-specific investigations add "Clotting screen (PT/INR, APTT)" before surgery only with liver disease / bleeding disorder, heparin, jaundice (sign, symptom or bilirubin ≥ 34) or an emergency operation; DOAC: renal function, no coagulation test (already) |
| 8 | Two-level Wells PE (NICE NG158; ESC 2019) | Card two-level; calculator three bands ("CTPA or D-dimer" for 1.5–4) | Card: web line (CTPA directly > 4 with interim anticoagulation; ≤ 4 D-dimer then CTPA; D-dimer unhelpful after surgery and in pregnancy). Calculator: two-level recommendations (risk bands kept for display). D-dimer lines and investigations in pregnancy: withheld / annotated "not recommended" |
| 9 | UKKA 2023 potassium bands | AKI and hyperkalaemia cards: insulin–glucose and salbutamol for everyone | With a recorded K⁺ and no ECG change written: < 6.0 no shift therapy (web mild wording), salbutamol only ≥ 6.5. Surgical-risk alert: salbutamol only ≥ 6.5 |
| 10 | Anticoagulated-injury prompts (NICE NG232 2023; ACC 2020 ECDP) | A head injury counted as active bleeding (bleeding note) | Injury (head injury, fall, fracture, trauma, collision, assault) without a documented bleed → one note: INR (warfarin) or last dose + renal function (DOAC), CT head within 8 h, withhold until bleeding excluded, drug-specific reversal if bleeding / unstable; no bridging text. Haemothorax still counts as bleeding |
| 11 | Ultrasound first for children and pregnancy (WSES 2020; RCR iRefer; ACR 2018; ACOG CO 723) | Pregnancy: generic ionising-imaging note; children: none | A CT abdomen / pelvis line without an ultrasound-first qualifier gets the web child or pregnancy note; CT occult-malignancy screen withheld in pregnancy; card investigations annotated the same way |
| 12 | Diabetic foot red flag split (NICE NG19; web rules 1.4.0) | Diagnosis tiers: infection / osteomyelitis urgent, ulcer priority, "gangren" emergency; no "spreading redness" rule | Verified. Added "infected diabetic foot", "exposed bone" (urgent) and "diabetic foot", "foot wound" (priority). Acuity rules 1.2.0 |
| 13 | Asymptomatic screening-request triage rule | iOS triage has no "cancer" keyword flag and no comorbidity score; "screening" / "asymptomatic" already make a diagnosis clause non-acute | Verified, no change: the three web vignettes (`breast-family-history-brca`, `crc-screening-african-caribbean-fhx`, `screen-crc-fhx-sister-48-lynch-features`) already pass their iOS level expectations |
| 14 | Family history not a comorbidity | Pipeline PMH flags read "Family history of colorectal cancer" as the patient's malignancy | Clauses naming a relative (web `FAMILY_ENTRY`) are removed before the PMH flags are read; the new NSAID / renal / cirrhosis / immunosuppression reads use the patient's own entries only |
| 15 | TG18 age ≥ 75 | Auto-fill `> 75` | `≥ 75` (the web value); calculator item "Age ≥75"; organ rule also reads metaraminol and vasopressin (web additions). Organ auto-fill (`1f50221`) verified against the web rule |

Also checked: the torsion "if torsion cannot be excluded" wording concerns suspected torsion (web
prompt and emergency layer); the iOS card is for a confirmed torsion and the epididymo-orchitis
vignette passes, so it is unchanged. The asplenia card already names meningococcal ACWY and B.

## Tests

- `ios/AmiseMedFlowTests/WebLastGapsParityTests.swift` (24 tests, DRIFT NOTE): the web
  `web-last-gaps.test.ts` vectors run through the radiation card, `adaptLine` and `evaluate`.
- Existing iOS tests reviewed against the changed wording (`PlanSafetyFilterTests`,
  `RadiationSafetyAndScoresTests`, `ClinicalScoringEngineTests`, `ScoringEngineReferenceTests`): no
  asserted string changed.
- Swift cannot be compiled or run here. Every type and call was checked against its declaration
  (argument labels in declaration order, memberwise initialisers, no `Color.opacity` use).

Web and scripts (unchanged code): `pnpm run typecheck`; `pnpm -r run test` (pane-engine 126, scripts
37, front-desk 109, dashboard 773, api-server 600); every scripts lint (`lint:grants`,
`lint:rls-policies`, `check:migrations-fresh`, `lint:dx-phases`, `lint:patient-instructions`,
`scan:nav-lockout`, `lint:no-external-qr`, `lint:interaction-parity`, `lint:report-import-parity`,
`lint:guideline-registry`); `clinval:web`: 397 vignettes, 3087 expectations, 2919 pass, 76 fail, 92
n/a, 0 critical, **0 blocking** (unchanged). The results files were restored, not committed.

## Vignette flags

`ios` removed from `knownGap` (with its note) on 7 quality expectations, by reading the code paths the
runner calls against the last iOS run's outputs; CI confirms:

| Vignette / expectation | What now satisfies it |
|---|---|
| `periop-postop-aki-oliguria` / mgmt-no-insulin-dextrose-mild-k | K⁺ 5.8: the AKI card's insulin–glucose and salbutamol lines are withheld (UKKA bands) |
| `dvt-pregnancy-22wk` / inv-no-ddimer-in-pregnancy | Pipeline D-dimer line withheld; card D-dimer investigation says "not recommended" |
| `cholecystitis-elderly-diabetic-atypical` / mgmt-no-nsaid-ckd | Pipeline "diclofenac 75 mg IM" withheld (age 81, CKD 3a); card analgesia line "NSAIDs avoided" |
| `cholecystitis-tg18-grade3-organ-dysfunction` / inv-coagulation | Bilirubin 38 µmol/L → clotting screen before surgery (NICE NG45) |
| `periop-abx-clean-mesh-hernia` / mgmt-single-dose-prophylaxis | Hernia prophylaxis line ("a single dose for high-risk patients") |
| `hernia-umbilical-adult-elective` / mgmt-smoking | Umbilical card smoking / weight optimisation line |
| `appendicitis-paediatric-9y` / mgmt-no-unqualified-ct-child | SOAP investigations line gets the child ultrasound-first note |

The `cholangitis-tg18-grade1-single-criterion` auto-fill flag stays (the TG18 diagnostic criteria are
not auto-filled on iOS); its note is updated.

## Not done

- **TG18 diagnostic-criteria auto-fill** (web `tg18-autofill.ts`: Kiriyama cholangitis criteria,
  cholecystitis local signs, imaging, duration > 72 h) — only the organ rule and the age threshold are
  mirrored. Two iOS auto-fill flags stay (`cholangitis-tg18-grade1-single-criterion`,
  `cholecystitis-tg18-grade1`).
- **Web screening-prompt hooks** (surgical history / HPI in the preventive prompts, `knownDiabetes`):
  iOS `ScreeningEngine` / NG12 were not in this list.
- **Static texts without patient context**: the operative-note templates
  (`ProcedureTemplate+Laparoscopic.swift` post-operative orders "Paracetamol + Ibuprofen 400 mg TDS"),
  the pipeline "Prepare: VTE prophylaxis — enoxaparin 40 mg" auto-action (not renally adjusted), the
  penicillin-allergy operative-plan override ("Clindamycin 600 mg IV").
- **Web CDS** (TG18 cholecystitis and BISAP suggested from the working diagnosis): iOS
  `DiagnosisScoreMapper` already recommends TG18 cholecystitis for a cholecystitis diagnosis; not
  re-checked for BISAP.

## Needs sign-off

Deliberate iOS differences and new iOS choices:

1. **NSAID exclusions on every plan line.** The web applies them to its operative-template analgesia
   line; iOS withholds any line proposing an NSAID (card, SOAP, pipeline) for renal impairment (CKD,
   dialysis, eGFR < 60), age ≥ 75, heart failure, ulcer / GI bleed history or an anticoagulant —
   prophylactic enoxaparin counts, as on the web. Lines that stop / avoid an NSAID are kept.
2. **Pregnancy added to the NSAID reasons** of the operative analgesia line (the web line offers
   ibuprofen "if renal function is normal" in pregnancy; its pregnancy prompt forbids NSAIDs from 20
   weeks).
3. **Stable GI bleeding needs a recorded SBP or heart rate** on iOS (the web treats missing vital signs
   as stable). A stable upper GI bleed keeps a restrictive-transfusion line (Hb 70 / 80 g/L) the web
   stable line leaves out, because two high-Blatchford vignettes expect it.
4. **UKKA bands apply only with a recorded potassium and no ECG change written** (hyperkalaemic ECG
   changes keep the full card). K⁺ below 5.5 also withholds shift therapy.
5. **Colonic stent rule** (web sign-off item 2): the same contraindications and right-sided sites; on
   iOS it also rewrites stent lines from the SOAP vademecum and the pipeline.
6. **D-dimer withheld in pregnancy** on every line (RCOG GTG 37a/b); the web only states it is
   unhelpful. After recent surgery iOS only states it (PE card), as the web does.
7. **Occult-malignancy CT withheld in pregnancy** on every line; CT abdomen / pelvis in a child or in
   pregnancy is annotated (not removed).
8. **Injury on an anticoagulant**: injury words are read from the CC, HPI, diagnosis and assessment
   ("fell", "fall at home / down / from / onto / on", head injury, trauma, collision, assault,
   fracture); a head injury without a documented bleed no longer triggers the bleeding note. Vitamin K
   antagonists and DOACs only (heparins not included).
9. **Clotting screen** (web sign-off item 11): added as a patient-specific investigation before
   surgery; "emergency" is read from the assessment text.
10. **Operative-template lines on cards**: added to cholecystectomy, appendicectomy and hernia cards
    for adults only (not under 16, not on recognise-and-redirect cards); SIGN 104 high-risk list and
    HerniaSurge wording as web sign-off items 5 and 6.
11. **Operative-plan default**: "single dose at induction only if indicated (SIGN 104 / local policy)"
    replaces "Co-amoxiclav 1.2 g IV at induction" for new plans.
12. **Relatives' history entries**: a clause naming a relative (mother, father, sister, brother,
    parents, aunt, uncle, grandparent, cousin, relative, family history) is dropped from the pipeline
    PMH flags and the new rules — a single clause such as "Type 2 diabetes — father also diabetic"
    would be dropped too.
13. **TG18 age ≥ 75** (web sign-off item 1): iOS used > 75; now ≥ 75 in the auto-fill and the item
    label. Metaraminol and vasopressin count as vasopressors.
14. **Diabetic foot (NICE NG19)**: "infected diabetic foot" / "exposed bone" urgent, "diabetic foot" /
    "foot wound" priority. **Gangrene stays an emergency term on iOS** (web: urgent red flag) because the
    same term covers gangrenous bowel, gallbladder and Fournier's gangrene.
15. **Wells PE calculator**: the low / moderate display bands are kept; both now recommend D-dimer first
    (two-level Wells).
16. **Penicillin**: iOS keeps withholding a penicillin line even when it also names the allergy
    alternative (the web leaves such a line as written); immediate reactions still withhold
    cephalosporins and carbapenems (ios-plan-safety sign-off item 1).
17. **Pre-operative potassium alert**: calcium gluconate "if ECG changes" and salbutamol only ≥ 6.5.

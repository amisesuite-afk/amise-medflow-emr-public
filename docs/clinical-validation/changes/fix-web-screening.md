# Change log — `fix-web-screening` (web screening, preventive care and suspected-cancer rules)

Owner-authorised "fix all gaps" programme, 2026-09-25. Area: web screening and preventive care
(SURGEON-DECISIONS **G2.19** and **C9**, with the lab-reading part of **C1**). Sources of the gaps:
`findings/prevobspaed.md`, `findings/colorectal-anorectal.md`, `findings/hernia-breast-endocrine.md`.

Every citation below is unverified until the surgeon checks it. Nothing here orders a test: every
item is a dismissible prompt the clinician confirms. Deterministic only; no AI, no network.

## Results (`pnpm --filter @workspace/scripts run clinval:web`, 397 vignettes, 3087 expectations)

| | Pass | Fail | Critical fail | Blocking |
|---|---|---|---|---|
| Before (base `72e083a`) | 1882 | 1113 | 546 | 0 |
| After | 1938 | 1057 | 533 | 0 |

56 expectations went from fail to pass (13 critical), none from pass to fail. Their `knownGap: ["web"]`
flags (with `knownGapNote`/`proposedFix`) were removed; for four that were `unverified: ["web"]`
because the harness does not pass family history, `web` was removed from `unverified` because they
now pass from the recorded comorbidities, the same path the dashboard uses
(`crc-lynch-surveillance-overdue/flag-lynch`, `/inv-colonoscopy`,
`crc-screening-african-caribbean-fhx/mgmt-screening-offered`,
`screen-crc-fhx-sister-48-lynch-features/mgmt-colonoscopy`). No expectation was weakened or deleted.

Expectations now passing:

- Critical: `breast-nipple-discharge-bloody-single-duct` flag-2ww, inv-mammogram, inv-uss;
  `crc-fit-positive-abdominal-pain` flag-fit-positive, inv-colonoscopy, mgmt-suspected-cancer-pathway;
  `crc-ida-no-gi-symptoms` flag-ida, inv-colonoscopy; `iron-deficiency-anaemia-over60` flag-ida,
  inv-colonoscopy; `crc-lynch-surveillance-overdue` flag-lynch, inv-colonoscopy;
  `haematuria-visible-smoker-2ww` level-priority.
- Quality: every screening expectation listed in `findings/prevobspaed.md` for CRC (45, 76–85, FHx,
  Lynch, polyp intervals, piecemeal EMR site check), breast (biennial, BRCA carrier MRI,
  risk-reducing surgery, high-risk service), cervical (HPV, no screening after total
  hysterectomy), prostate (none ≥ 70), AAA, HBV/HCV/HIV, H. pylori in FDR of gastric cancer, clinic
  BP confirmation (ABPM/HBPM, urine ACR, CV risk), 10-year CV risk; plus FIT read, IDA iron
  replacement / coeliac serology / urinalysis, NG12 cancer-screen reason for rectal bleeding ≥ 50,
  Lynch 2-yearly interval and aspirin discussion, smoking cessation (2 vignettes), HIV test in anal
  cancer, genetics referral for a breast/ovarian family history, and no PSA order before a hernia
  repair.

The 131 "Flags to remove" the harness already listed on the base run belong to other areas and were
left alone.

## Engine behaviour changes

1. **New module `lib/triage-engine/src/screening/preventive.ts`** (`preventiveScreeningItems`,
   `PREVENTIVE_SCREENING_VERSION = '1.0.0'`), exported from `@workspace/triage-engine`. Port of the
   iOS `ScreeningEngine` (`ios/AmiseMedFlow/Views/Consultation/PathwayData.swift`), aligned to
   current guidance (below). It reads, negation-aware and whole-word (`negation.ts`):
   - structured past history (diagnoses such as diabetes, hypertension, CVD, HIV/HBV/HCV are read
     from here only, never from the assessment text; "Previous gestational diabetes" and "Family
     history: mother type 2 diabetes" are not a diabetes diagnosis);
   - clinician notes (assessment) for polyp findings, hysterectomy, carrier status and the last
     normal colonoscopy (sentences about relatives are skipped);
   - family history chips/notes and "Family history: …" past-history entries (site, first/second
     degree, age at diagnosis);
   - toxic habits (current/former/never smoker, pack-years, years since quitting), BMI, clinic BP,
     results already on file.
   It returns nothing without an age and in an emergency encounter (screening belongs to an
   elective visit).
2. **Dashboard adapter `artifacts/dashboard/src/lib/preventive-screening-prompts.ts`**
   (`computePreventivePrompts`). `computeClinicalPrompts` (clinical-inference.ts) now calls it at a
   single call site in place of its fixed preventative block. The wellness panel moved there
   unchanged.
3. **`cancer-screening.ts` 1.1.0** (`CANCER_SCREENING_VERSION`, was unversioned):
   - new NG12 criteria (below), each with `id`, `site` and `investigations`;
   - `labs` input and `readCancerScreenLabs()` (Hb, ferritin, MCV, FIT from result names, whole-word:
     "HbA1c" is not Hb; Hb > 25 or in g/L is converted to g/dL; "FIT: positive"/"< 10" handled);
   - `freeText` input, read negation-aware by the new rules only;
   - all existing text tests (and `detectReferrals`) are now negation-aware, with one clause per chip
     (`joinClauses`) so "no weight loss" does not count and a negation cannot reach the next chip;
   - `CancerCriterion.pathway` ('urgent' for BSG IDA under 60) — `referralUrgency` is
     `two_week_wait` if any 2WW criterion is met, else `urgent`;
   - the operator-precedence fix is kept (the colorectal block's condition is unchanged).
4. **Suspected-cancer consultation prompt** (`ng12_suspected_cancer`, type `safety`, priority): shows
   the 1.1.0 criteria met (FIT, IDA, rectal bleeding ≥ 50, weight loss + pain ≥ 40, nipple ≥ 50,
   haematuria ≥ 45) with their investigations and a "Suspected … cancer pathway referral (2-week
   wait)" plan line; the IDA criteria add oral/IV iron (BSG 2021). Not shown when the record already
   states an (unhedged) cancer at that site ("Obstructing sigmoid cancer" yes, "Suspected colorectal
   cancer" no). In an emergency encounter it carries no investigation orders, only "arrange once the
   acute episode is managed". The older chip rules (dysphagia, jaundice ≥ 40, breast lump ≥ 30)
   still reach the clinician only through the triage banner, as before (showing them here flagged
   cholangitis, varices, caustic ingestion, EoE and thyroid compression as "2-week wait").
   A microcytic anaemia without a ferritin gets a ferritin prompt (`anaemia_ferritin_check`).
5. **Triage effect** (through `screenForCancer`, called by `adaptiveTriage` with the symptom chips):
   the new chip-readable rules (nipple change ≥ 50, rectal bleeding ≥ 50, weight loss + abdominal
   pain ≥ 40, haematuria ≥ 45) raise a routine/review case to priority / same-day call, as every NG12
   rule already did. `adaptive-triage.ts` was not changed.

## Clinical content changes (before → after)

| Topic | Before (clinical-inference.ts fixed rules) | After | Guideline |
|---|---|---|---|
| Colorectal, average risk | FOBT every 2 years or colonoscopy every 10 years, from 50, no upper limit | FIT every year or colonoscopy every 10 years, 45–75; "up to date" if a normal colonoscopy < 10 years ago | USPSTF 2021; ACG 2021 |
| Colorectal, 76–85 | Same as 50+ (10-yearly colonoscopy at 81) | Individualised decision (health, life expectancy, prior screening); nothing over 85 | USPSTF 2021 (grade C) |
| Colorectal, family history | FDR: colonoscopy from 40 / 10 years before (35–49), or "≥ 50 + FHx" | FDR < 60 or ≥ 2 FDRs: colonoscopy from 40 or 10 years before the youngest, every 5 years; one FDR ≥ 60: from 40 at average-risk intervals; second-degree only: average risk | ACG 2021; US MSTF 2017 |
| Lynch (family) | None | CRC < 50 in a relative, ≥ 2 Lynch-spectrum cancers incl. CRC/endometrial, or Lynch named → request relative's tumour MMR/MSI, clinical genetics referral | NCCN 2024; revised Bethesda |
| Lynch carrier | None | Colonoscopy every 2 years from 25 (MLH1/MSH2/EPCAM) or 35 (MSH6/PMS2); aspirin discussion (no dose); gynaecology for women; genetics / cascade testing | BSG/ACPGBI/UKCGG 2019; NCCN 2024; NICE NG151 2020 |
| Post-polypectomy | None (generic screening prompt 4 weeks after EMR) | US MSTF 2020 table: 1–2 TA < 10 mm → 7–10 y; 3–4 → 3–5 y; 5–10 → 3 y; > 10 → 1 y + genetics; ≥ 10 mm / villous / HGD → 3 y; piecemeal EMR ≥ 20 mm → site check 6 months, then 1 y, then 3 y; SSL and hyperplastic rows; unknown details → "per report" | US MSTF 2020 |
| Breast, average risk | Annual mammogram from 40, no upper limit | Mammogram every 2 years, 40–74 | USPSTF 2024 |
| Breast, BRCA carrier | Nothing (only a FHx chip triggered BRCA discussion, "testing if Manchester ≥ 17") | Annual MRI from 25, annual mammography from 30; discuss risk-reducing mastectomy and RRSO (35–40 BRCA1, 40–45 BRCA2); high-risk / genetics service | NCCN 2024; ACR 2023 |
| Breast, family history | Manchester ≥ 17 genetics; annual MRI + mammogram from 30 for all | Familial risk tool, genetic counselling if positive; MRI + mammography from 30 only if lifetime risk ≥ 20% | USPSTF 2019; ACR 2023 |
| Cervical | "Smear every 3 years (21–65)", refer gynaecology if overdue, also after hysterectomy | Cytology every 3 years 21–29; primary HPV every 5 years 30–65 (cytology if HPV unavailable); HIV: HPV from 25; none after total hysterectomy for benign disease without CIN2+ | USPSTF 2018; WHO 2021 |
| Prostate | PSA discussion from 50, no upper limit, PSA ordered on confirm | Shared decision 55–69 (45–54 with a family history of prostate cancer or BRCA); none ≥ 70; no automatic PSA order | USPSTF 2018; ACS 2023 (earlier start) |
| AAA | None | One-time aortic ultrasound, men 65–75 who ever smoked | USPSTF 2019 |
| Lung | Smoker ≥ 50, no upper age, ex-smokers missed | LDCT yearly at 50–80, ≥ 20 pack-years, current or quit ≤ 15 years, shared decision; pregnancy caveat | USPSTF 2021 |
| Tobacco | Inside the lung prompt only | Separate cessation item for every current smoker (behavioural only in pregnancy) | USPSTF 2021 |
| HCV / HBV / HIV | None | HCV 18–79 once; HBV triple panel once (all adults); HIV 15–65 and in pregnancy; HBV vaccination 19–59 if non-immune; known infections excluded | USPSTF 2020; CDC 2023; USPSTF 2019; ACIP 2022 |
| Diabetes | From 40 (skipped for anyone whose history contained "diabet", incl. GDM) | From 35; earlier with BMI ≥ 25 + a risk factor, or previous GDM; repeat every 3 years (yearly with prediabetes) | ADA 2024 §2 |
| Blood pressure | None below 180 systolic | Clinic 140–179 / 90–119 without hypertension on record → ABPM (or HBPM), urine ACR, U&E, HbA1c, lipids, ECG, fundi | USPSTF 2021; NICE NG136 |
| CV risk / lipids | Lipid profile inside the diabetes prompt | 40–75 without CVD: lipid profile + 10-year ASCVD risk; statin discussion if ≥ 10% with a risk factor | USPSTF 2022; ACC/AHA 2019 |
| H. pylori | None | FDR with gastric cancer → stool antigen / urea breath test off PPI, eradicate, confirm | Maastricht VI/Florence 2022; ACG 2024 |
| Osteoporosis | DXA ≥ 65 + "Vitamin D 800 IU + calcium 1200 mg daily if deficient" | DXA ≥ 65 + FRAX; the supplement dose line was removed (no dose in USPSTF 2018) | USPSTF 2018 |
| NG12: nipple | Discharge counted only with a lump | Discharge, retraction or other change in one nipple ≥ 50 → 2WW; bloody → duct excision if imaging normal | NICE NG12 1.8.1 (2015); ACR AC 2022 |
| NG12: rectal bleeding | Needed a change in bowel habit | Unexplained rectal bleeding ≥ 50 → 2WW | NICE NG12 1.3.1 (2015) |
| NG12: weight loss + pain | None | ≥ 40 with weight loss and abdominal pain → colorectal 2WW | NICE NG12 1.3.1 (2015) |
| FIT | Not read | FIT ≥ 10 µg Hb/g (or recorded positive) → colorectal 2WW at any age | NICE DG56 2023; BSG/ACPGBI 2022 |
| IDA | Text "anaemia/pale/tired" ≥ 60 | Hb < 13 (men) / < 12 (women) with ferritin < 45: ≥ 60 → 2WW; men and women ≥ 50 under 60 → urgent bidirectional endoscopy; + coeliac serology, urinalysis, oral iron (one tablet daily or alternate days; IV if not tolerated) | NICE NG12 1.3.1; BSG 2021 |
| Haematuria | Urology referral (text) | Unexplained visible haematuria ≥ 45 (not with UTI/stones/loin pain; not non-visible only) → 2WW: cystoscopy, CT urogram | NICE NG12 1.6 (2015) |

Removed from the web: the fixed "PSA if patient consents" investigation, "refer gynaecology if smear
overdue", and the osteoporosis supplement doses. Not ported from iOS: AUDIT-C, PHQ-9, influenza,
tetanus booster and pneumococcal vaccine lines (the vaccination schedule is an open surgeon decision,
prevobspaed D6).

## Clinical-content registry

- `cancer-screening`: unversioned → 1.1.0, version stamp `CANCER_SCREENING_VERSION`, tests and
  changelog added.
- New `preventive-screening` 1.0.0 (stamp `PREVENTIVE_SCREENING_VERSION`), added to
  `docs/CLINICAL-CONTENT-INVENTORY.md` and the lint's `KNOWN_RULE_SET_FILES`.
- `lastReviewed` stays `unknown`.

## Tests

- `artifacts/api-server/src/test/cancer-screening-ng12.test.ts` (lab reading, thresholds, each new
  NG12 rule and its exclusions, negation-aware chips, `detectReferrals` negation).
- `artifacts/dashboard/src/lib/__tests__/preventive-screening.test.ts` (every screening rule and
  boundary age, polyp parser and intervals, family/personal/smoking parsing, and the
  `computeClinicalPrompts` integration: old rules gone, emergency suppression, FIT/IDA prompts,
  known-cancer suppression).

## iOS parity — changes needed in `ios/AmiseMedFlow/Views/Consultation/PathwayData.swift` (not made: iOS is another owner)

TODO(parity): apply these to `ScreeningEngine.items` / `WellnessScreening`, keeping the web module
(`lib/triage-engine/src/screening/preventive.ts`) as the reference.

1. `WellnessScreening` new Bool fields (decode with `?? false`, as the others): `lynchCarrier`,
   `familyHxLynchFeatures`, `brcaCarrier`, `totalHysterectomy`, `cervicalHighGradeHistory`,
   `priorGestationalDiabetes`, `familyHxGastricCancer`; optional `lastNormalColonoscopyYearsAgo: Int?`.
2. Colorectal:
   - add `crc-lynch` (before `crc-polyps`): "Colonoscopy every 2 years from 25 (MLH1/MSH2/EPCAM) or
     35 (MSH6/PMS2); discuss aspirin; gynaecology review (women); genetics / cascade testing",
     `ix: "Colonoscopy"`, `high: true`;
   - `crc-polyps` detail: the US MSTF 2020 intervals (see the table above) instead of "interval per
     last colonoscopy/histology report" when size/number/histology are recorded;
   - `crc-fh`: distinguish FDR < 60 or ≥ 2 FDRs (colonoscopy every 5 years from 40 or 10 years
     before) from one FDR ≥ 60 (from 40, average-risk options);
   - add `crc-lynch-fh` when `familyHxLynchFeatures`: "Request relative's tumour MMR/MSI; clinical
     genetics referral";
   - add `crc-76-85`: `(76...85).contains(age)` → "Individualised decision (health, life expectancy,
     prior screening) — USPSTF 2021 grade C", no ix;
   - `crc` detail when `lastNormalColonoscopyYearsAgo < 10`: "Up to date — next colonoscopy 10 years
     after the last normal one".
3. Breast: `brcaCarrier && age >= 25` → "Annual breast MRI from 25, annual mammography from 30;
   discuss risk-reducing mastectomy and RRSO; high-risk service" (`ix: "MRI breast"`); keep
   `breast-fh` but change its detail to "Familial risk tool; genetic counselling if positive; MRI +
   mammography from 30 if lifetime risk ≥ 20%", and still show the biennial `breast` item at 40–74
   for family-history (non-carrier) women (today `breast-fh` replaces it).
4. Cervix: skip `cervix` when `totalHysterectomy && !cervicalHighGradeHistory`; HPV from 25 for
   women with HIV (no HIV field today — optional).
5. PSA: `(early ? 45 : 50)...69` → `(early ? 45 : 55)...69` (USPSTF 2018 starts at 55). Whether
   African-Caribbean ancestry alone keeps the start at 45 is listed under "Needs sign-off" (the web
   has no ancestry input and uses family history only).
6. Hepatitis B: add `hbv` for `age >= 18`: "Hepatitis B triple panel (HBsAg, anti-HBs, anti-HBc)
   once — CDC 2023", `ix: "Hepatitis B surface antigen"`.
7. Diabetes: `dmRisk` must be `(bmi ?? 0) >= 25 && (w.familyHxDiabetes || w.hypertension)` (ADA
   2024: overweight AND a risk factor; today either alone counts), plus `|| w.priorGestationalDiabetes`.
8. Lipids: detail "Lipid profile and 10-year cardiovascular risk (Pooled Cohort Equations); statin
   discussion if ≥ 10% with a risk factor (USPSTF 2022)".
9. H. pylori: `familyHxGastricCancer` → "Stool antigen or urea breath test off PPI 2 weeks; eradicate
   and confirm (Maastricht VI 2022)".
10. Blood pressure: when the latest clinic BP is 140–179 / 90–119 without hypertension, detail
    "Confirm with ABPM (or HBPM); urine ACR, U&E, HbA1c, lipids, ECG, fundi (NICE NG136)".
11. Suspected-cancer (NG12) rules have no iOS equivalent (no `screenForCancer` port). FIT ≥ 10, IDA
    from Hb + ferritin, nipple ≥ 50, rectal bleeding ≥ 50 and haematuria ≥ 45 would need a Swift
    twin reading `LabAnalyteCatalog` values.

## Hooks needed in other areas (not changed here)

- **Triage (`adaptive-triage.ts`)**: `screenForCancer` is called with the symptom chips only. Passing
  `freeText` (the text it already builds) and `labs: readCancerScreenLabs(...)` (it has no labs input
  today) would let FIT and IDA raise the triage level: `crc-fit-positive-abdominal-pain/level-at-least-priority`
  (critical) still fails for this reason.
- **`clinical-inference.ts` / `ClinicalPromptsStrip`**: `InferenceInput` has no surgical history or
  HPI, so hysterectomy, previous colonoscopy and polypectomy are read from the comorbidities and the
  assessment only. Passing `surgicalHistory` into the preventive adapter would close that.
- **`clinical-inference.ts` diabetes prompts**: `hasPmh(comorbidities, 'diabet')` still reads
  "Previous gestational diabetes" / "Family history: mother type 2 diabetes" as diabetes
  (`screen-diabetes-38-overweight-prior-gdm/mgmt-no-diabetic-label` still fails); the preventive
  module's `readPersonalRisk().knownDiabetes` shows the rule to use.
- **`lab-reader-keywords.ts`**: the new whole-word readers (ferritin, MCV, FIT) are not in
  `WEB_LAB_READERS`; they do not collide with existing keywords, but the report importer's misread
  warnings would be more complete with them.
- **Not done (outside this list):** tetanus-prone wound and post-splenectomy vaccination (G3; the
  schedule is surgeon decision D6), screening over-triage from topic words such as "bowel cancer
  screening" (triage).

## Needs sign-off

1. **Rule set**: USPSTF as the primary screening source for this practice, ACG/US MSTF for
   colonoscopy and polyp surveillance, NCCN/ACR for high-risk breast, ADA 2024 for diabetes, NICE
   NG136 for BP confirmation (G2.19 answered "USPSTF").
2. **Rectal bleeding ≥ 50**: direct 2-week-wait referral (NG12 2015). NG12's 2023 update puts FIT
   first for this group; direct referral was kept as the more conservative option.
3. **IDA**: ferritin cut-off 45 µg/L (BSG 2021) and age ≥ 50 as a stand-in for post-menopausal status.
4. **PSA**: discussion from 45 with a family history of prostate cancer or BRCA (ACS 2023); whether
   African-Caribbean ancestry alone should also start at 45 (iOS does; web has no ancestry input).
5. **Hepatitis B**: universal once-in-adulthood screening (CDC 2023) rather than USPSTF 2020
   risk-based screening.
6. **Diabetes**: screening every adult from 35 (ADA 2024; USPSTF 2021 limits to overweight 35–70).
7. **Lynch aspirin**: discussion only; the dose is the clinician's (NICE NG151 does not fix it in
   this item).
8. **Oral iron wording**: "one tablet daily or on alternate days" (BSG 2021) with the preparation left
   to the prescriber.
9. **Consultation suspected-cancer prompt scope**: shows the 1.1.0 criteria only; the older chip rules
   (dysphagia, jaundice ≥ 40, breast lump ≥ 30) stay triage-banner only.
10. Removal of the osteoporosis vitamin D / calcium dose line.

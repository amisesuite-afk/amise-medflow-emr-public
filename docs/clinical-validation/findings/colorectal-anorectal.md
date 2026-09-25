# Clinical validation findings — colorectal and anorectal cluster

Web harness run on `clinval-crc` (based on `claude/pr-37-gbg22z` 52616d2), 2026-09-25. The run was
local and measured only; no engine, threshold or clinical data was changed. Every citation is
`verified: false` until a clinician checks it against the source. Every expectation needs the
surgeon's sign-off (`reviewedBy`).

## What was added

43 vignettes in `ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/` (20 `colorectal`, 18
`anorectal`, 4 `gi-emergency`, 1 `vascular`), with 239 expectations (133 critical).

| Group | Vignettes |
|---|---|
| Lower GI bleeding (BSG 2019, ACG 2023) | `lgib-oakland-low-risk-discharge` (base), `lgib-unstable-cta-first`, `lgib-unstable-warfarin`, `lgib-diverticular-apixaban`, `lgib-angiodysplasia-aspirin`, `lgib-post-polypectomy`, `rectal-bleeding-young-haemorrhoidal` |
| Colorectal cancer red flags, FIT, screening, surveillance (NICE NG12/DG56, BSG/ACPGBI 2022, BSG 2020, USPSTF/ACG 2021) | `crc-cibh-fit-positive-older` (base), `crc-fit-positive-abdominal-pain`, `crc-rectal-mass-fit-negative`, `crc-ida-no-gi-symptoms`, `crc-rectal-bleeding-weight-loss-52`, `crc-young-onset-34`, `crc-lynch-surveillance-overdue` (base), `crc-screening-african-caribbean-fhx`, `polyp-surveillance-high-risk-3y` |
| IBD (ECCO 2022, BSG 2019, ECCO infections 2021, ECCO Crohn's surgery 2020) | `uc-acute-severe-truelove-witts` (base), `uc-asuc-day3-nonresponse`, `uc-toxic-megacolon`, `uc-flare-cdiff`, `uc-steroid-refractory-cmv`, `crohns-ileocaecal-abscess` (base), `crohns-perianal-complex-fistula` |
| Anorectal (ASCRS 2022 abscess/fistula, 2023 fissure, 2024 haemorrhoids, 2019 pilonidal, 2017 prolapse, 2018 anal SCC; WSES 2018 NSTI) | `perianal-abscess-simple` (base), `perianal-abscess-diabetic-cellulitis`, `perianal-abscess-hiv`, `fistula-in-ano-simple-low` (base), `fistula-in-ano-complex-anterior-female`, `anal-fissure-acute-posterior` (base), `anal-fissure-chronic-refractory`, `anal-fissure-atypical-lateral-hiv`, `haemorrhoids-grade3-over-50` (base), `haemorrhoids-thrombosed-external-48h`, `haemorrhoids-bleeding-warfarin-71`, `pilonidal-abscess-acute`, `rectal-prolapse-incarcerated`, `anal-cancer-red-flags`, `fournier-gangrene` (base), `fournier-sglt2-early-mimic` |
| Mimics (ACG 2015 colon ischaemia, ESVS 2017, IDSA 2017 diarrhoea, IDSA/SHEA CDI, WSES 2019 CDI) | `ischaemic-colitis-left` (base), `ischaemic-colitis-right-af-ami`, `infective-colitis-bloody-diarrhoea` (base), `cdiff-fulminant-colitis` |

Permutations cover age (24–82), anticoagulants (warfarin, apixaban) and antiplatelets (aspirin,
clopidogrel), IBD on biologics/thiopurines, HIV (CD4 140 and on ART), diabetes (including an SGLT2
inhibitor), severity (Oakland ≤ 8 vs unstable; ASUC vs toxic megacolon; early vs established
Fournier's) and dangerous mimics (ischaemic colitis, AMI, infective colitis, C. difficile, early NSTI
labelled as an abscess).

## Web results

| | Pass | Fail | n/a |
|---|---|---|---|
| All expectations (239) | 140 | 97 | 2 |
| Critical (133) | 86 | 47 (44 `knownGap`, 3 `unverified` web — harness limit, below) | 0 |
| Quality (106) | 54 | 50 | 2 |

`clinval:web` exits 0: no blocking failure. Every failure carries a `knownGapNote` with what the
engine does instead, and a `proposedFix` where the fix is clear. No `knownGap` currently passes.

**iOS**: not run locally. All 235 iOS-applicable expectations are `unverified: ["ios"]` until the
first CI run. From the source, iOS has several things web lacks (an Oakland calculator mapped to
"lower gi bleed", Truelove-Witts, LRINEC and FGSI calculators, a perianal-abscess radiation entry
that mentions EUA, seton and LIFT); the CI results should be triaged against these notes.

### Per vignette (web)

| Vignette | Permutation | Critical pass | Quality pass |
|---|---|---|---|
| `lgib-oakland-low-risk-discharge` | base | – | 3/6 |
| `lgib-unstable-cta-first` | unstable, elderly | 3/5 | 3/4 |
| `lgib-unstable-warfarin` | warfarin, INR 4.6 | 3/4 | 0/1 |
| `lgib-diverticular-apixaban` | stable major, DOAC | 2/3 | 2/4 |
| `lgib-angiodysplasia-aspirin` | IDA, aortic stenosis, aspirin | 3/4 | 0/5 |
| `lgib-post-polypectomy` | day 6 after EMR, clopidogrel | 2/2 | 1/3 |
| `rectal-bleeding-young-haemorrhoidal` | 24 y, no red flags | – | 3/5 |
| `crc-cibh-fit-positive-older` | base | 5/5 | 2/4 |
| `crc-fit-positive-abdominal-pain` | FIT is the only red flag | 1/5 | – |
| `crc-rectal-mass-fit-negative` | FIT < 10, rectal mass | 3/4 | 2/2 |
| `crc-ida-no-gi-symptoms` | IDA only | 1/4 | 0/2 |
| `crc-rectal-bleeding-weight-loss-52` | age 52, no CIBH | 5/5 | 0/1 |
| `crc-young-onset-34` | age 34, labelled piles | 3/3 | 2/2 |
| `crc-lynch-surveillance-overdue` | base | 0/2 (unverified) | 0/2 |
| `crc-screening-african-caribbean-fhx` | screening, FDR at 58 | – | 0/2 |
| `polyp-surveillance-high-risk-3y` | advanced adenoma | – | 2/2 |
| `uc-acute-severe-truelove-witts` | base | 5/6 | 5/8 |
| `uc-asuc-day3-nonresponse` | day 3 | 3/3 | 1/2 |
| `uc-toxic-megacolon` | toxic megacolon | 5/6 | 1/2 |
| `uc-flare-cdiff` | CDI, azathioprine | 0/2 | 1/1 |
| `uc-steroid-refractory-cmv` | CMV, biologic + thiopurine | 0/2 | 1/1 |
| `crohns-ileocaecal-abscess` | base | 2/5 | 2/4 |
| `crohns-perianal-complex-fistula` | perianal, complex | 6/6 | 2/2 |
| `perianal-abscess-simple` | base | 3/3 | 0/1 |
| `perianal-abscess-diabetic-cellulitis` | diabetes, cellulitis | 4/4 | 2/3 |
| `perianal-abscess-hiv` | HIV, CD4 140 | 3/5 | 1/2 |
| `fistula-in-ano-simple-low` | base | 0/2 | 1/1 |
| `fistula-in-ano-complex-anterior-female` | complex anterior | 2/4 | – |
| `anal-fissure-acute-posterior` | base | – | 3/5 |
| `anal-fissure-chronic-refractory` | chronic, failed diltiazem | – | 2/2 |
| `anal-fissure-atypical-lateral-hiv` | atypical, HIV | 1/4 | 0/1 |
| `haemorrhoids-grade3-over-50` | base | 1/1 | 2/3 |
| `haemorrhoids-thrombosed-external-48h` | thrombosed, 48 h | – | 1/2 |
| `haemorrhoids-bleeding-warfarin-71` | warfarin, 71 y | 2/2 | 2/2 |
| `pilonidal-abscess-acute` | base | 1/1 | 1/3 |
| `rectal-prolapse-incarcerated` | base | 3/3 | 0/1 |
| `anal-cancer-red-flags` | base | 3/5 | 1/3 |
| `fournier-gangrene` | base | 3/5 | 0/1 |
| `fournier-sglt2-early-mimic` | early, SGLT2i, abscess label | 1/3 | 0/1 |
| `ischaemic-colitis-left` | base | 2/3 | 4/4 |
| `ischaemic-colitis-right-af-ami` | right-sided, AF, lactate 4.1 | 1/3 | 1/1 |
| `infective-colitis-bloody-diarrhoea` | base | 1/3 | 0/3 |
| `cdiff-fulminant-colitis` | fulminant CDI | 3/6 | – |

## Proposed fixes, ranked by patient safety

Each item names the vignettes that show it and the file to change. None of these were made here.

### 1. Lower GI bleeding gets the upper-GI (variceal) plan; nothing orders CT angiography

`lgib-unstable-cta-first`, `lgib-unstable-warfarin` (critical ×3). There is no lower-GI-bleeding
protocol or dx-variant. The ICD a surgeon picks for LGIB (K92.2) matches `upper_gi_bleed`
(`icd10Prefixes` K92) and the "Upper GI Bleed" dx-variant group, so the documented plan for an
unstable haematochezia in a patient without liver disease includes "Suspected varices: terlipressin"
and OGD, and no output anywhere asks for CT angiography (BSG 2019: CTA first when shock index > 1).
**Fix**: add a lower-GI-bleeding protocol and dx-variant group (unstable → CTA → embolisation; stable
major → admit + colonoscopy; Oakland ≤ 8 → discharge); drop K92 from the UGIB prefixes or require
upper-GI words; route K57.x1 (diverticular bleed) and K55.2x (angiodysplasia) to it
(`lib/pane-engine/src/management/protocols/upperGI.ts`, `colorectalHerniaBreast.ts`,
`artifacts/dashboard/src/lib/dx-variants.ts`).

### 2. Fournier's gangrene is not recognised and has no plan

`fournier-gangrene`, `fournier-sglt2-early-mimic` (critical ×4). PANE ranks acute cholangitis first
for a septic diabetic with perineal crepitus and necrosis (top 3: cholangitis, perianal abscess,
cholecystitis); the necrotising-fasciitis disease is not reached from perineal features. N49.3 has no
protocol (`necrotising_fasciitis` is keyed to M72.6), so no plan contains debridement. The early case
labelled "perianal abscess" (K61.0) gets the incision-and-drainage plan; pain out of proportion,
spread to the scrotum and an SGLT2 inhibitor are not read by any engine. Symptom inference does rank
Fournier's first, but it is a secondary view. **Fix**: a Fournier's/perineal NSTI disease in PANE
(or perineal site + crepitus/necrosis/pain out of proportion + SIRS → `necrotising_fasciitis`), map
N49.3 to the NSTI protocol, a safety prompt "perineal infection spreading or pain out of proportion
+ SIRS → emergency exploration", and an SGLT2-inhibitor flag (WSES 2018; MHRA 2019).

### 3. Fistula-in-ano gets the anal-fissure plan (sphincterotomy)

`fistula-in-ano-simple-low`, `fistula-in-ano-complex-anterior-female` (critical ×4). `getProtocolByIcd`
returns `anal_fissure` for K60.3 because its prefix K60 covers fissures (K60.0–K60.2) and fistulas
(K60.3–K60.5). The documented plan is GTN/diltiazem, botulinum toxin and lateral internal
sphincterotomy, with no fistulotomy or seton — and for a woman with a complex anterior fistula and an
obstetric sphincter injury, a sphincterotomy is an incontinence risk. **Fix**: a fistula-in-ano
protocol on K60.3–K60.5 (simple → fistulotomy; complex → MRI, loose seton, sphincter-preserving
repair; Parks), and narrow `anal_fissure` to K60.0–K60.2 (`colorectalHerniaBreast.ts`).

### 4. Negated or incidental words trigger emergency operative plans

`infective-colitis-bloody-diarrhoea`, `uc-acute-severe-truelove-witts`, `ischaemic-colitis-left`,
`crohns-ileocaecal-abscess` (critical ×4, quality ×1). `computeClinicalPrompts` adds the full
"LAPAROSCOPIC APPENDICECTOMY — OPERATIVE PLAN" whenever the abdominal examination contains "guarding"
or "rebound", including "no guarding" (infective colitis, ASUC, ischaemic colitis) and localised
guarding from a Crohn's mass. "No free gas" on CT fires "Pneumoperitoneum → emergency laparotomy".
Triage has the same problem: "no rectal bleeding", "no vaginal bleeding" and "no weight loss" raise
"GI or other bleeding" (urgent → emergency) and "Possible malignancy". **Fix**: gate operative-plan
prompts on the confirmed working diagnosis or imaging, and add negation handling to `exam()`,
`hasRadResult()` (`artifacts/dashboard/src/lib/clinical-inference.ts`) and `RED_FLAGS`
(`lib/triage-engine/src/rules.ts`).

### 5. Anticoagulant errors in bleeding patients

`lgib-angiodysplasia-aspirin`, `lgib-diverticular-apixaban` (critical ×2). Angiodysplasia with
haemorrhage (K55.21) is under the K55 prefix of `ischaemic_colitis`, whose medications include a
therapeutic heparin infusion (for mesenteric venous thrombosis) and whose plan is NBM plus
piperacillin-tazobactam — for an outpatient with bleeding and IDA. For a diverticular bleed on
apixaban the only DOAC text is the generic "hold DOAC 48–72 h pre-op" bridging line; nothing says
to interrupt the DOAC at presentation (BSG 2019). **Fix**: exclude K55.2x from `ischaemic_colitis`;
add "interrupt anticoagulant at presentation; reversal only if life-threatening" to the GI-bleed
prompt when an anticoagulant is recorded; handle antiplatelets (clopidogrel is not in the list).

### 6. Toxic megacolon: the plan orders a colonoscopy

`uc-toxic-megacolon` (critical ×1). The UC protocol lists "Flexible sigmoidoscopy / colonoscopy +
biopsies" as an urgent investigation with no severity condition, so the documented plan for toxic
megacolon includes a colonoscopy (perforation risk). The emergency level, colectomy and megacolon red
flag are correct; PANE does not rank colitis at all (appendicitis, cholangitis, cholecystitis). **Fix**:
make the endoscopy line conditional (limited unprepared sigmoidoscopy only in ASUC; none in toxic
megacolon) and add a toxic-megacolon variant.

### 7. C. difficile does not exist in the engines

`uc-flare-cdiff`, `cdiff-fulminant-colitis` (critical ×5). No PANE disease, no protocol (A04.7), and
a toxin-positive result is not read. A UC patient with CDI gets no vancomycin/fidaxomicin; fulminant
CDI with shock and a 7 cm colon gets IV vancomycin from the septic-shock prompt (ineffective for CDI)
and no surgical consultation. **Fix**: a CDI disease/protocol (initial: fidaxomicin or oral
vancomycin; fulminant: oral/rectal vancomycin + IV metronidazole, early surgical review) and a rule
reading C. difficile results (IDSA/SHEA 2017/2021, WSES 2019, ECCO 2021).

### 8. Laboratory-only colorectal-cancer pathways are invisible (FIT, IDA)

`crc-fit-positive-abdominal-pain`, `crc-ida-no-gi-symptoms` (critical ×7). No engine reads a FIT
result: with FIT 42 µg Hb/g as the only red flag there is no colonoscopy, no referral, and PANE
ranks cholecystitis/GORD/PUD. Iron-deficiency anaemia (Hb 9.4, ferritin 5) without GI symptoms gets
no colonoscopy and no IDA flag (the cancer screen looks for the words "anaemia/pale" in symptom chips;
prompts only fire at Hb < 8). The OGD expectation passes only because GORD is in the PANE top 3.
Related, in `lib/triage-engine/src/cancer-screening.ts`: the change-in-bowel-habit test matches
"bowel habit change", which is not the chip text ("change in bowel habit"); it fires only when the
concatenated chip list happens to produce that string. There is no "age ≥ 50 with rectal bleeding"
or "≥ 40 weight loss + abdominal pain" rule, and the "≥ 40 rectal bleeding + CIBH" rule is labelled
NICE NG12 1.3.1 but is older (CG27-era) wording. **Fix**: FIT rule (≥ 10 µg Hb/g → suspected
cancer pathway, DG56), lab-driven IDA rule (bidirectional endoscopy + coeliac serology, BSG 2021),
and rewrite the lower-GI criteria to current NG12/DG56.

### 9. Crohn's abscess: steroids offered, no drainage, appendicectomy plan

`crohns-ileocaecal-abscess` (critical ×3, one shared with item 4). PANE ranks appendicitis first (0.71), so the Assessment
panel shows the appendicitis protocol and the prompts add the appendicectomy plan. The Crohn's plan
(from K50) offers prednisolone, budesonide and IV hydrocortisone unconditionally and has no
percutaneous-drainage step (ECCO 2020: drain, antibiotics, avoid steroids, delayed resection). **Fix**:
condition Crohn's steroids on "no abscess/sepsis", add the drainage step, surface biologics/thiopurines
as immunosuppression.

### 10. Anal cancer and atypical anal ulcers are treated as benign disease

`anal-cancer-red-flags`, `anal-fissure-atypical-lateral-hiv` (critical ×5). Anal squamous cell
carcinoma is not a PANE disease and C21 has no protocol: no EUA/biopsy of the lesion, no HIV test, no
chemoradiotherapy; the Assessment panel shows the haemorrhoid protocol. An atypical lateral indurated
ulcer in a man with HIV gets the fissure plan including lateral internal sphincterotomy and botulinum
toxin, with no biopsy (the protocol's "lateral fissure → Crohn's/STI" red flag does not change the
plan). **Fix**: add anal SCC to PANE and a C21 protocol (ASCRS 2018; NG12 anal mass/ulcer); an
"atypical fissure" dx-variant that replaces treatment with EUA, biopsy and infection screening
(ASCRS 2023).

### Further gaps (lower rank)

11. **Acute mesenteric ischaemia** (`ischaemic-colitis-right-af-ami`, critical ×2): not a PANE disease;
    right-sided colon ischaemia with AF and lactate 4.1 gets "CT with IV contrast", never CT
    angiography (ACG 2015, ESVS 2017). Same gap as the seed appendicitis vignette.
12. **CMV in steroid-refractory UC** (`uc-steroid-refractory-cmv`, critical ×2): no CMV testing and no
    ganciclovir; the plan only escalates immunosuppression.
13. **Perianal sepsis triage** (`perianal-abscess-hiv`, critical ×2; `pilonidal-abscess-acute`): there is
    no anorectal-sepsis triage rule. The HIV patient's abscess is a routine booking; the base abscess
    reaches "emergency" only through the negated "no weight loss" plus pain 8/10. HIV/biologics are not
    surfaced as immunosuppression.
14. **Infective colitis** (`infective-colitis-bloody-diarrhoea`, critical ×1 besides item 4): no stool culture/STEC
    testing; PANE has no infective colitis (top: appendicitis).
15. **Over-triage of every rectal bleed**: triage scores any "bleed" as urgent (emergency_now) and
    the GI-bleed prompt adds 2 large-bore cannulae, a Hartmann's bolus and a 2-unit cross-match —
    for a 24-year-old with outlet bleeding, a fissure, or an Oakland-8 minor bleed. No Oakland score on
    web (iOS has one).
16. **Hereditary risk and screening**: no Lynch rule (2-yearly colonoscopy, aspirin); the average-risk
    screening prompt starts at 50 (USPSTF/ACG 2021: 45) and offers FOBT every 2 years rather than FIT;
    no post-polypectomy surveillance intervals (BSG 2020).
17. **Factual error**: the UC protocol key point gives Truelove-Witts as "HR > 90, temp > 37.8 °C,
    WBC > 10.5, > 6 stools/day" — the criterion is Hb < 10.5 g/dL (and ESR > 30), not WBC.
18. **Protocol content**: `perianal_abscess` lists oral metronidazole without an indication (ASCRS
    2022: antibiotics only for cellulitis, systemic infection, immunosuppression); `haemorrhoids`
    has no thrombosed-external (< 72 h excision) branch; no post-polypectomy bleed, iron replacement,
    or DOAC-restart guidance.
19. **PANE input mapping for this cluster**: the "Rectal bleeding" and "Change in bowel habit" CC
    templates have no `CC_HINTS`; the web has no presentation template for perianal pain or lump (only
    diagnosis-named ones), so the vignettes use "Other / general surgical"; the SOCRATES site chips
    "Rectum", "Anal canal", "Posterior midline" are not mapped (`\brectal\b` misses "Rectum"); the
    character chip "Burning" always maps to `heartburn`, putting GORD into anorectal differentials;
    inguinal hernia and cholecystitis fill the top 3 when few features apply. A hard rectal mass is
    caught by the clinical prompt, not by PANE (top 3: hernia, GORD, cholecystitis).
20. **Symptom-inference data**: many anorectal `detailWeights` keys cannot fire — there are no
    `SYMPTOM_BRANCHES` for rectal pain, perianal pain, perianal lump or abscess, and
    "rectal bleeding.Bright red" does not match the option "Fresh red".
21. **Web examination sections**: the Anal/Rectal and Perineal examination sections have no legacy
    key and are not passed to `computeClinicalPrompts`; the rectal-mass prompt reads only the
    abdominal examination text. `crc-rectal-mass-fit-negative` records the DRE in the abdominal
    field, as many clinicians do; a DRE entered in the Anal/Rectal section would not trigger it.

## Passes that are incidental

Reported so they are not read as evidence of correct logic:

- `perianal-abscess-simple` level ≥ urgent: reached via the negated "no weight loss" (Possible
  malignancy) plus pain 8/10 (see item 13).
- `crc-ida-no-gi-symptoms` OGD: seeded from the GORD protocol because GORD is in the PANE top 3.
- `lgib-angiodysplasia-aspirin` colonoscopy and `haemorrhoids-*` colonic evaluation: from the
  haemorrhoid protocol's "colonoscopy if age > 40" line (correct content, generic trigger).
- Emergency levels for most bleeding and abdominal cases: every "bleed" is emergency_now on web, so
  "at least urgent" expectations pass regardless of severity.

## Harness limitations found

- **Family history**: the dashboard passes its Family History field to `computeClinicalPrompts`, but the
  vignette schema has no family-history input and `web-runner.ts` passes `[]`. Three critical/quality
  expectations in `crc-lynch-surveillance-overdue` and `crc-screening-african-caribbean-fhx` are
  therefore `unverified: ["web"]` (the "FHx colorectal cancer, age 35–49" prompt would probably add a
  colonoscopy in the app). Adding `inputs.familyHistory` to the schema and both runners would make
  them observable.
- **Score calculators**: web has no calculator for Oakland, Truelove-Witts, LRINEC or qSOFA, so no
  `scores.values` expectation could be graded on web; iOS qSOFA values are asserted (`platforms: ["ios"]`).
- **Schema year floor**: `guideline.year` has a minimum of 1980, so Truelove & Witts (1955) and Parks
  (1976) are cited inside the BSG 2019 and ASCRS 2022 section text rather than as their own entries.

## Guidelines cited (all `verified: false`)

BSG LGIB 2019 (Oakland, Gut 2019;68:776–89); ACG LGIB 2023 (Sengupta, Am J Gastroenterol
2023;118:208–31); Oakland score 2017 (Lancet Gastroenterol Hepatol 2017;2:635–43); ESGE polypectomy
2017; BSG IDA 2021; NICE NG12 (2015, lower GI updated 2023); NICE DG56 (2023); ACPGBI/BSG FIT 2022
(Monahan, Gut 2022;71:1939–62); BSG/ACPGBI/PHE surveillance 2020 (Rutter, Gut 2020;69:201–23);
BSG/ACPGBI/UKCGG hereditary CRC 2020; USPSTF 2021; ACG screening 2021; ECCO UC medical and surgical
2022; ECCO infections in IBD 2021; ECCO Crohn's surgical 2020; BSG IBD 2019; Oxford/Travis 1996; ASCRS
abscess/fistula 2022, fissure 2023, haemorrhoids 2024, pilonidal 2019, prolapse 2017, anal SCC 2018;
WSES/SIS-E skin and soft-tissue infection 2018; LRINEC 2004; MHRA SGLT2/Fournier's 2019; ACG colon
ischaemia 2015; ESVS mesenteric 2017; IDSA/SHEA CDI 2017 and 2021; WSES CDI 2019; IDSA infectious
diarrhoea 2017. Exact recommendation numbers are recorded in each vignette's `section` and need
checking against the source.

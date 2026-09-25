# Change log: `fix-web-differential` (web PANE differential, condition-neutral model 1.0.0)

This is part of the owner-authorised "fix all gaps" programme, dated 2026-09-25. Its area is the web differential: `lib/pane-engine` (vademecum and engine), the PANE feature mapper `artifacts/dashboard/src/lib/socrates-to-features.ts`, the secondary symptom-inference view (`artifacts/dashboard/src/lib/symptom-inference.ts`), and the clinval web-runner mirror. The gaps it addresses are SURGEON-DECISIONS **C6** (structural bias toward hepatobiliary/upper-GI) and **C-8** (unversioned, uncited PANE content). The findings come from clinval C6, the upper-gi, colorectal, general-medicine and soft-tissue mapper notes, and the per-category PANE top-3 misses.

The model is deterministic only. It makes no AI or network calls. Nothing here orders, prescribes or books anything: PANE ranks diagnoses, and the clinician confirms one.

- Every likelihood, prior tier and modifier below is an approximation of a published range, written from the guideline or study named in the module header. None of them has been checked against the source.
- `lastReviewed` stays `"unknown"`.
- Everything listed under "Needs sign-off" needs the surgeon's review.

## Results

These are from `pnpm --filter @workspace/scripts run clinval:web` over 397 vignettes and 3087 expectations.

| | Pass | Fail | Critical fail | Blocking | PANE dx/mnm top-3 | Symptom-inference |
|---|---|---|---|---|---|---|
| Old base `72e083a` | 1882 | 1113 | 546 | 0 | – | – |
| Base `64765f4` (after the screening fixes) | 1938 | 1057 | 533 | 0 | 134 / 353 | 28 / 35 |
| After | 2164 | 831 | 372 (0 blocking, 816 known gap) | **0** | **328 / 353** (0 critical fails) | 29 / 35 |

PANE top 3 by category (correct diagnosis in the top 3, base → after):

| Category | Base | After | Of |
|---|---|---|---|
| anorectal | 9 | 15 | 19 |
| breast-endocrine | 5 | 17 | 17 |
| colorectal | 14 | 23 | 25 |
| general-medicine | 4 | 55 | 57 |
| gi-emergency | 22 | 33 | 39 |
| hernia | 6 | 20 | 20 |
| hpb | 36 | 42 | 46 |
| other | 7 | 31 | 31 |
| soft-tissue | 5 | 17 | 19 |
| trauma-burns | 6 | 11 | 13 |
| upper-gi | 10 | 33 | 35 |
| urology | 5 | 14 | 15 |
| vascular | 5 | 17 | 17 |

- **Every category is at least as good as before.** `scripts/src/clinval/pane-neutrality.test.ts` holds these numbers as floors, so any future drop fails CI.
- **249 expectations went from fail to pass.**
  - 249 web `knownGap` flags were removed. Where a flag was shared with iOS, only `web` was dropped.
  - The hand-edited compact-format files are `appendicitis-elderly-atypical` and `cholangitis-tg18-grade3-reynolds`.
- **23 went from pass to fail. None was weakened or deleted:**
  - **Surgical PANE top-3 loss (1, quality):** `lgib-diverticular-apixaban/mnm-crc`. Colorectal cancer was rank 3. It is now rank 4 behind lower GI haemorrhage, upper GI haemorrhage and mesenteric ischaemia. It is still #2 in symptom inference.
  - **Seeded-investigation losses (8 critical, now flagged `knownGap: ["web"]`).** These passed before only because a *wrong* PANE top 3 (usually cholecystitis) seeded that protocol's tests. PANE now ranks the right diagnosis, but it has no management protocol, so nothing is seeded. Each flag has a note and a `proposedFix` naming the protocol it needs:
    - `acutemed-cap-high-severity-elderly/inv-blood-cultures`
    - `acutemed-cap-immunosuppressed/inv-cxr`
    - `acutemed-sepsis-afebrile-elderly-urinary/inv-blood-cultures`
    - `appendicitis-generalised-peritonitis-sepsis/inv-blood-cultures`
    - `food-bolus-complete-obstruction/inv-emergency-ogd`
    - `paed-febrile-infant-7wk-hernia-clinic/inv-blood-culture`
    - `paed-intussusception-lethargy-atypical/inv-abdominal-ultrasound`
    - `renal-colic-infected-obstructed/inv-cultures`
  - **Quality losses with the same mechanism (12):** the blood-cultures / USS / CXR / βhCG / MRI pelvis expectations that were previously seeded by cholecystitis, peptic ulcer, appendicitis or colorectal protocols. They are in `acutemed-cap-immunosuppressed`, `anal-cancer-red-flags`, `aortoenteric-fistula-herald-bleed`, `cholecystitis-mimic-rll-pneumonia`, `gyn-pid-tubo-ovarian-abscess-sepsis`, `paed-intussusception-infant-classic`, `periop-postop-pneumonia-news2-escalation`, `periop-preop-asa1-lap-chole`, `ppu-elderly-steroids-masked` and `pyelonephritis-adult-female`.
  - **Quality "must not" losses caused by correct PANE ranking plus protocol content outside this area (4):**
    - `breast-lump-under-30/inv-no-first-line-mammogram`: the phyllodes protocol seeds "USS + mammography".
    - `pe-perc-negative-low-risk/inv-no-ctpa`: the PE protocol seeds CTPA regardless of PERC/Wells.
    - `variceal-bleed-known-cirrhosis/mgmt-no-tranexamic-acid`: the UGIB protocol lists tranexamic acid.
    - `cellulitis-sepsis-elderly-diabetic/mgmt-no-oral-only`: the Plan tab now follows the confirmed diagnosis (below), whose protocol lists oral Eron I treatment.

## Engine behaviour changes (`lib/pane-engine`)

1. **Neutral treatment of unmodelled findings.** Before, a feature that a disease did not list scored a flat `DEFAULT_SENSITIVITY = 0.30` for that disease. So every disease with a long feature list was penalised for each finding outside its list, and short-listed specialties won by default. Now `featureLikelihood()` (`engine/likelihood.ts`) returns, in this order:
   1. the disease's own value;
   2. a derived value:
      - **umbrella features**, e.g. `abdominal_pain` = any site-specific pain; `fever` includes `postop_fever`; `upper_gi_bleeding`, `dysphagia`, `headache` and `rash` take the union of their sub-features;
      - **conjunctions**, e.g. `postop_fever` = fever × recent surgery; `vomiting_post_trauma`;
      - **course-based onset**: `acute_onset` / `chronic_course` from the disease's new `course` (acute, subacute, chronic, any);
      - **correlated defaults**: `raised_crp` ↔ `elevated_wbc` ↔ `fever`, `tachycardia` from fever, `abdominal_tenderness` from abdominal pain, `anorexia` for acute abdominal diseases;
   3. the finding's **background rate** (`Feature.baseRate`, default `DEFAULT_BASE_RATE = 0.05`). This is P(finding | a patient who does not have a disease that explains it).
   `bayes.ts` and `infoGain.ts` both use it. `DEFAULT_SENSITIVITY` stays as a deprecated alias.
2. **Frequency-tier priors** (`vademecum/priors.ts`) replace hand-set values that favoured the original surgical modules. The tiers are common 0.03, frequent 0.015, uncommon 0.007, rare 0.003 and very rare 0.001. The full before → after table is below.
3. **Sex modifiers are bounded likelihood ratios.** `sexRatio(id, M:F)` gives ×2r/(1+r) for men and ×2/(1+r) for women, so the prior averaged over both sexes is unchanged. The open-ended "boost the expected sex" multipliers are gone.
4. **Applicability** (`DiseaseNode.applicability`: sex, ageMin, ageMax, pregnancy `required`). The prior is 0 when the patient is known to be outside it. An unknown age, sex or pregnancy status never excludes.
   - Gynaecological nodes are female-only. Testicular nodes, BPH and gynaecomastia are male-only.
   - Ectopic pregnancy and the obstetric nodes are pregnancy-required. They are excluded for men and outside ages 10–55. They are multiplied by `PREGNANCY_POSSIBLE_MULTIPLIER` (5) when "pregnancy possible" is ticked.
   - Paediatric age limits: pyloric stenosis ≤ 0.5 years (age 0 in the record means any infant), intussusception ≤ 16 and malrotation ≤ 18.
   - `topDiagnoses` drops zero-probability diseases.
5. **Adult-predominant diseases ×0.05 under 16.** These are gallstone disease, diverticular disease, carcinomas and vascular disease (APLS 2016 and paediatric surgical epidemiology).
6. `applyModifiers(diseases, age, sex, modifiers = PRIOR_MODIFIERS, context = {})` takes a `PatientContext {pregnancyPossible}`. `SURGICAL_OPD_MODIFIERS` is now a deprecated alias of `PRIOR_MODIFIERS`.
7. `PANE_MODEL_VERSION = '1.0.0'` in `constants.ts` is the registry version stamp. Convergence (0.85) and the question cap (8) are unchanged.

### Prior modifiers: before → after

| Disease | Before | After | Source (module header / comment) |
|---|---|---|---|
| inguinal_hernia | ×5 male, ×0.3 female | ×1.8 male, ×0.2 female (M:F 9:1 as an LR). The ×1.8 at 50+ is kept. | Primatesta & Goldacre, Int J Epidemiol 1996; HerniaSurge 2018 |
| gynaecological nodes (10) | ×0.001 male, ×2.5 female | female-only applicability, no female boost | – |
| breast nodes (9) | ×0.05 male, ×1.8 female | sex LR for M:F 0.01 (×0.02 / ×1.98) | ACS Breast Cancer Facts & Figures 2023 |
| gynaecomastia | ×5 male, ×0.01 female | male-only applicability | – |
| cholecystitis | ×2 female | sex LR for M:F 0.5 (×0.67 / ×1.33); the 30–70 band is kept; biliary_colic gets the same | NICE CG188 background |
| appendicitis | ×1.4 male | sex LR 1.4 (×1.17 / ×0.83); ×0.2 at ≤ 3 years added | Addiss et al., Am J Epidemiol 1990 |
| GORD | ×1.3 male | removed (sex ratio ≈ 1) | – |
| pancreatitis | ×1.2 male | removed | – |
| New | – | femoral LR 0.25; obturator LR 0.15, ×3 at 70+; incarcerated hernia ×2 at ≤ 1 year, ×1.8 at 60+; UGI/pancreatic cancer ×0.1 < 40, ×3 at 55+; ACS LR 2 plus age bands; AF, HF and dissection age bands; AAA LR 4, ×0.1 ≤ 54, ×3 at 65+; mesenteric and limb ischaemia and PAD age bands; stroke/TIA ×0.2 ≤ 44, ×2.5 at 65+; meningitis, pneumonia, sepsis and HHS age bands; UTI and pyelonephritis LR 0.25; renal colic LR 2; retention LR 13 plus age; bladder carcinoma LR 3; BPH age bands; torsion 12–18 and 35+; thyroid LRs; intussusception ×3 ≤ 2; malrotation ×5 ≤ 1; pyloric LR 4; HSP age bands | ESC 2023 ACS, ESC 2024 AF, ESC 2021 HF, NICE NG156, NICE NG128, BTS CAP, JBDS-IP HHS 2022, EAU 2024 (infections, urolithiasis, paediatric), BTA 2014 / ATA 2015, NICE CKS / BSPGHAN |

## Clinical content changes (`lib/pane-engine/src/vademecum`)

### Priors: before → after (existing nodes, tiered)

Every existing node now has a `course` and cited features (the guideline is in each module header).

Largest changes:
- cholecystitis 0.15 → 0.015
- GORD 0.12 → 0.03
- peptic ulcer 0.10 → 0.015
- appendicitis 0.08 → 0.015
- inguinal hernia 0.07 → 0.015
- diverticulitis 0.06 → 0.015
- pancreatitis 0.05 → 0.007
- choledocholithiasis 0.05 → 0.007
- BPH 0.05 → 0.015

Full table (base `64765f4` → 1.0.0, tier in brackets):

| Node | Module | Before | After |
|---|---|---|---|
| achalasia | upperGI | 0.01 | 0.001 (veryRare) |
| acute_hepatitis | hepatobiliary | 0.02 | 0.007 (uncommon) |
| adhesion_obstruction | postOpWounds | 0.03 | 0.007 (uncommon) |
| adrenal_incidentaloma | endocrine | 0.01 | 0.003 (rare) |
| anal_fissure | colorectal | 0.03 | 0.015 (frequent) |
| anastomotic_leak | postOpWounds | 0.02 | 0.003 (rare) |
| aortic_aneurysm (relabelled "Abdominal Aortic Aneurysm (Symptomatic / Ruptured)", ICD I71.9 kept) | vascular | 0.01 | 0.003 (rare) |
| appendicitis | generalSurgery | 0.08 | 0.015 (frequent) |
| appendix_mass | colorectal | 0.02 | 0.003 (rare) |
| arterial_ulcer | vascular | 0.02 | 0.003 (rare) |
| barretts_oesophagus | upperGI | 0.02 | 0.007 (uncommon) |
| bartholin_abscess | gynaecology | 0.01 | 0.007 (uncommon) |
| bcc | skinSoftTissue | 0.03 | 0.007 (uncommon) |
| biliary_stricture | hepatobiliary | 0.01 | 0.003 (rare) |
| bladder_carcinoma | urology | 0.01 | 0.003 (rare) |
| blunt_abdominal_trauma | trauma | 0.03 | 0.003 (rare) |
| bowel_obstruction | generalSurgery | 0.04 | 0.007 (uncommon) |
| bph | urology | 0.05 | 0.015 (frequent) |
| branchial_cyst | endocrine | 0.005 | 0.001 (veryRare) |
| breast_abscess | breast | 0.02 | 0.007 (uncommon) |
| cellulitis | skinSoftTissue | 0.04 | 0.015 (frequent) |
| cervical_carcinoma | gynaecology | 0.01 | 0.003 (rare) |
| cholangiocarcinoma | hepatobiliary | 0.01 | 0.003 (rare) |
| cholangitis | generalSurgery | 0.04 | 0.007 (uncommon) |
| cholecystitis | generalSurgery | 0.15 | 0.015 (frequent) |
| choledocholithiasis | hepatobiliary | 0.05 | 0.007 (uncommon) |
| chronic_venous_insufficiency | vascular | 0.03 | 0.007 (uncommon) |
| colorectal_cancer | generalSurgery | 0.03 | 0.007 (uncommon) |
| crohns_disease | colorectal | 0.02 | 0.007 (uncommon) |
| dcis | breast | 0.01 | 0.003 (rare) |
| deep_vein_thrombosis | vascular | 0.03 | 0.007 (uncommon) |
| diverticulitis | generalSurgery | 0.06 | 0.015 (frequent) |
| duct_ectasia | breast | 0.02 | 0.007 (uncommon) |
| dumping_syndrome | upperGI | 0.01 | 0.001 (veryRare) |
| ectopic_pregnancy | gynaecology | 0.02 | 0.007 (uncommon) |
| electrical_burn | trauma | 0.01 | 0.001 (veryRare) |
| endometriosis | gynaecology | 0.02 | 0.007 (uncommon) |
| epididymo_orchitis | urology | 0.02 | 0.007 (uncommon) |
| epigastric_hernia | hernia | 0.02 | 0.003 (rare) |
| fat_necrosis_breast | breast | 0.01 | 0.003 (rare) |
| femoral_hernia | hernia | 0.02 | 0.007 (uncommon) |
| fibroadenoma | breast | 0.04 | 0.015 (frequent) |
| fibrocystic_change | breast | 0.05 | 0.015 (frequent) |
| gallbladder_carcinoma | hepatobiliary | 0.005 | 0.001 (veryRare) |
| gastric_carcinoma | upperGI | 0.01 | 0.003 (rare) |
| gastric_outlet_obstruction | upperGI | 0.01 | 0.003 (rare) |
| gastritis | upperGI | 0.05 | 0.03 (common) |
| gord | generalSurgery | 0.12 | 0.03 (common) |
| gynaecomastia | breast | 0.02 | 0.007 (uncommon) |
| haematuria_investigation | urology | 0.02 | 0.007 (uncommon) |
| haemorrhoids | colorectal | 0.06 | 0.03 (common) |
| haemothorax | trauma | 0.03 | 0.003 (rare) |
| hashimoto_thyroiditis | endocrine | 0.02 | 0.007 (uncommon) |
| hepatocellular_carcinoma | hepatobiliary | 0.01 | 0.003 (rare) |
| hiatus_hernia | upperGI | 0.05 | 0.015 (frequent) |
| hydrocele | urology | 0.02 | 0.007 (uncommon) |
| hyperthyroidism | endocrine | 0.02 | 0.007 (uncommon) |
| ileus_postop | postOpWounds | 0.04 | 0.007 (uncommon) |
| incisional_hernia | hernia | 0.03 | 0.007 (uncommon) |
| incisional_hernia_early | postOpWounds | 0.02 | 0.003 (rare) |
| inguinal_hernia | generalSurgery | 0.07 | 0.015 (frequent) |
| internal_hernia | hernia | 0.01 | 0.001 (veryRare) |
| invasive_ductal_carcinoma | breast | 0.02 | 0.007 (uncommon) |
| ischaemic_colitis | colorectal | 0.02 | 0.003 (rare) |
| lipoma | skinSoftTissue | 0.06 | 0.03 (common) |
| liver_abscess (enriched: amoebic features) | hepatobiliary | 0.02 | 0.003 (rare) |
| lymphoedema | vascular | 0.01 | 0.003 (rare) |
| mallory_weiss | upperGI | 0.02 | 0.003 (rare) |
| mastitis | breast | 0.03 | 0.007 (uncommon) |
| melanoma | skinSoftTissue | 0.01 | 0.003 (rare) |
| neck_lymphadenopathy | endocrine | 0.03 | 0.007 (uncommon) |
| necrotising_fasciitis | skinSoftTissue | 0.003 | 0.001 (veryRare) |
| obturator_hernia | hernia | 0.005 | 0.001 (veryRare) |
| oesophageal_carcinoma | upperGI | 0.01 | 0.003 (rare) |
| oesophageal_perforation | upperGI | 0.003 | 0.001 (veryRare) |
| oesophageal_stricture | upperGI | 0.02 | 0.003 (rare) |
| ovarian_carcinoma | gynaecology | 0.01 | 0.003 (rare) |
| ovarian_cyst | gynaecology | 0.04 | 0.015 (frequent) |
| ovarian_torsion | gynaecology | 0.02 | 0.003 (rare) |
| pancreatic_carcinoma | hepatobiliary | 0.01 | 0.003 (rare) |
| pancreatitis | generalSurgery | 0.05 | 0.007 (uncommon) |
| parastomal_hernia | hernia | 0.01 | 0.003 (rare) |
| parathyroid_adenoma | endocrine | 0.005 | 0.001 (veryRare) |
| pelvic_inflammatory_disease (relabelled to include tubo-ovarian abscess) | gynaecology | 0.03 | 0.007 (uncommon) |
| penetrating_abdominal_trauma | trauma | 0.02 | 0.003 (rare) |
| peptic_ulcer | generalSurgery | 0.10 | 0.015 (frequent) |
| perianal_abscess | colorectal | 0.03 | 0.015 (frequent) |
| peripheral_arterial_disease | vascular | 0.03 | 0.007 (uncommon) |
| phyllodes_tumour | breast | 0.005 | 0.001 (veryRare) |
| pilonidal_disease | colorectal | 0.02 | 0.007 (uncommon) |
| pneumothorax_traumatic | trauma | 0.04 | 0.003 (rare) |
| postop_haematoma | postOpWounds | 0.03 | 0.007 (uncommon) |
| postop_seroma | postOpWounds | 0.05 | 0.007 (uncommon) |
| primary_hyperparathyroidism | endocrine | 0.01 | 0.003 (rare) |
| primary_sclerosing_cholangitis | hepatobiliary | 0.01 | 0.001 (veryRare) |
| pulmonary_embolism | vascular | 0.02 | 0.007 (uncommon) |
| raynauds_phenomenon | vascular | 0.01 | 0.003 (rare) |
| rectal_carcinoma | colorectal | 0.02 | 0.003 (rare) |
| rectal_prolapse | colorectal | 0.01 | 0.003 (rare) |
| renal_colic | urology | 0.04 | 0.015 (frequent) |
| rib_fractures | trauma | 0.05 | 0.007 (uncommon) |
| salivary_gland_mass | endocrine | 0.01 | 0.003 (rare) |
| sarcoma_soft_tissue | skinSoftTissue | 0.003 | 0.001 (veryRare) |
| scc_skin | skinSoftTissue | 0.02 | 0.007 (uncommon) |
| sebaceous_cyst | skinSoftTissue | 0.06 | 0.03 (common) |
| skin_abscess | skinSoftTissue | 0.04 | 0.015 (frequent) |
| sphincter_oddi_dysfunction | hepatobiliary | 0.01 | 0.001 (veryRare) |
| spigelian_hernia | hernia | 0.01 | 0.001 (veryRare) |
| splenic_laceration | trauma | 0.03 | 0.003 (rare) |
| sportsmans_hernia | hernia | 0.01 | 0.003 (rare) |
| surgical_site_infection | postOpWounds | 0.04 | 0.007 (uncommon) |
| testicular_cancer | urology | 0.004 | 0.001 (veryRare) |
| testicular_torsion | urology | 0.01 | 0.003 (rare) |
| thermal_burn_major (**ICD T31.30 → T31.20**, see sign-off) | trauma | 0.02 | 0.003 (rare) |
| thermal_burn_minor | trauma | 0.03 | 0.007 (uncommon) |
| thyroid_carcinoma | endocrine | 0.01 | 0.003 (rare) |
| thyroid_nodule_benign | endocrine | 0.03 | 0.015 (frequent) |
| traumatic_brain_injury | trauma | 0.04 | 0.007 (uncommon) |
| ulcerative_colitis | colorectal | 0.02 | 0.007 (uncommon) |
| umbilical_hernia | hernia | 0.03 | 0.015 (frequent) |
| upper_gi_bleed | upperGI | 0.03 | 0.007 (uncommon) |
| urinary_retention | urology | 0.03 | 0.007 (uncommon) |
| uterine_carcinoma | gynaecology | 0.01 | 0.003 (rare) |
| uterine_fibroids | gynaecology | 0.03 | 0.015 (frequent) |
| uti | urology | 0.05 | 0.03 (common) |
| varicose_veins | vascular | 0.05 | 0.015 (frequent) |
| venous_ulcer | vascular | 0.02 | 0.007 (uncommon) |
| wound_dehiscence | postOpWounds | 0.01 | 0.003 (rare) |

**Caribbean adjustment.** The diabetes-related nodes (DKA, HHS, hypoglycaemia, diabetic foot infection) are one tier higher than UK incidence alone would place them. The basis is IDF Diabetes Atlas, 10th edition, 2021: adult diabetes prevalence in the Caribbean is about 12–13 %.

**Recent surgery added as a risk factor:** `recent_surgery` is now listed on pulmonary embolism (0.20), DVT (0.20), urinary retention (0.15) and AKI (0.15). The sources are NICE NG89 (VTE), EAU non-neurogenic male LUTS 2024 (post-operative retention) and NICE NG148 (AKI).

### New disease nodes (58)

Each new node has an ICD-10 code, a tier prior, a `course`, cited features and applicability where relevant. The guideline for each is in its module header.

| Node | ICD-10 | Module | Prior | Guideline (module header) |
|---|---|---|---|---|
| acs | I21.9 | cardiovascular | frequent | ESC ACS 2023; Panju et al. JAMA 1998 (LRs) |
| aortic_dissection | I71.00 | cardiovascular | rare | ESC 2014 aortic diseases; Klompas JAMA 2002; IRAD (Hagan JAMA 2000) |
| acute_heart_failure | I50.9 | cardiovascular | uncommon | ESC HF 2021; Wang et al. JAMA 2005 |
| atrial_fibrillation | I48.91 | cardiovascular | frequent | ESC AF 2024 |
| cardiac_syncope | I49.9 | cardiovascular | uncommon | ESC syncope 2018 |
| hypertensive_emergency | I16.1 | cardiovascular | rare | ESC/ESH 2018, ESH 2023; ESC Council on Hypertension 2019 |
| pneumonia | J18.9 | respiratory | frequent | BTS CAP 2009 (adults) / 2011 (children), NICE NG138; Metlay et al. JAMA 1997 |
| postop_pneumonia | J95.89 | respiratory | rare | NICE NG139 (2019) hospital-acquired pneumonia |
| asthma_exacerbation | J45.901 | respiratory | frequent | BTS/SIGN 158 (2019); GINA 2024 |
| copd_exacerbation (ageMin 35) | J44.1 | respiratory | frequent | GOLD 2025, NICE NG115 |
| sepsis | A41.9 | acuteMedicine | uncommon | NICE NG51, Sepsis-3, SSC 2021 |
| anaphylaxis | T78.2XXA | acuteMedicine | rare | Resuscitation Council UK 2021 |
| gastroenteritis | A09 | acuteMedicine | common | NICE CKS gastroenteritis (2023); IDSA 2017 infectious diarrhoea |
| cdiff_colitis | A04.72 | acuteMedicine | rare | IDSA/SHEA 2021; ESCMID 2021 |
| aki | N17.9 | acuteMedicine | uncommon | KDIGO 2012, NICE NG148 |
| hyperkalaemia | E87.5 | acuteMedicine | rare | UK Kidney Association 2020 |
| hypercalcaemia | E83.52 | acuteMedicine | rare | Society for Endocrinology emergency guidance 2016 |
| hyponatraemia | E87.1 | acuteMedicine | rare | European hyponatraemia guideline (Spasovski et al. 2014) |
| dka | E10.10 | metabolic | uncommon | JBDS-IP DKA 2023; ADA hyperglycaemic crises consensus 2024 |
| hhs | E11.00 | metabolic | uncommon | JBDS-IP HHS 2022 |
| hypoglycaemia | E16.2 | metabolic | uncommon | JBDS-IP hypoglycaemia 2022 |
| stroke | I63.9 | neurology | uncommon | NICE NG128; Goldstein & Simel JAMA 2005 |
| tia | G45.9 | neurology | uncommon | NICE NG128 |
| sah | I60.9 | neurology | rare | NICE NG228; Perry JAMA 2013 |
| meningitis | G00.9 | neurology | rare | NICE NG240; van de Beek NEJM 2004 |
| seizure | R56.9 | neurology | uncommon | NICE NG217 |
| cauda_equina | G83.4 | neurology | rare | GIRFT CES pathway 2023; Deyo et al. JAMA 1992 |
| mscc | G95.20 | neurology | rare | NICE NG234 (2023) |
| pre_eclampsia (pregnancy) | O14.90 | obstetrics | uncommon | NICE NG133; ISSHP 2021 |
| placental_abruption (pregnancy) | O45.90 | obstetrics | rare | RCOG GTG 63 |
| hyperemesis_gravidarum (pregnancy) | O21.1 | obstetrics | uncommon | RCOG GTG 69 |
| intussusception (≤ 16) | K56.1 | paediatrics | uncommon | APLS 6th ed.; BSPGHAN |
| pyloric_stenosis (≤ 0.5) | Q40.0 | paediatrics | uncommon | APLS; BAPS |
| malrotation_volvulus (≤ 18) | Q43.3 | paediatrics | rare | APLS; BAPS |
| hsp_iga_vasculitis | D69.0 | paediatrics | rare | EULAR/PRINTO/PRES 2010; SHARE 2019 |
| biliary_colic | K80.20 | hepatobiliary | frequent | NICE CG188 (2014) |
| lower_gi_bleed | K92.1 | colorectal | uncommon | BSG 2019 acute LGIB (Oakland et al., Gut 2019) |
| anal_cancer | C21.0 | colorectal | rare | ASCRS anal cancer 2018 |
| fournier_gangrene | N49.3 | colorectal | veryRare | WSES/SIS-E 2018 soft-tissue infections |
| sigmoid_volvulus | K56.2 | colorectal | rare | ASCRS 2021 volvulus |
| toxic_megacolon | K59.31 | colorectal | veryRare | BSG IBD 2019 / ECCO |
| incarcerated_hernia | K46.0 | hernia | uncommon | WSES 2017 complicated hernia |
| mesenteric_ischaemia | K55.0 | vascular | rare | ESVS 2017; WSES 2022 |
| acute_limb_ischaemia | I74.3 | vascular | rare | ESVS ALI 2020 |
| aortoenteric_fistula (gate: aortic graft) | K63.2 | vascular | veryRare | ESVS vascular graft infection 2020 |
| femoral_artery_aneurysm | I72.4 | vascular | veryRare | ESVS 2020 / 2024 |
| superficial_thrombophlebitis | I80.00 | vascular | uncommon | NICE CKS 2022; ESVS 2021 venous thrombosis |
| variceal_bleed | I85.11 | upperGI | rare | Baveno VII (2022); ESGE 2021 / NICE CG141 UGIB |
| perforated_peptic_ulcer | K27.5 | upperGI | rare | WSES 2020 perforated ulcer |
| food_bolus | T18.128A | upperGI | rare | ESGE 2016 foreign body |
| diabetic_foot_infection | E11.628 | skinSoftTissue | uncommon | IWGDF/IDSA 2023, NICE NG19 |
| charcot_foot | M14.671 | skinSoftTissue | veryRare | IWGDF 2023 Charcot |
| inguinal_lymphadenopathy | R59.0 | skinSoftTissue | uncommon | NICE NG12 (unexplained lymphadenopathy) |
| anaplastic_thyroid | C73 | endocrine | veryRare | ATA 2021 anaplastic thyroid cancer |
| phaeochromocytoma | D35.00 | endocrine | veryRare | Endocrine Society 2014 |
| pyelonephritis | N10 | urology | uncommon | EAU Urological Infections 2024; NICE NG111; Bent et al. JAMA 2002 |
| infected_obstructed_kidney | N13.6 | urology | rare | EAU Urolithiasis 2024 |
| postop_collection | K65.1 | postOpWounds | rare | WSES 2017 intra-abdominal infections (Sartelli et al.) |

The model now has 187 diseases plus `_other_`, and 426 features. Every feature carries a `baseRate`.

## Feature mapper (`artifacts/dashboard/src/lib/socrates-to-features.ts`)

**Before:** about 200 lines. It read only the CC template name and the SOCRATES answer strings.
- "chest" mapped to `chest_pain_oesophageal`, and "pe " mapped to `dyspnoea_pe`. These keys did not match the chest-pain features of the PE and cardiac nodes: this was the chest-pain key mismatch.
- "Burning" always meant heartburn, "after meals" meant a fatty-food trigger, "Neck" meant a neck lump and "Groin" a groin swelling.

**After:** `extractFeaturesFromSocrates(cc, answers, context?)`, with `paneContextFromConsultation(snapshot)` building the context from the whole consultation record. Matching is negation-aware and whole-word throughout (`testAffirmed` from `lib/triage-engine/src/negation.ts`). It reads:

- **Chips, branch details and SOCRATES.**
  - Rules by site, radiation, character, onset, timing, triggers and relief. Antacid relief only counts if it actually helped.
  - Context-dependent rules ("Neck" only means a lump in a lump context; "Groin" only in a groin context; wound rules only in a wound context).
- **Bleeding:**
  - haematemesis and coffee-ground vomit
  - melaena
  - fresh PR blood, with rectal-outlet vs mixed bleeding
  - haematuria
  - PV bleeding
- **Other symptoms:**
  - dysphagia: solids vs liquids, progressive, food bolus
  - vomiting type: bilious, faeculent, projectile, vomiting before pain (Boerhaave)
  - neurological: focal weakness, speech, facial droop, thunderclap headache, neck stiffness, photophobia, seizure, saddle anaesthesia, sphincter change
  - headache
  - urinary: dysuria, frequency, loin pain, retention
  - pregnancy: LMP, amenorrhoea, positive test, gestation
  - fever and rigors
- **History items:** gated by per-item rules, e.g. aortic graft, stoma, UC/Crohn's, diabetes, anticoagulants, antibiotics (C. difficile), immunosuppression, trauma mechanism.
- **Vitals:**
  - Adults: fever ≥ 38.0 °C, hypothermia < 36.0 °C, HR > 100 / < 50 (> 120 = haemodynamic instability), SBP < 90, RR ≥ 22, SpO₂ < 94 %, BP ≥ 140/90 raised and ≥ 180/120 severe, AVPU C = confusion (NICE NG51 / NEWS2 bands).
  - Children under 12: APLS 6th edition age bands. Tachycardia is > 160 / 150 / 140 / 120 bpm (< 1, < 2, < 5, older). SBP < 70 + 2 × age. RR ≥ 50 / 40 / 30.
  - In pregnancy, BP ≥ 160/110 is severe (NICE NG133).
- **Labs**, by analyte name:
  - K⁺ ≥ 6.0 mmol/L
  - Ca > 2.6 mmol/L
  - Na < 130 mmol/L
  - glucose (JBDS-IP: ≥ 11.1 raised, ≥ 30 HHS range, < 4.0 hypoglycaemia; also from the CBG vital)
  - ketones ≥ 3 mmol/L
  - HCO₃ < 15 mmol/L
  - lactate ≥ 2 mmol/L
  - troponin > 14 ng/L (or 0.04–1 µg/L)
  - creatinine > 130 µmol/L
  - WBC > 11 × 10⁹/L
  - Hb < 110 g/L
  - platelets < 150 × 10⁹/L
  - amylase > 300 or lipase > 180 U/L
  - CRP > 20 mg/L
  - ALT/AST > 100 U/L
  - bilirubin > 40 µmol/L
  - FIT ≥ 10 µg Hb/g (NICE DG56)
  - hCG ≥ 25 IU/L
- **Result text:** CT, US and X-ray findings, e.g. free air, target sign, whirlpool sign, pyloric thickening, CBD dilatation, collection, hydronephrosis.
- **Gates.** Four findings are set *absent* only when a full record is supplied and shows no sign of them: `trauma_mechanism`, `recent_surgery`, `aortic_graft` and `stoma`. Every other finding is only ever set *present*.
- **Post-processing:** `progressive_course` is kept only together with `chronic_course`, and `acute_onset` is dropped when `chronic_course` is set.

`ChiefComplaintStrip.tsx` and `HpiTab.tsx` pass the context and `{ pregnancyPossible }` (HPI Q&A included).

## Other engine changes

- **Clinval web-runner mirror** (`scripts/src/clinval/web-runner.ts`):
  - It mirrors the new PANE call (`consultationSnapshot(v)`).
  - Its PlanTab mirror now follows the **confirmed diagnosis**: `paneDiseaseId`, else ICD. This matches `PlanTab`'s `confirmedPlanSource`. Before, it used the PANE top, which the dashboard does not do. That mismatch had been masking about 16 expectations. The base plus this mirror fix alone gives 1968 pass and 0 blocking.
- **Symptom inference** (`symptom-inference.ts`, the secondary view):
  - `DETAIL_KEY_ALIASES` and `detailKeysFor()` map SmartSymptomPicker options to the `detailWeights` keys written for them. Many weights never fired before; for example, "Crushing / pressure", "Left arm" and "Jaw" never reached ACS.
  - Childhood entries (the `paediatric` flag or a Paediatric category) are multiplied by 0.05 from age 16. HSP, epiglottitis, Meckel's and scarlet fever, which also occur in adults, are multiplied by 0.3 instead. Before, an adult with wheeze got "Bronchiolitis (RSV)" first.
  - A new `anaphylaxis` entry (Resuscitation Council UK 2021).
  - Clinval general-medicine symptom-inference top-1 went from 34 to 37 of 74, with no regressions.

## Tests

- `lib/pane-engine/src/__tests__/model-integrity.test.ts` checks that:
  - every feature is registered;
  - every probability is in range;
  - every modifier id exists;
  - every prior is a tier;
  - every node has a `course`;
  - every sex LR is ≤ 2.
- `lib/pane-engine/src/__tests__/neutrality.test.ts`:
  - 26 balanced synthetic cases across 13 specialty groups, each with the expected diagnosis in the top 3;
  - no specialty takes more than 4 top-1 answers, and at least 10 specialties appear;
  - with no findings, the priors put at least 5 specialties in the top 10;
  - checks on base-rate neutrality, the inguinal LR, and pregnancy and age applicability.
- `scripts/src/clinval/pane-neutrality.test.ts` holds the per-category PANE top-3 floors from the table above.
- `artifacts/dashboard/src/lib/__tests__/socrates-to-features.test.ts` has 19 mapper tests.
- `artifacts/dashboard/src/lib/__tests__/symptom-inference-detail-keys.test.ts` covers the aliases, the age gate and anaphylaxis.

**Registry:** `pane-engine-disease-model` is versioned 1.0.0, with version stamp `PANE_MODEL_VERSION`, a changelog entry and the guidelines listed. `lastReviewed` stays `"unknown"`. `docs/CLINICAL-CONTENT-INVENTORY.md` and `docs/clinical-validation/ENGINE-MAP.md` are updated.

## Hooks needed in other areas (not changed here)

1. **Management protocols keyed by the new PANE ids** (`lib/pane-engine/src/management/**`). These would clear the 8 flagged critical expectations and 12 quality ones:
   - `pneumonia` and `sepsis` (blood cultures, CXR)
   - `intussusception` (USS)
   - `food_bolus` (emergency OGD)
   - `infected_obstructed_kidney` (cultures, decompression)
   - `pyelonephritis`
   - `meningitis`
   - `acs`
   - `aortic_dissection`
   - `dka` / `hhs`
   - `stroke`
   - `lower_gi_bleed`
   - `variceal_bleed`
   - `perforated_peptic_ulcer`
   - `incarcerated_hernia`
   - `mesenteric_ischaemia`
   - `acute_limb_ischaemia`
2. **Protocol content surfaced by correct ranking:**
   - The PE protocol seeds CTPA regardless of PERC/Wells.
   - The phyllodes protocol seeds mammography under 30.
   - The UGIB protocol lists tranexamic acid, which HALT-IT argues against.
   - The IDC protocol lists tamoxifen without a pregnancy exclusion.
   - The renal-colic protocol lists diclofenac without a pregnancy exclusion.
   - `seedInvestigationsFromPane` seeds stat tests from all top-3 protocols, including diagnoses that are only being considered.
3. `usePane.ts`, `AmbientConsultation`, `SuggestedInvestigationsPanel` and `DictionaryTab` call `applyModifiers` without the pregnancy context and without the consultation context. They still work, but they don't use the new inputs.
4. iOS parity: this is web only. The iOS differential is a separate engine.
5. `artifacts/dashboard/src/lib/symptom-inference.ts` is not in `clinical-content/registry.json` (the lint only warns). It should get its own entry.

## Needs sign-off

1. **Every likelihood and sensitivity** in `vademecum/specialties/*.ts`. These are approximations of published ranges and have not been checked against the sources.
2. **Prior tiers** (0.03 / 0.015 / 0.007 / 0.003 / 0.001) and the tier given to each disease (table above).
3. **Background rates.** The default is 0.05 for an unmodelled finding, plus the per-feature `baseRate` values and the derived/correlated defaults in `engine/likelihood.ts`.
4. **`PREGNANCY_POSSIBLE_MULTIPLIER = 5`** for pregnancy-only nodes when "pregnancy possible" is ticked. Pregnancy-only nodes are excluded for male patients and outside ages 10–55.
5. **Gate inference.** A full record with no mention of trauma, an operation in the last 30 days, an aortic graft or a stoma is read as their *absence*. This is the only absence inference in the mapper.
6. **Lab thresholds** in the mapper (list above), and the **paediatric vital thresholds** (APLS).
7. **Adult-predominant ×0.05 under 16** (PANE) and **childhood entries ×0.05 / ×0.3 from 16** (symptom inference).
8. **Caribbean diabetes tier adjustment** (IDF Atlas 2021).
9. **Sex likelihood ratios**, e.g. inguinal hernia M:F 9 → ×1.8 men / ×0.2 women, down from ×5 / ×0.3. There is no longer any boost for women on gynaecological or breast nodes.
10. **`thermal_burn_major` ICD-10 T31.30 → T31.20.** This is the TBSA 20–29 % band, the typical case in the vignettes. A burn of 30 % or more should code as T31.3x. The surgeon may prefer an unspecified TBSA code.
11. **Colorectal cancer** in anticoagulated diverticular LGIB is now rank 4, below lower GI haemorrhage, upper GI haemorrhage and mesenteric ischaemia (`lgib-diverticular-apixaban/mnm-crc`). Should CRC be forced into the top 3 for LGIB at 60+? The conservative choice was not to add a boost that is not in a guideline.

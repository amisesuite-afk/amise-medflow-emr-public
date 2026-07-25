-- Clinical scores migration
-- Adds structured scoring storage to encounters and extracted lab values to encounters.
-- Scores computed: Tokyo Guidelines (cholangitis + cholecystitis), Ranson's, BISAP,
-- ASA classification, POSSUM, P-POSSUM, Child-Pugh, MELD, NEWS2.
-- All inputs + computed results stored per encounter so scores are auditable and reproducible.

-- ── 1. encounters.clinical_scores — per-encounter scoring store ───────────────
ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS clinical_scores jsonb DEFAULT '{}';

-- ── 2. encounters.extracted_labs — structured lab values from referral/results ─
-- Keyed by LOINC-adjacent short names. Numeric values + units stored separately
-- so threshold comparisons can be done without string parsing.
-- Example: { "wbc": 14.2, "wbc_unit": "10⁹/L", "bilirubin_total_umol": 62, ... }
ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS extracted_labs jsonb DEFAULT '{}';

-- ── 3. Grants ─────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.encounters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.encounters TO service_role;

-- ── 4. Index for score lookups (optional but useful for quality/audit queries) ─
CREATE INDEX IF NOT EXISTS idx_encounters_clinical_scores
  ON public.encounters USING gin(clinical_scores);

-- ── Reference: clinical_scores JSON schema ────────────────────────────────────
-- {
--   "tokyo_cholangitis": {
--     "inputs": {
--       "fever_or_chills": true,          -- A1
--       "wbc_elevated": true,             -- A2 (WBC >10 or <4 ×10⁹/L)
--       "crp_elevated": true,             -- A3 (CRP ≥1 mg/dL)
--       "jaundice": true,                 -- B1 (bilirubin ≥2 mg/dL = ≥34 µmol/L)
--       "liver_enzymes_elevated": true,   -- B2 (ALP/GGT/AST/ALT >1.5× ULN)
--       "biliary_dilatation": true,       -- C1 (imaging)
--       "biliary_cause_on_imaging": true, -- C2
--       "organ_dysfunction": ["hypotension", "altered_consciousness", "aki", "lung", "liver", "haematological"]
--     },
--     "grade": "II",                      -- I / II / III
--     "criteria_met": ["A1","A3","B1","C1"],
--     "computed_at": "2026-07-22T10:30:00Z",
--     "computed_by": "user-uuid"
--   },
--   "tokyo_cholecystitis": {
--     "inputs": {
--       "murphy_sign": true,              -- A1
--       "ruq_mass_pain_tenderness": true, -- A1 (alt)
--       "fever": true,                    -- B1
--       "wbc_elevated": true,             -- B2
--       "crp_elevated": true,             -- B3
--       "us_wall_thickening": true,       -- C1
--       "us_pericholecystic_fluid": false,
--       "us_gb_enlargement": false,
--       "us_echo_slurry": false,
--       "us_non_enhanced_area": false,
--       "organ_dysfunction": []
--     },
--     "grade": "I",
--     "criteria_met": ["A1","B1","B2","C1"],
--     "computed_at": "2026-07-22T10:30:00Z"
--   },
--   "ranson": {
--     "aetiology": "gallstone",           -- "gallstone" or "alcohol" (different thresholds)
--     "admission": {
--       "age": 62, "wbc": 18.5,
--       "glucose_mmol": 12.1,
--       "ldh_iu": 380, "ast_iu": 260
--     },
--     "at_48h": null,                     -- filled on second assessment
--     "score_admission": 3,
--     "score_total": null,
--     "severity": "severe",               -- mild <3, severe ≥3
--     "computed_at": "2026-07-22T10:30:00Z"
--   },
--   "bisap": {
--     "inputs": {
--       "bun_mmol": 11.2,                 -- BUN >25 mg/dL = >8.9 mmol/L
--       "impaired_mental_status": false,
--       "sirs_count": 2,                  -- SIRS criteria met (0–4)
--       "age_over_60": false,
--       "pleural_effusion": false
--     },
--     "score": 1,
--     "mortality_risk": "<1%",
--     "computed_at": "2026-07-22T10:30:00Z"
--   },
--   "asa": { "class": "III", "reason": "Uncontrolled hypertension + DM" },
--   "ercp_pep_risk": {
--     "risk_factors": ["female","suspected_sod","normal_bilirubin"],
--     "risk_level": "high",
--     "prophylaxis_recommended": "rectal_indomethacin + pancreatic_stent"
--   },
--   "news2": {
--     "score": 5, "clinical_risk": "medium", "computed_at": "..."
--   }
-- }

-- ── Reference: extracted_labs JSON schema ─────────────────────────────────────
-- All values numeric (null if not available). Units stored as companion keys.
-- {
--   "wbc": 14.2,          "wbc_unit": "10⁹/L",
--   "haemoglobin": 118,   "hb_unit": "g/L",
--   "platelets": 210,     "plt_unit": "10⁹/L",
--   "inr": 1.3,
--   "crp": 87,            "crp_unit": "mg/L",
--   "esr": null,
--   "bilirubin_total": 62,"bili_unit": "µmol/L",
--   "bilirubin_direct": 48,
--   "alp": 310,           "alp_unit": "IU/L",
--   "ggt": 280,           "ggt_unit": "IU/L",
--   "ast": 88,            "ast_unit": "IU/L",
--   "alt": 92,            "alt_unit": "IU/L",
--   "albumin": 38,        "alb_unit": "g/L",
--   "sodium": 138,        "na_unit": "mmol/L",
--   "potassium": 4.1,     "k_unit": "mmol/L",
--   "urea": 8.2,          "urea_unit": "mmol/L",
--   "creatinine": 98,     "cr_unit": "µmol/L",
--   "egfr": 71,           "egfr_unit": "mL/min/1.73m²",
--   "glucose": 7.4,       "gluc_unit": "mmol/L",
--   "hba1c": 52,          "hba1c_unit": "mmol/mol",
--   "amylase": 1240,      "amy_unit": "IU/L",
--   "lipase": 2100,       "lip_unit": "IU/L",
--   "ldh": 380,           "ldh_unit": "IU/L",
--   "calcium": 2.18,      "ca_unit": "mmol/L",
--   "pao2": null,         "pao2_unit": "mmHg",
--   "ca19_9": null,       "afp": null, "cea": null,
--   "source": "referral_letter",         -- "referral_letter" | "in_house" | "manual"
--   "extracted_at": "2026-07-22T10:00:00Z",
--   "extraction_confidence": "high"      -- "high" | "medium" | "low" (Claude's self-assessment)
-- }

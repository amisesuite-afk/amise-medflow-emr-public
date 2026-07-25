-- ────────────────────────────────────────────────────────────────────────────
-- clinical_guidelines table + initial seed
-- Run in Supabase SQL editor (once).
-- Sourced from ESGE, BSG, NICE, ACS evidence-based guidelines.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinical_guidelines (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_icd10      TEXT[]  NOT NULL DEFAULT '{}',
  guideline_source     TEXT    NOT NULL,
  title                TEXT    NOT NULL,
  summary              TEXT    NOT NULL,
  key_recommendations  JSONB   NOT NULL DEFAULT '[]',
  evidence_grade       TEXT    NOT NULL DEFAULT 'C',
  published_year       INT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clinical_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.clinical_guidelines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_guidelines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_guidelines TO service_role;

-- ── Seed: foundational surgical + endoscopy guidelines ─────────────────────

INSERT INTO public.clinical_guidelines
  (condition_icd10, guideline_source, title, summary, key_recommendations, evidence_grade, published_year)
VALUES

-- Acute biliary disease / cholelithiasis
(
  ARRAY['K80.0','K80.1','K80.2','K80.3','K80.4','K80.5','K80.8','K80.9'],
  'ESGE / EAES',
  'Laparoscopic Cholecystectomy for Gallbladder Disease',
  'Laparoscopic cholecystectomy is the gold standard for symptomatic cholelithiasis. Early surgery (within 72 h of admission) is recommended for acute cholecystitis. Intraoperative cholangiography or fluorescence imaging should be considered to delineate biliary anatomy.',
  '[
    {"text":"Early laparoscopic cholecystectomy within 72 h of acute cholecystitis onset is safe and reduces total hospital stay.","grade":"A"},
    {"text":"Critical view of safety (CVS) must be achieved before any biliary structure is divided.","grade":"A"},
    {"text":"Intraoperative cholangiography (IOC) or fluorescence cholangiography is recommended when biliary anatomy is unclear.","grade":"B"},
    {"text":"ERCP should be performed pre-operatively for confirmed common bile duct stones when CBD clearance before surgery is planned.","grade":"A"}
  ]'::jsonb,
  'A',
  2023
),

-- Common bile duct stones / ERCP
(
  ARRAY['K80.3','K80.4','K80.5','K83.0','K83.1'],
  'ESGE',
  'ERCP for Biliary Obstruction and Common Bile Duct Stones',
  'ERCP with sphincterotomy is the first-line treatment for CBD stones. Antibiotic prophylaxis is indicated for biliary obstruction. Balloon sphincteroplasty may supplement sphincterotomy for large stones. Stent insertion is appropriate when stone clearance cannot be achieved in one session.',
  '[
    {"text":"ERCP with endoscopic sphincterotomy is first-line for CBD stone removal.","grade":"A"},
    {"text":"Prophylactic antibiotics (e.g., cefazolin or ciprofloxacin) are recommended when biliary drainage is anticipated to be incomplete.","grade":"A"},
    {"text":"Large-balloon dilation (12–20 mm) after sphincterotomy increases stone clearance rate for stones >12 mm.","grade":"A"},
    {"text":"Biliary stenting should bridge to further stone extraction when complete clearance is not possible in one session.","grade":"B"},
    {"text":"Pre-procedure rectal indomethacin 100 mg reduces post-ERCP pancreatitis risk in all patients.","grade":"A"}
  ]'::jsonb,
  'A',
  2022
),

-- Acute pancreatitis
(
  ARRAY['K85.0','K85.1','K85.2','K85.3','K85.8','K85.9'],
  'APA / IAP',
  'Evidence-Based Management of Acute Pancreatitis',
  'Severity stratification using the Revised Atlanta Classification guides management. Aggressive early intravenous fluid resuscitation with lactated Ringer''s solution is recommended. Antibiotics are not indicated prophylactically for sterile necrosis. Enteral nutrition is preferred over parenteral nutrition. ERCP should be performed within 24 h if cholangitis is present.',
  '[
    {"text":"Isotonic crystalloid (lactated Ringer''s preferred) 250–500 mL/h during the first 12–24 h unless cardiovascular or renal contraindications exist.","grade":"A"},
    {"text":"Prophylactic antibiotics should NOT be given for sterile necrosis.","grade":"A"},
    {"text":"Enteral nutrition (naso-jejunal or naso-gastric) should be initiated within 24–48 h of admission in predicted severe cases.","grade":"A"},
    {"text":"Urgent ERCP (within 24 h) is indicated when acute pancreatitis is complicated by cholangitis.","grade":"A"},
    {"text":"Minimally invasive step-up approach (drainage before necrosectomy) is recommended for infected pancreatic necrosis.","grade":"A"}
  ]'::jsonb,
  'A',
  2024
),

-- Upper GI bleed
(
  ARRAY['K92.0','K92.1','K25.0','K25.4','K26.0','K26.4','K27.0','K28.0'],
  'BSG / ESGE',
  'Management of Acute Upper Gastrointestinal Bleeding',
  'Risk stratification using the Glasgow-Blatchford Score (GBS) guides admission and intervention decisions. Early endoscopy within 24 h improves outcomes in intermediate-to-high risk patients. High-dose PPI infusion is recommended after endoscopic therapy of peptic ulcer bleeding. Pre-endoscopy erythromycin infusion improves visibility.',
  '[
    {"text":"Glasgow-Blatchford Score (GBS) ≤1 identifies low-risk patients suitable for early discharge and outpatient endoscopy.","grade":"A"},
    {"text":"Endoscopy within 24 h of presentation is recommended for non-variceal UGIB in all haemodynamically stable patients.","grade":"A"},
    {"text":"Pre-endoscopy erythromycin 250 mg IV (30 min before OGD) promotes gastric emptying and improves visualisation.","grade":"B"},
    {"text":"After endoscopic therapy for peptic ulcer bleeding: omeprazole 80 mg bolus then 8 mg/h infusion for 72 h.","grade":"A"},
    {"text":"Variceal bleeding: terlipressin plus endoscopic band ligation; TIPS if refractory.","grade":"A"}
  ]'::jsonb,
  'A',
  2021
),

-- Colorectal cancer screening / surveillance
(
  ARRAY['C18.0','C18.1','C18.2','C18.3','C18.4','C18.5','C18.6','C18.7','C18.8','C18.9','C19','C20','Z12.1'],
  'BSG / ESGE',
  'Colonoscopic Surveillance for Colorectal Cancer and Adenoma',
  'Post-polypectomy surveillance intervals are stratified by adenoma risk. High-risk findings (≥3 adenomas, any adenoma ≥10 mm, or villous/tubulovillous histology) require 3-year surveillance. Low-risk adenomas (1–2 tubular adenomas <10 mm) require 5-year surveillance. Patients with no adenomas return to population screening.',
  '[
    {"text":"Low-risk adenomas (1–2 tubular adenomas <10 mm, no high-grade dysplasia): 5-year surveillance colonoscopy.","grade":"A"},
    {"text":"High-risk adenomas (≥3 adenomas, or any adenoma ≥10 mm, or villous features, or high-grade dysplasia): 3-year surveillance.","grade":"A"},
    {"text":"Piecemeal resection of non-pedunculated lesion ≥20 mm: first surveillance at 3–6 months, then per adenoma risk.","grade":"B"},
    {"text":"Patients with Lynch syndrome or FAP require annual or 2-yearly colonoscopy regardless of adenoma findings.","grade":"A"},
    {"text":"Complete colonoscopy with high-definition white-light endoscopy; add chromoendoscopy or NBI for high-risk/IBD patients.","grade":"B"}
  ]'::jsonb,
  'A',
  2020
),

-- GERD / Barrett's oesophagus
(
  ARRAY['K21.0','K21.9','K22.1','Z85.01'],
  'BSG / ESGE',
  'Barrett''s Oesophagus Surveillance and Management',
  'Patients with Barrett''s oesophagus require surveillance endoscopy to detect dysplastic progression. The interval depends on segment length and presence of dysplasia. High-grade dysplasia (HGD) and early mucosal cancer are treated with endoscopic resection (EMR/ESD) combined with radiofrequency ablation (RFA). Long-term PPI therapy reduces dysplastic progression.',
  '[
    {"text":"Short-segment Barrett''s (<3 cm, no dysplasia): 3–5-year surveillance.","grade":"B"},
    {"text":"Long-segment Barrett''s (≥3 cm, no dysplasia): 2–3-year surveillance.","grade":"B"},
    {"text":"Low-grade dysplasia: confirm at expert centre; endoscopic ablation (RFA) or intensive 6-monthly surveillance.","grade":"A"},
    {"text":"High-grade dysplasia or mucosal cancer: endoscopic mucosal resection (EMR) ± radiofrequency ablation (RFA) is first-line.","grade":"A"},
    {"text":"Twice-daily PPI therapy is recommended for all Barrett''s patients to reduce dysplastic progression.","grade":"B"}
  ]'::jsonb,
  'B',
  2023
),

-- Diverticular disease
(
  ARRAY['K57.0','K57.1','K57.2','K57.3','K57.4','K57.5','K57.8','K57.9'],
  'ESCP / ASCRS',
  'Management of Acute Diverticulitis',
  'Uncomplicated acute diverticulitis can be managed without antibiotics in selected patients. CT is the preferred imaging modality. Modified Hinchey classification guides surgical decision-making for complicated disease. Elective sigmoid resection should be considered after ≥2 attacks or after 1 complicated episode.',
  '[
    {"text":"Uncomplicated diverticulitis (Hinchey Ia/Ib): outpatient management with low-residue diet is safe in selected immunocompetent patients; antibiotics may be withheld.","grade":"A"},
    {"text":"CT abdomen/pelvis with IV contrast is the recommended imaging modality for suspected diverticulitis.","grade":"A"},
    {"text":"Hinchey III/IV (generalised peritonitis): emergency surgery; Hartmann''s procedure or primary resection with anastomosis.","grade":"B"},
    {"text":"Percutaneous drainage is preferred for pericolic abscesses ≥3 cm (Hinchey II) if technically feasible.","grade":"B"},
    {"text":"Consider elective resection after recovery from complicated diverticulitis or recurrent uncomplicated episodes.","grade":"C"}
  ]'::jsonb,
  'B',
  2022
),

-- Hernia repair (inguinal)
(
  ARRAY['K40.0','K40.1','K40.2','K40.3','K40.9','K41.0','K41.1','K41.2','K41.9'],
  'EHS / HerniaSurge',
  'Guidelines for Groin Hernia Repair',
  'The European Hernia Society (EHS) and HerniaSurge group recommend endoscopic repair (TEP or TAPP) for bilateral and recurrent inguinal hernias. Lichtenstein tension-free repair remains the gold standard for primary unilateral hernias if laparoscopic expertise is unavailable. Watchful waiting is acceptable for minimally symptomatic hernias in patients unfit for surgery.',
  '[
    {"text":"Laparoscopic repair (TEP or TAPP) is recommended for bilateral and recurrent inguinal hernias.","grade":"A"},
    {"text":"Lichtenstein tension-free repair is acceptable for primary unilateral hernias where laparoscopic expertise is unavailable.","grade":"A"},
    {"text":"Mesh should be used in all primary elective groin hernia repairs to minimise recurrence.","grade":"A"},
    {"text":"Watchful waiting with deferred repair is appropriate for minimally symptomatic or asymptomatic groin hernias in men.","grade":"B"},
    {"text":"Day-case hernia repair under local or general anaesthesia should be the standard of care.","grade":"A"}
  ]'::jsonb,
  'A',
  2018
),

-- Thyroid nodule evaluation
(
  ARRAY['E04.1','E04.2','E04.9','D34','C73'],
  'ATA / BTA',
  'Evaluation and Management of Thyroid Nodules',
  'Thyroid nodules are evaluated by ultrasound risk stratification (TIRADS/BTA U categories) and FNAC. Surgery is recommended for TIRADS 5 / U5 nodules, Bethesda V-VI cytology, or pressure symptoms. Molecular testing of indeterminate cytology (Bethesda III/IV) guides surgical decisions.',
  '[
    {"text":"All thyroid nodules ≥1 cm (or suspicious US features at any size) require ultrasound characterisation.","grade":"A"},
    {"text":"FNAC is recommended for TIRADS 4–5 / BTA U3–U5 nodules ≥1 cm; ultrasound-guided FNA preferred.","grade":"A"},
    {"text":"Bethesda V (suspicious for malignancy) or VI (malignant): surgery recommended.","grade":"A"},
    {"text":"Bethesda III/IV (indeterminate): molecular testing (e.g., Afirma, ThyroSeq) or diagnostic lobectomy.","grade":"B"},
    {"text":"Total thyroidectomy for malignancy >1 cm, bilateral nodules, or lymph node involvement.","grade":"A"}
  ]'::jsonb,
  'A',
  2023
),

-- Breast lump evaluation
(
  ARRAY['N63','D24','C50.0','C50.1','C50.2','C50.3','C50.4','C50.5','C50.6','C50.8','C50.9','Z12.3'],
  'NICE / SIGN',
  'Assessment of Breast Lumps and Symptomatic Breast Disease',
  'The triple assessment (clinical examination, imaging, and needle biopsy) is the standard pathway for evaluating breast lumps. All women aged ≥30 with a discrete lump should undergo ultrasound ± mammography. Core needle biopsy (CNB) is preferred over FNAC for definitive histology. Urgent referral within 2 weeks is required for suspected breast cancer.',
  '[
    {"text":"Triple assessment is mandatory: clinical examination + imaging (US ± mammogram) + needle biopsy.","grade":"A"},
    {"text":"Ultrasound is first-line imaging for women <40; add mammography for women ≥40 or if US is indeterminate.","grade":"A"},
    {"text":"Core needle biopsy (14G) is preferred over FNAC for providing histological diagnosis including receptor status.","grade":"A"},
    {"text":"U3/U4/U5 lesions require biopsy regardless of clinical assessment.","grade":"A"},
    {"text":"Any woman with features suspicious for cancer should be referred urgently (2-week pathway).","grade":"A"}
  ]'::jsonb,
  'A',
  2023
),

-- Diabetic foot
(
  ARRAY['E11.51','E11.52','E11.59','E11.61','E11.621','E11.622','L97.1','L97.2','L97.3','L97.4','L97.5'],
  'IWGDF / NICE',
  'Prevention and Management of Diabetic Foot Infections',
  'The International Working Group on the Diabetic Foot (IWGDF) classifies foot infections by severity (mild/moderate/severe). Mild infections are managed with oral antibiotics; moderate-to-severe infections require IV antibiotics and hospitalisation. Vascular assessment is essential — revascularisation should precede or accompany debridement when ischaemia is present.',
  '[
    {"text":"IWGDF severity classification should guide antibiotic choice and route: mild → oral, moderate/severe → IV.","grade":"A"},
    {"text":"Bone biopsy or swab of debrided wound is preferred over superficial wound swab for microbiological guidance.","grade":"B"},
    {"text":"Assess vascular status (ABPI, duplex, ± CT angiography) in all patients with infected diabetic foot ulcers.","grade":"A"},
    {"text":"Revascularisation should be considered before major debridement when limb ischaemia is present.","grade":"A"},
    {"text":"Multidisciplinary team (surgeon, diabetologist, vascular, podiatry, nursing) improves limb salvage rates.","grade":"A"}
  ]'::jsonb,
  'A',
  2023
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'clinical_guidelines_updated_at'
  ) THEN
    CREATE TRIGGER clinical_guidelines_updated_at
      BEFORE UPDATE ON public.clinical_guidelines
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

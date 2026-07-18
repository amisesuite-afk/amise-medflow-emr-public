-- ============================================================
-- Amise MedFlow EMR — Missing Tables Migration
-- Tables: pmh_items, pending_bookings, patient_tasks,
--         clinical_guidelines
-- Run: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. PMH ITEMS ────────────────────────────────────────────
-- Past medical history conditions per patient.
-- UNIQUE(patient_id, condition) allows upsert-on-conflict.

CREATE TABLE IF NOT EXISTS public.pmh_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id uuid        REFERENCES public.encounters(id) ON DELETE SET NULL,
  condition    text        NOT NULL,
  status       text        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'resolved')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pmh_items_patient_condition_unique UNIQUE (patient_id, condition)
);

ALTER TABLE public.pmh_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff access" ON public.pmh_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pmh_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pmh_items TO service_role;

CREATE INDEX IF NOT EXISTS idx_pmh_items_patient ON public.pmh_items(patient_id);

-- ─── 2. PENDING BOOKINGS ─────────────────────────────────────
-- Staging table for email-intake booking replies awaiting
-- patient confirmation. Written by the API server intake route.

CREATE TABLE IF NOT EXISTS public.pending_bookings (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         uuid        REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_email      text        NOT NULL,
  appointment_type   text,
  slots_offered      text,
  gmail_thread_id    text,
  gmail_message_id   text,
  status             text        NOT NULL DEFAULT 'awaiting_reply'
                                 CHECK (status IN ('awaiting_reply', 'confirmed', 'expired', 'cancelled')),
  confirmed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff access" ON public.pending_bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pending_bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pending_bookings TO service_role;

CREATE INDEX IF NOT EXISTS idx_pending_bookings_patient  ON public.pending_bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_pending_bookings_status   ON public.pending_bookings(status);
CREATE INDEX IF NOT EXISTS idx_pending_bookings_gmail_thread ON public.pending_bookings(gmail_thread_id);

-- ─── 3. PATIENT TASKS ────────────────────────────────────────
-- Closed-loop task tracking: follow-ups, pending results,
-- callbacks, referrals. Overdue tasks surface in the dashboard.

CREATE TABLE IF NOT EXISTS public.patient_tasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid        REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id uuid        REFERENCES public.encounters(id) ON DELETE SET NULL,
  task_type    text        NOT NULL
                           CHECK (task_type IN (
                             'follow_up_appointment', 'pending_result',
                             'prescription_fill', 'referral_response',
                             'procedure_scheduling', 'result_review',
                             'document_review', 'callback', 'other'
                           )),
  description  text        NOT NULL,
  due_date     date,
  priority     text        NOT NULL DEFAULT 'normal'
                           CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status       text        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'in_progress', 'completed', 'overdue', 'cancelled')),
  assigned_to  text,
  completed_at timestamptz,
  completed_by text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff access" ON public.patient_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_tasks TO service_role;

CREATE INDEX IF NOT EXISTS idx_patient_tasks_patient  ON public.patient_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_tasks_status   ON public.patient_tasks(status);
CREATE INDEX IF NOT EXISTS idx_patient_tasks_due      ON public.patient_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_patient_tasks_priority ON public.patient_tasks(priority)
  WHERE status IN ('open', 'in_progress', 'overdue');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS patient_tasks_updated_at ON public.patient_tasks;
CREATE TRIGGER patient_tasks_updated_at
  BEFORE UPDATE ON public.patient_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. CLINICAL GUIDELINES ──────────────────────────────────
-- Evidence-based guidelines indexed by ICD-10 code array.
-- Injected into AI consultant context when ICD codes match.

CREATE TABLE IF NOT EXISTS public.clinical_guidelines (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_icd10     text[]      NOT NULL DEFAULT '{}',
  condition_name      text        NOT NULL,
  guideline_source    text        NOT NULL,
  title               text        NOT NULL,
  summary             text        NOT NULL,
  key_recommendations jsonb       NOT NULL DEFAULT '[]',
  evidence_grade      text,
  specialty           text,
  url                 text,
  last_reviewed       date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_guidelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff access" ON public.clinical_guidelines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_guidelines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_guidelines TO service_role;

CREATE INDEX IF NOT EXISTS idx_guidelines_icd10    ON public.clinical_guidelines USING gin(condition_icd10);
CREATE INDEX IF NOT EXISTS idx_guidelines_specialty ON public.clinical_guidelines(specialty);

DROP TRIGGER IF EXISTS clinical_guidelines_updated_at ON public.clinical_guidelines;
CREATE TRIGGER clinical_guidelines_updated_at
  BEFORE UPDATE ON public.clinical_guidelines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── SEED: Clinical Guidelines ───────────────────────────────
INSERT INTO public.clinical_guidelines
  (condition_icd10, condition_name, guideline_source, title, summary, key_recommendations, evidence_grade, specialty)
VALUES

('{K35.80,K35.20,K35.30}','Acute Appendicitis','NICE / WSES 2020',
 'Diagnosis and Management of Acute Appendicitis',
 'Alvarado score for risk stratification. CT abdomen for equivocal cases. Laparoscopic appendicectomy is the gold standard.',
 '[{"text":"Alvarado ≥ 7: surgery without further imaging","grade":"B"},{"text":"CT abdomen/pelvis for Alvarado 5-6","grade":"A"},{"text":"Laparoscopic appendicectomy preferred","grade":"A"},{"text":"Antibiotics-first for uncomplicated appendicitis in selected patients","grade":"B"}]',
 'A','general_surgery'),

('{K80.00,K80.10,K81.0}','Acute Cholecystitis','Tokyo Guidelines TG18',
 'Tokyo Guidelines 2018: Acute Cholecystitis Classification and Management',
 'Grade severity using TG18. Grade I: early laparoscopic cholecystectomy within 72h. Grade III: organ dysfunction — ICU + percutaneous drainage.',
 '[{"text":"Early laparoscopic cholecystectomy within 72h for Grade I","grade":"A"},{"text":"Percutaneous cholecystostomy for Grade III","grade":"B"},{"text":"IV antibiotics: ampicillin-sulbactam or piperacillin-tazobactam","grade":"A"}]',
 'A','general_surgery'),

('{K80.31,K83.0,K80.50}','Choledocholithiasis and Cholangitis','Tokyo Guidelines TG18 / BSG',
 'Management of CBD Stones and Acute Cholangitis',
 'Charcot triad = cholangitis until proven otherwise. ERCP within 24h for Grade II-III cholangitis.',
 '[{"text":"Urgent ERCP within 24h for Grade II-III cholangitis","grade":"A"},{"text":"Emergency ERCP within 12h for Grade III with organ failure","grade":"A"},{"text":"IV piperacillin-tazobactam for cholangitis","grade":"A"}]',
 'A','hepatobiliary'),

('{K21.0,K21.9}','Gastro-oesophageal Reflux Disease','NICE NG104 / ACG 2022',
 'Diagnosis and Management of GORD',
 'Trial of PPI before endoscopy for typical symptoms without alarm features. OGD for dysphagia, weight loss, GI bleeding, age > 55 with new dyspepsia.',
 '[{"text":"8-week PPI trial for typical reflux without alarm features","grade":"A"},{"text":"OGD mandatory for dysphagia, weight loss, GI bleeding, or age > 55 with new onset","grade":"A"},{"text":"24h pH/impedance study before considering surgery","grade":"A"}]',
 'A','upper_gi'),

('{C18.9,C19,C20}','Colorectal Cancer','NICE NG151 / ASCRS 2022',
 'Colorectal Cancer: Diagnosis, Staging, and Management',
 'Two-week wait referral for age > 40 with unexplained weight loss + abdominal pain. Staging CT chest-abdomen-pelvis. MRI pelvis for rectal cancer.',
 '[{"text":"Urgent colonoscopy for suspected colorectal cancer","grade":"A"},{"text":"CT chest-abdomen-pelvis for staging","grade":"A"},{"text":"MRI pelvis for all rectal cancers","grade":"A"},{"text":"Neoadjuvant chemoradiotherapy for locally advanced rectal cancer","grade":"A"}]',
 'A','colorectal'),

('{C50.911,C50.919,D05.10}','Breast Cancer','NICE NG101 / ABS Guidelines',
 'Early and Locally Advanced Breast Cancer: Diagnosis and Management',
 'Triple assessment mandatory: clinical exam, imaging, tissue sampling. Sentinel lymph node biopsy for clinically node-negative.',
 '[{"text":"Triple assessment for all palpable breast lumps","grade":"A"},{"text":"Core biopsy preferred over FNA","grade":"A"},{"text":"Sentinel lymph node biopsy for node-negative disease","grade":"A"}]',
 'A','breast'),

('{K40.90,K40.91,K40.30}','Inguinal Hernia','EHS 2024 / HerniaSurge',
 'Inguinal Hernia Repair: EHS/HerniaSurge Guidelines',
 'Mesh repair standard. Watchful waiting for asymptomatic hernias in men. Laparoscopic preferred for bilateral and recurrent.',
 '[{"text":"Mesh repair is standard of care","grade":"A"},{"text":"Watchful waiting acceptable for asymptomatic inguinal hernia in men","grade":"A"},{"text":"Femoral hernias always require surgical repair","grade":"A"},{"text":"Laparoscopic TEP/TAPP preferred for bilateral and recurrent","grade":"A"}]',
 'A','general_surgery'),

('{E04.1,E04.2,C73}','Thyroid Nodules','ATA 2015 / BTA 2014',
 'Evaluation and Management of Thyroid Nodules',
 'USS with TIRADS classification. FNA for suspicious nodules > 1 cm. Bethesda classification guides management.',
 '[{"text":"USS with TIRADS classification for all palpable thyroid nodules","grade":"A"},{"text":"FNA for TIRADS 4-5 nodules > 1 cm","grade":"A"},{"text":"Diagnostic lobectomy for Bethesda III-IV","grade":"B"},{"text":"Total thyroidectomy for confirmed PTC > 1 cm","grade":"A"}]',
 'A','endocrine'),

('{K25.9,K26.9,K27.4}','Peptic Ulcer Disease','ACG 2017 / NICE',
 'Diagnosis and Management of Peptic Ulcer Disease',
 'OGD for diagnosis — biopsy for H. pylori and malignancy in gastric ulcers. H. pylori eradication: triple therapy 14 days.',
 '[{"text":"OGD with biopsy for all gastric ulcers","grade":"A"},{"text":"H. pylori eradication: PPI + amoxicillin + clarithromycin × 14 days","grade":"A"},{"text":"Repeat OGD at 6-8 weeks for gastric ulcers","grade":"A"},{"text":"Emergency OGD within 24h for acute upper GI bleed","grade":"A"}]',
 'A','upper_gi'),

('{K57.30,K57.32,K57.92}','Diverticular Disease','ASCRS 2020 / WSES 2020',
 'Diagnosis and Management of Acute Diverticulitis',
 'CT abdomen/pelvis with IV contrast for diagnosis and Hinchey staging. Uncomplicated: antibiotics or observation. Hinchey III/IV: emergency surgery.',
 '[{"text":"CT abdomen/pelvis for diagnosis and Hinchey classification","grade":"A"},{"text":"Uncomplicated diverticulitis: oral antibiotics or observation","grade":"A"},{"text":"Emergency surgery for Hinchey III/IV","grade":"A"},{"text":"Colonoscopy 6-8 weeks after resolution","grade":"B"}]',
 'A','colorectal'),

('{K64.0,K64.1,K64.8}','Haemorrhoids','ASCRS 2018',
 'Management of Haemorrhoids',
 'Grade I-II: conservative. Grade II-III: rubber band ligation. Grade III-IV: haemorrhoidectomy. Thrombosed external: excision within 72h.',
 '[{"text":"Rubber band ligation for Grade II-III internal haemorrhoids","grade":"A"},{"text":"Excisional haemorrhoidectomy for Grade III-IV refractory to banding","grade":"A"},{"text":"Excision of thrombosed external haemorrhoid within 72h","grade":"B"}]',
 'A','colorectal'),

('{K85.10,K85.11}','Gallstone Pancreatitis','IAP/APA 2013 / NICE',
 'Acute Gallstone Pancreatitis: Assessment and Management',
 'Assess severity: APACHE II, Ranson, or BISAP. Mild: index-admission cholecystectomy. ERCP only if concurrent cholangitis.',
 '[{"text":"Index-admission cholecystectomy for mild gallstone pancreatitis","grade":"A"},{"text":"ERCP within 24h only if concurrent cholangitis or persistent obstruction","grade":"A"},{"text":"Enteral nutrition preferred over TPN in severe pancreatitis","grade":"A"}]',
 'A','hepatobiliary'),

('{I82.409,I26.99}','VTE Prophylaxis in Surgery','NICE NG89 / ASH 2019',
 'Venous Thromboembolism Prophylaxis in Surgical Patients',
 'Assess VTE risk for all surgical patients. Mechanical prophylaxis for all. LMWH for moderate-high risk. Extended prophylaxis for major cancer surgery.',
 '[{"text":"Mechanical prophylaxis (TED + IPC) for all surgical patients","grade":"A"},{"text":"LMWH for Caprini ≥ 3","grade":"A"},{"text":"Extended LMWH × 28 days for major cancer surgery","grade":"A"}]',
 'A','general_surgery'),

('{E11.621,E11.622,L97.509}','Diabetic Foot Ulcer','NICE NG19 / IWGDF 2023',
 'Diabetic Foot: Assessment and Management',
 'MDT foot team within 24h. Offloading is the single most important intervention. Vascular assessment for all.',
 '[{"text":"MDT assessment within 24h of presentation","grade":"A"},{"text":"Offloading (total contact cast) for neuropathic plantar ulcers","grade":"A"},{"text":"Vascular assessment (ABPI + duplex) for all diabetic foot ulcers","grade":"A"},{"text":"Antibiotics only for clinically infected ulcers","grade":"A"}]',
 'A','vascular')

ON CONFLICT DO NOTHING;

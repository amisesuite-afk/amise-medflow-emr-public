-- ============================================================
-- Amise Medical Services — EMR Enhancement Migration
-- Adds: prescriptions, clinical_guidelines, patient_tasks
-- Extends: investigation_results (acknowledgement workflow),
--          clinical_notes (linked attachments),
--          documents (clinical_photo type)
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: supabase-schema.sql AND
--   supabase-clinical-records-migration.sql must have been applied
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PRESCRIPTIONS
-- Distinct from medications (what patient IS on) — prescriptions
-- track what the doctor is ORDERING. Each prescription creates
-- a signable record with a printable RX page.
-- ─────────────────────────────────────────────────────────────
create table if not exists prescriptions (
  id                uuid        primary key default uuid_generate_v4(),
  patient_id        uuid        not null references patients(id) on delete cascade,
  encounter_id      uuid        references encounters(id) on delete set null,

  drug_name         text        not null,
  dose              text        not null,
  frequency         text        not null,
  route             text        not null default 'oral'
                                check (route in (
                                  'oral', 'iv', 'im', 'sc', 'topical', 'rectal',
                                  'sublingual', 'inhaled', 'ophthalmic', 'otic', 'nasal',
                                  'per_rectum', 'other'
                                )),
  duration          text,
  quantity          text,
  refills           integer     not null default 0,
  instructions      text,
  indication        text,

  -- Prescriber signature
  prescriber_id     uuid        not null references auth.users(id) on delete restrict,
  signed_at         timestamptz,

  status            text        not null default 'draft'
                                check (status in (
                                  'draft', 'signed', 'dispensed', 'expired', 'cancelled'
                                )),
  pharmacy_notes    text,

  created_by        uuid        references auth.users(id) on delete set null,
  updated_by        uuid        references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table prescriptions is
  'Prescription orders — distinct from medications (current med list). Each RX is signable with a printable page.';

-- ─────────────────────────────────────────────────────────────
-- 2. CLINICAL GUIDELINES
-- Evidence-based guidelines indexed by ICD-10 code(s).
-- Injected into AI consultation context to reduce token usage
-- and ensure current, auditable references.
-- ─────────────────────────────────────────────────────────────
create table if not exists clinical_guidelines (
  id                    uuid        primary key default uuid_generate_v4(),
  condition_icd10       text[]      not null default '{}',
  condition_name        text        not null,
  guideline_source      text        not null,
  title                 text        not null,
  summary               text        not null,
  key_recommendations   jsonb       not null default '[]',
  evidence_grade        text,
  specialty             text,
  url                   text,
  last_reviewed         date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table clinical_guidelines is
  'Evidence-based clinical guidelines indexed by ICD-10 code. Injected into AI context to reduce tokens and ensure auditable references.';
comment on column clinical_guidelines.key_recommendations is
  'JSONB array of recommendation objects: [{"text":"...", "grade":"A", "source":"NICE NG104"}]';

-- ─────────────────────────────────────────────────────────────
-- 3. PATIENT TASKS
-- Closed-loop tracking — every pending action on a patient
-- becomes a task with a due date. Overdue tasks surface in
-- daily summaries and dashboard alerts.
-- ─────────────────────────────────────────────────────────────
create table if not exists patient_tasks (
  id                uuid        primary key default uuid_generate_v4(),
  patient_id        uuid        not null references patients(id) on delete cascade,
  encounter_id      uuid        references encounters(id) on delete set null,

  task_type         text        not null
                                check (task_type in (
                                  'follow_up_appointment', 'pending_result',
                                  'prescription_fill', 'referral_response',
                                  'procedure_scheduling', 'result_review',
                                  'document_review', 'callback', 'other'
                                )),
  description       text        not null,
  due_date          date,
  priority          text        not null default 'normal'
                                check (priority in ('low', 'normal', 'high', 'urgent')),

  status            text        not null default 'open'
                                check (status in ('open', 'in_progress', 'completed', 'overdue', 'cancelled')),

  assigned_to       uuid        references auth.users(id) on delete set null,
  completed_at      timestamptz,
  completed_by      uuid        references auth.users(id) on delete set null,
  notes             text,

  -- Source tracking — what created this task
  source_table      text,
  source_id         uuid,

  created_by        uuid        references auth.users(id) on delete set null,
  updated_by        uuid        references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table patient_tasks is
  'Closed-loop task tracking — follow-ups, pending results, referrals, callbacks. Overdue tasks trigger daily summary alerts.';

-- ─────────────────────────────────────────────────────────────
-- 4. EXTEND investigation_results — acknowledgement workflow
-- ─────────────────────────────────────────────────────────────
alter table investigation_results
  add column if not exists acknowledged_by  uuid references auth.users(id) on delete set null,
  add column if not exists acknowledged_at  timestamptz,
  add column if not exists action_taken     text;

comment on column investigation_results.acknowledged_by is
  'Physician who reviewed and acknowledged the result.';
comment on column investigation_results.action_taken is
  'Free text: what the physician did in response to this result.';

-- ─────────────────────────────────────────────────────────────
-- 5. EXTEND clinical_notes — linked attachments
-- ─────────────────────────────────────────────────────────────
alter table clinical_notes
  add column if not exists linked_attachment_ids uuid[] default '{}';

comment on column clinical_notes.linked_attachment_ids is
  'Array of document IDs (from documents table) linked to this note — clinical photos, lab reports, etc.';

-- ─────────────────────────────────────────────────────────────
-- 6. EXTEND documents — add clinical_photo type if missing
-- ─────────────────────────────────────────────────────────────
-- Check if clinical_photo is already in the CHECK constraint
-- If the constraint exists, drop and recreate with the new value
do $$
begin
  -- Only modify if clinical_photo is not already allowed
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name like '%documents_document_type_check%'
      and check_clause like '%clinical_photo%'
  ) then
    alter table documents drop constraint if exists documents_document_type_check;
    alter table documents add constraint documents_document_type_check
      check (document_type in (
        'lab_report', 'imaging_report', 'referral_letter',
        'consent_form', 'surgical_report', 'discharge_summary',
        'prescription', 'insurance_form', 'clinical_photo', 'other'
      ));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 7. EXTEND consultation_requests — guidelines referenced
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'consultation_requests') then
    execute 'alter table consultation_requests add column if not exists guidelines_referenced jsonb default ''[]''';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- updated_at TRIGGERS
-- ─────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array[
    'prescriptions', 'clinical_guidelines', 'patient_tasks'
  ] loop
    execute format(
      'drop trigger if exists trg_updated_at on %I;
       create trigger trg_updated_at before update on %I
         for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array[
    'prescriptions', 'clinical_guidelines', 'patient_tasks'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- ── prescriptions (doctor/admin only for write) ──
create policy "staff_select_prescriptions" on prescriptions
  for select using (auth.uid() is not null);
create policy "doctors_insert_prescriptions" on prescriptions
  for insert with check (auth_role() in ('doctor', 'admin'));
create policy "doctors_update_prescriptions" on prescriptions
  for update using (auth_role() in ('doctor', 'admin'));
create policy "admins_delete_prescriptions" on prescriptions
  for delete using (auth_role() = 'admin');

-- ── clinical_guidelines (all staff can read; admins manage) ──
create policy "staff_select_guidelines" on clinical_guidelines
  for select using (auth.uid() is not null);
create policy "admins_manage_guidelines" on clinical_guidelines
  for all using (auth_role() in ('doctor', 'admin'));

-- ── patient_tasks (all clinical staff) ──
create policy "staff_select_tasks" on patient_tasks
  for select using (auth.uid() is not null);
create policy "staff_insert_tasks" on patient_tasks
  for insert with check (auth.uid() is not null);
create policy "staff_update_tasks" on patient_tasks
  for update using (auth.uid() is not null);
create policy "admins_delete_tasks" on patient_tasks
  for delete using (auth_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────

-- prescriptions
create index if not exists idx_rx_patient     on prescriptions(patient_id);
create index if not exists idx_rx_encounter   on prescriptions(encounter_id);
create index if not exists idx_rx_prescriber  on prescriptions(prescriber_id);
create index if not exists idx_rx_status      on prescriptions(status);
create index if not exists idx_rx_created     on prescriptions(created_at desc);

-- clinical_guidelines
create index if not exists idx_guidelines_icd on clinical_guidelines using gin(condition_icd10);
create index if not exists idx_guidelines_specialty on clinical_guidelines(specialty);

-- patient_tasks
create index if not exists idx_tasks_patient  on patient_tasks(patient_id);
create index if not exists idx_tasks_status   on patient_tasks(status);
create index if not exists idx_tasks_due      on patient_tasks(due_date);
create index if not exists idx_tasks_priority on patient_tasks(priority)
  where status in ('open', 'in_progress', 'overdue');
create index if not exists idx_tasks_assigned on patient_tasks(assigned_to)
  where status in ('open', 'in_progress', 'overdue');
create index if not exists idx_tasks_source   on patient_tasks(source_table, source_id);

-- ─────────────────────────────────────────────────────────────
-- GRANTS
-- ─────────────────────────────────────────────────────────────
grant select, insert, update on public.prescriptions       to authenticated;
grant select, insert, update on public.clinical_guidelines to authenticated;
grant select, insert, update on public.patient_tasks       to authenticated;

grant select, insert, update, delete on public.prescriptions       to service_role;
grant select, insert, update, delete on public.clinical_guidelines to service_role;
grant select, insert, update, delete on public.patient_tasks       to service_role;

-- ─────────────────────────────────────────────────────────────
-- SEED DATA: Clinical Guidelines
-- Pre-populated with key guidelines for the practice's
-- surgical and endoscopic focus areas.
-- ─────────────────────────────────────────────────────────────
insert into clinical_guidelines (condition_icd10, condition_name, guideline_source, title, summary, key_recommendations, evidence_grade, specialty) values

-- Acute Appendicitis
('{K35.80,K35.20,K35.30}', 'Acute Appendicitis', 'NICE / WSES 2020',
 'Diagnosis and Management of Acute Appendicitis',
 'Alvarado score for risk stratification. CT abdomen for equivocal cases. Laparoscopic appendicectomy is the gold standard. Antibiotics-first may be appropriate for uncomplicated appendicitis in selected patients.',
 '[{"text":"Use Alvarado score ≥ 7 as indication for surgery without further imaging","grade":"B"},{"text":"CT abdomen/pelvis for Alvarado 5-6 (equivocal)","grade":"A"},{"text":"Laparoscopic appendicectomy preferred over open","grade":"A"},{"text":"Antibiotics-first acceptable in uncomplicated appendicitis if patient declines surgery","grade":"B"},{"text":"Perforated appendicitis: IV antibiotics + appendicectomy (may be delayed 24-48h if abscess)","grade":"B"}]',
 'A', 'general_surgery'),

-- Acute Cholecystitis
('{K80.00,K80.10,K81.0}', 'Acute Cholecystitis', 'Tokyo Guidelines TG18',
 'Tokyo Guidelines 2018: Acute Cholecystitis Classification and Management',
 'Grade severity using TG18 criteria. Grade I (mild): early laparoscopic cholecystectomy within 72h. Grade II (moderate): early surgery if experienced surgeon available, else percutaneous drainage. Grade III (severe): organ dysfunction — ICU, percutaneous drainage, delayed surgery.',
 '[{"text":"Early laparoscopic cholecystectomy within 72h of symptom onset for Grade I","grade":"A"},{"text":"Percutaneous cholecystostomy for Grade III with organ dysfunction","grade":"B"},{"text":"IV antibiotics: ampicillin-sulbactam or piperacillin-tazobactam","grade":"A"},{"text":"Intraoperative cholangiogram if CBD stone suspected","grade":"B"},{"text":"Subtotal cholecystectomy for severely inflamed/fibrosed Calot triangle","grade":"C"}]',
 'A', 'general_surgery'),

-- Choledocholithiasis / Cholangitis
('{K80.31,K83.0,K80.50}', 'Choledocholithiasis and Cholangitis', 'Tokyo Guidelines TG18 / BSG',
 'Management of CBD Stones and Acute Cholangitis',
 'Charcot triad (fever, jaundice, RUQ pain) = cholangitis until proven otherwise. Reynolds pentad adds shock + confusion = septic cholangitis (emergency). ERCP within 24h for Grade II-III cholangitis. ASGE criteria for CBD stone probability.',
 '[{"text":"Urgent ERCP within 24h for Grade II-III cholangitis","grade":"A"},{"text":"Emergency ERCP (within 12h) for Grade III with organ failure","grade":"A"},{"text":"IV piperacillin-tazobactam or meropenem for cholangitis","grade":"A"},{"text":"MRCP for intermediate probability CBD stones (ASGE criteria)","grade":"A"},{"text":"Laparoscopic cholecystectomy within same admission or within 2 weeks after ERCP","grade":"B"}]',
 'A', 'hepatobiliary'),

-- GORD
('{K21.0,K21.9}', 'Gastro-oesophageal Reflux Disease', 'NICE NG104 / ACG 2022',
 'Diagnosis and Management of GORD',
 'Trial of PPI before endoscopy for typical symptoms without alarm features. OGD for dysphagia, weight loss, GI bleeding, age > 55 with new dyspepsia. Long-term PPI at lowest effective dose. Anti-reflux surgery (fundoplication) for refractory symptoms with proven reflux.',
 '[{"text":"8-week PPI trial for typical reflux symptoms without alarm features","grade":"A"},{"text":"OGD mandatory for dysphagia, odynophagia, GI bleeding, weight loss, or age > 55 with new onset","grade":"A"},{"text":"24h pH/impedance study before considering surgery","grade":"A"},{"text":"Laparoscopic fundoplication for PPI-refractory GORD with proven acid exposure","grade":"B"},{"text":"Step-down to lowest effective PPI dose for long-term maintenance","grade":"B"}]',
 'A', 'upper_gi'),

-- Colorectal Cancer
('{C18.9,C19,C20}', 'Colorectal Cancer', 'NICE NG151 / ASCRS 2022',
 'Colorectal Cancer: Diagnosis, Staging, and Management',
 'Two-week wait referral for age > 40 with unexplained weight loss + abdominal pain, or age > 50 with unexplained rectal bleeding or change in bowel habit. Staging CT chest-abdomen-pelvis. MRI pelvis for rectal cancer. MDT discussion mandatory.',
 '[{"text":"Urgent 2-week wait colonoscopy for suspected colorectal cancer","grade":"A"},{"text":"CT chest-abdomen-pelvis for staging","grade":"A"},{"text":"MRI pelvis for all rectal cancers (circumferential resection margin assessment)","grade":"A"},{"text":"Neoadjuvant chemoradiotherapy for locally advanced rectal cancer (T3/T4 or N+)","grade":"A"},{"text":"CEA baseline + post-operative surveillance","grade":"A"},{"text":"Right hemicolectomy for caecal/ascending; anterior resection for sigmoid/upper rectum","grade":"B"}]',
 'A', 'colorectal'),

-- Breast Cancer
('{C50.911,C50.919,D05.10}', 'Breast Cancer', 'NICE NG101 / ABS Guidelines',
 'Early and Locally Advanced Breast Cancer: Diagnosis and Management',
 'Triple assessment mandatory for all breast lumps: clinical exam, imaging (mammogram ± USS), and tissue sampling (core biopsy or FNA). MDT discussion before definitive surgery. Sentinel lymph node biopsy for clinically node-negative.',
 '[{"text":"Triple assessment for all palpable breast lumps","grade":"A"},{"text":"Core biopsy preferred over FNA for tissue diagnosis","grade":"A"},{"text":"Breast-conserving surgery + radiotherapy equivalent to mastectomy for early-stage","grade":"A"},{"text":"Sentinel lymph node biopsy for clinically node-negative disease","grade":"A"},{"text":"Adjuvant systemic therapy guided by receptor status (ER, PR, HER2)","grade":"A"},{"text":"Annual mammographic surveillance for 5 years post-treatment","grade":"B"}]',
 'A', 'breast'),

-- Inguinal Hernia
('{K40.90,K40.91,K40.30}', 'Inguinal Hernia', 'EHS 2024 / HerniaSurge',
 'Inguinal Hernia Repair: EHS/HerniaSurge Guidelines',
 'Watchful waiting acceptable for minimally symptomatic inguinal hernias. Surgery indicated for symptomatic hernias or femoral hernias (higher strangulation risk). Mesh repair standard — Lichtenstein or laparoscopic (TEP/TAPP). Emergency surgery for incarcerated/strangulated.',
 '[{"text":"Mesh repair is standard of care — reduces recurrence vs suture repair","grade":"A"},{"text":"Watchful waiting acceptable for asymptomatic or minimally symptomatic inguinal hernias in men","grade":"A"},{"text":"Femoral hernias always require surgical repair (high strangulation risk)","grade":"A"},{"text":"Laparoscopic TEP/TAPP preferred for bilateral and recurrent hernias","grade":"A"},{"text":"Emergency surgery for incarcerated/strangulated hernia — assess bowel viability","grade":"A"}]',
 'A', 'general_surgery'),

-- Thyroid Nodules
('{E04.1,E04.2,C73}', 'Thyroid Nodules', 'ATA 2015 / BTA 2014',
 'Evaluation and Management of Thyroid Nodules',
 'USS with Thy/TIRADS classification. FNA for nodules > 1 cm with suspicious features (TIRADS 4-5). Bethesda classification guides management. Diagnostic lobectomy for Bethesda III-IV. Total thyroidectomy for confirmed malignancy > 1 cm.',
 '[{"text":"USS with TIRADS classification for all palpable thyroid nodules","grade":"A"},{"text":"FNA biopsy for TIRADS 4-5 nodules > 1 cm, TIRADS 3 > 1.5 cm","grade":"A"},{"text":"Check TSH — if suppressed, thyroid scintigraphy before FNA","grade":"A"},{"text":"Diagnostic lobectomy for Bethesda III (AUS/FLUS) or IV (follicular neoplasm)","grade":"B"},{"text":"Total thyroidectomy for confirmed PTC > 1 cm or any FTC","grade":"A"}]',
 'A', 'endocrine'),

-- Peptic Ulcer Disease
('{K25.9,K26.9,K27.4}', 'Peptic Ulcer Disease', 'ACG 2017 / NICE',
 'Diagnosis and Management of Peptic Ulcer Disease',
 'OGD for diagnosis — biopsy for H. pylori and rule out malignancy in gastric ulcers. H. pylori eradication: triple therapy (PPI + amoxicillin + clarithromycin) 14 days. PPI maintenance for NSAID-related ulcers. Repeat OGD at 6-8 weeks for gastric ulcers to confirm healing.',
 '[{"text":"OGD with biopsy for all gastric ulcers (rule out malignancy)","grade":"A"},{"text":"H. pylori eradication: PPI + amoxicillin + clarithromycin × 14 days","grade":"A"},{"text":"Repeat OGD at 6-8 weeks for gastric ulcers to confirm healing and repeat biopsy","grade":"A"},{"text":"PPI co-prescription for patients on long-term NSAIDs/aspirin with ulcer history","grade":"A"},{"text":"Emergency OGD within 24h for acute upper GI bleed (Glasgow-Blatchford ≥ 1)","grade":"A"}]',
 'A', 'upper_gi'),

-- Diverticular Disease
('{K57.30,K57.32,K57.92}', 'Diverticular Disease', 'ASCRS 2020 / WSES 2020',
 'Diagnosis and Management of Acute Diverticulitis',
 'CT abdomen/pelvis with IV contrast for diagnosis and Hinchey staging. Uncomplicated: outpatient antibiotics (ciprofloxacin + metronidazole) or observation alone. Complicated (abscess > 3 cm): percutaneous drainage. Purulent/faecal peritonitis: emergency surgery.',
 '[{"text":"CT abdomen/pelvis for diagnosis and Hinchey classification","grade":"A"},{"text":"Uncomplicated diverticulitis: oral antibiotics as outpatient OR observation alone","grade":"A"},{"text":"Percutaneous drainage for Hinchey Ib/II abscess > 3 cm","grade":"B"},{"text":"Emergency surgery (Hartmann or primary anastomosis ± diverting stoma) for Hinchey III/IV","grade":"A"},{"text":"Elective sigmoid colectomy after 2+ episodes no longer mandatory — individualise","grade":"B"},{"text":"Colonoscopy 6-8 weeks after resolution to exclude malignancy","grade":"B"}]',
 'A', 'colorectal'),

-- Haemorrhoids
('{K64.0,K64.1,K64.8}', 'Haemorrhoids', 'ASCRS 2018',
 'Management of Haemorrhoids',
 'Grade I-II: conservative (fibre, fluids, topical therapy). Grade II-III: rubber band ligation in clinic. Grade III-IV symptomatic: surgical haemorrhoidectomy (Milligan-Morgan or stapled). Thrombosed external: excision within 72h or conservative if > 72h.',
 '[{"text":"High-fibre diet + adequate hydration as first-line for all grades","grade":"A"},{"text":"Rubber band ligation for Grade II-III internal haemorrhoids","grade":"A"},{"text":"Excisional haemorrhoidectomy for Grade III-IV refractory to banding","grade":"A"},{"text":"Excision of thrombosed external haemorrhoid within 72h of onset","grade":"B"},{"text":"Exclude colorectal malignancy in patients > 50 with rectal bleeding","grade":"A"}]',
 'A', 'colorectal'),

-- Gallstone Pancreatitis
('{K85.10,K85.11}', 'Gallstone Pancreatitis', 'IAP/APA 2013 / NICE',
 'Acute Gallstone Pancreatitis: Assessment and Management',
 'Assess severity: APACHE II, Ranson, or BISAP within 48h. Mild pancreatitis: early oral feeding, laparoscopic cholecystectomy during same admission. Severe pancreatitis: ICU, aggressive fluid resuscitation, CT at 72h for necrosis. ERCP only if concurrent cholangitis or persistent CBD obstruction.',
 '[{"text":"Index-admission cholecystectomy for mild gallstone pancreatitis","grade":"A"},{"text":"ERCP within 24h only if concurrent cholangitis or persistent biliary obstruction","grade":"A"},{"text":"CT abdomen at 72-96h for severe pancreatitis (assess necrosis)","grade":"B"},{"text":"Enteral nutrition preferred over TPN in severe pancreatitis","grade":"A"},{"text":"Delayed cholecystectomy (6-8 weeks) for severe pancreatitis with necrosis","grade":"B"},{"text":"Infected necrosis: step-up approach (drainage → video-assisted debridement)","grade":"A"}]',
 'A', 'hepatobiliary'),

-- DVT Prophylaxis in Surgery
('{I82.409,I26.99}', 'VTE Prophylaxis in Surgery', 'NICE NG89 / ASH 2019',
 'Venous Thromboembolism Prophylaxis in Surgical Patients',
 'Assess VTE risk for all surgical patients (Caprini score). Mechanical prophylaxis (TED stockings + IPC) for all. LMWH (enoxaparin 40 mg SC daily) for moderate-high risk. Extended prophylaxis (28 days) for major abdominal/pelvic cancer surgery.',
 '[{"text":"Assess VTE risk pre-operatively using Caprini or department protocol","grade":"A"},{"text":"Mechanical prophylaxis (TED + IPC) for all surgical patients","grade":"A"},{"text":"LMWH for moderate-high risk patients (Caprini ≥ 3)","grade":"A"},{"text":"Extended LMWH prophylaxis × 28 days for major cancer surgery","grade":"A"},{"text":"Hold LMWH 12h pre-operatively; resume 6-12h post-operatively if haemostasis secured","grade":"B"}]',
 'A', 'general_surgery'),

-- Diabetic Foot
('{E11.621,E11.622,L97.509}', 'Diabetic Foot Ulcer', 'NICE NG19 / IWGDF 2023',
 'Diabetic Foot: Assessment and Management',
 'Multidisciplinary foot team within 24h for new ulcer. Classify using Wagner or University of Texas. Offloading is the single most important intervention. Vascular assessment (ABPI/duplex) for all. Antibiotics only for clinically infected ulcers (IDSA classification).',
 '[{"text":"MDT assessment within 24h of presentation","grade":"A"},{"text":"Offloading (total contact cast or irremovable walker) for neuropathic plantar ulcers","grade":"A"},{"text":"Vascular assessment (ABPI + duplex) for all diabetic foot ulcers","grade":"A"},{"text":"Antibiotics only for clinically infected ulcers — do not treat colonisation","grade":"A"},{"text":"Urgent vascular referral if ABPI < 0.5 or absent pedal pulses with critical ischaemia","grade":"A"},{"text":"Amputation: preserve maximum length; ray amputation preferred over transmetatarsal if feasible","grade":"B"}]',
 'A', 'vascular')

on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- DRUG FORMULARY SEED (stored as a Supabase function for
-- client-side access without a separate table)
-- This provides the prescription autocomplete list.
-- ─────────────────────────────────────────────────────────────
-- The formulary is implemented client-side in the dashboard
-- (see prescription-formulary.ts) rather than as a DB table,
-- because it's static reference data that doesn't need RLS
-- or per-patient storage.

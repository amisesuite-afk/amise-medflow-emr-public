# MedFlow Caribbean — Database Schema (PostgreSQL / Supabase)

## Core Tables

### users & roles
```sql
create table public.user_profiles (
  id          uuid primary key references auth.users(id),
  full_name   text not null,
  role        text not null check (role in ('surgeon','nurse','front_desk','billing','admin')),
  site        text,                        -- rodney_bay | tapion
  phone       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table public.audit_logs (
  id          bigserial primary key,
  user_id     uuid references public.user_profiles(id),
  action      text not null,              -- read | create | update | delete | sign | export
  table_name  text not null,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  created_at  timestamptz default now()
);
```

### patients
```sql
create table public.patients (
  id                uuid primary key default gen_random_uuid(),
  mrn               text unique not null,  -- Medical Record Number
  first_name        text not null,
  last_name         text not null,
  date_of_birth     date not null,
  sex               text check (sex in ('male','female','other')),
  phone             text,
  email             text,
  address           text,
  nationality       text,
  insurance_provider text,
  insurance_number   text,
  emergency_name    text,
  emergency_phone   text,
  emergency_relation text,
  blood_type        text,
  created_by        uuid references public.user_profiles(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
```

### appointments
```sql
create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients(id),
  appointment_type text not null,         -- clinic | surgery | endoscopy | ercp | breast
  site             text not null,
  scheduled_at     timestamptz not null,
  duration_minutes int default 30,
  status           text default 'scheduled'
                   check (status in ('scheduled','confirmed','arrived','in_progress','completed','cancelled','no_show')),
  reason           text,
  referring_doctor text,
  google_event_id  text,
  whatsapp_sent    boolean default false,
  reminder_sent    boolean default false,
  booked_by        uuid references public.user_profiles(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
```

### encounters (clinical visits)
```sql
create table public.encounters (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients(id),
  appointment_id  uuid references public.appointments(id),
  encounter_type  text not null,
  site            text not null,
  encounter_date  timestamptz not null,
  status          text default 'open' check (status in ('open','signed','amended')),
  -- Vitals
  weight_kg       numeric(5,2),
  height_cm       numeric(5,2),
  bp_systolic     int,
  bp_diastolic    int,
  heart_rate      int,
  temp_celsius    numeric(4,1),
  o2_sat          int,
  -- SOAP
  subjective      text,
  objective       text,
  assessment      text,
  plan            text,
  ai_draft        jsonb,                  -- raw AI suggestion before physician edit
  signed_by       uuid references public.user_profiles(id),
  signed_at       timestamptz,
  created_by      uuid references public.user_profiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

### clinical records
```sql
create table public.diagnoses (
  id           uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id),
  patient_id   uuid not null references public.patients(id),
  icd10_code   text,
  description  text not null,
  type         text check (type in ('primary','secondary','chronic')),
  onset_date   date,
  resolved_date date,
  created_by   uuid references public.user_profiles(id),
  created_at   timestamptz default now()
);

create table public.medications (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id),
  encounter_id  uuid references public.encounters(id),
  name          text not null,
  dose          text,
  frequency     text,
  route         text,
  start_date    date,
  end_date      date,
  status        text default 'active' check (status in ('active','discontinued','completed')),
  prescribed_by uuid references public.user_profiles(id),
  created_at    timestamptz default now()
);

create table public.allergies (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id),
  allergen     text not null,
  reaction     text,
  severity     text check (severity in ('mild','moderate','severe','life_threatening')),
  created_by   uuid references public.user_profiles(id),
  created_at   timestamptz default now()
);
```

### procedures & endoscopy
```sql
create table public.procedures (
  id              uuid primary key default gen_random_uuid(),
  encounter_id    uuid not null references public.encounters(id),
  patient_id      uuid not null references public.patients(id),
  procedure_type  text not null,
  cpt_code        text,
  site            text,
  performed_at    timestamptz,
  duration_minutes int,
  anaesthesia     text,
  findings        text,
  complications   text,
  outcome         text,
  performed_by    uuid references public.user_profiles(id),
  signed_at       timestamptz,
  created_at      timestamptz default now()
);

create table public.endoscopy_reports (
  id              uuid primary key default gen_random_uuid(),
  procedure_id    uuid not null references public.procedures(id),
  patient_id      uuid not null references public.patients(id),
  scope_type      text check (scope_type in ('ogd','colonoscopy','ercp','flexible_sig')),
  indication      text,
  prep_quality    text,
  extent_reached  text,
  findings        jsonb,              -- structured: polyps, ulcers, varices, etc.
  biopsies_taken  boolean default false,
  biopsy_sites    text[],
  images          text[],             -- Supabase Storage URLs
  recommendations text,
  ai_draft        jsonb,
  signed_by       uuid references public.user_profiles(id),
  signed_at       timestamptz,
  created_at      timestamptz default now()
);

create table public.ercp_registry (
  id                  uuid primary key default gen_random_uuid(),
  endoscopy_report_id uuid references public.endoscopy_reports(id),
  patient_id          uuid not null references public.patients(id),
  indication          text,
  cbd_dilation        boolean,
  stones_extracted    boolean,
  stent_placed        boolean,
  stent_type          text,
  sphincterotomy      boolean,
  contrast_used       text,
  fluoroscopy_time_s  int,
  radiation_dose_mgy  numeric,
  complications       text,
  outcome             text,
  created_at          timestamptz default now()
);
```

### billing
```sql
create table public.billing_invoices (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.patients(id),
  encounter_id   uuid references public.encounters(id),
  invoice_number text unique not null,
  status         text default 'draft'
                 check (status in ('draft','sent','partial','paid','cancelled','overdue')),
  subtotal_xcd   numeric(10,2) not null,
  tax_xcd        numeric(10,2) default 0,
  total_xcd      numeric(10,2) not null,
  insurance_claim boolean default false,
  insurer_name   text,
  claim_number   text,
  claim_status   text,
  notes          text,
  issued_at      timestamptz,
  due_at         timestamptz,
  created_by     uuid references public.user_profiles(id),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table public.billing_line_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.billing_invoices(id) on delete cascade,
  description  text not null,
  cpt_code     text,
  quantity     int default 1,
  unit_price   numeric(10,2) not null,
  total        numeric(10,2) generated always as (quantity * unit_price) stored
);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.billing_invoices(id),
  amount_xcd   numeric(10,2) not null,
  method       text check (method in ('cash','card','bank_transfer','insurance','cheque')),
  reference    text,
  received_at  timestamptz default now(),
  recorded_by  uuid references public.user_profiles(id)
);
```

### labs & imaging
```sql
create table public.lab_orders (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id),
  encounter_id uuid references public.encounters(id),
  tests        text[] not null,
  urgency      text default 'routine' check (urgency in ('routine','urgent','stat')),
  status       text default 'ordered',
  results      jsonb,
  result_date  timestamptz,
  ordered_by   uuid references public.user_profiles(id),
  created_at   timestamptz default now()
);

create table public.imaging_studies (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id),
  encounter_id  uuid references public.encounters(id),
  modality      text,                -- xray | us | ct | mri | mammogram
  body_part     text,
  indication    text,
  report        text,
  images        text[],              -- Supabase Storage URLs
  radiologist   text,
  study_date    date,
  ordered_by    uuid references public.user_profiles(id),
  created_at    timestamptz default now()
);
```

---

## RLS Policy Pattern (applied to every patient table)

```sql
-- Enable RLS
alter table public.patients enable row level security;

-- Surgeon: full access
create policy "surgeon_full" on public.patients
  for all using (
    exists (select 1 from public.user_profiles
            where id = auth.uid() and role = 'surgeon')
  );

-- Nurse: read + update (no delete)
create policy "nurse_read_update" on public.patients
  for select using (
    exists (select 1 from public.user_profiles
            where id = auth.uid() and role = 'nurse')
  );

-- Front desk: demographics only (via view, not direct table)
-- Billing: read only
-- Admin: full (via service role in edge functions only)
```

---

## Indexes

```sql
create index idx_appointments_patient   on public.appointments(patient_id);
create index idx_appointments_scheduled on public.appointments(scheduled_at);
create index idx_encounters_patient     on public.encounters(patient_id);
create index idx_encounters_date        on public.encounters(encounter_date);
create index idx_audit_logs_user        on public.audit_logs(user_id);
create index idx_audit_logs_created     on public.audit_logs(created_at desc);
create index idx_patients_mrn           on public.patients(mrn);
create index idx_patients_name          on public.patients using gin(
  to_tsvector('english', first_name || ' ' || last_name)
);
```

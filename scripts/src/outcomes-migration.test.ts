/**
 * Migration 94 (supabase-outcomes-calibration-migration.sql) — behaviour on an in-process
 * Postgres (PGlite, the same stand-ins as check:migrations-fresh):
 *   - nurse / doctor / admin read and write; front desk and a user with no staff profile see
 *     nothing and cannot insert;
 *   - snapshots are write-once for clients (no UPDATE grant);
 *   - a final diagnosis is immutable except for retraction; one confirmed row per encounter;
 *   - CHECK constraints refuse free text in code columns.
 */
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SUPABASE_STANDINS } from './check-migrations-fresh';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const sql = (f: string) => readFileSync(join(REPO_ROOT, f), 'utf8');

const USERS = {
  front_desk: '00000000-0000-4000-8000-000000000001',
  nurse: '00000000-0000-4000-8000-000000000002',
  doctor: '00000000-0000-4000-8000-000000000003',
  admin: '00000000-0000-4000-8000-000000000004',
  portal: '00000000-0000-4000-8000-000000000005',
} as const;
const PATIENT = '10000000-0000-4000-8000-000000000001';

let db: PGlite;

async function as<T>(user: keyof typeof USERS, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${USERS[user]}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

const snapshotInsert = (ref: string, extra = '') => `
  insert into public.prediction_snapshots
    (patient_id, encounter_ref, platform, completed_at, differential_engine, differential_model_version,
     top_differential, triage_level, triage_scale ${extra ? ', ' + extra.split('=')[0] : ''})
  values ('${PATIENT}', '${ref}', 'web', now(), 'pane', '1.0.1',
          '[{"rank":1,"diseaseId":"acute_appendicitis","icd10":"K35.80","probability":0.7}]', 'priority', 'web-adaptive'
          ${extra ? ', ' + extra.split('=').slice(1).join('=') : ''})`;

const outcomeInsert = (ref: string, icd = 'K35.80', client = '') => `
  insert into public.diagnosis_outcomes (patient_id, encounter_ref, final_icd10, source_type, source_date${client ? ', client_ref' : ''})
  values ('${PATIENT}', '${ref}', '${icd}', 'histology', current_date${client ? `, '${client}'` : ''})`;

beforeAll(async () => {
  db = new PGlite({ extensions: { uuid_ossp, pgcrypto, pg_trgm } });
  await db.exec(SUPABASE_STANDINS);
  await db.exec(sql('supabase-schema.sql'));
  await db.exec(sql('supabase-outcomes-calibration-migration.sql'));
  // Idempotent: a second run is a no-op.
  await db.exec(sql('supabase-outcomes-calibration-migration.sql'));
  for (const [role, id] of Object.entries(USERS)) {
    await db.exec(`insert into auth.users (id, email) values ('${id}', '${role}@example.test')`);
    if (role !== 'portal') {
      await db.exec(`insert into public.user_profiles (id, role) values ('${id}', '${role}')
                     on conflict (id) do update set role = excluded.role`);
    } else {
      await db.exec(`delete from public.user_profiles where id = '${id}'`);
    }
  }
  await db.exec(`insert into public.patients (id, full_name) values ('${PATIENT}', 'Test Patient')`);
}, 60_000);

afterAll(async () => { await db?.close(); });

describe('Migration 94 — roles', () => {
  it('a doctor inserts and reads a snapshot', async () => {
    await as('doctor', () => db.exec(snapshotInsert('web:11111111-1111-4111-8111-111111111111')));
    const rows = await as('nurse', () => db.query('select encounter_ref from public.prediction_snapshots'));
    expect(rows.rows).toHaveLength(1);
  });

  it('front desk and a portal patient see nothing and cannot insert', async () => {
    for (const who of ['front_desk', 'portal'] as const) {
      const rows = await as(who, () => db.query('select 1 from public.prediction_snapshots'));
      expect(rows.rows).toHaveLength(0);
      await expect(as(who, () => db.exec(snapshotInsert(`web:2222222${who === 'portal' ? '3' : '2'}-2222-4222-8222-222222222222`))))
        .rejects.toThrow(/row-level security/);
      await expect(as(who, () => db.exec(outcomeInsert('web:11111111-1111-4111-8111-111111111111'))))
        .rejects.toThrow(/row-level security/);
    }
  });

  it('snapshots are write-once: first completion wins, and clients cannot update them', async () => {
    await expect(as('doctor', () => db.exec(snapshotInsert('web:11111111-1111-4111-8111-111111111111'))))
      .rejects.toThrow(/duplicate key/);
    await expect(as('admin', () => db.exec(`update public.prediction_snapshots set triage_level = 'urgent'`)))
      .rejects.toThrow(/permission denied/);
    await expect(as('admin', () => db.exec(`delete from public.prediction_snapshots`)))
      .rejects.toThrow(/permission denied/);
  });
});

describe('Migration 94 — final diagnoses', () => {
  const ref = 'web:11111111-1111-4111-8111-111111111111';

  it('one confirmed final diagnosis per encounter; client_ref makes a retry idempotent', async () => {
    await as('nurse', () => db.exec(outcomeInsert(ref, 'K35.80', 'web:aaaaaaaa-0000-4000-8000-000000000001')));
    await expect(as('doctor', () => db.exec(outcomeInsert(ref, 'K35.2'))))
      .rejects.toThrow(/duplicate key/);
    await expect(as('doctor', () => db.exec(outcomeInsert('web:99999999-1111-4111-8111-111111111111', 'K35.2', 'web:aaaaaaaa-0000-4000-8000-000000000001'))))
      .rejects.toThrow(/duplicate key/);
  });

  it('is immutable except for retraction, and a retracted row stays retracted', async () => {
    await expect(as('doctor', () => db.exec(`update public.diagnosis_outcomes set final_icd10 = 'K81.0'`)))
      .rejects.toThrow(/immutable/);
    await as('doctor', () => db.exec(`update public.diagnosis_outcomes set status = 'retracted', retracted_at = now(), retracted_by = '${USERS.doctor}'`));
    await expect(as('doctor', () => db.exec(`update public.diagnosis_outcomes set status = 'confirmed', retracted_at = null`)))
      .rejects.toThrow(/cannot be confirmed again/);
    // After the retraction a corrected row can be confirmed.
    await as('doctor', () => db.exec(outcomeInsert(ref, 'K35.2')));
    const rows = await db.query<{ status: string }>(`select status from public.diagnosis_outcomes where encounter_ref = '${ref}' order by created_at`);
    expect(rows.rows.map(r => r.status).sort()).toEqual(['confirmed', 'retracted']);
  });

  it('CHECK constraints refuse free text and unknown values in coded columns', async () => {
    await expect(db.exec(outcomeInsert('web:33333333-1111-4111-8111-111111111111', 'appendicitis'))).rejects.toThrow(/codes_check/);
    await expect(db.exec(`
      insert into public.diagnosis_outcomes (patient_id, encounter_ref, final_icd10, source_type, source_date)
      values ('${PATIENT}', 'web:44444444-1111-4111-8111-111111111111', 'K35.80', 'hunch', current_date)`)).rejects.toThrow(/source_check/);
    await expect(db.exec(snapshotInsert('web:55555555-1111-4111-8111-111111111111', `working_disease_id='Acute appendicitis'`)))
      .rejects.toThrow(/codes_check/);
    await expect(db.exec(snapshotInsert('ios:66666666-1111-4111-8111-111111111111'))).rejects.toThrow(/ref_check/);
    await expect(db.exec(snapshotInsert('web:77777777-1111-4111-8111-111111111111', `outcome_triggers='{biopsy_text}'`)))
      .rejects.toThrow(/codes_check/);
  });
});

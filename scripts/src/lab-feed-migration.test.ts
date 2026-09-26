/**
 * Migration 96 (supabase-lab-feed-migration.sql) on an in-process Postgres (PGlite, the same
 * stand-ins as check:migrations-fresh):
 *   - the seeded default ranges equal DEFAULT_REFERENCE_RANGES in the code;
 *   - every staff role reads ranges; only admin writes them, never a "default" row, never DELETE;
 *   - the lab-feed log and the reconciliation queue: nurse / doctor / admin read, front desk and
 *     portal users see nothing, no client writes;
 *   - CHECK constraints and the one-report-once unique index.
 */
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_REFERENCE_RANGES, rowToReferenceRange } from '../../lib/triage-engine/src/reference-ranges';
import type { ReferenceRangeRow } from '../../lib/triage-engine/src/reference-ranges';
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
const MESSAGE = '20000000-0000-4000-8000-000000000001';
const HASH = 'a'.repeat(64);

let db: PGlite;

async function as<T>(user: keyof typeof USERS, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${USERS[user]}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

const practiceRange = (analyte = 'Lipase', upper = 73) => `
  insert into public.lab_reference_ranges (analyte, unit, sex, age_min_years, upper_limit, lab_source, effective_from)
  values ('${analyte}', 'U/L', 'any', 18, ${upper}, 'Laboratory Services Ltd, 2026 handbook', date '2026-10-01')`;

beforeAll(async () => {
  db = new PGlite({ extensions: { uuid_ossp, pgcrypto, pg_trgm } });
  await db.exec(SUPABASE_STANDINS);
  await db.exec(sql('supabase-schema.sql'));
  await db.exec(sql('supabase-clinical-records-migration.sql'));
  await db.exec(sql('supabase-lab-feed-migration.sql'));
  // Idempotent: a second run is a no-op (no duplicate seed rows).
  await db.exec(sql('supabase-lab-feed-migration.sql'));
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
  await db.exec(`insert into public.lab_feed_messages (id, lab_id, message_id, format, status, body_sha256)
                 values ('${MESSAGE}', 'slulab', 'MSG0001', 'hl7v2', 'queued', '${HASH}')`);
  await db.exec(`insert into public.lab_results_to_reconcile (message_id, lab_id, report_ref, reason, received_mrn, test_name)
                 values ('${MESSAGE}', 'slulab', 'slulab:R1:F:20260926', 'mrn_not_found', 'AM-000999', 'Renal profile')`);
}, 60_000);

afterAll(async () => { await db?.close(); });

describe('Migration 96 — seeded default ranges', () => {
  it('equal DEFAULT_REFERENCE_RANGES in lib/triage-engine/src/reference-ranges.ts', async () => {
    const res = await db.query<ReferenceRangeRow & { is_default: boolean }>(
      `select * from public.lab_reference_ranges where is_default order by analyte, sex`);
    expect(res.rows).toHaveLength(DEFAULT_REFERENCE_RANGES.length);
    const key = (r: { analyte: string; sex: string }) => `${r.analyte}|${r.sex}`;
    const byKey = new Map(DEFAULT_REFERENCE_RANGES.map(r => [key(r), r]));
    for (const row of res.rows) {
      const parsed = rowToReferenceRange(row);
      expect(parsed, key(row)).not.toBeNull();
      const code = byKey.get(key(row));
      expect(code, key(row)).toBeDefined();
      expect(parsed).toEqual(code);
    }
  });
});

describe('Migration 96 — reference-range access', () => {
  it('every staff role reads ranges; a portal user sees none', async () => {
    for (const who of ['front_desk', 'nurse', 'doctor', 'admin'] as const) {
      const rows = await as(who, () => db.query('select 1 from public.lab_reference_ranges'));
      expect(rows.rows.length, who).toBe(DEFAULT_REFERENCE_RANGES.length);
    }
    const portal = await as('portal', () => db.query('select 1 from public.lab_reference_ranges'));
    expect(portal.rows).toHaveLength(0);
  });

  it('only admin adds a practice range; nobody adds a "default" row or deletes', async () => {
    for (const who of ['front_desk', 'nurse', 'doctor'] as const) {
      await expect(as(who, () => db.exec(practiceRange()))).rejects.toThrow(/row-level security/);
    }
    await as('admin', () => db.exec(practiceRange()));
    await expect(as('admin', () => db.exec(`
      insert into public.lab_reference_ranges (analyte, unit, sex, upper_limit, lab_source, effective_from, is_default)
      values ('Amylase', 'U/L', 'any', 90, 'default — replace with your laboratory''s ranges', date '2026-10-01', true)`)))
      .rejects.toThrow(/row-level security/);
    await expect(as('admin', () => db.exec(`delete from public.lab_reference_ranges`))).rejects.toThrow(/permission denied/);
    await as('admin', () => db.exec(`update public.lab_reference_ranges set retired_at = now(), retired_by = '${USERS.admin}' where analyte = 'Lipase' and not is_default`));
  });

  it('refuses impossible limits and a practice row that claims to be the default', async () => {
    await expect(db.exec(`insert into public.lab_reference_ranges (analyte, unit, sex, lower_limit, upper_limit, lab_source, effective_from)
                          values ('Sodium', 'mmol/L', 'any', 150, 140, 'Lab', date '2026-10-01')`)).rejects.toThrow(/limits_check/);
    await expect(db.exec(`insert into public.lab_reference_ranges (analyte, unit, sex, upper_limit, critical_high, lab_source, effective_from)
                          values ('Potassium', 'mmol/L', 'any', 5.3, 5.0, 'Lab', date '2026-10-01')`)).rejects.toThrow(/limits_check/);
    await expect(db.exec(`insert into public.lab_reference_ranges (analyte, unit, sex, upper_limit, lab_source, effective_from)
                          values ('Lipase', 'U/L', 'any', 60, 'default — replace with your laboratory''s ranges', date '2026-10-01')`))
      .rejects.toThrow(/default_check/);
    await expect(db.exec(`insert into public.lab_reference_ranges (analyte, unit, sex, upper_limit, lab_source, effective_from)
                          values ('Lipase', 'U/L', 'unknown', 60, 'Lab', date '2026-10-01')`)).rejects.toThrow(/shape_check/);
  });
});

describe('Migration 96 — lab-feed log and reconciliation queue', () => {
  it('nurse, doctor and admin read; front desk and portal users see nothing', async () => {
    for (const who of ['nurse', 'doctor', 'admin'] as const) {
      expect((await as(who, () => db.query('select 1 from public.lab_feed_messages'))).rows, who).toHaveLength(1);
      expect((await as(who, () => db.query('select 1 from public.lab_results_to_reconcile'))).rows, who).toHaveLength(1);
    }
    for (const who of ['front_desk', 'portal'] as const) {
      expect((await as(who, () => db.query('select 1 from public.lab_feed_messages'))).rows, who).toHaveLength(0);
      expect((await as(who, () => db.query('select 1 from public.lab_results_to_reconcile'))).rows, who).toHaveLength(0);
    }
  });

  it('clients cannot write the log or the queue (only the service role does)', async () => {
    await expect(as('admin', () => db.exec(`insert into public.lab_feed_messages (lab_id, message_id, format, body_sha256)
                                            values ('slulab', 'X', 'hl7v2', '${HASH}')`))).rejects.toThrow(/permission denied/);
    await expect(as('doctor', () => db.exec(`update public.lab_results_to_reconcile set status = 'dismissed'`))).rejects.toThrow(/permission denied/);
  });

  it('a message id is logged once per laboratory; a report is queued once', async () => {
    await expect(db.exec(`insert into public.lab_feed_messages (lab_id, message_id, format, body_sha256)
                          values ('slulab', 'MSG0001', 'hl7v2', '${HASH}')`)).rejects.toThrow(/duplicate key/);
    await db.exec(`insert into public.lab_feed_messages (lab_id, message_id, format, body_sha256)
                   values ('otherlab', 'MSG0001', 'fhir-r4', '${HASH}')`);
    await expect(db.exec(`insert into public.lab_results_to_reconcile (message_id, lab_id, report_ref, reason, test_name)
                          values ('${MESSAGE}', 'slulab', 'slulab:R1:F:20260926', 'mrn_not_found', 'Renal profile')`)).rejects.toThrow(/duplicate key/);
  });

  it('CHECKs: lab id, status, dismissal needs a note, a match needs the patient and result', async () => {
    await expect(db.exec(`insert into public.lab_feed_messages (lab_id, message_id, format, body_sha256)
                          values ('SLU Lab!', 'M2', 'hl7v2', '${HASH}')`)).rejects.toThrow(/shape_check/);
    await expect(db.exec(`insert into public.lab_feed_messages (lab_id, message_id, format, body_sha256, status)
                          values ('slulab', 'M3', 'hl7v2', '${HASH}', 'lost')`)).rejects.toThrow(/shape_check/);
    await expect(db.exec(`update public.lab_results_to_reconcile set status = 'dismissed', resolved_at = now()`)).rejects.toThrow(/status_check/);
    await expect(db.exec(`update public.lab_results_to_reconcile set status = 'matched', resolved_at = now()`)).rejects.toThrow(/status_check/);
    await db.exec(`update public.lab_results_to_reconcile set status = 'dismissed', resolved_at = now(), resolution_note = 'Not a patient of this practice'`);
  });

  it('investigation_results: a lab report is attached once; lab_report_ref only with source lab-feed', async () => {
    const ins = (ref: string, source = 'lab-feed') => `
      insert into public.investigation_results (patient_id, test_name, status, source, lab_feed_message_id, lab_report_ref)
      values ('${PATIENT}', 'Renal profile', 'resulted', '${source}', '${MESSAGE}', '${ref}')`;
    await db.exec(ins('slulab:R2:F:20260926'));
    await expect(db.exec(ins('slulab:R2:F:20260926'))).rejects.toThrow(/duplicate key/);
    await expect(db.exec(ins('slulab:R3:F:20260926', 'report-import'))).rejects.toThrow(/source_check/);
  });
});

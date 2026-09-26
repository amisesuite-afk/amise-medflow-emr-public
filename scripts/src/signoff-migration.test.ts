/**
 * Migration 95 (supabase-clinical-signoffs-migration.sql) — behaviour on an in-process Postgres
 * (PGlite, the same stand-ins as check:migrations-fresh):
 *   - doctor / admin insert, and only as themselves with their own role; nurse reads only;
 *     front desk and a user with no staff profile see nothing and cannot insert;
 *   - rows are append-only for every caller (UPDATE / DELETE / TRUNCATE refused);
 *   - decided_at is the server clock; CHECK constraints refuse malformed rows.
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
const MIGRATION = 'supabase-clinical-signoffs-migration.sql';

const USERS = {
  front_desk: '00000000-0000-4000-8000-000000000001',
  nurse: '00000000-0000-4000-8000-000000000002',
  doctor: '00000000-0000-4000-8000-000000000003',
  admin: '00000000-0000-4000-8000-000000000004',
  portal: '00000000-0000-4000-8000-000000000005',
} as const;
type Who = keyof typeof USERS;

let db: PGlite;

async function as<T>(user: Who, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${USERS[user]}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

function insert(opts: {
  reviewer: Who; role?: string; item?: string; decision?: string; amendment?: string | null;
  attested?: boolean; hash?: string; clientRef?: string; decidedAt?: string;
}): string {
  const q = (v: string | null | undefined) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);
  return `
    insert into public.clinical_signoffs
      (item_id, item_hash, decision, amendment, attested, reviewer_user_id, reviewer_name, reviewer_role,
       rule_set_ids, client_ref${opts.decidedAt ? ', decided_at' : ''})
    values (${q(opts.item ?? 'fix-web-triage#3')}, ${q(opts.hash ?? '0123456789abcdef')},
            ${q(opts.decision ?? 'approved')}, ${q(opts.amendment ?? null)}, ${opts.attested ?? true},
            '${USERS[opts.reviewer]}', 'Dr Test Reviewer', ${q(opts.role ?? opts.reviewer)},
            '{triage-rules-red-flags,adaptive-triage}', ${q(opts.clientRef ?? null)}
            ${opts.decidedAt ? `, '${opts.decidedAt}'` : ''})`;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { uuid_ossp, pgcrypto, pg_trgm } });
  await db.exec(SUPABASE_STANDINS);
  await db.exec(sql('supabase-schema.sql'));
  await db.exec(sql(MIGRATION));
  // Idempotent: a second run is a no-op.
  await db.exec(sql(MIGRATION));
  for (const [role, id] of Object.entries(USERS)) {
    await db.exec(`insert into auth.users (id, email) values ('${id}', '${role}@example.test')`);
    if (role !== 'portal') {
      await db.exec(`insert into public.user_profiles (id, role) values ('${id}', '${role}')
                     on conflict (id) do update set role = excluded.role`);
    } else {
      await db.exec(`delete from public.user_profiles where id = '${id}'`);
    }
  }
}, 60_000);

afterAll(async () => { await db?.close(); });

describe('Migration 95 — who may record and read', () => {
  it('a doctor and an admin record decisions as themselves', async () => {
    await as('doctor', () => db.exec(insert({ reviewer: 'doctor', clientRef: 'web:doc-1' })));
    await as('admin', () => db.exec(insert({ reviewer: 'admin', item: 'surgeon-decisions#A1', decision: 'deferred' })));
    const rows = await as('doctor', () => db.query('select item_id from public.clinical_signoffs'));
    expect(rows.rows).toHaveLength(2);
  });

  it('a nurse reads but cannot record', async () => {
    const rows = await as('nurse', () => db.query('select 1 from public.clinical_signoffs'));
    expect(rows.rows).toHaveLength(2);
    await expect(as('nurse', () => db.exec(insert({ reviewer: 'nurse', role: 'doctor' }))))
      .rejects.toThrow(/row-level security/);
  });

  it('front desk and a portal patient see nothing and cannot record', async () => {
    for (const who of ['front_desk', 'portal'] as const) {
      const rows = await as(who, () => db.query('select 1 from public.clinical_signoffs'));
      expect(rows.rows).toHaveLength(0);
      await expect(as(who, () => db.exec(insert({ reviewer: who, role: 'doctor' }))))
        .rejects.toThrow(/row-level security/);
    }
  });

  it('a reviewer cannot record in another user\'s name or claim another role', async () => {
    await expect(as('doctor', () => db.exec(insert({ reviewer: 'admin' }))))
      .rejects.toThrow(/row-level security/);
    await expect(as('doctor', () => db.exec(insert({ reviewer: 'doctor', role: 'admin' }))))
      .rejects.toThrow(/row-level security/);
  });
});

describe('Migration 95 — append-only', () => {
  it('refuses UPDATE and DELETE from clients (no grant) and from the service role (trigger)', async () => {
    await expect(as('admin', () => db.exec(`update public.clinical_signoffs set decision = 'rejected'`)))
      .rejects.toThrow(/permission denied/);
    await expect(as('admin', () => db.exec(`delete from public.clinical_signoffs`)))
      .rejects.toThrow(/permission denied/);
    // Superuser / service role: the trigger still refuses.
    await expect(db.exec(`update public.clinical_signoffs set decision = 'rejected'`)).rejects.toThrow(/append-only/);
    await expect(db.exec(`delete from public.clinical_signoffs`)).rejects.toThrow(/append-only/);
    await expect(db.exec(`truncate public.clinical_signoffs`)).rejects.toThrow(/append-only/);
  });

  it('a correction is a new row; the client_ref makes a retry idempotent', async () => {
    await as('doctor', () => db.exec(insert({ reviewer: 'doctor', decision: 'rejected' })));
    await expect(as('doctor', () => db.exec(insert({ reviewer: 'doctor', clientRef: 'web:doc-1' }))))
      .rejects.toThrow(/duplicate key/);
    const rows = await db.query<{ decision: string }>(
      `select decision from public.clinical_signoffs where item_id = 'fix-web-triage#3' order by decided_at`);
    expect(rows.rows.map(r => r.decision)).toEqual(['approved', 'rejected']);
  });

  it('decided_at is the server clock, not the client value', async () => {
    await as('doctor', () => db.exec(insert({ reviewer: 'doctor', item: 'fix-web-triage#4', decidedAt: '2020-01-01T00:00:00Z' })));
    const r = await db.query<{ y: number }>(
      `select extract(year from decided_at)::int as y from public.clinical_signoffs where item_id = 'fix-web-triage#4'`);
    expect(r.rows[0].y).toBeGreaterThan(2020);
  });
});

describe('Migration 95 — CHECK constraints', () => {
  it('requires the attestation, a known decision, a well-formed id and hash', async () => {
    await expect(db.exec(insert({ reviewer: 'doctor', attested: false }))).rejects.toThrow(/attested_check/);
    await expect(db.exec(insert({ reviewer: 'doctor', decision: 'maybe' }))).rejects.toThrow(/decision_check/);
    await expect(db.exec(insert({ reviewer: 'doctor', item: 'Fix Web Triage 3' }))).rejects.toThrow(/item_check/);
    await expect(db.exec(insert({ reviewer: 'doctor', hash: 'xyz' }))).rejects.toThrow(/item_check/);
    await expect(db.exec(insert({ reviewer: 'nurse' }))).rejects.toThrow(/reviewer_check/);
  });

  it('an amendment is required for an amended approval, and only there', async () => {
    await expect(db.exec(insert({ reviewer: 'doctor', decision: 'approved_with_amendment' }))).rejects.toThrow(/decision_check/);
    await expect(db.exec(insert({ reviewer: 'doctor', decision: 'approved', amendment: 'Use 30 mL' }))).rejects.toThrow(/decision_check/);
    await as('doctor', () => db.exec(insert({ reviewer: 'doctor', item: 'fix-web-triage#5', decision: 'approved_with_amendment', amendment: 'Use ≤ 6 weeks postpartum' })));
  });
});

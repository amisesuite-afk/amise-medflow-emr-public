/**
 * Migration 98 (supabase-approved-content-migration.sql) — behaviour on an in-process Postgres
 * (PGlite, the same stand-ins as check:migrations-fresh):
 *   - every staff role reads releases; a portal user / no staff profile sees nothing;
 *   - doctor / admin publish, only as themselves; nurse and front desk cannot;
 *   - append-only except a one-time revocation (by doctor / admin, as themselves); no un-revoke,
 *     no content edit, no DELETE / TRUNCATE for anyone (service role included);
 *   - published_at / revoked_at are the server clock; CHECKs refuse malformed rows (hash shape,
 *     semver, body id / version mismatch, missing sign-off reference);
 *   - a release published with `content:publish` SQL is selected by the web verification.
 */
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { selectForChannel, type ContentRelease, type JsonSchema } from '../../lib/triage-engine/src/approved-content';
import { SUPABASE_STANDINS } from './check-migrations-fresh';
import { buildRelease, releaseInsertSql } from './content-publish';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const sql = (f: string) => readFileSync(join(REPO_ROOT, f), 'utf8');
const MIGRATION = 'supabase-approved-content-migration.sql';

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

const q = (v: string | null) => (v === null ? 'null' : `'${v.replace(/'/g, "''")}'`);

function insert(opts: { by: Who; version: string; body?: Record<string, unknown>; sha?: string; signoff?: string | null; contentId?: string }): string {
  const contentId = opts.contentId ?? 'zebra-rules';
  const body = opts.body ?? { id: contentId, version: opts.version, rules: [] };
  return `insert into public.clinical_content_releases (content_id, version, sha256, body, published_by, signoff_ref)
          values (${q(contentId)}, ${q(opts.version)}, ${q(opts.sha ?? 'a'.repeat(64))}, ${q(JSON.stringify(body))}::jsonb,
                  '${USERS[opts.by]}', ${q(opts.signoff === undefined ? 'diagnostic-reasoning#9 approved 2026-09-26' : opts.signoff)})`;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { uuid_ossp, pgcrypto, pg_trgm } });
  await db.exec(SUPABASE_STANDINS);
  await db.exec(sql('supabase-schema.sql'));
  await db.exec(sql(MIGRATION));
  await db.exec(sql(MIGRATION)); // idempotent
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

describe('Migration 98 — who may publish and read', () => {
  it('a doctor and an admin publish as themselves', async () => {
    await as('doctor', () => db.exec(insert({ by: 'doctor', version: '1.0.1' })));
    await as('admin', () => db.exec(insert({ by: 'admin', version: '1.0.2' })));
    const rows = await as('doctor', () => db.query('select version from public.clinical_content_releases'));
    expect(rows.rows).toHaveLength(2);
  });

  it('every staff role reads; a portal user sees nothing', async () => {
    for (const who of ['front_desk', 'nurse', 'doctor', 'admin'] as const) {
      const rows = await as(who, () => db.query('select 1 from public.clinical_content_releases'));
      expect(rows.rows, who).toHaveLength(2);
    }
    const none = await as('portal', () => db.query('select 1 from public.clinical_content_releases'));
    expect(none.rows).toHaveLength(0);
  });

  it('nurse, front desk and portal cannot publish; nobody publishes in another name', async () => {
    for (const who of ['nurse', 'front_desk', 'portal'] as const) {
      await expect(as(who, () => db.exec(insert({ by: who, version: '1.0.3' })))).rejects.toThrow(/row-level security/);
    }
    await expect(as('doctor', () => db.exec(insert({ by: 'admin', version: '1.0.3' })))).rejects.toThrow(/row-level security/);
  });

  it('a release cannot be published already revoked', async () => {
    await expect(as('doctor', () => db.exec(`
      insert into public.clinical_content_releases (content_id, version, sha256, body, published_by, signoff_ref, revoked_at, revoked_reason)
      values ('zebra-rules', '1.0.9', '${'a'.repeat(64)}', '{"id":"zebra-rules","version":"1.0.9"}'::jsonb, '${USERS.doctor}', 'ref-1', now(), 'no')`)))
      .rejects.toThrow(/revoke it afterwards/);
  });
});

describe('Migration 98 — append-only except revocation', () => {
  it('a doctor revokes as themselves, once; the server stamps the time', async () => {
    await expect(as('nurse', () => db.exec(`update public.clinical_content_releases set revoked_at = now(), revoked_by = '${USERS.nurse}', revoked_reason = 'wrong' where version = '1.0.2'`)))
      .resolves.toBeDefined(); // no policy: 0 rows updated
    const still = await db.query<{ revoked_at: string | null }>(`select revoked_at from public.clinical_content_releases where version = '1.0.2'`);
    expect(still.rows[0].revoked_at).toBeNull();

    await expect(as('doctor', () => db.exec(`update public.clinical_content_releases set revoked_at = now(), revoked_by = '${USERS.admin}', revoked_reason = 'wrong' where version = '1.0.2'`)))
      .rejects.toThrow(/row-level security/);

    await as('doctor', () => db.exec(`update public.clinical_content_releases set revoked_at = '2001-01-01', revoked_by = '${USERS.doctor}', revoked_reason = 'Superseded after review' where version = '1.0.2'`));
    const r = await db.query<{ revoked_at: string }>(`select revoked_at from public.clinical_content_releases where version = '1.0.2'`);
    expect(new Date(r.rows[0].revoked_at).getUTCFullYear()).toBeGreaterThan(2020);

    await expect(as('doctor', () => db.exec(`update public.clinical_content_releases set revoked_at = null, revoked_reason = null, revoked_by = null where version = '1.0.2'`)))
      .rejects.toThrow(/already revoked/);
  });

  it('content columns cannot change, for clients (no grant) or the service role (trigger)', async () => {
    await expect(as('admin', () => db.exec(`update public.clinical_content_releases set body = '{}'::jsonb where version = '1.0.1'`)))
      .rejects.toThrow(/permission denied/);
    await expect(db.exec(`update public.clinical_content_releases set signoff_ref = 'other ref' where version = '1.0.1'`))
      .rejects.toThrow(/append-only/);
    await expect(db.exec(`update public.clinical_content_releases set revoked_reason = 'why' where version = '1.0.1'`))
      .rejects.toThrow(/must revoke|revoke_check/);
  });

  it('DELETE and TRUNCATE are refused for everyone', async () => {
    await expect(as('admin', () => db.exec(`delete from public.clinical_content_releases`))).rejects.toThrow(/permission denied/);
    await expect(db.exec(`delete from public.clinical_content_releases`)).rejects.toThrow(/append-only/);
    await expect(db.exec(`truncate public.clinical_content_releases`)).rejects.toThrow(/append-only/);
  });
});

describe('Migration 98 — CHECKs', () => {
  const bad: [string, Parameters<typeof insert>[0], RegExp][] = [
    ['hash not 64 lowercase hex', { by: 'doctor', version: '2.0.0', sha: 'A'.repeat(64) }, /shape_check/],
    ['version not MAJOR.MINOR.PATCH', { by: 'doctor', version: '2.0', body: { id: 'zebra-rules', version: '2.0' } }, /shape_check/],
    ['body id is another file', { by: 'doctor', version: '2.0.1', body: { id: 'other', version: '2.0.1' } }, /body_check/],
    ['body version differs', { by: 'doctor', version: '2.0.2', body: { id: 'zebra-rules', version: '2.0.3' } }, /body_check/],
    ['no sign-off reference', { by: 'doctor', version: '2.0.4', signoff: '  ' }, /signoff_check/],
    ['null sign-off reference', { by: 'doctor', version: '2.0.5', signoff: null }, /not-null|null value/],
  ];
  for (const [name, row, error] of bad) {
    it(`refuses: ${name}`, async () => {
      await expect(as('doctor', () => db.exec(insert(row)))).rejects.toThrow(error);
    });
  }

  it('one row per content id and version', async () => {
    await expect(as('doctor', () => db.exec(insert({ by: 'doctor', version: '1.0.1' })))).rejects.toThrow(/duplicate key/);
  });
});

describe('content:publish SQL', () => {
  it('inserts a release that the web verification selects', async () => {
    const bundled = JSON.parse(sql('clinical-content/rules/supplement-catalogue.json')) as Record<string, unknown>;
    const schema = JSON.parse(sql('clinical-content/schemas/supplement-catalogue.schema.json')) as JsonSchema;
    const body = { ...bundled, version: '7.0.0' };
    const release = buildRelease({ contentId: 'supplement-catalogue', body, signoffRef: 'supplements-interactions#1-6 approved 2026-09-26' });
    // Run as the SQL editor does (postgres, RLS bypassed); the publisher must be a doctor / admin.
    const none = await db.query(releaseInsertSql(release, { publishedBy: USERS.nurse }));
    expect(none.rows).toHaveLength(0);
    const inserted = await db.query<{ version: string }>(releaseInsertSql(release, { publishedBy: USERS.admin }));
    expect(inserted.rows).toEqual([expect.objectContaining({ version: '7.0.0' })]);
    const rows = await as('nurse', () => db.query<ContentRelease>(
      `select id, content_id, version, sha256, body, published_at, signoff_ref, revoked_at from public.clinical_content_releases where content_id = 'supplement-catalogue'`));
    expect(rows.rows).toHaveLength(1);
    const s = selectForChannel('supplement-catalogue', bundled, schema, rows.rows);
    expect(s.source).toBe('release');
    expect(s.version).toBe('7.0.0');
    expect(s.release?.sha256).toBe(release.sha256);
  });
});

/**
 * A small in-memory stand-in for the supabase-js query builder, enough for the lab-feed routes:
 * from().select/insert/update + eq/in/is/order/limit/range + single/maybeSingle + head counts,
 * unique constraints (23505) and "table missing" (42P01). Not a general Supabase fake.
 */
import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code: string; message: string } | null; count?: number | null };

export class FakeDb {
  tables: Record<string, Row[]> = {};
  missing = new Set<string>();
  unique: Record<string, string[][]> = {
    lab_feed_messages: [['lab_id', 'message_id']],
    investigation_results: [['lab_report_ref']],
    lab_results_to_reconcile: [['report_ref']],
  };
  /** Force an error on the next insert into a table. */
  failNextInsert: Record<string, { code: string; message: string }> = {};

  rows(table: string): Row[] {
    return (this.tables[table] ??= []);
  }

  client(): { from: (t: string) => FakeQuery } {
    return { from: (t: string) => new FakeQuery(this, t) };
  }
}

class FakeQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' = 'select';
  private payload: Row | Row[] | null = null;
  private filters: Array<(r: Row) => boolean> = [];
  private returning = false;
  private head = false;
  private counting = false;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private max: number | null = null;

  constructor(private readonly db: FakeDb, private readonly table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }): this {
    if (this.op === 'select') this.op = 'select';
    else this.returning = true;
    if (opts?.head) this.head = true;
    if (opts?.count) this.counting = true;
    return this;
  }
  insert(rows: Row | Row[]): this { this.op = 'insert'; this.payload = rows; return this; }
  update(patch: Row): this { this.op = 'update'; this.payload = patch; return this; }
  eq(c: string, v: unknown): this { this.filters.push(r => r[c] === v); return this; }
  in(c: string, vals: unknown[]): this { this.filters.push(r => vals.includes(r[c])); return this; }
  is(c: string, v: null): this { this.filters.push(r => (r[c] ?? null) === v); return this; }
  order(): this { return this; }
  limit(n: number): this { this.max = n; return this; }
  range(from: number, to: number): this { this.max = to - from + 1; return this; }
  single(): this { this.mode = 'single'; return this; }
  maybeSingle(): this { this.mode = 'maybe'; return this; }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(ok, bad);
  }

  private shape(rows: Row[]): Result {
    const copies = rows.map(r => ({ ...r }));
    if (this.mode === 'single') {
      return copies.length === 1 ? { data: copies[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
    }
    if (this.mode === 'maybe') return { data: copies[0] ?? null, error: null };
    return { data: copies, error: null };
  }

  private run(): Result {
    if (this.db.missing.has(this.table)) {
      return { data: null, error: { code: '42P01', message: `relation "${this.table}" does not exist` }, count: null };
    }
    const all = this.db.rows(this.table);
    if (this.op === 'insert') {
      const forced = this.db.failNextInsert[this.table];
      if (forced) { delete this.db.failNextInsert[this.table]; return { data: null, error: forced }; }
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const inserted: Row[] = [];
      for (const raw of list) {
        const row: Row = { id: randomUUID(), created_at: new Date().toISOString(), ...raw };
        for (const cols of this.db.unique[this.table] ?? []) {
          if (cols.some(c => row[c] === null || row[c] === undefined)) continue;
          if (all.some(r => cols.every(c => r[c] === row[c]))) {
            return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint on ${this.table}` } };
          }
        }
        all.push(row);
        inserted.push(row);
      }
      return this.returning ? this.shape(inserted) : { data: null, error: null };
    }
    let matched = all.filter(r => this.filters.every(f => f(r)));
    if (this.op === 'update') {
      for (const r of matched) Object.assign(r, this.payload as Row);
      return this.returning ? this.shape(matched) : { data: null, error: null };
    }
    const count = matched.length;
    if (this.max !== null) matched = matched.slice(0, this.max);
    if (this.head) return { data: null, error: null, count };
    const res = this.shape(matched);
    return this.counting ? { ...res, count } : res;
  }
}

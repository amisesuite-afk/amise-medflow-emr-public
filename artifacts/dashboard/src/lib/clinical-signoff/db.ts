/**
 * Clinical sign-off — reads and writes of public.clinical_signoffs (Migration 95).
 *
 * RLS: doctor and admin insert (as themselves, with their own role); doctor, admin and nurse
 * read; front desk has no access. Rows are append-only: a correction is a new row.
 *
 * Tolerates the table being absent (Migration 95 not yet applied on production): loads return
 * `available: false` and saves return status 'unavailable' — never a throw — and the page shows
 * the catalogue read-only. Nothing is queued and nothing is kept in browser storage: a decision
 * that could not be saved is reported on the spot. Each saved decision is audit-logged
 * (audit_log, action 'clinical_signoff') through db.ts's audit helper.
 */
import { supabase } from '@/lib/supabase';
import { logClinicalSignoff } from '@/lib/db';
import { SIGNOFF_DECISIONS } from './types';
import type { CatalogueItem, ReviewerRole, SignoffDecision, SignoffRecord } from './types';

/** 42P01 undefined_table, PGRST205 not in the schema cache, PGRST204/42703 unknown column. */
export function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204' || code === '42703';
}

export interface SignoffRow {
  id: string;
  item_id: string;
  item_hash: string;
  catalogue_hash: string | null;
  decision: string;
  amendment: string | null;
  comment: string | null;
  attested: boolean;
  reviewer_user_id: string;
  reviewer_name: string;
  reviewer_role: string;
  rule_set_ids: string[] | null;
  client_ref: string | null;
  decided_at: string;
  created_at?: string;
}

export function rowToRecord(r: SignoffRow): SignoffRecord | null {
  if (!r || typeof r.item_id !== 'string' || typeof r.item_hash !== 'string') return null;
  if (!SIGNOFF_DECISIONS.includes(r.decision as SignoffDecision)) return null;
  return {
    id: r.id ?? null,
    itemId: r.item_id,
    itemHash: r.item_hash,
    catalogueHash: r.catalogue_hash ?? null,
    decision: r.decision as SignoffDecision,
    amendment: r.amendment ?? null,
    comment: r.comment ?? null,
    reviewerUserId: r.reviewer_user_id,
    reviewerName: r.reviewer_name,
    reviewerRole: r.reviewer_role,
    ruleSetIds: Array.isArray(r.rule_set_ids) ? r.rule_set_ids : [],
    decidedAt: r.decided_at,
  };
}

export interface SignoffData {
  available: boolean;
  records: SignoffRecord[];
  error: string | null;
}

function errorText(e: unknown): string {
  return (e as { message?: string } | null)?.message ?? 'Unknown error';
}

const PAGE = 1000;

export async function loadSignoffs(): Promise<SignoffData> {
  if (!supabase) return { available: false, records: [], error: 'Supabase not configured' };
  const records: SignoffRecord[] = [];
  try {
    for (let from = 0; from < 50_000; from += PAGE) {
      const { data, error } = await supabase
        .from('clinical_signoffs')
        .select('*')
        .order('decided_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        return isMissingTable(error)
          ? { available: false, records: [], error: null }
          : { available: true, records, error: errorText(error) };
      }
      const rows = (data ?? []) as SignoffRow[];
      for (const r of rows) {
        const rec = rowToRecord(r);
        if (rec) records.push(rec);
      }
      if (rows.length < PAGE) break;
    }
    return { available: true, records, error: null };
  } catch (e) {
    return { available: true, records, error: errorText(e) };
  }
}

export type SaveSignoffStatus = 'saved' | 'duplicate' | 'refused' | 'unavailable' | 'invalid' | 'failed';

export interface SaveSignoffArgs {
  item: Pick<CatalogueItem, 'id' | 'hash' | 'ruleSetIds'>;
  catalogueHash: string | null;
  decision: SignoffDecision;
  amendment: string;
  comment: string;
  attested: boolean;
  reviewerName: string;
  reviewerRole: ReviewerRole;
  userId: string;
  /** Made once per form, so a double submit or a retry cannot record two rows. */
  clientRef: string;
}

export interface SaveSignoffResult {
  status: SaveSignoffStatus;
  record: SignoffRecord | null;
  /** Whether the audit_log row was written (false does not undo the decision). */
  audited: boolean;
  error: string | null;
}

/** Client-side checks that mirror the migration's CHECKs, so the reviewer gets a clear message. */
export function validateSignoff(a: Pick<SaveSignoffArgs, 'decision' | 'amendment' | 'comment' | 'attested' | 'reviewerName'>): string | null {
  if (!a.attested) return 'Tick "I have reviewed this item against the cited source" to record a decision.';
  const name = a.reviewerName.trim();
  if (name.length < 2 || name.length > 200) return 'Enter the reviewer\'s name as it should appear in the registry.';
  const amendment = a.amendment.trim();
  if (a.decision === 'approved_with_amendment' && (amendment.length < 3 || amendment.length > 4000)) {
    return 'Write the amendment (what should change) to approve with an amendment.';
  }
  if (a.comment.length > 2000) return 'The comment is too long (2,000 characters at most).';
  return null;
}

export async function saveSignoff(a: SaveSignoffArgs): Promise<SaveSignoffResult> {
  const invalid = validateSignoff(a);
  if (invalid) return { status: 'invalid', record: null, audited: false, error: invalid };
  if (!supabase) return { status: 'failed', record: null, audited: false, error: 'Supabase not configured' };
  const row = {
    item_id: a.item.id,
    item_hash: a.item.hash,
    catalogue_hash: a.catalogueHash,
    decision: a.decision,
    amendment: a.decision === 'approved_with_amendment' ? a.amendment.trim() : null,
    comment: a.comment.trim() || null,
    attested: true,
    reviewer_user_id: a.userId,
    reviewer_name: a.reviewerName.trim(),
    reviewer_role: a.reviewerRole,
    rule_set_ids: a.item.ruleSetIds,
    client_ref: a.clientRef,
  };
  try {
    const { data, error } = await supabase.from('clinical_signoffs').insert(row).select('*');
    if (error) {
      const code = (error as { code?: unknown }).code;
      const status: SaveSignoffStatus = isMissingTable(error) ? 'unavailable'
        : code === '23505' ? 'duplicate'
        : code === '42501' ? 'refused'
        : code === '23514' ? 'invalid'
        : 'failed';
      return { status, record: null, audited: false, error: errorText(error) };
    }
    const stored = Array.isArray(data) && data.length ? rowToRecord(data[0] as SignoffRow) : null;
    // RLS can filter the returned row; the insert itself succeeded.
    const record: SignoffRecord = stored ?? {
      id: null, itemId: row.item_id, itemHash: row.item_hash, catalogueHash: row.catalogue_hash, decision: row.decision,
      amendment: row.amendment, comment: row.comment, reviewerUserId: row.reviewer_user_id, reviewerName: row.reviewer_name,
      reviewerRole: row.reviewer_role, ruleSetIds: row.rule_set_ids, decidedAt: new Date().toISOString(),
    };
    const audited = await logClinicalSignoff({
      signoffId: record.id, itemId: record.itemId, itemHash: record.itemHash, decision: record.decision,
      ruleSetIds: record.ruleSetIds, reviewerName: record.reviewerName, reviewerRole: record.reviewerRole,
      amended: record.decision === 'approved_with_amendment',
    });
    return { status: 'saved', record, audited, error: null };
  } catch (e) {
    return { status: 'failed', record: null, audited: false, error: errorText(e) };
  }
}

export const SAVE_STATUS_TEXT: Record<SaveSignoffStatus, string> = {
  saved: 'Decision recorded.',
  duplicate: 'This decision was already recorded (a repeated submit). Reload to see it.',
  refused: 'Not recorded: decisions can be recorded by doctor or admin accounts only, in the reviewer\'s own name.',
  unavailable: 'Not recorded: recording decisions becomes available after the database update (Migration 95).',
  invalid: 'Not recorded: the decision is incomplete.',
  failed: 'Not recorded: the database could not be reached. Please try again.',
};

export const UNAVAILABLE_TEXT =
  'Recording decisions becomes available after the database update (Migration 95). The items below are shown read-only.';

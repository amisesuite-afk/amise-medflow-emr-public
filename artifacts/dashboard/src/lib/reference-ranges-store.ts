/**
 * Practice reference ranges on the dashboard (Supabase `lab_reference_ranges`, Migration 96).
 *
 * Every consumer reads ranges through `@workspace/triage-engine/reference-ranges`
 * (resolveReferenceRange, classifyValue, upperLimitOfNormal, decisionUlnFromRanges,
 * isCriticalInAppUnit), passing the practice rows loaded here. Missing table, no Supabase or a
 * read error → no practice rows: every lookup falls back to the built-in defaults.
 *
 * Reads go straight to Supabase (every staff role may read ranges: not patient data). Writes go
 * through the API (admin only, audit-logged): POST/PATCH /api/lab-feed/reference-ranges.
 * Cached in memory only (no localStorage key: lib/phi-storage.ts unchanged).
 */
import { supabase } from '@/lib/supabase';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import {
  rowToReferenceRange, type ReferenceRange, type ReferenceRangeRow,
} from '@workspace/triage-engine/reference-ranges';

export interface StoredRangeRow extends ReferenceRangeRow {
  id: string;
  is_default: boolean;
  retired_at: string | null;
  notes?: string | null;
  updated_at?: string | null;
}

export interface RangeLoad {
  /** false when the table does not exist yet (Migration 96 not applied). */
  available: boolean;
  /** Live practice ranges (not retired, not the seeded defaults), for the lookups. */
  practice: ReferenceRange[];
  /** Every row, for the admin page (defaults and retired rows included). */
  rows: StoredRangeRow[];
  error: string | null;
}

function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204' || code === '42703';
}

let cached: Promise<RangeLoad> | null = null;
let lastPractice: ReferenceRange[] = [];
const listeners = new Set<(r: RangeLoad) => void>();

/** The practice ranges loaded so far (synchronous; empty before the first load). */
export function currentPracticeRanges(): ReferenceRange[] {
  return lastPractice;
}

async function fetchRanges(): Promise<RangeLoad> {
  if (!supabase) return { available: false, practice: [], rows: [], error: null };
  try {
    const { data, error } = await supabase.from('lab_reference_ranges').select('*').order('analyte');
    if (error) {
      return { available: !isMissingTable(error), practice: [], rows: [], error: isMissingTable(error) ? null : error.message };
    }
    const rows = (data ?? []) as StoredRangeRow[];
    const practice = rows.map(rowToReferenceRange).filter((r): r is ReferenceRange => r !== null && !r.isDefault);
    return { available: true, practice, rows, error: null };
  } catch (e) {
    return { available: false, practice: [], rows: [], error: (e as Error)?.message ?? 'Unknown error' };
  }
}

export function loadReferenceRanges(force = false): Promise<RangeLoad> {
  if (!cached || force) {
    cached = fetchRanges();
    void cached.then(r => {
      lastPractice = r.practice;
      for (const l of listeners) l(r);
    });
  }
  return cached;
}

export function subscribeReferenceRanges(fn: (r: RangeLoad) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Test-only. */
export function _resetReferenceRangeCache(): void {
  cached = null;
  lastPractice = [];
}

// ── Admin writes (API: admin role, audit-logged) ────────────────────────────────────────────

export interface RangeInput {
  analyte: string;
  unit: string;
  sex: 'any' | 'male' | 'female';
  ageMinYears: number | null;
  ageMaxYears: number | null;
  lower: number | null;
  upper: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  labSource: string;
  effectiveFrom: string;
}

async function send(path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<{ ok: boolean; error: string | null }> {
  const origin = getApiOrigin();
  try {
    const res = await fetch(`${origin}${path}`, {
      method,
      headers: { ...(await staffAuthHeaders()), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
    void loadReferenceRanges(true);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? 'Network error' };
  }
}

export const createReferenceRange = (r: RangeInput) => send('/api/lab-feed/reference-ranges', 'POST', r);
export const updateReferenceRange = (id: string, r: Partial<RangeInput>) => send(`/api/lab-feed/reference-ranges/${id}`, 'PATCH', r);
export const retireReferenceRange = (id: string) => send(`/api/lab-feed/reference-ranges/${id}/retire`, 'POST');

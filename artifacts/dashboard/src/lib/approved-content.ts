/**
 * Approved-content channel — dashboard loader (docs/APPROVED-CONTENT-CHANNEL.md, Migration 98).
 *
 * Once per session (after sign-in, `ApprovedContentLoader` in App.tsx) it reads the published
 * releases of the channel-enabled shared rule files from Supabase (`clinical_content_releases`;
 * every staff role may read), verifies each with the shared rules
 * (`@workspace/triage-engine/approved-content` — hash, id, version above the bundled file, JSON
 * Schema, pinned fields) and records the copy in force in `approved-content-store.ts`, which the
 * consumers read at call time. Table missing (Migration 98 not applied), no Supabase, a read error
 * or a release that fails a check → the bundled file stays in force, with no error UI (Settings →
 * Clinical rule files shows which copy each file uses).
 *
 * Wired consumers: zebra rules (diagnostic-reasoning.ts → matchZebras, and the panel's version
 * line) and the supplement catalogue items (supplement-catalogue.ts). To wire another file: add it
 * to APPROVED_CONTENT_POLICY (and the Swift twin), add it to CHANNEL_FILES below, and make its
 * consumer read `activeBody(contentId)` at call time — see docs/APPROVED-CONTENT-CHANNEL.md §6.
 */
import { supabase } from '@/lib/supabase';
import {
  APPROVED_CONTENT_POLICY, selectForChannel, type ContentRelease, type JsonSchema,
} from '@workspace/triage-engine/approved-content';
import { setApprovedContent, type ActiveContent } from './approved-content-store';
import zebraRules from '../../../../clinical-content/rules/zebra-rules.json';
import zebraSchema from '../../../../clinical-content/schemas/zebra-rules.schema.json';
import supplementCatalogue from '../../../../clinical-content/rules/supplement-catalogue.json';
import supplementSchema from '../../../../clinical-content/schemas/supplement-catalogue.schema.json';
import lifestylePractices from '../../../../clinical-content/rules/lifestyle-practices.json';
import examSigns from '../../../../clinical-content/rules/exam-signs.json';
import decisionRules from '../../../../clinical-content/rules/decision-rules.json';
import diagnosticReasoningRules from '../../../../clinical-content/rules/diagnostic-reasoning-rules.json';

interface ChannelFile {
  file: string;
  bundled: Record<string, unknown>;
  schema: JsonSchema;
}

/** Channel-enabled files: bundled copy and schema (the policy lists what a release may change). */
export const CHANNEL_FILES: Record<string, ChannelFile> = {
  'diagnostic-reasoning-zebras': { file: 'zebra-rules', bundled: zebraRules as Record<string, unknown>, schema: zebraSchema as JsonSchema },
  'supplement-catalogue': { file: 'supplement-catalogue', bundled: supplementCatalogue as Record<string, unknown>, schema: supplementSchema as JsonSchema },
};

/** Every shared rule file in this build, for Settings (file name, content id, bundled version). */
export const SHARED_RULE_FILES: { file: string; contentId: string; version: string }[] = [
  ['zebra-rules', zebraRules], ['supplement-catalogue', supplementCatalogue], ['lifestyle-practices', lifestylePractices],
  ['exam-signs', examSigns], ['decision-rules', decisionRules], ['diagnostic-reasoning-rules', diagnosticReasoningRules],
].map(([file, json]) => {
  const j = json as { id?: string; version?: string };
  return { file: file as string, contentId: j.id ?? String(file), version: j.version ?? '—' };
});

export interface ApprovedContentLoad {
  /** false when the table does not exist yet (Migration 98 not applied) or Supabase is not configured. */
  available: boolean;
  /** A read error other than "table missing" (bundled content stays in force). */
  error: string | null;
  files: ActiveContent[];
}

/** 42P01 undefined_table, PGRST205 not in the schema cache, PGRST204/42703 unknown column. */
function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204' || code === '42703';
}

/** The copy in force for each channel file, given the fetched rows. Pure. */
export function resolveApprovedContent(rows: readonly ContentRelease[]): ActiveContent[] {
  return Object.entries(CHANNEL_FILES).map(([contentId, f]) => {
    const s = selectForChannel(contentId, f.bundled, f.schema, rows.filter(r => r.content_id === contentId));
    return {
      contentId,
      file: f.file,
      source: s.source,
      version: s.version,
      bundledVersion: s.bundledVersion,
      body: s.source === 'release' ? (s.body as Record<string, unknown>) : null,
      release: s.release,
      rejected: s.rejected.map(r => ({ version: r.version, reason: r.reason, detail: r.detail })),
    };
  });
}

const COLUMNS = 'id, content_id, version, sha256, body, schema_version, published_at, signoff_ref, revoked_at';

async function fetchApprovedContent(): Promise<ApprovedContentLoad> {
  const bundledOnly = (available: boolean, error: string | null): ApprovedContentLoad => {
    const files = resolveApprovedContent([]);
    setApprovedContent(files);
    return { available, error, files };
  };
  if (!supabase) return bundledOnly(false, null);
  try {
    // Revoked rows are read too (the selection refuses them and Settings lists them).
    const { data, error } = await supabase
      .from('clinical_content_releases')
      .select(COLUMNS)
      .in('content_id', Object.keys(APPROVED_CONTENT_POLICY))
      .order('published_at', { ascending: false })
      .limit(200);
    if (error) return isMissingTable(error) ? bundledOnly(false, null) : bundledOnly(true, error.message ?? 'Read failed');
    const files = resolveApprovedContent((data ?? []) as ContentRelease[]);
    setApprovedContent(files);
    return { available: true, error: null, files };
  } catch (e) {
    return bundledOnly(true, (e as Error)?.message ?? 'Read failed');
  }
}

let cached: Promise<ApprovedContentLoad> | null = null;

/** Loads once per session; `force` re-reads (Settings → Check again). Never throws. */
export function loadApprovedContent(force = false): Promise<ApprovedContentLoad> {
  if (!cached || force) cached = fetchApprovedContent();
  return cached;
}

/** Test-only. */
export function _resetApprovedContentLoader(): void {
  cached = null;
}

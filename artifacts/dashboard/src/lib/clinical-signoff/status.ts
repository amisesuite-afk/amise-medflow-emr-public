/**
 * Clinical sign-off — pure status logic shared by the dashboard page and
 * `pnpm --filter @workspace/scripts run signoff:apply`. No I/O, no `@/` imports.
 *
 * An item's current decision is its latest row (rows are append-only; a correction is a new
 * row). A decision counts only for the wording it was made on: when the item's hash in the
 * catalogue no longer matches the decision's item_hash, the item is "changed" and must be
 * reviewed again. A rule set is complete when every item linked to it is approved or approved
 * with an amendment for its current wording; pending, rejected, deferred and changed items all
 * hold it back.
 */
import { BUNDLE_FORMAT, SIGNOFF_DECISIONS } from './types';
import type {
  CatalogueItem, ItemStatus, ProgressCounts, RuleSetProgress, SignoffBundle, SignoffCatalogue,
  SignoffDecision, SignoffRecord,
} from './types';

export const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  amended: 'Approved with amendment',
  rejected: 'Rejected',
  deferred: 'Deferred',
  changed: 'Changed since decision',
};

export type StatusFilter = 'all' | 'pending' | 'approved' | 'changed' | 'rejected' | 'deferred';

export const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'changed', label: 'Changed since approval' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'deferred', label: 'Deferred' },
];

export function matchesFilter(status: ItemStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'approved') return status === 'approved' || status === 'amended';
  return status === filter;
}

function byTime(a: SignoffRecord, b: SignoffRecord): number {
  const ta = Date.parse(a.decidedAt);
  const tb = Date.parse(b.decidedAt);
  return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
}

/** The latest decision per item (ties keep the later row in input order). */
export function latestRecords(records: readonly SignoffRecord[]): Map<string, SignoffRecord> {
  const sorted = records.map((r, i) => ({ r, i })).sort((a, b) => byTime(a.r, b.r) || a.i - b.i);
  const out = new Map<string, SignoffRecord>();
  for (const { r } of sorted) out.set(r.itemId, r);
  return out;
}

/** Every decision on one item, newest first. */
export function historyFor(records: readonly SignoffRecord[], itemId: string): SignoffRecord[] {
  return records.filter(r => r.itemId === itemId).sort((a, b) => byTime(b, a));
}

export function itemStatus(item: Pick<CatalogueItem, 'hash'>, latest: SignoffRecord | undefined): ItemStatus {
  if (!latest) return 'pending';
  if (latest.itemHash !== item.hash) return 'changed';
  switch (latest.decision) {
    case 'approved': return 'approved';
    case 'approved_with_amendment': return 'amended';
    case 'rejected': return 'rejected';
    case 'deferred': return 'deferred';
    default: return 'pending';
  }
}

export function statusMap(catalogue: Pick<SignoffCatalogue, 'items'>, records: readonly SignoffRecord[]): Map<string, ItemStatus> {
  const latest = latestRecords(records);
  return new Map(catalogue.items.map(it => [it.id, itemStatus(it, latest.get(it.id))]));
}

export function countStatuses(itemIds: readonly string[], statuses: ReadonlyMap<string, ItemStatus>): ProgressCounts {
  const c: ProgressCounts = { total: itemIds.length, approved: 0, amended: 0, pending: 0, rejected: 0, deferred: 0, changed: 0 };
  for (const id of itemIds) {
    const s = statuses.get(id) ?? 'pending';
    if (s === 'approved') c.approved++;
    else if (s === 'amended') { c.approved++; c.amended++; }
    else c[s]++;
  }
  return c;
}

export function ruleSetProgress(catalogue: Pick<SignoffCatalogue, 'ruleSets'>, statuses: ReadonlyMap<string, ItemStatus>): RuleSetProgress[] {
  return catalogue.ruleSets.map(rs => {
    const c = countStatuses(rs.itemIds, statuses);
    return { id: rs.id, title: rs.title, ...c, complete: c.total > 0 && c.approved === c.total };
  });
}

/** "treatment-decision-support: 12/74 approved" */
export function progressLabel(p: { id: string; approved: number; total: number }): string {
  return `${p.id}: ${p.approved}/${p.total} approved`;
}

/** Items of one rule set that hold it back, with their status. */
export function blockingItems(
  catalogue: Pick<SignoffCatalogue, 'ruleSets'>, statuses: ReadonlyMap<string, ItemStatus>, ruleSetId: string,
): { itemId: string; status: ItemStatus }[] {
  const rs = catalogue.ruleSets.find(r => r.id === ruleSetId);
  if (!rs) return [];
  return rs.itemIds
    .map(itemId => ({ itemId, status: statuses.get(itemId) ?? 'pending' as ItemStatus }))
    .filter(x => x.status !== 'approved' && x.status !== 'amended');
}

/** YYYY-MM-DD in America/St_Lucia (the practice's clock). */
export function stLuciaDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/St_Lucia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// ── Bundle (export → signoff:apply) ─────────────────────────────────────────────────────────

export function buildBundle(
  catalogue: SignoffCatalogue,
  records: readonly SignoffRecord[],
  exportedBy: SignoffBundle['exportedBy'],
  now: Date = new Date(),
): SignoffBundle {
  const statuses = statusMap(catalogue, records);
  return {
    format: BUNDLE_FORMAT,
    exportedAt: now.toISOString(),
    exportedBy,
    catalogueHash: catalogue.catalogueHash,
    records: [...records].sort(byTime),
    ruleSets: ruleSetProgress(catalogue, statuses),
  };
}

const isStr = (v: unknown): v is string => typeof v === 'string';

/** Validates a parsed bundle; returns the problems (empty = valid). */
export function bundleProblems(x: unknown): string[] {
  const p: string[] = [];
  if (!x || typeof x !== 'object') return ['not a JSON object'];
  const b = x as Partial<SignoffBundle>;
  if (b.format !== BUNDLE_FORMAT) p.push(`format is not ${BUNDLE_FORMAT}`);
  if (!isStr(b.exportedAt)) p.push('exportedAt missing');
  if (!Array.isArray(b.records)) return [...p, 'records missing'];
  b.records.forEach((r, i) => {
    const at = `records[${i}]`;
    if (!r || typeof r !== 'object') { p.push(`${at} is not an object`); return; }
    if (!isStr(r.itemId) || !/^[a-z0-9-]+#[A-Za-z0-9.-]+$/.test(r.itemId)) p.push(`${at}.itemId malformed`);
    if (!isStr(r.itemHash) || !/^[0-9a-f]{16}$/.test(r.itemHash)) p.push(`${at}.itemHash malformed`);
    if (!SIGNOFF_DECISIONS.includes(r.decision as SignoffDecision)) p.push(`${at}.decision unknown`);
    if (r.decision === 'approved_with_amendment' && !(isStr(r.amendment) && r.amendment.trim())) p.push(`${at}.amendment missing`);
    if (!isStr(r.reviewerName) || r.reviewerName.trim().length < 2) p.push(`${at}.reviewerName missing`);
    if (!isStr(r.reviewerRole) || !['doctor', 'admin'].includes(r.reviewerRole)) p.push(`${at}.reviewerRole must be doctor or admin`);
    if (!isStr(r.decidedAt) || !Number.isFinite(Date.parse(r.decidedAt))) p.push(`${at}.decidedAt malformed`);
  });
  return p;
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Markdown companion of the bundle: approved decisions by rule set, then what is still open. */
export function bundleMarkdown(bundle: SignoffBundle, catalogue: SignoffCatalogue): string {
  const latest = latestRecords(bundle.records);
  const statuses = statusMap(catalogue, bundle.records);
  const items = new Map(catalogue.items.map(i => [i.id, i]));
  const lines: string[] = [];
  lines.push('# Clinical sign-off — exported decisions', '');
  lines.push(`Exported ${bundle.exportedAt}${bundle.exportedBy ? ` by ${bundle.exportedBy.name}${bundle.exportedBy.role ? ` (${bundle.exportedBy.role})` : ''}` : ''}.`);
  lines.push(`Catalogue ${bundle.catalogueHash}; ${bundle.records.length} decision rows.`, '');
  lines.push('Apply with `pnpm --filter @workspace/scripts run signoff:apply <bundle.json>` (a developer runs it and commits the result).', '');
  lines.push('## Progress by rule set', '');
  lines.push('| Rule set | Approved | Pending | Changed | Rejected | Deferred | Complete |', '|---|---|---|---|---|---|---|');
  for (const p of ruleSetProgress(catalogue, statuses)) {
    lines.push(`| ${p.id} | ${p.approved}/${p.total} | ${p.pending} | ${p.changed} | ${p.rejected} | ${p.deferred} | ${p.complete ? 'yes' : 'no'} |`);
  }
  lines.push('');
  for (const src of catalogue.sources) {
    const rows = src.itemIds.map(id => ({ item: items.get(id)!, rec: latest.get(id), st: statuses.get(id) ?? 'pending' as ItemStatus }))
      .filter(r => r.rec);
    if (!rows.length) continue;
    lines.push(`## ${src.title} (\`${src.doc}\`)`, '');
    for (const { item, rec, st } of rows) {
      const r = rec!;
      lines.push(`- **${item.id}** — ${STATUS_LABEL[st]}: ${oneLine(item.title)}`);
      lines.push(`  - ${r.reviewerName} (${r.reviewerRole}), ${stLuciaDate(r.decidedAt)}${st === 'changed' ? ' — wording changed since this decision' : ''}`);
      if (r.amendment) lines.push(`  - Amendment: ${oneLine(r.amendment)}`);
      if (r.comment) lines.push(`  - Comment: ${oneLine(r.comment)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

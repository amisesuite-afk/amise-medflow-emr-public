/**
 * Clinical sign-off page — list model (pure): grouping by change log or rule set, status filter,
 * rule-set narrowing and text search.
 */
import { countStatuses, matchesFilter } from './status';
import type { StatusFilter } from './status';
import type { CatalogueItem, ItemStatus, ProgressCounts, SignoffCatalogue } from './types';

export type Grouping = 'source' | 'ruleSet';

export interface ListGroup {
  key: string;
  title: string;
  subtitle?: string;
  counts: ProgressCounts;
  rows: { item: CatalogueItem; status: ItemStatus }[];
}

export interface ListOptions {
  grouping: Grouping;
  filter: StatusFilter;
  query: string;
  ruleSet: string | null;
}

function matchesQuery(item: CatalogueItem, q: string): boolean {
  if (!q) return true;
  const hay = `${item.id} ${item.title} ${item.text} ${item.group ?? ''}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

export function buildListGroups(
  catalogue: SignoffCatalogue, statuses: ReadonlyMap<string, ItemStatus>, o: ListOptions,
): ListGroup[] {
  const byId = new Map(catalogue.items.map(i => [i.id, i]));
  const visible = (item: CatalogueItem) =>
    matchesFilter(statuses.get(item.id) ?? 'pending', o.filter)
    && matchesQuery(item, o.query.trim())
    && (!o.ruleSet || item.ruleSetIds.includes(o.ruleSet));
  const make = (key: string, title: string, subtitle: string | undefined, ids: string[]): ListGroup | null => {
    const rows = ids.map(id => byId.get(id)!).filter(Boolean).filter(visible)
      .map(item => ({ item, status: statuses.get(item.id) ?? 'pending' as ItemStatus }));
    return rows.length ? { key, title, subtitle, counts: countStatuses(ids, statuses), rows } : null;
  };
  const groups = o.grouping === 'source'
    ? catalogue.sources.map(s => make(s.id, s.id === 'surgeon-decisions' ? 'SURGEON-DECISIONS (A–G, I)' : s.id, s.title, s.itemIds))
    : [
        ...catalogue.ruleSets.filter(rs => !o.ruleSet || rs.id === o.ruleSet).map(rs => make(`rs:${rs.id}`, rs.id, rs.title, rs.itemIds)),
        ...(o.ruleSet ? [] : [make('rs:none', 'No registry rule set', 'Items recorded against their change log only',
          catalogue.items.filter(i => i.ruleSetIds.length === 0).map(i => i.id))]),
      ];
  return groups.filter((g): g is ListGroup => g !== null);
}

/** Item ids in display order, each once (an item can sit under several rule sets). */
export function flatItemIds(groups: ListGroup[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) for (const r of g.rows) if (!seen.has(r.item.id)) { seen.add(r.item.id); out.push(r.item.id); }
  return out;
}

export function filterCounts(catalogue: SignoffCatalogue, statuses: ReadonlyMap<string, ItemStatus>): Record<StatusFilter, number> {
  const out: Record<StatusFilter, number> = { all: 0, pending: 0, approved: 0, changed: 0, rejected: 0, deferred: 0 };
  for (const it of catalogue.items) {
    const s = statuses.get(it.id) ?? 'pending';
    out.all++;
    for (const f of ['pending', 'approved', 'changed', 'rejected', 'deferred'] as const) if (matchesFilter(s, f)) out[f]++;
  }
  return out;
}

/** Next item after a move (wraps at neither end). */
export function moveSelection(ids: string[], current: string | null, delta: 1 | -1): string | null {
  if (!ids.length) return null;
  const i = current ? ids.indexOf(current) : -1;
  if (i < 0) return ids[0];
  return ids[Math.max(0, Math.min(ids.length - 1, i + delta))];
}

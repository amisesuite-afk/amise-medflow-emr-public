/**
 * signoff:apply — turns an exported sign-off bundle into repository changes. Pure functions; the
 * CLI (scripts/src/signoff-apply.ts) reads and writes the files.
 *
 * A group is a registry rule set, or (for items linked to no rule set) a change log
 * ('source:<slug>'). A group is complete when every item in it has, as its latest decision,
 * "approved" or "approved with amendment" for its CURRENT wording (hash re-computed from the
 * docs, not taken from the bundle). Pending, rejected, deferred and changed-since-approval items
 * hold a group back.
 *
 * For each complete group:
 *   - rule sets: clinical-content/registry.json gets lastReviewed (the date of the last decision,
 *     America/St_Lucia), reviewer (every reviewer, "Name (role)"), reviewEvidence (counts, bundle
 *     hash, where the decisions are recorded) and nextReviewDue (lastReviewed + the registry's
 *     default interval). Only those fields (and the top-level "updated") change; the edit is made
 *     in place so the file's layout is kept, and verified by re-parsing.
 *   - every applied group: one new dated subsection in SURGEON-DECISIONS section I listing each
 *     item's decision, reviewer, date and any amendment (marked <!-- signoff:applied -->, which
 *     the catalogue parser skips).
 * Refusals: a malformed bundle, a bundle already applied, a named rule set (--rule-set) that is
 * not complete, or nothing complete at all. A refusal writes nothing.
 */
import { createHash } from 'node:crypto';
import {
  latestRecords, statusMap, stLuciaDate, bundleProblems, STATUS_LABEL,
} from '../../../artifacts/dashboard/src/lib/clinical-signoff/status';
import { DECISION_LABEL } from '../../../artifacts/dashboard/src/lib/clinical-signoff/types';
import type {
  ItemStatus, SignoffBundle, SignoffCatalogue, SignoffRecord,
} from '../../../artifacts/dashboard/src/lib/clinical-signoff/types';
import { APPLIED_MARKER } from './catalogue';

export interface GroupState {
  id: string;
  kind: 'rule-set' | 'source';
  itemIds: string[];
  complete: boolean;
  blocking: { itemId: string; status: ItemStatus }[];
  hasDecisions: boolean;
}

export function bundleSha(bundleText: string): string {
  return createHash('sha256').update(bundleText, 'utf8').digest('hex').slice(0, 16);
}

export function groupStates(catalogue: SignoffCatalogue, records: readonly SignoffRecord[]): GroupState[] {
  const statuses = statusMap(catalogue, records);
  const decided = new Set(records.map(r => r.itemId));
  const mk = (id: string, kind: GroupState['kind'], itemIds: string[]): GroupState => {
    const blocking = itemIds
      .map(itemId => ({ itemId, status: statuses.get(itemId) ?? 'pending' as ItemStatus }))
      .filter(b => b.status !== 'approved' && b.status !== 'amended');
    return { id, kind, itemIds, complete: itemIds.length > 0 && blocking.length === 0, blocking, hasDecisions: itemIds.some(i => decided.has(i)) };
  };
  const out = catalogue.ruleSets.map(rs => mk(rs.id, 'rule-set', rs.itemIds));
  for (const src of catalogue.sources) {
    const unlinked = catalogue.items.filter(i => i.source === src.id && i.ruleSetIds.length === 0).map(i => i.id);
    if (unlinked.length) out.push(mk(`source:${src.id}`, 'source', unlinked));
  }
  return out;
}

function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

function reviewersOf(recs: SignoffRecord[]): string {
  const counts = new Map<string, number>();
  for (const r of recs) {
    const k = `${r.reviewerName.trim()} (${r.reviewerRole})`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k).join('; ');
}

const JSON_STRING = '"(?:[^"\\\\]|\\\\.)*"';

/** Replaces string fields of one rule-set object in place, keeping the file's layout. */
export function setRuleSetFields(registryText: string, ruleSetId: string, fields: Record<string, string>): string {
  const idRe = new RegExp(`"id"\\s*:\\s*"${ruleSetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
  const m = idRe.exec(registryText);
  if (!m) throw new Error(`registry: rule set ${ruleSetId} not found`);
  const start = m.index;
  const nextId = registryText.slice(start + m[0].length).search(/"id"\s*:\s*"/);
  const end = nextId < 0 ? registryText.length : start + m[0].length + nextId;
  let block = registryText.slice(start, end);
  for (const [key, value] of Object.entries(fields)) {
    const re = new RegExp(`("${key}"\\s*:\\s*)${JSON_STRING}`);
    if (!re.test(block)) throw new Error(`registry: ${ruleSetId} has no "${key}" field`);
    block = block.replace(re, (_all, pre: string) => `${pre}${JSON.stringify(value)}`);
  }
  return registryText.slice(0, start) + block + registryText.slice(end);
}

function setTopLevelUpdated(registryText: string, date: string): string {
  return registryText.replace(new RegExp(`^(\\s*"updated"\\s*:\\s*)${JSON_STRING}`, 'm'), (_a, pre: string) => `${pre}${JSON.stringify(date)}`);
}

export interface ApplyInput {
  bundle: SignoffBundle;
  bundleText: string;
  catalogue: SignoffCatalogue;
  registryText: string;
  decisionsText: string;
  /** --rule-set ids (or 'source:<slug>'): apply exactly these, refusing if any is incomplete. */
  only?: string[];
  now?: Date;
}

export type ApplyResult =
  | {
      ok: true;
      registryText: string;
      decisionsText: string;
      applied: { id: string; kind: GroupState['kind']; items: number; amended: number; lastReviewed: string | null; reviewer: string | null }[];
      notApplied: { id: string; blocking: { itemId: string; status: ItemStatus }[] }[];
      section: string;
    }
  | { ok: false; refusals: string[] };

export function applyBundle(input: ApplyInput): ApplyResult {
  const problems = bundleProblems(input.bundle);
  if (problems.length) return { ok: false, refusals: problems.map(p => `bundle: ${p}`) };
  const sha = bundleSha(input.bundleText);
  if (input.decisionsText.includes(`signoff-bundle: ${sha}`)) {
    return { ok: false, refusals: [`bundle sha256:${sha} is already recorded in SURGEON-DECISIONS.md section I`] };
  }
  const records = input.bundle.records;
  const states = groupStates(input.catalogue, records);
  const byId = new Map(states.map(s => [s.id, s]));
  const describe = (s: GroupState) => s.blocking.slice(0, 12).map(b => `${b.itemId} ${STATUS_LABEL[b.status].toLowerCase()}`).join(', ')
    + (s.blocking.length > 12 ? `, … ${s.blocking.length - 12} more` : '');

  let chosen: GroupState[];
  const notApplied: { id: string; blocking: GroupState['blocking'] }[] = [];
  if (input.only?.length) {
    const refusals: string[] = [];
    chosen = [];
    for (const id of input.only) {
      const s = byId.get(id);
      if (!s) { refusals.push(`${id}: not a rule set (or source) with sign-off items in the catalogue`); continue; }
      if (!s.complete) refusals.push(`${id}: not fully approved — ${s.blocking.length} of ${s.itemIds.length} items open: ${describe(s)}`);
      else chosen.push(s);
    }
    if (refusals.length) return { ok: false, refusals };
  } else {
    chosen = states.filter(s => s.complete);
    for (const s of states) if (!s.complete && s.hasDecisions) notApplied.push({ id: s.id, blocking: s.blocking });
    if (!chosen.length) {
      return {
        ok: false,
        refusals: ['no rule set is fully approved (every linked item approved for its current wording)',
          ...notApplied.map(n => `${n.id}: ${describe(byId.get(n.id)!)}`)],
      };
    }
  }

  const latest = latestRecords(records);
  const today = stLuciaDate((input.now ?? new Date()).toISOString());
  let registryText = input.registryText;
  const registry = JSON.parse(registryText) as {
    reviewPolicy?: { defaultIntervalMonths?: number };
    ruleSets: Record<string, unknown>[];
  };
  const interval = registry.reviewPolicy?.defaultIntervalMonths ?? 12;
  const items = new Map(input.catalogue.items.map(i => [i.id, i]));
  const applied: Extract<ApplyResult, { ok: true }>['applied'] = [];
  const nextI = Math.max(0, ...[...input.decisionsText.matchAll(/^###\s+I(\d+)\./gm)].map(m => Number(m[1]))) + 1;
  const sectionLabel = `I${nextI}`;
  const expected = JSON.parse(registryText) as typeof registry;

  for (const g of chosen) {
    const recs = g.itemIds.map(id => latest.get(id)!);
    const amended = recs.filter(r => r.decision === 'approved_with_amendment').length;
    if (g.kind === 'source') {
      applied.push({ id: g.id, kind: g.kind, items: recs.length, amended, lastReviewed: null, reviewer: null });
      continue;
    }
    const lastReviewed = recs.map(r => stLuciaDate(r.decidedAt)).sort().at(-1)!;
    const firstDate = recs.map(r => stLuciaDate(r.decidedAt)).sort()[0];
    const reviewer = reviewersOf(recs);
    const sources = [...new Set(g.itemIds.map(id => items.get(id)!.source))];
    const entry = registry.ruleSets.find(r => r.id === g.id);
    const old = typeof entry?.reviewEvidence === 'string' ? entry.reviewEvidence : '';
    const evidence = `In-app clinical sign-off (Clinical sign-off page, Migration 95): all ${recs.length} linked sign-off items approved`
      + `${amended ? ` (${amended} with an amendment)` : ''}, from ${sources.join(', ')}; decisions ${firstDate === lastReviewed ? lastReviewed : `${firstDate} to ${lastReviewed}`};`
      + ` bundle sha256:${sha}; recorded in docs/clinical-validation/SURGEON-DECISIONS.md ${sectionLabel}.`
      + (old && old !== 'None.' ? ` Earlier evidence: ${old}` : '');
    const fields = { lastReviewed, reviewer, reviewEvidence: evidence, nextReviewDue: addMonths(lastReviewed, interval) };
    registryText = setRuleSetFields(registryText, g.id, fields);
    const e = expected.ruleSets.find(r => r.id === g.id)!;
    Object.assign(e, fields);
    applied.push({ id: g.id, kind: g.kind, items: recs.length, amended, lastReviewed, reviewer });
  }
  if (applied.some(a => a.kind === 'rule-set')) {
    registryText = setTopLevelUpdated(registryText, today);
    (expected as Record<string, unknown>).updated = today;
  }
  // The in-place edit must equal the intended object change exactly.
  if (JSON.stringify(JSON.parse(registryText)) !== JSON.stringify(expected)) {
    throw new Error('registry edit verification failed: the in-place edit changed more than the review fields');
  }

  // ── SURGEON-DECISIONS section I ──
  const ids = applied.map(a => a.id);
  const title = ids.length <= 3 ? ids.join(', ') : `${ids.length} rule sets and change logs`;
  const who = input.bundle.exportedBy ? ` by ${input.bundle.exportedBy.name}${input.bundle.exportedBy.role ? ` (${input.bundle.exportedBy.role})` : ''}` : '';
  const lines: string[] = [
    '',
    `### ${sectionLabel}. Clinical sign-off: ${title} — APPROVED ${applied.map(a => a.lastReviewed).filter(Boolean).sort().at(-1) ?? today}`,
    APPLIED_MARKER,
    `<!-- signoff-bundle: ${sha} -->`,
    '',
    `- **Recorded by:** \`signoff:apply\` on ${today} from the in-app Clinical sign-off page (Migration 95); bundle`,
    `  \`sha256:${sha}\` exported ${stLuciaDate(input.bundle.exportedAt)}${who}. Decisions are for the item wording in the`,
    `  sign-off catalogue (hash shown); an item edited later needs a new decision.`,
  ];
  for (const a of applied) {
    lines.push(a.kind === 'rule-set'
      ? `- **\`${a.id}\`:** all ${a.items} items approved${a.amended ? ` (${a.amended} with an amendment)` : ''}; registry lastReviewed ${a.lastReviewed}, reviewer ${a.reviewer}.`
      : `- **\`${a.id.replace(/^source:/, '')}\` (items not linked to a registry rule set):** all ${a.items} approved${a.amended ? ` (${a.amended} with an amendment)` : ''}.`);
  }
  lines.push('- **Decisions** (latest per item):');
  const listed = new Set<string>();
  for (const g of chosen) {
    for (const id of g.itemIds) {
      if (listed.has(id)) continue;
      listed.add(id);
      const r = latest.get(id)!;
      const it = items.get(id)!;
      lines.push(`  - \`${id}\` (${it.hash}) ${it.title.replace(/\s+/g, ' ')} — ${DECISION_LABEL[r.decision]}, ${r.reviewerName.trim()} (${r.reviewerRole}), ${stLuciaDate(r.decidedAt)}.`);
      if (r.amendment) lines.push(`    Amendment: ${r.amendment.replace(/\s+/g, ' ').trim()}`);
      if (r.comment) lines.push(`    Comment: ${r.comment.replace(/\s+/g, ' ').trim()}`);
    }
  }
  if (applied.some(a => a.amended)) {
    lines.push('- **Amendments** are decisions to change the content as written above; each still needs a content change (PR, version bump, vignette run) that implements it.');
  }
  const section = lines.join('\n');
  const decisionsText = insertIntoSectionI(input.decisionsText, section);
  return { ok: true, registryText, decisionsText, applied, notApplied, section };
}

/** Appends a block at the end of "## I." (before the next "## " heading, or at the end of the file). */
export function insertIntoSectionI(text: string, block: string): string {
  const m = /^## I\.\s.*$/m.exec(text);
  if (!m) throw new Error('SURGEON-DECISIONS.md has no "## I." section');
  const after = text.slice(m.index + m[0].length);
  const next = after.search(/^## /m);
  const cut = next < 0 ? text.length : m.index + m[0].length + next;
  const head = text.slice(0, cut).replace(/\s*$/, '');
  const tail = text.slice(cut);
  return `${head}\n${block}\n${tail ? `\n${tail}` : ''}`;
}

/**
 * Clinical sign-off page — status logic, list model, keyboard map and the presentational
 * components (rendered to static markup; the dashboard's tests run without a DOM).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import catalogueJson from '@/data/clinical-signoff-catalogue.json';
import type { SignoffCatalogue, SignoffRecord } from '@/lib/clinical-signoff/types';
import {
  blockingItems, historyFor, itemStatus, latestRecords, progressLabel, ruleSetProgress, statusMap,
} from '@/lib/clinical-signoff/status';
import { buildListGroups, filterCounts, flatItemIds, moveSelection } from '@/lib/clinical-signoff/view-model';
import { signoffKeyAction } from '@/lib/clinical-signoff/keyboard';
import {
  DecisionForm, FilterBar, ItemDetail, ItemList, RuleSetProgressList, StatusBadge,
} from '@/components/clinical-signoff/SignoffViews';

const catalogue = catalogueJson as unknown as SignoffCatalogue;
const RS = 'treatment-decision-support';
const rsItems = catalogue.ruleSets.find(r => r.id === RS)!.itemIds;
const item = (id: string) => catalogue.items.find(i => i.id === id)!;

function rec(itemId: string, decision: SignoffRecord['decision'], at: string, extra: Partial<SignoffRecord> = {}): SignoffRecord {
  return {
    id: `${itemId}-${at}`, itemId, itemHash: item(itemId).hash, catalogueHash: null, decision,
    amendment: decision === 'approved_with_amendment' ? 'Use local ranges' : null, comment: null,
    reviewerUserId: 'u', reviewerName: 'Dr Test', reviewerRole: 'doctor', ruleSetIds: [], decidedAt: at, ...extra,
  };
}

describe('status', () => {
  it('pending → latest decision → changed when the wording hash moved', () => {
    const id = rsItems[0];
    expect(itemStatus(item(id), undefined)).toBe('pending');
    const recs = [rec(id, 'rejected', '2026-10-01T10:00:00Z'), rec(id, 'approved_with_amendment', '2026-10-01T11:00:00Z')];
    expect(itemStatus(item(id), latestRecords(recs).get(id))).toBe('amended');
    expect(historyFor(recs, id).map(r => r.decision)).toEqual(['approved_with_amendment', 'rejected']);
    const old = rec(id, 'approved', '2026-10-02T00:00:00Z', { itemHash: 'ffffffffffffffff' });
    expect(itemStatus(item(id), latestRecords([...recs, old]).get(id))).toBe('changed');
  });

  it('rule-set progress counts approved (with amendments) against every linked item', () => {
    const recs = [rec(rsItems[0], 'approved', '2026-10-01T10:00:00Z'), rec(rsItems[1], 'approved_with_amendment', '2026-10-01T10:00:01Z'), rec(rsItems[2], 'deferred', '2026-10-01T10:00:02Z')];
    const statuses = statusMap(catalogue, recs);
    const p = ruleSetProgress(catalogue, statuses).find(x => x.id === RS)!;
    expect(p).toMatchObject({ approved: 2, amended: 1, deferred: 1, total: rsItems.length, complete: false });
    expect(progressLabel(p)).toBe(`${RS}: 2/${rsItems.length} approved`);
    expect(blockingItems(catalogue, statuses, RS).map(b => b.status)).toContain('deferred');
    const all = statusMap(catalogue, rsItems.map((id, k) => rec(id, 'approved', `2026-10-01T10:0${k % 10}:00Z`)));
    expect(ruleSetProgress(catalogue, all).find(x => x.id === RS)!.complete).toBe(true);
  });
});

describe('list model', () => {
  const statuses = statusMap(catalogue, [rec(rsItems[0], 'approved', '2026-10-01T10:00:00Z')]);

  it('groups by change log or by rule set, filters by status, rule set and search', () => {
    const bySource = buildListGroups(catalogue, statuses, { grouping: 'source', filter: 'approved', query: '', ruleSet: null });
    expect(bySource.map(g => g.key)).toEqual(['bayes-treatment']);
    expect(bySource[0].rows.map(r => r.item.id)).toEqual([rsItems[0]]);
    const byRs = buildListGroups(catalogue, statuses, { grouping: 'ruleSet', filter: 'all', query: '', ruleSet: RS });
    expect(byRs.map(g => g.key)).toEqual([`rs:${RS}`]);
    expect(byRs[0].counts.approved).toBe(1);
    const search = buildListGroups(catalogue, statuses, { grouping: 'source', filter: 'all', query: 'Default ULNs', ruleSet: null });
    expect(flatItemIds(search)).toContain('bayes-treatment#7');
    const counts = filterCounts(catalogue, statuses);
    expect(counts.all).toBe(catalogue.items.length);
    expect(counts.approved).toBe(1);
    expect(counts.pending).toBe(catalogue.items.length - 1);
  });

  it('moves the selection without wrapping', () => {
    expect(moveSelection(['a', 'b', 'c'], 'b', 1)).toBe('c');
    expect(moveSelection(['a', 'b', 'c'], 'c', 1)).toBe('c');
    expect(moveSelection(['a', 'b', 'c'], 'a', -1)).toBe('a');
    expect(moveSelection(['a'], 'gone', 1)).toBe('a');
    expect(moveSelection([], null, 1)).toBeNull();
  });
});

describe('keyboard', () => {
  it('maps keys outside text fields and only submit / escape inside them', () => {
    expect(signoffKeyAction({ key: 'j', inField: false })).toEqual({ type: 'move', delta: 1 });
    expect(signoffKeyAction({ key: 'ArrowUp', inField: false })).toEqual({ type: 'move', delta: -1 });
    expect(signoffKeyAction({ key: 'a', inField: false })).toEqual({ type: 'decide', decision: 'approved' });
    expect(signoffKeyAction({ key: 'm', inField: false })).toEqual({ type: 'decide', decision: 'approved_with_amendment' });
    expect(signoffKeyAction({ key: 'r', inField: false })).toEqual({ type: 'decide', decision: 'rejected' });
    expect(signoffKeyAction({ key: 'd', inField: false })).toEqual({ type: 'decide', decision: 'deferred' });
    expect(signoffKeyAction({ key: '4', inField: false })).toEqual({ type: 'filter', filter: 'changed' });
    expect(signoffKeyAction({ key: '/', inField: false })).toEqual({ type: 'search' });
    expect(signoffKeyAction({ key: 'a', inField: true })).toBeNull();
    expect(signoffKeyAction({ key: 'Enter', ctrlKey: true, inField: true })).toEqual({ type: 'submit' });
    expect(signoffKeyAction({ key: 'Enter', metaKey: true, inField: false })).toEqual({ type: 'submit' });
    expect(signoffKeyAction({ key: 'Escape', inField: true })).toEqual({ type: 'blur' });
    expect(signoffKeyAction({ key: 'a', ctrlKey: true, inField: false })).toBeNull();
  });
});

describe('components', () => {
  const statuses = statusMap(catalogue, []);
  const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

  it('StatusBadge and FilterBar show labels and counts', () => {
    expect(html(createElement(StatusBadge, { status: 'changed' }))).toContain('Changed since decision');
    const out = html(createElement(FilterBar, { filter: 'pending', counts: filterCounts(catalogue, statuses), onFilter: () => {} }));
    expect(out).toContain('Changed since approval');
    expect(out).toContain(`Pending <span style="opacity:0.75;font-weight:600">${catalogue.items.length}</span>`);
  });

  it('RuleSetProgressList shows "approved/total approved" per rule set', () => {
    const out = html(createElement(RuleSetProgressList, { progress: ruleSetProgress(catalogue, statuses), active: null, onPick: () => {} }));
    expect(out).toContain(RS);
    expect(out).toContain(`0/${rsItems.length} approved`);
  });

  it('ItemList marks the selected row', () => {
    const groups = buildListGroups(catalogue, statuses, { grouping: 'source', filter: 'all', query: '', ruleSet: RS });
    const out = html(createElement(ItemList, { groups, selectedId: rsItems[1], onSelect: () => {} }));
    expect(out).toContain(`data-signoff-item="${rsItems[1]}"`);
    expect(out).toMatch(new RegExp(`aria-selected="true" data-signoff-item="${rsItems[1]}"`));
    expect(html(createElement(ItemList, { groups: [], selectedId: null, onSelect: () => {} }))).toContain('No items match');
  });

  it('ItemDetail shows the text, a link to the change log and the decision history', () => {
    const it0 = item(rsItems[0]);
    const history = [rec(it0.id, 'approved', '2026-10-01T12:00:00Z', { itemHash: 'ffffffffffffffff' })];
    const out = html(createElement(ItemDetail, { item: it0, status: 'changed', history, repoUrl: catalogue.repoUrl }));
    expect(out).toContain(`${catalogue.repoUrl}${it0.doc}#${it0.anchor}`);
    expect(out).toContain('<strong>Treatment effects and harms</strong>');
    expect(out).toContain('earlier wording');
    expect(out).toContain('Dr Test (doctor), 2026-10-01');
  });

  it('DecisionForm needs the attestation, asks for the amendment, and is read-only when it cannot record', () => {
    const draft = { decision: 'approved_with_amendment' as const, amendment: '', comment: '', attested: false, reviewerName: 'Dr Test' };
    const out = html(createElement(DecisionForm, { draft, onChange: () => {}, onSubmit: () => {}, canRecord: true, readOnlyReason: null, saving: false, message: null }));
    expect(out).toContain('I have reviewed this item against the cited source.');
    expect(out).toContain('Amendment (required)');
    expect(out).toMatch(/<button type="submit" disabled=""/);
    const ro = html(createElement(DecisionForm, { draft: { ...draft, attested: true }, onChange: () => {}, onSubmit: () => {}, canRecord: false, readOnlyReason: 'Read only', saving: false, message: null }));
    expect(ro).toContain('Read only');
    expect(ro).toMatch(/<button type="submit" disabled=""/);
    const ok = html(createElement(DecisionForm, { draft: { ...draft, decision: 'approved', attested: true }, onChange: () => {}, onSubmit: () => {}, canRecord: true, readOnlyReason: null, saving: false, message: { tone: 'ok', text: 'Decision recorded.' } }));
    expect(ok).not.toMatch(/<button type="submit" disabled=""/);
    expect(ok).toContain('Record: Approved');
    expect(ok).toContain('Decision recorded.');
  });
});

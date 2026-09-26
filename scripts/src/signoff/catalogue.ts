/**
 * Clinical sign-off catalogue — parses the repository's sign-off lists into stable, hashed items.
 *
 * Sources:
 *   - every docs/clinical-validation/changes/<slug>.md: its "## Needs sign-off" section (and any
 *     "### Needs sign-off (…)" addition). Items are numbered list entries ("3. …" → <slug>#3),
 *     labelled bullets ("- C1. …" → <slug>#C1), table rows whose first cell is a label
 *     ("| A1 | … |" → <slug>#A1), and a free paragraph after the first item ("Please confirm …"
 *     → <slug>#note-1). A paragraph ending in ":" is a group label, not an item.
 *   - docs/clinical-validation/SURGEON-DECISIONS.md sections A–G and I: table rows (A1, G2.13),
 *     F bullets (F1…), G3 (a paragraph under its own heading), I subsections (I1, or I2.1… when
 *     the subsection lists numbered defaults). Section H is the register itself and is skipped,
 *     and so is any I subsection written by signoff:apply (marked <!-- signoff:applied -->).
 *
 * Each item's hash is the first 16 hex digits of SHA-256 over its whitespace-normalised text, so
 * editing an item's wording makes a stored decision read "changed since approval"; renumbering
 * changes the id instead.
 *
 * Rule-set links (registry ids): a change log is linked to every registry entry that cites
 * "<slug>.md", plus EXTRA_LINKS below; a SURGEON-DECISIONS item to every entry whose text cites
 * it ("SURGEON-DECISIONS A1–A25, C5, G2 …"). Over-linking is the safe direction: a rule set
 * becomes "fully approved" only when every item linked to it is.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGUE_FORMAT } from '../../../artifacts/dashboard/src/lib/clinical-signoff/types';
import type {
  CatalogueItem, CatalogueRuleSet, CatalogueSource, SignoffCatalogue,
} from '../../../artifacts/dashboard/src/lib/clinical-signoff/types';

export const CHANGES_DIR = 'docs/clinical-validation/changes';
export const DECISIONS_DOC = 'docs/clinical-validation/SURGEON-DECISIONS.md';
export const REGISTRY_PATH = 'clinical-content/registry.json';
export const CATALOGUE_PATH = 'artifacts/dashboard/src/data/clinical-signoff-catalogue.json';
export const REPO_URL = 'https://github.com/amisesuite-afk/amise-medflow-emr-public/blob/main/';
export const DECISIONS_SOURCE = 'surgeon-decisions';
export const APPLIED_MARKER = '<!-- signoff:applied -->';

/**
 * Links the registry text does not state but the change log plainly covers (checked by hand
 * against the registry titles). Every id must exist in the registry, or the build fails.
 */
export const EXTRA_LINKS: Record<string, string[]> = {
  'fix-web-differential': ['pane-engine-disease-model', 'web-symptom-inference'],
  'diagnostic-reasoning': ['diagnostic-reasoning-rules', 'diagnostic-reasoning-web'],
  'fix-web-screening': ['cancer-screening'],
  'ios-screening-parity': ['ios-suspected-cancer-screening'],
};

export interface ParsedItem {
  number: string;
  group: string | null;
  title: string;
  text: string;
  anchor: string;
}

/** GitHub-style heading anchor. */
export function headingAnchor(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

export function normaliseText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function itemHash(text: string): string {
  return createHash('sha256').update(normaliseText(text), 'utf8').digest('hex').slice(0, 16);
}

function dedent(lines: string[]): string {
  const trimmedEnd = [...lines];
  while (trimmedEnd.length && !trimmedEnd[trimmedEnd.length - 1].trim()) trimmedEnd.pop();
  const rest = trimmedEnd.slice(1).filter(l => l.trim());
  const indent = rest.length ? Math.min(...rest.map(l => l.match(/^\s*/)![0].length)) : 0;
  return [trimmedEnd[0] ?? '', ...trimmedEnd.slice(1).map(l => l.slice(Math.min(indent, l.match(/^\s*/)![0].length)))].join('\n').trim();
}

export function titleOf(text: string): string {
  const first = text.split('\n')[0].trim();
  const bold = first.match(/^\*\*(.+?)\*\*/);
  const t = bold ? bold[1] : first;
  const clean = t.replace(/[*`]/g, '').replace(/[:.]\s*$/, '').trim();
  return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
}

function cells(row: string): string[] {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

const TABLE_ROW = /^\|.*\|\s*$/;
const TABLE_SEP = /^\|[\s:|-]+\|\s*$/;
const LABEL = /^[A-Z]\d+(?:\.\d+)?$/;

/**
 * Parses one change log's "Needs sign-off" section(s). Throws when the log has none, or when two
 * items get the same number.
 */
export function parseChangeLog(markdown: string, slug: string): ParsedItem[] {
  const lines = markdown.split('\n');
  const items: ParsedItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^(#{2,3})\s+(Needs sign-off\b.*)$/i);
    if (!h) continue;
    const level = h[1].length;
    const sectionAnchor = headingAnchor(h[2]);
    let end = i + 1;
    const stop = new RegExp(`^#{1,${level}}\\s`);
    while (end < lines.length && !stop.test(lines[end])) end++;
    items.push(...parseSection(lines.slice(i + 1, end), sectionAnchor));
    i = end - 1;
  }
  if (!items.length) throw new Error(`${slug}: no "Needs sign-off" items found`);
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.number)) throw new Error(`${slug}: duplicate sign-off item number ${it.number}`);
    seen.add(it.number);
  }
  return items;
}

function parseSection(lines: string[], sectionAnchor: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  let group: string | null = null;
  let groupAnchor: string | null = null;
  let cur: { number: string; lines: string[]; blank: boolean } | null = null;
  let header: string[] | null = null;
  let para: string[] = [];
  let notes = 0;

  const anchor = () => groupAnchor ?? sectionAnchor;
  const flush = () => {
    if (cur) {
      const text = dedent(cur.lines);
      out.push({ number: cur.number, group, title: titleOf(text), text, anchor: anchor() });
      cur = null;
    }
  };
  const flushPara = () => {
    if (!para.length) return;
    const text = para.join('\n').trim();
    para = [];
    if (/:\s*$/.test(text)) { group = text.replace(/:\s*$/, '').replace(/[*`]/g, '').trim(); return; }
    if (!out.length) return; // preamble
    notes++;
    out.push({ number: `note-${notes}`, group, title: titleOf(text), text, anchor: anchor() });
  };

  for (const line of lines) {
    const sub = line.match(/^#{3,6}\s+(.*)$/);
    if (sub) {
      flush(); flushPara(); header = null;
      group = sub[1].trim();
      groupAnchor = headingAnchor(group);
      continue;
    }
    const num = line.match(/^(\d+)\.\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+([A-Z]\d+(?:\.\d+)?)\.\s+(.*)$/);
    if (num || bullet) {
      flush(); flushPara(); header = null;
      const m = (num ?? bullet)!;
      cur = { number: m[1], lines: [m[2]], blank: false };
      continue;
    }
    if (TABLE_ROW.test(line)) {
      flush(); flushPara();
      if (TABLE_SEP.test(line)) continue;
      const c = cells(line);
      if (!header) { header = c; continue; }
      if (LABEL.test(c[0])) {
        const text = header.slice(1).map((hd, k) => `${hd}: ${c[k + 1] ?? ''}`).join('\n');
        out.push({ number: c[0], group, title: titleOf(c[1] ?? c[0]), text, anchor: anchor() });
      }
      continue;
    }
    header = null;
    if (!line.trim()) {
      if (cur) { cur.blank = true; cur.lines.push(''); }
      flushPara();
      continue;
    }
    if (cur && (/^\s/.test(line) || !cur.blank)) {
      cur.lines.push(line);
      continue;
    }
    flush();
    para.push(line);
  }
  flush(); flushPara();
  return out;
}

/** Parses SURGEON-DECISIONS.md sections A–G and I (H is the register). */
export function parseSurgeonDecisions(markdown: string): ParsedItem[] {
  const lines = markdown.split('\n');
  const out: ParsedItem[] = [];
  const sections: { letter: string; heading: string; body: string[] }[] = [];
  let curSec: { letter: string; heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+([A-Z])\.\s+(.*)$/);
    if (m) { curSec = { letter: m[1], heading: `${m[1]}. ${m[2]}`, body: [] }; sections.push(curSec); continue; }
    if (/^##\s/.test(line)) { curSec = null; continue; }
    if (curSec) curSec.body.push(line);
  }
  for (const sec of sections) {
    if (!'ABCDEFGI'.includes(sec.letter)) continue;
    const secAnchor = headingAnchor(sec.heading);
    // Split into ### subsections (G1, G2, G3, I1, I2 …).
    const subs: { heading: string | null; body: string[] }[] = [{ heading: null, body: [] }];
    for (const line of sec.body) {
      const s = line.match(/^###\s+(.*)$/);
      if (s) { subs.push({ heading: s[1].trim(), body: [] }); continue; }
      subs[subs.length - 1].body.push(line);
    }
    let fCount = 0;
    for (const sub of subs) {
      const group = sub.heading ?? sec.heading;
      const anchor = sub.heading ? headingAnchor(sub.heading) : secAnchor;
      const subLabel = sub.heading?.match(/^([A-Z]\d+)\.\s/)?.[1] ?? null;
      if (sub.body.some(l => l.includes(APPLIED_MARKER))) continue;
      const before = out.length;

      if (sec.letter === 'I' && subLabel) {
        // Numbered defaults ("  1. **Retention.** …") become I2.1 …; otherwise the whole subsection.
        let cur: { n: string; lines: string[] } | null = null;
        const numbered: { n: string; lines: string[] }[] = [];
        for (const line of sub.body) {
          const m = line.match(/^\s+(\d+)\.\s+(.*)$/);
          if (m) { cur = { n: m[1], lines: [m[2]] }; numbered.push(cur); continue; }
          if (cur && /^\s{3,}\S/.test(line)) { cur.lines.push(line); continue; }
          cur = null;
        }
        if (numbered.length) {
          for (const nb of numbered) {
            const text = dedent(nb.lines);
            out.push({ number: `${subLabel}.${nb.n}`, group, title: titleOf(text), text, anchor });
          }
        } else {
          const text = sub.body.join('\n').trim();
          out.push({ number: subLabel, group, title: titleOf(sub.heading!.replace(/^[A-Z]\d+\.\s+/, '')), text, anchor });
        }
        continue;
      }

      if (sec.letter === 'F') {
        let cur: string[] | null = null;
        const flushF = () => {
          if (!cur) return;
          fCount++;
          const text = dedent(cur);
          out.push({ number: `F${fCount}`, group, title: titleOf(text), text, anchor });
          cur = null;
        };
        for (const line of sub.body) {
          const b = line.match(/^-\s+(.*)$/);
          if (b) { flushF(); cur = [b[1]]; continue; }
          if (cur && /^\s+\S/.test(line)) { cur.push(line); continue; }
          flushF();
        }
        flushF();
        continue;
      }

      let header: string[] | null = null;
      for (const line of sub.body) {
        if (!TABLE_ROW.test(line)) { header = null; continue; }
        if (TABLE_SEP.test(line)) continue;
        const c = cells(line);
        if (!header) { header = c; continue; }
        if (!LABEL.test(c[0])) continue;
        const text = header.slice(1).map((hd, k) => `${hd}: ${c[k + 1] ?? ''}`).join('\n');
        out.push({ number: c[0], group, title: titleOf(c[1] ?? c[0]), text, anchor });
      }
      if (out.length === before && subLabel) {
        const text = sub.body.join('\n').trim();
        if (text) out.push({ number: subLabel, group, title: titleOf(sub.heading!.replace(/^[A-Z]\d+\.\s+/, '')), text, anchor });
      }
    }
  }
  const seen = new Set<string>();
  for (const it of out) {
    if (seen.has(it.number)) throw new Error(`SURGEON-DECISIONS: duplicate item ${it.number}`);
    seen.add(it.number);
  }
  return out;
}

// ── Rule-set links ──────────────────────────────────────────────────────────────────────────

interface RegistryRuleSet { id: string; title: string; reviewPriority?: string; lastReviewed?: string; reviewer?: string }
interface Registry { ruleSets: RegistryRuleSet[] }

/** Registry ids whose entry cites "<slug>.md" (not as the tail of a longer slug). */
export function registryLinksForChangeLog(registry: Registry, slug: string): string[] {
  const re = new RegExp(`(^|[^-\\w])${slug.replace(/[-]/g, '\\-')}\\.md`);
  return registry.ruleSets.filter(rs => re.test(JSON.stringify(rs))).map(rs => rs.id);
}

/** Expands "A1–A25, B1–B16, G2 content, C9/C1: …" after "SURGEON-DECISIONS" into labels/prefixes. */
export function parseDecisionRefs(text: string): string[] {
  const out: string[] = [];
  const re = /SURGEON-DECISIONS(?:\.md)?\s+([^"]*)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    for (const raw of m[1].split(/\s*[,/]\s*|\s+and\s+/)) {
      const t = raw.match(/^([A-I])(\d+(?:\.\d+)?)?(?:[–-][A-I]?(\d+(?:\.\d+)?))?/);
      if (!t) break;
      const [whole, letter, from, to] = t;
      if (!from) out.push(`${letter}*`);
      else if (to) {
        const [fa, fb] = from.split('.');
        const [ta, tb] = to.split('.');
        if (fb !== undefined && tb !== undefined && fa === ta) {
          for (let k = Number(fb); k <= Number(tb); k++) out.push(`${letter}${fa}.${k}`);
        } else if (fb === undefined && tb === undefined) {
          for (let k = Number(from); k <= Number(to); k++) out.push(`${letter}${k}`);
        } else out.push(`${letter}${from}`);
      } else out.push(`${letter}${from}`);
      // "G2 content", "E2: cardiac …", "A22). See …": the token ran on into prose — stop here.
      if (raw.slice(whole.length).trim()) break;
    }
  }
  return out;
}

/** Does a SURGEON-DECISIONS item number match a reference ("A*", "G2", "G2.13", "A5")? */
export function refMatches(ref: string, number: string): boolean {
  if (ref.endsWith('*')) return number.startsWith(ref.slice(0, -1));
  if (ref === number) return true;
  // "G2" covers G2.1 … G2.19 (a subsection reference).
  return /^[A-Z]\d+$/.test(ref) && number.startsWith(`${ref}.`);
}

// ── Build ───────────────────────────────────────────────────────────────────────────────────

function docTitle(markdown: string, fallback: string): string {
  const m = markdown.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

export interface CatalogueInputs {
  decisions: string;
  changeLogs: { slug: string; markdown: string }[];
  registry: Registry;
}

export function readCatalogueInputs(repoRoot: string): CatalogueInputs {
  const dir = join(repoRoot, CHANGES_DIR);
  const changeLogs = readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => ({ slug: f.replace(/\.md$/, ''), markdown: readFileSync(join(dir, f), 'utf8') }));
  return {
    decisions: readFileSync(join(repoRoot, DECISIONS_DOC), 'utf8'),
    changeLogs,
    registry: JSON.parse(readFileSync(join(repoRoot, REGISTRY_PATH), 'utf8')) as Registry,
  };
}

export function buildCatalogue(inputs: CatalogueInputs): SignoffCatalogue {
  const known = new Map(inputs.registry.ruleSets.map(rs => [rs.id, rs]));
  for (const [slug, ids] of Object.entries(EXTRA_LINKS)) {
    for (const id of ids) if (!known.has(id)) throw new Error(`EXTRA_LINKS[${slug}]: ${id} is not a registry rule set`);
  }
  const items: CatalogueItem[] = [];
  const sources: CatalogueSource[] = [];

  // SURGEON-DECISIONS first: it is the register the surgeon answers.
  const decisionRefs = inputs.registry.ruleSets.map(rs => ({ id: rs.id, refs: parseDecisionRefs(JSON.stringify(rs)) }));
  const dItems = parseSurgeonDecisions(inputs.decisions).map((p): CatalogueItem => ({
    id: `${DECISIONS_SOURCE}#${p.number}`,
    source: DECISIONS_SOURCE,
    number: p.number,
    group: p.group,
    title: p.title,
    text: p.text,
    hash: itemHash(p.text),
    doc: DECISIONS_DOC,
    anchor: p.anchor,
    ruleSetIds: decisionRefs.filter(d => d.refs.some(r => refMatches(r, p.number))).map(d => d.id),
  }));
  items.push(...dItems);
  sources.push({
    id: DECISIONS_SOURCE,
    title: 'SURGEON-DECISIONS — decisions for the surgeon (A–G, I)',
    doc: DECISIONS_DOC,
    anchor: '',
    ruleSetIds: [...new Set(dItems.flatMap(i => i.ruleSetIds))],
    itemIds: dItems.map(i => i.id),
  });

  for (const log of inputs.changeLogs) {
    if (!/^#{2,3}\s+Needs sign-off\b/im.test(log.markdown)) continue;
    const ruleSetIds = [...new Set([...registryLinksForChangeLog(inputs.registry, log.slug), ...(EXTRA_LINKS[log.slug] ?? [])])];
    const doc = `${CHANGES_DIR}/${log.slug}.md`;
    const parsed = parseChangeLog(log.markdown, log.slug).map((p): CatalogueItem => ({
      id: `${log.slug}#${p.number}`,
      source: log.slug,
      number: p.number,
      group: p.group,
      title: p.title,
      text: p.text,
      hash: itemHash(p.text),
      doc,
      anchor: p.anchor,
      ruleSetIds,
    }));
    items.push(...parsed);
    sources.push({
      id: log.slug, title: docTitle(log.markdown, log.slug), doc, anchor: 'needs-sign-off', ruleSetIds, itemIds: parsed.map(i => i.id),
    });
  }

  const ruleSets: CatalogueRuleSet[] = inputs.registry.ruleSets
    .map(rs => ({
      id: rs.id,
      title: rs.title,
      reviewPriority: rs.reviewPriority ?? 'unknown',
      lastReviewed: rs.lastReviewed ?? 'unknown',
      reviewer: rs.reviewer ?? 'unknown',
      itemIds: items.filter(i => i.ruleSetIds.includes(rs.id)).map(i => i.id),
    }))
    .filter(rs => rs.itemIds.length > 0);

  const catalogueHash = createHash('sha256').update(items.map(i => `${i.id}:${i.hash}`).join('\n')).digest('hex').slice(0, 16);
  return { format: CATALOGUE_FORMAT, catalogueHash, repoUrl: REPO_URL, sources, ruleSets, items };
}

export function serialiseCatalogue(c: SignoffCatalogue): string {
  return `${JSON.stringify(c, null, 2)}\n`;
}

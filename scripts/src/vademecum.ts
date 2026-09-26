/**
 * Disease-centred vademecum (phase 1, shadow): reference checks run by `lint:vademecum`
 * (lint-vademecum.ts) and unit-tested in vademecum-content.test.ts.
 *
 * lint:shared-content already validates each file against its JSON Schema and checks the Swift
 * and TypeScript types. This checks what a schema cannot:
 *   - every finding a disease names (links, criteria, pathognomonic, exclusions, incidental
 *     triggers and steps) is in the dictionary, and a link sits under its finding's level;
 *   - a finding's PANE id, examination sign, decision-rule band and laboratory analyte exist, and
 *     its dimension has a question;
 *   - a disease's PANE id, iOS candidate name and decision exist; disease ids are unique across
 *     areas; `related` names a disease of another area; the complaint frames are history frames;
 *   - likelihood ratios: a range brackets its point; a referenced sign / rule band carries no ratio
 *     of its own and resolves for the disease (it is one of the sign's or rule's targets); an own
 *     link has at least one ratio; "absence meaningful" needs a negative ratio;
 *   - criteria logic is well formed (each operator has its fields, atLeast k ≤ items, rule bands
 *     exist); a pathognomonic entry is either definitive or has a ratio and is not also a link;
 *     an exclusion names a finding or a sex; an incidental work-up names a classification criteria
 *     of the same disease and triggers that can start a case;
 *   - phase 1 is unreviewed: nothing is marked signed off and lastReviewed stays "unknown".
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DISEASES, FEATURES } from '../../lib/pane-engine/src/index';
import { DECISION_CONTENT } from '../../lib/pane-engine/src/decision/index';
import { DECISION_RULES, EXAM_SIGNS } from '../../lib/pane-engine/src/evidence/catalogue';
import { HISTORY_FRAMES } from '../../lib/triage-engine/src/history-frames/frames';
import { LAB_ANALYTES } from '../../lib/triage-engine/src/report-import/catalog';
import { loadVademecum } from '../../lib/pane-engine/src/vademecum-loop/model';
import type {
  CriteriaNode, VademecumAreaFile, VademecumDisease, VademecumFindingsFile, VademecumLevel,
} from '../../lib/pane-engine/src/vademecum-loop/types';

export const VADEMECUM_FILES = ['findings', 'abdominal-pain', 'cough-breathlessness'] as const;
const LEVELS: VademecumLevel[] = ['history', 'exam', 'score', 'investigation'];

export interface VademecumFiles {
  dictionary: VademecumFindingsFile;
  areas: VademecumAreaFile[];
}

export function readVademecum(repoRoot: string): VademecumFiles {
  const read = (n: string) => JSON.parse(readFileSync(join(repoRoot, 'clinical-content/vademecum', `${n}.json`), 'utf8'));
  return { dictionary: read('findings'), areas: VADEMECUM_FILES.slice(1).map(read) };
}

function iosCandidateNames(repoRoot: string): Set<string> {
  const db = JSON.parse(readFileSync(join(repoRoot, 'ios/AmiseMedFlow/Resources/DiagnosticDatabase.json'), 'utf8')) as { pools: Record<string, { candidates: { name: string }[] }> };
  const out = new Set<string>();
  for (const pool of Object.values(db.pools)) for (const c of pool.candidates) out.add(c.name);
  return out;
}

export interface VademecumStats {
  findings: number;
  diseases: number;
  links: number;
  bySeed: Record<string, number>;
  withRange: number;
  fromMemory: number;
  criteria: number;
  pathognomonic: number;
  exclusions: number;
  incidental: number;
  entryPoints: number;
}

/** Every reference problem (empty = OK), and counts for the report. */
export function checkVademecum(files: VademecumFiles, repoRoot: string): { problems: string[]; stats: VademecumStats } {
  const problems: string[] = [];
  const { dictionary, areas } = files;
  const findings = new Map(dictionary.findings.map(f => [f.id, f]));
  const paneFeatures = new Set(FEATURES.map(f => f.id));
  const paneDiseases = new Set(DISEASES.map(d => d.id));
  const signs = new Map(EXAM_SIGNS.signs.map(s => [s.id, s]));
  const rules = new Map(DECISION_RULES.rules.map(r => [r.id, r]));
  const decisions = new Set(DECISION_CONTENT.decisions.map(d => d.id));
  const frames = new Set(HISTORY_FRAMES.map(f => f.id));
  const analytes = new Set(LAB_ANALYTES.map(a => a.name));
  const iosNames = iosCandidateNames(repoRoot);
  const stats: VademecumStats = {
    findings: dictionary.findings.length, diseases: 0, links: 0, bySeed: {}, withRange: 0, fromMemory: 0,
    criteria: 0, pathognomonic: 0, exclusions: 0, incidental: 0, entryPoints: dictionary.findings.filter(f => f.entryPoint !== null).length,
  };

  if (dictionary.lastReviewed !== 'unknown') problems.push('findings.json: lastReviewed must stay "unknown" in phase 1 (no documented clinical review)');
  if (dictionary.policy.levels.join() !== LEVELS.join()) problems.push(`findings.json policy.levels must be ${LEVELS.join(', ')}`);
  if (dictionary.policy.defaultThresholds.test >= dictionary.policy.defaultThresholds.treat) problems.push('findings.json: default test threshold must be below the treat threshold');
  if (dictionary.policy.cantMissThresholds.test >= dictionary.policy.cantMissThresholds.treat) problems.push('findings.json: can\'t-miss test threshold must be below the treat threshold');
  if (dictionary.policy.cantMissSlots > dictionary.policy.displaySlots) problems.push('findings.json: cantMissSlots cannot exceed displaySlots');

  // ── Dictionary ──────────────────────────────────────────────────────────────────────────
  const seen = new Set<string>();
  for (const f of dictionary.findings) {
    const where = `findings.json ${f.id}`;
    if (seen.has(f.id)) problems.push(`${where}: duplicate id`);
    seen.add(f.id);
    if (!dictionary.dimensions[f.dimension]) problems.push(`${where}: dimension "${f.dimension}" has no question in dimensions`);
    if (f.pane && !paneFeatures.has(f.pane)) problems.push(`${where}: PANE feature "${f.pane}" does not exist`);
    if (f.examSign) {
      if (!signs.has(f.examSign)) problems.push(`${where}: examination sign "${f.examSign}" is not in exam-signs.json`);
      if (f.level !== 'exam') problems.push(`${where}: an examination sign belongs to the exam level`);
      if (f.id !== `sign.${f.examSign}`) problems.push(`${where}: an examination-sign finding is named sign.<sign id>`);
    }
    if (f.decisionRule) {
      const rule = rules.get(f.decisionRule.rule);
      if (!rule) problems.push(`${where}: decision rule "${f.decisionRule.rule}" is not in decision-rules.json`);
      else if (!rule.bands.some(b => b.id === f.decisionRule!.band)) problems.push(`${where}: rule ${rule.id} has no band "${f.decisionRule.band}"`);
      if (f.level !== 'score') problems.push(`${where}: a decision-rule band belongs to the score level`);
      if (f.id !== `rule.${f.decisionRule.rule}.${f.decisionRule.band}`) problems.push(`${where}: a rule-band finding is named rule.<rule>.<band>`);
    }
    if (f.lab && !analytes.has(f.lab.analyte)) problems.push(`${where}: laboratory analyte "${f.lab.analyte}" is not a catalogue saved name (report-import catalog.ts)`);
    if (f.lab && f.level !== 'investigation') problems.push(`${where}: a laboratory finding belongs to the investigation level`);
    if (f.demographic && (f.level !== 'history' || f.dimension !== 'demographic')) problems.push(`${where}: a demographic finding is history / demographic`);
    if (f.demographic && f.entryPoint !== null) problems.push(`${where}: a demographic finding cannot start a case`);
    if (f.entryPoint === 'lab' && f.level !== 'investigation') problems.push(`${where}: a laboratory entry point belongs to the investigation level`);
    if ((f.entryPoint === 'imaging' || f.entryPoint === 'pathology') && f.level !== 'investigation') problems.push(`${where}: an imaging / pathology entry point belongs to the investigation level`);
  }

  // ── Areas and diseases ──────────────────────────────────────────────────────────────────────
  const diseaseIds = new Map<string, string>();
  for (const area of areas) for (const d of area.diseases) {
    if (diseaseIds.has(d.id)) problems.push(`${area.area} ${d.id}: disease id also in ${diseaseIds.get(d.id)} (define a disease once; list it in "related")`);
    diseaseIds.set(d.id, area.area);
  }
  const v = loadVademecum(dictionary, areas);
  const checkNode = (where: string, n: CriteriaNode, d: VademecumDisease) => {
    const need = (cond: boolean, msg: string) => { if (!cond) problems.push(`${where}: ${msg}`); };
    switch (n.op) {
      case 'all': case 'any':
        need(!!n.items?.length, `${n.op} needs items`); break;
      case 'atLeast':
        need(!!n.items?.length && n.k !== undefined && n.k <= n.items.length, 'atLeast needs items and 1 ≤ k ≤ items'); break;
      case 'points':
        need(!!n.items?.length && n.min !== undefined, 'points needs items and min');
        for (const c of n.items ?? []) need(c.weight !== undefined, 'every item of points needs a weight');
        break;
      case 'finding':
        need(!!n.finding && findings.has(n.finding), `unknown finding "${n.finding}"`); break;
      case 'rule': {
        const rule = rules.get(n.rule ?? '');
        need(!!rule, `unknown decision rule "${n.rule}"`);
        for (const b of n.bands ?? []) need(!!rule?.bands.some(x => x.id === b), `rule ${n.rule} has no band "${b}"`);
        for (const b of n.bands ?? []) need(findings.has(`rule.${n.rule}.${b}`), `rule band finding rule.${n.rule}.${b} is not in the dictionary`);
        break;
      }
      case 'external':
        need(!!n.evaluator, 'external needs an evaluator'); break;
      case 'age':
        need(n.min !== undefined || n.max !== undefined, 'age needs min or max'); break;
      case 'sex':
        need(!!n.sex, 'sex needs sex'); break;
    }
    for (const c of [...(n.items ?? []), ...(n.fallback ?? [])]) checkNode(where, c, d);
  };
  for (const area of areas) {
    const at = (d: VademecumDisease) => `${area.area} ${d.id}`;
    if (area.lastReviewed !== 'unknown') problems.push(`${area.area}: lastReviewed must stay "unknown" in phase 1`);
    for (const fr of area.complaints.frames) if (!frames.has(fr)) problems.push(`${area.area}: complaint frame "${fr}" is not a history frame`);
    for (const r of area.related) {
      if (!diseaseIds.has(r)) problems.push(`${area.area}: related disease "${r}" is not defined`);
      else if (diseaseIds.get(r) === area.area) problems.push(`${area.area}: related disease "${r}" is already in this area`);
    }
    for (const d of area.diseases) {
      stats.diseases++;
      const w = at(d);
      if (d.pane && !paneDiseases.has(d.pane)) problems.push(`${w}: PANE disease "${d.pane}" does not exist`);
      if (d.ios && !iosNames.has(d.ios)) problems.push(`${w}: iOS candidate "${d.ios}" is not in DiagnosticDatabase.json`);
      if (d.decision && !decisions.has(d.decision)) problems.push(`${w}: decision "${d.decision}" is not in treatment-decisions.json`);
      if (d.signOff !== 'pending') problems.push(`${w}: phase 1 content is unreviewed (signOff must be "pending")`);
      const linkIds = new Set<string>();
      const loaded = v.diseases.get(d.id)!;
      for (const level of LEVELS) {
        for (const l of d.findings[level]) {
          stats.links++;
          stats.bySeed[l.seed] = (stats.bySeed[l.seed] ?? 0) + 1;
          if (l.fromMemory) stats.fromMemory++;
          const lw = `${w} ${l.finding}`;
          const f = findings.get(l.finding);
          if (!f) { problems.push(`${lw}: not in the finding dictionary`); continue; }
          if (f.level !== level) problems.push(`${lw}: listed under ${level} but the finding is ${f.level}`);
          if (linkIds.has(l.finding)) problems.push(`${lw}: listed twice`);
          linkIds.add(l.finding);
          for (const r of [l.lrPositive, l.lrNegative]) {
            if (!r) continue;
            if (r.low !== undefined && r.high !== undefined) {
              stats.withRange++;
              if (!(r.low <= r.point && r.point <= r.high)) problems.push(`${lw}: range ${r.low}–${r.high} does not bracket ${r.point}`);
            }
          }
          const ref = l.seed === 'exam-signs' || l.seed === 'decision-rules';
          if (ref) {
            if (l.lrPositive || l.lrNegative) problems.push(`${lw}: a referenced ${l.seed} finding takes its ratios from that file (lrPositive / lrNegative must be null)`);
            if (l.seed === 'exam-signs' && !f.examSign) problems.push(`${lw}: seed exam-signs but the finding references no examination sign`);
            if (l.seed === 'decision-rules' && !f.decisionRule) problems.push(`${lw}: seed decision-rules but the finding references no decision rule`);
            if ((loaded.links.get(l.finding)?.lrPositive ?? null) === null) problems.push(`${lw}: the referenced ${l.seed} ratio does not apply to this disease (not one of its targets)`);
          } else {
            if (!l.lrPositive && !l.lrNegative) problems.push(`${lw}: needs lrPositive or lrNegative`);
            if (l.negativeMeaningful && !l.lrNegative) problems.push(`${lw}: absence meaningful without lrNegative`);
            if (f.examSign || f.decisionRule) problems.push(`${lw}: an examination-sign / rule-band finding must be referenced (seed ${f.examSign ? 'exam-signs' : 'decision-rules'})`);
          }
        }
      }
      for (const c of d.criteria) {
        stats.criteria++;
        for (const l of c.levels) checkNode(`${w} criteria ${c.id}/${l.id}`, l.when, d);
      }
      for (const p of d.pathognomonic) {
        stats.pathognomonic++;
        const pw = `${w} pathognomonic ${p.finding}`;
        if (!findings.has(p.finding)) problems.push(`${pw}: not in the finding dictionary`);
        if (p.definitive === !!p.lrPositive) problems.push(`${pw}: either definitive (no ratio) or a likelihood ratio`);
        if (linkIds.has(p.finding)) problems.push(`${pw}: also an ordinary link (it would count twice)`);
        for (const r of p.requires ?? []) if (!findings.has(r)) problems.push(`${pw}: required finding "${r}" is not in the dictionary`);
      }
      for (const e of d.exclusions) {
        stats.exclusions++;
        if (!e.finding && !e.sex) problems.push(`${w} exclusion ${e.id}: needs a finding or a sex`);
        if (e.finding && !findings.has(e.finding)) problems.push(`${w} exclusion ${e.id}: unknown finding "${e.finding}"`);
      }
      const wu = d.workupWhenIncidental;
      if (wu) {
        stats.incidental++;
        for (const t of wu.trigger) {
          const f = findings.get(t);
          if (!f) problems.push(`${w} work-up trigger "${t}" is not in the dictionary`);
          else if (f.entryPoint === null) problems.push(`${w} work-up trigger "${t}" cannot start a case (entryPoint null)`);
        }
        if (wu.classification && !d.criteria.some(c => c.id === wu.classification && c.kind === 'classification')) {
          problems.push(`${w}: work-up classification "${wu.classification}" is not a classification criteria of this disease`);
        }
        for (const s of wu.steps) if (s.when) checkNode(`${w} work-up ${s.id}`, s.when, d);
      }
      if (!d.seedFromComplaint && !wu && ![...linkIds].some(id => findings.get(id)?.entryPoint)) {
        problems.push(`${w}: not offered from the complaint and has no entry-point finding or incidental work-up (it could never be a candidate)`);
      }
    }
  }
  return { problems, stats };
}

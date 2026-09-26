/**
 * Evidence-based examination signs and decision rules (evidence-exam 1.0.0): the shared files
 * clinical-content/rules/exam-signs.json and decision-rules.json. lint:shared-content validates
 * them against their schemas and checks the Swift and TypeScript types that read them; this test
 * checks what a schema cannot: the web engine reads these files, the cross-references resolve, and
 * nothing is marked reviewed or verified without a named reviewer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DECISION_RULES, EXAM_SIGNS } from '../../lib/pane-engine/src/evidence/catalogue';
import { HISTORY_FRAMES, classifyComplaint } from '../../lib/triage-engine/src/history-frames/index';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const readJson = (p: string) => JSON.parse(readFileSync(join(REPO_ROOT, p), 'utf8'));

const signs = readJson('clinical-content/rules/exam-signs.json');
const rules = readJson('clinical-content/rules/decision-rules.json');

describe('examination-sign and decision-rule catalogues', () => {
  it('the web engine reads the shared files', () => {
    expect(EXAM_SIGNS).toEqual(signs);
    expect(DECISION_RULES).toEqual(rules);
  });

  it('ids are unique and every cross-reference resolves', () => {
    const signIds = signs.signs.map((s: { id: string }) => s.id);
    const ruleIds = rules.rules.map((r: { id: string }) => r.id);
    expect(new Set(signIds).size).toBe(signIds.length);
    expect(new Set(ruleIds).size).toBe(ruleIds.length);
    for (const s of signs.signs) {
      expect(signs.targetGroups[s.target.group], `${s.id} target`).toBeDefined();
      for (const a of s.alsoTargets ?? []) expect(signs.targetGroups[a.group], `${s.id} alsoTargets`).toBeDefined();
      for (const p of s.presentations) expect(signs.presentations[p], `${s.id} presentation ${p}`).toBeDefined();
    }
    for (const r of rules.rules) {
      for (const id of r.components.signs) expect(signIds, `${r.id} component`).toContain(id);
      for (const id of r.supersededBy) expect(ruleIds, `${r.id} supersededBy`).toContain(id);
      if (r.appliesWhen) expect(ruleIds, `${r.id} appliesWhen`).toContain(r.appliesWhen.rule);
      for (const p of r.presentations) expect(signs.presentations[p], `${r.id} presentation ${p}`).toBeDefined();
    }
  });

  it('the Exam step reads the complaint through the history frames: every frame has an entry', () => {
    const frames = signs.frames as Record<string, { region: string; presentations: string[] }>;
    for (const f of HISTORY_FRAMES) {
      expect(frames[f.id] ?? frames[f.type], `exam-signs.json frames has no entry for history frame ${f.id}`).toBeDefined();
    }
    for (const [id, f] of Object.entries(frames)) {
      for (const t of f.presentations) expect(signs.presentations[t], `frames.${id}: presentation ${t}`).toBeDefined();
    }
    // Every region has its label and chips on iOS (ExamRegion.swift).
    const swift = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services/ExamRegion.swift'), 'utf8');
    for (const region of new Set(Object.values(frames).map(f => f.region))) {
      expect(swift, `ExamRegion.swift has no region "${region}"`).toContain(`id: "${region}"`);
    }
  });

  it('a cough or breathlessness is examined at the chest, never the abdomen by default', () => {
    const regionOf = (complaint: string) => {
      const c = classifyComplaint(complaint);
      return (signs.frames[c.frameId] ?? signs.frames[c.type]).region;
    };
    expect(regionOf('Cough')).toBe('chest-respiratory');
    expect(regionOf('Shortness of breath')).toBe('chest-respiratory');
    expect(regionOf('Chest pain')).toBe('chest-cardiac');
    expect(regionOf('Groin lump')).toBe('groin');
    expect(regionOf('Lump on the back')).toBe('lump');
    expect(regionOf('Neck lump')).toBe('neck');
    expect(regionOf('Right iliac fossa pain')).toBe('abdomen');
    expect(regionOf('Follow-up')).toBe('general');
  });

  it('nothing is marked reviewed or verified without a named reviewer', () => {
    for (const c of [signs, rules]) {
      expect(c.lastReviewed).toBe('unknown');
      expect(c.reviewer).toBe('unknown');
    }
    for (const s of signs.signs) expect(s.fromMemory, s.id).toBe(true);
    for (const r of rules.rules) expect(r.fromMemory, r.id).toBe(true);
  });
});

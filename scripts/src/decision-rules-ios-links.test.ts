/**
 * decision-rules.json `ios` links (ios-outcomes-calculators): every rule linked to an iOS calculator
 * names a real ActiveScore case, a Patient field and a BayesianDiagnosisEngine.infer parameter, and the
 * Swift code reads that field into the rule's band (the infer call of the Diagnosis step and the
 * stored value shown on the Exam step). Read from source: Swift is not compiled in CI here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const ios = (p: string) => readFileSync(join(ROOT, 'ios/AmiseMedFlow', p), 'utf8');

const rules = (JSON.parse(readFileSync(join(ROOT, 'clinical-content/rules/decision-rules.json'), 'utf8')) as {
  rules: { id: string; kind: string; ios: { param: string; activeScore: string } | null }[];
}).rules;
const categories = ios('Views/Scores/ClinicalScoreCategories.swift');
const patient = ios('Models/Patient.swift');
const engine = ios('Services/BayesianDiagnosisEngine.swift');
const inferSignature = engine.slice(engine.indexOf('static func infer('), engine.indexOf(') -> [DiagnosisResult]'));
const diagnosisTab = ios('Views/Consultation/ConsultationView+DiagnosisTab.swift');
const examSigns = ios('Views/Consultation/ExamSignsSection.swift');
const persistence = ios('Services/ScorePersistence.swift');

describe('decision-rules.json iOS links', () => {
  const linked = rules.filter(r => r.ios);

  it('links the rules that have an iOS calculator', () => {
    for (const id of ['stone', 'ottawa-ankle', 'ottawa-knee', 'canadian-ct-head', 'nexus', 'canadian-c-spine', 'sf-syncope', 'canadian-syncope']) {
      expect(linked.some(r => r.id === id), id).toBe(true);
    }
  });

  for (const r of rules.filter(x => x.ios)) {
    it(`${r.id} → ${r.ios!.activeScore} / ${r.ios!.param}`, () => {
      const { param, activeScore } = r.ios!;
      expect(categories, 'ActiveScore case').toMatch(new RegExp(`\\bcase ${activeScore}\\s*=`));
      expect(patient, 'Patient field').toMatch(new RegExp(`\\bvar ${param}: (Int|Double)\\?`));
      expect(inferSignature, 'infer parameter').toMatch(new RegExp(`\\b${param}: (Int|Double)\\? = nil`));
      expect(examSigns, 'Exam step stored value').toMatch(new RegExp(`case "${r.id}":\\s+return patient\\.${param}`));
      expect(persistence, 'saved on the patient').toMatch(new RegExp(`case \\.${activeScore}:\\s+patient\\.${param}\\s+=`));
      if (r.kind === 'diagnostic') {
        // Prognostic rules never change the differential (DecisionRuleEvidence.observedBands).
        expect(engine, 'read into the rule values').toMatch(new RegExp(`if let v = ${param} \\{ ruleValues\\["${r.id}"\\]`));
        expect(diagnosisTab, 'passed by the Diagnosis step').toMatch(new RegExp(`${param}: patient\\.${param}`));
      }
    });
  }
});

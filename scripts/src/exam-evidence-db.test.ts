/**
 * DiagnosticDatabase.json 2.2.0: the examination-sign and decision-rule features are exactly what
 * scripts/src/gen-exam-evidence-db.ts produces from clinical-content/rules (run it after changing
 * a catalogue), and the Swift scorer handles their keys.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACNES_NAME, DB_FILE, EVIDENCE_DB_VERSION, generatedDatabaseText, logLR, matches } from './gen-exam-evidence-db';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const raw = readFileSync(DB_FILE, 'utf8');
const db = JSON.parse(raw);
const signs = JSON.parse(readFileSync(join(REPO_ROOT, 'clinical-content/rules/exam-signs.json'), 'utf8'));
const rules = JSON.parse(readFileSync(join(REPO_ROOT, 'clinical-content/rules/decision-rules.json'), 'utf8'));

interface F { key: string; value: string; logLR: number; likelihoodRatio?: number; citation?: string }
const evidence: { candidate: string; f: F }[] = [];
for (const pool of Object.values(db.pools as Record<string, { candidates: { name: string; features: F[] }[] }>)) {
  for (const c of pool.candidates) for (const f of c.features) if (f.key === 'sign' || f.key === 'rule') evidence.push({ candidate: c.name, f });
}

describe('DiagnosticDatabase.json examination evidence (2.2.0)', () => {
  it('is what the generator produces from the catalogues', () => {
    expect(db.version).toBe(EVIDENCE_DB_VERSION);
    expect(generatedDatabaseText(raw)).toBe(raw);
  });

  it('every sign / rule feature names a catalogue entry, cites it and carries logLR = round(5 ln LR)', () => {
    const signIds = new Set(signs.signs.map((s: { id: string }) => s.id));
    const ruleBands = new Set(rules.rules.flatMap((r: { id: string; bands: { id: string }[] }) => r.bands.map(b => `${r.id}:${b.id}`)));
    expect(evidence.length).toBeGreaterThan(500);
    for (const { candidate, f } of evidence) {
      if (f.key === 'sign') {
        const [id, state] = f.value.split(':');
        expect(signIds.has(id), `${candidate}: ${f.value}`).toBe(true);
        expect(['present', 'absent']).toContain(state);
      } else {
        expect(ruleBands.has(f.value), `${candidate}: ${f.value}`).toBe(true);
      }
      expect(f.logLR).toBe(logLR(f.likelihoodRatio!));
      expect(f.citation).toMatch(/(19|20)\d\d/);
    }
  });

  it('matches name fragments at word starts only', () => {
    expect(matches('Parathyroid Carcinoma', ['thyroid carcinoma'])).toBe(false);
    expect(matches('Thyroid Carcinoma', ['thyroid carcinoma'])).toBe(true);
    expect(matches('Colorectal Cancer Screening (Asymptomatic)', ['rectal cancer'])).toBe(false);
  });

  it("Carnett's sign has a target: the curated abdominal-wall-pain candidate in the abdominal pain presentation", () => {
    expect(evidence.some(e => e.candidate === ACNES_NAME && e.f.value === 'carnett:present')).toBe(true);
    expect(db.presentations.find((p: { id: string }) => p.id === 'abdominalPain').candidates).toContain(ACNES_NAME);
  });

  it('the Swift scorer reads the "sign" and "rule" keys', () => {
    const swift = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services/BayesianDiagnosisEngine+Scoring.swift'), 'utf8');
    expect(swift).toMatch(/case "sign":/);
    expect(swift).toMatch(/case "rule":/);
  });
});

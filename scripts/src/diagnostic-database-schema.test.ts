import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contentProblems, decodeProblems, nonIntegerLiterals } from './diagnostic-database-schema';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const RAW = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Resources/DiagnosticDatabase.json'), 'utf8');
const DB = JSON.parse(RAW) as Record<string, unknown>;

const candidate = (over: Record<string, unknown> = {}, feature: Record<string, unknown> = {}) => ({
  name: 'X', icd: 'K00', logPrior: 0, urgency: 1,
  features: [{ key: 'finding', value: 'pain', logLR: 3, evidenceLabel: 'Pain', ...feature }],
  ...over,
});
const db = (c: unknown, extra: Record<string, unknown> = {}) => ({ version: '1', pools: { p: { candidates: [c] } }, ...extra });

describe('bundled DiagnosticDatabase.json', () => {
  it('decodes with the iOS Codable structs (otherwise the differential uses its fallback lists)', () => {
    expect(decodeProblems(DB, RAW)).toEqual([]);
  });

  it('meets the 2.0.0 content rules', () => {
    expect(contentProblems(DB)).toEqual([]);
  });

  it('is version 2.0.0 or later', () => {
    expect(Number(String(DB.version).split('.')[0])).toBeGreaterThanOrEqual(2);
  });
});

describe('decodeProblems mirrors the Swift structs', () => {
  it('accepts a minimal valid file', () => {
    expect(decodeProblems(db(candidate()))).toEqual([]);
  });

  it('rejects a fractional logLR (the 1.0.0 natural-log pools)', () => {
    expect(decodeProblems(db(candidate({}, { logLR: 1.1 }))).map(p => p.kind))
      .toContain('feature "logLR" missing or not an integer');
  });

  it('rejects a missing evidenceLabel and a non-string value', () => {
    const kinds = decodeProblems(db(candidate({}, { evidenceLabel: undefined, value: true }))).map(p => p.kind);
    expect(kinds).toContain('feature "evidenceLabel" missing or not a string');
    expect(kinds).toContain('feature "value" missing or not a string');
  });

  it('rejects a fractional logPrior and a malformed applicability', () => {
    const kinds = decodeProblems(db(candidate({ logPrior: -2.3, applicability: { minAgeYears: '16' } }))).map(p => p.kind);
    expect(kinds).toContain('candidate "logPrior" missing or not an integer');
    expect(kinds).toContain('applicability "minAgeYears" not an integer');
  });

  it('rejects a malformed presentations list', () => {
    expect(decodeProblems(db(candidate(), { presentations: [{ id: 'a', keywords: 'pain', candidates: [] }] })).map(p => p.kind))
      .toContain('presentation is not { id: String, keywords: [String], candidates: [String] }');
  });

  it('finds integer fields written as decimals in the raw text', () => {
    expect(nonIntegerLiterals('{"logLR": 3.0, "logPrior": -1e1, "urgency": 2}')).toEqual(['logLR: 3.0', 'logPrior: -1e1']);
  });
});

describe('contentProblems', () => {
  const core = (features: unknown[], extra: Record<string, unknown> = {}) => ({
    version: '2.0.0',
    pools: {
      legacy: { candidates: [candidate({ name: 'Old' })] },
      coreConditions: { candidates: [{ ...candidate({ name: 'New', source: 'NICE NG1 (2020)' }), features, ...extra }] },
    },
    presentations: [{ id: 'p', keywords: ['pain'], candidates: ['New'] }],
  });
  const good = { key: 'finding', value: 'pain', logLR: 5, likelihoodRatio: 2.7, evidenceLabel: 'Pain', citation: 'X 2020' };

  it('accepts a curated candidate whose logLR matches its likelihood ratio', () => {
    expect(contentProblems(core([good]))).toEqual([]);
  });

  it('flags a logLR that disagrees with the likelihood ratio, and a missing citation', () => {
    const out = contentProblems(core([{ ...good, logLR: 9, citation: undefined }]));
    expect(out.some(s => s.includes('does not equal'))).toBe(true);
    expect(out.some(s => s.includes('no citation'))).toBe(true);
  });

  it('flags a presentation or supersedes entry naming an unknown candidate', () => {
    const d = core([good], { supersedes: ['Nowhere'] });
    (d.presentations[0].candidates as string[]).push('Missing');
    const out = contentProblems(d);
    expect(out.some(s => s.includes('supersedes "Nowhere"'))).toBe(true);
    expect(out.some(s => s.includes('"Missing" is not a coreConditions candidate'))).toBe(true);
  });
});

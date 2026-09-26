/**
 * Clause-aware record reading — shared test vectors. The same file drives the iOS twin
 * (ios/AmiseMedFlowTests/RecordClauseTests.swift: RecordClauses.swift, used by the Bayesian
 * engine's database terms and the text parser), so "never had pain, jaundice or fever", "mother had
 * breast cancer", "referred as ?appendicitis" and "took antacids with no relief" read alike on both.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  attributedAt, familyHistoryAt, findAllAffirmed, listNegatedAt, notAboutPatientAt, notCurrentAt, queryAt, reliefFailedAt,
} from '@workspace/triage-engine';

const VECTORS_PATH = fileURLToPath(new URL('../../../../../ios/AmiseMedFlowTests/Resources/RecordClauseVectors.json', import.meta.url));

interface Vector {
  text: string; term: string; occurrence: number; negated: boolean; listNegated: boolean; family: boolean;
  attributed: boolean; query: boolean; notAboutPatient: boolean; reliefFailed: boolean; notCurrent: boolean;
}
const { vectors } = JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as { vectors: Vector[] };

function occurrence(text: string, term: string, n: number): number {
  const lower = text.toLowerCase();
  let i = -1;
  for (let k = 0; k <= n; k++) i = lower.indexOf(term.toLowerCase(), i + 1);
  return i;
}

describe('record clauses (shared vectors)', () => {
  it('has the vectors', () => expect(vectors.length).toBeGreaterThan(30));

  for (const v of vectors) {
    it(`"${v.text}" [${v.term}]`, () => {
      const lower = v.text.toLowerCase();
      const start = occurrence(v.text, v.term, v.occurrence);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = start + v.term.length;
      expect(!findAllAffirmed(v.text, v.term).some(m => m.index === start)).toBe(v.negated);
      expect(listNegatedAt(lower, start)).toBe(v.listNegated);
      expect(familyHistoryAt(lower, start, end)).toBe(v.family);
      expect(attributedAt(lower, start)).toBe(v.attributed);
      expect(queryAt(lower, start)).toBe(v.query);
      expect(notAboutPatientAt(lower, start, end)).toBe(v.notAboutPatient);
      expect(reliefFailedAt(lower, start, end)).toBe(v.reliefFailed);
      expect(notCurrentAt(lower, start, end)).toBe(v.notCurrent);
    });
  }
});

/**
 * Outcomes loop — shared sanitiser vectors. The same file drives the iOS twin
 * (ios/AmiseMedFlow/Services/OutcomeSanitiser.swift, ios/AmiseMedFlowTests/OutcomeSyncTests.swift),
 * which the iOS push (SyncService+Outcomes.swift) runs before anything reaches
 * prediction_snapshots / diagnosis_outcomes. Both platforms must keep exactly the same coded values
 * and refuse the same records. Change codes.ts and the Swift file together, then this file.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sanitizeFinalDiagnosis, sanitizeSnapshot } from '@workspace/triage-engine/outcomes';

const VECTORS_PATH = fileURLToPath(new URL('../../../../../ios/AmiseMedFlowTests/Resources/OutcomeSanitiserVectors.json', import.meta.url));

interface Case { name: string; input: unknown; expected?: unknown; error?: string }
const vectors = JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as { snapshots: Case[]; finalDiagnoses: Case[] };

function check(c: Case, r: { ok: true; value: unknown } | { ok: false; error: string }) {
  if (c.error !== undefined) {
    expect(r.ok, c.name).toBe(false);
    if (!r.ok) expect(r.error).toBe(c.error);
  } else {
    expect(r.ok, c.name).toBe(true);
    if (r.ok) expect(r.value).toEqual(c.expected);
  }
}

describe('outcomes sanitisers (shared vectors with iOS)', () => {
  it('has refusals and acceptances for both record types', () => {
    for (const list of [vectors.snapshots, vectors.finalDiagnoses]) {
      expect(list.some(c => c.error)).toBe(true);
      expect(list.some(c => c.expected)).toBe(true);
    }
  });

  for (const c of vectors.snapshots) {
    it(`snapshot: ${c.name}`, () => check(c, sanitizeSnapshot(c.input)));
  }
  for (const c of vectors.finalDiagnoses) {
    it(`final diagnosis: ${c.name}`, () => check(c, sanitizeFinalDiagnosis(c.input)));
  }

  it('never keeps the local sync bookkeeping', () => {
    for (const c of [...vectors.snapshots, ...vectors.finalDiagnoses]) {
      if (c.expected) expect(JSON.stringify(c.expected)).not.toContain('clientRef');
    }
  });
});

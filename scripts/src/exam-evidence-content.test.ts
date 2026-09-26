/**
 * Evidence-based examination signs and decision rules (evidence-exam 1.0.0).
 *
 *   clinical-content/rules/exam-signs.json       canonical (schema clinical-content/schemas/exam-signs.schema.json)
 *   clinical-content/rules/decision-rules.json   canonical (schema clinical-content/schemas/decision-rules.schema.json)
 *
 * Byte-identical copies are read by the web engine (lib/pane-engine/src/evidence/*.json) and the
 * iOS app (ios/AmiseMedFlow/Resources/ExamSigns.json, DecisionRules.json). Edit the canonical
 * file, copy it to the other two places and bump its version with the registry entry. When the
 * shared-content mechanism (clinical-content/schemas + lint:shared-content) lands, fold this in.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validate } from './json-schema-lite';
import type { Schema } from './json-schema-lite';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const read = (p: string) => readFileSync(join(REPO_ROOT, p), 'utf8');

const FILES = [
  {
    canonical: 'clinical-content/rules/exam-signs.json',
    schema: 'clinical-content/schemas/exam-signs.schema.json',
    copies: ['lib/pane-engine/src/evidence/exam-signs.json', 'ios/AmiseMedFlow/Resources/ExamSigns.json'],
  },
  {
    canonical: 'clinical-content/rules/decision-rules.json',
    schema: 'clinical-content/schemas/decision-rules.schema.json',
    copies: ['lib/pane-engine/src/evidence/decision-rules.json', 'ios/AmiseMedFlow/Resources/DecisionRules.json'],
  },
];

describe('examination-sign and decision-rule catalogues', () => {
  for (const f of FILES) {
    it(`${f.canonical} matches its JSON Schema`, () => {
      const errors = validate(JSON.parse(read(f.schema)) as Schema, JSON.parse(read(f.canonical)));
      expect(errors).toEqual([]);
    });
    for (const copy of f.copies) {
      it(`${copy} is a byte-identical copy`, () => {
        expect(read(copy)).toBe(read(f.canonical));
      });
    }
  }

  it('the schema validator rejects what it should', () => {
    const schema = JSON.parse(read('clinical-content/schemas/exam-signs.schema.json')) as Schema;
    const good = JSON.parse(read('clinical-content/rules/exam-signs.json'));
    const bad = structuredClone(good);
    bad.signs[0].quality = 'hearsay';
    delete bad.signs[1].elicit;
    bad.signs[2].extra = true;
    const errors = validate(schema, bad);
    expect(errors.some(e => e.includes('quality'))).toBe(true);
    expect(errors.some(e => e.includes('missing "elicit"'))).toBe(true);
    expect(errors.some(e => e.includes('unexpected property "extra"'))).toBe(true);
  });

  it('nothing is marked reviewed without a named reviewer', () => {
    for (const f of FILES) {
      const c = JSON.parse(read(f.canonical));
      expect(c.lastReviewed).toBe('unknown');
      expect(c.reviewer).toBe('unknown');
    }
  });
});

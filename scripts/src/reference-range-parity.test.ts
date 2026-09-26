/**
 * lint:reference-range-parity — passes on the repository, and catches a changed limit, a changed
 * unit, a missing row and an analyte that is not in the iOS catalogue.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintReferenceRangeParity, parseSwiftRows } from './lint-reference-range-parity';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const swift = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services/LabReferenceRanges.swift'), 'utf8');
const catalogue = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services/LabAnalyteCatalog.swift'), 'utf8');

describe('reference-range parity lint', () => {
  it('passes on the repository', () => {
    expect(lintReferenceRangeParity(swift, catalogue)).toEqual([]);
    expect(parseSwiftRows(swift).length).toBeGreaterThan(30);
  });

  it('fails on a changed critical limit', () => {
    const changed = swift.replace('row("Potassium", "mmol/L", .either, 3.5, 5.3, 2.5, 6.0)', 'row("Potassium", "mmol/L", .either, 3.5, 5.3, 2.5, 6.5)');
    expect(changed).not.toBe(swift);
    expect(lintReferenceRangeParity(changed, catalogue).join('\n')).toMatch(/Potassium.*criticalHigh iOS 6.5 vs web 6/);
  });

  it('fails on a changed unit and on a missing row', () => {
    const unit = swift.replace('row("Albumin", "g/L"', 'row("Albumin", "g/dL"');
    expect(lintReferenceRangeParity(unit, catalogue).join('\n')).toMatch(/Albumin unit iOS "g\/dL" vs web "g\/L"/);
    const missing = swift.replace(/\n\s*row\("Lipase"[^\n]*/, '');
    expect(lintReferenceRangeParity(missing, catalogue).join('\n')).toMatch(/row count differs/);
  });

  it('fails when an analyte is not a saved name in the iOS catalogue', () => {
    const renamed = catalogue.replace('a("lipase", "Lipase"', 'a("lipase", "Serum lipase"');
    expect(renamed).not.toBe(catalogue);
    expect(lintReferenceRangeParity(swift, renamed).join('\n')).toMatch(/Lipase is not a saved name in LabAnalyteCatalog.swift/);
  });
});

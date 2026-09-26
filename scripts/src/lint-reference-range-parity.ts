/**
 * Reference-range parity lint: the iOS read-only defaults table must equal the web defaults.
 *
 *   web  lib/triage-engine/src/reference-ranges.ts  (DEFAULT_REFERENCE_RANGES, imported)
 *   iOS  ios/AmiseMedFlow/Services/LabReferenceRanges.swift  (parsed from source: the
 *        `row("<analyte>", "<unit>", .<sex>, lower, upper, criticalLow, criticalHigh)` lines of
 *        LabReferenceRangeDefaults.all, plus version / source / effectiveFrom)
 *
 * Fails when:
 *   - a row exists on one platform only, or rows are in a different order;
 *   - a unit, sex, limit or critical limit differs;
 *   - the version, the "default — replace…" source text or the effective date differ;
 *   - an analyte is not a saved name in BOTH catalogues (catalog.ts, LabAnalyteCatalog.swift),
 *     or its unit is not the catalogue app unit (for analytes the catalogue converts);
 *   - the Swift `row(...)` helper stops building the adult band (ageMinYears 18, no maximum).
 * The lookup and classification rules are tested in
 * artifacts/dashboard/src/lib/__tests__/reference-ranges.test.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_RANGE_EFFECTIVE, DEFAULT_RANGE_SOURCE, DEFAULT_REFERENCE_RANGES, REFERENCE_RANGES_VERSION,
  catalogueUnitFor,
} from '../../lib/triage-engine/src/reference-ranges';
import { LAB_ANALYTES, normaliseUnit } from '../../lib/triage-engine/src/report-import/catalog';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const SWIFT_FILE = 'ios/AmiseMedFlow/Services/LabReferenceRanges.swift';
const SWIFT_CATALOGUE = 'ios/AmiseMedFlow/Services/LabAnalyteCatalog.swift';

export interface ParsedSwiftRow {
  analyte: string;
  unit: string;
  sex: 'any' | 'male' | 'female';
  lower: number | null;
  upper: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  line: number;
}

const SEX: Record<string, ParsedSwiftRow['sex']> = { either: 'any', male: 'male', female: 'female' };

function num(tok: string): number | null {
  const t = tok.trim();
  if (t === 'nil') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`not a number: ${t}`);
  return n;
}

export function parseSwiftRows(src: string): ParsedSwiftRow[] {
  const out: ParsedSwiftRow[] = [];
  const re = /^\s*row\("((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*\.(\w+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,)]+)\),?\s*$/;
  src.split('\n').forEach((line, i) => {
    const m = re.exec(line);
    if (!m) return;
    const sex = SEX[m[3]];
    if (!sex) throw new Error(`${SWIFT_FILE}:${i + 1}: unknown sex .${m[3]}`);
    out.push({
      analyte: m[1], unit: m[2], sex,
      lower: num(m[4]), upper: num(m[5]), criticalLow: num(m[6]), criticalHigh: num(m[7]), line: i + 1,
    });
  });
  return out;
}

function swiftString(src: string, name: string): string | null {
  const m = new RegExp(`static let ${name} = "((?:[^"\\\\]|\\\\.)*)"`).exec(src);
  return m ? m[1] : null;
}

export function lintReferenceRangeParity(swiftSrc: string, swiftCatalogueSrc: string): string[] {
  const errors: string[] = [];
  const ios = parseSwiftRows(swiftSrc);
  const web = DEFAULT_REFERENCE_RANGES;

  if (swiftString(swiftSrc, 'version') !== REFERENCE_RANGES_VERSION) {
    errors.push(`version differs: iOS ${swiftString(swiftSrc, 'version')} vs web ${REFERENCE_RANGES_VERSION}`);
  }
  if (swiftString(swiftSrc, 'source') !== DEFAULT_RANGE_SOURCE) errors.push('the default source text differs');
  if (swiftString(swiftSrc, 'effectiveFrom') !== DEFAULT_RANGE_EFFECTIVE) errors.push('the default effective date differs');
  if (!/ageMinYears:\s*18,\s*ageMaxYears:\s*nil/.test(swiftSrc)) {
    errors.push('the Swift row(...) helper no longer builds the adult band (ageMinYears: 18, ageMaxYears: nil)');
  }
  for (const r of web) {
    if (r.ageMinYears !== 18 || r.ageMaxYears !== null) errors.push(`web ${r.analyte} (${r.sex}) is not in the adult band`);
  }

  if (ios.length !== web.length) errors.push(`row count differs: iOS ${ios.length} vs web ${web.length}`);
  const n = Math.min(ios.length, web.length);
  for (let i = 0; i < n; i++) {
    const a = ios[i];
    const b = web[i];
    const where = `row ${i + 1} (${SWIFT_FILE}:${a.line})`;
    if (a.analyte !== b.analyte || a.sex !== b.sex) {
      errors.push(`${where}: iOS ${a.analyte}/${a.sex} vs web ${b.analyte}/${b.sex} (order or analyte differs)`);
      continue;
    }
    if (a.unit !== b.unit) errors.push(`${where}: ${a.analyte} unit iOS "${a.unit}" vs web "${b.unit}"`);
    for (const k of ['lower', 'upper', 'criticalLow', 'criticalHigh'] as const) {
      if (a[k] !== b[k]) errors.push(`${where}: ${a.analyte} (${a.sex}) ${k} iOS ${a[k]} vs web ${b[k]}`);
    }
  }
  for (const extra of ios.slice(n)) errors.push(`iOS-only row: ${extra.analyte} (${extra.sex})`);
  for (const extra of web.slice(n)) errors.push(`web-only row: ${extra.analyte} (${extra.sex})`);

  // Every analyte is a saved name in both catalogues, in the catalogue app unit.
  const webNames = new Set(LAB_ANALYTES.map(a => a.name));
  const swiftNames = new Set<string>();
  for (const m of swiftCatalogueSrc.matchAll(/\ba\("[A-Za-z0-9]+",\s*"((?:[^"\\]|\\.)*)"/g)) swiftNames.add(m[1]);
  const seen = new Set<string>();
  for (const r of web) {
    const key = `${r.analyte}|${r.sex}`;
    if (seen.has(key)) errors.push(`duplicate default for ${r.analyte} (${r.sex})`);
    seen.add(key);
    if (!webNames.has(r.analyte)) errors.push(`${r.analyte} is not a saved name in catalog.ts`);
    if (!swiftNames.has(r.analyte)) errors.push(`${r.analyte} is not a saved name in LabAnalyteCatalog.swift`);
    const appUnit = catalogueUnitFor(r.analyte);
    if (appUnit !== null && normaliseUnit(appUnit) !== normaliseUnit(r.unit)) {
      errors.push(`${r.analyte} default is in "${r.unit}" but the catalogue app unit is "${appUnit}"`);
    }
  }
  return errors;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const swift = readFileSync(join(REPO_ROOT, SWIFT_FILE), 'utf8');
  const catalogue = readFileSync(join(REPO_ROOT, SWIFT_CATALOGUE), 'utf8');
  const errors = lintReferenceRangeParity(swift, catalogue);
  if (errors.length > 0) {
    console.error(`✗ reference-range parity: ${errors.length} problem(s)`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error('Change lib/triage-engine/src/reference-ranges.ts and LabReferenceRanges.swift together.');
    process.exit(1);
  }
  console.log(`✓ reference-range parity: ${DEFAULT_REFERENCE_RANGES.length} default rows identical on web and iOS (v${REFERENCE_RANGES_VERSION})`);
}

/**
 * Browser PDF text assembly for the report import (pdf-text.ts): positioned pdf.js text pieces →
 * reading-order lines the lab parser can read. pdf.js itself is not loaded here.
 */
import { describe, expect, it } from 'vitest';
import { parseLabReport } from '@workspace/triage-engine/report-import';
import { assemblePdfLines, hasUsableText, type PdfTextPiece } from '../pdf-text';

const piece = (str: string, x: number, y: number, width = str.length * 5): PdfTextPiece => ({ str, x, y, width, height: 10 });

describe('assemblePdfLines', () => {
  it('rebuilds table rows from positioned cells (any order), top to bottom', () => {
    const pieces = [
      piece('mmol/L', 300, 700), piece('Sodium', 40, 700), piece('133', 200, 700.8), piece('L', 250, 700), piece('135 - 145', 380, 700),
      piece('Potassium', 40, 685), piece('4.1', 200, 685), piece('mmol/L', 300, 685.5), piece('3.5 - 5.1', 380, 685),
      piece('BIOCHEMISTRY', 40, 715),
    ];
    const lines = assemblePdfLines(pieces);
    expect(lines).toEqual([
      'BIOCHEMISTRY',
      'Sodium  133  L  mmol/L  135 - 145',
      'Potassium  4.1  mmol/L  3.5 - 5.1',
    ]);
    const rows = parseLabReport(lines.join('\n')).rows;
    expect(rows.map(r => [r.analyteKey, r.valueText, r.flag, r.unit, r.referenceRange])).toEqual([
      ['sodium', '133', 'L', 'mmol/L', '135 - 145'],
      ['potassium', '4.1', '', 'mmol/L', '3.5 - 5.1'],
    ]);
  });

  it('joins a word split into adjacent pieces without a space', () => {
    expect(assemblePdfLines([piece('Haemo', 40, 500, 25), piece('globin', 65, 500, 30), piece('10.9', 200, 500)]))
      .toEqual(['Haemoglobin  10.9']);
  });

  it('ignores empty pieces', () => {
    expect(assemblePdfLines([piece('', 0, 0), piece('  ', 10, 0)])).toEqual(['']);
    expect(assemblePdfLines([])).toEqual([]);
  });
});

describe('hasUsableText', () => {
  it('needs at least 20 letters or digits (a scanned page yields a few stray characters)', () => {
    expect(hasUsableText(' \n\u000C\n . , ')).toBe(false);
    expect(hasUsableText('ab 12 cd')).toBe(false);
    expect(hasUsableText('Patient Name: DOE, JANE  Lab No: LS-24-018832')).toBe(true);
  });
});

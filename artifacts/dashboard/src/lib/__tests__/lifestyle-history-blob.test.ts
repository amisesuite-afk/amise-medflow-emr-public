/**
 * The web saves lifestyle history into patients.pathway_data_json, the iOS PathwayData blob:
 * only the `lifestyle` key may change, and a blob that is not JSON is never overwritten.
 */
import { describe, expect, it } from 'vitest';
import { mergeLifestyleIntoBlob, parsePathwayBlob } from '@/lib/lifestyle-history-blob';
import { emptyLifestyleHistory, parseLifestyleHistory } from '@workspace/triage-engine/lifestyle-practices';

describe('pathway_data_json lifestyle merge', () => {
  it('keeps every iOS pathway form and replaces only lifestyle', () => {
    const ios = '{"burns":{"mechanism":"scald"},"ward":{"marks":{}},"bowelPrep":{"regimen":"peg2l"},"lifestyle":{"fasting":["none"]}}';
    const blob = parsePathwayBlob(ios)!;
    const next = mergeLifestyleIntoBlob(blob, { ...emptyLifestyleHistory(), fasting: ['ramadan'], fastingStatus: 'current' });
    const round = JSON.parse(JSON.stringify(next)) as Record<string, unknown>;
    expect(round.burns).toEqual({ mechanism: 'scald' });
    expect(round.bowelPrep).toEqual({ regimen: 'peg2l' });
    expect(parseLifestyleHistory(round.lifestyle).fasting).toEqual(['ramadan']);
  });

  it('treats an empty column as an empty blob and refuses anything that is not a JSON object', () => {
    expect(parsePathwayBlob(null)).toEqual({});
    expect(parsePathwayBlob('  ')).toEqual({});
    expect(parsePathwayBlob('not json')).toBeNull();
    expect(parsePathwayBlob('[1,2]')).toBeNull();
  });

  it('reads what the iOS encoder writes (nil optionals omitted)', () => {
    const h = parseLifestyleHistory({ fasting: ['daniel_fast'], therapies: ['yoga'], nightShift: true });
    expect(h.sleepHours).toBeNull();
    expect(h.fastingStatus).toBeNull();
    expect(h.nightShift).toBe(true);
  });
});

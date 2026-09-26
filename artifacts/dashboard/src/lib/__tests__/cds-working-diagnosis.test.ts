/**
 * CDS score suggestions that follow the working diagnosis (web-last-gaps, 2026-09-25):
 * TG18 acute cholecystitis (Yokoe 2018) and BISAP (Wu 2008; ACG 2024) are suggested when the
 * confirmed diagnosis is cholecystitis / acute pancreatitis, not only from symptom chips.
 */
import { describe, expect, it } from 'vitest';
import { getCdsSuggestions, type CdsContext } from '../clinical-cds';

function ctx(over: Partial<CdsContext>): CdsContext {
  return {
    symptoms: [], examFindings: {}, vitals: {}, investigationResults: {}, comorbidities: [], assessment: '',
    rosFindings: {}, age: '50', sex: 'female', isPostOp: false, procedureData: {}, ...over,
  };
}
const keys = (over: Partial<CdsContext>) => getCdsSuggestions(ctx(over)).map(s => s.scaleKey);

describe('working-diagnosis score suggestions', () => {
  it('TG18 cholecystitis from a locked cholecystitis diagnosis or the assessment', () => {
    expect(keys({ workingDiagnosis: { diseaseId: 'cholecystitis', source: 'clinician', locked: true } })).toContain('tg18Cholecystitis');
    expect(keys({ assessment: 'Acute calculous cholecystitis, TG18 Grade II.' })).toContain('tg18Cholecystitis');
    expect(keys({ assessment: 'Biliary colic; no cholecystitis.' })).not.toContain('tg18Cholecystitis');
  });
  it('BISAP from an acute pancreatitis diagnosis', () => {
    expect(keys({ workingDiagnosis: { diseaseId: 'pancreatitis', source: 'clinician', locked: true } })).toContain('bisap');
    expect(keys({ assessment: 'Mild acute biliary pancreatitis.' })).toContain('bisap');
    expect(keys({ assessment: 'Epigastric pain; pancreatitis excluded (lipase normal).' })).not.toContain('bisap');
  });
});

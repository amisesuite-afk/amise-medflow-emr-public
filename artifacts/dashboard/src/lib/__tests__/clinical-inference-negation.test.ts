/**
 * computeClinicalPrompts reads free-text examination and imaging through the negation-aware
 * matcher: pertinent negatives must not raise alarms or attach operative plans (clinical
 * validation findings, 2026-09), and positive findings still must.
 */
import { describe, expect, it } from 'vitest';
import { computeClinicalPrompts, type InferenceInput } from '../clinical-inference';

function input(over: Partial<InferenceInput>): InferenceInput {
  return {
    age: '45', sex: 'male', symptoms: [], comorbidities: [], familyHistory: [], toxicHabits: [],
    medications: [], medicationsText: '', pregnancyPossible: false,
    ccEntries: [{ complaint: 'Acute abdominal pain', answers: {} }],
    encounterType: 'surgical_consult',
    examGeneral: '', examAbdomen: '', examBreast: '', examCardio: '', examResp: '', examNeuro: '',
    examExtremities: '', investigationResults: {}, radiologyRequests: [], vitals: {}, assessment: '',
    ...over,
  };
}

const ids = (over: Partial<InferenceInput>) => computeClinicalPrompts(input(over)).map(p => p.id);

describe('negated examination findings do not fire prompts', () => {
  it('"No guarding, no rebound" with an appendicitis assessment gives no appendicitis prompt', () => {
    expect(ids({ examAbdomen: 'Soft. No guarding, no rebound.', assessment: 'Possible appendicitis' }))
      .not.toContain('appendicitis_signs');
  });
  it('"no peritonism or rigidity" gives no peritonism prompt', () => {
    expect(ids({ examAbdomen: 'Soft, no peritonism or rigidity' })).not.toContain('peritonism');
  });
  it('"Murphy\'s sign negative" gives no Murphy\'s prompt', () => {
    expect(ids({ examAbdomen: "Murphy's sign negative" })).not.toContain('murphys_sign');
  });
  it('"afebrile", "Temperature 36.8" and "not jaundiced" give no Charcot\'s triad', () => {
    const cc = [{ complaint: 'Right upper quadrant pain (biliary)', answers: {} }];
    expect(ids({ ccEntries: cc, examGeneral: 'Afebrile, not jaundiced' })).not.toContain('charcots_triad');
    expect(ids({ ccEntries: cc, examGeneral: 'Temperature 36.8. Anicteric.' })).not.toContain('charcots_triad');
  });
  it('"no free gas" on CT gives no pneumoperitoneum prompt', () => {
    const radiologyRequests = [{
      modality: 'CT', anatomicalRegion: 'abdomen', resultReceived: true,
      resultNotes: 'Dilated small bowel loops. No free gas.', indication: 'Obstruction',
    }];
    expect(ids({ radiologyRequests })).not.toContain('free_air_imaging');
  });
});

describe('positive findings still fire (positive controls)', () => {
  it('rigid abdomen with guarding → peritonism prompt', () => {
    expect(ids({ examAbdomen: 'Rigid abdomen with guarding' })).toContain('peritonism');
  });
  it('"Murphy\'s sign positive" → Murphy\'s prompt', () => {
    expect(ids({ examAbdomen: "Murphy's sign positive" })).toContain('murphys_sign');
  });
  it('guarding present with an appendicitis assessment → appendicitis prompt', () => {
    expect(ids({ examAbdomen: 'RIF tenderness, guarding present', assessment: 'Acute appendicitis' }))
      .toContain('appendicitis_signs');
  });
  it('fever + jaundice + RUQ pain → Charcot\'s triad, including a raised written temperature', () => {
    const cc = [{ complaint: 'Right upper quadrant pain (biliary)', answers: {} }];
    expect(ids({ ccEntries: cc, examGeneral: 'Febrile, jaundiced' })).toContain('charcots_triad');
    expect(ids({ ccEntries: cc, examGeneral: 'Temp 38.9, icteric' })).toContain('charcots_triad');
  });
  it('free gas under the diaphragm → pneumoperitoneum prompt', () => {
    const radiologyRequests = [{
      modality: 'CXR', anatomicalRegion: 'chest', resultReceived: true,
      resultNotes: 'Free gas under the right hemidiaphragm.', indication: 'Epigastric pain',
    }];
    expect(ids({ radiologyRequests })).toContain('free_air_imaging');
  });
});

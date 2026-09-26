import { describe, expect, it } from 'vitest';
import { complaintFrameIds, frameExamSystems } from '../exam-frames';

describe('the Exam step follows the history frame', () => {
  it('classifies each complaint entry with the history step classifier', () => {
    expect(complaintFrameIds({ cc: [{ complaint: 'Cough', answers: {} }] })).toEqual(['cough']);
    expect(complaintFrameIds({ cc: [{ complaint: 'Groin lump', answers: {} }, { complaint: 'Cough', answers: {} }] }))
      .toEqual(['lump.hernia', 'cough']);
    expect(complaintFrameIds({ cc: [{ complaint: 'Vomiting and diarrhoea', answers: {} }] })).toEqual(['vomiting', 'bowel']);
  });

  it("uses the clinician's frame switch stored on the entry", () => {
    expect(complaintFrameIds({ cc: [{ complaint: 'Cough', frame: 'dyspnoea', answers: {} }] })).toEqual(['dyspnoea']);
  });

  it('falls back to the complaint text when there are no entries', () => {
    expect(complaintFrameIds({}, 'Shortness of breath')).toEqual(['dyspnoea']);
    expect(complaintFrameIds(null, '')).toEqual([]);
  });

  it('a cough shows the chest systems', () => {
    const systems = frameExamSystems(complaintFrameIds({ cc: [{ complaint: 'Cough', answers: {} }] }));
    expect([...systems]).toEqual(expect.arrayContaining(['respiratory', 'cardiovascular']));
    expect(systems.has('abdomen')).toBe(false);
  });
});

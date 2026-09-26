/**
 * The Assessment management panel follows the clinician-confirmed diagnosis; the PANE leader only
 * when nothing is confirmed (clinical validation findings: hpb gap 7, hernia-breast-endocrine 3).
 */
import { describe, expect, it } from 'vitest';
import { managementPanelSource } from '../management-panel-source';

const paneCholecystitis = { diseaseId: 'cholecystitis', probability: 0.41 };

describe('managementPanelSource', () => {
  it('a locked working diagnosis wins over a stronger PANE leader', () => {
    expect(managementPanelSource(
      { diseaseId: 'pancreatitis', icdCode: 'K85.10', locked: true }, [], paneCholecystitis,
    )).toEqual({ diseaseId: 'pancreatitis', icdCode: 'K85.10', source: 'confirmed' });
  });

  it('a recorded ICD-10 code wins over the PANE leader, even with no protocol for it', () => {
    expect(managementPanelSource(null, ['A06.4 — Amoebic liver abscess'], { diseaseId: 'appendicitis', probability: 0.6 }))
      .toEqual({ diseaseId: null, icdCode: 'A06.4', source: 'confirmed' });
  });

  it('the recorded ICD code is preferred to the working diagnosis code, as in PlanTab', () => {
    expect(managementPanelSource({ diseaseId: 'cholecystitis', icdCode: 'K81.0', locked: true }, ['K80.20 — Biliary colic'], null))
      .toEqual({ diseaseId: 'cholecystitis', icdCode: 'K80.20', source: 'confirmed' });
  });

  it('an unlocked (suggested) working diagnosis is not a confirmed one', () => {
    expect(managementPanelSource({ diseaseId: 'appendicitis', icdCode: 'K35.80', locked: false }, [], paneCholecystitis))
      .toEqual({ diseaseId: 'cholecystitis', icdCode: null, source: 'pane' });
  });

  it('falls back to the PANE leader only at ≥ 0.20', () => {
    expect(managementPanelSource(null, [], paneCholecystitis).source).toBe('pane');
    expect(managementPanelSource(null, [], { diseaseId: 'cholecystitis', probability: 0.19 }))
      .toEqual({ diseaseId: null, icdCode: null, source: 'none' });
    expect(managementPanelSource(undefined, [], null).source).toBe('none');
  });
});

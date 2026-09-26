/**
 * The patient intake chooses lump or pain questions from the complaint's history-frames symptom
 * type (lib/intake-question-set.ts): a hernia was asked "How severe is your discomfort?".
 */
import { describe, expect, it } from 'vitest';
import { intakeSymptom } from '../lib/intake-question-set';

describe('intakeSymptom', () => {
  it('a hernia is a lump (hernia variant), whatever its type', () => {
    for (const detail of ['Groin (inguinal)', 'Belly button (umbilical)', 'Old scar / previous surgery site', 'Not sure']) {
      expect(intakeSymptom('Hernia', detail)).toMatchObject({ set: 'lump', variant: 'hernia' });
    }
  });

  it('a lump follows its location', () => {
    expect(intakeSymptom('Lump or swelling', 'Groin / inner thigh')).toMatchObject({ set: 'lump', variant: 'hernia' });
    expect(intakeSymptom('Lump or swelling', 'Neck / throat')).toMatchObject({ set: 'lump', variant: 'neck' });
    expect(intakeSymptom('Lump or swelling', 'Abdomen / belly')).toMatchObject({ set: 'lump', variant: 'abdominal' });
    expect(intakeSymptom('Lump or swelling', 'Other location').set).toBe('lump');
  });

  it('pain complaints keep the pain questions; others neither', () => {
    expect(intakeSymptom('Abdominal pain', 'Upper right (below ribs)').set).toBe('pain');
    expect(intakeSymptom('Stomach pain / possible ulcer').set).toBe('pain');
    expect(intakeSymptom('Rectal bleeding').set).toBe('other');
    expect(intakeSymptom('Unexplained weight loss').set).toBe('other');
  });
});

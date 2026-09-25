/**
 * Printed patient prep sheet (PatientPrepCard → lib/patient-prep-sheet.ts): hazard H-10 and the
 * no-"fast from midnight" rule, checked on the rendered sheet. `lint:patient-instructions`
 * (scripts/src/lint-patient-instructions.ts, rule 8) runs the stricter sentence rules in CI.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BOWEL_PREPS, HERBAL_PREOP_PATIENT_TEXT, PREP_COLONOSCOPY_CLEAR_FLUIDS, PREP_FASTING_STANDARD, PREP_MEDICATIONS_CALL,
  buildPrepHtml, herbalPointerLine, prepSheetText, recordedHerbalProducts, type PrepSheetOptions,
} from '../patient-prep-sheet';

const PRESCRIBED = ['Warfarin 5 mg', 'Aspirin 75 mg', 'Insulin glargine', 'Metformin 500 mg', 'Amlodipine 10 mg',
  'Ibuprofen', 'Ferrous sulphate', 'Levothyroxine', 'Omeprazole', 'Multivitamin'];

function sheet(opts: Partial<PrepSheetOptions> & Pick<PrepSheetOptions, 'type'>): string {
  return prepSheetText(buildPrepHtml({
    patientName: 'Test Patient', dob: '', nhiNumber: '', procedure: 'Colonoscopy', appointmentDate: '',
    appointmentTime: '', allergies: '', herbalProducts: [], issued: '1 January 2026', ...opts,
  }));
}

const ALL_SHEETS = () => [
  ...BOWEL_PREPS.map(prep => sheet({ type: 'colonoscopy', prep, herbalProducts: recordedHerbalProducts([...PRESCRIBED, 'Garlic']) })),
  sheet({ type: 'preop', herbalProducts: recordedHerbalProducts([...PRESCRIBED, 'Turmeric']) }),
];

describe('printed prep sheet — hazard H-10', () => {
  it('gives no instruction for any individual prescribed medicine', () => {
    for (const text of ALL_SHEETS()) {
      const outsideApproved = text.split(HERBAL_PREOP_PATIENT_TEXT).join(' ').split(PREP_MEDICATIONS_CALL).join(' ');
      for (const med of ['warfarin', 'aspirin', 'insulin', 'metformin', 'amlodipine', 'ibuprofen', 'ferrous', 'levothyroxine', 'omeprazole', 'multivitamin']) {
        expect(outsideApproved.toLowerCase()).not.toContain(med);
      }
      expect(text).not.toMatch(/\b(STOP|HOLD|REDUCE|CONTINUE)\b/);
      expect(text).not.toMatch(/blood pressure (tablets|medication)/i);
    }
  });

  it('prints the approved call-the-clinic medicines line and the verbatim herbal paragraph', () => {
    for (const text of ALL_SHEETS()) {
      expect(text).toContain(PREP_MEDICATIONS_CALL);
      expect(text).toContain(HERBAL_PREOP_PATIENT_TEXT);
    }
  });

  it('never says midnight; uses the approved fasting wording', () => {
    for (const text of ALL_SHEETS()) expect(text).not.toMatch(/midnight/i);
    expect(sheet({ type: 'preop' })).toContain(PREP_FASTING_STANDARD);
    for (const prep of BOWEL_PREPS) expect(sheet({ type: 'colonoscopy', prep })).toContain(PREP_COLONOSCOPY_CLEAR_FLUIDS);
  });

  it('lists recorded herbal products only, as a pointer to the herbal paragraph (not valerian, not prescribed medicines)', () => {
    expect(recordedHerbalProducts([...PRESCRIBED, 'Garlic tablets', 'garlic tablets', 'Valerian', 'Bush tea (cerasee)']))
      .toEqual(['Garlic tablets', 'Bush tea (cerasee)']);
    expect(herbalPointerLine([])).toBe('');
    const text = sheet({ type: 'preop', herbalProducts: ['Garlic tablets'] });
    expect(text).toContain('Herbal products recorded at your visit: Garlic tablets.');
  });

  it('escapes patient-entered text', () => {
    const html = buildPrepHtml({
      type: 'preop', patientName: '<b>x</b>', dob: '', nhiNumber: '', procedure: '<img>', appointmentDate: '',
      appointmentTime: '', allergies: '', herbalProducts: [],
    });
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<img>');
  });

  it('PatientPrepCard renders the sheet from this module (no local medicine or fasting text)', () => {
    const src = readFileSync(fileURLToPath(new URL('../../components/PatientPrepCard.tsx', import.meta.url)), 'utf8');
    expect(src).toContain("from '@/lib/patient-prep-sheet'");
    expect(src).not.toMatch(/midnight|colonMedInstructions|instruction: '/i);
  });
});

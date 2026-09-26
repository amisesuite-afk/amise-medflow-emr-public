/**
 * detectDxVariants: whole-word, negation-aware keyword matching; the most specific keyword wins
 * (ties go to the more severe, later-listed variant); disease id / ICD beat a text mention in
 * another group. Assessment wording from the clinical-validation vignettes.
 */
import { describe, expect, it } from 'vitest';
import { detectDxVariants } from '../dx-variants';

const variant = (text: string, icd?: string, diseaseId?: string) =>
  detectDxVariants(text, icd, diseaseId)?.detectedVariant?.id ?? null;
const group = (text: string, icd?: string, diseaseId?: string) =>
  detectDxVariants(text, icd, diseaseId)?.group.baseDiagnosis ?? null;

describe('substring inside a word no longer matches', () => {
  it('"irreducible inguinal hernia" is not the reducible variant', () => {
    expect(variant('Irreducible inguinal hernia (right), incarcerated for 5 h. No clinical or biochemical signs of strangulation.', 'K40.30'))
      .toBe('hernia_incarcerated');
  });
  it('"Hinchey III" / "Hinchey IV" are not Hinchey I', () => {
    expect(variant('Perforated sigmoid diverticulitis with generalised purulent peritonitis (Hinchey III).', 'K57.20'))
      .toBe('diverticulitis_peritonitis');
    expect(variant('Perforated diverticulitis, Hinchey IV.', 'K57.20')).toBe('diverticulitis_peritonitis');
  });
  it('"Bethesda VI" is not Bethesda V', () => {
    expect(variant('Bethesda VI — papillary thyroid carcinoma with nodal metastasis. Total thyroidectomy with neck dissection.', 'C73'))
      .toBe('thyroid_total');
    expect(variant('Thyroid nodule, Bethesda VI', 'C73')).toBeNull();
  });
  it('"parathyroidectomy" is not "thyroidectomy", and "hyperparathyroidism" is not a thyroid diagnosis', () => {
    expect(group('Primary hyperparathyroidism — for parathyroidectomy')).toBeNull();
  });
});

describe('"moderately severe" is not "severe"', () => {
  it('does not select the severe variant', () => {
    expect(variant('Moderately severe acute pancreatitis (revised Atlanta 2012)', 'K85.11')).not.toBe('pancreatitis_severe');
  });
  it('severe acute pancreatitis is still severe, even with necrosis mentioned', () => {
    expect(variant('Severe acute pancreatitis — persistent organ failure, 40% pancreatic necrosis.', 'K85.11'))
      .toBe('pancreatitis_severe');
  });
});

describe('the most specific keyword wins, not the first listed', () => {
  it('strangulation beats the generic SBO keyword', () => {
    expect(variant('Adhesive small bowel obstruction with strangulation: closed-loop obstruction.', 'K56.52'))
      .toBe('sbo_strangulation');
  });
  it('abscess / generalised peritonitis beat the generic "appendicitis" keyword', () => {
    expect(variant('Complicated (perforated) appendicitis with a 5.5 cm pericaecal abscess', 'K35.33')).toBe('appendicitis_abscess');
    expect(variant('Perforated appendicitis with generalised peritonitis and sepsis', 'K35.20')).toBe('appendicitis_generalised_peritonitis');
  });
  it('a Tokyo grade beats the generic "cholecystitis" keyword', () => {
    expect(variant('Acute calculous cholecystitis, Tokyo (TG18) Grade II (moderate)', 'K81.0')).toBe('cholecystitis_grade2');
    expect(variant('Acute calculous cholecystitis, Tokyo (TG18) Grade I (mild). No organ dysfunction.', 'K81.0')).toBe('cholecystitis_grade1');
  });
  it('variceal wording beats "haematemesis"', () => {
    expect(variant('Acute variceal haemorrhage from oesophageal varices, with haematemesis', 'I85.11')).toBe('ugib_variceal');
    expect(variant('Non-variceal upper GI bleed with haematemesis', 'K92.0')).toBe('ugib_nonvariceal_stable');
  });
  it('a tie goes to the more severe variant ("strangulated … irreducible")', () => {
    expect(variant('Strangulated right inguinal hernia — irreducible for 20 h, tender with skin erythema.', 'K40.40'))
      .toBe('hernia_strangulated');
  });
  it('the generic keyword alone still selects its variant', () => {
    expect(variant('Acute appendicitis', 'K35.80')).toBe('appendicitis_uncomplicated');
  });
});

describe('negated and "risk" mentions do not select a variant', () => {
  it('"no strangulation" keeps the adhesional variant', () => {
    expect(variant('Adhesive SBO without CT or clinical features of strangulation.', 'K56.50')).toBe('sbo_adhesional');
  });
  it('"high strangulation risk" is not strangulation', () => {
    expect(variant('Right femoral hernia — irreducible but non-tender. High strangulation risk.', 'K41.90')).toBe('hernia_incarcerated');
  });
});

describe('group: disease id and ICD beat a text mention in another group', () => {
  it('"No cholangitis" in a K85 pancreatitis assessment stays in the Pancreatitis group', () => {
    expect(group('Mild acute pancreatitis, gallstone aetiology. No cholangitis.', 'K85.10')).toBe('Pancreatitis');
    expect(variant('Mild acute pancreatitis, gallstone aetiology. No cholangitis.', 'K85.10')).toBe('pancreatitis_mild');
  });
  it('a negated base diagnosis does not select a group from text alone', () => {
    expect(group('Epigastric pain. No cholangitis.')).toBeNull();
  });
  it('the text fallback still works for an uncoded assessment', () => {
    expect(group('Pancreatitis, mild')).toBe('Pancreatitis');
  });
});

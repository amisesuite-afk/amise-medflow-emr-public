/**
 * PANE feature mapper: false features found through the diagnostic-reasoning panel's "doesn't
 * fit" alerts and time-out on the clinval vignettes (docs/clinical-validation/changes/
 * diagnostic-reasoning.md, "Precision pass"). One test per false positive fixed; each also checks
 * that the affirmed form still maps.
 */
import { describe, expect, it } from 'vitest';
import { extractFeaturesFromSocrates, type PaneFeatureContext } from '../socrates-to-features';
import { extractFeaturesFromTranscript, detectPathognomonic } from '../transcript-dx-mapper';
import { familyHistoryAt, listNegatedAt, negationFreeGaps, notCurrentAt, recordHas } from '../record-text-match';

const note = (text: string, extra: Partial<PaneFeatureContext> = {}) =>
  extractFeaturesFromSocrates('Other / general surgical', {}, { narrative: [text], ...extra });

describe('negated lists (each item has its own negation window)', () => {
  it('"has never had abdominal pain, indigestion after food, jaundice or fever" records none of them', () => {
    const f = note('Gallstones on a scan for liver tests. She has never had abdominal pain, indigestion after food, jaundice or fever. Eats normally.');
    expect(f.fever).toBeUndefined();
    expect(f.jaundice).toBeUndefined();
    expect(f.abdominal_pain).toBeUndefined();
    expect(f.heartburn).toBeUndefined();
  });

  it('"denies fever, rigors and night sweats": the list may end with "and" after denies', () => {
    const f = note('Denies fever, rigors and night sweats.');
    expect(f.fever).toBeUndefined();
    expect(f.rigors).toBeUndefined();
    expect(f.night_sweats).toBeUndefined();
  });

  it('keeps the safety bias: a comma list without "or" after "no" still ends the scope', () => {
    expect(note('No vomiting, rigid abdomen.').guarding).toBe(true);
    expect(note('No nausea and vomiting since this morning.').nausea_vomiting).toBe(true);
    expect(note('Fever and rigors since yesterday, no jaundice.').fever).toBe(true);
  });

  it('listNegatedAt: only items of the negated list', () => {
    const t = 'never had pain, jaundice or fever. now has fever.';
    expect(listNegatedAt(t, t.indexOf('fever'))).toBe(true);
    expect(listNegatedAt(t, t.lastIndexOf('fever'))).toBe(false);
  });
});

describe('family history is not the patient', () => {
  it('"Mother had breast cancer" / "family history of bowel cancer" are not a known malignancy', () => {
    expect(note('Mother had breast cancer at 45.').known_malignancy).toBeUndefined();
    expect(note('Family history of bowel cancer in her father.').known_malignancy).toBeUndefined();
    expect(extractFeaturesFromSocrates('Other', {}, { comorbidities: ['Family history of bowel cancer'] }).known_malignancy).toBeUndefined();
    expect(note('Known metastatic breast cancer on letrozole.').known_malignancy).toBe(true);
  });

  it('a relative who reports is not family history ("Mother says he has vomited")', () => {
    expect(note('Mother says he has vomited three times today.').nausea_vomiting).toBe(true);
    expect(note('Parents have noticed yellow eyes since yesterday.').jaundice).toBe(true);
    const t = 'mother has diabetes. mother says he has vomited.';
    expect(familyHistoryAt(t, t.indexOf('diabetes'))).toBe(true);
    expect(familyHistoryAt(t, t.indexOf('vomited'))).toBe(false);
  });
});

describe('findings that mean "now"', () => {
  it('a sentence dated years back: "Splenectomy 6 years ago … after a motorbike accident" is no injury mechanism', () => {
    const f = note('Fever and a rash since this morning. Splenectomy 6 years ago for a ruptured spleen after a motorbike accident. Stopped his penicillin.');
    expect(f.mechanism_blunt).toBeUndefined();
    expect(f.trauma_mechanism).toBe(false); // the gate: a full record with no injury
    expect(f.asplenia).toBe(true); // history features still read
    expect(note('Came off his motorbike an hour ago, hit by a car.').mechanism_blunt).toBe(true);
    expect(note('Dysphagia started 2 years ago and is getting worse.').dysphagia).toBe(true);
  });

  it('a repaired hernia is surgical history, not a hernia now', () => {
    const f = note('Here with her father for review after an umbilical hernia repair. Ate a biscuit at a party.');
    expect(f.hernia_swelling).toBeUndefined();
    expect(f.umbilical_swelling).toBeUndefined();
    expect(f.previous_surgery).toBe(true);
    const g = note('Seen for follow-up after an incisional hernia repair six weeks ago (wound healed).');
    expect(g.incisional_swelling).toBeUndefined();
    expect(g.hernia_swelling).toBeUndefined();
  });

  it('a hernia awaiting elective repair is a background condition; one referred for repair is the problem', () => {
    const f = note('Breathless for two days. Awaiting elective repair of a femoral hernia.');
    expect(f.hernia_swelling).toBeUndefined();
    expect(note('Attending to plan surgery for a large incisional hernia.').incisional_swelling).toBeUndefined();
    expect(note('Referred for repair of a left inguinal hernia.').hernia_swelling).toBe(true);
    expect(note('Large incisional hernia, soft.').hernia_swelling).toBe(true);
  });

  it('a lay guess is not a finding: "Mother thought it was a hernia"', () => {
    expect(note('Sudden right testicular pain. Mother thought it was a hernia.').hernia_swelling).toBeUndefined();
    expect(note('Painful irreducible hernia in the right groin.').hernia_swelling).toBe(true);
  });

  it('abscess drainage done earlier is not a fluctuant swelling', () => {
    expect(note('Amoxicillin for a mildly infected wound after abscess drainage.').swelling_fluctuant_soft).toBeUndefined();
    expect(note('Tender fluctuant abscess at the anal margin.').swelling_fluctuant_soft).toBe(true);
  });

  it('notCurrentAt: years back without an "ongoing" word', () => {
    const t = 'appendicectomy as a child for a burst appendix.';
    expect(notCurrentAt(t, t.indexOf('burst'), t.indexOf('burst') + 5)).toBe(true);
  });
});

describe('patterns fixed at the source', () => {
  it('"DRE: no mass" is not a rectal mass (a regex gap cannot cross a negation)', () => {
    expect(note('Soft, no masses. DRE: no mass. Proctoscopy: grade II haemorrhoids.').rectal_mass).toBeUndefined();
    expect(note('Hard mass palpable on DRE at 6 cm.').rectal_mass).toBe(true);
    expect(negationFreeGaps(/\bdre\b[^.]{0,30}\bmass\b/).test('dre: no mass')).toBe(false);
  });

  it('fundoscopy "flame haemorrhages" are not a burn', () => {
    expect(note('Fundoscopy: bilateral papilloedema with flame haemorrhages and cotton-wool spots.').burn_wound).toBeUndefined();
    expect(note('Flame burns to both forearms.').burn_wound).toBe(true);
  });

  it('restless and disorientated is agitation, not writhing with pain', () => {
    expect(note('Restless, disorientated to time.').restless_writhing).toBeUndefined();
    expect(note('Restless, cannot lie still with the pain.').restless_writhing).toBe(true);
  });

  it('rheumatoid arthritis is not current joint pain', () => {
    const f = note('Rheumatoid arthritis on weekly methotrexate and prednisolone.');
    expect(f.joint_pain).toBeUndefined();
    expect(f.immunosuppression).toBe(true);
    expect(note('Hot swollen knee: septic arthritis?').joint_pain).toBe(true);
  });

  it('defaecation as a syncope trigger is not pain on defaecation', () => {
    const f = extractFeaturesFromSocrates('Other', {}, { symptoms: ['syncope'], symptomDetails: { syncope: ['During micturition / defaecation'] } });
    expect(f.pain_on_defaecation).toBeUndefined();
    expect(note('Severe pain on defaecation with bright red blood.').pain_on_defaecation).toBe(true);
  });

  it('pale stools are not pallor', () => {
    const f = note('Dark urine and pale stools for a week.');
    expect(f.pallor).toBeUndefined();
    expect(f.dark_urine).toBe(true);
    expect(note('Pale and sweaty.').pallor).toBe(true);
  });

  it('calf pain on walking is claudication, not calf tenderness', () => {
    const f = note('Walks 200 yards before calf pain.');
    expect(f.calf_tenderness).toBeUndefined();
    expect(note('Swollen left leg with calf tenderness.').calf_tenderness).toBe(true);
  });

  it('a weak pulse-oximetry trace is not an absent pulse', () => {
    expect(note('Hand cool, weak pulse-oximetry trace on the index finger.').absent_pulses).toBeUndefined();
    expect(note('Weak pedal pulses on the left.').absent_pulses).toBe(true);
  });

  it('a fistula track is not a thrombophlebitic cord', () => {
    expect(note('Palpable cord towards the anal canal.').tender_cord).toBeUndefined();
    expect(note('Tender red cord along the long saphenous vein.').tender_cord).toBe(true);
  });

  it('flatus incontinence and faecal urgency are not urinary', () => {
    const f = note('Occasional urgency and flatus incontinence already.');
    expect(f.urinary_incontinence).toBeUndefined();
    expect(f.frequency_urgency).toBeUndefined();
    expect(note('Nine bloody stools a day with urgency and cramping.').frequency_urgency).toBeUndefined();
    expect(note('Burning on passing urine with frequency and urgency.').frequency_urgency).toBe(true);
    expect(extractFeaturesFromSocrates('Other', {}, { symptoms: ['urinary symptoms'], symptomDetails: { 'urinary symptoms': ['Urgency'] } }).frequency_urgency).toBe(true);
  });

  it('a rash on both legs is not bilateral leg symptoms', () => {
    expect(note('Non-blanching purpuric rash on both legs and trunk.').bilateral_leg_symptoms).toBeUndefined();
    expect(note('Back pain with numbness in both legs.').bilateral_leg_symptoms).toBe(true);
  });

  it('breast and neck sites are not abdominal ("Central / areola", "Diffuse neck")', () => {
    expect(extractFeaturesFromSocrates('Breast lump', { site: 'Central / areola' }).periumbilical_pain).toBeUndefined();
    expect(extractFeaturesFromSocrates('Neck lump', { site: 'Diffuse neck, Thyroid isthmus' }).diffuse_abdominal_pain).toBeUndefined();
    expect(extractFeaturesFromSocrates('Acute abdominal pain', { site: 'Central' }).periumbilical_pain).toBe(true);
    expect(extractFeaturesFromSocrates('Acute abdominal pain', { site: 'Diffuse' }).diffuse_abdominal_pain).toBe(true);
  });

  it('a scar in the right iliac fossa is not RIF pain', () => {
    expect(note('Tender distended abdomen. Right iliac fossa scar.').rlq_pain).toBeUndefined();
    expect(note('Pain in the right iliac fossa since this morning.').rlq_pain).toBe(true);
  });

  it('wound context must be affirmed: "No wound" does not make a hot foot a wound erythema', () => {
    const f = note('Hot swollen right foot for three weeks. No wound. Diabetes with numb feet.');
    expect(f.wound_erythema).toBeUndefined();
    expect(recordHas('no wound.', /\bwound\b/)).toBe(false);
    expect(note('Post-op wound hot and red.').wound_erythema).toBe(true);
  });

  it('distended neck veins are not abdominal distension', () => {
    const f = note('Agitated, cyanosed. Distended neck veins.');
    expect(f.abdominal_distension).toBeUndefined();
    expect(f.raised_jvp).toBe(true);
    expect(note('Distended, tympanic, tinkling bowel sounds.').abdominal_distension).toBe(true);
  });

  it('"not passed urine" is oliguria, not urinary retention', () => {
    const f = note('Loin-to-groin colic; has not passed urine for 10 hours.');
    expect(f.oliguria).toBe(true);
    expect(f.urinary_retention_symptoms).toBeUndefined();
    expect(note('Unable to pass urine since the operation.').urinary_retention_symptoms).toBe(true);
  });

  it('neuropathic pain is not loss of protective sensation', () => {
    expect(note('Takes amitriptyline for neuropathic pain.').peripheral_neuropathy).toBeUndefined();
    expect(note('Diabetic peripheral neuropathy with numb feet.').peripheral_neuropathy).toBe(true);
  });

  it('an adrenal mass on an imaging report is recorded (was missed: only free text was read)', () => {
    const f = extractFeaturesFromSocrates('Abdominal mass (incidental / new)', {}, {
      investigationResults: { 'CT abdomen (unenhanced)': 'Left adrenal mass 3.2 cm, unenhanced attenuation 28 HU. Right adrenal normal.' },
    });
    expect(f.adrenal_mass).toBe(true);
  });
});

describe('ambient transcript mapper uses the same rules', () => {
  const observed = (text: string, id: string) => extractFeaturesFromTranscript(text).find(f => f.featureId === id)?.observed;
  it('a negated list marks every item absent', () => {
    expect(observed('She has never had fever, vomiting or jaundice.', 'fever')).toBe(false);
  });
  it('family history records nothing', () => {
    expect(observed('Her mother had jaundice years ago. She has pain under the ribs.', 'jaundice')).toBeUndefined();
    expect(observed('She has been jaundiced since Monday.', 'jaundice')).toBe(true);
  });
  it('pathognomonic signs: a negated list of signs suggests nothing', () => {
    expect(detectPathognomonic("No Rovsing's sign, psoas sign or obturator sign.")).toEqual([]);
  });
});

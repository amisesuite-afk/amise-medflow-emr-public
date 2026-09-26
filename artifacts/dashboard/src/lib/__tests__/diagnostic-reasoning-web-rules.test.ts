/**
 * Web diagnostic-reasoning adapter rules (diagnostic-reasoning-web 1.1.0): diagnosis families,
 * working-diagnosis label matching, the two-conditions rule, "already named", the web
 * contradiction threshold and the time-out's coexisting states.
 */
import { describe, expect, it } from 'vitest';
import { DISEASES, applyModifiers, initPaneState, updatePosterior } from '@workspace/pane-engine';
import type { DiseaseNode, PaneState } from '@workspace/pane-engine';
import type { ReasoningInput } from '@workspace/triage-engine/diagnostic-reasoning';
import {
  buildDiagnosticReasoning, namedInDiagnosis, resolveWorkingNode, timeOutUnexplained, webClosureAlerts,
  WEB_CONTRADICTION_MAX_LR,
} from '@/lib/diagnostic-reasoning';
import { familyOf, labelMatchScore, sameFamily } from '@/lib/diagnosis-families';

const diseases = applyModifiers(DISEASES, 60, 'male', undefined, {});
const node = (id: string): DiseaseNode => DISEASES.find(d => d.id === id)!;

function stateWith(findings: Record<string, boolean>): PaneState {
  let s = initPaneState(diseases);
  for (const [f, v] of Object.entries(findings)) s = updatePosterior(s, diseases, f, v);
  return s;
}

function alertsFor(findings: Record<string, boolean>, working: { diseaseId: string | null; icdCode: string | null; label: string }) {
  return buildDiagnosticReasoning({
    state: stateWith(findings), diseases, working, news2Series: [], recordText: '', labs: [], longitudinal: null,
  }).closureAlerts;
}

describe('diagnosis families (derived from PANE ids, labels and ICD-10 codes)', () => {
  it('parent and child diagnoses of one condition are one family', () => {
    const pairs: [string, string][] = [
      ['inguinal_hernia', 'incarcerated_hernia'], ['femoral_hernia', 'incarcerated_hernia'], ['umbilical_hernia', 'incarcerated_hernia'],
      ['peptic_ulcer', 'perforated_peptic_ulcer'], ['appendicitis', 'appendix_mass'], ['bowel_obstruction', 'adhesion_obstruction'],
      ['ulcerative_colitis', 'toxic_megacolon'], ['cdiff_colitis', 'toxic_megacolon'], ['necrotising_fasciitis', 'fournier_gangrene'],
      ['thyroid_carcinoma', 'anaplastic_thyroid'], ['thermal_burn_minor', 'thermal_burn_major'],
      ['blunt_abdominal_trauma', 'splenic_laceration'], ['rib_fractures', 'pneumothorax_traumatic'],
      ['upper_gi_bleed', 'lower_gi_bleed'],
    ];
    for (const [a, b] of pairs) {
      expect(sameFamily(node(a), node(b)), `${a} ~ ${b}`).toBe(true);
      expect(sameFamily(node(b), node(a)), `${b} ~ ${a}`).toBe(true);
    }
  });

  it('different conditions that share a category, a word or a system are not', () => {
    const pairs: [string, string][] = [
      ['biliary_colic', 'pancreatitis'], ['gastritis', 'acs'], ['gastroenteritis', 'dka'], ['renal_colic', 'acs'],
      ['dka', 'hhs'], ['aortic_aneurysm', 'aortic_dissection'], ['achalasia', 'oesophageal_perforation'],
      ['cholangiocarcinoma', 'hepatocellular_carcinoma'], ['perforated_peptic_ulcer', 'arterial_ulcer'],
      ['parathyroid_adenoma', 'phaeochromocytoma'], ['diabetic_foot_infection', 'hhs'], ['colorectal_cancer', 'bowel_obstruction'],
      ['variceal_bleed', 'hypertensive_emergency'], ['sah', 'upper_gi_bleed'],
    ];
    for (const [a, b] of pairs) expect(sameFamily(node(a), node(b)), `${a} ~ ${b}`).toBe(false);
  });

  it('familyOf lists the whole hernia family for incarcerated hernia', () => {
    const f = familyOf(node('incarcerated_hernia'), DISEASES);
    for (const id of ['inguinal_hernia', 'femoral_hernia', 'umbilical_hernia', 'incisional_hernia', 'obturator_hernia']) expect(f.has(id), id).toBe(true);
    expect(f.has('bowel_obstruction')).toBe(false);
  });
});

describe('closure alerts: families are compatible, not competing', () => {
  const STRANGULATED = { groin_swelling: true, hernia_swelling: true, hernia_irreducible: true, absolute_constipation: true, nausea_vomiting: true, localised_pain: true };

  it('a confirmed inguinal hernia with strangulation features: no "the record favours incarcerated hernia"', () => {
    const a = alertsFor(STRANGULATED, { diseaseId: 'inguinal_hernia', icdCode: 'K40.30', label: 'Strangulated right inguinal hernia' });
    expect(a.filter(x => x.kind === 'less-likely')).toEqual([]);
  });

  it('the same record against an unrelated working diagnosis still alerts', () => {
    const a = alertsFor(STRANGULATED, { diseaseId: 'gastroenteritis', icdCode: 'A09', label: 'Gastroenteritis' });
    expect(a.some(x => x.kind === 'less-likely')).toBe(true);
  });
});

describe('two conditions: a leader that shares no evidence with a supported working diagnosis', () => {
  const AF_AND_HERNIA = { palpitations: true, irregular_pulse: true, af_on_ecg: true, hernia_compressible: true, groin_swelling: true, hernia_swelling: true };

  it('new AF with a reducible inguinal hernia on examination: no "the record favours hernia over AF"', () => {
    const a = alertsFor(AF_AND_HERNIA, { diseaseId: 'atrial_fibrillation', icdCode: 'I48.91', label: 'New-onset atrial fibrillation' });
    expect(a.filter(x => x.kind === 'less-likely')).toEqual([]);
  });

  it('competing diagnoses still alert: raised amylase against a confirmed peptic ulcer', () => {
    const a = alertsFor({ epigastric_pain: true, nausea_vomiting: true, radiation_to_back: true, alcohol_use: true, acute_onset: true, elevated_amylase: true },
      { diseaseId: 'peptic_ulcer', icdCode: 'K27.9', label: 'Peptic ulcer disease' });
    expect(a.map(x => x.text).join('\n')).toMatch(/the record favours Acute Pancreatitis/);
  });
});

describe('a diagnosis the clinician already named is not premature closure', () => {
  it('namedInDiagnosis', () => {
    expect(namedInDiagnosis('Placental Abruption', 'Blunt abdominal trauma in pregnancy (30 weeks) — suspected placental abruption')).toBe(true);
    expect(namedInDiagnosis('Phaeochromocytoma / Paraganglioma', 'Right adrenal mass with paroxysmal symptoms — suspected phaeochromocytoma')).toBe(true);
    expect(namedInDiagnosis('Acute Pancreatitis', 'Biliary colic')).toBe(false);
    expect(namedInDiagnosis('Achalasia', 'Suspected pseudoachalasia — cardia carcinoma')).toBe(false);
  });
});

describe('web contradiction threshold', () => {
  const input = (lrAbsent: number): ReasoningInput => ({
    hypotheses: [{ id: 'choledocholithiasis', label: 'Choledocholithiasis', probability: 0.6, cantMiss: false }],
    findings: [{ id: 'jaundice', label: 'Jaundice', status: 'absent' }],
    weights: { choledocholithiasis: { jaundice: { lrPresent: 3, lrAbsent, modelled: true, cardinal: true, source: '' } } },
  });
  it(`a documented-absent cardinal finding alerts only at LR <= ${WEB_CONTRADICTION_MAX_LR}`, () => {
    const cbd = node('choledocholithiasis');
    expect(webClosureAlerts(input(0.31), DISEASES, cbd, 'Choledocholithiasis', [])).toEqual([]);
    expect(webClosureAlerts(input(0.1), DISEASES, cbd, 'Choledocholithiasis', []).map(a => a.text))
      .toEqual(["Doesn't fit the working diagnosis: no jaundice, expected in Choledocholithiasis (LR 0.10)."]);
  });
  it('NEWS2 rising is unchanged', () => {
    expect(webClosureAlerts(input(0.31), DISEASES, node('choledocholithiasis'), 'Choledocholithiasis', [1, 6]).map(a => a.kind)).toEqual(['news2-rising']);
  });
});

describe('working diagnosis: the label beats an unspecific ICD-10 match', () => {
  const resolve = (icdCode: string | null, label: string) => resolveWorkingNode(diseases, { diseaseId: null, icdCode, label })?.id ?? null;
  it('picks the node the diagnosis names', () => {
    expect(resolve('K92.2', 'Acute lower GI bleed — unstable, on warfarin')).toBe('lower_gi_bleed');
    expect(resolve('E11.10', 'Euglycaemic diabetic ketoacidosis (SGLT2 inhibitor)')).toBe('dka');
    expect(resolve('K60.3', 'Complex anterior transsphincteric fistula-in-ano')).toBe('perianal_abscess');
    expect(resolve('N64.4', 'Cyclical mastalgia, normal breast examination')).toBe('fibrocystic_change');
  });
  it('keeps the ICD-10 match when the label is not clearly better', () => {
    expect(resolve('I70.244', 'Ischaemic diabetic foot ulcer — chronic limb-threatening ischaemia')).toBe('arterial_ulcer');
    expect(resolve('K35.80', 'Acute appendicitis')).toBe('appendicitis');
  });
  it('a one-word label match alone does not pick a node', () => {
    expect(resolve('Z01.818', 'Pre-operative assessment — symptomatic gallstones; latex anaphylaxis')).toBeNull();
  });
  it('acute and chronic contradict', () => {
    expect(labelMatchScore('Acute Limb Ischaemia (Arterial Embolism / Thrombosis)', 'chronic limb-threatening ischaemia')).toBeLessThan(2);
  });
});

describe('time-out: findings a coexisting state explains are not unexplained', () => {
  it('raised creatinine and raised lactate in perforated diverticulitis are explained by AKI / sepsis', () => {
    const state = stateWith({
      lif_pain: true, fever: true, guarding: true, rebound_tenderness: true, free_gas: true, raised_creatinine: true, raised_lactate: true,
      tachycardia: true, hypotension: true,
    });
    const nodes = diseases.filter(d => ['diverticulitis', 'perforated_peptic_ulcer'].includes(d.id));
    const unexplained = timeOutUnexplained(state, diseases, nodes);
    expect(unexplained).not.toContain('Raised creatinine');
    expect(unexplained.some(l => /lactate/i.test(l))).toBe(false);
  });
});

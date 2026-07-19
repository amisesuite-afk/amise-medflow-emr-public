/**
 * Passive clinical safety engine.
 *
 * Pure function — no side effects, no API calls, no hooks.
 * Call computeReminders() on every render to get the current hint list.
 * Reminders are surfaced only when the HPI has content (i.e. consultation is underway).
 */

import type { Section } from '@/context/AppContext';

export interface SafetyReminder {
  id: string;
  text: string;
  section: Section;
  urgency: 'info' | 'flag';
}

interface ConsultState {
  activeCcKey: string | null;
  symptoms: string[];
  hpiNotes: string;
  examNotes: Record<string, string>;
  assessment: string;
  plan: string;
  orderedInvestigations: string[];
  radiologyRequests: object[];
}

interface RuleCheck {
  id: string;
  text: string;
  section: Section;
  urgency: 'info' | 'flag';
  test: (s: ConsultState) => boolean;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function hasInvx(invx: string[], kws: string[]): boolean {
  const joined = invx.join(' ').toLowerCase();
  return kws.some(k => joined.includes(k.toLowerCase()));
}

function hasExam(notes: Record<string, string>, key: string): boolean {
  return (notes[key]?.trim().length ?? 0) > 8;
}

function hasImaging(reqs: object[], kws: string[]): boolean {
  if (!reqs.length) return false;
  const text = JSON.stringify(reqs).toLowerCase();
  return kws.some(k => text.includes(k.toLowerCase()));
}

function hpiContains(s: ConsultState, kws: string[]): boolean {
  const text = (s.hpiNotes + ' ' + s.assessment).toLowerCase();
  return kws.some(k => text.includes(k.toLowerCase()));
}

// ── per-CC rule sets ───────────────────────────────────────────────────────────

const CC_RULES: Record<string, RuleCheck[]> = {

  acute_cholecystitis: [
    { id: 'no_lft_chole', text: 'LFTs, FBC, CRP not yet ordered', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['lft', 'liver function', 'fbc', 'crp', 'bilirubin']) },
    { id: 'no_uss_biliary', text: 'RUQ ultrasound not yet requested', section: 'radiology', urgency: 'flag',
      test: s => !hasImaging(s.radiologyRequests, ['uss', 'ultrasound', 'ruq', 'biliary', 'gallbladder']) },
    { id: 'no_abd_exam_chole', text: 'Abdominal examination not yet documented', section: 'examination', urgency: 'info',
      test: s => !hasExam(s.examNotes, 'abdomen') },
  ],

  biliary_colic: [
    { id: 'no_lfts_bc', text: 'LFTs, USS RUQ not yet ordered', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['lft', 'liver function', 'fbc']) },
    { id: 'no_uss_bc', text: 'RUQ ultrasound not yet requested', section: 'radiology', urgency: 'flag',
      test: s => !hasImaging(s.radiologyRequests, ['uss', 'ultrasound', 'gallbladder', 'biliary']) },
  ],

  appendicitis: [
    { id: 'no_fbc_appy', text: 'FBC and CRP not yet ordered', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['fbc', 'crp', 'white cell', 'wcc']) },
    { id: 'no_imaging_appy', text: 'Imaging not yet requested — USS or CT abdomen', section: 'radiology', urgency: 'flag',
      test: s => !hasImaging(s.radiologyRequests, ['uss', 'ct', 'ultrasound', 'abdomen', 'appendix']) },
    { id: 'no_abd_exam_appy', text: 'Abdominal examination not yet documented', section: 'examination', urgency: 'info',
      test: s => !hasExam(s.examNotes, 'abdomen') },
  ],

  breast_lump: [
    { id: 'no_breast_imaging', text: 'Breast imaging not yet requested — USS/mammogram', section: 'radiology', urgency: 'flag',
      test: s => !hasImaging(s.radiologyRequests, ['breast', 'mammogram', 'uss']) },
    { id: 'no_breast_exam', text: 'Breast examination not yet documented', section: 'examination', urgency: 'info',
      test: s => !hasExam(s.examNotes, 'breast') },
    { id: 'no_fbc_breast', text: 'Consider baseline FBC if not yet ordered', section: 'investigations', urgency: 'info',
      test: s => !hasInvx(s.orderedInvestigations, ['fbc', 'cbc']) },
  ],

  rectal_bleeding: [
    { id: 'no_colonoscopy_rb', text: 'Colonoscopy / flexible sigmoidoscopy not yet booked', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['colonoscopy', 'sigmoidoscopy', 'scope', 'endoscopy']) },
    { id: 'no_fbc_rb', text: 'FBC not yet ordered — check for iron-deficiency anaemia', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['fbc', 'cbc', 'haemoglobin', 'iron']) },
    { id: 'no_digital_rectal', text: 'Digital rectal examination not documented', section: 'examination', urgency: 'info',
      test: s => !hasExam(s.examNotes, 'abdomen') && !hpiContains(s, ['dre', 'digital rectal', 'proctoscopy']) },
  ],

  change_in_bowel_habit: [
    { id: 'no_colonoscopy_cbh', text: 'Lower GI endoscopy not yet requested', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['colonoscopy', 'sigmoidoscopy', 'scope', 'endoscopy']) },
    { id: 'no_crc_invx', text: 'FBC, CEA, LFTs not yet ordered', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['fbc', 'cea', 'lft']) },
    { id: 'no_ct_cbh', text: 'Consider CT abdomen/pelvis for staging if malignancy suspected', section: 'radiology', urgency: 'info',
      test: s => hpiContains(s, ['malign', 'cancer', 'tumour', 'tumor']) && !hasImaging(s.radiologyRequests, ['ct', 'abdomen', 'pelvis']) },
  ],

  dysphagia: [
    { id: 'no_gastroscopy', text: 'Upper GI endoscopy (OGD) not yet booked', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['ogd', 'gastroscopy', 'endoscopy', 'upper gi', 'oesophagoscopy']) },
    { id: 'no_ct_dysphagia', text: 'Consider CT chest/abdomen if malignancy suspected', section: 'radiology', urgency: 'flag',
      test: s => !hasImaging(s.radiologyRequests, ['ct', 'chest', 'abdomen']) },
    { id: 'no_fbc_dysph', text: 'FBC, LFTs not yet ordered', section: 'investigations', urgency: 'info',
      test: s => !hasInvx(s.orderedInvestigations, ['fbc', 'lft']) },
  ],

  weight_loss: [
    { id: 'no_malignancy_invx', text: 'Malignancy screen not yet initiated — FBC, LFTs, CXR', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['fbc', 'lft', 'cxr', 'chest x-ray', 'cea', 'psa', 'tsh']) },
    { id: 'no_tft_wl', text: 'TFTs not yet ordered — thyroid as cause?', section: 'investigations', urgency: 'info',
      test: s => !hasInvx(s.orderedInvestigations, ['tft', 'tsh', 'thyroid']) },
    { id: 'no_ct_wl', text: 'Consider CT abdomen if no source identified', section: 'radiology', urgency: 'info',
      test: s => s.orderedInvestigations.length > 0 && !hasImaging(s.radiologyRequests, ['ct', 'pet', 'abdomen']) },
  ],

  inguinal_hernia: [
    { id: 'no_hernia_exam', text: 'Groin / hernia examination not yet documented', section: 'examination', urgency: 'info',
      test: s => !hasExam(s.examNotes, 'abdomen') && !hpiContains(s, ['hernia', 'groin', 'reducible', 'irreducible']) },
    { id: 'no_uss_hernia', text: 'Consider USS groin if diagnosis uncertain', section: 'radiology', urgency: 'info',
      test: s => !hasImaging(s.radiologyRequests, ['uss', 'groin', 'hernia', 'ultrasound']) && !hpiContains(s, ['clinically obvious', 'obvious hernia']) },
  ],

  ventral_hernia: [
    { id: 'no_hernia_ct', text: 'Consider CT abdomen for hernia sizing / defect anatomy', section: 'radiology', urgency: 'info',
      test: s => !hasImaging(s.radiologyRequests, ['ct', 'abdomen']) },
    { id: 'no_abd_exam_ventral', text: 'Abdominal wall examination not yet documented', section: 'examination', urgency: 'info',
      test: s => !hasExam(s.examNotes, 'abdomen') },
  ],

  thyroid_nodule: [
    { id: 'no_uss_thyroid', text: 'Thyroid ultrasound not yet requested', section: 'radiology', urgency: 'flag',
      test: s => !hasImaging(s.radiologyRequests, ['thyroid', 'uss', 'ultrasound', 'neck']) },
    { id: 'no_tft_thyroid', text: 'TFTs not yet ordered', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['tft', 'tsh', 'thyroid', 'free t4', 't3']) },
    { id: 'no_fnac', text: 'FNAC / biopsy not yet documented', section: 'investigations', urgency: 'info',
      test: s => !hpiContains(s, ['fnac', 'fnab', 'fine needle', 'biopsy', 'core biopsy']) && s.hpiNotes.length > 100 },
  ],

  gastric_cancer: [
    { id: 'no_ogd_gc', text: 'Gastroscopy (OGD) not yet booked', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['ogd', 'gastroscopy', 'endoscopy']) },
    { id: 'no_staging_ct', text: 'CT chest/abdomen/pelvis for staging not yet ordered', section: 'radiology', urgency: 'flag',
      test: s => !hasImaging(s.radiologyRequests, ['ct', 'staging', 'chest', 'abdomen']) },
    { id: 'no_fbc_gc', text: 'FBC, LFTs, CEA not yet ordered', section: 'investigations', urgency: 'info',
      test: s => !hasInvx(s.orderedInvestigations, ['fbc', 'cea', 'lft', 'ca 19']) },
  ],

  colorectal_cancer: [
    { id: 'no_colonoscopy_crc', text: 'Colonoscopy not yet booked', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['colonoscopy', 'scope', 'endoscopy']) },
    { id: 'no_staging_crc', text: 'CT chest/abdomen/pelvis for staging not yet requested', section: 'radiology', urgency: 'flag',
      test: s => !hasImaging(s.radiologyRequests, ['ct', 'staging', 'chest', 'pelvis', 'abdomen']) },
    { id: 'no_tumour_markers', text: 'CEA, CA19-9 not yet ordered', section: 'investigations', urgency: 'info',
      test: s => !hasInvx(s.orderedInvestigations, ['cea', 'ca 19', 'ca19']) },
  ],

  peptic_ulcer: [
    { id: 'no_ogd_pud', text: 'Gastroscopy (OGD) not yet booked', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['ogd', 'gastroscopy', 'endoscopy']) },
    { id: 'no_hp_test', text: 'H. pylori testing not yet ordered (CLO / serology / breath test)', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['h. pylori', 'helicobacter', 'clo', 'breath test', 'pylori']) },
  ],

  pancreatitis: [
    { id: 'no_amylase', text: 'Amylase / lipase not yet ordered', section: 'investigations', urgency: 'flag',
      test: s => !hasInvx(s.orderedInvestigations, ['amylase', 'lipase']) },
    { id: 'no_ct_panc', text: 'CT abdomen for severity / necrosis not yet ordered', section: 'radiology', urgency: 'flag',
      test: s => !hasImaging(s.radiologyRequests, ['ct', 'abdomen', 'pancreas']) },
    { id: 'no_uss_panc', text: 'RUQ ultrasound to assess biliary cause not yet requested', section: 'radiology', urgency: 'info',
      test: s => !hasImaging(s.radiologyRequests, ['uss', 'ultrasound', 'biliary', 'gallbladder']) },
  ],

  postop_follow_up: [
    { id: 'no_wound_check', text: 'Wound / operative site examination not yet documented', section: 'examination', urgency: 'info',
      test: s => !hasExam(s.examNotes, 'wound') },
    { id: 'no_histo', text: 'Histology / pathology result not yet reviewed', section: 'investigations', urgency: 'info',
      test: s => !hpiContains(s, ['histology', 'pathology', 'histopath', 'specimen', 'result']) },
  ],

};

// ── generic rules (all consultations) ─────────────────────────────────────────

const GENERIC_RULES: RuleCheck[] = [
  { id: 'no_assessment_any', text: 'Assessment not yet documented', section: 'assessment', urgency: 'info',
    test: s => !s.assessment.trim() && s.hpiNotes.trim().length > 80 },
  { id: 'no_plan_any', text: 'Management plan not yet documented', section: 'plan', urgency: 'info',
    test: s => !s.plan.trim() && !!s.assessment.trim() },
];

// ── public API ─────────────────────────────────────────────────────────────────

export function computeReminders(state: ConsultState): SafetyReminder[] {
  // Don't surface anything until HPI or assessment has meaningful content
  if (!state.hpiNotes.trim() && !state.assessment.trim()) return [];

  const reminders: SafetyReminder[] = [];
  const seen = new Set<string>();

  const push = (c: RuleCheck) => {
    if (!seen.has(c.id) && c.test(state) && reminders.length < 4) {
      reminders.push({ id: c.id, text: c.text, section: c.section, urgency: c.urgency });
      seen.add(c.id);
    }
  };

  // CC-specific first (most clinically relevant)
  if (state.activeCcKey) {
    const rules = CC_RULES[state.activeCcKey] ?? [];
    for (const r of rules) push(r);
  }

  // Also scan generic symptom-driven CC keys from symptoms array
  for (const sym of state.symptoms) {
    const rules = CC_RULES[sym] ?? [];
    for (const r of rules) push(r);
    if (reminders.length >= 4) break;
  }

  // Generic rules fill remaining slots
  if (reminders.length < 4) {
    for (const r of GENERIC_RULES) push(r);
  }

  return reminders;
}

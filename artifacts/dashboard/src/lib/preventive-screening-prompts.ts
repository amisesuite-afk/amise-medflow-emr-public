/**
 * Preventive / screening section of the clinical prompt strip (computeClinicalPrompts).
 *
 * Two sources, both deterministic and in the shared triage engine:
 *  - `screenForCancer` (lib/triage-engine/src/cancer-screening.ts): NICE NG12 suspected-cancer
 *    criteria, including the lab-driven rules (FIT ≥ 10 µg Hb/g, iron-deficiency anaemia from Hb +
 *    ferritin) — shown as a safety prompt with the investigations to consider.
 *  - `preventiveScreeningItems` (lib/triage-engine/src/screening/preventive.ts): USPSTF-based
 *    screening and surveillance (web port of the iOS ScreeningEngine, SURGEON-DECISIONS G2.19).
 *
 * The wellness panel (unchanged) stays here because it keys on dashboard encounter types.
 * Every prompt is a suggestion: nothing is ordered until the clinician confirms it.
 */

import {
  containsAnyAffirmed,
  hasLabIronDeficiencyAnaemia,
  isAnaemic,
  joinClauses,
  preventiveScreeningItems,
  readBmi,
  readCancerScreenLabs,
  screenForCancer,
} from '@workspace/triage-engine';
import type { PreventiveItem, PreventiveTopic } from '@workspace/triage-engine';
import type { ClinicalAction, ClinicalPrompt, InferenceInput } from './clinical-inference';

const TOPIC_ICON: Record<PreventiveTopic, string> = {
  colorectal: '🔭', breast: '🎯', cervical: '🎗️', prostate: '🔬', aaa: '🫀', lung: '🫁', tobacco: '🚭',
  bbv: '🧪', diabetes: '🍬', 'blood-pressure': '🩺', cardiovascular: '❤️', gastric: '🦠', osteoporosis: '🦴',
};

function num(v: string | undefined): number | null {
  if (!v || !v.trim()) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toPrompt(item: PreventiveItem): ClinicalPrompt {
  const actions: ClinicalAction[] = item.actions.map((a, i) => ({
    step: i + 1,
    text: a.text,
    ...(a.investigation ? { addToInvestigations: a.investigation } : {}),
    ...(a.plan ? { addToPlan: a.plan } : {}),
  }));
  return {
    id: item.id,
    type: 'preventative',
    urgency: item.priority,
    icon: TOPIC_ICON[item.topic],
    finding: item.finding,
    text: item.title,
    rationale: `${item.rationale} (${item.guideline})`,
    actions,
    ...(item.followUpDays ? { followUp: { label: item.title, daysFromNow: item.followUpDays } } : {}),
  };
}

const SITE_CANCER: Record<string, RegExp> = {
  colorectal: /\b(colorectal|colon|colonic|rectal|rectum|sigmoid|caecal|cecal|bowel) (cancer|carcinoma|adenocarcinoma|malignancy|tumou?r)\b/i,
  breast: /\bbreast (cancer|carcinoma|malignancy)\b|\b(dcis|ductal carcinoma|lobular carcinoma)\b/i,
  urological: /\b(bladder|urothelial|renal cell|kidney|renal) (cancer|carcinoma|malignancy|tumou?r)\b/i,
};
const HEDGE = /\b(suspected|suspicion|possible|probable|likely|query|exclude|excluded|rule out|ruled out|risk|screening|family|fhx)\b|\?/i;

/**
 * True when the record already states a (not hedged) cancer at this site: "Obstructing sigmoid
 * cancer" is known; "Suspected colorectal cancer" or "? rectal cancer" is not.
 */
function knownCancerAt(site: string, record: string[]): boolean {
  const re = SITE_CANCER[site.split(' / ')[0]];
  if (!re) return false;
  return record
    .flatMap(t => t.split(/(?<=[.;!])\s+|\n+/))
    .some(s => containsAnyAffirmed(s, [re]) && !HEDGE.test(s));
}

/** NICE NG12 / BSG suspected-cancer prompt from symptoms, the clinician's text and lab values. */
function suspectedCancerPrompts(input: InferenceInput, ageNum: number): ClinicalPrompt[] {
  if (isNaN(ageNum)) return [];
  const sex = input.sex === 'male' || input.sex === 'female' ? input.sex : 'unknown';
  const labs = readCancerScreenLabs(input.investigationResults);
  const familyEntries = [...input.familyHistory, ...input.comorbidities.filter(c => /^\s*(family history|fhx|fh)\b/i.test(c))];
  const freeText = joinClauses([
    ...input.ccEntries.flatMap(e => Object.values(e.answers ?? {})),
    input.examBreast,
    input.assessment ?? '',
  ]);
  const screen = screenForCancer({
    age: ageNum,
    sex,
    chiefComplaints: input.ccEntries.map(e => e.complaint),
    symptoms: input.symptoms,
    familyHistory: familyEntries,
    responses: {},
    freeText,
    labs,
  });
  const out: ClinicalPrompt[] = [];
  const emergency = input.encounterType === 'major_emergency';
  // Only the criteria added in cancer-screening 1.1.0 (the red flags and lab results found easy to
  // miss: FIT, IDA, rectal bleeding ≥ 50, weight loss + pain ≥ 40, nipple ≥ 50, haematuria ≥ 45).
  // The older chip rules already reach the clinician through the triage banner.
  // A cancer already diagnosed at that site (assessment or past history) needs no referral prompt.
  const record = [input.assessment ?? '', ...input.comorbidities.filter(c => !/^\s*(family history|fhx|fh)\b/i.test(c))];
  const met = screen.criteria.filter(c => c.met && c.id && !knownCancerAt(c.site ?? '', record));

  if (met.length) {
    const twoWeek = met.some(c => (c.pathway ?? 'two_week_wait') === 'two_week_wait');
    const site = [...new Set(met.flatMap(c => (c.site ?? 'suspected').split(' / ')))].join(' / ');
    const recommended = [...new Set(met.flatMap(c => c.investigations ?? []))];
    const labBits: string[] = [];
    if (met.some(c => /iron deficiency/i.test(c.rule))) labBits.push('iron-deficiency anaemia');
    if (labs.fitUgHbG != null) labBits.push(`FIT ${labs.fitUgHbG} µg Hb/g`);
    else if (labs.fitPositive) labBits.push('FIT positive');
    if (labs.haemoglobinGdl != null && isAnaemic(labs.haemoglobinGdl, sex)) labBits.push(`Hb ${labs.haemoglobinGdl} g/dL`);
    if (labs.ferritinUgL != null && hasLabIronDeficiencyAnaemia(labs, sex)) labBits.push(`ferritin ${labs.ferritinUgL} µg/L`);
    const actions: ClinicalAction[] = [];
    if (!emergency) {
      for (const inv of recommended) actions.push({ step: 0, text: inv, addToInvestigations: inv });
    }
    actions.push({
      step: 0,
      text: twoWeek ? 'Suspected cancer pathway referral (2-week wait)' : 'Urgent bidirectional endoscopy',
      addToPlan: twoWeek
        ? `• Suspected ${site} cancer pathway referral (2-week wait): ${met.map(c => `${c.rule} [${c.guideline}]`).join('; ')}.${emergency ? ' Arrange once the acute episode is managed.' : ''}`
        : `• Urgent bidirectional endoscopy (OGD + colonoscopy) for iron-deficiency anaemia (BSG 2021).${emergency ? ' Arrange once the acute episode is managed.' : ''}`,
    });
    // BSG 2021: treat IDA with oral iron (one tablet daily or on alternate days); IV iron when oral
    // iron is not tolerated or ineffective. Adults only (the IDA criteria need age ≥ 18).
    if (met.some(c => /iron deficiency/i.test(c.rule))) {
      actions.push({
        step: 0,
        text: 'Iron replacement (BSG 2021)',
        addToPlan: '• Iron replacement: oral iron, one tablet daily or on alternate days; IV iron if not tolerated or ineffective (BSG 2021) — prescriber to choose the preparation.',
      });
    }
    out.push({
      id: 'ng12_suspected_cancer',
      type: 'safety',
      urgency: 'priority',
      icon: '🎗️',
      finding: `Suspected cancer referral criteria met: ${site}${labBits.length ? ` — ${labBits.join(', ')}` : ''}`,
      diagnosis: `${site} cancer to be excluded`,
      text: twoWeek ? `2-week-wait referral — ${site}` : `Urgent investigation — ${site}`,
      rationale: met.map(c => `${c.rule} (${c.guideline})`).join('; '),
      actions: actions.map((a, i) => ({ ...a, step: i + 1 })),
      followUp: { label: `Suspected ${site} cancer pathway — result`, daysFromNow: 14 },
    });
  } else if (ageNum >= 18 && labs.haemoglobinGdl != null && isAnaemic(labs.haemoglobinGdl, sex)
    && labs.mcvFl != null && labs.mcvFl < 80 && labs.ferritinUgL == null && !emergency) {
    // Microcytic anaemia without a ferritin: iron deficiency is not yet confirmed (BSG 2021).
    out.push({
      id: 'anaemia_ferritin_check',
      type: 'investigation',
      urgency: 'routine',
      icon: '🩸',
      finding: `Microcytic anaemia (Hb ${labs.haemoglobinGdl} g/dL, MCV ${labs.mcvFl} fL) — no ferritin on file`,
      text: 'Ferritin — confirm or exclude iron deficiency',
      rationale: 'Microcytic anaemia: serum ferritin confirms iron deficiency (< 45 µg/L, BSG 2021), which in a man or a post-menopausal woman needs bidirectional endoscopy.',
      actions: [{ step: 1, text: 'Serum ferritin', addToInvestigations: 'Ferritin' }],
    });
  }
  return out;
}

/** Wellness / general check-up panel (content unchanged from computeClinicalPrompts). */
function wellnessPrompt(input: InferenceInput): ClinicalPrompt | null {
  const cc = input.ccEntries.map(e => e.complaint);
  const isWellness = input.encounterType === 'quick_consult'
    || input.symptoms.some(s => containsAnyAffirmed(s, ['general check', 'wellness', 'routine check', 'annual', 'health screen', 'checkup', 'well woman', 'well man']))
    || cc.some(c => containsAnyAffirmed(c, ['wellness', 'checkup', 'health screen', 'annual', 'well man', 'well woman']));
  if (!isWellness) return null;
  return {
    id: 'wellness_panel',
    type: 'preventative',
    urgency: 'routine',
    icon: '🩺',
    finding: 'General health screen / wellness visit',
    text: 'Wellness panel: FBC, lipid profile, glucose, HbA1c, TFTs, eGFR',
    rationale: 'General health screen — comprehensive metabolic and haematological baseline for primary prevention.',
    actions: [
      { step: 1, text: 'FBC', addToInvestigations: 'Full Blood Count (FBC)' },
      { step: 2, text: 'Lipid profile + fasting glucose', addToInvestigations: 'Lipid Profile' },
      { step: 3, text: 'HbA1c', addToInvestigations: 'HbA1c' },
      { step: 4, text: 'TFTs (TSH)', addToInvestigations: 'Thyroid Function Tests (TFTs)' },
      { step: 5, text: 'U&E + eGFR', addToInvestigations: 'Urea & Electrolytes (U&E)' },
      { step: 6, text: 'Document BP + BMI + waist circumference', addToPlan: '• Document BP, BMI, waist circumference — cardiovascular risk profiling.' },
    ],
    followUp: { label: 'Annual wellness review', daysFromNow: 365, recurring: true, recurringDays: 365 },
  };
}

/**
 * The preventive / screening prompts for computeClinicalPrompts: suspected-cancer (NG12) prompt,
 * USPSTF screening and surveillance items, and the wellness panel.
 */
export function computePreventivePrompts(input: InferenceInput): ClinicalPrompt[] {
  const ageNum = parseInt(input.age, 10);
  const prompts: ClinicalPrompt[] = [...suspectedCancerPrompts(input, ageNum)];
  const sex = input.sex === 'male' || input.sex === 'female' ? input.sex : 'unknown';
  const items = preventiveScreeningItems({
    age: isNaN(ageNum) ? null : ageNum,
    sex,
    pregnancyPossible: input.pregnancyPossible,
    // Past surgical history is part of the structured past history (hysterectomy, colectomy,
    // polypectomy); the HPI is clinician free text like the assessment (previous colonoscopy,
    // polypectomy findings). Both are read negation-aware, and sentences about relatives are
    // skipped (preventive.ts readPersonalRisk / parsePolypFindings).
    pastHistory: [...input.comorbidities, ...(input.surgicalHistory ?? [])],
    notes: [input.assessment ?? '', input.historyText ?? ''],
    familyHistory: input.familyHistory,
    toxicHabits: input.toxicHabits,
    bmi: readBmi([input.examGeneral, ...input.comorbidities]),
    systolicBp: num(input.vitals?.systolicBp),
    diastolicBp: num(input.vitals?.diastolicBp),
    resultNames: Object.keys(input.investigationResults),
    setting: input.encounterType === 'major_emergency' ? 'emergency' : 'outpatient',
  });
  prompts.push(...items.map(toPrompt));
  const wellness = wellnessPrompt(input);
  if (wellness) prompts.push(wellness);
  return prompts;
}

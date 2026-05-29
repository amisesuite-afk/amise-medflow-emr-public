import type { DiseaseNode, Feature } from '../types.js';
import { appendicitis } from './appendicitis.js';
import { cholecystitis } from './cholecystitis.js';
import { pepticUlcer } from './pepticUlcer.js';
import { pancreatitis } from './pancreatitis.js';
import { cholangitis } from './cholangitis.js';
import { gord } from './gord.js';
import { diverticulitis } from './diverticulitis.js';
import { inguinalHernia } from './inguinalHernia.js';
import { colorectalCancer } from './colorectalCancer.js';

// Named-disease priors sum = 0.08+0.15+0.10+0.05+0.04+0.12+0.06+0.07+0.03 = 0.70
// _other_ captures the remaining 0.30 of the surgical OPD distribution.
const other: DiseaseNode = {
  id: '_other_',
  label: 'Other / undetermined',
  icd10: 'R69',
  prior: 0.30,
  features: {},
};

export const DISEASES: DiseaseNode[] = [
  appendicitis,
  cholecystitis,
  pepticUlcer,
  pancreatitis,
  cholangitis,
  gord,
  diverticulitis,
  inguinalHernia,
  colorectalCancer,
  other,
];

export const FEATURES: Feature[] = [
  // ── Abdominal pain location ────────────────────────────────────────────────
  {
    id: 'rlq_pain',
    label: 'RLQ / right iliac fossa pain',
    question: 'Is the pain localised to the right lower quadrant / right iliac fossa?',
    category: 'symptom',
  },
  {
    id: 'ruq_pain',
    label: 'RUQ pain / biliary colic',
    question: 'Is there right upper quadrant pain or biliary colic?',
    category: 'symptom',
  },
  {
    id: 'epigastric_pain',
    label: 'Epigastric pain',
    question: 'Is the predominant pain in the epigastrium (upper central abdomen)?',
    category: 'symptom',
  },
  {
    id: 'lif_pain',
    label: 'LIF / left iliac fossa pain',
    question: 'Is the pain localised to the left lower quadrant / left iliac fossa?',
    category: 'symptom',
  },
  {
    id: 'radiation_to_back',
    label: 'Radiation to back',
    question: 'Does the pain radiate through to the back?',
    category: 'symptom',
  },
  // ── Pain character ─────────────────────────────────────────────────────────
  {
    id: 'pain_migration',
    label: 'Pain migration (periumbilical → RIF)',
    question: 'Did the pain start centrally / around the navel and migrate to the right lower abdomen?',
    category: 'symptom',
  },
  {
    id: 'colicky_pain',
    label: 'Colicky / wave-like pain',
    question: 'Is the pain colicky or wave-like rather than constant?',
    category: 'symptom',
  },
  // ── Upper GI ───────────────────────────────────────────────────────────────
  {
    id: 'heartburn',
    label: 'Heartburn / acid regurgitation',
    question: 'Is there heartburn or acid coming up into the throat?',
    category: 'symptom',
  },
  {
    id: 'dysphagia',
    label: 'Dysphagia',
    question: 'Is there any difficulty swallowing?',
    category: 'symptom',
  },
  {
    id: 'haematemesis',
    label: 'Haematemesis',
    question: 'Has there been haematemesis or coffee-ground vomiting?',
    category: 'symptom',
  },
  {
    id: 'melaena',
    label: 'Melaena',
    question: 'Is there melaena (black tarry stool)?',
    category: 'symptom',
  },
  // ── Systemic / GI ─────────────────────────────────────────────────────────
  {
    id: 'fever',
    label: 'Fever',
    question: 'Does the patient have a documented or reported fever (>38°C)?',
    category: 'sign',
  },
  {
    id: 'rigors',
    label: 'Rigors / chills',
    question: 'Has the patient had rigors or shaking chills?',
    category: 'symptom',
  },
  {
    id: 'nausea_vomiting',
    label: 'Nausea / vomiting',
    question: 'Is there associated nausea or vomiting?',
    category: 'symptom',
  },
  {
    id: 'anorexia',
    label: 'Anorexia / loss of appetite',
    question: 'Has the patient lost their appetite since symptoms began?',
    category: 'symptom',
  },
  {
    id: 'weight_loss',
    label: 'Unintentional weight loss',
    question: 'Has there been unintentional weight loss in recent months?',
    category: 'symptom',
  },
  {
    id: 'change_bowel_habit',
    label: 'Change in bowel habit',
    question: 'Is there a recent change in bowel habit (frequency, consistency, or alternating constipation/diarrhoea)?',
    category: 'symptom',
  },
  // ── Examination signs ──────────────────────────────────────────────────────
  {
    id: 'rebound_tenderness',
    label: 'Rebound tenderness',
    question: 'Is there rebound tenderness on examination?',
    category: 'sign',
  },
  {
    id: 'murphy_sign',
    label: "Murphy's sign",
    question: "Is Murphy's sign positive (RUQ tenderness with inspiratory arrest)?",
    category: 'sign',
  },
  {
    id: 'groin_swelling',
    label: 'Groin / abdominal wall swelling',
    question: 'Is there a visible or palpable swelling in the groin or abdominal wall?',
    category: 'sign',
  },
  {
    id: 'jaundice',
    label: 'Jaundice',
    question: 'Is there clinical jaundice, yellow sclera, or dark urine?',
    category: 'sign',
  },
  // ── History ────────────────────────────────────────────────────────────────
  {
    id: 'fatty_food_trigger',
    label: 'Fatty food trigger',
    question: 'Are symptoms triggered or worsened by fatty or greasy food?',
    category: 'history',
  },
  {
    id: 'nocturnal_pain',
    label: 'Nocturnal pain',
    question: 'Does pain wake the patient from sleep at night?',
    category: 'symptom',
  },
  {
    id: 'antacid_relief',
    label: 'Antacid relief',
    question: 'Does the pain improve with antacids?',
    category: 'history',
  },
  {
    id: 'nsaid_use',
    label: 'Regular NSAID use',
    question: 'Is the patient taking regular NSAIDs (ibuprofen, diclofenac, etc.)?',
    category: 'history',
  },
  {
    id: 'hernia_irreducible',
    label: 'Hernia irreducible',
    question: 'Is the swelling irreducible (cannot be pushed back)?',
    category: 'sign',
  },
  // ── Investigations ─────────────────────────────────────────────────────────
  {
    id: 'elevated_wbc',
    label: 'Elevated WBC',
    question: 'Is the white cell count elevated on FBC?',
    category: 'investigation',
  },
  {
    id: 'elevated_amylase',
    label: 'Elevated amylase / lipase',
    question: 'Is serum amylase or lipase elevated (>3× upper limit of normal)?',
    category: 'investigation',
  },
  {
    id: 'us_gallstones',
    label: 'USS showing gallstones',
    question: 'Has an ultrasound shown gallstones or thickened gallbladder wall?',
    category: 'investigation',
  },
];

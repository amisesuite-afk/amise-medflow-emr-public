import type { DiseaseNode, Feature } from '../types.js';
import { appendicitis } from './appendicitis.js';
import { cholecystitis } from './cholecystitis.js';
import { pepticUlcer } from './pepticUlcer.js';

// Catch-all node ensuring posteriors always sum to 1.
// Prior = 1 − sum(seed priors) = 1 − 0.08 − 0.15 − 0.10 = 0.67.
// All features default to DEFAULT_SENSITIVITY (0.30) — neutral evidence.
const other: DiseaseNode = {
  id: '_other_',
  label: 'Other / undetermined',
  icd10: 'R69',
  prior: 0.67,
  features: {},
};

export const DISEASES: DiseaseNode[] = [appendicitis, cholecystitis, pepticUlcer, other];

export const FEATURES: Feature[] = [
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
    id: 'pain_migration',
    label: 'Pain migration (periumbilical → RIF)',
    question: 'Did the pain start centrally or around the navel and migrate to the right lower abdomen?',
    category: 'symptom',
  },
  {
    id: 'fever',
    label: 'Fever',
    question: 'Does the patient have a documented or reported fever (>38°C)?',
    category: 'sign',
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
    id: 'jaundice',
    label: 'Jaundice',
    question: 'Is there clinical jaundice, yellow sclera, or dark urine?',
    category: 'sign',
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
  {
    id: 'elevated_wbc',
    label: 'Elevated WBC',
    question: 'Is the white cell count elevated on FBC?',
    category: 'investigation',
  },
  {
    id: 'us_gallstones',
    label: 'USS showing gallstones',
    question: 'Has an ultrasound shown gallstones or thickened gallbladder wall?',
    category: 'investigation',
  },
];

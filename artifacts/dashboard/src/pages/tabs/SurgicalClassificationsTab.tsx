import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ── Classification types ───────────────────────────────────────────────────────

type Hue = 'green' | 'amber' | 'orange' | 'red' | 'blue' | 'purple';

interface ClassOption {
  grade: string;
  label: string;
  description: string;
  color: Hue;
}

interface ClassSystem {
  id: string;
  title: string;
  subtitle?: string;
  reference?: string;
  hasSide?: boolean;
  options: ClassOption[];
}

interface ClassCategory {
  label: string;
  icon: string;
  systems: ClassSystem[];
}

// ── Calculator types ───────────────────────────────────────────────────────────

type FieldType = 'radio' | 'checkbox' | 'number' | 'select';

interface CalcField {
  id: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

interface CalcResult {
  label: string;
  detail: string;
  color: Hue;
  score?: string;
}

interface CalcSystem {
  id: string;
  title: string;
  subtitle?: string;
  reference?: string;
  fields: CalcField[];
  compute: (v: Record<string, string>) => CalcResult | null;
  infoOnly?: boolean;
}

// ── Classification data ────────────────────────────────────────────────────────

const CLASSIFICATIONS: ClassCategory[] = [
  {
    label: 'Hernia',
    icon: '🩺',
    systems: [
      {
        id: 'gilbert_inguinal',
        title: "Gilbert's Inguinal Hernia Classification",
        subtitle: 'Types I–VII — defect size and posterior wall integrity',
        reference: 'Gilbert AI, 1989',
        hasSide: true,
        options: [
          { grade: 'I',   label: 'Type I',   description: 'Indirect — small defect, tight internal ring, easily reduced sac', color: 'green' },
          { grade: 'II',  label: 'Type II',  description: 'Indirect — moderate defect, internal ring dilated ≤4 cm, sac reducible', color: 'green' },
          { grade: 'III', label: 'Type III', description: 'Indirect — large defect, ring >4 cm, scrotal/fundicular, posterior wall intact', color: 'amber' },
          { grade: 'IV',  label: 'Type IV',  description: 'Direct — total floor defect (entire Hesselbach triangle), floor blowout', color: 'amber' },
          { grade: 'V',   label: 'Type V',   description: 'Direct — small diverticular defect, isolated bulge in posterior wall', color: 'amber' },
          { grade: 'VI',  label: 'Type VI',  description: 'Combined (Pantaloon) — concurrent indirect + direct components', color: 'orange' },
          { grade: 'VII', label: 'Type VII', description: 'Femoral hernia', color: 'red' },
        ],
      },
      {
        id: 'nyhus_inguinal',
        title: 'Nyhus Classification (Inguinal Hernia)',
        subtitle: 'Anatomical classification by defect type and floor weakness',
        reference: 'Nyhus LM, 1993',
        hasSide: true,
        options: [
          { grade: 'I',    label: 'Type I',    description: 'Indirect — normal internal ring, floor intact (paediatric)', color: 'green' },
          { grade: 'IIa',  label: 'Type IIa',  description: 'Indirect — dilated internal ring, floor intact', color: 'green' },
          { grade: 'IIb',  label: 'Type IIb',  description: 'Indirect — dilated ring, floor minimally distorted', color: 'amber' },
          { grade: 'IIIa', label: 'Type IIIa', description: 'Direct — floor weakness (Hesselbach triangle)', color: 'amber' },
          { grade: 'IIIb', label: 'Type IIIb', description: 'Indirect — large defect, scrotal, sliding, or pantaloon', color: 'orange' },
          { grade: 'IIIc', label: 'Type IIIc', description: 'Femoral hernia', color: 'orange' },
          { grade: 'IV',   label: 'Type IV',   description: 'Recurrent hernia — any type; may be combined', color: 'red' },
        ],
      },
      {
        id: 'ehs_ventral',
        title: 'EHS Ventral / Incisional Hernia (Width)',
        subtitle: 'European Hernia Society — width classification',
        reference: 'Muysoms FE et al., Hernia 2009',
        options: [
          { grade: 'W1', label: 'W1 ≤4 cm',   description: 'Small defect — width ≤4 cm', color: 'green' },
          { grade: 'W2', label: 'W2 4–10 cm', description: 'Medium defect — width 4–10 cm', color: 'amber' },
          { grade: 'W3', label: 'W3 >10 cm',  description: 'Large defect — width >10 cm', color: 'red' },
        ],
      },
      {
        id: 'chevrel_incisional',
        title: 'CRH (Chevrel-Rath-Mannell) — Incisional Hernia',
        subtitle: 'Location · Width · Number of recurrences',
        reference: 'Chevrel JP, Rath AM, Hernia 2000',
        options: [
          { grade: 'M',  label: 'M — Midline',     description: 'Midline location (L = lateral, ML = both)', color: 'blue' },
          { grade: 'W1', label: 'W1 <5 cm',         description: 'Width <5 cm', color: 'green' },
          { grade: 'W2', label: 'W2 5–10 cm',       description: 'Width 5–10 cm', color: 'amber' },
          { grade: 'W3', label: 'W3 10–15 cm',      description: 'Width 10–15 cm', color: 'orange' },
          { grade: 'W4', label: 'W4 >15 cm',        description: 'Width >15 cm ("loss of domain")', color: 'red' },
          { grade: 'R0', label: 'R0 — Primary',     description: 'No prior repair', color: 'green' },
          { grade: 'R1', label: 'R1 — 1st recur.',  description: 'One prior repair', color: 'amber' },
          { grade: 'R2', label: 'R2 — 2nd recur.',  description: 'Two prior repairs', color: 'orange' },
          { grade: 'R3', label: 'R3 — ≥3 recur.',   description: 'Three or more prior repairs', color: 'red' },
        ],
      },
    ],
  },
  {
    label: 'Chronic Venous Disease',
    icon: '🦵',
    systems: [
      {
        id: 'ceap_clinical',
        title: 'CEAP Clinical Classification — Varicose Veins / CVD',
        subtitle: 'C0–C6 clinical severity of chronic venous disease',
        reference: 'Lurie F et al., J Vasc Surg 2020 (revised)',
        hasSide: true,
        options: [
          { grade: 'C0',  label: 'C0',  description: 'No visible or palpable signs of venous disease', color: 'green' },
          { grade: 'C1',  label: 'C1',  description: 'Telangiectasia or reticular veins (<3 mm)', color: 'green' },
          { grade: 'C2',  label: 'C2',  description: 'Varicose veins (≥3 mm diameter)', color: 'amber' },
          { grade: 'C2r', label: 'C2r', description: 'Recurrent varicose veins (post-treatment)', color: 'amber' },
          { grade: 'C3',  label: 'C3',  description: 'Oedema — without skin changes', color: 'amber' },
          { grade: 'C4a', label: 'C4a', description: 'Pigmentation or eczema', color: 'orange' },
          { grade: 'C4b', label: 'C4b', description: 'Lipodermatosclerosis or atrophie blanche', color: 'orange' },
          { grade: 'C4c', label: 'C4c', description: 'Corona phlebectatica', color: 'orange' },
          { grade: 'C5',  label: 'C5',  description: 'Healed venous ulcer', color: 'red' },
          { grade: 'C6',  label: 'C6',  description: 'Active venous ulcer', color: 'red' },
          { grade: 'C6r', label: 'C6r', description: 'Recurrent active venous ulcer', color: 'red' },
        ],
      },
      {
        id: 'widmer_venous',
        title: 'Widmer Classification — Chronic Venous Insufficiency',
        subtitle: 'Clinical staging of CVI severity',
        reference: 'Widmer LK, 1978',
        hasSide: true,
        options: [
          { grade: 'I',   label: 'Grade I',   description: 'Dilated veins, ankle oedema, corona phlebectatica paraplantaris', color: 'green' },
          { grade: 'II',  label: 'Grade II',  description: 'Trophic skin changes — lipodermatosclerosis, hyperpigmentation, white atrophy', color: 'amber' },
          { grade: 'III', label: 'Grade III', description: 'Frank venous ulceration — florid or healed', color: 'red' },
        ],
      },
    ],
  },
  {
    label: 'Anorectal',
    icon: '🔬',
    systems: [
      {
        id: 'goligher_haemorrhoids',
        title: "Goligher's Internal Haemorrhoid Classification",
        subtitle: 'Grade I–IV by degree of prolapse — guides treatment selection',
        reference: 'Goligher JC, 1975',
        options: [
          { grade: 'I',   label: 'Grade I',   description: 'Bleed only — no prolapse, arise above dentate line', color: 'green' },
          { grade: 'II',  label: 'Grade II',  description: 'Prolapse on straining — reduce spontaneously', color: 'green' },
          { grade: 'III', label: 'Grade III', description: 'Prolapse on straining — require manual reduction', color: 'amber' },
          { grade: 'IV',  label: 'Grade IV',  description: 'Permanently prolapsed — irreducible, incarceration risk', color: 'red' },
        ],
      },
      {
        id: 'parks_fistula',
        title: "Parks' Classification — Anal Fistula-in-Ano",
        subtitle: 'Relationship of track to external anal sphincter',
        reference: 'Parks AG, Gordon PH, Hardcastle JD, 1976',
        options: [
          { grade: 'Intersphincteric', label: 'Intersphincteric', description: 'Track between internal and external sphincter — most common (70%); low risk to continence', color: 'green' },
          { grade: 'Transsphincteric', label: 'Transsphincteric', description: 'Track crosses external sphincter — moderate continence risk; LIFT or staged seton', color: 'amber' },
          { grade: 'Suprasphincteric', label: 'Suprasphincteric', description: 'Track loops above puborectalis — high continence risk; technically demanding', color: 'orange' },
          { grade: 'Extrasphincteric', label: 'Extrasphincteric', description: "Track entirely outside sphincters — rarest; often secondary to pelvic pathology or Crohn's", color: 'red' },
        ],
      },
    ],
  },
  {
    label: 'Peripheral Arterial Disease',
    icon: '🫀',
    systems: [
      {
        id: 'fontaine_pad',
        title: 'Fontaine Classification — PAD',
        subtitle: 'Clinical staging of peripheral arterial occlusive disease',
        reference: 'Fontaine R et al., 1954',
        hasSide: true,
        options: [
          { grade: 'I',   label: 'Stage I',   description: 'Asymptomatic — haemodynamically significant stenosis, no symptoms', color: 'green' },
          { grade: 'IIa', label: 'Stage IIa', description: 'Intermittent claudication — walking distance >200 m', color: 'green' },
          { grade: 'IIb', label: 'Stage IIb', description: 'Intermittent claudication — walking distance <200 m', color: 'amber' },
          { grade: 'III', label: 'Stage III', description: 'Ischaemic rest pain — nocturnal, foot dependent for relief', color: 'orange' },
          { grade: 'IV',  label: 'Stage IV',  description: 'Tissue loss — trophic ulceration, gangrene, necrosis', color: 'red' },
        ],
      },
      {
        id: 'rutherford_pad',
        title: 'Rutherford Classification — Chronic Limb Ischaemia',
        subtitle: 'SVS/ISCVS categories for chronic peripheral arterial disease',
        reference: 'Rutherford RB et al., J Vasc Surg 1997',
        hasSide: true,
        options: [
          { grade: '0', label: 'Cat 0 — Asymptomatic', description: 'No haemodynamic compromise — normal treadmill/reactive hyperaemia test', color: 'green' },
          { grade: '1', label: 'Cat 1 — Mild IC',       description: 'Mild intermittent claudication — completes treadmill; post-exercise ABI >50 mmHg', color: 'green' },
          { grade: '2', label: 'Cat 2 — Moderate IC',   description: 'Moderate claudication — between categories 1 and 3', color: 'amber' },
          { grade: '3', label: 'Cat 3 — Severe IC',     description: 'Severe claudication — cannot complete standard treadmill; post-exercise ABI <50 mmHg', color: 'amber' },
          { grade: '4', label: 'Cat 4 — Rest pain',     description: 'Ischaemic rest pain — rest ABI usually <40 mmHg; ankle/metatarsal pressure <30 mmHg', color: 'orange' },
          { grade: '5', label: 'Cat 5 — Minor loss',    description: 'Minor tissue loss — non-healing ulcer, focal gangrene with diffuse pedal ischaemia', color: 'red' },
          { grade: '6', label: 'Cat 6 — Major loss',    description: 'Major tissue loss — gangrene above TM level; foot not salvageable', color: 'red' },
        ],
      },
    ],
  },
  {
    label: 'General Surgical',
    icon: '🏥',
    systems: [
      {
        id: 'asa_status',
        title: 'ASA Physical Status Classification',
        subtitle: 'Pre-operative risk stratification — American Society of Anesthesiologists',
        reference: 'ASA, revised 2020',
        options: [
          { grade: 'I',   label: 'ASA I',   description: 'Normal healthy patient — no organic, physiological or psychiatric disease', color: 'green' },
          { grade: 'II',  label: 'ASA II',  description: 'Mild systemic disease — controlled DM/HTN, BMI <40, mild COPD, social alcohol', color: 'green' },
          { grade: 'III', label: 'ASA III', description: 'Severe systemic disease — poorly controlled DM/HTN, morbid obesity, active hepatitis, EF <35%, ESRD on dialysis', color: 'amber' },
          { grade: 'IV',  label: 'ASA IV',  description: 'Constant threat to life — recent MI/CVA (<3 mo), ongoing cardiac ischaemia, severe valvular disease, sepsis', color: 'orange' },
          { grade: 'V',   label: 'ASA V',   description: 'Moribund — not expected to survive without the operation (ruptured AAA, massive haemorrhage, intracranial bleed)', color: 'red' },
          { grade: 'VI',  label: 'ASA VI',  description: 'Brain-dead — organ procurement only', color: 'red' },
        ],
      },
      {
        id: 'clavien_dindo',
        title: 'Clavien-Dindo — Post-operative Complications',
        subtitle: 'Grading by treatment required; suffix "d" if complication present at discharge',
        reference: 'Dindo D, Demartines N, Clavien PA, Ann Surg 2004',
        options: [
          { grade: 'I',    label: 'Grade I',    description: 'Deviation from normal course — bed rest, physiotherapy, oral drugs, wound care only', color: 'green' },
          { grade: 'II',   label: 'Grade II',   description: 'Pharmacological treatment beyond Grade I — blood transfusion, TPN, IV antibiotics', color: 'green' },
          { grade: 'IIIa', label: 'Grade IIIa', description: 'Intervention required — under local anaesthesia (e.g. drain insertion, endoscopy)', color: 'amber' },
          { grade: 'IIIb', label: 'Grade IIIb', description: 'Intervention required — under general/regional/spinal anaesthesia', color: 'amber' },
          { grade: 'IVa',  label: 'Grade IVa',  description: 'Life-threatening — ICU management; single organ dysfunction (incl. dialysis)', color: 'orange' },
          { grade: 'IVb',  label: 'Grade IVb',  description: 'Life-threatening — ICU management; multi-organ dysfunction', color: 'red' },
          { grade: 'V',    label: 'Grade V',    description: 'Death', color: 'red' },
        ],
      },
      {
        id: 'altemeier_wound',
        title: 'Altemeier Wound Classification',
        subtitle: 'Surgical site contamination category — predicts SSI risk',
        reference: 'NAS/NRC Ad Hoc Committee, 1964',
        options: [
          { grade: 'Clean',              label: 'Clean (I)',               description: 'Elective, primarily closed, no inflammation — GI/respiratory/biliary not entered. SSI risk <2%', color: 'green' },
          { grade: 'Clean-contaminated', label: 'Clean-Contaminated (II)', description: 'Controlled entry into GI/respiratory/biliary/GU tract, no significant spillage. SSI risk <10%', color: 'amber' },
          { grade: 'Contaminated',       label: 'Contaminated (III)',      description: 'Acute non-purulent inflammation, major GI spillage, open fresh traumatic wounds. SSI risk ~20%', color: 'orange' },
          { grade: 'Dirty-infected',     label: 'Dirty-Infected (IV)',     description: 'Existing clinical infection, perforated viscera, old traumatic wounds. SSI risk ~40%', color: 'red' },
        ],
      },
      {
        id: 'hinchey_diverticulitis',
        title: 'Hinchey Classification — Perforated Diverticulitis',
        subtitle: 'Stages I–IV of diverticular perforation severity; guides operative vs. non-operative approach',
        reference: 'Hinchey EJ et al., Adv Surg 1978',
        options: [
          { grade: 'I',   label: 'Stage I',   description: 'Pericolic / mesenteric abscess — localised, adjacent to perforation site', color: 'green' },
          { grade: 'II',  label: 'Stage II',  description: 'Pelvic / intra-abdominal / retroperitoneal abscess — walled-off distant collection', color: 'amber' },
          { grade: 'III', label: 'Stage III', description: 'Generalised purulent peritonitis — ruptured pericolic/pelvic abscess; no faecal contamination', color: 'orange' },
          { grade: 'IV',  label: 'Stage IV',  description: 'Generalised faecal peritonitis — free perforation of unprepared diverticulum', color: 'red' },
        ],
      },
      {
        id: 'child_pugh',
        title: 'Child-Pugh Classification — Hepatic Reserve',
        subtitle: 'Classes A / B / C for liver disease severity and surgical risk stratification',
        reference: 'Child CG, Turcotte JG, 1964 · Pugh RN et al., Br J Surg 1973',
        options: [
          { grade: 'A', label: 'Class A (5–6 pts)',   description: 'Well-compensated — 1-year survival ~100%; surgical mortality <5%', color: 'green' },
          { grade: 'B', label: 'Class B (7–9 pts)',   description: 'Significant compromise — 1-year survival ~80%; surgical mortality 10–15%', color: 'amber' },
          { grade: 'C', label: 'Class C (10–15 pts)', description: 'Decompensated — 1-year survival ~45%; surgical mortality >25%; consider transplant listing', color: 'red' },
        ],
      },
    ],
  },
];

// ── Calculators ────────────────────────────────────────────────────────────────

function tnmStage(T: string, N: string, M: string): CalcResult | null {
  if (!T || !N || !M) return null;
  if (M === 'M1') return { label: 'Stage IV', detail: 'Distant metastatic disease.', color: 'red', score: 'IV' };

  const isT4 = T.startsWith('T4');
  const isTis = T === 'Tis';
  const isT0 = T === 'T0';
  const isT1 = ['T1mi', 'T1a', 'T1b', 'T1c'].includes(T) || T === 'T1';
  const isT2 = T === 'T2';
  const isT3 = T === 'T3';

  const isN0  = N === 'N0';
  const isN1mi = N === 'N1mi';
  const isN1  = N === 'N1';
  const isN2  = N === 'N2a' || N === 'N2b';
  const isN3  = N === 'N3a' || N === 'N3b' || N === 'N3c';

  if (isTis && isN0) return { label: 'Stage 0', detail: 'Carcinoma in situ.', color: 'green', score: '0' };
  if (isN3) return { label: 'Stage IIIC', detail: 'N3 disease regardless of T.', color: 'red', score: 'IIIC' };
  if (isT4) return { label: 'Stage IIIB', detail: 'T4 (chest wall/skin) — locally advanced.', color: 'red', score: 'IIIB' };
  if (isN2) return { label: 'Stage IIIA', detail: 'N2 nodal burden — ipsilateral infraclavicular / internal mammary.', color: 'orange', score: 'IIIA' };
  if (isT3 && isN1) return { label: 'Stage IIIA', detail: 'T3N1 — large primary with axillary nodes.', color: 'orange', score: 'IIIA' };
  if (isT3 && isN0) return { label: 'Stage IIB', detail: 'T3N0 — large tumour, node-negative.', color: 'amber', score: 'IIB' };
  if (isT2 && isN1) return { label: 'Stage IIB', detail: 'T2N1 — 2–5 cm with positive axillary nodes.', color: 'amber', score: 'IIB' };
  if (isT2 && isN0) return { label: 'Stage IIA', detail: 'T2N0 — 2–5 cm, node-negative.', color: 'amber', score: 'IIA' };
  if ((isT0 || isT1) && isN1) return { label: 'Stage IIA', detail: 'T0/T1 with positive axillary nodes (not micrometastases).', color: 'amber', score: 'IIA' };
  if ((isT0 || isT1) && isN1mi) return { label: 'Stage IB', detail: 'Micrometastases only (0.2–2 mm) in sentinel node.', color: 'green', score: 'IB' };
  if (isT1 && isN0) return { label: 'Stage IA', detail: 'Small primary, node-negative.', color: 'green', score: 'IA' };
  if (isT0 && isN0) return { label: 'Stage IA', detail: 'No detectable primary, node-negative (occult primary).', color: 'green', score: 'IA' };
  return { label: 'Unclassified', detail: 'Review T/N/M combination against full AJCC 8th edition tables.', color: 'blue', score: '?' };
}

const CALCULATORS: CalcSystem[] = [
  {
    id: 'calc_child_pugh',
    title: 'Child-Pugh Score Calculator',
    subtitle: 'Computes hepatic reserve class from five clinical and biochemical parameters',
    reference: 'Child-Turcotte 1964 · Pugh RN et al., Br J Surg 1973',
    fields: [
      {
        id: 'bilirubin', label: 'Total Bilirubin', type: 'radio',
        options: [
          { value: '1', label: '<34 μmol/L (1 pt)' },
          { value: '2', label: '34–50 μmol/L (2 pts)' },
          { value: '3', label: '>50 μmol/L (3 pts)' },
        ],
      },
      {
        id: 'albumin', label: 'Serum Albumin', type: 'radio',
        options: [
          { value: '1', label: '>35 g/L (1 pt)' },
          { value: '2', label: '28–35 g/L (2 pts)' },
          { value: '3', label: '<28 g/L (3 pts)' },
        ],
      },
      {
        id: 'inr', label: 'INR / Prothrombin time', type: 'radio',
        options: [
          { value: '1', label: 'INR <1.7 (1 pt)' },
          { value: '2', label: 'INR 1.7–2.3 (2 pts)' },
          { value: '3', label: 'INR >2.3 (3 pts)' },
        ],
      },
      {
        id: 'ascites', label: 'Ascites', type: 'radio',
        options: [
          { value: '1', label: 'None (1 pt)' },
          { value: '2', label: 'Mild / diuretic-responsive (2 pts)' },
          { value: '3', label: 'Refractory (3 pts)' },
        ],
      },
      {
        id: 'encephalopathy', label: 'Hepatic Encephalopathy', type: 'radio',
        options: [
          { value: '1', label: 'None (1 pt)' },
          { value: '2', label: 'Grade I–II (2 pts)' },
          { value: '3', label: 'Grade III–IV (3 pts)' },
        ],
      },
    ],
    compute(v) {
      const keys = ['bilirubin', 'albumin', 'inr', 'ascites', 'encephalopathy'];
      if (keys.some(k => !v[k])) return null;
      const total = keys.reduce((s, k) => s + Number(v[k]), 0);
      if (total <= 6) return { label: 'Class A', score: `${total}/15`, detail: `Score ${total} — Well-compensated. 1-yr survival ~100%. Surgical mortality <5%.`, color: 'green' };
      if (total <= 9) return { label: 'Class B', score: `${total}/15`, detail: `Score ${total} — Significant compromise. 1-yr survival ~80%. Surgical mortality 10–15%.`, color: 'amber' };
      return { label: 'Class C', score: `${total}/15`, detail: `Score ${total} — Decompensated. 1-yr survival ~45%. Surgical mortality >25%. Consider transplant evaluation.`, color: 'red' };
    },
  },
  {
    id: 'calc_meld',
    title: 'MELD Score Calculator',
    subtitle: 'Model for End-stage Liver Disease — predicts 90-day mortality and guides organ allocation',
    reference: 'Malinchoc M et al., Hepatology 2000 · UNOS MELD policy',
    fields: [
      { id: 'bili',  label: 'Bilirubin (mg/dL)', type: 'number', min: 0.1, step: 0.1, placeholder: 'e.g. 1.2', unit: 'mg/dL' },
      { id: 'inr',  label: 'INR', type: 'number', min: 0.5, step: 0.1, placeholder: 'e.g. 1.1', unit: '' },
      { id: 'creat', label: 'Creatinine (mg/dL)', type: 'number', min: 0.1, step: 0.1, placeholder: 'e.g. 1.0', unit: 'mg/dL' },
    ],
    compute(v) {
      const bili  = Math.max(1.0, Number(v.bili)  || 0);
      const inr   = Math.max(1.0, Number(v.inr)   || 0);
      const creat = Math.min(4.0, Math.max(1.0, Number(v.creat) || 0));
      if (!v.bili || !v.inr || !v.creat) return null;
      const raw = 3.78 * Math.log(bili) + 11.2 * Math.log(inr) + 9.57 * Math.log(creat) + 6.43;
      const score = Math.min(40, Math.round(raw));
      let label: string, detail: string, color: Hue;
      if (score < 10)      { label = 'Low risk';       color = 'green';  detail = `MELD ${score} — 90-day mortality ~2%.`; }
      else if (score < 20) { label = 'Moderate risk';  color = 'amber';  detail = `MELD ${score} — 90-day mortality ~6%.`; }
      else if (score < 30) { label = 'High risk';      color = 'orange'; detail = `MELD ${score} — 90-day mortality ~20%. Prioritise on transplant list.`; }
      else if (score < 40) { label = 'Very high risk'; color = 'red';    detail = `MELD ${score} — 90-day mortality ~53%. Urgent transplant evaluation.`; }
      else                 { label = 'Critical';       color = 'red';    detail = `MELD ≥40 — 90-day mortality ~71%. Listing urgent.`; }
      return { label, score: `${score}`, detail, color };
    },
  },
  {
    id: 'calc_bisap',
    title: 'BISAP Score — Acute Pancreatitis Severity',
    subtitle: 'Bedside Index for Severity in Acute Pancreatitis — 5-variable 24-hour score',
    reference: 'Wu BU et al., Am J Gastroenterol 2008',
    fields: [
      {
        id: 'bun', label: 'BUN >25 mg/dL (>8.9 mmol/L)', type: 'radio',
        options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }],
      },
      {
        id: 'ams', label: 'Impaired mental status (Glasgow Coma Scale <15 / confusion)', type: 'radio',
        options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }],
      },
      {
        id: 'sirs', label: 'SIRS — ≥2 criteria met (temp <36°C or >38°C; HR >90; RR >20; WBC <4 or >12)', type: 'radio',
        options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }],
      },
      {
        id: 'age', label: 'Age >60 years', type: 'radio',
        options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }],
      },
      {
        id: 'pleural', label: 'Pleural effusion on imaging', type: 'radio',
        options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }],
      },
    ],
    compute(v) {
      const keys = ['bun', 'ams', 'sirs', 'age', 'pleural'];
      if (keys.some(k => !v[k] && v[k] !== '0')) return null;
      const score = keys.reduce((s, k) => s + Number(v[k]), 0);
      const mortMap: Record<number, string> = { 0: '<1%', 1: '1–2%', 2: '2–4%', 3: '5–9%', 4: '13%', 5: '22–37%' };
      const colorMap: Record<number, Hue> = { 0: 'green', 1: 'green', 2: 'amber', 3: 'amber', 4: 'orange', 5: 'red' };
      return {
        label: `BISAP ${score}/5`,
        score: `${score}`,
        detail: `In-hospital mortality: ${mortMap[score] ?? '>20%'}. ${score >= 3 ? 'High risk — early ICU consideration, aggressive resuscitation.' : score >= 2 ? 'Intermediate risk — close monitoring warranted.' : 'Low risk — standard care.'}`,
        color: colorMap[score] ?? 'red',
      };
    },
  },
  {
    id: 'calc_nottingham',
    title: 'Nottingham Histological Grade (Elston-Ellis)',
    subtitle: 'Breast cancer histological grading — tubule formation, nuclear pleomorphism, mitotic count',
    reference: 'Elston CW, Ellis IO, Histopathology 1991',
    fields: [
      {
        id: 'tubule', label: 'Tubule Formation', type: 'radio',
        options: [
          { value: '1', label: '>75% of tumour area (1 pt)' },
          { value: '2', label: '10–75% (2 pts)' },
          { value: '3', label: '<10% (3 pts)' },
        ],
      },
      {
        id: 'nuclear', label: 'Nuclear Pleomorphism', type: 'radio',
        options: [
          { value: '1', label: 'Small, uniform nuclei — little variation (1 pt)' },
          { value: '2', label: 'Moderate increase in size and variation (2 pts)' },
          { value: '3', label: 'Marked pleomorphism — vesicular nuclei, prominent nucleoli (3 pts)' },
        ],
      },
      {
        id: 'mitotic', label: 'Mitotic Count (per 10 HPF — check lab field area)', type: 'radio',
        options: [
          { value: '1', label: 'Low (1 pt)' },
          { value: '2', label: 'Intermediate (2 pts)' },
          { value: '3', label: 'High (3 pts)' },
        ],
      },
    ],
    compute(v) {
      const keys = ['tubule', 'nuclear', 'mitotic'];
      if (keys.some(k => !v[k])) return null;
      const total = keys.reduce((s, k) => s + Number(v[k]), 0);
      if (total <= 5) return { label: 'Grade 1', score: `${total}/9`, detail: `Score ${total} — Well differentiated. Favourable prognosis.`, color: 'green' };
      if (total <= 7) return { label: 'Grade 2', score: `${total}/9`, detail: `Score ${total} — Moderately differentiated. Intermediate prognosis.`, color: 'amber' };
      return { label: 'Grade 3', score: `${total}/9`, detail: `Score ${total} — Poorly differentiated. Less favourable prognosis; may benefit from chemotherapy.`, color: 'red' };
    },
  },
  {
    id: 'calc_breast_tnm',
    title: 'Breast Cancer TNM Staging (AJCC 8th Edition)',
    subtitle: 'Anatomic clinical stage — select T, N, M to derive overall stage group',
    reference: 'AJCC Cancer Staging Manual, 8th edition 2017',
    fields: [
      {
        id: 'T', label: 'T — Primary Tumour', type: 'select',
        options: [
          { value: '', label: '— Select T —' },
          { value: 'TX',   label: 'TX — Cannot be assessed' },
          { value: 'T0',   label: 'T0 — No evidence of primary tumour' },
          { value: 'Tis',  label: 'Tis — In situ (DCIS / LCIS / Paget\'s)' },
          { value: 'T1mi', label: 'T1mi — Microinvasion ≤1 mm' },
          { value: 'T1a',  label: 'T1a — >1 mm and ≤5 mm' },
          { value: 'T1b',  label: 'T1b — >5 mm and ≤10 mm' },
          { value: 'T1c',  label: 'T1c — >10 mm and ≤20 mm' },
          { value: 'T2',   label: 'T2 — >20 mm and ≤50 mm' },
          { value: 'T3',   label: 'T3 — >50 mm' },
          { value: 'T4a',  label: 'T4a — Chest wall invasion (not pectoralis)' },
          { value: 'T4b',  label: 'T4b — Skin oedema/ulceration/satellite nodules' },
          { value: 'T4c',  label: 'T4c — Both T4a and T4b' },
          { value: 'T4d',  label: 'T4d — Inflammatory carcinoma' },
        ],
      },
      {
        id: 'N', label: 'N — Regional Nodes', type: 'select',
        options: [
          { value: '', label: '— Select N —' },
          { value: 'NX',  label: 'NX — Cannot be assessed' },
          { value: 'N0',  label: 'N0 — No regional lymph node metastasis' },
          { value: 'N1mi', label: 'N1mi — Micrometastases (0.2–2 mm)' },
          { value: 'N1',  label: 'N1 — 1–3 axillary nodes / internal mammary (microscopic)' },
          { value: 'N2a', label: 'N2a — 4–9 axillary nodes' },
          { value: 'N2b', label: 'N2b — Internal mammary nodes (clinically detected)' },
          { value: 'N3a', label: 'N3a — ≥10 axillary nodes or infraclavicular nodes' },
          { value: 'N3b', label: 'N3b — Internal mammary + axillary nodes' },
          { value: 'N3c', label: 'N3c — Supraclavicular nodes' },
        ],
      },
      {
        id: 'M', label: 'M — Distant Metastasis', type: 'select',
        options: [
          { value: '', label: '— Select M —' },
          { value: 'M0',      label: 'M0 — No clinical/radiographic evidence of metastasis' },
          { value: 'cM0i+',   label: 'cM0(i+) — Circulating/disseminated tumour cells only' },
          { value: 'M1',      label: 'M1 — Distant metastasis' },
        ],
      },
    ],
    compute(v) {
      return tnmStage(v.T ?? '', v.N ?? '', v.M ?? '');
    },
  },
  {
    id: 'calc_gail',
    title: 'Gail Breast Cancer Risk Profile',
    subtitle: 'Risk factor documentation — verify 5-year and lifetime risk % at NCI BCRAT',
    reference: 'Gail MH et al., J Natl Cancer Inst 1989 · NCI BCRAT',
    infoOnly: true,
    fields: [
      {
        id: 'menarche', label: 'Age at first menstrual period', type: 'radio',
        options: [
          { value: 'high',   label: '≤11 years (higher risk)' },
          { value: 'mid',    label: '12–13 years' },
          { value: 'low',    label: '≥14 years (lower risk)' },
        ],
      },
      {
        id: 'first_birth', label: 'Age at first live birth', type: 'radio',
        options: [
          { value: 'low',  label: '<20 years (lower risk)' },
          { value: 'mid1', label: '20–24 years' },
          { value: 'mid2', label: '25–29 years' },
          { value: 'high', label: '≥30 or nulliparous (higher risk)' },
        ],
      },
      {
        id: 'relatives', label: '1st-degree relatives with breast cancer', type: 'radio',
        options: [
          { value: '0', label: 'None' },
          { value: '1', label: '1 relative' },
          { value: '2', label: '≥2 relatives' },
        ],
      },
      {
        id: 'biopsies', label: 'Prior breast biopsies', type: 'radio',
        options: [
          { value: '0', label: 'None' },
          { value: '1', label: '1 biopsy' },
          { value: '2', label: '≥2 biopsies' },
        ],
      },
      {
        id: 'atyp', label: 'Atypical hyperplasia on biopsy', type: 'radio',
        options: [
          { value: '0', label: 'No / unknown' },
          { value: '1', label: 'Yes' },
        ],
      },
    ],
    compute(v) {
      const keys = ['menarche', 'first_birth', 'relatives', 'biopsies', 'atyp'];
      if (keys.some(k => !v[k])) return null;
      let riskPts = 0;
      if (v.menarche === 'high') riskPts += 2; else if (v.menarche === 'mid') riskPts += 1;
      if (v.first_birth === 'high') riskPts += 2; else if (v.first_birth === 'mid2') riskPts += 1;
      riskPts += Math.min(4, Number(v.relatives) * 2);
      riskPts += Math.min(2, Number(v.biopsies));
      riskPts += Number(v.atyp) * 2;
      let label: string, color: Hue, detail: string;
      if (riskPts <= 2)      { label = 'Average risk profile';       color = 'green';  detail = 'Few risk factors identified. Confirm lifetime risk with NCI BCRAT for clinical decisions.'; }
      else if (riskPts <= 5) { label = 'Intermediate risk profile';  color = 'amber';  detail = 'Multiple moderate risk factors. Calculate exact 5-year and lifetime risk at NCI BCRAT. Discuss annual mammography schedule.'; }
      else                   { label = 'Elevated risk profile';      color = 'orange'; detail = 'High-risk factor burden. Obtain NCI BCRAT risk estimate. Consider referral for genetic counselling and enhanced surveillance (MRI + mammography).'; }
      return { label, score: `${riskPts} pts`, detail, color };
    },
  },
];

// ── Colour maps ────────────────────────────────────────────────────────────────

const HUE_BG: Record<Hue, string> = {
  green: '#d1fae5', amber: '#fef3c7', orange: '#ffedd5',
  red:   '#fee2e2', blue:  '#dbeafe', purple: '#ede9fe',
};
const HUE_BORDER: Record<Hue, string> = {
  green: '#6ee7b7', amber: '#fcd34d', orange: '#fdba74',
  red:   '#fca5a5', blue:  '#93c5fd', purple: '#c4b5fd',
};
const HUE_TEXT: Record<Hue, string> = {
  green: '#065f46', amber: '#78350f', orange: '#7c2d12',
  red:   '#7f1d1d', blue:  '#1e3a8a', purple: '#4c1d95',
};

const SIDE_OPTIONS = ['Left', 'Right', 'Bilateral'] as const;
type Side = typeof SIDE_OPTIONS[number];

// ── Classification card ────────────────────────────────────────────────────────

function ClassSystemCard({
  system, value, side, onSelect, onSide,
}: {
  system: ClassSystem;
  value: string;
  side: Side | '';
  onSelect: (grade: string) => void;
  onSide: (s: Side | '') => void;
}) {
  const selected = system.options.find(o => o.grade === value);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{system.title}</div>
        {system.subtitle && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{system.subtitle}</div>}
        {system.reference && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, fontStyle: 'italic' }}>{system.reference}</div>}
      </div>
      {system.hasSide && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#64748b', alignSelf: 'center', fontWeight: 600 }}>Side:</span>
          {SIDE_OPTIONS.map(s => (
            <button key={s} type="button" onClick={() => onSide(side === s ? '' : s)} style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
              border: side === s ? '1.5px solid #0d9488' : '1px solid #d1d5db',
              background: side === s ? '#0d9488' : '#f9fafb',
              color: side === s ? '#fff' : '#374151',
              fontWeight: side === s ? 700 : 400,
            }}>{s}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {system.options.map(opt => {
          const isActive = value === opt.grade;
          return (
            <button key={opt.grade} type="button" onClick={() => onSelect(isActive ? '' : opt.grade)} style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: isActive ? `2px solid ${HUE_BORDER[opt.color]}` : '1px solid #e2e8f0',
              background: isActive ? HUE_BG[opt.color] : '#f8fafc',
              color: isActive ? HUE_TEXT[opt.color] : '#374151',
              fontWeight: isActive ? 700 : 500, transition: 'all 0.1s',
            }}>{opt.label}</button>
          );
        })}
      </div>
      {selected && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: HUE_BG[selected.color], border: `1px solid ${HUE_BORDER[selected.color]}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: HUE_TEXT[selected.color], marginBottom: 2 }}>
            {selected.label}{system.hasSide && side ? ` — ${side}` : ''}
          </div>
          <div style={{ fontSize: 12, color: HUE_TEXT[selected.color] }}>{selected.description}</div>
        </div>
      )}
    </div>
  );
}

// ── Calculator card ────────────────────────────────────────────────────────────

function CalcCard({ calc, values, onChange }: {
  calc: CalcSystem;
  values: Record<string, string>;
  onChange: (id: string, val: string) => void;
}) {
  const result = calc.compute(values);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{calc.title}</div>
        {calc.subtitle && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{calc.subtitle}</div>}
        {calc.reference && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, fontStyle: 'italic' }}>{calc.reference}</div>}
      </div>

      {calc.fields.map(field => (
        <div key={field.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{field.label}</div>
          {(field.type === 'radio' || field.type === 'select') && field.options && field.type === 'radio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {field.options.map(opt => {
                const isActive = values[field.id] === opt.value;
                return (
                  <button key={opt.value} type="button"
                    onClick={() => onChange(field.id, isActive ? '' : opt.value)}
                    style={{
                      padding: '6px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', textAlign: 'left',
                      border: isActive ? '2px solid #0d9488' : '1px solid #e2e8f0',
                      background: isActive ? '#f0fdfa' : '#f8fafc',
                      color: isActive ? '#0f766e' : '#374151',
                      fontWeight: isActive ? 700 : 400,
                    }}
                  >{opt.label}</button>
                );
              })}
            </div>
          )}
          {field.type === 'select' && field.options && (
            <select
              value={values[field.id] ?? ''}
              onChange={e => onChange(field.id, e.target.value)}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }}
            >
              {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          )}
          {field.type === 'number' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                value={values[field.id] ?? ''}
                onChange={e => onChange(field.id, e.target.value)}
                min={field.min}
                max={field.max}
                step={field.step}
                placeholder={field.placeholder}
                style={{ width: 110, fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
              />
              {field.unit && <span style={{ fontSize: 12, color: '#64748b' }}>{field.unit}</span>}
            </div>
          )}
        </div>
      ))}

      {/* Result */}
      {result ? (
        <div style={{
          padding: '12px 14px', borderRadius: 8,
          background: HUE_BG[result.color], border: `1.5px solid ${HUE_BORDER[result.color]}`,
          marginTop: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: HUE_TEXT[result.color] }}>{result.label}</span>
            {result.score && (
              <span style={{ fontSize: 12, fontWeight: 600, color: HUE_TEXT[result.color], opacity: 0.8 }}>({result.score})</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: HUE_TEXT[result.color], lineHeight: 1.5 }}>{result.detail}</div>
          {calc.infoOnly && (
            <div style={{ fontSize: 11, color: HUE_TEXT[result.color], opacity: 0.75, marginTop: 6, fontStyle: 'italic' }}>
              ⚠️ This is a qualitative risk profile only. Calculate exact 5-year and lifetime risk % at bcrisktool.cancer.gov (NCI BCRAT).
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#94a3b8' }}>
          Complete all fields above to calculate result
        </div>
      )}
    </div>
  );
}

// ── Suggested tools panel ──────────────────────────────────────────────────────

function SuggestedToolsPanel() {
  const tools = [
    { name: 'P-POSSUM', use: 'Physiological & Operative Severity Score — predicted morbidity and mortality for major surgery' },
    { name: 'APACHE II', use: 'Acute Physiology and Chronic Health Evaluation II — ICU mortality prediction' },
    { name: 'Thyroid TIRADS (ACR)', use: 'Thyroid Imaging Reporting and Data System — ultrasound-based malignancy risk for thyroid nodules' },
    { name: 'Bethesda System (Thyroid)', use: 'Cytopathological classification for thyroid FNA — guides surgical vs. surveillance decisions' },
    { name: 'WIfI Score', use: 'Wound, Ischaemia, foot Infection — guides limb salvage and revascularisation decisions' },
    { name: 'PREDICT Breast', use: 'Post-operative breast cancer survival prediction — adjuvant chemotherapy benefit estimation' },
    { name: 'Colorectal TNM (AJCC 8th)', use: 'T/N/M staging for colon and rectal carcinoma including peritoneal category' },
    { name: 'Gastric Cancer TNM (AJCC 8th)', use: 'Stomach adenocarcinoma staging — relevant for ERCP and upper GI practice' },
    { name: 'Glasgow Score (Acute Pancreatitis)', use: 'Eight clinical variables at 48 hours — score ≥3 = severe acute pancreatitis' },
    { name: 'Alvarado Score', use: 'Clinical scoring for acute appendicitis — guides surgical vs. conservative approach' },
  ];
  return (
    <div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 12, lineHeight: 1.5 }}>
        The following validated tools are relevant to a specialist general and endoscopic surgical practice. They are listed for clinical awareness; reference their original publications or validated online calculators for use.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tools.map(t => (
          <div key={t.name} style={{ padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{t.name}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.use}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab list ───────────────────────────────────────────────────────────────────

const CLASS_TABS = CLASSIFICATIONS.map(c => ({ key: c.label, label: c.label, icon: c.icon, kind: 'class' as const }));
const CALC_TAB   = { key: 'Calculators', label: 'Calculators', icon: '🧮', kind: 'calc' as const };
const SUGGEST_TAB = { key: 'More Tools', label: 'More Tools', icon: '📋', kind: 'suggest' as const };
const ALL_TABS = [...CLASS_TABS, CALC_TAB, SUGGEST_TAB];

// ── Main component ─────────────────────────────────────────────────────────────

export default function SurgicalClassificationsTab() {
  const { surgicalClassifications, setSurgicalClassifications } = useAppContext();
  const [activeTab, setActiveTab] = useState(0);

  function setGrade(systemId: string, grade: string) {
    setSurgicalClassifications({ ...surgicalClassifications, [systemId]: grade });
  }
  function setSide(systemId: string, side: Side | '') {
    setSurgicalClassifications({ ...surgicalClassifications, [`${systemId}_side`]: side });
  }
  function setCalcField(calcId: string, fieldId: string, val: string) {
    const raw = surgicalClassifications[`calc_${calcId}`];
    const prev: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    setSurgicalClassifications({
      ...surgicalClassifications,
      [`calc_${calcId}`]: JSON.stringify({ ...prev, [fieldId]: val }),
    });
  }
  function calcValues(calcId: string): Record<string, string> {
    const raw = surgicalClassifications[`calc_${calcId}`];
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  }

  const activeClassCount = CLASSIFICATIONS.flatMap(c => c.systems).filter(s => surgicalClassifications[s.id]).length;

  const activeTab_ = ALL_TABS[activeTab] ?? ALL_TABS[0];

  return (
    <div style={{ padding: '16px 20px', maxWidth: 960 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>Surgical Classifications & Calculators</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          Select grades from validated classification systems or use interactive calculators. All entries appear in the encounter summary.
        </div>
      </div>

      {/* Tab row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {ALL_TABS.map((tab, i) => {
          const isActive = activeTab === i;
          let badge: number | undefined;
          if (tab.kind === 'class') {
            const cat = CLASSIFICATIONS.find(c => c.label === tab.label);
            if (cat) badge = cat.systems.filter(s => surgicalClassifications[s.id]).length || undefined;
          } else if (tab.kind === 'calc') {
            badge = CALCULATORS.filter(c => {
              const vals = calcValues(c.id);
              return c.compute(vals) !== null;
            }).length || undefined;
          }
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(i)} style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              border: isActive ? '2px solid #0d9488' : '1px solid #e2e8f0',
              background: isActive ? '#0d9488' : '#f8fafc',
              color: isActive ? '#fff' : '#374151',
              fontWeight: isActive ? 700 : 500,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {badge ? (
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.3)' : '#0d9488',
                  color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                }}>{badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Classification systems */}
      {activeTab_.kind === 'class' && (() => {
        const cat = CLASSIFICATIONS.find(c => c.label === activeTab_.label);
        if (!cat) return null;
        return cat.systems.map(system => (
          <CollapsibleCard
            key={system.id}
            title={system.title}
            badge={surgicalClassifications[system.id]
              ? `${surgicalClassifications[system.id]}${surgicalClassifications[`${system.id}_side`] ? ` · ${surgicalClassifications[`${system.id}_side`]}` : ''}`
              : undefined}
            defaultOpen={true}
          >
            <ClassSystemCard
              system={system}
              value={surgicalClassifications[system.id] ?? ''}
              side={(surgicalClassifications[`${system.id}_side`] as Side | '') ?? ''}
              onSelect={grade => setGrade(system.id, grade)}
              onSide={s => setSide(system.id, s)}
            />
          </CollapsibleCard>
        ));
      })()}

      {/* Calculators */}
      {activeTab_.kind === 'calc' && CALCULATORS.map(calc => {
        const vals = calcValues(calc.id);
        const result = calc.compute(vals);
        return (
          <CollapsibleCard
            key={calc.id}
            title={calc.title}
            badge={result ? `${result.label}${result.score ? ` (${result.score})` : ''}` : undefined}
            defaultOpen={true}
          >
            <CalcCard
              calc={calc}
              values={vals}
              onChange={(fieldId, val) => setCalcField(calc.id, fieldId, val)}
            />
          </CollapsibleCard>
        );
      })}

      {/* Suggested tools */}
      {activeTab_.kind === 'suggest' && (
        <CollapsibleCard title="Suggested Tools for General & Endoscopic Surgical Practice" defaultOpen={true}>
          <SuggestedToolsPanel />
        </CollapsibleCard>
      )}

      {/* Summary of all active classifications */}
      {activeClassCount > 0 && activeTab_.kind === 'class' && (
        <CollapsibleCard title={`Active Classifications (${activeClassCount})`} defaultOpen={true}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CLASSIFICATIONS.flatMap(cat =>
              cat.systems
                .filter(s => surgicalClassifications[s.id])
                .map(s => {
                  const opt = s.options.find(o => o.grade === surgicalClassifications[s.id]);
                  const sideStr = surgicalClassifications[`${s.id}_side`];
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '8px 12px', borderRadius: 8,
                      background: opt ? HUE_BG[opt.color] : '#f8fafc',
                      border: `1px solid ${opt ? HUE_BORDER[opt.color] : '#e2e8f0'}`,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{s.title}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: opt ? HUE_TEXT[opt.color] : '#1e293b', marginTop: 1 }}>
                          {opt?.label}{sideStr ? ` — ${sideStr}` : ''}
                        </div>
                      </div>
                      <button type="button" onClick={() => setGrade(s.id, '')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 0 }}
                      >×</button>
                    </div>
                  );
                })
            )}
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}

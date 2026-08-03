// ─── K83-1.ts — Obstructive Jaundice ─────────────────────────────────────────
//
// 360° Clinical Intelligence Profile
// ICD-10: K83.1 | SNOMED CT: 24776001
// LOINC & ICD Mapping Integrated
//
// This is the complete static knowledge base for Obstructive Jaundice.
// Paired with AxisScorer it drives the Patient State Vector.
//
// "ONE PATIENT · ONE RECORD · MANY FRAGMENTS · ONE LANGUAGE · LIMITLESS CLARITY"

import type { ClinicalFact, LabResultValue, VitalValue } from '../types.js';
import type { PathologyProfile } from '../pathology-profile.js';

// ─── Helpers used inside detect() functions ───────────────────────────────────

function latestLab(facts: ClinicalFact[], name: string): number | null {
  const hits = facts
    .filter(f => f.factType === 'lab_result' && f.status !== 'refuted')
    .filter(f => {
      const v = f.value as LabResultValue;
      return v.testName.toLowerCase().includes(name.toLowerCase());
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!hits.length) return null;
  const v = hits[0].value as LabResultValue;
  return typeof v.result === 'number' ? v.result : parseFloat(String(v.result));
}

function latestVital(facts: ClinicalFact[], param: string): number | null {
  const hit = facts
    .filter(f => f.factType === 'vital' && f.status !== 'refuted')
    .filter(f => (f.value as VitalValue).parameter === param)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!hit) return null;
  return (hit.value as VitalValue).numericValue;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export const K83_1: PathologyProfile = {
  icd10:    'K83.1',
  snomed:   '24776001',
  name:     'Obstructive Jaundice',
  subtitle: '360° Clinical Intelligence Model',
  definition:
    'Impaired bile flow from liver to duodenum causing conjugated hyperbilirubinemia with systemic manifestations.',

  anatomyAtRisk: [
    { label: 'Intrahepatic bile ducts', color: '#60a5fa' },
    { label: 'Common hepatic duct',     color: '#34d399' },
    { label: 'Common bile duct',        color: '#a78bfa' },
    { label: 'Ampulla of Vater',        color: '#fb923c' },
    { label: 'Pancreatic head',         color: '#f87171' },
    { label: 'Gallbladder',             color: '#fbbf24' },
  ],

  // ── 13 Axes ────────────────────────────────────────────────────────────────

  axes: [
    {
      id: 1, name: 'ANATOMY', subtitle: 'LOCATION', question: 'Where?',
      color: '#60a5fa',
      description: 'Anatomical site and level of biliary obstruction.',
      factTypes: ['imaging_result', 'investigation_order'],
    },
    {
      id: 2, name: 'ETIOLOGY', subtitle: 'CAUSE', question: 'Why?',
      color: '#34d399',
      description: 'Underlying cause: calculous, malignant, inflammatory, post-surgical, or parasitic.',
      factTypes: ['diagnosis', 'imaging_result', 'pathology_result'],
    },
    {
      id: 3, name: 'PATHOPHYSIOLOGY', subtitle: 'MECHANISM', question: 'How?',
      color: '#a78bfa',
      description: 'Degree of bile flow obstruction and consequent hepatocellular biochemical disruption.',
      factTypes: ['lab_result'],
    },
    {
      id: 4, name: 'CLINICAL ACTIVITY', subtitle: 'INFLAMMATION', question: 'What is active?',
      color: '#f87171',
      description: 'Active cholangitis, sepsis, or inflammatory state (Charcot / Reynolds criteria).',
      factTypes: ['vital', 'lab_result', 'symptom'],
    },
    {
      id: 5, name: 'OBSTRUCTION', subtitle: 'SEVERITY & LEVEL', question: 'How blocked?',
      color: '#fb923c',
      description: 'Severity and completeness of biliary obstruction measured biochemically and radiologically.',
      factTypes: ['lab_result', 'imaging_result', 'vital'],
    },
    {
      id: 6, name: 'SYSTEMIC IMPACT', subtitle: 'ORGAN EFFECT', question: 'What is affected?',
      color: '#fbbf24',
      description: 'Hepatocellular dysfunction, coagulopathy, renal impairment, and nutritional compromise.',
      factTypes: ['lab_result', 'vital'],
    },
    {
      id: 7, name: 'TEMPORAL', subtitle: 'TIME COURSE', question: 'When?',
      color: '#4ade80',
      description: 'Duration and progression trajectory — acute onset vs chronic, improving vs worsening.',
      factTypes: ['symptom', 'lab_result', 'diagnosis'],
    },
    {
      id: 8, name: 'RESPONSE', subtitle: 'TREATMENT RESPONSE', question: 'How is it responding?',
      color: '#22d3ee',
      description: 'Post-intervention bilirubin and ALP trend; clinical improvement trajectory.',
      factTypes: ['lab_result', 'vital', 'task'],
    },
    {
      id: 9, name: 'RISK', subtitle: 'COMPLICATION RISK', question: 'What can go wrong?',
      color: '#f472b6',
      description: 'Risk of cholangitis, sepsis, hepatorenal syndrome, coagulopathy, and malignant transformation.',
      factTypes: ['lab_result', 'vital', 'diagnosis'],
    },
    {
      id: 10, name: 'DIAGNOSTIC', subtitle: 'CONFIDENCE', question: 'How sure are we?',
      color: '#818cf8',
      description: 'Number and strength of confirmed diagnostic criteria for obstructive jaundice.',
      factTypes: ['lab_result', 'imaging_result', 'diagnosis', 'investigation_order'],
    },
    {
      id: 11, name: 'PROGNOSTIC', subtitle: 'OUTCOME LIKELIHOOD', question: 'What is likely?',
      color: '#a3e635',
      description: 'Predicted outcome: favorable (benign, early) vs guarded (malignant) vs poor (sepsis/MOF).',
      factTypes: ['diagnosis', 'lab_result', 'vital'],
    },
    {
      id: 12, name: 'THERAPEUTIC', subtitle: 'MANAGEMENT PATH', question: 'What should we do?',
      color: '#2dd4bf',
      description: 'Completeness of the management pathway: stabilisation → decompression → definitive treatment.',
      factTypes: ['task', 'procedure', 'investigation_order', 'follow_up'],
    },
    {
      id: 13, name: 'UNCERTAINTY', subtitle: 'UNKNOWN / GAPS', question: "What don't we know?",
      color: '#94a3b8',
      description: 'Unconfirmed diagnoses, unverified AI facts, pending results, and unresolved clinical questions.',
      factTypes: ['investigation_order', 'diagnosis', 'task'],
    },
  ],

  // ── DDx Convergence Map ────────────────────────────────────────────────────

  differentials: [
    {
      name: 'Choledocholithiasis',
      icd10: 'K80.5',
      color: '#fb923c',
      discriminatingFeatures: [
        'Jaundice + RUQ pain + gallstones',
        'Dilated CBD on US',
        'ALP, GGT ↑↑',
        'Fluctuating bilirubin',
      ],
      keyFindings: [
        'US / EUS: stone in CBD',
        'MRCP: filling defect',
        'Responds to ERCP stone extraction',
      ],
      confirmationTests: ['Ultrasound', 'MRCP', 'EUS', 'ERCP'],
    },
    {
      name: 'Malignant Biliary Stricture (Pancreatic)',
      icd10: 'C25.0',
      color: '#f87171',
      discriminatingFeatures: [
        'Painless progressive jaundice',
        'Weight loss',
        'CA 19-9 ↑',
        'Double duct sign on MRCP',
      ],
      keyFindings: [
        'CT: pancreatic head mass',
        'MRCP: smooth stricture',
        'Dilated CBD + PD',
        'US / EUS + FNA',
      ],
      confirmationTests: ['CT abdomen', 'EUS + FNA', 'CA 19-9', 'MRCP'],
    },
    {
      name: 'Cholangiocarcinoma',
      icd10: 'C22.1',
      color: '#a78bfa',
      discriminatingFeatures: [
        'Painless jaundice',
        'Pruritus prominent',
        'CA 19-9 ↑',
        'MRCP: brush cytology +ve',
      ],
      keyFindings: [
        'MRCP: biliary stricture with "beaded" ducts (PSC)',
        'CT: hilar or intrahepatic mass',
        'ERCP brush cytology',
      ],
      confirmationTests: ['MRCP', 'ERCP + cytology', 'PET-CT', 'CT'],
    },
    {
      name: 'PSC (Primary Sclerosing Cholangitis)',
      icd10: 'K83.0',
      color: '#34d399',
      discriminatingFeatures: [
        'Young male',
        'IBD association (UC 70–80%)',
        'ALP, GGT ↑↑',
        'Pruritus + fatigue',
      ],
      keyFindings: [
        'MRCP: multifocal strictures ("beaded" ducts)',
        'p-ANCA positive',
        'Liver biopsy: onion-skin fibrosis',
      ],
      confirmationTests: ['MRCP', 'Colonoscopy + biopsy', 'p-ANCA', 'Liver biopsy'],
    },
    {
      name: 'Mirizzi Syndrome',
      icd10: 'K80.3',
      color: '#fbbf24',
      discriminatingFeatures: [
        'RUQ pain + jaundice',
        'Inflamed GB + stone impacted at Hartmann\'s pouch',
        'CBD compression (external)',
        'Recurrent cholecystitis history',
      ],
      keyFindings: [
        'US: GB stone compressing CHD',
        'MRCP: extrinsic compression at cystic duct level',
        'ERCP: smooth extrinsic narrowing',
      ],
      confirmationTests: ['MRCP', 'EUS', 'CT', 'ERCP'],
    },
    {
      name: 'Pancreatic Head Cancer',
      icd10: 'C25.0',
      color: '#f43f5e',
      discriminatingFeatures: [
        'Painless jaundice',
        'Weight loss + anorexia',
        'CA 19-9 ↑↑',
        'Double duct sign',
        'Courvoisier\'s sign (painless palpable GB)',
      ],
      keyFindings: [
        'CT: hypoenhancing mass pancreatic head',
        'Vascular involvement assessment',
        'EUS + FNA for tissue',
      ],
      confirmationTests: ['CT (protocol)', 'EUS + FNA', 'CA 19-9', 'MRI/MRCP'],
    },
  ],

  // ── Biomarker Pattern ─────────────────────────────────────────────────────

  biomarkerPattern: [
    { name: 'Total Bilirubin (Direct)', loinc: '1975-2', snomed: '57162004', direction: 'up',   significance: 'Primary marker of obstructive jaundice; conjugated fraction predominates' },
    { name: 'ALP',                      loinc: '6768-6', snomed: '305085006', direction: 'up',   significance: 'Markedly elevated — biliary epithelial origin; most sensitive single marker', threshold: { value: 3, unit: '× ULN' } },
    { name: 'GGT',                      loinc: '2324-2', snomed: '60153001',  direction: 'up',   significance: 'Confirms biliary source of ALP elevation; elevated in alcohol use too' },
    { name: 'ALT / AST',                loinc: '1742-6', snomed: '34608000',  direction: 'up',   significance: 'Mildly elevated — secondary hepatocellular damage from back-pressure' },
    { name: 'PT / INR',                 loinc: '34714-6', snomed: '165581004', direction: 'up',  significance: 'Prolonged in severe obstruction due to Vit K malabsorption; corrects with Vit K' },
    { name: 'Serum Bile Acids',         loinc: null,      snomed: null,        direction: 'up',   significance: 'Elevated — causes pruritus; marker of intrahepatic cholestasis severity' },
    { name: 'CBC — WBC',                loinc: '6690-2',  snomed: null,        direction: 'up',   significance: 'Elevated only if cholangitis or secondary infection present' },
    { name: 'CA 19-9',                  loinc: '24108-3', snomed: null,        direction: 'up',   significance: 'Elevated in malignant obstruction; also elevated in cholangitis (false positive)' },
  ],

  // ── Clinical Presentation ─────────────────────────────────────────────────

  symptoms: [
    'Jaundice (painless or painful)',
    'Dark urine (bilirubinuria)',
    'Pale / clay-coloured stools (acholia)',
    'Pruritus (bile salt deposition in skin)',
    'Right upper quadrant pain',
    'Nausea / vomiting',
    'Anorexia / weight loss',
    'Fatigue',
  ],

  signs: [
    'Icterus (scleral, mucosal, cutaneous)',
    'Scratch marks (pruritus)',
    'Hepatomegaly (tender or non-tender)',
    'Tender RUQ on palpation',
    'Fever + rigors (if cholangitis)',
    'Courvoisier\'s sign — painless palpable gallbladder (suggests malignancy)',
    'Ascites (late — portal hypertension or peritoneal disease)',
    'Murphy\'s sign positive (if gallstone-related)',
  ],

  // ── Vademecum Panels ──────────────────────────────────────────────────────

  laboratoryFindings: [
    'Total Bilirubin (Direct) ↑↑ — primary marker',
    'ALP ↑↑↑ — most sensitive single test',
    'GGT ↑↑ — confirms biliary origin',
    'ALT / AST ↑ (mild-moderate) — secondary hepatocellular',
    'CBC: WBC ↑ if infection / cholangitis',
    'PT / INR ↑ — Vit K malabsorption',
    'Serum Bile Acids ↑',
    'CA 19-9: elevated in malignant or inflammatory obstruction',
    'Albumin ↓ in chronic obstruction (poor prognosis)',
    'Creatinine ↑ if hepatorenal involvement',
  ],

  radiologyFindings: [
    'Ultrasound: dilated intra/extrahepatic bile ducts (first-line)',
    'CBD diameter > 6 mm (> 8 mm post-cholecystectomy) — abnormal',
    'CT (portal venous phase): level and cause of obstruction; vascular involvement',
    'MRCP: non-invasive ductal anatomy; stricture morphology; filling defects',
    'ERCP: gold standard for CBD stones; therapeutic (sphincterotomy, stenting)',
    'EUS: detect stones / tumour / ampullary lesions; FNA tissue sampling',
    'PET-CT: metastatic staging in suspected malignancy',
  ],

  // ── Severity Scoring (BISAP-adapted for biliary obstruction) ─────────────

  severity: {
    name: 'BISAP (Biliary)',
    description: 'Severity scoring adapted for biliary obstruction. Score 0–5. Higher score = higher risk.',
    criteria: [
      {
        label:       'Bilirubin > 4 mg/dL (> 68 µmol/L)',
        points:      1,
        description: 'Indicates significant obstructive load',
        detect: (facts) => {
          const v = latestLab(facts, 'bilirubin');
          return v !== null && v > 4;
        },
      },
      {
        label:       'INR > 1.5',
        points:      1,
        description: 'Hepatic synthetic dysfunction or Vit K deficiency',
        detect: (facts) => {
          const v = latestLab(facts, 'INR');
          return v !== null && v > 1.5;
        },
      },
      {
        label:       'SIRS (≥ 2 of: Temp > 38 or < 36, HR > 90, RR > 20, WBC > 12 or < 4)',
        points:      1,
        description: 'Systemic inflammatory response — suggests cholangitis or sepsis',
        detect: (facts) => {
          let count = 0;
          const temp = latestVital(facts, 'temperatureC');
          if (temp !== null && (temp > 38 || temp < 36)) count++;
          const hr = latestVital(facts, 'heartRate');
          if (hr !== null && hr > 90) count++;
          const rr = latestVital(facts, 'respiratoryRate');
          if (rr !== null && rr > 20) count++;
          const wbc = latestLab(facts, 'WBC');
          if (wbc !== null && (wbc > 12 || wbc < 4)) count++;
          return count >= 2;
        },
      },
      {
        label:       'Age > 60 years',
        points:      1,
        description: 'Older patients have reduced physiological reserve',
        detect: (_facts) => false, // requires patient DOB from context
      },
      {
        label:       'Pleural effusion on imaging',
        points:      1,
        description: 'Indicates systemic inflammatory or malignant involvement',
        detect: (facts) => {
          return facts.some(f =>
            f.factType === 'imaging_result' &&
            f.status !== 'refuted' &&
            JSON.stringify(f.value).toLowerCase().includes('pleural effusion'),
          );
        },
      },
    ],
    bands: [
      { min: 0, max: 1, label: 'Low risk',      color: '#d1fae5', text: '#065f46' },
      { min: 2, max: 2, label: 'Moderate risk', color: '#fef9c3', text: '#854d0e' },
      { min: 3, max: 3, label: 'High risk',     color: '#fee2e2', text: '#991b1b' },
      { min: 4, max: 5, label: 'Critical risk', color: '#b91c1c', text: '#fff'    },
    ],
  },

  // ── Management Pathway ────────────────────────────────────────────────────

  managementSteps: [
    {
      order: 1, icon: '🏥', label: 'STABILISE',
      details: ['IV access + fluids', 'ABCs', 'NPO', 'Analgesia', 'Blood cultures if febrile', 'IV antibiotics if cholangitis'],
      factTypes: ['vital', 'task'],
    },
    {
      order: 2, icon: '🔬', label: 'IDENTIFY CAUSE & LEVEL',
      details: ['LFTs + coagulation + CBC + cultures', 'Ultrasound (first-line)', 'CT abdomen / MRCP', 'EUS if ultrasound inconclusive', 'CA 19-9 if malignancy suspected'],
      factTypes: ['investigation_order', 'lab_result', 'imaging_result'],
    },
    {
      order: 3, icon: '🔓', label: 'DECOMPRESS BILIARY TREE',
      details: ['ERCP + sphincterotomy ± stenting (preferred)', 'Percutaneous transhepatic cholangiography (PTC) if ERCP fails', 'Surgical bypass if endoscopic fails (palliation)'],
      factTypes: ['procedure', 'task'],
    },
    {
      order: 4, icon: '✂', label: 'DEFINITIVE TREATMENT',
      details: ['Laparoscopic cholecystectomy (calculous)', 'Whipple procedure / distal pancreatectomy (pancreatic malignancy)', 'Hepaticojejunostomy (biliary reconstruction)', 'Tumour resection / palliative stenting'],
      factTypes: ['procedure', 'consent'],
    },
    {
      order: 5, icon: '📅', label: 'MONITOR & FOLLOW UP',
      details: ['LFT trend post-decompression (expect ↓ within 48–72 h)', 'Imaging at 6–8 weeks post-op', 'Stent change every 3–6 months (if plastic stent)', 'Oncology review if malignant'],
      factTypes: ['follow_up', 'task', 'lab_result'],
    },
  ],

  // ── Clinical Code Mapping ─────────────────────────────────────────────────

  clinicalCodes: [
    { concept: 'Obstructive Jaundice', icd10: 'K83.1', snomed: '24776001', loinc: null,      example: 'Present' },
    { concept: 'Bilirubin Total',       icd10: 'R17',   snomed: '57162004', loinc: '1975-2',  example: '15.4 mg/dL' },
    { concept: 'ALP',                   icd10: 'R74.8', snomed: '305085006', loinc: '6768-6', example: '450 U/L' },
    { concept: 'GGT',                   icd10: 'R74.8', snomed: '60153001',  loinc: '2324-2', example: '380 U/L' },
    { concept: 'CBD Dilation',          icd10: null,    snomed: '414345009', loinc: null,      example: '12 mm' },
    { concept: 'ERCP Stent Placement',  icd10: null,    snomed: '428746007', loinc: '47562-7', example: '10 Fr × 9 cm' },
    { concept: 'Choledocholithiasis',   icd10: 'K80.5', snomed: '235919005', loinc: null,      example: 'CBD stone' },
    { concept: 'CA 19-9',               icd10: null,    snomed: null,        loinc: '24108-3', example: '340 U/mL' },
  ],

  // ── Uncertainty Flags ─────────────────────────────────────────────────────

  uncertaintyFlags: [
    'Is the obstruction intrahepatic or extrahepatic? (biliary anatomy not confirmed)',
    'Benign vs malignant stricture? (tissue diagnosis pending)',
    'Early cholangiocarcinoma — cytology may be falsely negative',
    'Small duct PSC: MRCP may be normal despite active disease',
    'Mirizzi syndrome: often missed on ultrasound; confirmed on MRCP',
    'Is Courvoisier\'s sign truly painless? (patient history needed)',
    'Underlying aetiology unknown until ERCP or tissue obtained',
  ],

  // ── Clinical Pearls ────────────────────────────────────────────────────────

  clinicalPearls: [
    'ALP is the most sensitive biochemical marker — a normal ALP virtually excludes significant biliary obstruction.',
    'Painless jaundice + weight loss + CA 19-9 > 37 U/mL = malignancy until proven otherwise.',
    'Courvoisier\'s law: painless palpable GB + jaundice suggests malignant (not stone) obstruction.',
    'Correct coagulopathy with Vit K 10 mg IV before any biliary intervention.',
    'ERCP is both diagnostic AND therapeutic for CBD stones — do not delay in cholangitis.',
    'Charcot\'s triad (fever + jaundice + RUQ pain) = cholangitis; start antibiotics immediately.',
    'Reynolds\' pentad adds shock + altered consciousness = septic cholangitis, emergency ERCP.',
    'CBD stone clearance rate at ERCP exceeds 90% — surgery rarely needed for choledocholithiasis.',
    'Plastic biliary stents require changing every 3–6 months; metal stents last longer but are permanent.',
    'Post-decompression bilirubin should fall > 50% within 72 hours; failure suggests incomplete drainage.',
  ],
};

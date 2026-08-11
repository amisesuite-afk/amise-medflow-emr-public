/**
 * Clinical Decision Support engine.
 * Pure deterministic rules — no AI. Each rule maps clinical context to a
 * recommended scoring tool, explaining WHY it was triggered.
 *
 * Design principles (MGH-style):
 *  - Trigger on symptoms + exam + vitals + labs — never silent
 *  - Show clinical-only tools immediately; lab-dependent tools when labs present
 *  - Each suggestion carries the triggering evidence so the clinician understands why
 */

export type CdsUrgency = 'urgent' | 'relevant' | 'consider';

export interface CdsSuggestion {
  scaleKey: string;
  title: string;
  triggerReason: string;   // what fired this rule, shown to clinician
  urgency: CdsUrgency;
  needsLabs: boolean;      // if true, needs investigationResults to be meaningful
  labsPresent: boolean;    // true if the needed lab values appear to be in results
  categoryTag: string;     // e.g. 'GI Bleed', 'Thoracic', 'Vascular'
}

export interface CdsContext {
  symptoms: string[];
  examFindings: Record<string, string[]>;
  vitals: Record<string, string>;
  investigationResults: Record<string, string>;
  comorbidities: string[];
  assessment: string;
  rosFindings: Record<string, { status: string; details: string[] }>;
  age: string;
  sex: string;
  isPostOp: boolean;
  procedureData: Record<string, unknown>;
  workingDiagnosis?: { diseaseId: string | null; source: string; locked?: boolean };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasSym(ctx: CdsContext, ...terms: string[]): boolean {
  return terms.some(t => ctx.symptoms.some(s => s.toLowerCase().includes(t.toLowerCase())));
}

function hasExam(ctx: CdsContext, system: string, ...terms: string[]): boolean {
  const chips = ctx.examFindings[system] ?? [];
  return terms.some(t => chips.some(c => c.toLowerCase().includes(t.toLowerCase())));
}

function hasComorbidity(ctx: CdsContext, ...terms: string[]): boolean {
  return terms.some(t => ctx.comorbidities.some(c => c.toLowerCase().includes(t.toLowerCase())));
}

function hasRos(ctx: CdsContext, system: string, ...terms: string[]): boolean {
  const f = ctx.rosFindings[system];
  if (!f || f.status !== 'positive') return false;
  return terms.length === 0 || terms.some(t => f.details.some(d => d.toLowerCase().includes(t.toLowerCase())));
}

function hasLab(ctx: CdsContext, ...keys: string[]): boolean {
  const resultsText = Object.entries(ctx.investigationResults)
    .map(([k, v]) => `${k} ${v}`.toLowerCase()).join(' ');
  return keys.some(k => resultsText.includes(k.toLowerCase()));
}

function vitalPresent(ctx: CdsContext, key: string): boolean {
  const v = ctx.vitals[key];
  return !!v && v.trim() !== '';
}

// ── Rule definitions ──────────────────────────────────────────────────────────

interface CdsRule {
  scaleKey: string;
  title: string;
  urgency: CdsUrgency;
  needsLabs: boolean;
  categoryTag: string;
  trigger: (ctx: CdsContext) => string | null; // null = not triggered; string = reason
  labsPresent?: (ctx: CdsContext) => boolean;
}

const RULES: CdsRule[] = [

  // ── Alvarado — appendicitis ──────────────────────────────────────────────────
  {
    scaleKey: 'alvarado',
    title: 'Alvarado Score — Appendicitis',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'Acute Abdomen',
    trigger: ctx => {
      const hasRlq = hasSym(ctx, 'abdominal pain') &&
        (hasExam(ctx, 'abdomen', 'RLQ', 'Tender RLQ', 'Rebound') ||
         hasRos(ctx, 'gastrointestinal', 'RLQ') ||
         ctx.symptoms.includes('abdominal pain'));
      const supportingFeatures = [
        hasSym(ctx, 'nausea', 'vomiting', 'anorexia'),
        hasExam(ctx, 'abdomen', 'Tender RLQ'),
        ctx.vitals.temperatureC && parseFloat(ctx.vitals.temperatureC) > 37.3,
      ].filter(Boolean).length;
      if (hasRlq && supportingFeatures >= 1) {
        return 'Abdominal pain with supporting features (fever/nausea/anorexia) — appendicitis probability warrants scoring';
      }
      return null;
    },
  },

  // ── HEART — chest pain ───────────────────────────────────────────────────────
  {
    scaleKey: 'heart',
    title: 'HEART Score — Chest Pain (6-week MACE)',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'Cardiology',
    trigger: ctx => {
      if (!hasSym(ctx, 'chest pain')) return null;
      const ecgPresent = hasLab(ctx, 'ecg', 'ekg', 'troponin');
      return `Chest pain is the presenting complaint${ecgPresent ? ' — ECG/troponin result in chart' : ''}`;
    },
    labsPresent: ctx => hasLab(ctx, 'troponin', 'ecg'),
  },

  // ── Wells PE ─────────────────────────────────────────────────────────────────
  {
    scaleKey: 'wellsPe',
    title: 'Wells PE Score — Pulmonary Embolism',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'Thoracic / Vascular',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'shortness of breath', 'pleuritic chest pain', 'haemoptysis')) triggers.push('respiratory symptoms');
      if (hasSym(ctx, 'leg swelling', 'DVT')) triggers.push('leg swelling / DVT signs');
      if (hasExam(ctx, 'extremities', 'DVT signs', 'Oedema')) triggers.push('DVT signs on examination');
      if (ctx.isPostOp) triggers.push('post-operative patient (VTE risk elevated)');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
  },

  // ── Wells DVT ────────────────────────────────────────────────────────────────
  {
    scaleKey: 'wellsDvt',
    title: 'Wells DVT Score — Deep Vein Thrombosis',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'Vascular',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'leg swelling', 'ankle oedema', 'bilateral leg oedema')) triggers.push('leg swelling');
      if (hasExam(ctx, 'extremities', 'DVT signs', 'Oedema')) triggers.push('extremity oedema / DVT signs on exam');
      if (hasRos(ctx, 'cardiovascular', 'leg swelling')) triggers.push('positive ROS — leg swelling');
      if (ctx.isPostOp) triggers.push('post-op (immobility / VTE risk)');
      if (hasComorbidity(ctx, 'cancer', 'malignancy')) triggers.push('active malignancy (DVT risk factor)');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
  },

  // ── TG18 Cholangitis ─────────────────────────────────────────────────────────
  {
    scaleKey: 'tg18Cholangitis',
    title: 'TG18 Cholangitis Severity',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'Biliary',
    trigger: ctx => {
      const charcot = [
        hasSym(ctx, 'jaundice'),
        hasSym(ctx, 'fever', 'rigors'),
        hasSym(ctx, 'abdominal pain', 'right upper quadrant pain', 'biliary colic'),
      ].filter(Boolean).length;
      if (charcot >= 2) {
        const triad = charcot === 3 ? "Charcot's triad present (fever + jaundice + RUQ pain)" :
          "2 features of Charcot's triad present";
        return triad;
      }
      return null;
    },
  },

  // ── ASGE CBD ─────────────────────────────────────────────────────────────────
  {
    scaleKey: 'asgeCbd',
    title: 'ASGE CBD Stone Probability',
    urgency: 'relevant',
    needsLabs: true,
    categoryTag: 'Biliary',
    trigger: ctx => {
      if (!hasSym(ctx, 'jaundice', 'dark urine', 'pale stool', 'biliary colic', 'right upper quadrant')) return null;
      return 'Biliary symptoms present — CBD stone probability assessment needed before ERCP decision';
    },
    labsPresent: ctx => hasLab(ctx, 'bilirubin', 'LFT', 'liver', 'CBD', 'ultrasound', 'USS'),
  },

  // ── Wagner ───────────────────────────────────────────────────────────────────
  {
    scaleKey: 'wagner',
    title: 'Wagner Classification — Diabetic Foot',
    urgency: 'relevant',
    needsLabs: false,
    categoryTag: 'Diabetic Foot',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'diabetic foot', 'foot ulcer', 'wound')) triggers.push('diabetic foot / foot ulcer presenting complaint');
      if (hasComorbidity(ctx, 'diabetes')) triggers.push('diabetes mellitus in PMH');
      if (hasExam(ctx, 'wound', 'Ulcer', 'Necrotic', 'Gangrene', 'Cellulitis')) triggers.push('wound/ulcer findings on examination');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
  },

  // ── CURB-65 ───────────────────────────────────────────────────────────────────
  {
    scaleKey: 'curb65',
    title: 'CURB-65 — Pneumonia Severity',
    urgency: 'relevant',
    needsLabs: true,
    categoryTag: 'Respiratory',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'cough', 'shortness of breath', 'productive cough')) triggers.push('respiratory symptoms');
      if (hasExam(ctx, 'respiratory', 'Crackles', 'Dull to percussion', 'Reduced breath sounds')) triggers.push('crackles / consolidation on auscultation');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
    labsPresent: ctx => hasLab(ctx, 'urea', 'BUN', 'CXR', 'chest x-ray'),
  },

  // ── NEWS2 ─────────────────────────────────────────────────────────────────────
  {
    scaleKey: 'news2',
    title: 'NEWS2 — Physiological Early Warning',
    urgency: 'relevant',
    needsLabs: false,
    categoryTag: 'Deterioration',
    trigger: ctx => {
      const vitalsEntered = ['systolicBp', 'heartRate', 'temperatureC', 'respiratoryRate', 'spo2']
        .filter(k => vitalPresent(ctx, k)).length;
      if (vitalsEntered >= 2) return `${vitalsEntered}/5 vital signs entered — physiological monitoring active`;
      if (vitalsEntered > 0) return 'Vital signs entered — add remaining parameters for full NEWS2';
      return null; // no vitals yet — don't suggest
    },
  },

  // ── ABCD2 ─────────────────────────────────────────────────────────────────────
  {
    scaleKey: 'abcd2',
    title: 'ABCD² Score — TIA Stroke Risk',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'Neurology',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'TIA', 'transient', 'facial weakness', 'speech difficulty', 'word-finding')) triggers.push('neurological symptoms consistent with TIA');
      if (hasRos(ctx, 'neurological', 'speech', 'facial', 'weakness')) triggers.push('positive neurological ROS');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
  },

  // ── Glasgow-Blatchford — GI bleed ────────────────────────────────────────────
  {
    scaleKey: 'glasgowBlatchford',
    title: 'Glasgow-Blatchford — Upper GI Bleed (pre-endoscopy)',
    urgency: 'urgent',
    needsLabs: true,
    categoryTag: 'GI Bleed',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'haematemesis', 'coffee-ground', 'melaena', 'black stool')) triggers.push('upper GI haemorrhage symptoms');
      if (hasRos(ctx, 'gastrointestinal', 'haematemesis', 'melaena', 'black stool')) triggers.push('positive GI ROS — haemorrhage features');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
    labsPresent: ctx => hasLab(ctx, 'haemoglobin', 'Hb', 'FBC', 'urea', 'BUN'),
  },

  // ── Pre-Rockall — GI bleed ───────────────────────────────────────────────────
  {
    scaleKey: 'preRockall',
    title: 'Pre-endoscopy Rockall — GI Bleed Mortality',
    urgency: 'relevant',
    needsLabs: false,
    categoryTag: 'GI Bleed',
    trigger: ctx => {
      if (!hasSym(ctx, 'haematemesis', 'coffee-ground', 'melaena', 'black stool', 'rectal bleeding')) return null;
      return 'GI haemorrhage — Rockall identifies high-risk for re-bleeding / death';
    },
  },

  // ── RCRI — pre-operative ─────────────────────────────────────────────────────
  {
    scaleKey: 'rcri',
    title: 'RCRI — Pre-operative Cardiac Risk',
    urgency: 'consider',
    needsLabs: false,
    categoryTag: 'Pre-operative',
    trigger: ctx => {
      const isPreop = (ctx.procedureData as { preop?: unknown }).preop !== undefined ||
        ctx.symptoms.some(s => s.includes('pre-op'));
      const hasCardiacRisk = hasComorbidity(ctx, 'ischaemic', 'IHD', 'heart failure', 'CCF', 'hypertension', 'diabetes', 'stroke', 'TIA', 'renal');
      if (isPreop || hasCardiacRisk) {
        return hasCardiacRisk
          ? 'Cardiac risk factors in PMH — assess pre-operative cardiac risk'
          : 'Pre-operative assessment active — cardiac risk stratification';
      }
      return null;
    },
  },

  // ── P-POSSUM — surgical risk ─────────────────────────────────────────────────
  {
    scaleKey: 'ppossuml',
    title: 'P-POSSUM — Surgical Mortality / Morbidity',
    urgency: 'consider',
    needsLabs: true,
    categoryTag: 'Surgical risk',
    trigger: ctx => {
      const isPreop = (ctx.procedureData as { preop?: unknown }).preop !== undefined;
      const hasOp = ['ogd', 'colonoscopy', 'ercp'].some(k =>
        (ctx.procedureData as Record<string, unknown>)[k] !== undefined
      );
      if (isPreop || hasOp) return 'Pre-operative assessment or operative procedure active — calculate P-POSSUM surgical risk';
      return null;
    },
    labsPresent: ctx => hasLab(ctx, 'haematocrit', 'haemoglobin', 'WBC', 'urea', 'sodium', 'potassium'),
  },

  // ── MUST — nutritional screening ─────────────────────────────────────────────
  {
    scaleKey: 'must',
    title: 'MUST — Malnutrition Screening',
    urgency: 'consider',
    needsLabs: false,
    categoryTag: 'Nutrition',
    trigger: ctx => {
      const isPreop = (ctx.procedureData as { preop?: unknown }).preop !== undefined;
      const hasMalnutritionRisk = hasComorbidity(ctx, 'cancer', 'malignancy', 'Crohn', 'IBD', 'weight loss', 'dysphagia');
      if (isPreop || hasMalnutritionRisk) {
        return hasMalnutritionRisk
          ? 'Malnutrition risk factor identified — screen with MUST before surgery'
          : 'Pre-operative assessment active — mandatory nutritional screening';
      }
      return null;
    },
  },

  // ── Caprini — VTE risk ───────────────────────────────────────────────────────
  {
    scaleKey: 'caprini',
    title: 'Caprini VTE Risk Score — Thromboprophylaxis',
    urgency: 'relevant',
    needsLabs: false,
    categoryTag: 'VTE prevention',
    trigger: ctx => {
      const isPreop = (ctx.procedureData as { preop?: unknown }).preop !== undefined;
      const hasOp = ['ogd', 'colonoscopy', 'ercp'].some(k =>
        (ctx.procedureData as Record<string, unknown>)[k] !== undefined
      );
      const hasVteRisk = hasComorbidity(ctx, 'DVT', 'PE', 'thrombophilia', 'malignancy', 'cancer', 'immobil');
      if (isPreop || hasOp || hasVteRisk) {
        return isPreop || hasOp
          ? 'Surgical procedure active — calculate VTE risk and prescribe thromboprophylaxis'
          : 'VTE risk factor in history — assess thromboprophylaxis requirement';
      }
      return null;
    },
  },

  // ── Ranson — pancreatitis ────────────────────────────────────────────────────
  {
    scaleKey: 'ranson',
    title: "Ranson's Criteria — Pancreatitis Severity",
    urgency: 'urgent',
    needsLabs: true,
    categoryTag: 'Pancreatic',
    trigger: ctx => {
      const hasPanc = hasSym(ctx, 'epigastric pain', 'abdominal pain') &&
        (hasSym(ctx, 'vomiting') || hasExam(ctx, 'abdomen', 'Epigastric', 'Tender'));
      const hasRadiation = ctx.symptoms.some(s => s.toLowerCase().includes('back'));
      if (hasPanc || hasRadiation) {
        return 'Epigastric pain ± vomiting/radiation to back — pancreatitis in differential';
      }
      return null;
    },
    labsPresent: ctx => hasLab(ctx, 'amylase', 'lipase', 'LDH', 'AST', 'glucose', 'WBC'),
  },

  // ── STOP-BANG — OSA pre-operative screening ───────────────────────────────────
  {
    scaleKey: 'stopBang',
    title: 'STOP-BANG — OSA Pre-operative Screening',
    urgency: 'consider',
    needsLabs: false,
    categoryTag: 'Pre-operative',
    trigger: ctx => {
      const isPreop = (ctx.procedureData as { preop?: unknown }).preop !== undefined;
      const hasOsaSymptoms = hasSym(ctx, 'snoring', 'sleep apnoea', 'daytime sleepiness', 'fatigue', 'OSA');
      const hasOsaComorbidity = hasComorbidity(ctx, 'sleep apnoea', 'OSA', 'obesity');
      const isObese = hasComorbidity(ctx, 'obesity', 'BMI');
      if (isPreop || hasOsaSymptoms || hasOsaComorbidity || isObese) {
        if (isPreop) return 'Pre-operative assessment — OSA screening mandatory before anaesthesia';
        if (hasOsaSymptoms) return 'OSA-related symptoms documented — screen before any sedation or general anaesthesia';
        return 'Obesity or known OSA in PMH — assess risk before surgery or sedation';
      }
      return null;
    },
  },

  // ── Clinical Frailty Scale — surgical risk in elderly ─────────────────────────
  {
    scaleKey: 'cfs',
    title: 'Clinical Frailty Scale — Pre-operative Frailty',
    urgency: 'consider',
    needsLabs: false,
    categoryTag: 'Pre-operative',
    trigger: ctx => {
      const isPreop = (ctx.procedureData as { preop?: unknown }).preop !== undefined;
      const ageNum = parseInt(ctx.age, 10);
      const isElderly = !isNaN(ageNum) && ageNum >= 65;
      const hasMultiMorbidity = ctx.comorbidities.length >= 3;
      const frailtyMentioned = ctx.assessment.toLowerCase().includes('frail') ||
        hasComorbidity(ctx, 'frailty', 'sarcopenia', 'dementia', 'falls');
      if (isPreop || isElderly || hasMultiMorbidity || frailtyMentioned) {
        if (frailtyMentioned) return 'Frailty or dementia noted in PMH/assessment — formal CFS grading required';
        if (isElderly && isPreop) return `Patient aged ${ctx.age} — frailty assessment mandatory before surgery in patients ≥65`;
        if (isElderly) return `Patient aged ${ctx.age} — frailty screening recommended`;
        if (hasMultiMorbidity) return `${ctx.comorbidities.length} comorbidities documented — frailty assessment recommended`;
        return 'Pre-operative assessment — document frailty status';
      }
      return null;
    },
  },

  // ── ECOG — oncology and surgical performance status ───────────────────────────
  {
    scaleKey: 'ecog',
    title: 'ECOG Performance Status',
    urgency: 'consider',
    needsLabs: false,
    categoryTag: 'Oncology / Surgical risk',
    trigger: ctx => {
      const hasCancer = hasComorbidity(ctx, 'cancer', 'malignancy', 'carcinoma', 'tumour', 'lymphoma', 'sarcoma');
      const assessmentHasCancer = ctx.assessment.toLowerCase().match(/cancer|malignan|carcinoma|tumour|lymphoma|sarcoma/);
      const isPreop = (ctx.procedureData as { preop?: unknown }).preop !== undefined;
      if (hasCancer || assessmentHasCancer) {
        return hasCancer
          ? 'Malignancy in PMH — document performance status for surgical / oncological planning'
          : 'Cancer/malignancy in assessment — ECOG required for treatment planning';
      }
      if (isPreop && ctx.comorbidities.length >= 2) {
        return 'Pre-operative assessment with multiple comorbidities — document functional performance status';
      }
      return null;
    },
  },

  // ── PHQ-9 — depression screening ─────────────────────────────────────────────
  {
    scaleKey: 'phq9',
    title: 'PHQ-9 — Depression Screening',
    urgency: 'consider',
    needsLabs: false,
    categoryTag: 'Mental Health',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'low mood', 'depression', 'hopeless', 'anhedonia', 'fatigue', 'sleep disturbance', 'insomnia'))
        triggers.push('mood / affective symptoms');
      if (hasComorbidity(ctx, 'depression', 'anxiety', 'bipolar', 'PTSD', 'mental health'))
        triggers.push('mental health condition in PMH');
      if (hasRos(ctx, 'psychiatric', 'depression', 'mood', 'sleep'))
        triggers.push('positive psychiatric ROS');
      const isPreop = (ctx.procedureData as { preop?: unknown }).preop !== undefined;
      if (isPreop && (hasComorbidity(ctx, 'obesity', 'bariatric') || ctx.symptoms.some(s => s.toLowerCase().includes('weight'))))
        triggers.push('pre-bariatric surgery — mandatory psych screening');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
  },

  // ── GAD-7 — anxiety screening ─────────────────────────────────────────────────
  {
    scaleKey: 'gad7',
    title: 'GAD-7 — Generalised Anxiety Screening',
    urgency: 'consider',
    needsLabs: false,
    categoryTag: 'Mental Health',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'anxiety', 'panic', 'worry', 'palpitations', 'restless', 'nervous'))
        triggers.push('anxiety / autonomic symptoms');
      if (hasComorbidity(ctx, 'anxiety', 'GAD', 'panic disorder', 'OCD', 'PTSD', 'depression'))
        triggers.push('anxiety / psychiatric condition in PMH');
      if (hasRos(ctx, 'psychiatric', 'anxiety', 'panic', 'worry'))
        triggers.push('positive anxiety ROS');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
  },

  // ── GERD-Q — gastro-oesophageal reflux disease ────────────────────────────────
  {
    scaleKey: 'gerdq',
    title: 'GERD-Q — Reflux Disease Questionnaire',
    urgency: 'relevant',
    needsLabs: false,
    categoryTag: 'Upper GI',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'heartburn', 'regurgitation', 'acid reflux', 'GORD', 'GERD'))
        triggers.push('heartburn / regurgitation as presenting symptom');
      if (hasSym(ctx, 'dyspepsia', 'epigastric pain', 'indigestion', 'waterbrash'))
        triggers.push('dyspepsia / epigastric pain — GORD in differential');
      if (hasComorbidity(ctx, 'GORD', 'GERD', 'reflux', 'hiatus hernia', 'Barrett'))
        triggers.push('GORD / hiatus hernia / Barrett\'s in PMH');
      if (ctx.symptoms.some(s => s.toLowerCase().includes('night')) && hasSym(ctx, 'cough', 'regurgitation'))
        triggers.push('nocturnal cough / reflux symptoms');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
  },

  // ── Child-Pugh — liver disease surgical risk ──────────────────────────────────
  {
    scaleKey: 'childPugh',
    title: 'Child-Pugh Score — Liver Disease Surgical Risk',
    urgency: 'urgent',
    needsLabs: true,
    categoryTag: 'Hepatic',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasComorbidity(ctx, 'cirrhosis', 'hepatitis', 'liver disease', 'portal hypertension', 'varices', 'ascites'))
        triggers.push('chronic liver disease / cirrhosis in PMH');
      if (hasSym(ctx, 'jaundice', 'ascites', 'confusion') && hasComorbidity(ctx, 'liver', 'hepatitis', 'alcohol'))
        triggers.push('jaundice or hepatic decompensation features');
      if (hasExam(ctx, 'abdomen', 'Ascites', 'Hepatomegaly', 'Splenomegaly', 'Jaundice'))
        triggers.push('hepatic signs on examination');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
    labsPresent: ctx => hasLab(ctx, 'bilirubin', 'albumin', 'INR', 'PT', 'liver'),
  },

  // ── Apfel — PONV risk ─────────────────────────────────────────────────────────
  {
    scaleKey: 'apfel',
    title: 'Apfel Score — PONV Risk (Anaesthetic Planning)',
    urgency: 'consider',
    needsLabs: false,
    categoryTag: 'Pre-operative',
    trigger: ctx => {
      const isPreop = (ctx.procedureData as { preop?: unknown }).preop !== undefined;
      const hasOp = ['ogd', 'colonoscopy', 'ercp'].some(k =>
        (ctx.procedureData as Record<string, unknown>)[k] !== undefined
      );
      if (isPreop || hasOp) return 'Pre-operative / procedural assessment — calculate PONV risk to guide antiemetic prophylaxis';
      const hasPriorPonv = hasComorbidity(ctx, 'PONV', 'nausea', 'motion sickness', 'post-op nausea');
      if (hasPriorPonv) return 'Prior PONV or motion sickness — inform anaesthetic team and plan prophylaxis';
      return null;
    },
  },

  // ── MELD — end-stage liver disease ───────────────────────────────────────────
  {
    scaleKey: 'meld',
    title: 'MELD / MELD-Na — Liver Disease Severity',
    urgency: 'urgent',
    needsLabs: true,
    categoryTag: 'Hepatic',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasComorbidity(ctx, 'cirrhosis', 'liver failure', 'end-stage liver', 'portal hypertension', 'hepatic encephalopathy'))
        triggers.push('advanced liver disease in PMH — MELD needed for surgical risk and transplant listing');
      if (hasExam(ctx, 'abdomen', 'Ascites', 'Hepatomegaly') && hasComorbidity(ctx, 'liver', 'hepatitis', 'alcohol'))
        triggers.push('hepatic signs in context of liver disease');
      if (triggers.length > 0) return triggers.join(', ');
      return null;
    },
    labsPresent: ctx => hasLab(ctx, 'bilirubin', 'INR', 'creatinine', 'sodium'),
  },
  // ── CHA₂DS₂-VASc — AF stroke risk ────────────────────────────────────────────
  {
    scaleKey: 'chads2Vasc',
    title: 'CHA₂DS₂-VASc — AF Stroke Risk',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'Cardiovascular',
    trigger: ctx => {
      if (hasComorbidity(ctx, 'atrial fibrillation', 'AF', 'paroxysmal AF', 'persistent AF', 'permanent AF'))
        return 'atrial fibrillation in PMH — stroke risk stratification and anticoagulation decision required';
      if (hasSym(ctx, 'palpitations') && hasComorbidity(ctx, 'hypertension', 'diabetes', 'heart failure', 'stroke', 'TIA'))
        return 'palpitations with cardiovascular risk factors — consider AF and CHA₂DS₂-VASc if AF confirmed';
      return null;
    },
  },

  // ── HAS-BLED — bleeding risk on anticoagulation ───────────────────────────────
  {
    scaleKey: 'hasBled',
    title: 'HAS-BLED — Bleeding Risk on Anticoagulation',
    urgency: 'relevant',
    needsLabs: false,
    categoryTag: 'Cardiovascular',
    trigger: ctx => {
      if (hasComorbidity(ctx, 'atrial fibrillation', 'AF'))
        return 'AF present — HAS-BLED required alongside CHA₂DS₂-VASc to quantify bleeding risk before anticoagulation';
      if (hasComorbidity(ctx, 'anticoagulation', 'warfarin', 'DOAC', 'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban'))
        return 'patient on anticoagulation — periodic bleeding risk reassessment with HAS-BLED recommended';
      return null;
    },
  },

  // ── qSOFA — bedside sepsis screen ────────────────────────────────────────────
  {
    scaleKey: 'qsofa',
    title: 'qSOFA — Sepsis Screening',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'Critical Care',
    trigger: ctx => {
      const triggers: string[] = [];
      if (hasSym(ctx, 'fever', 'rigors', 'chills', 'sepsis', 'infection'))
        triggers.push('fever/infection symptoms — screen for sepsis with qSOFA');
      if (hasComorbidity(ctx, 'sepsis', 'bacteraemia', 'peritonitis', 'pneumonia', 'UTI', 'wound infection'))
        triggers.push('infection-related PMH — qSOFA to detect organ dysfunction');
      const sbp = parseFloat(ctx.vitals?.systolicBp ?? '');
      const rr  = parseFloat(ctx.vitals?.respiratoryRate ?? '');
      if (!isNaN(sbp) && sbp <= 100) triggers.push('hypotension (SBP ≤ 100) — qSOFA criterion met');
      if (!isNaN(rr)  && rr  >= 22)  triggers.push('tachypnoea (RR ≥ 22) — qSOFA criterion met');
      if (triggers.length > 0) return triggers.join('; ');
      return null;
    },
  },

  // ── ASA Physical Status — universal pre-operative risk classification ─────────
  {
    scaleKey: 'asa',
    title: 'ASA Physical Status Classification',
    urgency: 'relevant',
    needsLabs: false,
    categoryTag: 'Pre-operative',
    trigger: ctx => {
      const isPreop = hasSym(ctx, 'pre-op', 'preoperative', 'pre-operative', 'elective', 'surgical', 'operation', 'surgery', 'anaesthetic', 'laparoscopic', 'colonoscopy', 'endoscopy', 'ERCP');
      if (isPreop) return 'operative / procedural context — ASA physical status classification required for anaesthetic risk documentation';
      if (hasComorbidity(ctx, 'diabetes', 'hypertension', 'COPD', 'heart failure', 'CKD', 'obesity', 'cirrhosis', 'dialysis', 'pacemaker', 'cardiac'))
        return 'multiple comorbidities requiring pre-operative risk stratification — document ASA class in operative consent';
      return null;
    },
  },

  // ── BISAP — bedside pancreatitis severity ─────────────────────────────────────
  {
    scaleKey: 'bisap',
    title: 'BISAP — Pancreatitis Severity',
    urgency: 'urgent',
    needsLabs: true,
    categoryTag: 'GI / Hepatobiliary',
    trigger: ctx => {
      if (hasSym(ctx, 'pancreatitis', 'acute pancreatitis', 'epigastric pain') &&
          hasComorbidity(ctx, 'pancreatitis', 'alcohol', 'gallstones', 'hyperlipidaemia'))
        return 'pancreatitis presentation — BISAP for 24-hour severity and ICU disposition decision';
      if (hasComorbidity(ctx, 'acute pancreatitis', 'pancreatitis'))
        return 'pancreatitis in PMH — BISAP to track severity if recurrence';
      if (hasSym(ctx, 'pancreatitis'))
        return 'pancreatitis symptoms — BISAP for triage and severity classification';
      return null;
    },
    labsPresent: ctx => hasLab(ctx, 'BUN', 'urea', 'amylase', 'lipase', 'CRP'),
  },

  // ── Forrest Classification — endoscopic peptic ulcer bleeding ─────────────────
  {
    scaleKey: 'forrest',
    title: 'Forrest Classification — Upper GI Bleed Endoscopy',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'GI / Hepatobiliary',
    trigger: ctx => {
      if (hasSym(ctx, 'haematemesis', 'coffee-ground', 'melaena', 'upper GI bleed', 'UGIB'))
        return 'upper GI haemorrhage — Forrest classification needed to guide endoscopic therapy decision';
      if (hasComorbidity(ctx, 'peptic ulcer', 'gastric ulcer', 'duodenal ulcer', 'PUD', 'upper GI bleed'))
        return 'peptic ulcer disease / prior UGIB — document Forrest class at endoscopy to guide management';
      return null;
    },
  },

  // ── Clavien-Dindo — post-operative complication grading ───────────────────────
  {
    scaleKey: 'clavienDindo',
    title: 'Clavien-Dindo Classification — Post-operative Complications',
    urgency: 'relevant',
    needsLabs: false,
    categoryTag: 'Post-operative',
    trigger: ctx => {
      if (ctx.isPostOp || hasSym(ctx, 'post-op', 'post-operative', 'postoperative', 'after surgery', 'after operation'))
        return 'post-operative context — document any complications using Clavien-Dindo for audit and M&M';
      if (hasSym(ctx, 'wound', 'dehiscence', 'anastomotic', 'return to theatre', 're-operation', 'leak'))
        return 'post-operative complication documented — classify with Clavien-Dindo for surgical audit';
      return null;
    },
  },

  // ── GCS — neurological assessment ────────────────────────────────────────────
  {
    scaleKey: 'gcs',
    title: 'Glasgow Coma Scale (GCS)',
    urgency: 'urgent',
    needsLabs: false,
    categoryTag: 'Neurology',
    trigger: ctx => {
      if (hasSym(ctx, 'confusion', 'altered mental status', 'drowsy', 'unresponsive', 'unconscious', 'encephalopathy', 'coma'))
        return 'altered mental status / reduced consciousness — GCS required for baseline documentation and monitoring';
      if (hasExam(ctx, 'neurology', 'Confusion', 'Disorientation', 'Reduced GCS', 'Encephalopathy'))
        return 'neurological signs on examination — document GCS for serial monitoring';
      if (hasComorbidity(ctx, 'hepatic encephalopathy', 'cirrhosis', 'liver failure', 'portal hypertension'))
        return 'liver disease with encephalopathy risk — GCS for neurological baseline alongside Child-Pugh/MELD';
      return null;
    },
  },

  // ── AUDIT — alcohol use screening ─────────────────────────────────────────────
  {
    scaleKey: 'audit',
    title: 'AUDIT — Alcohol Use Disorders Identification Test',
    urgency: 'relevant',
    needsLabs: false,
    categoryTag: 'Pre-operative',
    trigger: ctx => {
      if (hasComorbidity(ctx, 'alcohol', 'alcoholic', 'alcohol dependence', 'alcohol misuse', 'ETOH', 'cirrhosis', 'alcoholic hepatitis'))
        return 'alcohol use / liver disease documented — AUDIT to quantify use and guide pre-operative management';
      if (hasSym(ctx, 'pre-op', 'preoperative', 'pre-operative', 'elective') &&
          hasComorbidity(ctx, 'alcohol', 'ETOH', 'drinking', 'beer', 'wine', 'spirits'))
        return 'pre-operative alcohol screening — quantify use with AUDIT before elective procedure';
      if (hasComorbidity(ctx, 'pancreatitis', 'alcoholic liver disease', 'Wernicke', 'delirium tremens', 'alcohol withdrawal'))
        return 'alcohol-related condition — full AUDIT to characterise use pattern and severity';
      return null;
    },
  },
];

// ── Public API ─────────────────────────────────────────────────────────────────

export function getCdsSuggestions(ctx: CdsContext): CdsSuggestion[] {
  const suggestions: CdsSuggestion[] = [];

  for (const rule of RULES) {
    const reason = rule.trigger(ctx);
    if (!reason) continue;

    const labsPresent = rule.labsPresent ? rule.labsPresent(ctx) : !rule.needsLabs;

    suggestions.push({
      scaleKey: rule.scaleKey,
      title: rule.title,
      triggerReason: reason,
      urgency: rule.urgency,
      needsLabs: rule.needsLabs,
      labsPresent,
      categoryTag: rule.categoryTag,
    });
  }

  // Sort: urgent first, then relevant, then consider; within each, lab-available before lab-needed
  const urgencyOrder: Record<CdsUrgency, number> = { urgent: 0, relevant: 1, consider: 2 };
  suggestions.sort((a, b) => {
    const u = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (u !== 0) return u;
    // lab-available (or not needed) first
    const aReady = !a.needsLabs || a.labsPresent ? 0 : 1;
    const bReady = !b.needsLabs || b.labsPresent ? 0 : 1;
    return aReady - bReady;
  });

  // Suppress irrelevant mental-health screens when a surgical emergency is locked
  const SURGICAL_EMERGENCY_IDS = new Set([
    'appendicitis', 'pancreatitis', 'cholangitis', 'cholecystitis',
    'bowel_obstruction', 'gi_bleed',
  ]);
  if (ctx.workingDiagnosis?.locked && ctx.workingDiagnosis.diseaseId != null && SURGICAL_EMERGENCY_IDS.has(ctx.workingDiagnosis.diseaseId)) {
    return suggestions.filter(s => s.categoryTag !== 'Mental Health');
  }

  return suggestions;
}


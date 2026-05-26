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

  return suggestions;
}

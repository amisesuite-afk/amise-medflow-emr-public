/**
 * local-soap-segmenter — rule-based SOAP segmentation, zero tokens, <5 ms.
 * Tier 1 in the dictation chain; Ollama and cloud are tiers 2 and 3.
 *
 * Surgeons commonly prefix sections verbally:
 *   "History: …  Examination: …  Assessment: …  Plan: …"
 * When markers are present confidence is ≥ 0.7 and we commit locally.
 * When no markers are found we return confidence 0.3 so the caller
 * escalates to Ollama / cloud.
 */

export interface LocalSegmentedSoap {
  hpi?: string;
  examination?: Record<string, string>;
  assessment?: string;
  plan?: string;
  pmh?: string[];
  allergies?: string;
  unsegmented?: string;
}

export interface LocalSegmentResult {
  segmented: LocalSegmentedSoap;
  confidence: number;
  source: 'local';
}

// ── Section header patterns (checked in order) ────────────────────────────────

type SectionKey = 'hpi' | 'pmh' | 'allergies' | 'examination' | 'assessment' | 'plan';

const SECTION_PATTERNS: [SectionKey, RegExp][] = [
  ['hpi',         /\b(?:history(?:\s+of\s+presenting\s+illness)?|hpi|chief\s+complaint|complaint|s(?:ubjective)?\s*:)\b\s*[:—\-]/i],
  ['pmh',         /\b(?:past\s+(?:medical|surgical)\s+history|pmh|background\s+history|medical\s+history)\s*[:—\-]/i],
  ['allergies',   /\b(?:allerg(?:y|ies)|drug\s+allerg(?:y|ies)|nkda|no\s+known(?:\s+drug)?\s+allerg(?:y|ies))\s*[:—\-]?/i],
  ['examination', /\b(?:on\s+examination|examination|o(?:bjective)?\s*:|exam(?:ination)?|findings)\s*[:—\-]/i],
  ['assessment',  /\b(?:assessment|impression|working\s+diagnosis|clinical\s+impression|a\s*:)\s*[:—\-]/i],
  ['plan',        /\b(?:plan|management(?:\s+plan)?|p\s*:)\s*[:—\-]/i],
];

// ── Examination sub-system markers ────────────────────────────────────────────

const EXAM_SUB_PATTERNS: [string, RegExp][] = [
  ['general',        /\b(?:general(?:\s+appearance)?|appearance)\s*[:—\-]/i],
  ['cardiovascular', /\b(?:cardiovascular|cardio|cvs|heart|cardiac)\s*[:—\-]/i],
  ['respiratory',    /\b(?:respiratory|resp(?:iratory)?|lungs?|chest)\s*[:—\-]/i],
  ['abdomen',        /\b(?:abdomen|abdominal|abdo)\s*[:—\-]/i],
  ['wound',          /\b(?:wound|wound\s+site|incision|local\s+findings?)\s*[:—\-]/i],
  ['breast',         /\b(?:breast|breasts?)\s*[:—\-]/i],
  ['neurological',   /\b(?:neurological|neuro)\s*[:—\-]/i],
  ['extremities',    /\b(?:extremit(?:y|ies)|limbs?|peripheral\s+vascular)\s*[:—\-]/i],
];

// ── Helper ─────────────────────────────────────────────────────────────────────

function findAll(text: string, patterns: [string, RegExp][]): Array<{ key: string; start: number; headerLen: number }> {
  const hits: Array<{ key: string; start: number; headerLen: number }> = [];
  for (const [key, re] of patterns) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      hits.push({ key, start: m.index, headerLen: m[0].length });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

function extractExam(content: string): Record<string, string> {
  const subs = findAll(content, EXAM_SUB_PATTERNS);
  if (subs.length === 0) return { general: content };

  const exam: Record<string, string> = {};
  const before = content.slice(0, subs[0].start).trim();
  if (before) exam.general = before;

  for (let i = 0; i < subs.length; i++) {
    const { key, start, headerLen } = subs[i];
    const end = i < subs.length - 1 ? subs[i + 1].start : content.length;
    const val = content.slice(start + headerLen, end).trim();
    if (val) exam[key] = val;
  }
  return exam;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function localSegmentSoap(transcript: string): LocalSegmentResult {
  const text = transcript.trim();

  if (text.split(/\s+/).length < 6) {
    return { segmented: { unsegmented: text }, confidence: 0.2, source: 'local' };
  }

  const sections = findAll(text, SECTION_PATTERNS);

  if (sections.length === 0) {
    return { segmented: { unsegmented: text }, confidence: 0.25, source: 'local' };
  }

  const segmented: LocalSegmentedSoap = {};

  for (let i = 0; i < sections.length; i++) {
    const { key, start, headerLen } = sections[i];
    const end = i < sections.length - 1 ? sections[i + 1].start : text.length;
    const content = text.slice(start + headerLen, end).trim();
    if (!content) continue;

    switch (key as SectionKey) {
      case 'hpi':         segmented.hpi        = content; break;
      case 'assessment':  segmented.assessment  = content; break;
      case 'plan':        segmented.plan        = content; break;
      case 'allergies':   segmented.allergies   = content; break;
      case 'pmh':         segmented.pmh         = content.split(/[,;]/).map(s => s.trim()).filter(Boolean); break;
      case 'examination': segmented.examination = extractExam(content); break;
    }
  }

  const found = sections.length;
  const confidence = found >= 3 ? 0.88 : found >= 2 ? 0.75 : 0.55;
  return { segmented, confidence, source: 'local' };
}

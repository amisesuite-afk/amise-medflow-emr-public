/**
 * Clinical validation — vademecum shadow (phase 1).
 *
 *   pnpm --filter @workspace/scripts run clinval:web -- --engine vademecum
 *
 * Runs the pilot-area vignettes (abdominal pain; cough / breathlessness; and the vignettes that
 * start from a laboratory, imaging or pathology result, tagged `entry:lab|imaging|pathology`)
 * through the disease-centred vademecum loop (lib/pane-engine/src/vademecum-loop) BESIDE the
 * current engines, and compares them. Nothing in production reads the vademecum; this never
 * blocks (exit 0), and it never changes the normal clinval run.
 *
 * Engines compared, on the same vignette record:
 *   web.pane            PANE as the dashboard runs it (web-runner.ts), top 5 of the same state
 *   ios.bayes           the iOS Bayesian engine, from the committed CI results
 *                       (docs/clinical-validation/results/ios-latest.jsonl, a real simulator run)
 *   vademecum.web       vademecum hybrid, evidence read the web way: the PANE feature mapper
 *                       (extractFeaturesFromSocrates) through each finding's `pane` id, plus the
 *                       record text for findings PANE has no feature for, structured labs through
 *                       the reference ranges, report text, Exam-step signs and recorded scores
 *   vademecum.bayes     the same evidence, Bayesian layer only (no criteria floors, confirmatory
 *                       weighting or exclusions)
 *   vademecum.ios       vademecum hybrid, evidence read the iOS way: record text only (no PANE
 *                       mapper; iPad SOCRATES selections), plus the same structured results. There
 *                       is no TypeScript port of the iOS engine in the repo, so this is the
 *                       "iOS-equivalent" shadow: the vademecum fed what the iPad records.
 *
 * Metrics per area and per entry type: top-1 / top-3 / top-5 (the vignette's first
 * mustRankTopK expectation), mustRankTopK expectations passed at their own k, can't-miss capture
 * (mustNotMiss expectations in the shown five), and questions to threshold (a simulated
 * consultation from the chief complaint or the entry result: the vademecum loop against PANE's
 * nextBestQuestion, both answered from the vignette record — history / examination items not in
 * the record are answered "absent", investigations "not known").
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DISEASES, FEATURES, applyModifiers, initPaneState, nextBestQuestion, topDiagnoses, updatePosterior,
} from '../../../lib/pane-engine/src/index';
import type { PaneState } from '../../../lib/pane-engine/src/index';
import {
  bundledVademecum, complaintAreas, entryPointFindings, evaluate, findingsFromExamSigns, findingsFromLabs, findingsFromPane,
  findingsFromReport, findingsFromScores, findingsFromText, runLoop, seedCandidates,
} from '../../../lib/pane-engine/src/vademecum-loop/index';
import type {
  AnalyteResult, CandidateSet, DiseaseResult, Evaluation, LabClassifier, LoopInput, PatientInfo, TextMatcher, Vademecum,
} from '../../../lib/pane-engine/src/vademecum-loop/index';
import { findAllAffirmed, joinClauses, screenForCancer, readCancerScreenLabs } from '../../../lib/triage-engine/src/index';
import { classifyComplaint } from '../../../lib/triage-engine/src/history-frames/index';
import { analyteForKey, normaliseUnit } from '../../../lib/triage-engine/src/report-import/index';
import { classifyAnalyte, upperLimitOfNormal } from '../../../lib/triage-engine/src/reference-ranges';
import { extractFeaturesFromSocrates, paneContextFromConsultation } from '../../../artifacts/dashboard/src/lib/socrates-to-features';
import { tokyoCholangitisAutoFill, tokyoCholecystitisAutoFill } from '../../../artifacts/dashboard/src/lib/tg18-autofill';
import type { Tg18Record } from '../../../artifacts/dashboard/src/lib/tg18-autofill';
import { scoreTokyoCholangitis, scoreTokyoCholecystitis } from '../../../artifacts/dashboard/src/lib/clinical-scores';
import { counts } from './grade';
import { REPO_ROOT, loadVignettes } from './load';
import type { DxExpectation, Vignette } from './types';
import {
  consultationSnapshot, extractedLabs, investigationResults, pregnancyPossible, recordedScoreValues, scoringVitals,
  socratesAnswers, webSex,
} from './web-runner';

export const SHADOW_VERSION = 'vademecum-shadow/1';

export type EntryType = 'complaint' | 'lab' | 'imaging' | 'pathology';
export type EngineId = 'web.pane' | 'ios.bayes' | 'vademecum.web' | 'vademecum.bayes' | 'vademecum.ios';
export const ENGINES: EngineId[] = ['web.pane', 'ios.bayes', 'vademecum.web', 'vademecum.bayes', 'vademecum.ios'];

interface RankedItem { name: string; id: string; icd10?: string; probability?: number }

export interface EngineVerdict {
  /** Rank of the vignette's first mustRankTopK target in the shown list (null: not shown). */
  targetRank: number | null;
  topKPassed: number;
  topKTotal: number;
  cantMissCaptured: number;
  cantMissTotal: number;
  /** mustNotMiss expectation ids not in the shown five. */
  cantMissMissed: string[];
  list: string[];
}

export interface QuestionRun {
  questions: number;
  stop: string;
  reachedThreshold: boolean;
  targetRankAtStop: number | null;
  cantMissAtStop: number;
  path: string[];
}

export interface ShadowRow {
  vignetteId: string;
  area: string;
  entry: EntryType;
  /** The first mustRankTopK target matches a vademecum disease. */
  inScope: boolean;
  target: string | null;
  engines: Partial<Record<EngineId, EngineVerdict>>;
  vademecumQuestions: QuestionRun | null;
  paneQuestions: QuestionRun | null;
  /** Where the hybrid layer changed the answer against the Bayesian layer alone. */
  hybridChanges: string[];
  criteria: string[];
  confirmatory: string[];
  excluded: string[];
  conflicts: string[];
  incidental: string[];
  finalDiagnosisPrompts: string[];
  candidates: number;
}

export interface Aggregate {
  n: number;
  /** Vignettes with a mustRankTopK target (the top-k denominator). */
  nTarget: number;
  top1: number;
  top3: number;
  top5: number;
  topKPassed: number;
  topKTotal: number;
  cantMissCaptured: number;
  cantMissTotal: number;
}

export interface ShadowFile {
  type: 'clinval-vademecum-shadow';
  generatedAt: string;
  harness: string;
  vademecumVersion: string;
  rows: ShadowRow[];
  groups: Record<string, Partial<Record<EngineId, Aggregate>> & { questions?: QuestionAggregate }>;
  lostCantMiss: { vignetteId: string; expectation: string; capturedBy: EngineId[] }[];
}

export interface QuestionAggregate {
  n: number;
  vademecumMean: number;
  vademecumMedian: number;
  vademecumReached: number;
  paneMean: number;
  paneMedian: number;
  paneReached: number;
  vademecumTop1AtStop: number;
  paneTop1AtStop: number;
}

// ── Reading the record ────────────────────────────────────────────────────────────────────────

/** Negation-aware term matcher (lib/triage-engine negation.ts); ≤ 4-letter terms match whole words. */
export const textMatcher: TextMatcher = (text, term) => {
  const lower = text.toLowerCase();
  const t = term.toLowerCase().trim();
  if (!t) return null;
  const opts = t.length <= 4 ? { wholeWord: true } : { wordStart: true };
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = t.length <= 4 ? new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z])`) : new RegExp(`(^|[^a-z0-9])${esc}`);
  if (!re.test(lower)) return null;
  return findAllAffirmed(text, t, opts).length ? 'affirmed' : 'negated';
};

function patientOf(v: Vignette): PatientInfo {
  return { age: v.inputs.patient.ageYears, sex: webSex(v), pregnancyPossible: pregnancyPossible(v) };
}

function entryOf(v: Vignette): EntryType {
  const tag = (v.tags ?? []).find(t => t.startsWith('entry:'));
  const kind = tag?.slice(6);
  return kind === 'lab' || kind === 'imaging' || kind === 'pathology' ? kind : 'complaint';
}

function historyText(v: Vignette, ios: boolean): string {
  const inp = v.inputs;
  const socrates = Object.values(inp.socrates ?? {}).flat();
  const iosSel = ios ? Object.values(inp.platform?.ios?.socratesSelections ?? {}).flat() : [];
  return joinClauses([
    inp.chiefComplaint, inp.hpi, ...(inp.symptoms ?? []), ...(inp.negatives ?? []).map(n => `No ${n}`),
    ...socrates, ...iosSel,
    ...(inp.comorbidities ?? []),
    ...(inp.medications ?? []).map(m => `Takes ${m.drug}`), inp.socialHistory,
  ]);
}

function examText(v: Vignette): string {
  const e = v.inputs.exam ?? {};
  return joinClauses([e.general, e.abdomen, e.cardiovascular, e.respiratory, e.neuro, e.msk, e.skin, e.other]);
}

function reportKind(name: string, modality: string): 'imaging' | 'endoscopy' | 'pathology' {
  if (/histolog|patholog|biops|cytolog|fna\b|resection specimen/i.test(name)) return 'pathology';
  return modality === 'Endoscopy' ? 'endoscopy' : 'imaging';
}

/** Structured labs in the catalogue app unit (report-import catalogue), with any laboratory flag. */
function analyteResults(v: Vignette): AnalyteResult[] {
  const out: AnalyteResult[] = [];
  for (const l of v.inputs.labs ?? []) {
    const an = analyteForKey(l.analyte);
    const name = an?.name ?? (/^d-?dimer$/i.test(l.analyte) ? 'D-dimer' : l.analyte);
    const labFlag = /\b(raised|high|elevated|positive)\b/i.test(l.resultText ?? '') ? 'high' as const
      : /\b(low|reduced)\b/i.test(l.resultText ?? '') ? 'low' as const : null;
    let value = typeof l.value === 'number' ? l.value : null;
    let unit = l.unit ?? null;
    if (an && value !== null && unit) {
      const u = normaliseUnit(unit);
      if (an.unitAliases.includes(u)) unit = an.appUnit;
      else if (an.conversions[u] !== undefined) { value = value * an.conversions[u]!; unit = an.appUnit; }
    }
    out.push({ analyte: name, value, unit, labFlag });
  }
  return out;
}

function labClassifier(p: PatientInfo): LabClassifier {
  const ctx = { sex: p.sex, ageYears: p.age };
  return (analyte, value, unit) => {
    const c = classifyAnalyte(null, analyte, value, unit, ctx);
    const uln = c.range ? upperLimitOfNormal(null, analyte, ctx)?.value ?? null : null;
    return { flag: c.flag, uln };
  };
}

/** TG18 (tg18-autofill + clinical-scores) and NG12 (cancer-screening) results, by evaluator id. Only met criteria are passed; otherwise the vademecum's own fallback applies. */
function externals(v: Vignette): Record<string, boolean> {
  const inp = v.inputs;
  const out: Record<string, boolean> = {};
  const labs = extractedLabs(v);
  const sv = scoringVitals(v);
  const record: Tg18Record = {
    age: inp.patient.ageYears, systolicBp: sv.systolicBp ?? null, avpu: null, labs,
    examText: [inp.exam?.general, inp.exam?.abdomen, inp.exam?.other, inp.exam?.skin].filter(Boolean).join('\n'),
    historyText: inp.hpi ?? '', assessment: '',
    imagingReports: (inp.imaging ?? []).map(i => i.result), surgicalHistory: inp.surgicalHistory ?? [],
  };
  const letters = (met: string[]) => new Set(met.map(m => m.replace(/^Grade II: .*/, '').charAt(0)).filter(Boolean));
  const kc = letters(scoreTokyoCholecystitis(tokyoCholecystitisAutoFill(record), labs, sv).criteria_met);
  if (kc.has('A') && kc.has('B')) out['tg18-cholecystitis:suspected'] = true;
  if (kc.has('A') && kc.has('B') && kc.has('C')) out['tg18-cholecystitis:definite'] = true;
  const ch = letters(scoreTokyoCholangitis(tokyoCholangitisAutoFill(record), labs, sv).criteria_met);
  if (ch.has('A') && (ch.has('B') || ch.has('C'))) out['tg18-cholangitis:suspected'] = true;
  if (ch.has('A') && ch.has('B') && ch.has('C')) out['tg18-cholangitis:definite'] = true;
  const sex = inp.patient.sex === 'unspecified' ? 'unknown' : inp.patient.sex;
  const screen = screenForCancer({
    age: inp.patient.ageYears, sex, chiefComplaints: [inp.chiefComplaint], symptoms: inp.symptoms ?? [],
    familyHistory: [], responses: {}, freeText: joinClauses([inp.hpi]), labs: readCancerScreenLabs(investigationResults(v)),
  });
  for (const c of screen.criteria.filter(x => x.met)) {
    const text = `${c.rule} ${c.guideline} ${c.site ?? ''}`;
    if (/pancrea/i.test(text)) out['ng12-pancreatic'] = true;
    else if (/NG12 1\.1\b|lung|haemoptysis|chest x-ray/i.test(text)) out['ng12-lung'] = true;
    else if (/dysphag|dyspeps|oesophag|gastric|upper gi|NG12 1\.2/i.test(text)) out['ng12-oesophago-gastric'] = true;
    if (/colorectal|NG12 1\.3|FIT|DG56/i.test(text)) out['ng12-colorectal'] = true;
  }
  return out;
}

export interface VignetteEvidence {
  answers: Record<string, boolean>;
  externals: Record<string, boolean>;
}

/** Everything the record holds, as vademecum findings. `mode` 'web' reads through the PANE mapper; 'ios' through text only. */
export function vignetteEvidence(vd: Vademecum, v: Vignette, mode: 'web' | 'ios'): VignetteEvidence {
  const inp = v.inputs;
  const p = patientOf(v);
  // Previous operations are read from the surgical history only: the history of the complaint
  // names planned operations too ("for elective laparoscopic cholecystectomy").
  const surgical = new Set([...vd.findings.values()].filter(f => f.dimension === 'surgical-history').map(f => f.id));
  const withPane = new Set([...vd.findings.values()].filter(f => f.pane).map(f => f.id));
  const answers: Record<string, boolean> = {};
  const put = (x: Record<string, boolean>) => Object.assign(answers, x);
  put(findingsFromText(vd, joinClauses(inp.surgicalHistory ?? []), textMatcher, { dimensions: ['surgical-history'] }));
  if (mode === 'web') {
    put(findingsFromText(vd, historyText(v, false), textMatcher, { levels: ['history'], skip: new Set([...withPane, ...surgical]) }));
    put(findingsFromText(vd, examText(v), textMatcher, { levels: ['exam'], skip: withPane }));
    const cc = inp.platform?.web?.ccTemplate ?? inp.chiefComplaint;
    const features = extractFeaturesFromSocrates(cc, socratesAnswers(v), paneContextFromConsultation(consultationSnapshot(v)));
    put(findingsFromPane(vd, { ...features, ...(inp.platform?.web?.paneAnswers ?? {}) }));
  } else {
    put(findingsFromText(vd, historyText(v, true), textMatcher, { levels: ['history'], skip: surgical }));
    put(findingsFromText(vd, examText(v), textMatcher, { levels: ['exam'] }));
  }
  for (const r of inp.imaging ?? []) put(findingsFromReport(vd, r.result, reportKind(r.name, r.modality), textMatcher));
  put(findingsFromLabs(vd, analyteResults(v), labClassifier(p)));
  put(findingsFromExamSigns(vd, inp.examSigns ?? {}));
  put(findingsFromScores(vd, recordedScoreValues(v)));
  return { answers, externals: externals(v) };
}

// ── Grading ───────────────────────────────────────────────────────────────────────────────────

function itemText(d: RankedItem): string {
  return `${d.name} [${d.id}]`;
}

function rankOf(list: RankedItem[], exp: DxExpectation): number | null {
  const i = list.findIndex(d => counts(itemText(d), exp.match, exp.unless, d.icd10));
  return i < 0 ? null : i + 1;
}

function verdict(v: Vignette, list: RankedItem[]): EngineVerdict {
  const topK = v.expected.differential?.mustRankTopK ?? [];
  const cm = v.expected.differential?.mustNotMiss ?? [];
  const shown = list.slice(0, 5);
  const target = topK[0];
  const missed = cm.filter(e => rankOf(shown, e) === null).map(e => e.id);
  return {
    targetRank: target ? rankOf(shown, target) : null,
    topKPassed: topK.filter(e => { const r = rankOf(shown, e); return r !== null && r <= (e.k ?? 3); }).length,
    topKTotal: topK.length,
    cantMissCaptured: cm.length - missed.length,
    cantMissTotal: cm.length,
    cantMissMissed: missed,
    list: shown.map((d, i) => `${i + 1}. ${d.name}${d.probability !== undefined ? ` ${(d.probability * 100).toFixed(0)}%` : ''}`),
  };
}

function vademecumList(ev: Evaluation): RankedItem[] {
  return ev.display.map((r: DiseaseResult) => ({ name: r.label, id: r.pane ?? r.id, icd10: r.icd10, probability: r.effective }));
}

// ── PANE (the web engine) ───────────────────────────────────────────────────────────────────────

function paneDiseases(v: Vignette) {
  return applyModifiers(DISEASES, v.inputs.patient.ageYears, webSex(v), undefined, { pregnancyPossible: pregnancyPossible(v) });
}

const FEATURE_IDS = new Set(FEATURES.map(f => f.id));

function paneRecordFeatures(v: Vignette): Record<string, boolean> {
  const cc = v.inputs.platform?.web?.ccTemplate ?? v.inputs.chiefComplaint;
  const f = extractFeaturesFromSocrates(cc, socratesAnswers(v), paneContextFromConsultation(consultationSnapshot(v)));
  return { ...f, ...(v.inputs.platform?.web?.paneAnswers ?? {}) };
}

function paneApply(state: PaneState, diseases: ReturnType<typeof paneDiseases>, features: Record<string, boolean>): PaneState {
  let s = state;
  for (const [id, present] of Object.entries(features)) if (FEATURE_IDS.has(id)) s = updatePosterior(s, diseases, id, present);
  return s;
}

function paneList(state: PaneState, diseases: ReturnType<typeof paneDiseases>, n = 5): RankedItem[] {
  return topDiagnoses(state, diseases, n).map(r => ({ name: r.disease.label, id: r.disease.id, icd10: r.disease.icd10, probability: r.probability }));
}

/** PANE's own question loop (nextBestQuestion: convergence 0.85, cap 8) from the chief complaint (or entry result). */
function paneQuestionRun(v: Vignette, startFeatures: Record<string, boolean>): QuestionRun {
  const diseases = paneDiseases(v);
  const record = paneRecordFeatures(v);
  let state = paneApply(initPaneState(diseases), diseases, startFeatures);
  state = { ...state, iteration: 0 };
  const skipped = new Set<string>();
  const path: string[] = [];
  let questions = 0;
  while (true) {
    const q = nextBestQuestion(state, diseases, FEATURES.filter(f => !skipped.has(f.id)));
    if (!q) break;
    questions++;
    const known = record[q.id];
    const answer = known !== undefined ? known : (q.category === 'investigation' ? undefined : false);
    path.push(`${q.id}=${answer === undefined ? '?' : answer ? 'yes' : 'no'}`);
    if (answer === undefined) { skipped.add(q.id); state = { ...state, iteration: state.iteration + 1 }; }
    else state = updatePosterior(state, diseases, q.id, answer);
  }
  const top = Math.max(...Object.values(state.posteriors));
  const list = paneList(state, diseases);
  const vd = verdict(v, list);
  return {
    questions, stop: top >= 0.85 ? 'converged' : 'question-cap', reachedThreshold: top >= 0.85,
    targetRankAtStop: vd.targetRank, cantMissAtStop: vd.cantMissCaptured, path,
  };
}

// ── iOS results (committed CI run) ───────────────────────────────────────────────────────────────

function iosLists(): Map<string, RankedItem[]> {
  const out = new Map<string, RankedItem[]>();
  let text = '';
  try { text = readFileSync(join(REPO_ROOT, 'docs', 'clinical-validation', 'results', 'ios-latest.jsonl'), 'utf8'); } catch { return out; }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as { vignetteId: string; outputs?: { differentials?: Record<string, { name: string; icd10?: string; rank: number }[]> } };
    const l = r.outputs?.differentials?.['ios.bayes'];
    if (l) out.set(r.vignetteId, [...l].sort((a, b) => a.rank - b.rank).map(d => ({ name: d.name, id: '', icd10: d.icd10 })));
  }
  return out;
}

// ── One vignette ──────────────────────────────────────────────────────────────────────────────────

function targetInScope(vd: Vademecum, v: Vignette): { inScope: boolean; area: string | null } {
  const target = v.expected.differential?.mustRankTopK?.[0];
  if (!target) return { inScope: false, area: null };
  for (const d of vd.diseases.values()) {
    const item = { name: d.disease.label, id: d.disease.pane ?? d.disease.id, icd10: d.disease.icd10 };
    if (counts(itemText(item), target.match, target.unless, item.icd10)) return { inScope: true, area: d.area };
  }
  return { inScope: false, area: null };
}

/** The chief complaint's own findings (the start of a simulated consultation). */
function complaintFindings(vd: Vademecum, v: Vignette): Record<string, boolean> {
  const cc = v.inputs.platform?.web?.ccTemplate ?? v.inputs.chiefComplaint;
  return {
    ...findingsFromText(vd, v.inputs.chiefComplaint, textMatcher, { levels: ['history'] }),
    ...findingsFromPane(vd, extractFeaturesFromSocrates(cc, {})),
  };
}

function vademecumQuestionRun(vd: Vademecum, v: Vignette, cand: CandidateSet, start: Record<string, boolean>, full: VignetteEvidence): QuestionRun {
  const patient = patientOf(v);
  const input: LoopInput = { patient, answers: start, externals: full.externals };
  const run = runLoop(vd, cand, input, q => {
    if (q.kind === 'rule') {
      const band = (vd.ruleBands.get(q.id) ?? []).find(b => full.answers[b] === true);
      return band;
    }
    const known = full.answers[q.id];
    if (known !== undefined) return known;
    const level = vd.findings.get(q.id)?.level;
    return level === 'history' || level === 'exam' ? false : undefined;
  });
  const vr = verdict(v, vademecumList(run.final));
  return {
    questions: run.steps.length, stop: run.stop, reachedThreshold: run.stop === 'treat-threshold' || run.stop === 'treat-threshold-workup' || run.stop === 'no-threshold-change',
    targetRankAtStop: vr.targetRank, cantMissAtStop: vr.cantMissCaptured,
    path: run.steps.map(s => `${s.question.id}=${s.answer === null ? '?' : s.answer === true ? 'yes' : s.answer === false ? 'no' : s.answer}`),
  };
}

export function shadowVignette(vd: Vademecum, v: Vignette, ios: Map<string, RankedItem[]>, withQuestions = true): ShadowRow | null {
  const inp = v.inputs;
  const entry = entryOf(v);
  const patient = patientOf(v);
  const frame = classifyComplaint(inp.chiefComplaint, inp.platform?.ios?.specialtyHint);
  const frames = [frame.frameId, ...frame.secondary];
  const areas = complaintAreas(vd, inp.chiefComplaint, frames);
  if (!areas.length && entry === 'complaint') return null;

  const web = vignetteEvidence(vd, v, 'web');
  const iosEv = vignetteEvidence(vd, v, 'ios');
  const kinds = entry === 'complaint' ? ['lab', 'imaging', 'pathology'] : [entry];
  const seed = (answers: Record<string, boolean>) => seedCandidates(vd, {
    complaint: inp.chiefComplaint, frames, patient, entryFindings: entryPointFindings(vd, answers, kinds),
  });
  const cand = seed(web.answers);
  if (!cand.ids.length) return null;
  const scope = targetInScope(vd, v);
  const area = scope.area && (cand.areas.includes(scope.area) || areas.includes(scope.area)) ? scope.area : (areas[0] ?? cand.areas[0] ?? 'none');

  const hybrid = evaluate(vd, cand.ids, { patient, answers: web.answers, externals: web.externals });
  const bayes = evaluate(vd, cand.ids, { patient, answers: web.answers, externals: web.externals, hybrid: false });
  const iosCand = seed(iosEv.answers);
  const iosRun = evaluate(vd, iosCand.ids, { patient, answers: iosEv.answers, externals: iosEv.externals });

  const diseases = paneDiseases(v);
  const pane = paneApply(initPaneState(diseases), diseases, paneRecordFeatures(v));
  const engines: ShadowRow['engines'] = {
    'web.pane': verdict(v, paneList(pane, diseases)),
    'vademecum.web': verdict(v, vademecumList(hybrid)),
    'vademecum.bayes': verdict(v, vademecumList(bayes)),
    'vademecum.ios': verdict(v, vademecumList(iosRun)),
  };
  const iosList = ios.get(v.id);
  if (iosList) engines['ios.bayes'] = verdict(v, iosList);

  // Where the hybrid layer changed the answer.
  const hybridChanges: string[] = [];
  const h = engines['vademecum.web']!;
  const b = engines['vademecum.bayes']!;
  if (hybrid.display[0]?.id !== bayes.display[0]?.id) hybridChanges.push(`leader ${bayes.display[0]?.label ?? '—'} → ${hybrid.display[0]?.label ?? '—'}`);
  if (h.targetRank !== b.targetRank) hybridChanges.push(`target rank ${b.targetRank ?? '—'} → ${h.targetRank ?? '—'}`);
  if (h.cantMissCaptured !== b.cantMissCaptured) hybridChanges.push(`can't-miss captured ${b.cantMissCaptured} → ${h.cantMissCaptured}`);

  let vq: QuestionRun | null = null;
  let pq: QuestionRun | null = null;
  if (withQuestions) {
    const start = complaintFindings(vd, v);
    const startPane: Record<string, boolean> = { ...extractFeaturesFromSocrates(inp.platform?.web?.ccTemplate ?? inp.chiefComplaint, {}) };
    if (entry !== 'complaint') {
      for (const id of entryPointFindings(vd, web.answers, [entry])) {
        start[id] = true;
        const pf = vd.findings.get(id)?.pane;
        if (pf) startPane[pf] = true;
      }
    }
    // A result-first case (lab, imaging, pathology) is seeded from that result only: the report line
    // in the chief-complaint field is not a symptom, and seeding its whole complaint area made the
    // loop screen unrelated history (rectal bleeding, dysuria) for an ultrasound finding.
    const qCand = seedCandidates(vd, entry === 'complaint'
      ? { complaint: inp.chiefComplaint, frames, patient, entryFindings: entryPointFindings(vd, start, kinds) }
      : { patient, entryFindings: entryPointFindings(vd, start, kinds) });
    vq = qCand.ids.length ? vademecumQuestionRun(vd, v, qCand, start, web) : null;
    pq = paneQuestionRun(v, startPane);
  }

  return {
    vignetteId: v.id, area, entry, inScope: scope.inScope,
    target: v.expected.differential?.mustRankTopK?.[0]?.match.join(' | ') ?? null,
    engines, vademecumQuestions: vq, paneQuestions: pq, hybridChanges,
    criteria: hybrid.ranked.flatMap(r => r.criteriaLabels.map(l => `${r.label}: ${l}`)),
    confirmatory: hybrid.ranked.flatMap(r => r.confirmatory.map(c => `${r.label}: ${c}`)),
    excluded: hybrid.excluded.map(e => `${e.label}: ${e.reason}`),
    conflicts: hybrid.conflicts.map(c => c.detail),
    incidental: hybrid.incidental.map(w => `${w.label}: ${w.steps.filter(s => s.applies !== false).map(s => s.label).join('; ')}`),
    finalDiagnosisPrompts: hybrid.finalDiagnosisPrompts.map(p => `${p.label} → ${p.finalDiseaseId} (${p.finalIcd10}, ${p.sourceType})`),
    candidates: cand.ids.length,
  };
}

// ── Aggregation ───────────────────────────────────────────────────────────────────────────────────

function aggregate(rows: ShadowRow[], engine: EngineId): Aggregate | undefined {
  const rs = rows.filter(r => r.engines[engine]);
  if (!rs.length) return undefined;
  const a: Aggregate = { n: rs.length, nTarget: rs.filter(r => r.target !== null).length, top1: 0, top3: 0, top5: 0, topKPassed: 0, topKTotal: 0, cantMissCaptured: 0, cantMissTotal: 0 };
  for (const r of rs) {
    const e = r.engines[engine]!;
    if (e.targetRank !== null && e.targetRank <= 1) a.top1++;
    if (e.targetRank !== null && e.targetRank <= 3) a.top3++;
    if (e.targetRank !== null && e.targetRank <= 5) a.top5++;
    a.topKPassed += e.topKPassed;
    a.topKTotal += e.topKTotal;
    a.cantMissCaptured += e.cantMissCaptured;
    a.cantMissTotal += e.cantMissTotal;
  }
  return a;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function questionAggregate(rows: ShadowRow[]): QuestionAggregate | undefined {
  const rs = rows.filter(r => r.vademecumQuestions && r.paneQuestions && r.target !== null);
  if (!rs.length) return undefined;
  const vq = rs.map(r => r.vademecumQuestions!.questions);
  const pq = rs.map(r => r.paneQuestions!.questions);
  const mean = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  return {
    n: rs.length, vademecumMean: mean(vq), vademecumMedian: median(vq), paneMean: mean(pq), paneMedian: median(pq),
    vademecumReached: rs.filter(r => r.vademecumQuestions!.reachedThreshold).length,
    paneReached: rs.filter(r => r.paneQuestions!.reachedThreshold).length,
    vademecumTop1AtStop: rs.filter(r => r.vademecumQuestions!.targetRankAtStop === 1).length,
    paneTop1AtStop: rs.filter(r => r.paneQuestions!.targetRankAtStop === 1).length,
  };
}

function groupsOf(rows: ShadowRow[]): ShadowFile['groups'] {
  const keys = new Map<string, ShadowRow[]>();
  const add = (k: string, r: ShadowRow) => keys.set(k, [...(keys.get(k) ?? []), r]);
  for (const r of rows) {
    add('all', r);
    add(`area:${r.area}`, r);
    add(`entry:${r.entry}`, r);
    if (r.inScope) add('all (target in the vademecum)', r);
    if (r.inScope) add(`area:${r.area} (target in the vademecum)`, r);
  }
  const out: ShadowFile['groups'] = {};
  for (const [k, rs] of [...keys.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const g: ShadowFile['groups'][string] = {};
    for (const e of ENGINES) { const a = aggregate(rs, e); if (a) g[e] = a; }
    const q = questionAggregate(rs);
    if (q) g.questions = q;
    out[k] = g;
  }
  return out;
}

export function runVademecumShadow(opts: { withQuestions?: boolean; generatedAt?: string; only?: (id: string) => boolean } = {}): { file: ShadowFile; errors: string[] } {
  const vd = bundledVademecum();
  const { vignettes, errors } = loadVignettes();
  const ios = iosLists();
  const rows: ShadowRow[] = [];
  for (const { vignette: v } of vignettes) {
    if (opts.only && !opts.only(v.id)) continue;
    try {
      const r = shadowVignette(vd, v, ios, opts.withQuestions !== false);
      if (r) rows.push(r);
    } catch (x) {
      errors.push(`${v.id}: vademecum shadow threw: ${x instanceof Error ? x.stack ?? x.message : String(x)}`);
    }
  }
  const lostCantMiss: ShadowFile['lostCantMiss'] = [];
  for (const r of rows) {
    const vm = r.engines['vademecum.web'];
    if (!vm) continue;
    for (const id of vm.cantMissMissed) {
      const by = (['web.pane', 'ios.bayes'] as EngineId[]).filter(e => r.engines[e] && !r.engines[e]!.cantMissMissed.includes(id));
      if (by.length) lostCantMiss.push({ vignetteId: r.vignetteId, expectation: id, capturedBy: by });
    }
  }
  return {
    file: {
      type: 'clinval-vademecum-shadow', generatedAt: opts.generatedAt ?? new Date().toISOString(), harness: SHADOW_VERSION,
      vademecumVersion: vd.version, rows, groups: groupsOf(rows), lostCantMiss,
    },
    errors,
  };
}

// ── Report ─────────────────────────────────────────────────────────────────────────────────────────

function pct(x: number, n: number): string {
  return n ? `${x}/${n} (${Math.round((x / n) * 100)}%)` : '—';
}

export function renderShadow(file: ShadowFile): string {
  const lines: string[] = [];
  lines.push('# Vademecum shadow — pilot areas (latest local run)', '');
  lines.push(`Generated ${file.generatedAt}; harness ${file.harness}; vademecum ${file.vademecumVersion}. Shadow only: nothing in production reads the vademecum.`, '');
  lines.push('Top-k: the first mustRankTopK target within the shown five. Expectations: mustRankTopK passed at their own k. Can\'t-miss: mustNotMiss expectations within the shown five. ios.bayes is the committed iOS CI run.', '');
  for (const [key, g] of Object.entries(file.groups)) {
    lines.push(`## ${key}`, '');
    lines.push('| Engine | n | Top-1 | Top-3 | Top-5 | Expectations | Can\'t-miss |', '|---|---|---|---|---|---|---|');
    for (const e of ENGINES) {
      const a = g[e];
      if (!a) continue;
      lines.push(`| ${e} | ${a.n} | ${pct(a.top1, a.nTarget)} | ${pct(a.top3, a.nTarget)} | ${pct(a.top5, a.nTarget)} | ${pct(a.topKPassed, a.topKTotal)} | ${pct(a.cantMissCaptured, a.cantMissTotal)} |`);
    }
    const q = g.questions;
    if (q) {
      lines.push('', `Questions to threshold (n ${q.n}): vademecum mean ${q.vademecumMean}, median ${q.vademecumMedian}, stopped at a threshold ${pct(q.vademecumReached, q.n)}, target first at stop ${pct(q.vademecumTop1AtStop, q.n)}; PANE mean ${q.paneMean}, median ${q.paneMedian}, converged ${pct(q.paneReached, q.n)}, target first at stop ${pct(q.paneTop1AtStop, q.n)}.`);
    }
    lines.push('');
  }
  lines.push('## Can\'t-miss diagnoses the vademecum lost (captured by a current engine)', '');
  if (!file.lostCantMiss.length) lines.push('None.');
  for (const l of file.lostCantMiss) lines.push(`- ${l.vignetteId} / ${l.expectation} (captured by ${l.capturedBy.join(', ')})`);
  lines.push('', '## Where criteria, confirmatory findings or exclusions changed the answer (hybrid vs Bayesian only)', '');
  const changed = file.rows.filter(r => r.hybridChanges.length);
  if (!changed.length) lines.push('None.');
  for (const r of changed) {
    lines.push(`- **${r.vignetteId}**: ${r.hybridChanges.join('; ')}`);
    for (const c of r.criteria) lines.push(`  - criteria: ${c}`);
    for (const c of r.confirmatory) lines.push(`  - ${c}`);
    for (const e of r.excluded) lines.push(`  - excluded: ${e}`);
  }
  lines.push('', '## Per vignette', '');
  lines.push('| Vignette | Area | Entry | In scope | PANE | iOS | Vademecum | Bayes only | Vademecum (iOS evidence) | Qs vademecum / PANE |', '|---|---|---|---|---|---|---|---|---|---|');
  const rank = (e?: EngineVerdict) => (e ? `${e.targetRank ?? '—'}${e.cantMissTotal ? ` (cm ${e.cantMissCaptured}/${e.cantMissTotal})` : ''}` : 'n/a');
  for (const r of file.rows) {
    lines.push(`| ${r.vignetteId} | ${r.area} | ${r.entry} | ${r.inScope ? 'yes' : 'no'} | ${rank(r.engines['web.pane'])} | ${rank(r.engines['ios.bayes'])} | ${rank(r.engines['vademecum.web'])} | ${rank(r.engines['vademecum.bayes'])} | ${rank(r.engines['vademecum.ios'])} | ${r.vademecumQuestions?.questions ?? '—'} (${r.vademecumQuestions?.stop ?? '—'}) / ${r.paneQuestions?.questions ?? '—'} |`);
  }
  lines.push('', '## Hybrid outputs (criteria, conflicts, incidental work-up, final-diagnosis prompts)', '');
  for (const r of file.rows) {
    const extra = [
      ...r.conflicts.map(c => `conflict: ${c}`), ...r.incidental.map(i => `incidental work-up: ${i}`),
      ...r.finalDiagnosisPrompts.map(p => `final-diagnosis prompt (never written): ${p}`),
    ];
    if (extra.length) lines.push(`- ${r.vignetteId}: ${extra.join(' · ')}`);
  }
  return `${lines.join('\n')}\n`;
}

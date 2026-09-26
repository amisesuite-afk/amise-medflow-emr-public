/**
 * Diagnostic reasoning — web adapter (PANE). Deterministic; no AI calls.
 *
 * Turns the PANE posterior (lib/pane-engine: disease feature likelihoods and background rates)
 * into the platform-neutral reasoning input of @workspace/triage-engine/diagnostic-reasoning and
 * returns what the Assessment step's "Diagnostic reasoning" panel shows:
 *   - for / against / missing / doesn't fit for the top 3 diagnoses and the working diagnosis,
 *     each finding with its likelihood ratio P(finding | disease) / background rate and the PANE
 *     module's guideline;
 *   - the best next discriminator between the top 3 (expected information gain from pane-engine
 *     informationGain, cheapest first, CT / endoscopy only with a can't-miss diagnosis among them);
 *   - "Doesn't fit the working diagnosis" alerts, the diagnostic time-out, the zebra check and the
 *     longitudinal pattern view.
 * The iOS twin is ios/AmiseMedFlow/Services/DiagnosticReasoningAdapter.swift (DiagnosticDatabase
 * candidates and logLR). Nothing here writes to the record: the panel adds a line only when the
 * clinician taps.
 */

import {
  DISEASES, FEATURES, baseRate, evidenceItems, featureLikelihood, getDiseaseSpecialty, informationGain, isEvidenceFeature,
  updatePosterior,
} from '@workspace/pane-engine';
import type { DiseaseNode, EvidenceItem, Feature, PaneState, RecordedEvidence } from '@workspace/pane-engine';
import {
  adapterClosureAlerts, classifyProbeCost, competesForEvidence as sharedCompetesForEvidence, derivedLabTerms, diagnosticTimeOut,
  discriminatorWhy, explain, fmtPct, longitudinalPatterns, matchZebras, namedInDiagnosis as sharedNamedInDiagnosis,
  rankDiscriminators, resolveWorkingIndex, unexplainedFindings, CONTRADICTION_MAX_LR, DIAGNOSTIC_REASONING_VERSION, REASONING_RULES,
} from '@workspace/triage-engine/diagnostic-reasoning';
import type {
  ClosureAlert, Explanation, FindingWeight, LabValue, LongitudinalInput, LongitudinalPatterns, LongitudinalVisit,
  ProbeCandidate, ProbeKind, RankedProbe, ReasoningFinding, ReasoningHypothesis, ReasoningInput, TimeOutResult,
  ZebraMatch,
} from '@workspace/triage-engine/diagnostic-reasoning';
import { evaluateNews2, joinClauses } from '@workspace/triage-engine';
import type { News2Avpu } from '@workspace/triage-engine';
import { isSameProblem } from '@workspace/triage-engine/visit-continuity';
import { familyOf } from './diagnosis-families';

/**
 * Version of the web adapter's own rules (PANE evidence: LRs from feature likelihoods and background
 * rates, cardinal findings, the can't-miss list, the PANE module sources, the time-out filters).
 * Registered as `diagnostic-reasoning-web`. The rules both platforms share (diagnosis families,
 * working-diagnosis label matching, the two-conditions and already-named rules, the contradiction
 * threshold, the coexisting states) are `diagnostic-reasoning-rules` (DIAGNOSTIC_REASONING_VERSION,
 * clinical-content/rules/diagnostic-reasoning-rules.json).
 */
export const DIAGNOSTIC_REASONING_WEB_VERSION = '1.2.0';

/** Label-match thresholds of the working-diagnosis resolution (diagnostic-reasoning-rules `workingDiagnosis`). */
export const LABEL_MATCH_MIN: number = REASONING_RULES.workingDiagnosis.labelMatchMin;
export const LABEL_MATCH_MIN_ALONE: number = REASONING_RULES.workingDiagnosis.labelMatchMinAlone;
export const LABEL_MATCH_MARGIN: number = REASONING_RULES.workingDiagnosis.labelMatchMargin;

/**
 * A single contradicting finding raises "Doesn't fit the working diagnosis" only when its
 * likelihood ratio is at most this (moderate or strong evidence against: LR 0.1-0.2 moderate,
 * < 0.1 large; Jaeschke, Guyatt & Sackett, JAMA 1994). Shared with iOS (diagnostic-reasoning-rules
 * `closure.contradictionMaxLr`); the core flags LR <= 0.33.
 */
export const WEB_CONTRADICTION_MAX_LR: number = CONTRADICTION_MAX_LR;

/** Hypotheses compared (the top of the PANE differential). */
export const REASONING_TOP_K = 3;
/** A feature is cardinal for a disease when P(feature | disease) ≥ this and its LR+ ≥ 2. */
export const CARDINAL_MIN_SENSITIVITY = 0.6;
export const CARDINAL_MIN_LR = 2;
/** Findings more common than this in the background population do not count towards the time-out. */
export const TIME_OUT_MAX_BASE_RATE = 0.05;

/**
 * PANE diseases that are time-critical ("can't miss"): the only ones for which a CT, MRI,
 * endoscopy or other advanced test is offered as the next discriminator. Registered in
 * `diagnostic-reasoning-rules`; needs sign-off. iOS uses the database's own urgency ≥ 2.
 */
export const CANT_MISS_DISEASE_IDS: ReadonlySet<string> = new Set([
  'sepsis', 'anaphylaxis', 'hyperkalaemia', 'acs', 'aortic_dissection', 'acute_heart_failure', 'hypertensive_emergency',
  'fournier_gangrene', 'toxic_megacolon', 'sigmoid_volvulus', 'lower_gi_bleed', 'cholangitis', 'bowel_obstruction',
  'ectopic_pregnancy', 'ovarian_torsion', 'dka', 'hhs', 'hypoglycaemia', 'stroke', 'sah', 'meningitis', 'cauda_equina',
  'mscc', 'pre_eclampsia', 'placental_abruption', 'intussusception', 'malrotation_volvulus', 'anastomotic_leak',
  'necrotising_fasciitis', 'blunt_abdominal_trauma', 'penetrating_abdominal_trauma', 'traumatic_brain_injury',
  'pneumothorax_traumatic', 'haemothorax', 'splenic_laceration', 'oesophageal_perforation', 'upper_gi_bleed',
  'variceal_bleed', 'perforated_peptic_ulcer', 'food_bolus', 'infected_obstructed_kidney', 'testicular_torsion',
  'aortic_aneurysm', 'aortoenteric_fistula', 'mesenteric_ischaemia', 'acute_limb_ischaemia', 'pulmonary_embolism',
  'incarcerated_hernia', 'electrical_burn', 'thermal_burn_major',
]);

/**
 * Syndromes and states that accompany other diagnoses rather than compete with them: never the
 * alternative a "doesn't fit" alert points to (registered in `diagnostic-reasoning-rules`).
 */
export const COEXISTING_DISEASE_IDS: ReadonlySet<string> = new Set(REASONING_RULES.coexisting.paneIds);

/** Guideline sources of each PANE module (the module header comments), for the evidence lines. */
export const PANE_MODULE_SOURCES: Record<string, string> = {
  general_surgery: 'PANE general surgery: Alvarado 1986, Andersson 2004; Trowbridge JAMA 2003; TG18; WSES 2017/2020',
  hepatobiliary: 'PANE hepatobiliary: NICE CG188 (2014); NICE NG12; TG18',
  colorectal: 'PANE colorectal: ASCRS 2018/2021; BSG 2019 LGIB; WSES/SIS-E 2018',
  hernia: 'PANE hernia: HerniaSurge 2018; EHS 2014–2020; WSES 2017',
  breast: 'PANE breast: NICE NG12; ABS 2019',
  endocrine: 'PANE endocrine: BTA 2014, ATA 2015/2016/2021; Endocrine Society 2014; SfE 2016',
  vascular: 'PANE vascular: ESVS 2017–2024; NICE NG156; WSES 2022',
  gynaecology: 'PANE gynaecology: NICE NG126; RCOG GTG 21; BASHH 2019',
  trauma: 'PANE trauma: ATLS 10th ed.; NICE NG232; BBA 2012',
  upper_gi: 'PANE upper GI: NICE NG12; ESGE 2016/2021; NICE CG141; Baveno VII; WSES 2019/2020',
  skin_soft_tissue: 'PANE skin/soft tissue: IDSA 2014; WSES/SIS-E 2018; IWGDF/IDSA 2023',
  urology: 'PANE urology: EAU 2024; NICE NG111; Bent JAMA 2002',
  post_op: 'PANE post-operative: NICE NG125; WSES 2017; NICE NG139',
  cardiology: 'PANE cardiovascular: ESC 2023 ACS; Panju JAMA 1998; ESC 2014/2018/2021/2024',
  respiratory: 'PANE respiratory: Metlay JAMA 1997; BTS 2009/2011; BTS/SIGN 158; GOLD 2025',
  acute_medicine: 'PANE acute medicine: NICE NG51; Sepsis-3; RCUK 2021; KDIGO 2012',
  metabolic: 'PANE metabolic: JBDS-IP 2022/2023; ADA 2024',
  neurology: 'PANE neurology: NICE NG128/NG228/NG240; Goldstein JAMA 2005; Perry JAMA 2013',
  obstetrics: 'PANE obstetrics: NICE NG133; ISSHP 2021; RCOG GTG 63/69',
  paediatrics: 'PANE paediatrics: APLS 6th ed.; BSPGHAN; BAPS',
};

export function paneSource(diseaseId: string): string {
  return PANE_MODULE_SOURCES[getDiseaseSpecialty(diseaseId)] ?? 'PANE disease model 1.0.0';
}

const FEATURE_BY_ID: ReadonlyMap<string, Feature> = new Map(FEATURES.map(f => [f.id, f]));

function clampRate(p: number): number {
  return Math.min(0.995, Math.max(0.005, p));
}

/** The engine's own evidence for one disease and one feature. */
export function paneWeight(d: DiseaseNode, featureId: string): FindingWeight {
  const p = featureLikelihood(d, featureId);
  const b = clampRate(baseRate(featureId));
  const own = typeof d.features[featureId] === 'number';
  const lrPresent = p / b;
  return {
    lrPresent,
    lrAbsent: (1 - p) / (1 - b),
    // Listed in the disease node itself (derived umbrella / onset values are used for the LR but
    // do not count as the disease "expecting" the finding).
    modelled: own,
    cardinal: own && p >= CARDINAL_MIN_SENSITIVITY && lrPresent >= CARDINAL_MIN_LR,
    source: paneSource(d.id),
  };
}

export interface WorkingDiagnosisRef {
  diseaseId: string | null;
  icdCode: string | null;
  label: string;
}

/**
 * The PANE node for the confirmed working diagnosis: its disease id; else the node whose label
 * matches the diagnosis text better than the ICD-10 match does (an ICD code can be shared or
 * unspecific: K92.2 "GI haemorrhage" for a lower GI bleed, E11.1 for euglycaemic DKA in type 2
 * diabetes, K60.3 anal fistula where PANE's only K60 node is anal fissure); else its ICD-10 code
 * (exact, then the same category, most probable first); else the exact label.
 */
export function resolveWorkingNode(diseases: DiseaseNode[], ref: WorkingDiagnosisRef | null, state?: PaneState | null): DiseaseNode | null {
  if (!ref) return null;
  if (ref.diseaseId) {
    const byId = diseases.find(d => d.id === ref.diseaseId);
    if (byId) return byId;
  }
  const candidates = diseases.filter(d => d.id !== '_other_');
  // Shared with iOS (diagnostic-reasoning families.ts resolveWorkingIndex).
  const i = resolveWorkingIndex(
    candidates.map(d => ({ label: d.label, icd10: d.icd10, probability: state?.posteriors[d.id] ?? 0 })),
    ref.label, ref.icdCode,
  );
  return i === null ? null : candidates[i];
}

export interface ReasoningDiscriminator {
  probe: RankedProbe;
  question: string;
  why: string;
  /** Labels of the diagnoses it separates. */
  separates: string[];
}

export interface ZebraSuggestion extends ZebraMatch {
  /** The web differential already lists it in the top 3. */
  inDifferential: boolean;
}

export interface DiagnosticReasoning {
  version: string;
  hypotheses: ReasoningHypothesis[];
  /** Top 3, then the working diagnosis when it is not among them. */
  explanations: Explanation[];
  workingId: string | null;
  discriminators: ReasoningDiscriminator[];
  closureAlerts: ClosureAlert[];
  timeOut: TimeOutResult;
  zebras: ZebraSuggestion[];
  longitudinal: LongitudinalPatterns | null;
  /** Number of recorded findings (present or absent) the engine used. */
  findingsUsed: number;
  /** Posterior range of each hypothesis when any one recorded finding is left out. */
  ranges: Record<string, { low: number; high: number }>;
  /**
   * Examination signs and decision rules recorded on the Exam / Scales steps (evidence-exam):
   * each with its likelihood ratio, what it did to the engine, and how far it moved the
   * diagnoses it is evidence for.
   */
  examEvidence: ExamEvidenceLine[];
  /** hypothesis id → evidence feature id → posterior without it (from) and with it (to). */
  evidenceMoves: Record<string, Record<string, EvidenceMove>>;
}

export interface EvidenceMove { from: number; to: number }

export interface ExamEvidenceLine {
  item: EvidenceItem;
  /** Diagnoses (or the finding) it moved: label, probability without it → with it. */
  moves: { label: string; from: number; to: number }[];
}

export interface ReasoningRequest {
  state: PaneState;
  /** The diseases after applyModifiers (the same list the posterior was built with). */
  diseases: DiseaseNode[];
  working: WorkingDiagnosisRef | null;
  /** Chronological NEWS2 totals of this encounter (oldest first). */
  news2Series: number[];
  /** Whole record as text, for the zebra check (reasoningRecordText). */
  recordText: string;
  labs: LabValue[];
  /** Earlier visits (not today) and results, for the longitudinal view and the time-out. */
  longitudinal?: LongitudinalInput | null;
  currentComplaint?: string;
  /** Recorded examination signs and decision rules (exam-evidence-features.ts recordedEvidence). */
  evidence?: RecordedEvidence | null;
}

function rankedDiseases(state: PaneState, diseases: DiseaseNode[]): DiseaseNode[] {
  return diseases
    .filter(d => d.id !== '_other_' && (state.posteriors[d.id] ?? 0) > 0)
    .sort((a, b) => (state.posteriors[b.id] ?? 0) - (state.posteriors[a.id] ?? 0));
}

function featureLabel(id: string): string {
  return FEATURE_BY_ID.get(id)?.label ?? id.replace(/_/g, ' ');
}

/** The reasoning input for `nodes` (hypotheses, recorded findings and cardinal unknowns). */
export function buildReasoningInput(state: PaneState, nodes: DiseaseNode[]): ReasoningInput {
  const hypotheses: ReasoningHypothesis[] = nodes.map(d => ({
    id: d.id, label: d.label, probability: state.posteriors[d.id] ?? 0, cantMiss: CANT_MISS_DISEASE_IDS.has(d.id),
    coexists: COEXISTING_DISEASE_IDS.has(d.id),
  }));
  const findings: ReasoningFinding[] = [];
  const seen = new Set<string>();
  for (const [id, present] of Object.entries(state.answered)) {
    if (!FEATURE_BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    findings.push({ id, label: featureLabel(id), status: present ? 'present' : 'absent' });
  }
  for (const d of nodes) {
    for (const id of Object.keys(d.features)) {
      if (seen.has(id) || !FEATURE_BY_ID.has(id)) continue;
      if (paneWeight(d, id).cardinal) {
        seen.add(id);
        findings.push({ id, label: featureLabel(id), status: 'unknown' });
      }
    }
  }
  const weights: ReasoningInput['weights'] = {};
  for (const d of nodes) {
    weights[d.id] = {};
    for (const f of findings) weights[d.id][f.id] = paneWeight(d, f.id);
  }
  return { hypotheses, findings, weights };
}

function probeKind(f: Feature): ProbeKind {
  return f.category;
}

/** Best next question / sign / test between `nodes` (information gain over those diseases only). */
export function paneDiscriminators(
  state: PaneState, diseases: DiseaseNode[], nodes: DiseaseNode[], limit = 3,
): ReasoningDiscriminator[] {
  if (nodes.length < 2) return [];
  const total = nodes.reduce((s, d) => s + (state.posteriors[d.id] ?? 0), 0);
  if (total <= 0) return [];
  const restricted: PaneState = {
    posteriors: Object.fromEntries(nodes.map(d => [d.id, (state.posteriors[d.id] ?? 0) / total])),
    answered: state.answered,
    iteration: state.iteration,
  };
  const candidates: ProbeCandidate[] = [];
  for (const f of FEATURES) {
    // Examination-sign and rule-band evidence is offered on the Exam step, not as a PANE question.
    if (f.id in state.answered || f.askable === false) continue;
    const gain = informationGain(restricted, nodes, f.id);
    const kind = probeKind(f);
    candidates.push({
      id: f.id, label: f.label, kind,
      cost: classifyProbeCost(kind, `${f.id.replace(/_/g, ' ')} ${f.label} ${f.question}`),
      gain,
    });
  }
  const cantMiss = nodes.some(d => CANT_MISS_DISEASE_IDS.has(d.id));
  return rankDiscriminators(candidates, cantMiss, limit).map(probe => {
    const ifPos = updatePosterior(state, diseases, probe.id, true).posteriors;
    const ifNeg = updatePosterior(state, diseases, probe.id, false).posteriors;
    const lines = nodes.map(d => ({
      label: d.label, before: state.posteriors[d.id] ?? 0, ifPositive: ifPos[d.id] ?? 0, ifNegative: ifNeg[d.id] ?? 0,
    }));
    return {
      probe,
      question: FEATURE_BY_ID.get(probe.id)?.question ?? probe.label,
      why: discriminatorWhy(probe.kind, lines),
      separates: nodes.map(d => d.label),
    };
  });
}

/** Earlier visits for the same complaint (visit-continuity rules) and their diagnoses. */
export function sameComplaintHistory(visits: LongitudinalVisit[], complaint: string): { count: number; diagnoses: string[] } {
  if (!complaint.trim()) return { count: 0, diagnoses: [] };
  const same = visits.filter(v => isSameProblem(complaint, {
    date: v.date, complaint: v.complaint, diagnosis: v.diagnosis, diagnosisICD: null, plan: null,
  }) && ((v.complaint ?? '').trim() || (v.diagnosis ?? '').trim()));
  return { count: same.length, diagnoses: same.map(v => (v.diagnosis ?? '').trim()) };
}

/**
 * How much each probability rests on single findings: the lowest and highest posterior of each
 * hypothesis when any one recorded finding is left out (the state is replayed from the priors).
 */
export function leaveOneOutRanges(
  state: PaneState, diseases: DiseaseNode[], ids: string[],
): Record<string, { low: number; high: number }> {
  const out: Record<string, { low: number; high: number }> = {};
  for (const id of ids) out[id] = { low: state.posteriors[id] ?? 0, high: state.posteriors[id] ?? 0 };
  const answered = Object.entries(state.answered).filter(([id]) => FEATURE_BY_ID.has(id));
  if (answered.length < 2) return out;
  const prior = initStateFrom(diseases);
  for (const [skip] of answered) {
    let s = prior;
    for (const [id, present] of answered) if (id !== skip) s = updatePosterior(s, diseases, id, present);
    for (const id of ids) {
      const p = s.posteriors[id] ?? 0;
      out[id].low = Math.min(out[id].low, p);
      out[id].high = Math.max(out[id].high, p);
    }
  }
  return out;
}

/** The posterior replayed from the priors with every recorded finding except `skip`. */
export function posteriorWithout(state: PaneState, diseases: DiseaseNode[], skip: string): Record<string, number> {
  let s = initStateFrom(diseases);
  for (const [id, present] of Object.entries(state.answered)) {
    if (id !== skip && FEATURE_BY_ID.has(id)) s = updatePosterior(s, diseases, id, present);
  }
  return s.posteriors;
}

/**
 * The examination-sign and decision-rule evidence lines, and for each evidence feature the
 * hypotheses' probability without it → with it (leave-one-out replay through the same engine,
 * so the rule / component grouping is included).
 */
export function examEvidenceLines(
  state: PaneState, diseases: DiseaseNode[], nodes: DiseaseNode[], rec: RecordedEvidence | null | undefined,
): { lines: ExamEvidenceLine[]; moves: Record<string, Record<string, EvidenceMove>> } {
  const moves: Record<string, Record<string, EvidenceMove>> = {};
  const without = new Map<string, Record<string, number>>();
  for (const id of Object.keys(state.answered)) {
    if (!isEvidenceFeature(id) || !FEATURE_BY_ID.has(id)) continue;
    const before = posteriorWithout(state, diseases, id);
    without.set(id, before);
    for (const d of nodes) {
      (moves[d.id] ??= {})[id] = { from: before[d.id] ?? 0, to: state.posteriors[d.id] ?? 0 };
    }
  }
  const labelOf = new Map(diseases.map(d => [d.id, d.label]));
  const lines: ExamEvidenceLine[] = [];
  for (const item of rec ? evidenceItems(rec, state.answered) : []) {
    const out: ExamEvidenceLine['moves'] = [];
    const before = item.featureId ? without.get(item.featureId) : undefined;
    // A finding-level sign or rule (dehydration, ascites, fracture): the finding's own probability
    // from the reference pre-test probability first.
    if (item.pretest !== null && item.posttest !== null) out.push({ label: item.target, from: item.pretest, to: item.posttest });
    if (before) {
      // Its target diagnoses (the likeliest two), else the diagnoses it moved most (finding-level).
      const ids = item.targetIds.length
        ? [...item.targetIds].filter(id => labelOf.has(id)).sort((a, b) => (state.posteriors[b] ?? 0) - (state.posteriors[a] ?? 0)).slice(0, 2)
        : nodes.map(d => d.id).sort((a, b) => Math.abs((state.posteriors[b] ?? 0) - (before[b] ?? 0)) - Math.abs((state.posteriors[a] ?? 0) - (before[a] ?? 0))).slice(0, 2);
      for (const id of ids.slice(0, out.length ? 1 : 2)) out.push({ label: labelOf.get(id) ?? id, from: before[id] ?? 0, to: state.posteriors[id] ?? 0 });
    }
    lines.push({ item, moves: out });
  }
  return { lines, moves };
}

/** One evidence line as text: "Murphy's sign present — LR 2.8 (0.8–8.6) for Acute cholecystitis: Acute Cholecystitis 12 % → 28 %". */
export function examEvidenceText(line: ExamEvidenceLine): string {
  const { item } = line;
  const lr = item.lr === null ? 'LR not established' : `LR ${item.lrText}`;
  const moved = line.moves.map(m => `${m.label === item.target ? '' : `${m.label} `}${fmtPct(m.from)} → ${fmtPct(m.to)}`).join('; ');
  const risk = item.risk ? ` Risk: ${item.risk}.` : '';
  return `${item.label} — ${lr} for ${item.target}${moved ? `: ${moved}` : ''} [${item.effect}]${risk}`;
}

function initStateFrom(diseases: DiseaseNode[]): PaneState {
  const total = diseases.reduce((s, d) => s + d.prior, 0);
  return {
    posteriors: Object.fromEntries(diseases.map(d => [d.id, total > 0 ? d.prior / total : 0])),
    answered: {},
    iteration: 0,
  };
}

/**
 * Findings for the time-out: specific symptoms, signs and results (history items are context;
 * findings with a background rate above 5 % such as "severe pain" do not make a case complex)
 * that neither the leading diagnoses nor a coexisting state (sepsis, AKI, electrolyte disorders:
 * COEXISTING_DISEASE_IDS) explain. Raised creatinine, raised lactate or rigors in a septic patient
 * with perforated diverticulitis are explained by the accompanying state, not unexplained.
 */
export function timeOutUnexplained(state: PaneState, diseases: DiseaseNode[], nodes: DiseaseNode[]): string[] {
  const ids = new Set(nodes.map(d => d.id));
  const explainers = [...nodes, ...diseases.filter(d => COEXISTING_DISEASE_IDS.has(d.id) && !ids.has(d.id))];
  const input = buildReasoningInput(state, explainers);
  return unexplainedFindings(
    { ...input, findings: input.findings.filter(f => FEATURE_BY_ID.get(f.id)?.category !== 'history' && baseRate(f.id) <= TIME_OUT_MAX_BASE_RATE) },
    explainers.map(d => d.id),
  );
}

/**
 * True when the leader and the working diagnosis compete for the same evidence (shared rule,
 * diagnostic-reasoning adapter-rules.ts competesForEvidence; each PANE feature is its own evidence).
 */
export function competesForEvidence(input: ReasoningInput, leaderId: string, workingId: string): boolean {
  return sharedCompetesForEvidence(input, leaderId, workingId);
}

/**
 * True when the working diagnosis text already names `label` (one of its alternatives, every
 * word found): "Blunt abdominal trauma in pregnancy — suspected placental abruption" names
 * "Placental Abruption".
 */
export function namedInDiagnosis(label: string, workingText: string): boolean {
  return sharedNamedInDiagnosis(label, workingText);
}

/**
 * The shared premature-closure rules (adapter-rules.ts adapterClosureAlerts, iOS twin
 * DiagnosticReasoningRules.swift) over the PANE differential: diagnoses of the working diagnosis's
 * family (parent / child, e.g. inguinal hernia and incarcerated hernia) are compatible — never the
 * leader of a "the record favours X" alert, and a finding that favours one of them does not alert;
 * a leader that shares no evidence with a supported working diagnosis is a second condition; a
 * leader the working diagnosis already names does not alert; a single contradicting finding alerts
 * only at LR <= 0.2. The NEWS2 alert is unchanged (it may name a family member: "Consider
 * incarcerated hernia").
 */
export function webClosureAlerts(
  input: ReasoningInput, diseases: DiseaseNode[], workingNode: DiseaseNode | null, workingLabel: string, news2: number[],
): ClosureAlert[] {
  return adapterClosureAlerts(input, {
    workingId: workingNode?.id ?? null,
    workingText: workingLabel,
    familyIds: workingNode ? familyOf(workingNode, diseases) : new Set<string>(),
    news2Series: news2,
  });
}

/** Everything the panel shows. Pure; call it again whenever the record changes. */
export function buildDiagnosticReasoning(req: ReasoningRequest): DiagnosticReasoning {
  const ranked = rankedDiseases(req.state, req.diseases);
  const top = ranked.slice(0, REASONING_TOP_K);
  const workingNode = resolveWorkingNode(req.diseases, req.working, req.state);
  const nodes = workingNode && !top.some(d => d.id === workingNode.id) ? [...top, workingNode] : top;
  const input = buildReasoningInput(req.state, nodes);
  const explanations = nodes.map(d => explain(input, d.id));

  // Discriminate the top 3, or the top 2 and the working diagnosis when it is outside them.
  const discNodes = workingNode && !top.some(d => d.id === workingNode.id) ? [...top.slice(0, 2), workingNode] : top;
  const discriminators = paneDiscriminators(req.state, req.diseases, discNodes);

  const closureAlerts = req.working
    ? webClosureAlerts(input, req.diseases, workingNode, req.working.label, req.news2Series)
    : [];

  const visits = req.longitudinal?.visits ?? [];
  const history = sameComplaintHistory(visits, req.currentComplaint ?? '');
  const timeOut = diagnosticTimeOut({
    // Specific symptoms, signs and results only: history items (risk factors, medicines) are
    // context, and common non-specific findings (background rate above 5 %: "severe pain", "pain
    // worse on movement") do not make a case complex.
    unexplainedFindings: timeOutUnexplained(req.state, req.diseases, nodes),
    priorVisitsSameComplaint: history.count,
    priorDiagnosesSameComplaint: history.diagnoses,
  });

  const longitudinal = req.longitudinal ? longitudinalPatterns(req.longitudinal) : null;
  const pancreatitisVisits = visits.filter(v => /pancreatitis/i.test(v.diagnosis ?? '')).length;
  const zebraText = joinClauses([
    req.recordText,
    ...derivedLabTerms(req.labs),
    pancreatitisVisits >= 1 ? 'History of pancreatitis (earlier visit)' : null,
  ]);
  const topIds = new Set(top.map(d => d.id));
  const zebras = matchZebras(zebraText).map(z => ({ ...z, inDifferential: z.paneId !== null && topIds.has(z.paneId) }));
  const exam = examEvidenceLines(req.state, req.diseases, nodes, req.evidence);

  return {
    version: DIAGNOSTIC_REASONING_VERSION,
    hypotheses: input.hypotheses,
    explanations,
    workingId: workingNode?.id ?? null,
    discriminators,
    closureAlerts,
    timeOut,
    zebras,
    longitudinal,
    findingsUsed: input.findings.filter(f => f.status !== 'unknown').length,
    ranges: leaveOneOutRanges(req.state, req.diseases, nodes.map(d => d.id)),
    examEvidence: exam.lines,
    evidenceMoves: exam.moves,
  };
}

// ── Record helpers (the dashboard and the clinval runner build the same inputs) ─────────────

export interface ReasoningRecordInput {
  chiefComplaint?: string;
  narrative: string[];
  symptoms?: string[];
  comorbidities?: string[];
  medications?: string[];
  surgicalHistory?: string[];
  investigationResults?: Record<string, string>;
  /** Herbs, teas, bush remedies and supplements the patient takes (supplement history). */
  supplements?: string[];
}

/** The whole record as clauses, for the zebra check (negation-aware matching). */
export function reasoningRecordText(r: ReasoningRecordInput): string {
  return joinClauses([
    r.chiefComplaint ?? null,
    ...r.narrative,
    ...(r.symptoms ?? []),
    ...(r.comorbidities ?? []),
    ...(r.medications ?? []),
    ...(r.surgicalHistory ?? []),
    ...Object.entries(r.investigationResults ?? {}).map(([k, v]) => `${k}: ${v}`),
    (r.supplements ?? []).length ? `Herbal products and supplements taken: ${(r.supplements ?? []).join(', ')}` : null,
  ]);
}

/** Numeric results ("Haemoglobin" → "8.2 g/dL") as values for derivedLabTerms. */
export function numericLabs(results: Record<string, string>): LabValue[] {
  const out: LabValue[] = [];
  for (const [name, text] of Object.entries(results)) {
    const m = /(-?\d+(?:\.\d+)?)/.exec(text ?? '');
    if (m) out.push({ name, value: Number(m[1]) });
  }
  return out;
}

export interface VitalsReading {
  respiratoryRate?: number | null;
  spo2?: number | null;
  onOxygen?: boolean | null;
  systolicBP?: number | null;
  heartRate?: number | null;
  temperatureCelsius?: number | null;
  avpu?: string | null;
}

/** NEWS2 totals of readings in the order given (readings with no value are skipped). */
export function news2Series(readings: VitalsReading[], useSpO2Scale2 = false): number[] {
  const out: number[] = [];
  for (const r of readings) {
    const has = [r.respiratoryRate, r.spo2, r.systolicBP, r.heartRate, r.temperatureCelsius].some(v => typeof v === 'number' && Number.isFinite(v));
    if (!has) continue;
    const avpu = r.avpu && ['A', 'C', 'V', 'P', 'U'].includes(r.avpu) ? (r.avpu as News2Avpu) : null;
    out.push(evaluateNews2({
      respiratoryRate: r.respiratoryRate ?? null, spo2: r.spo2 ?? null, onOxygen: r.onOxygen ?? null,
      useSpO2Scale2, systolicBP: r.systolicBP ?? null, heartRate: r.heartRate ?? null,
      temperatureCelsius: r.temperatureCelsius ?? null, avpu,
    }).total);
  }
  return out;
}

/** Flat lines for the clinical-validation harness (source prefix, e.g. 'web.reasoning'). */
export function reasoningHarnessLines(r: DiagnosticReasoning, prefix: string): { source: string; text: string }[] {
  const out: { source: string; text: string }[] = [];
  for (const a of r.closureAlerts) out.push({ source: `${prefix}.alert`, text: a.text });
  for (const z of r.zebras) out.push({ source: `${prefix}.zebra`, text: `${z.condition} — ${z.explains} (${z.matched.join(' + ')})` });
  for (const d of r.discriminators) {
    out.push({ source: `${prefix}.discriminator`, text: `${d.probe.label} [${d.probe.cost}] — ${d.why}` });
  }
  for (const reason of r.timeOut.reasons) out.push({ source: `${prefix}.timeout`, text: reason });
  for (const e of r.explanations) {
    for (const x of e.forFindings) out.push({ source: `${prefix}.for`, text: `${e.label}: ${x.label}` });
    for (const x of e.against) out.push({ source: `${prefix}.against`, text: `${e.label}: ${x.label}` });
    for (const x of e.missing) out.push({ source: `${prefix}.missing`, text: `${e.label}: ${x.label}${x.documented ? ' (documented absent)' : ' (not recorded)'}` });
    for (const x of e.doesntFit) out.push({ source: `${prefix}.doesntfit`, text: `${e.label}: ${x.label}${x.favours ? ` (favours ${x.favours})` : ''}` });
  }
  for (const line of r.examEvidence ?? []) out.push({ source: `${prefix}.evidence`, text: examEvidenceText(line) });
  if (r.longitudinal) {
    for (const x of r.longitudinal.recurring) out.push({ source: `${prefix}.longitudinal`, text: `Recurring: ${x.problem} × ${x.count}` });
    for (const x of r.longitudinal.trends) out.push({ source: `${prefix}.longitudinal`, text: x.text });
    for (const x of r.longitudinal.unheld) out.push({ source: `${prefix}.longitudinal`, text: `${x.diagnosis} (${x.date}) revised to ${x.replacedBy} (${x.replacedOn})` });
  }
  return out;
}

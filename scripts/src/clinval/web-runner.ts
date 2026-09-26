/**
 * Clinical validation — web runner.
 *
 * Runs one vignette through the web consultation engines, calling the same pure functions the
 * dashboard calls, with the arguments the dashboard builds (file references in each block):
 *
 *   PANE differential   ChiefComplaintStrip / HpiTab.reseedPane: applyModifiers (with pregnancy
 *                       context) → initPaneState → extractFeaturesFromSocrates(cc, answers,
 *                       paneContextFromConsultation(AppContext)) → updatePosterior → topDiagnoses(3)
 *   Symptom inference   HpiTab / ExaminationTab: computeRankedDifferentials({symptoms, symptomDetails, age, sex})
 *   Passive ranking     AssessmentTab: computeRankedDifferentials({symptoms, symptomDetails: {}, examText})
 *   Triage / acuity     AppContext: adaptiveTriage(triageInput); matchPathways (usePathway)
 *   Scale suggestions   AssessmentTab / ScalesTab: getCdsSuggestions(ctx)
 *   Clinical prompts    ClinicalPromptsStrip: computeClinicalPrompts(input)
 *   Management          AssessmentTab ManagementPanel (all phases) and PlanTab buildPlanText
 *                       (lib/plan-builder.ts: confirmed diagnosis → resolveProtocol, adapted to the
 *                       patient on record, phases filtered by the detected dx variant);
 *                       PrescriptionsTab protocol medicines; suggested (seeded) investigations
 *                       (SuggestedInvestigationsPanel → plan-builder.ts seedInvestigations: the
 *                       confirmed diagnosis, else the PANE leader only, adapted to the patient)
 *   Calculators         ScalesTab (clinical-scales.ts) and ClinicalScoresPanel (clinical-scores.ts)
 *   Reasoning           AssessmentTab DiagnosticReasoningPanel: buildDiagnosticReasoning over the same
 *                       PANE state, the confirmed diagnosis, the NEWS2 series of the vignette's
 *                       vitals (oldest first) and the record text (lib/diagnostic-reasoning.ts)
 *   What's missing      Home WhatsMissingStrip: buildWhatsMissing (lib/whats-missing-web.ts) over the
 *                       same consultation, PANE state and recommended / recorded scores
 *
 * The dashboard code itself is not modified or wrapped; if a call site changes, update the
 * mirror here (the vitest suite checks the signatures still line up).
 */

import {
  DISEASES, FEATURES, adaptProtocolForPatient, applyModifiers, decisionSummaryLines, initPaneState, topDiagnoses, updatePosterior,
} from '../../../lib/pane-engine/src/index';
import type { ManagementProtocol, PaneState } from '../../../lib/pane-engine/src/index';
import { RULES_VERSION, adaptiveTriage, matchPathways } from '../../../lib/triage-engine/src/index';
import type { AdaptiveTriageInput } from '../../../lib/triage-engine/src/index';
import { extractFeaturesFromSocrates, paneContextFromConsultation } from '../../../artifacts/dashboard/src/lib/socrates-to-features';
import type { ConsultationSnapshot } from '../../../artifacts/dashboard/src/lib/socrates-to-features';
import { computeRankedDifferentials } from '../../../artifacts/dashboard/src/lib/symptom-inference';
import { getCdsSuggestions } from '../../../artifacts/dashboard/src/lib/clinical-cds';
import type { CdsContext } from '../../../artifacts/dashboard/src/lib/clinical-cds';
import { detectDxVariants } from '../../../artifacts/dashboard/src/lib/dx-variants';
import { managementPanelSource } from '../../../artifacts/dashboard/src/lib/management-panel-source';
import {
  buildPlanSections, planPatientContext, planProtocolFor, safetyLines, seedInvestigations,
} from '../../../artifacts/dashboard/src/lib/plan-builder';
import type { PlanPatientContext } from '../../../lib/pane-engine/src/index';
import { computeClinicalPrompts } from '../../../artifacts/dashboard/src/lib/clinical-inference';
import type { InferenceInput as PromptInput } from '../../../artifacts/dashboard/src/lib/clinical-inference';
import {
  scoreTokyoCholangitis, scoreTokyoCholecystitis,
} from '../../../artifacts/dashboard/src/lib/clinical-scores';
import type { ExtractedLabs, ScoringVitals } from '../../../artifacts/dashboard/src/lib/clinical-scores';
import { tokyoCholangitisAutoFill, tokyoCholecystitisAutoFill } from '../../../artifacts/dashboard/src/lib/tg18-autofill';
import type { Tg18Record } from '../../../artifacts/dashboard/src/lib/tg18-autofill';
import {
  alvaradoScore, interpretAlvarado, interpretTg18Cholangitis, tg18CholangitisGrade,
} from '../../../artifacts/dashboard/src/lib/clinical-scales';
import {
  buildDiagnosticReasoning, news2Series, numericLabs, reasoningHarnessLines, reasoningRecordText,
} from '../../../artifacts/dashboard/src/lib/diagnostic-reasoning';
import { buildDecisionSupport, resultPosteriorShifts, shiftText, withRecordedScore } from '../../../artifacts/dashboard/src/lib/decision-support';
import type { DecisionConsultation } from '../../../artifacts/dashboard/src/lib/decision-support';
import { buildWhatsMissing } from '../../../artifacts/dashboard/src/lib/whats-missing-web';
import { withSignState } from '../../../artifacts/dashboard/src/lib/exam-evidence-features';
import type { MissingConsultation } from '../../../artifacts/dashboard/src/lib/whats-missing-web';
import { whatsMissingLines } from '../../../lib/pane-engine/src/index';
import type { DxItem, EngineOutputs, Level, ScoreForm, SourcedText, Vignette } from './types';

/** CDS scaleKey → canonical score key. Unlisted keys are reported as 'web:<key>'. */
export const WEB_SCALE_TO_CANONICAL: Record<string, string> = {
  alvarado: 'alvarado', tg18Cholangitis: 'tg18-cholangitis', tg18Cholecystitis: 'tg18-cholecystitis', asgeCbd: 'asge-cbd', glasgowBlatchford: 'glasgow-blatchford',
  preRockall: 'rockall', qsofa: 'qsofa', news2: 'news2', bisap: 'bisap', ranson: 'ranson', asa: 'asa', rcri: 'rcri',
  caprini: 'caprini', cfs: 'cfs', childPugh: 'child-pugh', meld: 'meld', wellsPe: 'wells-pe', wellsDvt: 'wells-dvt',
  curb65: 'curb65', must: 'must', ppossuml: 'p-possum', forrest: 'forrest', clavienDindo: 'clavien-dindo', gcs: 'gcs',
  heart: 'heart', abcd2: 'abcd2', stopBang: 'stop-bang', ecog: 'ecog', chads2Vasc: 'cha2ds2-vasc', hasBled: 'has-bled',
};

const ORGANS = ['cardiovascular', 'neurological', 'respiratory', 'renal', 'hepatic', 'haematological'] as const;
type Organ = typeof ORGANS[number];

function bool(form: ScoreForm | undefined, key: string): boolean {
  return form?.[key] === true;
}
function num(form: ScoreForm | undefined, key: string): number {
  const v = form?.[key];
  return typeof v === 'number' ? v : 0;
}
function organs(form: ScoreForm | undefined): Organ[] {
  const v = form?.organDysfunction;
  return Array.isArray(v) ? v.filter((o): o is Organ => (ORGANS as readonly string[]).includes(o)) : [];
}

function latestVitals(v: Vignette) {
  const list = [...(v.inputs.vitals ?? [])].sort((a, b) => (a.minutesAgo ?? 0) - (b.minutesAgo ?? 0));
  return list[0];
}

function labValue(v: Vignette, analyte: string): number | null {
  const lab = (v.inputs.labs ?? []).find(l => l.analyte === analyte && typeof l.value === 'number');
  return lab?.value ?? null;
}

/** AppContext `extractedLabs` (clinical-scores.ts units). */
function extractedLabs(v: Vignette): ExtractedLabs {
  return {
    wbc: labValue(v, 'wbc'), haemoglobin: labValue(v, 'haemoglobin') !== null ? labValue(v, 'haemoglobin')! * 10 : null,
    platelets: labValue(v, 'platelets'), inr: labValue(v, 'inr'), crp: labValue(v, 'crp'),
    bilirubin_total: labValue(v, 'bilirubin'), alp: labValue(v, 'alp'), ggt: labValue(v, 'ggt'),
    ast: labValue(v, 'ast'), alt: labValue(v, 'alt'), albumin: labValue(v, 'albumin'),
    urea: labValue(v, 'urea'), creatinine: labValue(v, 'creatinine'), glucose: labValue(v, 'glucose'),
    amylase: labValue(v, 'amylase'), lipase: labValue(v, 'lipase'), source: 'manual',
  };
}

function scoringVitals(v: Vignette): ScoringVitals {
  const lv = latestVitals(v);
  return {
    temperatureC: lv?.temperatureC ?? null, heartRate: lv?.heartRate ?? null,
    respiratoryRate: lv?.respiratoryRate ?? null, systolicBp: lv?.systolicBp ?? null, spo2: lv?.spo2 ?? null,
  };
}

/** AppContext `vitals` (string fields). */
function vitalStrings(v: Vignette): Record<string, string> {
  const lv = latestVitals(v);
  const s = (x: number | undefined) => (x === undefined ? '' : String(x));
  return {
    systolicBp: s(lv?.systolicBp), diastolicBp: s(lv?.diastolicBp), heartRate: s(lv?.heartRate),
    temperatureC: s(lv?.temperatureC), respiratoryRate: s(lv?.respiratoryRate), spo2: s(lv?.spo2),
    glucoseMmol: s(lv?.glucoseMmol),
    // VitalsState (vitals-state.ts): NEWS2 ACVPU and air/oxygen.
    avpu: lv?.avpu ?? '', onSupplementalO2: lv?.onSupplementalO2 === true ? 'o2' : lv?.onSupplementalO2 === false ? 'air' : '',
  };
}

/** AppContext triageInput.examText: the examination fields joined (skin / other are written there too). */
function examFields(v: Vignette): string {
  const e = v.inputs.exam ?? {};
  return [e.general, e.cardiovascular, e.respiratory, e.abdomen, e.neuro, e.msk, e.skin, e.other].filter(Boolean).join('\n');
}

/** AppContext triageInput.resultReports: received radiology / ECG results. */
function resultReports(v: Vignette): string[] {
  return (v.inputs.imaging ?? []).map(i => `${i.modality} ${i.region ?? ''}: ${i.result}`);
}

/** ConsultationViewData-style "name → result" map used by CDS and clinical prompts. */
function investigationResults(v: Vignette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of v.inputs.labs ?? []) {
    out[l.name] = l.resultText ?? `${l.value ?? ''} ${l.unit ?? ''}`.trim();
  }
  for (const i of v.inputs.imaging ?? []) out[i.name] = i.result;
  return out;
}

/** ChiefComplaintStrip SOCRATES answers. Explicit platform.web.socratesAnswers win. */
function socratesAnswers(v: Vignette): Record<string, string> {
  const explicit = v.inputs.platform?.web?.socratesAnswers;
  if (explicit) return explicit;
  const s = v.inputs.socrates ?? {};
  const j = (a?: string[]) => (a ?? []).join(', ');
  return {
    onset: j(s.onset), site: j(s.site), character: j(s.character), radiation: j(s.radiation),
    associated: j(s.associations), timing: j(s.timing), triggers: j(s.exacerbating), relief: j(s.relieving),
    severity: j(s.severity),
  };
}

/**
 * ExaminationTab chips plus the Exam-step sign chips (inputs.examSigns → examFindings.signs, as
 * ExamSignsPanel writes them).
 */
function vignetteExamFindings(v: Vignette): Record<string, string[]> {
  let out: Record<string, string[]> = { ...(v.inputs.platform?.web?.examFindings ?? {}) };
  for (const [id, state] of Object.entries(v.inputs.examSigns ?? {})) out = withSignState(out, id, state);
  return out;
}

/**
 * The calculator values the clinician records for decision support ("Use in decision support"):
 * the Alvarado and TG18 cholecystitis forms the harness computes, and every form with a `total`.
 * The PANE mirror and the decision-support mirror read the same record (clinical_scores).
 */
function recordedScoreValues(v: Vignette): Record<string, number> {
  const forms = v.inputs.scoreForms ?? {};
  const out: Record<string, number> = {};
  const alv = forms['alvarado'];
  if (alv) {
    out.alvarado = alvaradoScore({
      migratoryPain: bool(alv, 'migration'), anorexia: bool(alv, 'anorexia'), nausea: bool(alv, 'nauseaVomiting'),
      rifTenderness: bool(alv, 'rifTenderness'), rebound: bool(alv, 'rebound'), fever: bool(alv, 'temperatureRaised'),
      wbcAbove10: bool(alv, 'wbcAbove10'), leftShift: bool(alv, 'neutrophilia'),
    });
  }
  const tgk = forms['tg18-cholecystitis'];
  if (tgk) {
    const sv = scoringVitals(v);
    const full = scoreTokyoCholecystitis({
      murphy_sign: bool(tgk, 'localSigns'),
      ruq_pain_mass_tenderness: bool(tgk, 'localSigns') || bool(tgk, 'palpableTenderRUQMass'),
      fever: bool(tgk, 'systemicSigns') && (sv.temperatureC ?? 0) >= 38,
      us_wall_thickening: bool(tgk, 'imagingCharacteristic'),
      palpable_tender_mass: bool(tgk, 'palpableTenderRUQMass'),
      duration_over_72h: bool(tgk, 'durationOver72h'),
      marked_local_inflammation: bool(tgk, 'markedLocalInflammation'),
      organ_dysfunction: organs(tgk),
    }, extractedLabs(v), sv);
    if (full.score >= 1) out['tg18-cholecystitis'] = full.score;
  }
  for (const key of Object.keys(forms)) {
    const total = forms[key]?.total;
    if (typeof total === 'number') out[key] = total;
  }
  return out;
}

function recordedClinicalScores(v: Vignette): Record<string, unknown> {
  let scores: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(recordedScoreValues(v))) scores = withRecordedScore(scores, key, value, 'vignette');
  return scores;
}

/** The AppContext fields paneContextFromConsultation reads, filled from the vignette record. */
function consultationSnapshot(v: Vignette): Partial<ConsultationSnapshot> {
  const inp = v.inputs;
  const web = inp.platform?.web ?? {};
  const lv = latestVitals(v);
  return {
    age: String(inp.patient.ageYears), sex: webSex(v), pregnancyPossible: pregnancyPossible(v),
    symptoms: web.symptoms ?? [], symptomDetails: web.symptomDetails ?? {},
    vitals: { ...vitalStrings(v), avpu: lv?.avpu ?? '' },
    durationDays: web.durationDays === undefined || web.durationDays === null ? '' : String(web.durationDays),
    isPostOp: inp.encounter.isPostOp ?? false,
    postOpDays: inp.encounter.postOpDays === undefined || inp.encounter.postOpDays === null ? '' : String(inp.encounter.postOpDays),
    comorbidities: inp.comorbidities ?? [], medications: (inp.medications ?? []).map(m => m.drug),
    surgicalHistory: inp.surgicalHistory ?? [], toxicHabits: web.toxicHabits ?? [],
    investigationResults: investigationResults(v), examFindings: vignetteExamFindings(v),
    clinicalScores: recordedClinicalScores(v),
    freeText: inp.chiefComplaint, hpiNotes: inp.hpi ?? '',
    examGeneral: inp.exam?.general ?? '', examCardio: inp.exam?.cardiovascular ?? '', examResp: inp.exam?.respiratory ?? '',
    examAbdomen: inp.exam?.abdomen ?? '', examNeuro: inp.exam?.neuro ?? '', examExtremities: inp.exam?.msk ?? '',
    examNotes: { other: inp.exam?.other ?? '', skin: inp.exam?.skin ?? '' },
  };
}

function webSex(v: Vignette): 'male' | 'female' | 'unknown' {
  return v.inputs.patient.sex === 'unspecified' ? 'unknown' : v.inputs.patient.sex;
}

function pregnancyPossible(v: Vignette): boolean {
  const p = v.inputs.patient;
  const st = p.pregnancy?.status;
  return p.sex === 'female' && (st === 'pregnant' || st === 'unknown');
}

function dxList(items: { name: string; id?: string; icd10?: string; score?: number }[]): DxItem[] {
  return items.map((d, i) => ({ rank: i + 1, ...d }));
}

const LEVEL_FROM_ACTION: Record<string, Level> = {
  emergency_now: 'emergency', same_day_call: 'urgent', priority_24_48h: 'priority', routine_booking: 'routine', admin_review: 'routine',
};

/**
 * PlanTab "Insert suggested plan" (lib/plan-builder.ts buildPlanText), reduced to the plan lines
 * (surgeon/admission header omitted): variant prefix, patient-specific safety checks, the adapted
 * protocol steps, investigations and referral.
 */
function planLines(protocol: ManagementProtocol, patient: PlanPatientContext, allowedPhases?: string[], planPrefix?: string): string[] {
  const sec = buildPlanSections(protocol, patient, { allowedPhases, planPrefix });
  const lines: string[] = [...sec.prefix, ...safetyLines(sec.safety)];
  for (const p of sec.phases) for (const step of p.steps) lines.push(`[${p.phase}] ${step}`);
  for (const inv of sec.investigations) lines.push(`Investigation: ${inv.label} (${inv.urgency})`);
  if (sec.referral) lines.push(`Referral: ${sec.referral}`);
  return lines;
}

/** usePlanPatientContext: the AppContext fields the plan-safety filters read. */
function webPlanPatient(v: Vignette, age: number, sex: string, pregnancyPossibleTick: boolean, assessment: string): PlanPatientContext {
  const inp = v.inputs;
  const egfr = (inp.labs ?? []).find(l => /egfr|creatinine clearance|crcl/i.test(`${l.analyte} ${l.name}`) && typeof l.value === 'number');
  return planPatientContext({
    age, sex, pregnancyPossible: pregnancyPossibleTick,
    allergies: (inp.allergies ?? []).map(a => (a.reaction ? `${a.name} (${a.reaction})` : a.name)),
    medications: (inp.medications ?? []).map(m => m.drug),
    comorbidities: inp.comorbidities ?? [],
    hpiNotes: [inp.chiefComplaint, inp.hpi].filter(Boolean).join('. '),
    surgicalHistory: inp.surgicalHistory ?? [],
    assessment,
    extractedLabs: egfr ? { egfr: egfr.value ?? null } : {},
  });
}

export function runWeb(v: Vignette): EngineOutputs {
  const inp = v.inputs;
  const web = inp.platform?.web ?? {};
  const notes: string[] = [];
  const age = inp.patient.ageYears;
  const sex = webSex(v);
  const cc = web.ccTemplate ?? inp.chiefComplaint;
  if (!web.ccTemplate) notes.push('platform.web.ccTemplate not set: chief complaint text used as the CC template name');
  const symptoms = web.symptoms ?? [];
  if (!web.symptoms) notes.push('platform.web.symptoms not set: web symptom chips empty');
  const symptomDetails = web.symptomDetails ?? {};
  const examText = [inp.exam?.abdomen, inp.exam?.general, inp.exam?.cardiovascular, inp.exam?.respiratory,
    inp.exam?.other, inp.exam?.skin, inp.hpi].filter(Boolean).join(' ');
  const differentials: Record<string, DxItem[]> = {};

  // ── PANE (ChiefComplaintStrip / HpiTab.reseedPane) ─────────────────────────
  const diseases = applyModifiers(DISEASES, age, sex, undefined, { pregnancyPossible: pregnancyPossible(v) });
  let pane: PaneState = initPaneState(diseases);
  const features = extractFeaturesFromSocrates(cc, socratesAnswers(v), paneContextFromConsultation(consultationSnapshot(v)));
  const featureIds = new Set(FEATURES.map(f => f.id));
  const unknownFeatures: string[] = [];
  for (const [featureId, present] of Object.entries(features)) {
    if (featureIds.has(featureId)) pane = updatePosterior(pane, diseases, featureId, present);
    else unknownFeatures.push(featureId);
  }
  for (const [featureId, present] of Object.entries(web.paneAnswers ?? {})) {
    if (featureIds.has(featureId)) pane = updatePosterior(pane, diseases, featureId, present);
    else notes.push(`paneAnswers: unknown feature '${featureId}'`);
  }
  if (unknownFeatures.length) notes.push(`PANE: extracted features not in FEATURES (ignored, as HpiTab does): ${unknownFeatures.join(', ')}`);
  notes.push(`PANE features applied: ${Object.keys(features).filter(f => featureIds.has(f)).join(', ') || '(none)'}`);
  const paneTop = topDiagnoses(pane, diseases, 3);
  differentials['web.pane'] = dxList(paneTop.map(r => ({
    name: r.disease.label, id: r.disease.id, icd10: r.disease.icd10, score: Math.round(r.probability * 1000) / 1000,
  })));

  // ── Symptom inference (HpiTab / ExaminationTab) and passive ranking (AssessmentTab) ─
  const ranked = computeRankedDifferentials({ symptoms, symptomDetails, age, sex });
  differentials['web.symptomInference'] = dxList(ranked.slice(0, 5).map(r => ({ name: r.name, id: r.id, score: r.confidence })));
  const passive = computeRankedDifferentials({ symptoms, symptomDetails: {}, examText });
  differentials['web.passive'] = dxList(passive.slice(0, 5).map(r => ({ name: r.name, id: r.id, score: r.confidence })));

  // ── Triage (AppContext) ────────────────────────────────────────────────────
  const lv = latestVitals(v);
  const triageInput: AdaptiveTriageInput = {
    age, sex, symptoms, symptomDetails,
    freeText: [inp.chiefComplaint, inp.hpi].filter(Boolean).join('. '),
    comorbidities: inp.comorbidities ?? [],
    surgicalHistory: inp.surgicalHistory ?? [],
    medications: (inp.medications ?? []).map(m => m.drug),
    allergies: (inp.allergies ?? []).map(a => a.name),
    toxicHabits: web.toxicHabits ?? [],
    vitalSigns: {
      systolicBp: lv?.systolicBp ?? null, diastolicBp: lv?.diastolicBp ?? null, heartRate: lv?.heartRate ?? null,
      temperatureC: lv?.temperatureC ?? null, respiratoryRate: lv?.respiratoryRate ?? null, spo2: lv?.spo2 ?? null,
      glucoseMmol: lv?.glucoseMmol ?? null,
    },
    durationDays: web.durationDays ?? null,
    painScore: web.painScore ?? null,
    isPostOp: inp.encounter.isPostOp ?? false,
    postOpDays: inp.encounter.postOpDays ?? null,
    pregnancyPossible: pregnancyPossible(v),
    // AppContext: the rest of the record for the emergency-recognition layer.
    examText: examFields(v),
    investigationResults: investigationResults(v),
    resultReports: resultReports(v),
    diagnosis: { text: inp.confirmedDiagnosis?.assessmentText ?? inp.confirmedDiagnosis?.name ?? '', icd10: [inp.confirmedDiagnosis?.icd10 ?? null] },
    avpu: lv?.avpu ?? null,
    onSupplementalO2: lv?.onSupplementalO2 ?? null,
  };
  const triage = adaptiveTriage(triageInput);
  differentials['web.triageSurgical'] = dxList(triage.surgicalMatches.slice(0, 5).map(m => ({
    name: m.label, id: m.id, icd10: m.icd10[0]?.code,
  })));
  const emergencyLevel = {
    level: LEVEL_FROM_ACTION[triage.recommendedAction] ?? null,
    raw: `acuity=${triage.acuity}, action=${triage.recommendedAction}, score=${triage.score}`,
    source: 'web.triage',
  };
  const alarms: EngineOutputs['alarms'] = [];
  const redFlags: SourcedText[] = [];
  for (const f of triage.vitalRedFlags) {
    if (f.severity === 'urgent') alarms.push({ source: 'web.triage.vitalRedFlags', title: f.label, detail: f.value, severity: f.severity });
  }
  if (triage.recommendedAction === 'emergency_now') {
    alarms.push({ source: 'web.triage.emergency', title: 'Emergency now', detail: triage.safetyMessage, severity: 'urgent' });
  }
  for (const r of triage.reasons) redFlags.push({ source: 'web.triage.reasons', text: r });
  // AppHeader: first recorded allergy with a "+N" count, always visible during the consultation.
  const allergyNames = (inp.allergies ?? []).map(a => a.name);
  if (allergyNames.length) {
    redFlags.push({
      source: 'web.header.allergies',
      text: `Allergy: ${allergyNames[0]}${allergyNames.length > 1 ? ` +${allergyNames.length - 1}` : ''}`,
    });
  }
  for (const p of triage.activePathways) redFlags.push({ source: 'web.triage.pathways', text: `${p.title} (${p.severity})` });

  // ── Confirmed diagnosis → protocol, dx variant, CDS ────────────────────────
  const dx = inp.confirmedDiagnosis;
  const icd = dx?.icd10 ?? null;
  const assessment = dx?.assessmentText ?? dx?.name ?? '';
  // AssessmentTab ManagementPanel (managementPanelSource): the confirmed diagnosis — locked working
  // diagnosis (paneDiseaseId) or recorded ICD-10 code — else the PANE top when ≥ 0.20.
  const panelSource = managementPanelSource(
    dx?.paneDiseaseId ? { diseaseId: dx.paneDiseaseId, icdCode: icd, locked: true } : null,
    icd ? [icd] : [],
    paneTop[0] ? { diseaseId: paneTop[0].disease.id, probability: paneTop[0].probability } : null,
  );
  const assessDiseaseId = panelSource.source === 'pane' ? panelSource.diseaseId : null;
  // usePlanPatientContext (PlanTab, ManagementPanel, PrescriptionsTab): the plan is adapted to it.
  const planPatient = webPlanPatient(v, age, sex, pregnancyPossible(v), assessment);
  // ManagementPanel: resolveProtocol(diseaseId, icd), adapted to the patient on record.
  const panelBase = planProtocolFor(panelSource.diseaseId, panelSource.icdCode);
  const panelProtocol = panelBase ? adaptProtocolForPatient(panelBase, planPatient) : null;
  // PlanTab / PrescriptionsTab: the CONFIRMED diagnosis only (confirmedPlanSource: locked working
  // diagnosis, else the recorded ICD-10 code) → resolveProtocol.
  // (diagnosis-suggestion.ts confirmedPlanSource, inlined: that module imports the dashboard's '@/'
  // alias. Recorded ICD code first, else the locked working diagnosis's code; disease id from the
  // locked working diagnosis.) Before 2026-09-25 this mirror still used the PANE leader at ≥ 0.85,
  // which PlanTab stopped doing in cd375f0.
  const planSource = { diseaseId: dx?.paneDiseaseId ?? null, icdCode: icd };
  const planProtocol = planProtocolFor(planSource.diseaseId, planSource.icdCode);
  notes.push(`AssessmentTab ManagementPanel protocol: ${panelProtocol?.diseaseId ?? '(none)'}${assessDiseaseId ? ' (from PANE top)' : ' (from the confirmed diagnosis)'}`);
  notes.push(`PlanTab protocol: ${planProtocol?.diseaseId ?? '(none)'} (from the confirmed diagnosis)`);
  const variant = detectDxVariants(assessment, planSource.icdCode ?? undefined, planSource.diseaseId ?? undefined);
  const dxVariant = { value: variant?.detectedVariant?.id ?? null, group: variant?.group.baseDiagnosis ?? null };

  const investigations: SourcedText[] = [];
  const management: SourcedText[] = [];
  if (planProtocol) {
    const sv = variant?.detectedVariant;
    for (const l of planLines(planProtocol, planPatient, sv?.allowedPhases, sv?.planPrefix)) management.push({ source: 'web.plan', text: l });
    const adapted = adaptProtocolForPatient(planProtocol, planPatient);
    for (const inv of adapted.investigations) {
      investigations.push({ source: 'web.plan.investigations', text: `${inv.label}${inv.conditional ? ` — ${inv.conditional}` : ''}` });
    }
    // PrescriptionsTab "Suggested — <protocol>" (adapted: withheld drugs are not offered).
    for (const m of adapted.medications ?? []) {
      management.push({ source: 'web.protocol.medications', text: `${m.drugName} ${m.dose} ${m.route} ${m.frequency} — ${m.indication}` });
    }
    for (const f of adapted.redFlags) redFlags.push({ source: 'web.protocol.redFlags', text: f });
    if (sv?.urgencyNote) redFlags.push({ source: 'web.dxVariant.urgencyNote', text: sv.urgencyNote });
  }
  if (panelProtocol) {
    for (const n of panelProtocol.safetyNotes) management.push({ source: 'web.managementPanel', text: `[for this patient] ${n.text}` });
    for (const s of panelProtocol.management) management.push({ source: 'web.managementPanel', text: `[${s.phase}] ${s.step}` });
    for (const p of panelProtocol.keyPoints) management.push({ source: 'web.managementPanel.keyPoints', text: p });
  }

  // Suggested investigations seeded from the diagnosis (SuggestedInvestigationsPanel →
  // plan-builder.ts seedInvestigations): the confirmed diagnosis, else the PANE leader (≥ 0.20,
  // managementPanelSource) — one diagnosis, adapted to the patient, no stat test from a diagnosis
  // that is only being considered. (Before 2026-09-25: stat/urgent tests of every top-3 protocol, raw.)
  const seed = seedInvestigations(panelSource, planPatient, {
    leader: paneTop[0] ? { diseaseId: paneTop[0].disease.id, probability: paneTop[0].probability } : null,
  });
  notes.push(`Seeded investigations: ${seed.protocol?.diseaseId ?? '(none)'}${seed.confirmed ? ' (confirmed)' : ' (leading differential)'}; ${seed.heldBack.length} stat test(s) held back`);
  for (const inv of seed.items) {
    investigations.push({
      source: 'web.pane.seeded',
      text: `${inv.label}${inv.caveat ? ` — ${inv.caveat}` : ''} (${seed.protocol?.diseaseId ?? ''})`,
    });
  }

  const cdsCtx: CdsContext = {
    symptoms, examFindings: vignetteExamFindings(v), vitals: vitalStrings(v), investigationResults: investigationResults(v),
    comorbidities: inp.comorbidities ?? [], assessment, rosFindings: {}, age: String(age), sex,
    isPostOp: inp.encounter.isPostOp ?? false, procedureData: {},
    workingDiagnosis: dx?.paneDiseaseId ? { diseaseId: dx.paneDiseaseId, source: 'clinician', locked: true } : undefined,
  };
  const cds = getCdsSuggestions(cdsCtx);
  const recommendedScores = cds.map(s => ({
    source: 'web.cds', score: WEB_SCALE_TO_CANONICAL[s.scaleKey] ?? `web:${s.scaleKey}`, raw: `${s.title} — ${s.triggerReason}`,
  }));

  // ── Clinical prompts (ClinicalPromptsStrip) ────────────────────────────────
  const promptInput: PromptInput = {
    age: String(age), sex, symptoms, comorbidities: inp.comorbidities ?? [], familyHistory: [],
    toxicHabits: web.toxicHabits ?? [], medications: (inp.medications ?? []).map(m => m.drug), medicationsText: '',
    pregnancyPossible: pregnancyPossible(v), ccEntries: [{ complaint: cc, answers: socratesAnswers(v) }],
    encounterType: inp.encounter.setting === 'emergency' ? 'major_emergency' : 'surgical_consult',
    examGeneral: inp.exam?.general ?? '', examAbdomen: inp.exam?.abdomen ?? '', examBreast: '',
    examCardio: inp.exam?.cardiovascular ?? '', examResp: inp.exam?.respiratory ?? '', examNeuro: inp.exam?.neuro ?? '',
    examExtremities: inp.exam?.msk ?? '', investigationResults: investigationResults(v),
    radiologyRequests: (inp.imaging ?? []).map(i => ({
      modality: i.modality, anatomicalRegion: i.region ?? '', resultReceived: true, resultNotes: i.result, indication: i.name,
    })),
    vitals: vitalStrings(v), assessment,
    // ClinicalPromptsStrip: HPI / free text, surgical history, allergies, ICD codes, post-op state,
    // other examination text (for the emergency layer and the peri-operative alerts).
    historyText: [inp.chiefComplaint, inp.hpi].filter(Boolean).join('. '),
    surgicalHistory: inp.surgicalHistory ?? [], allergies: (inp.allergies ?? []).map(a => a.name),
    icdCodes: icd ? [icd] : [], isPostOp: inp.encounter.isPostOp ?? false, postOpDays: inp.encounter.postOpDays ?? null,
    examOther: [inp.exam?.skin, inp.exam?.other].filter(Boolean).join('\n'),
  };
  for (const p of computeClinicalPrompts(promptInput)) {
    const text = `${p.finding}${p.diagnosis ? ` (${p.diagnosis})` : ''}: ${p.text}`;
    if (p.type === 'safety') {
      alarms.push({ source: 'web.clinicalPrompts.safety', title: p.finding, detail: p.text, severity: p.urgency });
    }
    redFlags.push({ source: `web.clinicalPrompts.${p.type}`, text });
    for (const a of p.actions) {
      if (a.addToInvestigations) investigations.push({ source: 'web.clinicalPrompts', text: a.addToInvestigations });
      if (a.addToPlan) management.push({ source: 'web.clinicalPrompts', text: a.addToPlan });
      if (!a.addToInvestigations && !a.addToPlan) management.push({ source: 'web.clinicalPrompts', text: a.text });
    }
  }

  // ── Calculators (ScalesTab: clinical-scales.ts; ClinicalScoresPanel: clinical-scores.ts) ─
  const scoreValues: EngineOutputs['scoreValues'] = [];
  const forms = inp.scoreForms ?? {};
  // Scores the clinician records for decision support ("Use in decision support" on the Scales step).
  const recorded: Record<string, number> = recordedScoreValues(v);
  const labs = extractedLabs(v);
  const sv = scoringVitals(v);
  const tempAtLeast38 = (sv.temperatureC ?? 0) >= 38;

  const alv = forms['alvarado'];
  if (alv) {
    const score = alvaradoScore({
      migratoryPain: bool(alv, 'migration'), anorexia: bool(alv, 'anorexia'), nausea: bool(alv, 'nauseaVomiting'),
      rifTenderness: bool(alv, 'rifTenderness'), rebound: bool(alv, 'rebound'), fever: bool(alv, 'temperatureRaised'),
      wbcAbove10: bool(alv, 'wbcAbove10'), leftShift: bool(alv, 'neutrophilia'),
    });
    const r = interpretAlvarado(score);
    recorded.alvarado = score;
    scoreValues.push({ score: 'alvarado', mode: 'calculator', source: 'web.scaleCalculator.alvarado', value: score, label: r.band });
    management.push({ source: 'web.scaleCalculator.alvarado', text: `${r.band}: ${r.action}` });
  }

  const tgc = forms['tg18-cholangitis'];
  if (tgc) {
    const org = organs(tgc);
    const g = tg18CholangitisGrade({
      // ScalesTab label: "High fever (temp ≥ 39°C)" — the TG18 Grade II fever criterion.
      fever: (sv.temperatureC ?? 0) >= 39 || bool(tgc, 'feverAtLeast39'),
      wbcAbnormal: bool(tgc, 'wbcAbnormal'), age, bilirubinHighGrade2: bool(tgc, 'bilirubinAtLeast5mgdl'),
      albuminLow: bool(tgc, 'albuminBelow07LLN'),
      organDysfunctionCv: org.includes('cardiovascular'), organDysfunctionCns: org.includes('neurological'),
      organDysfunctionResp: org.includes('respiratory'), organDysfunctionRenal: org.includes('renal'),
      organDysfunctionHepatic: org.includes('hepatic'), organDysfunctionHaem: org.includes('haematological'),
    });
    const gi = g === 'III' ? 3 : g === 'II' ? 2 : 1;
    recorded['tg18-cholangitis'] = gi;
    const r = interpretTg18Cholangitis(g);
    scoreValues.push({ score: 'tg18-cholangitis', mode: 'calculator', source: 'web.scaleCalculator.tg18-cholangitis', value: gi, label: r.band });
    management.push({ source: 'web.scaleCalculator.tg18-cholangitis', text: `${r.band}: ${r.action}` });

    const full = scoreTokyoCholangitis({
      fever_or_chills: tempAtLeast38 || bool(tgc, 'systemicInflammation'),
      biliary_dilatation: bool(tgc, 'imaging'), biliary_cause_on_imaging: bool(tgc, 'imaging'),
      high_fever: bool(tgc, 'feverAtLeast39'), age_over_75: bool(tgc, 'ageAtLeast75'),
      bilirubin_high: bool(tgc, 'bilirubinAtLeast5mgdl'), albumin_low: bool(tgc, 'albuminBelow07LLN'),
      organ_dysfunction: org,
    }, labs, sv);
    scoreValues.push({ score: 'tg18-cholangitis', mode: 'calculator', source: 'web.scoreCalculator.tg18-cholangitis', value: full.score, label: full.label });
    management.push({ source: 'web.scoreCalculator.tg18-cholangitis', text: full.label });
  }
  // ClinicalScoresPanel useTg18Record(): the record the TG18 cards pre-fill from (tg18-autofill.ts).
  const tg18Record: Tg18Record = {
    age, systolicBp: lv?.systolicBp ?? null, avpu: lv?.avpu ?? null, labs,
    examText: [inp.exam?.general, inp.exam?.abdomen, inp.exam?.other, inp.exam?.skin].filter(Boolean).join('\n'),
    historyText: inp.hpi ?? '', assessment,
    imagingReports: (inp.imaging ?? []).map(i => i.result),
    surgicalHistory: inp.surgicalHistory ?? [],
  };
  if (tgc || (dx?.paneDiseaseId === 'cholangitis')) {
    const auto = scoreTokyoCholangitis(tokyoCholangitisAutoFill(tg18Record), labs, sv);
    scoreValues.push({ score: 'tg18-cholangitis', mode: 'autofill', source: 'web.scoreCalculator.tg18-cholangitis', value: auto.score, label: auto.label, pending: auto.missing_inputs });
  }

  const tgk = forms['tg18-cholecystitis'];
  if (tgk) {
    const full = scoreTokyoCholecystitis({
      murphy_sign: bool(tgk, 'localSigns'),
      ruq_pain_mass_tenderness: bool(tgk, 'localSigns') || bool(tgk, 'palpableTenderRUQMass'),
      fever: bool(tgk, 'systemicSigns') && tempAtLeast38,
      us_wall_thickening: bool(tgk, 'imagingCharacteristic'),
      // ClinicalScoresPanel Grade II toggles (TG18).
      palpable_tender_mass: bool(tgk, 'palpableTenderRUQMass'),
      duration_over_72h: bool(tgk, 'durationOver72h'),
      marked_local_inflammation: bool(tgk, 'markedLocalInflammation'),
      organ_dysfunction: organs(tgk),
    }, labs, sv);
    scoreValues.push({ score: 'tg18-cholecystitis', mode: 'calculator', source: 'web.scoreCalculator.tg18-cholecystitis', value: full.score, label: full.label });
    if (full.score >= 1) recorded['tg18-cholecystitis'] = full.score;
    management.push({ source: 'web.scoreCalculator.tg18-cholecystitis', text: full.label });
  }
  if (tgk || (dx?.paneDiseaseId === 'cholecystitis')) {
    const auto = scoreTokyoCholecystitis(tokyoCholecystitisAutoFill(tg18Record), labs, sv);
    scoreValues.push({ score: 'tg18-cholecystitis', mode: 'autofill', source: 'web.scoreCalculator.tg18-cholecystitis', value: auto.score, label: auto.label, pending: auto.missing_inputs });
  }
  for (const key of Object.keys(forms)) {
    const total = forms[key]?.total;
    if (typeof total === 'number') recorded[key] = total;
    else if (!['alvarado', 'tg18-cholangitis', 'tg18-cholecystitis'].includes(key)) notes.push(`no web calculator for score form '${key}'`);
  }

  // ── Diagnostic reasoning (AssessmentTab DiagnosticReasoningPanel) ───────────
  const chrono = [...(inp.vitals ?? [])].sort((a, b) => (b.minutesAgo ?? 0) - (a.minutesAgo ?? 0));
  const results = investigationResults(v);
  const reasoning = buildDiagnosticReasoning({
    state: pane,
    diseases,
    working: dx ? { diseaseId: dx.paneDiseaseId ?? null, icdCode: dx.icd10 ?? null, label: dx.name } : null,
    news2Series: news2Series(chrono.map(x => ({
      respiratoryRate: x.respiratoryRate ?? null, spo2: x.spo2 ?? null, onOxygen: x.onSupplementalO2 ?? null,
      systolicBP: x.systolicBp ?? null, heartRate: x.heartRate ?? null, temperatureCelsius: x.temperatureC ?? null,
      avpu: x.avpu ?? null,
    }))),
    recordText: reasoningRecordText({
      chiefComplaint: inp.chiefComplaint,
      narrative: [...(paneContextFromConsultation(consultationSnapshot(v)).narrative ?? []), inp.socialHistory ?? ''].filter(Boolean),
      symptoms, comorbidities: inp.comorbidities ?? [], medications: (inp.medications ?? []).map(m => m.drug),
      surgicalHistory: inp.surgicalHistory ?? [], investigationResults: results, supplements: [],
    }),
    labs: numericLabs(results),
    longitudinal: null,
    currentComplaint: inp.chiefComplaint,
  });
  const reasoningLines: SourcedText[] = reasoningHarnessLines(reasoning, 'web.reasoning');
  // ── Decision support (PlanTab → DecisionSupportPanel) ──────────────────────
  let clinicalScores: Record<string, unknown> = {};
  const { source: _labSource, ...labNumbers } = labs;
  void _labSource;
  for (const [key, value] of Object.entries(recorded)) clinicalScores = withRecordedScore(clinicalScores, key, value, 'vignette');
  const decisionConsultation: DecisionConsultation = {
    age: String(age), sex, pregnancyPossible: pregnancyPossible(v),
    allergies: (inp.allergies ?? []).map(a => (a.reaction ? `${a.name} (${a.reaction})` : a.name)),
    medications: (inp.medications ?? []).map(m => m.drug), medicationsText: '',
    comorbidities: inp.comorbidities ?? [], pmhNotes: '', hpiNotes: inp.hpi ?? '', freeText: inp.chiefComplaint,
    surgicalHistory: inp.surgicalHistory ?? [], assessment,
    extractedLabs: { ...labNumbers, egfr: labValue(v, 'egfr') },
    investigationResults: investigationResults(v), vitals: vitalStrings(v),
    weightKg: inp.patient.weightKg === undefined ? '' : String(inp.patient.weightKg),
    heightCm: inp.patient.heightCm === undefined ? '' : String(inp.patient.heightCm),
    isPostOp: inp.encounter.isPostOp ?? false,
    postOpDays: inp.encounter.postOpDays === undefined || inp.encounter.postOpDays === null ? '' : String(inp.encounter.postOpDays),
    clinicalScores,
    workingDiagnosis: dx?.paneDiseaseId ? { diseaseId: dx.paneDiseaseId, icdCode: icd, locked: true, diseaseLabel: dx.name } : null,
    icdCodes: icd && !dx?.paneDiseaseId ? [`${icd} — ${dx?.name ?? icd}`] : [],
    paneTop: paneTop.map(r => ({ disease: { id: r.disease.id, label: r.disease.label, icd10: r.disease.icd10 }, probability: r.probability })),
    imagingText: (inp.imaging ?? []).map(i => i.result).join('.\n'),
    today: '2026-09-25',
  };
  const decisions = buildDecisionSupport(decisionConsultation);
  for (const line of decisionSummaryLines(decisions)) {
    if (line.kind === 'safety') redFlags.push({ source: 'web.decisions.notForPatient', text: line.text });
    else if (line.kind === 'info') notes.push(line.text);
    else management.push({ source: 'web.decisions', text: line.text });
  }
  const shiftSnapshot = { ...decisionConsultation, ...consultationSnapshot(v) };
  const ccEntries = [{ complaint: cc, answers: socratesAnswers(v) }];
  for (const s of resultPosteriorShifts(shiftSnapshot, ccEntries, pane)) {
    management.push({ source: 'web.decisions.shift', text: `Posterior shift — ${shiftText(s)}` });
  }
  notes.push(`Decision support: ${decisions.decisions.map(d => d.id).join(', ') || '(no decision)'}; factors ${decisions.activeFactors.join(', ') || '(none)'}`);

  // ── What's missing (Home → WhatsMissingStrip) ───────────────────────────────
  const imagingOrders = (inp.orders?.investigations ?? []).filter(n => /\b(ct|ctpa|mri|x-?ray|ultrasound|uss?|scan)\b/i.test(n));
  const missingConsultation: MissingConsultation = {
    ...decisionConsultation,
    allergies: allergyNames.length ? decisionConsultation.allergies : inp.nkda ? 'NKDA' : '',
    plan: '', symptoms, examFindings: vignetteExamFindings(v), rosFindings: {},
    examGeneral: inp.exam?.general ?? '', examAbdomen: inp.exam?.abdomen ?? '', examCardio: inp.exam?.cardiovascular ?? '',
    examResp: inp.exam?.respiratory ?? '', examNeuro: inp.exam?.neuro ?? '', examExtremities: inp.exam?.msk ?? '',
    procedureData: { cc: ccEntries }, familyHistory: [], toxicHabits: web.toxicHabits ?? [],
    orderedInvestigations: (inp.orders?.investigations ?? []).filter(n => !imagingOrders.includes(n)),
    radiologyRequests: [
      ...(inp.imaging ?? []).map(i => ({ modality: i.modality, anatomicalRegion: i.region ?? '', resultReceived: true, resultNotes: i.result, indication: i.name })),
      ...imagingOrders.map(n => ({ modality: n, anatomicalRegion: '', resultReceived: false, resultNotes: '', indication: '' })),
    ],
    pendingPrescriptions: (inp.orders?.prescriptions ?? []).map(drugName => ({ drugName })),
    supplementHistory: { status: inp.supplements ?? 'not_asked' },
    visitType: inp.encounter.visitType ?? '',
    encounterType: inp.encounter.setting === 'emergency' ? 'major_emergency' : inp.encounter.setting === 'endoscopy' ? 'endoscopy' : 'surgical_consult',
    encounterMode: inp.encounter.setting === 'inpatient' ? 'inpatient' : 'outpatient',
  };
  const missingScores = [...new Set([...recommendedScores.map(r => r.score), ...Object.keys(recorded)])];
  const missing = buildWhatsMissing(missingConsultation, { paneState: pane, activeScores: missingScores });
  const missingLines: SourcedText[] = whatsMissingLines(missing).map(text => ({ source: 'web.missing', text }));

  // ── Pathway registry (usePathway / matchPathways) — recorded for information ─
  const pathways = matchPathways({ symptoms, freeText: [inp.chiefComplaint, inp.hpi].join('. ') });
  if (pathways.length) notes.push(`matchPathways: ${pathways.slice(0, 3).map(p => `${p.pathway.name} (${p.score})`).join(', ')}`);

  return {
    differentials, alarms, redFlags, emergencyLevel, recommendedScores, scoreValues,
    investigations, management, pathway: null, dxVariant, reasoning: reasoningLines, missing: missingLines,
    engineInfo: {
      paneEngine: `pane-engine (${DISEASES.length} diseases, ${FEATURES.length} features)`,
      triageRulesVersion: RULES_VERSION,
    },
    notes,
  };
}

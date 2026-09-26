/**
 * Outcomes loop — builds the completion snapshot from the consultation (AppContext), the same
 * inputs the Plan step's decision-support panel uses (DecisionSupportPanel.tsx). Any engine error
 * is caught: a snapshot is never a reason for the encounter not to close.
 */
import type { useAppContext } from '@/context/AppContext';
import { buildDecisionSupport, decisionScores } from '@/lib/decision-support';
import type { DecisionConsultation } from '@/lib/decision-support';
import { buildWebPredictionSnapshot } from '@/lib/outcomes-snapshot';
import type { PredictionSnapshot } from '@workspace/triage-engine/outcomes';

type App = ReturnType<typeof useAppContext>;

function stLuciaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' });
}

export function decisionConsultationFromApp(app: App): DecisionConsultation {
  return {
    age: app.age, sex: app.sex, pregnancyPossible: app.pregnancyPossible, allergies: app.allergies,
    medications: app.medications, medicationsText: app.medicationsText, comorbidities: app.comorbidities,
    pmhNotes: app.pmhNotes, hpiNotes: app.hpiNotes, freeText: app.freeText, surgicalHistory: app.surgicalHistory,
    assessment: app.assessment, extractedLabs: app.extractedLabs, investigationResults: app.investigationResults,
    vitals: app.vitals, weightKg: app.weightKg, heightCm: app.heightCm, isPostOp: app.isPostOp, postOpDays: app.postOpDays,
    recentSurgeryDate: app.recentSurgeryDate, clinicalScores: app.clinicalScores, workingDiagnosis: app.workingDiagnosis,
    icdCodes: app.icdCodes, paneTop: app.paneTop,
    imagingText: app.radiologyRequests.filter(r => r.resultReceived).map(r => r.resultNotes ?? '').join('.\n'),
    today: stLuciaToday(),
  };
}

export function completionSnapshotFromApp(app: App, encounterId: string, completedAt = new Date().toISOString()): PredictionSnapshot | null {
  try {
    const consultation = decisionConsultationFromApp(app);
    let decision = null;
    let scores: ReturnType<typeof decisionScores> = [];
    try {
      decision = buildDecisionSupport(consultation);
      scores = decisionScores(consultation);
    } catch { /* decision layer unavailable: the differential and triage are still recorded */ }
    return buildWebPredictionSnapshot({
      encounterId,
      completedAt,
      paneTop: app.paneTop,
      paneState: app.paneState,
      triageAcuity: app.triageResult?.acuity ?? null,
      decision,
      decisionScores: scores,
      workingDiagnosis: app.workingDiagnosis,
      icdCodes: app.icdCodes,
      cptCodes: app.cptCodes,
      procedureName: app.whoProc?.procedureName,
      periopProcId: app.periopProcId,
      procedures: app.procedures,
      orderedInvestigations: app.orderedInvestigations,
      radiologyStudies: app.radiologyRequests.map(r => [r.modality, r.anatomicalRegion, r.scopeType].filter(Boolean).join(' ')),
    });
  } catch {
    return null;
  }
}

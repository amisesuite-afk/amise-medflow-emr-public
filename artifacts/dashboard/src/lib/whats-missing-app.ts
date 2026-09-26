/**
 * The consultation (AppContext) → the what's-missing / score auto-fill input. Shared by the
 * WhatsMissingStrip and the Scales-step calculators so both read the record the same way.
 */
import type { useAppContext } from '@/context/AppContext';
import type { MissingConsultation } from './whats-missing-web';

type App = ReturnType<typeof useAppContext>;

export function stLuciaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' });
}

export function missingConsultationFromApp(app: App): MissingConsultation {
  return {
    age: app.age, sex: app.sex, pregnancyPossible: app.pregnancyPossible, allergies: app.allergies,
    medications: app.medications, medicationsText: app.medicationsText, comorbidities: app.comorbidities,
    pmhNotes: app.pmhNotes, hpiNotes: app.hpiNotes, freeText: app.freeText, surgicalHistory: app.surgicalHistory,
    surgicalNotes: app.surgicalNotes, assessment: app.assessment, plan: app.plan, extractedLabs: app.extractedLabs,
    investigationResults: app.investigationResults, vitals: app.vitals, weightKg: app.weightKg, heightCm: app.heightCm,
    isPostOp: app.isPostOp, postOpDays: app.postOpDays, recentSurgeryDate: app.recentSurgeryDate,
    clinicalScores: app.clinicalScores, workingDiagnosis: app.workingDiagnosis, icdCodes: app.icdCodes, paneTop: app.paneTop,
    imagingText: app.radiologyRequests.filter(r => r.resultReceived).map(r => r.resultNotes ?? '').join('.\n'),
    symptoms: app.symptoms, examGeneral: app.examGeneral, examAbdomen: app.examAbdomen, examCardio: app.examCardio,
    examResp: app.examResp, examNeuro: app.examNeuro, examExtremities: app.examExtremities, examBreast: app.examBreast,
    examWound: app.examWound, examFindings: app.examFindings, rosFindings: app.rosFindings as MissingConsultation['rosFindings'],
    procedureData: app.procedureData, familyHistory: app.familyHistory, toxicHabits: app.toxicHabits,
    vitalRecords: app.vitalRecords, labRecords: app.labRecords, orderedInvestigations: app.orderedInvestigations,
    radiologyRequests: app.radiologyRequests, pendingPrescriptions: app.pendingPrescriptions,
    supplementHistory: app.supplementHistory, visitType: app.visitType, encounterType: app.encounterType,
    encounterMode: app.encounterMode, today: stLuciaToday(),
  };
}

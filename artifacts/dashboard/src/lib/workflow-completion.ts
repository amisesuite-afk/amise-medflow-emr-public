/**
 * Pathway-bar completion (✓ per section), from what the clinician actually recorded.
 *
 * A section is done only when the record holds content for it. Suggestions (the complaint's
 * suggested tests, a suggested diagnosis, normal-exam templates) never count, because they are
 * not written to the record until the clinician acts on them (UX review C2–C4).
 */
import type { Section } from '@/context/AppContext';

export interface CompletionFields {
  symptoms: string[]; freeText: string; vitals: Record<string, unknown>;
  hpiNotes: string; comorbidities: string[];
  surgicalHistory: string[]; surgicalNotes: string;
  medications: string[]; medicationsText: string; allergies: string;
  familyHistory: string[]; familyHistoryNotes: string;
  toxicHabits: string[]; occupation: string;
  rosFindings: Record<string, { status: string; details: string[]; notes: string }>;
  examGeneral: string; examCardio: string; examResp: string; examAbdomen: string;
  examNeuro: string; examExtremities: string; examBreast: string; examWound: string;
  orderedInvestigations: string[]; radiologyRequests: unknown[]; attachments: unknown[];
  assessment: string; plan: string; progressNotes: unknown[];
}

/** Short labels for the pathway steps (pathway bar, sign-off summary). */
export const SECTION_LABELS: Partial<Record<Section, string>> = {
  triage: 'Triage', hpi: 'HPI', pmh: 'PMH', surgical: 'Surgical Hx',
  medications: 'Meds', allergies: 'Allergies', family_hx: 'Family Hx',
  toxic: 'Social', ros: 'ROS', examination: 'Exam', wounds: 'Wounds',
  investigations: 'Labs', blood_gas: 'ABG', radiology: 'Imaging',
  attachments: 'Files', assessment: 'Assessment', plan: 'Plan',
  procedures: 'Procedure', prescriptions: 'RX', dosing: 'Dosing',
  fluid_nutrition: 'Fluids', referring_providers: 'Referrals',
  progress: 'Notes', monitoring: 'Monitor', tasks: 'Tasks',
};

const filled = (v: unknown) => typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined && v !== false;

export function computeSectionDone(f: CompletionFields): Partial<Record<Section, boolean>> {
  const hasVitals = Object.values(f.vitals).some(filled);
  const hasExam = [f.examGeneral, f.examCardio, f.examResp, f.examAbdomen, f.examNeuro, f.examExtremities, f.examBreast, f.examWound]
    .some(v => !!v?.trim());
  const hasRos = Object.values(f.rosFindings).some(r => r.status !== 'not-asked' || r.details.length > 0 || !!r.notes);
  return {
    triage:         f.symptoms.length > 0 || !!f.freeText.trim() || hasVitals,
    hpi:            !!f.hpiNotes.trim(),
    pmh:            f.comorbidities.length > 0,
    surgical:       f.surgicalHistory.length > 0 || !!f.surgicalNotes.trim(),
    medications:    f.medications.length > 0 || !!f.medicationsText.trim(),
    allergies:      !!f.allergies.trim(),
    family_hx:      f.familyHistory.length > 0 || !!f.familyHistoryNotes.trim(),
    toxic:          f.toxicHabits.length > 0 || !!f.occupation.trim(),
    ros:            hasRos,
    examination:    hasExam,
    investigations: f.orderedInvestigations.length > 0,
    radiology:      f.radiologyRequests.length > 0,
    attachments:    f.attachments.length > 0,
    assessment:     !!f.assessment.trim(),
    plan:           !!f.plan.trim(),
    progress:       f.progressNotes.length > 0,
  };
}

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireStaffAuth, audit } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a specialist medical documentation writer for Amise Medical Services, a general and endoscopic surgery practice in Saint Lucia, led by Dr Dawit Daniel Kabiye, MD, DM.

Your task is to generate professional discharge summaries and clinic letters from structured clinical data.

Requirements:
- Write professional medical prose — not bullet points in the clinical narrative
- British English spelling throughout
- Clinical narrative: past tense, third person
- Patient-facing instructions (wound care, diet, activity, red flags): second person, plain language
- Do NOT invent, assume, or embellish any clinical details not explicitly provided
- Omit sections entirely if their data is empty, not provided, or marked "—"
- Use formal medical terminology appropriate for consultant-level surgical documentation
- The discharge summary must be suitable for inclusion in the official medical record and for sharing with the patient and their GP
- Start with the line: [AI-ASSISTED DRAFT — REQUIRES SURGEON REVIEW AND APPROVAL BEFORE ISSUING]
- End with a signature block for the discharging clinician`;

interface DischargeMed {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
}

interface DischargeSummaryRequest {
  type?: 'outpatient' | 'inpatient';
  patientName?: string;
  patientAge?: string;
  patientSex?: string;
  mrNumber?: string;
  dateAdmission?: string;
  dateDischarge?: string;
  ward?: string;
  admittingSurgeon?: string;
  diagnosis: string;
  icdCodes?: string[];
  procedurePerformed?: string;
  conditionOnDischarge?: string;
  dischargeMedications?: DischargeMed[];
  preAdmissionMedications?: string;
  allergies?: string;
  woundCare?: string;
  dietInstructions?: string;
  activityRestrictions?: string;
  followUpPlan?: string;
  redFlags?: string[];
  additionalWarnings?: string;
}

function fmt(v: unknown): string {
  if (Array.isArray(v)) return (v as unknown[]).filter(Boolean).join(', ');
  if (typeof v === 'string') return v;
  return '';
}

router.post('/api/ai/discharge-summary', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  try {
    const body = req.body as DischargeSummaryRequest;
    const {
      type = 'outpatient',
      patientName, patientAge, patientSex, mrNumber,
      dateAdmission, dateDischarge, ward, admittingSurgeon,
      diagnosis, icdCodes,
      procedurePerformed,
      conditionOnDischarge,
      dischargeMedications,
      preAdmissionMedications,
      allergies,
      woundCare, dietInstructions, activityRestrictions,
      followUpPlan, redFlags, additionalWarnings,
    } = body;

    if (!diagnosis) {
      res.status(400).json({ error: 'diagnosis is required' });
      return;
    }

    const patientInfo = [
      patientName || 'Unknown',
      patientAge ? `${patientAge} years` : '',
      patientSex && patientSex !== 'unknown' ? patientSex : '',
      mrNumber ? `MR# ${mrNumber}` : '',
    ].filter(Boolean).join(', ');

    const medsList = dischargeMedications && dischargeMedications.length > 0
      ? dischargeMedications
          .filter(m => m.drug)
          .map(m => `${m.drug} ${m.dose} ${m.route} ${m.frequency}${m.duration ? ` for ${m.duration}` : ''}`)
          .join('; ')
      : '—';

    const allFlags = [
      ...(redFlags ?? []),
      ...(additionalWarnings ? [additionalWarnings] : []),
    ].filter(Boolean);

    const isInpatient = type === 'inpatient';

    const userPrompt = `Generate a formal ${isInpatient ? 'Inpatient Discharge Summary' : 'Clinic Discharge Letter'} for a general and endoscopic surgery practice. Include only sections for which data is provided. Omit sections where data is "—" or absent.

PATIENT: ${patientInfo}
${dateAdmission ? `DATE OF ADMISSION: ${dateAdmission}` : ''}
${dateDischarge ? `DATE OF DISCHARGE: ${dateDischarge}` : ''}
${ward ? `WARD: ${ward}` : ''}
DISCHARGING SURGEON: ${admittingSurgeon || 'Dr Dawit Daniel Kabiye, MD, DM'}

CLINICAL INFORMATION:
Principal diagnosis: ${fmt(diagnosis)}
ICD-10 codes: ${icdCodes && icdCodes.length > 0 ? icdCodes.join(', ') : '—'}
Procedure(s) performed: ${fmt(procedurePerformed)}
Condition on discharge: ${fmt(conditionOnDischarge)}
Allergies: ${fmt(allergies) || 'NKDA (No Known Drug Allergies)'}
Pre-admission medications: ${fmt(preAdmissionMedications)}

DISCHARGE MEDICATIONS:
${medsList}

DISCHARGE INSTRUCTIONS:
Wound care: ${fmt(woundCare)}
Diet: ${fmt(dietInstructions)}
Activity: ${fmt(activityRestrictions)}
Follow-up: ${fmt(followUpPlan)}
Return immediately if: ${allFlags.length > 0 ? allFlags.join('; ') : '—'}

Write the ${isInpatient ? 'discharge summary' : 'clinic letter'} with these sections as applicable:
${isInpatient ? `DISCHARGE SUMMARY
Patient / Admission Details
PRINCIPAL DIAGNOSIS AND ICD-10 CODES
PROCEDURES PERFORMED
CLINICAL COURSE
CONDITION ON DISCHARGE
MEDICATIONS ON DISCHARGE
WOUND CARE
DIET AND ACTIVITY
FOLLOW-UP PLAN
RETURN PRECAUTIONS
[Signature block for discharging surgeon]` : `CLINIC DISCHARGE LETTER
Patient Details
DIAGNOSIS
TREATMENT PROVIDED
DISCHARGE INSTRUCTIONS (wound care, diet, activity)
MEDICATIONS ON DISCHARGE
FOLLOW-UP PLAN
WHEN TO SEEK IMMEDIATE CARE
[Signature block]`}`;

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const summary = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    res.json({ success: true, summary });

    void audit({
      action: 'draft',
      entityType: 'clinical_note',
      payload: { route: 'discharge-summary', type, patientName, diagnosis: fmt(diagnosis) },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Discharge summary generation failed';
    log.error({ err }, 'Discharge summary generation error');
    res.status(500).json({ error: message });
  }
});

export default router;

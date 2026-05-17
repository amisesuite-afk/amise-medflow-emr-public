import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-5';

const SUMMARY_SYSTEM = `You are a clinical documentation assistant for Amise Medical Services, Saint Lucia — a general and endoscopic surgery practice led by Dr Dawit Daniel Kabiye, MD, DM.

Your task is to convert structured intake data into a concise, professional clinical intake summary for Dr Kabiye's review. Write in a British-Caribbean medical professional style.

Rules:
- Produce a structured document using the exact headings provided.
- Synthesise data coherently — do not simply list every field.
- Highlight clinically significant findings (abnormal vitals, red-flag symptoms, high-risk scores) with the marker [!].
- Suggest but do not prescribe — you may note "warrants assessment for X" but never diagnose or recommend treatment doses.
- Keep it factual and concise; aim for clarity over completeness.
- Do NOT include fees, diagnoses, drug doses, or definitive clinical conclusions.
- Use British spelling throughout.`;

const SummaryRequestSchema = z.object({
  patient: z.object({
    name: z.string(),
    age: z.string(),
    sex: z.string(),
    dob: z.string(),
    phone: z.string(),
  }),
  complaint: z.object({
    symptoms: z.array(z.string()),
    symptomDetails: z.record(z.array(z.string())).optional(),
    duration: z.string(),
    painScore: z.string(),
    freeText: z.string(),
    isPostOp: z.boolean(),
    postOpDays: z.string(),
    pregnancyPossible: z.boolean(),
  }),
  vitals: z.record(z.string()),
  history: z.object({
    pmh: z.array(z.string()),
    pmhNotes: z.string(),
    surgicalHistory: z.array(z.string()),
    surgicalNotes: z.string(),
    medications: z.array(z.string()),
    medicationsText: z.string(),
    allergies: z.string(),
    familyHistory: z.array(z.string()),
    toxicHabits: z.array(z.string()),
  }),
  examination: z.record(z.string()).optional(),
  assessment: z.string().optional(),
  differentials: z.string().optional(),
  plan: z.string().optional(),
  triageAcuity: z.string(),
  triageScore: z.number(),
  scaleResults: z.array(z.object({
    name: z.string(),
    band: z.string(),
    score: z.union([z.number(), z.string()]),
    action: z.string(),
  })).optional(),
  date: z.string(),
});

type SummaryRequest = z.infer<typeof SummaryRequestSchema>;

function buildPrompt(d: SummaryRequest): string {
  const vitalLines = Object.entries(d.vitals)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => {
      const labels: Record<string, string> = {
        systolicBp: 'SBP', diastolicBp: 'DBP', heartRate: 'HR',
        temperatureC: 'Temp', respiratoryRate: 'RR', spo2: 'SpO₂', glucoseMmol: 'RBS',
      };
      const units: Record<string, string> = {
        systolicBp: ' mmHg', diastolicBp: ' mmHg', heartRate: ' bpm',
        temperatureC: ' °C', respiratoryRate: '/min', spo2: '%', glucoseMmol: ' mmol/L',
      };
      return `${labels[k] ?? k}: ${v}${units[k] ?? ''}`;
    });

  const detailLines = Object.entries(d.complaint.symptomDetails ?? {})
    .map(([sym, dets]) => dets.length ? `  • ${sym}: ${dets.join(', ')}` : null)
    .filter(Boolean);

  const scaleLines = (d.scaleResults ?? []).map(s =>
    `  • ${s.name}: ${s.band} (score ${s.score}) → ${s.action}`,
  );

  return `Generate a clinical intake summary document using EXACTLY this structure and headings. Populate each section from the data below. Where a section is empty, write "Not documented." Do not add sections not listed.

---
CLINICAL INTAKE SUMMARY
Amise Medical Services — Saint Lucia
Date: ${d.date}

PATIENT
Name: ${d.patient.name || 'Not provided'}
Age / DOB: ${d.patient.age || '—'} ${d.patient.dob ? `/ ${d.patient.dob}` : ''}
Sex: ${d.patient.sex}
Contact: ${d.patient.phone || 'Not provided'}

PRESENTING COMPLAINT
Primary symptoms: ${d.complaint.symptoms.join(', ') || 'Not specified'}
${detailLines.length ? `Symptom details:\n${detailLines.join('\n')}` : ''}
Duration: ${d.complaint.duration ? `${d.complaint.duration} day(s)` : 'Not specified'}
Pain score: ${d.complaint.painScore ? `${d.complaint.painScore}/10` : 'Not recorded'}
${d.complaint.isPostOp ? `Post-operative: Yes${d.complaint.postOpDays ? ` (${d.complaint.postOpDays} days post-op)` : ''}` : ''}
${d.complaint.pregnancyPossible ? 'Pregnancy possible: Yes' : ''}
Patient's own account: ${d.complaint.freeText || 'None provided'}

VITAL SIGNS
${vitalLines.length ? vitalLines.join(' | ') : 'Not recorded'}
Triage acuity: ${d.triageAcuity.toUpperCase()} (score ${d.triageScore})

PAST MEDICAL HISTORY
${d.history.pmh.join(', ') || 'Nil significant'}
${d.history.pmhNotes ? `Notes: ${d.history.pmhNotes}` : ''}

SURGICAL HISTORY
${d.history.surgicalHistory.join(', ') || 'No prior surgery'}
${d.history.surgicalNotes ? `Notes: ${d.history.surgicalNotes}` : ''}

MEDICATIONS
${[...d.history.medications, d.history.medicationsText].filter(Boolean).join(', ') || 'None recorded'}

ALLERGIES
${d.history.allergies || 'NKDA'}

FAMILY HISTORY
${d.history.familyHistory.join(', ') || 'Not documented'}

SOCIAL / TOXIC HABITS
${d.history.toxicHabits.join(', ') || 'Nil significant'}

CLINICAL EXAMINATION FINDINGS
${Object.entries(d.examination ?? {})
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n') || '  Not documented — pending clinical review'}

${scaleLines.length ? `CLINICAL SCORING TOOLS\n${scaleLines.join('\n')}\n` : ''}PROVISIONAL ASSESSMENT
${d.assessment?.trim() || 'Not documented — pending clinician input'}

DIFFERENTIALS CONSIDERED
${d.differentials?.trim() || 'Not documented — pending clinician input'}

INITIAL MANAGEMENT PLAN
${d.plan?.trim() || 'Not documented — pending clinician input'}

---
Prepared by front desk for review by: Dr Dawit Daniel Kabiye, MD, DM
This is an administrative intake summary only. Clinical decisions remain the responsibility of the attending clinician.
---

Now write the final formatted summary. Use the sections above as your structure. Where you have enough data, write coherent prose rather than repeating raw lists. Flag any clinically significant items with [!].`;
}

router.post('/api/summary/generate', async (req, res) => {
  const parsed = SummaryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const prompt = buildPrompt(parsed.data);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1800,
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const document = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim();

  res.json({ document });
});

export default router;

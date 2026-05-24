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
    .map(([sym, dets]) => dets.length ? `• ${sym}: ${dets.join(', ')}` : null)
    .filter(Boolean);

  const scaleLines = (d.scaleResults ?? []).map(s =>
    `• ${s.name}: ${s.band} (score ${s.score}) → ${s.action}`,
  );

  const examLines = Object.entries(d.examination ?? {})
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v}`);

  const vitalsStr = vitalLines.length ? vitalLines.join(' | ') : 'Not recorded';

  return `Generate a clinical consultation summary in SOAP format using EXACTLY the headings and structure below. Write coherent prose for narrative sections. Flag clinically significant findings with [!]. Use British spelling throughout. Do not add sections not listed.

PROVIDED DATA:
- Patient: ${d.patient.name || 'Not provided'}, ${d.patient.age || '—'} yrs, ${d.patient.sex}, DOB ${d.patient.dob || '—'}, ${d.patient.phone || '—'}
- Symptoms: ${d.complaint.symptoms.join(', ') || 'Not specified'}
${detailLines.length ? `- Symptom details:\n${detailLines.join('\n')}` : ''}
- Duration: ${d.complaint.duration ? `${d.complaint.duration} day(s)` : 'Not specified'}
- Pain score: ${d.complaint.painScore ? `${d.complaint.painScore}/10` : 'Not recorded'}
${d.complaint.isPostOp ? `- Post-operative: Yes${d.complaint.postOpDays ? ` (${d.complaint.postOpDays} days post-op)` : ''}` : ''}
${d.complaint.pregnancyPossible ? '- Pregnancy possible: Yes' : ''}
- Patient account: ${d.complaint.freeText || 'None provided'}
- Vitals: ${vitalsStr} | Triage: ${d.triageAcuity.toUpperCase()} (score ${d.triageScore})
- PMH: ${d.history.pmh.join(', ') || 'Nil significant'}${d.history.pmhNotes ? ` — ${d.history.pmhNotes}` : ''}
- Surgical history: ${d.history.surgicalHistory.join(', ') || 'None'}${d.history.surgicalNotes ? ` — ${d.history.surgicalNotes}` : ''}
- Medications: ${[...d.history.medications, d.history.medicationsText].filter(Boolean).join(', ') || 'None reported'}
- Allergies: ${d.history.allergies || 'NKDA'}
- Family history: ${d.history.familyHistory.join(', ') || 'Not documented'}
- Social/habits: ${d.history.toxicHabits.join(', ') || 'Nil significant'}
- Examination: ${examLines.join('; ') || 'Not documented'}
${scaleLines.length ? `- Clinical scales:\n${scaleLines.join('\n')}` : ''}
- Assessment: ${d.assessment?.trim() || 'Not documented'}
- Differentials: ${d.differentials?.trim() || 'Not documented'}
- Plan: ${d.plan?.trim() || 'Not documented'}

REQUIRED OUTPUT — follow this structure exactly (use these exact headings):

SUBJECTIVE

Chief Complaint
Chief Complaint: [1–2 sentences — reason for visit]

History of Present Illness
HPI: [2–4 sentence narrative synthesising symptoms, timeline, relevant context, and patient's own account]

Past Medical History
Past Medical History: [concise relevant PMH; "Nil significant" if none]

Medications
Current Medications: [list or "None reported"]
Allergies: [list or "NKDA"]

Social History
Social History: [brief social and habit history; "Not reported" if none]

OBJECTIVE

Physical Examination
Physical Exam:
[findings, each system on its own line; or "Not documented — pending clinical review"]

Laboratory/Diagnostic Results
Laboratory/Diagnostics:
• [each investigation, imaging, or result as a separate bullet with date if known; or "• Not documented"]

ASSESSMENT

Primary Diagnosis
Primary Diagnosis: [assessment; "Pending clinician assessment" if none]

PLAN

Treatment Plan
Therapeutic: [management actions and therapeutic interventions from the plan]

Patient Education
Patient Education: [2–3 sentences in plain language, past tense, explaining the condition and treatment to the patient. No diagnoses, drug doses, or clinical jargon.]

Follow-up
Follow-up: [next steps, timing, referrals, results expected; "To be arranged by Dr Kabiye" if not specified]`;
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

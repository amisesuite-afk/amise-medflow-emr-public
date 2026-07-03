import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const PRACTICE = 'Amise Medical Services — General & Endoscopic Surgery\nDr Dawit Daniel Kabiye, MD, DM\nRodney Bay Medical Centre, Saint Lucia\nTel: +1 (758) 284-0557';
const TODAY = () => new Date().toLocaleDateString('en-LC', { timeZone: 'America/St_Lucia', dateStyle: 'long' });

const TYPE_INSTRUCTIONS: Record<string, string> = {
  referral: `Write a formal specialist referral letter. Include: (1) patient details, (2) reason for referral with clinical urgency, (3) relevant history and examination findings, (4) current medications and allergies, (5) investigations already performed with results summary, (6) current diagnosis / working diagnosis, (7) specific question or procedure requested, (8) contact details for follow-up. Professional, concise tone. 300-500 words.`,

  gp_summary: `Write a summary letter to the patient's family physician / GP. Include: (1) date of consultation, (2) diagnosis, (3) management plan agreed, (4) medications prescribed or changed, (5) follow-up schedule, (6) any red-flag symptoms to watch for, (7) further investigations pending. 250-400 words.`,

  insurance: `Write a formal medical report for insurance purposes. Structure: (1) Patient identification and date, (2) Date of first consultation and subsequent visits, (3) Clinical history, (4) Examination findings, (5) Investigations, (6) Diagnosis with ICD code if available, (7) Treatment provided, (8) Prognosis and expected recovery, (9) Work capacity and restrictions. Factual, objective, third-person. 400-600 words. Do NOT speculate on liability.`,

  sick_cert: `Write a brief sick certificate / fit note. Include: (1) Patient name and date of birth, (2) Date assessed, (3) Medical condition (may be general — 'a medical condition under specialist review'), (4) Period of incapacity from __ to __ (estimate based on diagnosis and plan), (5) Restrictions or modified duties if partial capacity. Signed block at bottom. 100-150 words.`,

  patient_discharge: `Write patient-facing discharge instructions. Use simple, clear language (8th-grade reading level). Include: (1) What was done today, (2) What to expect during recovery (normal symptoms vs. concerning symptoms), (3) Wound care instructions if relevant, (4) Medications prescribed, (5) Activity restrictions, (6) Diet advice if relevant, (7) When to return for follow-up, (8) WHEN TO GO TO THE ER IMMEDIATELY (in bold). Friendly, reassuring tone. 300-450 words.`,
};

router.post('/', async (req: Request, res: Response) => {
  const { letterType, recipient, specialty, reason, patient, pmh, pmhNotes, surgicalHistory, medications, allergies, hpi, assessment, differentials, plan, icdCodes } = req.body as Record<string, unknown>;

  if (!patient || !(patient as Record<string, string>).name) {
    res.status(400).json({ error: 'Patient name required' });
    return;
  }

  const type = (letterType as string) || 'referral';
  const instructions = TYPE_INSTRUCTIONS[type] ?? TYPE_INSTRUCTIONS.referral;

  const context = `
PRACTICE: ${PRACTICE}
DATE: ${TODAY()}
${recipient ? `TO: ${recipient}${specialty ? `, ${specialty}` : ''}` : ''}
${reason ? `PURPOSE / FOCUS: ${reason}` : ''}

PATIENT:
  Name: ${(patient as Record<string, string>).name}
  Age/Sex: ${(patient as Record<string, string>).age || '—'}y / ${(patient as Record<string, string>).sex || '—'}
  DOB: ${(patient as Record<string, string>).dob || '—'}
  Phone: ${(patient as Record<string, string>).phone || '—'}

PMH: ${Array.isArray(pmh) && (pmh as string[]).length ? (pmh as string[]).join(', ') : 'None documented'}
${pmhNotes ? `PMH notes: ${pmhNotes}` : ''}
Surgical history: ${Array.isArray(surgicalHistory) && (surgicalHistory as string[]).length ? (surgicalHistory as string[]).join(', ') : 'None'}
Medications: ${Array.isArray(medications) && (medications as string[]).length ? (medications as string[]).join(', ') : 'None documented'}
Allergies: ${allergies || 'NKDA'}

PRESENTING COMPLAINT / HPI:
${hpi || 'Not documented'}

ASSESSMENT / DIAGNOSIS:
${assessment || 'Not documented'}
${differentials ? `Differentials: ${differentials}` : ''}
${Array.isArray(icdCodes) && (icdCodes as string[]).length ? `ICD codes: ${(icdCodes as string[]).join(', ')}` : ''}

MANAGEMENT PLAN:
${plan || 'Not documented'}
`.trim();

  const prompt = `${context}\n\n---\n\nLETTER INSTRUCTIONS:\n${instructions}\n\nWrite the complete letter now, ready to print. Include the practice header and a signature block. Do not include any commentary or explanation — only the letter itself.`;

  try {
    log.info({ type, patient: (patient as Record<string, string>).name }, 'generate-letter request');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(chunk.delta.text);
      }
    }
    res.end();
  } catch (err) {
    log.error({ err }, 'generate-letter error');
    if (!res.headersSent) res.status(500).json({ error: 'Letter generation failed' });
    else res.end();
  }
});

export default router;

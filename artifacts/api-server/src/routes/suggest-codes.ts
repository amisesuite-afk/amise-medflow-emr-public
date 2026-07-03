import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const INSTRUCTIONS = `You are a clinical coding specialist for a general and endoscopic surgery practice in Saint Lucia (Caribbean).
Given the clinical information below, suggest the most appropriate ICD-10-CM diagnosis codes and CPT procedure codes.

Return ONLY a JSON object in this exact format (no prose, no markdown fences):
{
  "icd10": [
    { "code": "K80.20", "description": "Calculus of gallbladder without cholecystitis, without obstruction", "confidence": "high" },
    ...
  ],
  "cpt": [
    { "code": "47562", "description": "Laparoscopic cholecystectomy", "confidence": "high" },
    ...
  ],
  "notes": "Brief coder's note about sequencing, principal diagnosis, or documentation gaps"
}

Rules:
- ICD-10: list principal diagnosis first, then relevant comorbidities that affect management
- CPT: list primary procedure first, then any add-on codes or ancillary services
- Confidence: "high" = clearly indicated, "medium" = likely but documentation gaps, "low" = possible but speculative
- Maximum 6 ICD-10 codes and 6 CPT codes
- If information is insufficient for a code, omit it rather than guessing
- Use current ICD-10-CM and CPT editions`;

router.post('/', async (req: Request, res: Response) => {
  const { assessment, plan, procedures, symptoms, patientAge, patientSex } = req.body as {
    assessment?: string;
    plan?: string;
    procedures?: string;
    symptoms?: string[];
    patientAge?: string;
    patientSex?: string;
  };

  if (!assessment && !procedures && (!symptoms || symptoms.length === 0)) {
    res.status(400).json({ error: 'At least one of assessment, procedures, or symptoms is required' });
    return;
  }

  const context = [
    patientAge && `Patient: ${patientAge}y ${patientSex || ''}`,
    symptoms?.length && `Presenting symptoms: ${symptoms.join(', ')}`,
    assessment && `Assessment / diagnosis: ${assessment}`,
    plan && `Management plan: ${plan}`,
    procedures && `Procedures performed: ${procedures}`,
  ].filter(Boolean).join('\n');

  const prompt = `${INSTRUCTIONS}\n\nCLINICAL INFORMATION:\n${context}\n\nReturn the JSON object:`;

  try {
    log.info('suggest-codes request');
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    // Strip any accidental markdown fences
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch {
      log.warn({ text }, 'suggest-codes: JSON parse failed');
      res.status(500).json({ error: 'Code suggestion parsing failed', raw: text });
      return;
    }

    res.json(parsed);
  } catch (err) {
    log.error({ err }, 'suggest-codes error');
    res.status(500).json({ error: 'Code suggestion failed' });
  }
});

export default router;

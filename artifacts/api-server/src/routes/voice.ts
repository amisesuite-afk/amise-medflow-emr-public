import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireStaffAuth } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const SOAP_SYSTEM_PROMPT = `You are a surgical clinical documentation assistant for Dr Dawit Daniel Kabiye (specialist general and endoscopic surgeon, Saint Lucia). You receive a raw voice dictation transcript from a clinical consultation and segment it into structured SOAP components. Use British medical English. Be concise. Do not invent content not present in the transcript.

Return ONLY a JSON object (no markdown fences):
{
  "hpi": "Subjective: history of presenting illness as concise clinical prose — onset, duration, character, severity, location, associated symptoms, alleviating/aggravating factors",
  "examination": {
    "general": "General examination findings as prose, or empty string if not mentioned",
    "cardiovascular": "CVS findings or empty string",
    "respiratory": "Respiratory findings or empty string",
    "abdomen": "Abdominal findings or empty string",
    "wound": "Wound/local findings or empty string",
    "breast": "Breast findings or empty string",
    "neurological": "Neurological findings or empty string",
    "extremities": "Extremities/vascular findings or empty string"
  },
  "assessment": "Clinical impression and working diagnosis as prose, or empty string",
  "plan": "Management plan as a concise list of actions, or empty string",
  "pmh": ["Past medical history items extracted from transcript"],
  "allergies": "Allergy summary or empty string",
  "unsegmented": "Any dictated content that could not be clearly assigned to a SOAP section"
}

If a section has no dictated content, return an empty string (not null). Only populate sections where the surgeon clearly spoke to that topic.`;

// POST /api/voice/segment
// Receives a raw voice transcript, returns SOAP-segmented JSON ready to load into AppContext.
router.post('/api/voice/segment', async (req, res) => {
  const ok = await requireStaffAuth(req, res);
  if (!ok) return;

  const { transcript, visitType, context } = req.body as {
    transcript: string;
    visitType?: string;
    context?: string; // e.g. "follow-up", "post-op day 3", "breast clinic"
  };

  if (!transcript?.trim()) {
    res.status(400).json({ error: 'transcript is required' });
    return;
  }

  const contextNote = [
    visitType ? `Visit type: ${visitType}` : '',
    context ? `Clinical context: ${context}` : '',
  ].filter(Boolean).join('. ');

  const userPrompt = `${contextNote ? contextNote + '\n\n' : ''}Raw voice transcript:\n\n${transcript.trim()}\n\nSegment this into SOAP components now.`;

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SOAP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '');

    let segmented: Record<string, unknown>;
    try {
      segmented = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      log.warn({ raw: raw.slice(0, 300) }, 'voice segment AI response was not valid JSON');
      res.status(502).json({ error: 'AI returned non-JSON — please retry' });
      return;
    }

    log.info({ chars: transcript.length }, 'voice transcript segmented');
    res.json({ success: true, segmented });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Voice segmentation failed';
    log.error({ err }, 'voice segment error');
    res.status(500).json({ error: message });
  }
});

export default router;

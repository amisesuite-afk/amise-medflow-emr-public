/**
 * POST /api/narrative/parse
 *
 * Accepts a free-text clinical narrative (dictated or pasted) and the target
 * section, then uses Claude to extract structured data appropriate for that
 * section. Both the raw narrative and the structured output are returned so
 * the frontend can store both in the database.
 *
 * Supported sections: pmh | medications | allergies | examination | assessment | plan
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireStaffAuth } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

function pmhPrompt(chips: string[]): string {
  return `You are a surgical registrar parsing a dictated past medical history for AMISE MedFlow EMR.

Available condition chips (return EXACT strings from this list in "matched"):
${chips.join(' | ')}

Return ONLY valid JSON (no markdown, no explanation):
{
  "matched": string[],
  "additional": string[],
  "notes": string
}

matched: conditions from the narrative that exactly match one of the available chips above.
additional: conditions mentioned that are NOT in the available chip list.
notes: a clean, structured PMH paragraph preserving all dates, severity, and clinical context from the narrative.`;
}

function medicationsPrompt(chips: string[]): string {
  return `You are a surgical registrar parsing a medication history for AMISE MedFlow EMR.

Available drug category chips (return EXACT strings from this list in "matched"):
${chips.join(' | ')}

Return ONLY valid JSON (no markdown, no explanation):
{
  "matched": string[],
  "medicationsText": string
}

matched: drug categories from the list that apply to medications mentioned (e.g. "Ramipril" → "ACE inhibitor").
medicationsText: the complete medication list with exact drug names, doses, and frequencies, one per line.`;
}

function allergiesPrompt(): string {
  return `You are parsing allergy information from a clinical narrative for AMISE MedFlow EMR.

Return ONLY valid JSON (no markdown, no explanation):
{
  "allergies": string
}

allergies: formatted as comma-separated "Allergen (reaction)" pairs.
Example: "Penicillin (anaphylaxis), NSAIDs (GI bleeding), Contrast dye (urticaria)"
If no reaction is stated, omit the parentheses.`;
}

function examinationPrompt(): string {
  return `You are a surgical registrar parsing a clinical examination narrative for AMISE MedFlow EMR.

Extract per-system findings from the narrative. Return ONLY valid JSON (no markdown):
{
  "general": string | null,
  "cardio": string | null,
  "resp": string | null,
  "abdomen": string | null,
  "neuro": string | null,
  "extremities": string | null,
  "breast": string | null,
  "wound": string | null
}

Use null for any system not mentioned in the narrative.
Each string should be complete clinical prose for that system exactly as dictated.
Do NOT invent findings not present in the narrative.
Do NOT collapse or summarise — preserve full clinical detail.`;
}

function assessmentPrompt(): string {
  return `You are a consultant general surgeon parsing a dictated clinical assessment / impression for AMISE MedFlow EMR.

Return ONLY valid JSON (no markdown, no explanation):
{
  "assessment": string,
  "differentials": string,
  "icdHint": string | null
}

assessment: the primary clinical impression as a concise, consultant-quality paragraph.
differentials: newline-separated list of differential diagnoses ranked by likelihood, e.g. "1. Acute cholecystitis\\n2. Biliary colic\\n3. Peptic ulcer disease"
icdHint: the most likely ICD-10 code and short description for the leading diagnosis, e.g. "K80.00 — Gallstones with acute cholecystitis". Null if unclear.
Do NOT invent diagnoses. Preserve all clinical reasoning from the narrative.`;
}

function planPrompt(): string {
  return `You are a consultant general surgeon parsing a dictated management plan for AMISE MedFlow EMR.

Return ONLY valid JSON (no markdown, no explanation):
{
  "plan": string,
  "investigations": string[],
  "prescriptions": string[],
  "referrals": string[],
  "followUp": string | null
}

plan: the full management plan as structured prose, exactly as dictated. Preserve clinical detail.
investigations: list of investigations ordered (bloods, imaging, endoscopy), each as a short string.
prescriptions: list of medications/prescriptions, each as "Drug dose frequency route".
referrals: list of referrals or consultations requested.
followUp: follow-up timeframe if mentioned (e.g. "2 weeks post-op"), or null.`;
}

const PROMPT_MAP: Record<string, (chips: string[]) => string> = {
  pmh:         pmhPrompt,
  medications: medicationsPrompt,
  allergies:   () => allergiesPrompt(),
  examination: () => examinationPrompt(),
  assessment:  () => assessmentPrompt(),
  plan:        () => planPrompt(),
};

router.post('/api/narrative/parse', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { section, text, chipOptions = [] } = (req.body ?? {}) as {
    section?: string;
    text?: string;
    chipOptions?: string[];
  };

  if (!section || !text?.trim()) {
    res.status(400).json({ error: 'section and text are required' });
    return;
  }

  const promptFn = PROMPT_MAP[section];
  if (!promptFn) {
    res.status(400).json({ error: `Unknown section: ${section}. Valid: ${Object.keys(PROMPT_MAP).join(', ')}` });
    return;
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: promptFn(chipOptions),
      messages: [{ role: 'user', content: text.trim() }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      logger.warn({ raw }, '[narrative/parse] no JSON in response');
      res.status(502).json({ error: 'No structured data in AI response' });
      return;
    }

    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    logger.info({ section, keys: Object.keys(parsed) }, '[narrative/parse] ok');
    res.json({ parsed });
  } catch (err) {
    logger.error({ err }, '[narrative/parse] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;

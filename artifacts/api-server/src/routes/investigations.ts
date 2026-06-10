import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { requireStaffAuth, audit } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const router = Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-5';

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);

const ExtractedResultSchema = z.object({
  test: z.string(),
  result: z.string(),
  unit: z.string().nullable().optional(),
  refRange: z.string().nullable().optional(),
  flag: z.enum(['H', 'L', 'C', 'N', '']).optional().default(''),
});

const ExtractResponseSchema = z.object({
  labName: z.string().nullable().optional(),
  reportDate: z.string().nullable().optional(),
  results: z.array(ExtractedResultSchema),
});

const EXTRACT_PROMPT = `This image or document is a laboratory or imaging report. Extract every individual test/parameter and its result exactly as printed — do not interpret, diagnose, or summarise.

Respond with ONLY a JSON object, no markdown fences, matching this schema:
{
  "labName": string | null,
  "reportDate": string | null,
  "results": [
    { "test": string, "result": string, "unit": string | null, "refRange": string | null, "flag": "H" | "L" | "C" | "N" | "" }
  ]
}

"flag": "H" if the report marks the result high/elevated, "L" if low, "C" if critical/panic value, "N" if explicitly marked normal, "" if no flag is shown. "reportDate" should be an ISO date (YYYY-MM-DD) if visible, else null.`;

// POST /api/investigations/extract-results — staff uploads a lab/imaging
// report; Claude (vision) drafts the extracted results for a human to
// review and confirm before they are saved into the patient record.
router.post('/api/investigations/extract-results', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { dataBase64, mimeType, fileName } = (req.body ?? {}) as {
    dataBase64?: string; mimeType?: string; fileName?: string;
  };

  if (!dataBase64 || !mimeType) {
    res.status(400).json({ error: 'dataBase64 and mimeType are required' });
    return;
  }
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    res.status(400).json({ error: `Unsupported file type: ${mimeType}` });
    return;
  }

  try {
    const fileBlock = mimeType === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: mimeType as 'application/pdf', data: dataBase64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: dataBase64 } };

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          fileBlock,
          { type: 'text', text: fileName ? `File: ${fileName}\n\n${EXTRACT_PROMPT}` : EXTRACT_PROMPT },
        ],
      }],
    });

    const text = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '');

    const parsed = ExtractResponseSchema.parse(JSON.parse(text));

    await audit({ action: 'extract', entityType: 'investigation_result', payload: { fileName: fileName ?? null, resultCount: parsed.results.length } });
    res.json(parsed);
  } catch (err) {
    logger.error({ err }, '[investigations/extract-results] error');
    res.status(502).json({ error: String(err) });
  }
});

export default router;

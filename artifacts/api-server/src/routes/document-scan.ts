/**
 * POST /api/document-scan
 *
 * Accepts a base64-encoded image or PDF, runs Claude vision to extract
 * structured clinical data, and returns a proof-reading payload.
 *
 * The frontend must present every field for human review before importing
 * into the medical record. Nothing auto-imports.
 */

import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireStaffAuth } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Use a vision-capable model — allow override via env
const MODEL = process.env.CLAUDE_SCAN_MODEL || 'claude-sonnet-4-6';

const EXTRACTION_PROMPT = `You are a senior surgical registrar reviewing a clinical document.
Extract ALL clinical information from the document image into structured JSON.

Return ONLY valid JSON with this exact schema (use null for fields not found):
{
  "patientName": string | null,
  "diagnosis": string | null,
  "staging": string | null,
  "histology": string | null,
  "mmrStatus": string | null,
  "treatmentSummary": string[],
  "currentAssessment": string | null,
  "plan": string | null,
  "medications": string[],
  "investigations": string[],
  "surveillancePlan": string[],
  "pendingActions": string[],
  "keyFlags": string[],
  "prognosis": string | null,
  "fullText": string
}

Rules:
- keyFlags: list ONLY clinically significant alerts (e.g. "Permanent end colostomy — stoma care required", "Lynch syndrome germline testing indicated — PMS2/MSH6", "Rising CEA threshold not specified")
- pendingActions: items explicitly stated as pending or recommended
- treatmentSummary: chronological list of key clinical events
- fullText: complete verbatim text from the document
- Do NOT add information not present in the document
- Do NOT omit any information that IS present`;

interface ScanRequest {
  imageBase64: string;
  mimeType: string;
}

interface ExtractedData {
  patientName: string | null;
  diagnosis: string | null;
  staging: string | null;
  histology: string | null;
  mmrStatus: string | null;
  treatmentSummary: string[];
  currentAssessment: string | null;
  plan: string | null;
  medications: string[];
  investigations: string[];
  surveillancePlan: string[];
  pendingActions: string[];
  keyFlags: string[];
  prognosis: string | null;
  fullText: string;
}

router.post('/', async (req: Request, res: Response) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { imageBase64, mimeType } = req.body as ScanRequest;

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: 'imageBase64 and mimeType required' });
    return;
  }

  // Validate accepted MIME types
  const supportedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const isPdf = mimeType === 'application/pdf';
  const isImage = supportedImages.includes(mimeType);

  if (!isImage && !isPdf) {
    res.status(400).json({ error: `Unsupported file type: ${mimeType}. Send image/jpeg, image/png, or application/pdf.` });
    return;
  }

  log.info({ model: MODEL, mimeType }, 'document-scan: starting extraction');

  try {
    // Build the content block based on type
    type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const contentBlock = isPdf
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: imageBase64,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mimeType as ImageMediaType,
            data: imageBase64,
          },
        };

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let extracted: ExtractedData;
    try {
      extracted = JSON.parse(cleaned) as ExtractedData;
    } catch {
      log.warn({ raw }, 'document-scan: JSON parse failed, returning raw text');
      extracted = {
        patientName: null,
        diagnosis: null,
        staging: null,
        histology: null,
        mmrStatus: null,
        treatmentSummary: [],
        currentAssessment: null,
        plan: null,
        medications: [],
        investigations: [],
        surveillancePlan: [],
        pendingActions: [],
        keyFlags: ['⚠ Document extraction returned unstructured text — review fullText manually'],
        prognosis: null,
        fullText: raw,
      };
    }

    log.info({ patientName: extracted.patientName, keyFlags: extracted.keyFlags?.length }, 'document-scan: extraction complete');
    res.json({ extracted });
  } catch (err) {
    log.error({ err }, 'document-scan: error');
    res.status(500).json({ error: 'Extraction failed — check API key and model availability' });
  }
});

export default router;

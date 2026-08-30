/**
 * POST /api/document-scan
 *
 * Native-first document extraction pipeline:
 *   1. markitdown (Python, local)  → Markdown text
 *   2. clinical-parser (local)     → structured JSON  ← zero tokens
 *   3. Claude API (fallback only)  → used when confidence < CONFIDENCE_THRESHOLD
 *
 * The frontend must present every field for human review before importing
 * into the medical record. Nothing auto-imports.
 */

import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireStaffAuth } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';
import { convertToMarkdown } from '../lib/markitdown.js';
import { parseClinicalDocument, type ExtractedData } from '../lib/clinical-parser.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = process.env.CLAUDE_SCAN_MODEL || 'claude-sonnet-4-6';

// Native parse confidence must reach this to skip the Claude fallback.
// 0.75 = patient name + diagnosis + one of plan/meds/assessment present.
const CONFIDENCE_THRESHOLD = 0.75;

const EXTRACTION_PROMPT = `You are a senior surgical registrar reviewing a clinical document.
Extract ALL clinical information into structured JSON.

Return ONLY valid JSON with this exact schema (null for fields not found):
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
- keyFlags: clinically significant alerts only (allergies, DNR, anticoagulation, high-risk conditions)
- pendingActions: items explicitly stated as pending or recommended
- treatmentSummary: chronological list of key clinical events
- fullText: complete verbatim text from the document
- Do NOT add information not in the document`;

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/html', 'text/csv', 'text/plain',
]);

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

interface ScanRequest {
  imageBase64: string;
  mimeType: string;
}

router.post('/', async (req: Request, res: Response) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { imageBase64, mimeType } = req.body as ScanRequest;

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: 'imageBase64 and mimeType required' });
    return;
  }
  if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
    res.status(400).json({ error: `Unsupported file type: ${mimeType}` });
    return;
  }

  const isImage = IMAGE_MIME_TYPES.has(mimeType);
  log.info({ mimeType }, 'document-scan: start');

  try {
    // ── Step 1: markitdown text extraction (local, zero tokens) ──────────────
    let markdownText: string | null = null;
    if (!isImage) {
      markdownText = await convertToMarkdown(imageBase64, mimeType);
      if (markdownText) log.info({ chars: markdownText.length }, 'document-scan: markitdown ok');
    }

    // ── Step 2: native clinical parser (local, zero tokens) ──────────────────
    let extracted: ExtractedData | null = null;
    let usedClaude = false;

    if (markdownText) {
      const { extracted: parsed, confidence } = parseClinicalDocument(markdownText);
      log.info({ confidence }, 'document-scan: native parse confidence');

      if (confidence >= CONFIDENCE_THRESHOLD) {
        extracted = parsed;
        log.info('document-scan: native parse sufficient — skipping Claude');
      } else {
        log.info({ confidence }, 'document-scan: confidence below threshold — falling back to Claude');
      }
    }

    // ── Step 3: Claude fallback (when native parse insufficient or image-only) ─
    if (!extracted) {
      usedClaude = true;
      type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      let messageContent: Anthropic.MessageParam['content'];

      if (markdownText) {
        // Text-based fallback — still cheaper than vision
        messageContent = [
          { type: 'text', text: `Document content:\n\n${markdownText}\n\n---\n${EXTRACTION_PROMPT}` },
        ];
      } else if (mimeType === 'application/pdf') {
        messageContent = [
          { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: imageBase64 } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ];
      } else {
        messageContent = [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as ImageMediaType, data: imageBase64 } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ];
      }

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: messageContent }],
      });

      const raw = response.content[0].type === 'text' ? response.content[0].text : '';
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

      try {
        extracted = JSON.parse(cleaned) as ExtractedData;
      } catch {
        log.warn({ raw }, 'document-scan: Claude JSON parse failed — returning raw text');
        extracted = {
          patientName: null, diagnosis: null, staging: null, histology: null,
          mmrStatus: null, treatmentSummary: [], currentAssessment: null, plan: null,
          medications: [], investigations: [], surveillancePlan: [], pendingActions: [],
          keyFlags: ['⚠ Document extraction returned unstructured text — review fullText manually'],
          prognosis: null, fullText: raw,
        };
      }
    }

    log.info({ patientName: extracted.patientName, usedClaude }, 'document-scan: complete');
    res.json({ extracted, _meta: { usedClaude } });

  } catch (err) {
    log.error({ err }, 'document-scan: error');
    res.status(500).json({ error: 'Extraction failed — check API key and model availability' });
  }
});

export default router;

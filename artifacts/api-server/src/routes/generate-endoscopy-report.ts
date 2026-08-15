import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireStaffAuth, audit } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const PRACTICE = 'Amise Medical Services — General & Endoscopic Surgery\nDr Dawit Daniel Kabiye, MD, DM\nRodney Bay Medical Centre, Saint Lucia';

const TYPE_LABELS: Record<string, string> = {
  ogd: 'Upper GI Endoscopy (OGD / Gastroscopy)',
  colonoscopy: 'Colonoscopy',
  ercp: 'Endoscopic Retrograde Cholangiopancreatography (ERCP)',
  bronch: 'Flexible Bronchoscopy',
};

const REPORT_INSTRUCTIONS = `Write a formal endoscopy procedure report for inclusion in the medical record.
Use precise endoscopic terminology. Write in past tense throughout.

Structure with clearly labelled sections:
1. ENDOSCOPY REPORT (header)
2. PATIENT — name, age/sex, DOB
3. DATE OF PROCEDURE
4. PROCEDURE — full formal title
5. ENDOSCOPIST — Dr Dawit Daniel Kabiye, MD, DM
6. INSTRUMENT / EQUIPMENT
7. SEDATION / ANAESTHESIA
8. INDICATION(S)
9. PROCEDURE DESCRIPTION — stepwise narrative: patient positioning, instrument introduction, segment-by-segment findings as the scope was advanced and withdrawn, any interventions performed
10. ENDOSCOPIC FINDINGS — structured per anatomical segment
11. INTERVENTIONS — biopsy sites, sphincterotomy, stent placement, stone extraction, polypectomy, haemostasis, etc.
12. COMPLICATIONS — if none, state "None encountered"
13. SPECIMENS — label, site, sent to histopathology/microbiology
14. IMPRESSION — concise overall diagnostic impression and working diagnosis
15. RECOMMENDATIONS — further investigations, follow-up, medical/surgical management
16. SIGNATURE BLOCK — Dr D.D. Kabiye / Date

Style requirements:
- Formal endoscopic terminology (mucosa, lumen, peristalsis, rugal folds, haustra, papilla of Vater, etc.)
- Be specific about scope used, insertion depth/extent, withdrawal technique
- Do not invent findings not provided — use the data given; describe normal where fields are blank
- 300–500 words for the procedure description section`;

router.post('/', async (req: Request, res: Response) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patient, procedureType, fields, date } = req.body as {
    patient: { name: string; age: string; sex: string; dob: string };
    procedureType: string;
    fields: Record<string, string>;
    date?: string;
  };

  if (!patient?.name || !procedureType) {
    res.status(400).json({ error: 'Patient name and procedure type required' });
    return;
  }

  const typeLabel = TYPE_LABELS[procedureType] ?? procedureType.toUpperCase();

  const fieldLines = Object.entries(fields)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `  ${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}: ${v}`)
    .join('\n');

  const context = `
PRACTICE: ${PRACTICE}
DATE OF PROCEDURE: ${date || 'today'}

PATIENT:
  Name: ${patient.name}
  Age/Sex: ${patient.age || '—'} / ${patient.sex || '—'}
  DOB: ${patient.dob || '—'}

PROCEDURE TYPE: ${typeLabel}
ENDOSCOPIST: Dr Dawit Daniel Kabiye, MD, DM

PROCEDURE DATA:
${fieldLines || '  (No structured data provided — generate based on procedure type standards)'}
`.trim();

  const prompt = `${context}\n\n---\n\nINSTRUCTIONS:\n${REPORT_INSTRUCTIONS}\n\nWrite the complete endoscopy report now, ready for the medical record. Only the report — no commentary.`;

  try {
    log.info({ procedureType, patient: patient.name }, 'generate-endoscopy-report request');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: 1600,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(chunk.delta.text);
      }
    }
    res.end();

    void audit({
      action: 'draft',
      entityType: 'clinical_note',
      payload: { route: 'generate-endoscopy-report', procedureType, patientName: patient.name },
    });
  } catch (err) {
    log.error({ err }, 'generate-endoscopy-report error');
    if (!res.headersSent) res.status(500).json({ error: 'Endoscopy report generation failed' });
    else res.end();
  }
});

export default router;

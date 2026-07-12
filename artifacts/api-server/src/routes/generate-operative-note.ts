import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const PRACTICE = 'Amise Medical Services — General & Endoscopic Surgery\nDr Dawit Daniel Kabiye, MD, DM\nRodney Bay Medical Centre, Saint Lucia\nTel: +1 (758) 284-0557';

const OP_NOTE_INSTRUCTIONS = `Write a formal operative note for inclusion in the hospital medical record. Use precise surgical language throughout.

Structure the note with clearly labelled sections:
1. OPERATIVE NOTE (header with practice name, date, surgeon)
2. PATIENT — name, age/sex, DOB
3. DATE OF OPERATION
4. OPERATION PERFORMED — full formal title
5. SURGEON — Dr Dawit Daniel Kabiye, MD, DM
6. ASSISTANT (if applicable)
7. ANAESTHESIA — type and anaesthetist
8. POSITION — patient positioning
9. PREPARATION AND DRAPING — brief, standard
10. PROCEDURE — detailed narrative of operative steps in past tense, including: incision/access, port placement (if laparoscopic), key anatomical structures identified, critical steps with haemostasis, any difficulties or anatomical variants
11. INTRAOPERATIVE FINDINGS — structured findings
12. INTRAOPERATIVE COMPLICATIONS — if any
13. BLOOD LOSS — estimated volume
14. SPECIMENS — what was sent and where
15. DRAINS — if placed, type and location
16. CLOSURE — layered closure details
17. POST-OPERATIVE INSTRUCTIONS
18. SIGNATURE BLOCK — Dr D.D. Kabiye / Date

Style requirements:
- Past tense throughout ("was identified", "were clipped", "the specimen was removed")
- Formal anatomical terminology (cystic duct/artery not "tube", peritoneum not "membrane")
- Be specific about clip placement, suture types, energy devices used
- Include critical view of safety if cholecystectomy
- Note haemostasis confirmation
- Do not invent findings not provided — use exactly the findings given
- 400–700 words for the procedure narrative`;

router.post('/', async (req: Request, res: Response) => {
  const {
    patient, procedure, assistant, anaesthesia, anaesthetist,
    position, incision, duration, findings, complications,
    specimensSent, drains, closure, postOpInstructions, bloodLoss, date,
  } = req.body as Record<string, unknown>;

  const pt = patient as Record<string, string>;
  if (!pt?.name || !procedure) {
    res.status(400).json({ error: 'Patient name and procedure required' });
    return;
  }

  const context = `
PRACTICE: ${PRACTICE}
DATE OF OPERATION: ${date || 'today'}

PATIENT:
  Name: ${pt.name}
  Age/Sex: ${pt.age || '—'}y / ${pt.sex || '—'}
  DOB: ${pt.dob || '—'}

OPERATION: ${procedure}
SURGEON: Dr Dawit Daniel Kabiye, MD, DM
${assistant ? `ASSISTANT: ${assistant}` : 'ASSISTANT: None / scrub nurse'}
ANAESTHESIA: ${anaesthesia || 'GA'}
${anaesthetist ? `ANAESTHETIST: ${anaesthetist}` : ''}
POSITION: ${position || 'Supine'}
INCISION / ACCESS: ${incision || 'Not specified — describe based on procedure type'}

INTRAOPERATIVE FINDINGS:
${findings || 'Not documented — describe standard findings for this procedure'}

PROCEDURE DURATION: ${duration ? `${duration} minutes` : 'not recorded'}
ESTIMATED BLOOD LOSS: ${bloodLoss || 'minimal'}

INTRAOPERATIVE COMPLICATIONS:
${complications || 'None'}

SPECIMENS SENT: ${specimensSent || 'None'}
DRAINS: ${drains || 'None'}
CLOSURE: ${closure || 'Standard layered closure'}
${postOpInstructions ? `POST-OP INSTRUCTIONS: ${postOpInstructions}` : ''}
`.trim();

  const prompt = `${context}\n\n---\n\nINSTRUCTIONS:\n${OP_NOTE_INSTRUCTIONS}\n\nWrite the complete operative note now, ready for the medical record. Do not include explanations or commentary — only the note itself.`;

  try {
    log.info({ procedure, patient: pt.name }, 'generate-operative-note request');

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
  } catch (err) {
    log.error({ err }, 'generate-operative-note error');
    if (!res.headersSent) res.status(500).json({ error: 'Operative note generation failed' });
    else res.end();
  }
});

export default router;

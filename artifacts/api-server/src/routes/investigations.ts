import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getSupabaseAdmin, requireStaffAuth, audit } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';
import { logAudit } from '../lib/audit.js';
import { sendOrDraft } from '../lib/gmail.js';

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

// ---------------------------------------------------------------------------
// POST /api/investigations/extract-results
// Staff uploads a lab/imaging report; Claude (vision) drafts the extracted
// results for a human to review and confirm before saving.
// ---------------------------------------------------------------------------
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
    void logAudit(req, 'create', 'document', undefined, undefined, {
      action: 'scan',
      file_name: fileName ?? null,
      result_count: parsed.results.length,
    });
    res.json(parsed);
  } catch (err) {
    logger.error({ err }, '[investigations/extract-results] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/investigations/lab-order -- create a lab order
// ---------------------------------------------------------------------------
router.post('/api/investigations/lab-order', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const {
    encounterId, patientId, testName, testCategory,
    specimenType, notes, urgency,
  } = (req.body ?? {}) as {
    encounterId?: string; patientId?: string; testName?: string;
    testCategory?: string; specimenType?: string; notes?: string;
    urgency?: string;
  };

  if (!encounterId || !patientId || !testName || !testCategory) {
    res.status(400).json({ error: 'encounterId, patientId, testName, and testCategory are required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    const { data, error } = await supa
      .from('investigation_results')
      .insert({
        encounter_id: encounterId,
        patient_id: patientId,
        test_name: testName,
        test_category: testCategory,
        specimen_type: specimenType ?? null,
        notes: notes ?? null,
        status: 'ordered',
      })
      .select('id')
      .single();

    if (error) throw error;

    await audit({
      action: 'book',
      entityType: 'investigation_result',
      entityId: data.id,
      payload: { encounterId, patientId, testName, testCategory, urgency: urgency ?? 'routine' },
    });

    logger.info({ id: data.id, encounterId, testName }, '[investigations/lab-order] created');
    res.json({ id: data.id, status: 'ordered' });
  } catch (err) {
    logger.error({ err }, '[investigations/lab-order] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/investigations/imaging-order -- create an imaging order
// ---------------------------------------------------------------------------
router.post('/api/investigations/imaging-order', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const {
    encounterId, patientId, orderType, bodyArea, clinicalIndication,
    laterality, urgency, contrastRequired, patientPreparation, notes,
  } = (req.body ?? {}) as {
    encounterId?: string; patientId?: string; orderType?: string;
    bodyArea?: string; clinicalIndication?: string; laterality?: string;
    urgency?: string; contrastRequired?: boolean; patientPreparation?: string;
    notes?: string;
  };

  if (!encounterId || !patientId || !orderType || !bodyArea || !clinicalIndication) {
    res.status(400).json({ error: 'encounterId, patientId, orderType, bodyArea, and clinicalIndication are required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    const { data, error } = await supa
      .from('imaging_orders')
      .insert({
        encounter_id: encounterId,
        patient_id: patientId,
        order_type: orderType,
        body_area: bodyArea,
        clinical_indication: clinicalIndication,
        laterality: laterality ?? null,
        urgency: urgency ?? 'routine',
        contrast_required: contrastRequired ?? false,
        patient_preparation: patientPreparation ?? null,
        notes: notes ?? null,
        status: 'ordered',
      })
      .select('id')
      .single();

    if (error) throw error;

    await audit({
      action: 'book',
      entityType: 'imaging_order',
      entityId: data.id,
      payload: { encounterId, patientId, orderType, bodyArea, urgency: urgency ?? 'routine' },
    });

    logger.info({ id: data.id, encounterId, orderType, bodyArea }, '[investigations/imaging-order] created');
    res.json({ id: data.id, status: 'ordered' });
  } catch (err) {
    logger.error({ err }, '[investigations/imaging-order] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/investigations/result/:id -- record a result for a lab order
// ---------------------------------------------------------------------------
router.post('/api/investigations/result/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  const {
    resultValue, analytes, resultUnit, referenceRange,
    isAbnormal, isCritical, performingLab, notes,
  } = (req.body ?? {}) as {
    resultValue?: string; analytes?: unknown[]; resultUnit?: string;
    referenceRange?: string; isAbnormal?: boolean; isCritical?: boolean;
    performingLab?: string; notes?: string;
  };

  if (!resultValue && !analytes) {
    res.status(400).json({ error: 'resultValue or analytes is required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    // Verify the investigation exists
    const { data: existing, error: fetchErr } = await supa
      .from('investigation_results')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Investigation order not found' });
      return;
    }

    const { error } = await supa
      .from('investigation_results')
      .update({
        result_value: resultValue ?? null,
        analytes: analytes ?? null,
        result_unit: resultUnit ?? null,
        reference_range: referenceRange ?? null,
        is_abnormal: isAbnormal ?? false,
        is_critical: isCritical ?? false,
        performing_lab: performingLab ?? null,
        notes: notes ?? null,
        status: 'resulted',
        reported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    await audit({
      action: 'extract',
      entityType: 'investigation_result',
      entityId: id,
      payload: { status: 'resulted', isCritical: isCritical ?? false },
    });

    logger.info({ id, isCritical: isCritical ?? false }, '[investigations/result] recorded');
    res.json({ id, status: 'resulted' });
  } catch (err) {
    logger.error({ err }, '[investigations/result] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/investigations/imaging-report/:id -- record a report for an imaging order
// ---------------------------------------------------------------------------
router.post('/api/investigations/imaging-report/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  const {
    reportText, performingFacility, radiologist, notes,
  } = (req.body ?? {}) as {
    reportText?: string; performingFacility?: string;
    radiologist?: string; notes?: string;
  };

  if (!reportText) {
    res.status(400).json({ error: 'reportText is required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    // Verify the imaging order exists
    const { data: existing, error: fetchErr } = await supa
      .from('imaging_orders')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Imaging order not found' });
      return;
    }

    const { error } = await supa
      .from('imaging_orders')
      .update({
        report_text: reportText,
        performing_facility: performingFacility ?? null,
        radiologist: radiologist ?? null,
        notes: notes ?? null,
        status: 'reported',
        report_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    await audit({
      action: 'extract',
      entityType: 'imaging_order',
      entityId: id,
      payload: { status: 'reported' },
    });

    logger.info({ id }, '[investigations/imaging-report] recorded');
    res.json({ id, status: 'reported' });
  } catch (err) {
    logger.error({ err }, '[investigations/imaging-report] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/investigations/review/:id -- doctor marks a result as reviewed
// Works for both investigation_results and imaging_orders.
// ---------------------------------------------------------------------------
router.post('/api/investigations/review/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  const { table } = (req.body ?? {}) as {
    table?: 'investigation_results' | 'imaging_orders';
  };

  if (!table || (table !== 'investigation_results' && table !== 'imaging_orders')) {
    res.status(400).json({ error: 'table is required and must be "investigation_results" or "imaging_orders"' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    // Verify the record exists
    const { data: existing, error: fetchErr } = await supa
      .from(table)
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supa
      .from(table)
      .update({
        status: 'reviewed',
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (error) throw error;

    const entityType = table === 'investigation_results' ? 'investigation_result' : 'imaging_order';

    await audit({
      action: 'extract',
      entityType,
      entityId: id,
      payload: { status: 'reviewed' },
    });

    logger.info({ id, table }, '[investigations/review] marked reviewed');
    res.json({ id, status: 'reviewed' });
  } catch (err) {
    logger.error({ err }, '[investigations/review] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/investigations/pending -- list all unreviewed results
// Returns lab results with status 'resulted' and imaging with status 'reported'.
// ---------------------------------------------------------------------------
router.get('/api/investigations/pending', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  try {
    const supa = getSupabaseAdmin();

    const [labRes, imagingRes] = await Promise.all([
      supa
        .from('investigation_results')
        .select('id, patient_id, encounter_id, test_name, test_category, result_value, analytes, is_abnormal, is_critical, status, reported_at, created_at')
        .eq('status', 'resulted')
        .order('reported_at', { ascending: false })
        .limit(100),
      supa
        .from('imaging_orders')
        .select('id, patient_id, encounter_id, order_type, body_area, clinical_indication, urgency, status, report_received_at, report_text, radiologist, created_at')
        .eq('status', 'reported')
        .order('report_received_at', { ascending: false })
        .limit(100),
    ]);

    if (labRes.error) throw labRes.error;
    if (imagingRes.error) throw imagingRes.error;

    res.json({
      labResults: labRes.data ?? [],
      imagingOrders: imagingRes.data ?? [],
    });
  } catch (err) {
    logger.error({ err }, '[investigations/pending] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/investigations/patient/:patientId -- all investigations for a patient
// Returns both lab results and imaging orders ordered by date desc.
// ---------------------------------------------------------------------------
router.get('/api/investigations/patient/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;

  try {
    const supa = getSupabaseAdmin();

    const [labRes, imagingRes] = await Promise.all([
      supa
        .from('investigation_results')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(200),
      supa
        .from('imaging_orders')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    if (labRes.error) throw labRes.error;
    if (imagingRes.error) throw imagingRes.error;

    res.json({
      labResults: labRes.data ?? [],
      imagingOrders: imagingRes.data ?? [],
    });
  } catch (err) {
    logger.error({ err }, '[investigations/patient] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/investigations/send-lab-request
// Email a lab test request to the specified lab address.
// ---------------------------------------------------------------------------
router.post('/api/investigations/send-lab-request', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { to, patientName, age, dob, sex, mrNumber, tests, indication, urgency, doctorName } = (req.body ?? {}) as {
    to?: string; patientName?: string; age?: string; dob?: string; sex?: string; mrNumber?: string;
    tests?: string[]; indication?: string; urgency?: string; doctorName?: string;
  };

  if (!to || !Array.isArray(tests) || tests.length === 0) {
    res.status(400).json({ error: 'to and tests[] are required' });
    return;
  }

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const patientLine = [patientName, dob ? `DOB: ${dob}` : null, age ? `Age: ${age}` : null, sex && sex !== 'unknown' ? sex : null, mrNumber ? `MRN: ${mrNumber}` : null].filter(Boolean).join(' · ');

  const body = [
    'LABORATORY REQUEST',
    '==================',
    `Date: ${today}`,
    `Requesting clinician: ${doctorName ?? 'Dr Dawit Daniel Kabiye MD, DM'}`,
    `Practice: Amise Medical Services, Rodney Bay, Saint Lucia`,
    '',
    'PATIENT',
    patientLine || '(details not provided)',
    '',
    `URGENCY: ${urgency ?? 'Routine'}`,
    indication ? `INDICATION: ${indication}` : '',
    '',
    'TESTS REQUESTED',
    ...tests.map(t => `  • ${t}`),
    '',
    '---',
    'Please contact the practice at +1 (758) 284-0557 with any queries.',
    'Amise Medical Services · Confidential Patient Information',
  ].filter(line => line !== undefined).join('\n');

  try {
    const result = await sendOrDraft({
      to,
      subject: `Lab Request — ${patientName ?? 'Patient'} — ${urgency ?? 'Routine'} — ${today}`,
      body,
    });

    void logAudit(req, 'create', 'document', undefined, undefined, {
      action: 'send-lab-request', to, patientName: patientName ?? null,
      testCount: tests.length, urgency: urgency ?? 'Routine',
    });

    res.json({ action: result.action });
  } catch (err) {
    logger.error({ err }, '[investigations/send-lab-request] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/investigations/scan-referral
// Accept a base64 image/PDF or plain text referral letter and extract
// structured clinical data using Claude vision.
// ---------------------------------------------------------------------------
const REFERRAL_SCAN_SYSTEM = `You are a surgical registrar extracting information from a referral letter or clinical document for AMISE MedFlow EMR (Amise Medical Services, Saint Lucia). Extract ALL clinical information for EMR auto-population.

Return ONLY valid JSON (no markdown fences, no explanation):

{
  "visitType": string | null,
  "chiefComplaint": string | null,
  "hpi": string | null,
  "medications": string | null,
  "surgicalHistory": string | null,
  "pmh": string | null,
  "referredBy": string | null,
  "referralDate": string | null,
  "referralDx": string | null,
  "referralSummary": string | null,
  "labs": string[],
  "imaging": string[],
  "patientName": string | null,
  "age": string | null,
  "sex": string | null,
  "extracted_labs": {
    "wbc": number | null,
    "haemoglobin": number | null,
    "platelets": number | null,
    "inr": number | null,
    "crp": number | null,
    "bilirubin_total": number | null,
    "bilirubin_direct": number | null,
    "alp": number | null,
    "ggt": number | null,
    "ast": number | null,
    "alt": number | null,
    "albumin": number | null,
    "sodium": number | null,
    "potassium": number | null,
    "urea": number | null,
    "creatinine": number | null,
    "egfr": number | null,
    "glucose": number | null,
    "hba1c": number | null,
    "amylase": number | null,
    "lipase": number | null,
    "ldh": number | null,
    "calcium": number | null,
    "pao2": number | null,
    "ca19_9": number | null,
    "cea": number | null
  } | null
}

visitType must be one of: "new_consult", "follow_up", "post_op", "ercp", "endoscopy_ogd", "endoscopy_col", "breast", "urgent", "telephone", "diabetic_foot", or null.
- OGD / gastroscopy / upper GI endoscopy → "endoscopy_ogd"
- Colonoscopy / lower GI endoscopy → "endoscopy_col"
- ERCP → "ercp"
- Breast lump / breast clinic → "breast"
- Post-operative review → "post_op"
- Follow-up visit → "follow_up"
- Urgent referral → "urgent"
- First specialist consultation → "new_consult"

chiefComplaint: 1-2 sentence summary of the main presenting problem.
hpi: Full history of presenting illness (preserve all clinical detail).
medications: All medications with doses and frequencies, one per line.
surgicalHistory: Previous surgeries, one per line.
pmh: Past medical conditions and comorbidities, one per line.
referredBy: Full name of the referring clinician only (not their specialty or institution).
referralDate: Date of referral letter in YYYY-MM-DD format.
referralDx: Stated or suspected diagnosis in the referral.
referralSummary: Complete clinical narrative from the referring doctor verbatim.
labs: Investigation tests requested or mentioned (e.g. ["FBC", "U&E", "LFTs", "HbA1c"]).
imaging: Imaging studies mentioned or requested (e.g. ["Ultrasound abdomen", "CT abdomen/pelvis"]).
patientName: Full patient name if stated.
age: Patient age as a number string only (e.g. "45").
sex: Patient sex if stated — one of "male", "female", "other", "unknown".
extracted_labs: Numeric values ONLY for lab results that are EXPLICITLY STATED with their value in the document. Convert all values to standard SI units (mmol/L, µmol/L, IU/L, g/L, ×10⁹/L). Set to null for any test not mentioned or without a numeric result. Do NOT invent or estimate values. Conversion rules: bilirubin mg/dL → µmol/L multiply by 17.1; BUN mg/dL → urea mmol/L divide by 2.8; glucose mg/dL → mmol/L divide by 18; haemoglobin g/dL → g/L multiply by 10; HbA1c % → mmol/mol subtract 2.15 then multiply by 10.929.`;

router.post('/api/investigations/scan-referral', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { content, contentType, mimeType } = (req.body ?? {}) as {
    content?: string;
    contentType?: 'text' | 'image_base64';
    mimeType?: string;
  };

  if (!content || !contentType) {
    res.status(400).json({ error: 'content and contentType are required' });
    return;
  }

  if (contentType === 'image_base64') {
    const mime = mimeType ?? 'image/jpeg';
    if (!SUPPORTED_MIME_TYPES.has(mime)) {
      res.status(400).json({ error: `Unsupported MIME type: ${mime}` });
      return;
    }
  }

  try {
    type MsgParam = Anthropic.MessageParam;
    const messages: MsgParam[] = contentType === 'image_base64'
      ? [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: (mimeType ?? 'image/jpeg') as Anthropic.Base64ImageSource['media_type'],
                data: content,
              },
            },
            { type: 'text', text: 'Extract all clinical information from this referral letter or clinical document.' },
          ],
        }]
      : [{
          role: 'user',
          content: `Extract all clinical information from this referral letter:\n\n${content}`,
        }];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: REFERRAL_SCAN_SYSTEM,
      messages,
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ rawText }, '[scan-referral] no JSON in response');
      res.status(502).json({ error: 'No structured data in AI response' });
      return;
    }

    const extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    logger.info({ extracted }, '[scan-referral] extracted');
    res.json({ extracted });
  } catch (err) {
    logger.error({ err }, '[scan-referral] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/investigations/received-documents
// List email-received documents not yet matched to a patient (inbox for
// incoming lab/pathology/imaging results that arrived via email).
// ---------------------------------------------------------------------------
router.get('/api/investigations/received-documents', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  try {
    const supa = getSupabaseAdmin();

    // Email-received and manually-uploaded documents with completed AI extraction
    const { data: docs, error: docsErr } = await supa
      .from('documents')
      .select('id, title, document_type, mime_type, ai_extracted_data, ai_flags, notes, created_at, patient_id')
      .in('source', ['received_email', 'manual_upload'])
      .in('ai_extraction_status', ['done', 'failed', 'skipped'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (docsErr) throw docsErr;

    const docList = docs ?? [];
    if (docList.length === 0) {
      res.json({ documents: [] });
      return;
    }

    // Find which docs are already linked to an investigation_results row
    const docIds = docList.map(d => d.id as string);
    const { data: linked } = await supa
      .from('investigation_results')
      .select('linked_document_id')
      .in('linked_document_id', docIds);

    const linkedIds = new Set((linked ?? []).map(r => r.linked_document_id as string));

    // Return only unmatched docs (or docs where patient_id is null = no patient yet)
    const unmatched = docList.filter(d => !linkedIds.has(d.id as string));

    res.json({ documents: unmatched });
  } catch (err) {
    logger.error({ err }, '[investigations/received-documents] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/investigations/received-documents/:id/match
// Match an email-received document to a patient and file it as a result in
// investigation_results so it appears in the Results Inbox.
// ---------------------------------------------------------------------------
router.post('/api/investigations/received-documents/:id/match', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  const { patientId, testName, testCategory, isCritical, notes: extraNotes } = (req.body ?? {}) as {
    patientId?: string;
    testName?: string;
    testCategory?: string;
    isCritical?: boolean;
    notes?: string;
  };

  if (!patientId) {
    res.status(400).json({ error: 'patientId is required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    // Fetch the document
    const { data: doc, error: docErr } = await supa
      .from('documents')
      .select('id, title, document_type, ai_extracted_data, ai_flags, notes, created_at')
      .eq('id', id)
      .in('source', ['received_email', 'manual_upload'])
      .maybeSingle();

    if (docErr || !doc) {
      res.status(404).json({ error: 'Document not found or not an email-received/manual-upload document' });
      return;
    }

    // Check not already matched
    const { data: existing } = await supa
      .from('investigation_results')
      .select('id')
      .eq('linked_document_id', id)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: 'This document has already been matched to a result' });
      return;
    }

    // Parse AI extraction data
    let aiData: { documentSummary?: string; reportDate?: string | null; extractedFacts?: Array<{ label: string; value: string; unit?: string | null; referenceRange?: string | null; markedAbnormal?: boolean }> } = {};
    try {
      aiData = typeof doc.ai_extracted_data === 'string'
        ? JSON.parse(doc.ai_extracted_data)
        : (doc.ai_extracted_data as typeof aiData ?? {});
    } catch { /* use empty */ }

    let aiFlags: Array<{ type: string; severity: string; label: string; detail?: string }> = [];
    try {
      aiFlags = typeof doc.ai_flags === 'string'
        ? JSON.parse(doc.ai_flags)
        : (Array.isArray(doc.ai_flags) ? doc.ai_flags as typeof aiFlags : []);
    } catch { /* use empty */ }

    const isAbnormal = (aiData.extractedFacts ?? []).some(f => f.markedAbnormal);
    const autoIsCritical = aiFlags.some(f => f.severity === 'urgent');
    const finalIsCritical = isCritical ?? autoIsCritical;

    // Build analytes from extractedFacts
    const analytes = (aiData.extractedFacts ?? []).length > 0
      ? (aiData.extractedFacts ?? []).map(f => ({
          name:     f.label,
          value:    f.value,
          unit:     f.unit ?? null,
          ref:      f.referenceRange ?? null,
          abnormal: f.markedAbnormal ?? false,
          critical: false,
        }))
      : null;

    // Derive result_value from AI summary if no individual analytes
    const resultValue = analytes ? null : (aiData.documentSummary ?? null);

    // Infer test_category from document_type
    const categoryFromType: Record<string, string> = {
      lab_report:    'other',
      imaging_report: 'other',
    };
    const finalTestCategory = testCategory ?? categoryFromType[doc.document_type as string] ?? 'other';

    // Extract provider name from notes ("Received by email from Tapion Pathology (email@…)…")
    const providerMatch = (doc.notes as string | null)?.match(/^Received by email from ([^(]+)/);
    const performingLab = providerMatch ? providerMatch[1].trim() : null;

    // Reported date from AI or document created_at
    let reportedAt: string = doc.created_at as string;
    if (aiData.reportDate) {
      const d = new Date(aiData.reportDate);
      if (!isNaN(d.getTime())) reportedAt = d.toISOString();
    }

    const combinedNotes = [doc.notes as string | null, extraNotes].filter(Boolean).join('\n');

    const { data: result, error: insertErr } = await supa
      .from('investigation_results')
      .insert({
        patient_id:        patientId,
        encounter_id:      null,
        test_name:         testName ?? (aiData.documentSummary ?? (doc.title as string)),
        test_category:     finalTestCategory,
        performing_lab:    performingLab,
        result_value:      resultValue,
        analytes:          analytes,
        is_abnormal:       isAbnormal,
        is_critical:       finalIsCritical,
        status:            'resulted',
        reported_at:       reportedAt,
        linked_document_id: id,
        notes:             combinedNotes || null,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    // Update documents.patient_id to link the document to the patient
    await supa.from('documents').update({ patient_id: patientId }).eq('id', id);

    await audit({
      action: 'extract',
      entityType: 'investigation_result',
      entityId: result.id,
      payload: { source: 'received_email', document_id: id, patientId, isCritical: finalIsCritical },
    });

    logger.info({ resultId: result.id, docId: id, patientId, isCritical: finalIsCritical }, '[investigations/received-documents/match] matched');
    res.json({ id: result.id, status: 'resulted', isCritical: finalIsCritical });
  } catch (err) {
    logger.error({ err }, '[investigations/received-documents/match] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;

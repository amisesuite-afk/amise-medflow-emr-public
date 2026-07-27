import { Router } from 'express';
import { sb, requireStaffAuth, requireCronSecret } from '../lib/supabase.js';
import { processIncomingDocumentEmails, backfillDocumentEmails } from '../lib/email-documents.js';
import { extractDocumentInsights } from './portal.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

const PROVIDER_TYPES = ['lab', 'radiology', 'referring_doctor', 'other'];
const DOCUMENT_TYPES = [
  'lab_report', 'imaging_report', 'referral_letter', 'consent_form',
  'surgical_report', 'discharge_summary', 'prescription', 'insurance_form', 'other',
];

router.post('/api/cron/email-documents', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  try {
    const summary = await processIncomingDocumentEmails();
    logger.info({ summary }, '[cron/email-documents] done');
    res.json(summary);
  } catch (err) {
    logger.error({ err }, '[cron/email-documents] error');
    res.status(500).json({ error: errStr(err) });
  }
});

// POST /api/cron/email-documents/backfill?days=30
// Re-scans Gmail for all messages (read or unread) from known referring
// providers within the last N days and creates documents for any new
// attachments not already stored. Safe to re-run — duplicate uploads are
// detected and counted as alreadyStored rather than errors.
router.post('/api/cron/email-documents/backfill', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const days = Math.min(90, Math.max(1, Number((req.query as { days?: string }).days ?? 30)));

  try {
    const summary = await backfillDocumentEmails(days);
    logger.info({ summary, days }, '[cron/email-documents/backfill] done');
    res.json({ ...summary, days });
  } catch (err) {
    logger.error({ err }, '[cron/email-documents/backfill] error');
    res.status(500).json({ error: errStr(err) });
  }
});

const MANUAL_UPLOAD_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]);

// POST /api/investigations/manual-upload-document
// Staff uploads a photo or scan of a physical lab/imaging result (base64)
// and it enters the same "Received documents" queue as email-delivered results,
// ready to be matched to a patient via the Results Inbox.
router.post('/api/investigations/manual-upload-document', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { dataBase64, mimeType, fileName, providerName, documentType } = (req.body ?? {}) as {
    dataBase64?: string;
    mimeType?: string;
    fileName?: string;
    providerName?: string;
    documentType?: string;
  };

  if (!dataBase64 || !mimeType) {
    res.status(400).json({ error: 'dataBase64 and mimeType are required' });
    return;
  }
  if (!MANUAL_UPLOAD_MIME.has(mimeType)) {
    res.status(400).json({ error: `Unsupported file type: ${mimeType}` });
    return;
  }

  const VALID_DOC_TYPES = [
    'lab_report', 'imaging_report', 'referral_letter', 'consent_form',
    'surgical_report', 'discharge_summary', 'prescription', 'insurance_form', 'other',
  ];
  const finalDocType = documentType && VALID_DOC_TYPES.includes(documentType) ? documentType : 'other';

  try {
    const buffer = Buffer.from(dataBase64, 'base64');
    const ext = mimeType === 'application/pdf' ? '.pdf'
      : mimeType === 'image/png' ? '.png'
      : mimeType === 'image/webp' ? '.webp'
      : '.jpg';
    const timestamp = Date.now();
    const storagePath = `received-email/manual-${timestamp}${ext}`;

    const { error: uploadError } = await sb()
      .storage
      .from('patient-documents')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: doc, error: insertError } = await sb()
      .from('documents')
      .insert({
        patient_id:           null,
        document_type:        finalDocType,
        title:                fileName ?? `Manual upload ${new Date().toLocaleDateString('en-GB')}`,
        file_name:            fileName ?? `upload-${timestamp}${ext}`,
        storage_path:         storagePath,
        mime_type:            mimeType,
        file_size_bytes:      buffer.length,
        source:               'manual_upload',
        created_by:           null,
        ai_extraction_status: 'pending',
        notes:                providerName
          ? `Manually uploaded by staff. Provider: ${providerName}.`
          : 'Manually uploaded by staff.',
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    void extractDocumentInsights(doc.id);

    logger.info({ docId: doc.id, mimeType, providerName }, '[manual-upload-document] queued');
    res.json({ id: doc.id, status: 'processing' });
  } catch (err) {
    logger.error({ err }, '[manual-upload-document] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── Referring providers directory ─────────────────────────────────────────────

router.get('/api/admin/referring-providers', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  try {
    const { data, error } = await sb()
      .from('referring_providers')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ providers: data ?? [] });
  } catch (err) {
    req.log.error({ err }, '[admin/referring-providers] list error');
    res.status(500).json({ error: errStr(err) });
  }
});

router.post('/api/admin/referring-providers', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { name, email, provider_type, default_document_type, notes, active } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    provider_type?: string;
    default_document_type?: string;
    notes?: string;
    active?: boolean;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (!provider_type || !PROVIDER_TYPES.includes(provider_type)) {
    res.status(400).json({ error: `provider_type must be one of: ${PROVIDER_TYPES.join(', ')}` });
    return;
  }
  if (!default_document_type || !DOCUMENT_TYPES.includes(default_document_type)) {
    res.status(400).json({ error: `default_document_type must be one of: ${DOCUMENT_TYPES.join(', ')}` });
    return;
  }

  try {
    const { data, error } = await sb()
      .from('referring_providers')
      .insert({
        name:                  name.trim(),
        email:                 email?.trim().toLowerCase() || null,
        provider_type,
        default_document_type,
        notes:                 notes?.trim() || null,
        active:                active ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ provider: data });
  } catch (err) {
    req.log.error({ err }, '[admin/referring-providers] create error');
    res.status(500).json({ error: errStr(err) });
  }
});

router.patch('/api/admin/referring-providers/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { id } = req.params;
  const { name, email, provider_type, default_document_type, notes, active } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    provider_type?: string;
    default_document_type?: string;
    notes?: string;
    active?: boolean;
  };

  if (provider_type !== undefined && !PROVIDER_TYPES.includes(provider_type)) {
    res.status(400).json({ error: `provider_type must be one of: ${PROVIDER_TYPES.join(', ')}` });
    return;
  }
  if (default_document_type !== undefined && !DOCUMENT_TYPES.includes(default_document_type)) {
    res.status(400).json({ error: `default_document_type must be one of: ${DOCUMENT_TYPES.join(', ')}` });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email?.trim().toLowerCase() || null;
  if (provider_type !== undefined) updates.provider_type = provider_type;
  if (default_document_type !== undefined) updates.default_document_type = default_document_type;
  if (notes !== undefined) updates.notes = notes?.trim() || null;
  if (active !== undefined) updates.active = active;

  try {
    const { data, error } = await sb()
      .from('referring_providers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ provider: data });
  } catch (err) {
    req.log.error({ err }, '[admin/referring-providers/:id] update error');
    res.status(500).json({ error: errStr(err) });
  }
});

router.delete('/api/admin/referring-providers/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { id } = req.params;

  try {
    const { error } = await sb()
      .from('referring_providers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ status: 'deleted' });
  } catch (err) {
    req.log.error({ err }, '[admin/referring-providers/:id] delete error');
    res.status(500).json({ error: errStr(err) });
  }
});

export default router;

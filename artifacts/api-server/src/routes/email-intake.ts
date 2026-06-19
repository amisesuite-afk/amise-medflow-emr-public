import { Router } from 'express';
import { sb, requireStaffAuth, requireCronSecret } from '../lib/supabase.js';
import { processIncomingDocumentEmails } from '../lib/email-documents.js';
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

  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'name and email are required' });
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
        email:                 email.trim().toLowerCase(),
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
  if (email !== undefined) updates.email = email.trim().toLowerCase();
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

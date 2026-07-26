/**
 * Staff-only admin routes.
 *
 * GET  /api/admin/patient-accounts          — list portal accounts (optionally ?unlinked=true or ?email=…)
 * POST /api/admin/patient-accounts/:id/link — link an account to a patient record
 */
import { Router } from 'express';
import { sb, requireStaffAuth } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();

// ── GET /api/admin/patient-accounts ──────────────────────────────────────────

router.get('/api/admin/patient-accounts', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { unlinked, email } = req.query as { unlinked?: string; email?: string };

  try {
    let query = sb()
      .from('patient_accounts')
      .select('id, email, patient_id, last_login_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (email) {
      query = query.eq('email', email.toLowerCase());
    } else if (unlinked === 'true') {
      query = query.is('patient_id', null);
    }

    const { data: accounts, error } = await query;
    if (error) throw error;

    // Batch-fetch patient names for linked accounts
    const patientIds = [...new Set(
      (accounts ?? []).map(a => a.patient_id).filter(Boolean) as string[],
    )];

    const patientNames: Record<string, string> = {};
    if (patientIds.length > 0) {
      const { data: patients } = await sb()
        .from('patients')
        .select('id, full_name')
        .in('id', patientIds);
      for (const p of patients ?? []) {
        patientNames[p.id as string] = p.full_name as string;
      }
    }

    const rows = (accounts ?? []).map(a => ({
      ...a,
      patient_name: a.patient_id ? (patientNames[a.patient_id as string] ?? null) : null,
    }));

    res.json({ accounts: rows });
  } catch (err) {
    log.error({ err }, 'admin patient-accounts list error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list accounts' });
  }
});

// ── POST /api/admin/patient-accounts/:id/link ────────────────────────────────

router.post('/api/admin/patient-accounts/:id/link', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { id } = req.params;
  const { patient_id } = req.body as { patient_id?: string };

  if (!patient_id) {
    res.status(400).json({ error: 'patient_id is required' });
    return;
  }

  try {
    const { error } = await sb()
      .from('patient_accounts')
      .update({ patient_id })
      .eq('id', id);

    if (error) throw error;

    // Fetch the patient name to return in the response
    const { data: patient } = await sb()
      .from('patients')
      .select('full_name')
      .eq('id', patient_id)
      .maybeSingle();

    log.info({ accountId: id, patient_id }, 'patient account linked to patient record');
    res.json({ success: true, patient_name: patient?.full_name ?? null });
  } catch (err) {
    log.error({ err }, 'admin link patient account error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to link account' });
  }
});

export default router;

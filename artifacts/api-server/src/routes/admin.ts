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

// ── DELETE /api/admin/patient-accounts/:id ───────────────────────────────────
// Removes an unlinked portal account. Refuses to delete accounts that are
// already linked to a patient record — those must be unlinked first.

router.delete('/api/admin/patient-accounts/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { id } = req.params;

  try {
    const { data: account, error: fetchErr } = await sb()
      .from('patient_accounts')
      .select('id, email, patient_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    if (account.patient_id) {
      res.status(409).json({ error: 'Cannot delete a linked account — unlink it from the patient record first.' });
      return;
    }

    const { error: delErr } = await sb()
      .from('patient_accounts')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    log.info({ accountId: id, email: account.email }, 'unlinked portal account deleted by staff');
    res.json({ success: true });
  } catch (err) {
    log.error({ err }, 'admin delete patient account error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete account' });
  }
});

// ── POST /api/admin/patients/quick-create ────────────────────────────────────
// Create a minimal patient record from a name (e.g. extracted from a lab
// report). MRN is auto-assigned by DB trigger. All fields except full_name
// are optional. Returns { id, mrn, full_name } for immediate use in result
// matching without a round-trip to the full patient creation form.

router.post('/api/admin/patients/quick-create', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { fullName, dateOfBirth, sex, phone, email } = (req.body ?? {}) as {
    fullName?: string;
    dateOfBirth?: string;
    sex?: string;
    phone?: string;
    email?: string;
  };

  if (!fullName?.trim()) {
    res.status(400).json({ error: 'fullName is required' });
    return;
  }

  const VALID_SEX = ['male', 'female', 'other', 'unknown'];

  try {
    const { data, error } = await sb()
      .from('patients')
      .insert({
        full_name:     fullName.trim(),
        date_of_birth: dateOfBirth ?? null,
        sex:           (sex && VALID_SEX.includes(sex)) ? sex : 'unknown',
        phone:         phone?.trim() ?? null,
        email:         email?.trim().toLowerCase() ?? null,
      })
      .select('id, mrn, full_name')
      .single();

    if (error) throw error;

    log.info({ id: data.id, mrn: data.mrn, fullName }, '[admin/patients/quick-create] created');
    res.json({ id: data.id, mrn: data.mrn, full_name: data.full_name });
  } catch (err) {
    log.error({ err }, '[admin/patients/quick-create] error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create patient' });
  }
});

export default router;

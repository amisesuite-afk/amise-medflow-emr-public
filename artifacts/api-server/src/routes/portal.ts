import { Router } from 'express';
import { getSupabaseAdmin, audit } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const router = Router();

// POST /api/patient/invite — staff sends a patient portal invite
router.post('/api/patient/invite', async (req, res) => {
  const { patient_id, email } = (req.body ?? {}) as { patient_id?: string; email?: string };

  if (!patient_id || !email) {
    res.status(400).json({ error: 'patient_id and email are required' });
    return;
  }

  const emailNorm = email.trim().toLowerCase();

  try {
    const supa = getSupabaseAdmin();
    const portalUrl = process.env.PORTAL_URL ?? 'https://front-desk-amisesuite-afks-projects.vercel.app/patient';

    // Invite or re-invite via Supabase Auth
    const { data: inviteData, error: inviteErr } = await supa.auth.admin.inviteUserByEmail(emailNorm, {
      redirectTo: portalUrl,
      data: { patient_id, role: 'patient' },
    });

    let authUserId: string | null = null;

    if (inviteErr) {
      // If user already exists, look them up instead
      if (inviteErr.message.toLowerCase().includes('already been registered') ||
          inviteErr.message.toLowerCase().includes('already registered')) {
        const listResult = await supa.auth.admin.listUsers();
        const existing = (listResult.data?.users ?? []).find((u: { email?: string; id: string }) => u.email === emailNorm);
        authUserId = existing?.id ?? null;
      } else {
        logger.error({ inviteErr }, '[portal/invite] invite error');
        res.status(400).json({ error: inviteErr.message });
        return;
      }
    } else {
      authUserId = inviteData?.user?.id ?? null;
    }

    // Link auth user to patient record and enable portal
    const update: Record<string, unknown> = { email: emailNorm, portal_enabled: true };
    if (authUserId) {
      update.auth_user_id = authUserId;
      update.portal_registered_at = new Date().toISOString();
    }
    await supa.from('patients').update(update).eq('id', patient_id);

    await audit({
      action: 'send',
      entityType: 'patient',
      entityId: patient_id,
      payload: { action: 'portal_invite', email: emailNorm, auth_user_id: authUserId },
    });

    logger.info({ patient_id, email: emailNorm, authUserId }, '[portal/invite] invite sent');
    res.json({ success: true, auth_user_id: authUserId });
  } catch (err) {
    logger.error({ err }, '[portal/invite] error');
    res.status(502).json({ error: String(err) });
  }
});

export default router;

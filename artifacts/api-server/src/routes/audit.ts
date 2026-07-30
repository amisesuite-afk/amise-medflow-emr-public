/**
 * Audit log viewer — admin/doctor only.
 *
 * GET /api/audit-log  (?patientId &userId &action &resourceType &from &to &limit &offset)
 */
import { Router } from 'express';
import { sb, requireStaffAuth } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();

router.get('/api/audit-log', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const {
    patientId, userId, action, resourceType,
    from, to,
    limit  = '100',
    offset = '0',
  } = req.query as {
    patientId?: string; userId?: string;
    action?: string; resourceType?: string;
    from?: string; to?: string;
    limit?: string; offset?: string;
  };

  try {
    let query = sb()
      .from('audit_log')
      .select('id, user_id, user_email, action, resource_type, resource_id, patient_id, details, ip_address, user_agent, mode, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit, 10) || 100, 500))
      .range(parseInt(offset, 10) || 0, (parseInt(offset, 10) || 0) + (Math.min(parseInt(limit, 10) || 100, 500) - 1));

    if (patientId)    query = query.eq('patient_id', patientId);
    if (userId)       query = query.eq('user_id', userId);
    if (action)       query = query.eq('action', action);
    if (resourceType) query = query.eq('resource_type', resourceType);
    if (from)         query = query.gte('created_at', from);
    if (to)           query = query.lte('created_at', to);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ entries: data ?? [] });
  } catch (err) {
    log.error({ err }, '[audit-log] list error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch audit log' });
  }
});

export default router;

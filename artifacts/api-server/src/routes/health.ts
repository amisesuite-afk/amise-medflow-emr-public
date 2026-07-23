import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { requireCronSecret } from "../lib/supabase.js";

const router: IRouter = Router();

router.get("/api/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/api/healthz/env", (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const check = (key: string) => !!process.env[key];
  const mode = process.env.MODE || 'dry_run';
  const smsProvider = process.env.SMS_PROVIDER || 'dry_run';

  res.json({
    mode,
    smsProvider,
    services: {
      supabase:   { url: check('SUPABASE_URL'), serviceKey: check('SUPABASE_SERVICE_ROLE_KEY') },
      anthropic:  { apiKey: check('ANTHROPIC_API_KEY') },
      google:     { oauthClient: check('GOOGLE_OAUTH_CLIENT_ID'), oauthSecret: check('GOOGLE_OAUTH_CLIENT_SECRET'), refreshToken: check('GOOGLE_OAUTH_REFRESH_TOKEN'), serviceAccount: check('GOOGLE_SERVICE_ACCOUNT_JSON') },
      gmail:      { user: process.env.GMAIL_USER || '(not set)' },
      calendars:  { rodneyBay: check('CALENDAR_ID_RODNEY_BAY'), tapionErcp: check('CALENDAR_ID_TAPION_ERCP') },
      twilio:     { sid: check('TWILIO_ACCOUNT_SID'), authToken: check('TWILIO_AUTH_TOKEN'), fromNumber: check('TWILIO_FROM_NUMBER') },
      notify:     { staffPhone: check('STAFF_NOTIFY_PHONE'), staffEmail: check('STAFF_NOTIFY_EMAIL'), doctorEmail: check('DOCTOR_NOTIFY_EMAIL') },
      portal:     { url: process.env.PORTAL_URL || '(not set)', dashboardUrl: process.env.DASHBOARD_URL || '(not set)' },
      cron:       { secret: check('CRON_SECRET') },
    },
  });
});

// ── GET /api/healthz/schema ───────────────────────────────────────────────────
// Returns which expected tables exist in Supabase. Protected by CRON_SECRET.
// Useful for operators to verify migrations have been applied without logging
// into the Supabase dashboard.

const EXPECTED_TABLES = [
  'patients', 'encounters', 'assessments', 'plans', 'clinical_notes',
  'allergies', 'medications', 'audit_logs', 'appointment_requests',
  'questionnaire_sessions', 'patient_accounts', 'user_profiles',
  'clinical_guidelines', 'patient_token_blacklist',
] as const;

router.get('/api/healthz/schema', async (req, res) => {
  if (!requireCronSecret(req, res)) return;
  try {
    const results = await Promise.all(
      EXPECTED_TABLES.map(async table => {
        const { error } = await (await import('../lib/supabase.js')).sb()
          .from(table as string)
          .select('count', { count: 'exact', head: true });
        return { table, exists: !error, error: error?.message ?? null };
      })
    );
    const missing = results.filter(r => !r.exists);
    res.json({
      ok: missing.length === 0,
      tables: results,
      missingCount: missing.length,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
